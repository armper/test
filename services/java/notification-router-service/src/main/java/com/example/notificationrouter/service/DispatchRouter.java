package com.example.notificationrouter.service;

import com.example.notificationrouter.client.AlertHistoryClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalTime;
import java.util.Iterator;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class DispatchRouter {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AlertHistoryClient alertHistoryClient;

    @Value("${topics.notify-email}")
    private String emailTopic;

    @Value("${topics.notify-push}")
    private String pushTopic;

    @Value("${topics.notify-sms}")
    private String smsTopic;

    public DispatchRouter(KafkaTemplate<String, String> kafkaTemplate, AlertHistoryClient alertHistoryClient) {
        this.kafkaTemplate = kafkaTemplate;
        this.alertHistoryClient = alertHistoryClient;
    }

    @KafkaListener(topics = "notify.dispatch.request.v1")
    public void handleDispatch(ConsumerRecord<String, String> record) {
        try {
            String payload = record.value();
            JsonNode root = objectMapper.readTree(payload);
            JsonNode prefs = root.path("user_preferences");

            if (isQuietHours(prefs)) {
                return;
            }

            Iterator<String> channels = prefs.path("channels").fieldNames();
            boolean dispatched = false;
            while (channels.hasNext()) {
                String channel = channels.next();
                boolean enabled = prefs.path("channels").path(channel).asBoolean(false);
                if (!enabled) {
                    continue;
                }
                String topic = resolveTopic(channel);
                kafkaTemplate.executeInTransaction(operations -> {
                    operations.send(topic, record.key(), payload);
                    return null;
                });
                dispatched = true;
            }
            if (dispatched) {
                alertHistoryClient.recordDispatch(root);
            }
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to route notification", ex);
        }
    }

    private boolean isQuietHours(JsonNode prefs) {
        JsonNode quiet = prefs.path("quiet_hours");
        if (quiet.isMissingNode()) {
            return false;
        }
        LocalTime now = LocalTime.now();
        LocalTime start = LocalTime.parse(quiet.path("start").asText("00:00"));
        LocalTime end = LocalTime.parse(quiet.path("end").asText("00:00"));
        if (start.isBefore(end)) {
            return now.isAfter(start) && now.isBefore(end);
        }
        return now.isAfter(start) || now.isBefore(end);
    }

    private String resolveTopic(String channel) {
        return switch (channel) {
            case "email" -> emailTopic;
            case "push" -> pushTopic;
            case "sms" -> smsTopic;
            default -> throw new IllegalArgumentException("Unsupported channel: " + channel);
        };
    }
}

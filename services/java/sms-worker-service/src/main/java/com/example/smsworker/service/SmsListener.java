package com.example.smsworker.service;

import com.example.smsworker.model.SmsLog;
import com.example.smsworker.repository.SmsLogRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class SmsListener {

    private final SmsLogRepository repository;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${topics.outcome}")
    private String outcomeTopic;

    public SmsListener(SmsLogRepository repository, KafkaTemplate<String, String> kafkaTemplate) {
        this.repository = repository;
        this.kafkaTemplate = kafkaTemplate;
    }

    @KafkaListener(topics = "notify.sms.request.v1", groupId = "sms-worker")
    public void handleSms(ConsumerRecord<String, String> record) {
        try {
            JsonNode root = objectMapper.readTree(record.value());
            SmsLog log = new SmsLog();
            log.setUserId(root.path("match").path("user_id").asText());
            log.setPhoneNumber(root.path("user_preferences").path("phone").asText("+15555550100"));
            log.setPayload(record.value());
            log.setStatus("mocked");
            repository.save(log);

            kafkaTemplate.send(outcomeTopic, record.key(), record.value());
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to handle sms request", ex);
        }
    }
}

package com.example.notificationrouter.client;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class AlertHistoryClient {

    private static final Logger log = LoggerFactory.getLogger(AlertHistoryClient.class);
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final URI historyUri;

    public AlertHistoryClient(
        RestTemplateBuilder builder,
        ObjectMapper objectMapper,
        @Value("${alerts.history.base-url:http://map-service:8000/api/v1/alerts/history}") String baseUrl
    ) {
        this(builder.setConnectTimeout(java.time.Duration.ofSeconds(3))
                .setReadTimeout(java.time.Duration.ofSeconds(5))
                .build(), objectMapper, baseUrl);
    }

    AlertHistoryClient(RestTemplate restTemplate, ObjectMapper objectMapper, String baseUrl) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.historyUri = URI.create(baseUrl);
    }

    public void recordDispatch(JsonNode payload) {
        if (payload == null) {
            return;
        }
        JsonNode match = payload.path("match");
        if (!match.isObject()) {
            return;
        }
        if (match.hasNonNull("condition_type")) {
            // Custom condition alerts persist history in their originating service.
            return;
        }
        String userId = text(match, "user_id");
        if (userId == null || userId.isBlank()) {
            return;
        }
        Map<String, Boolean> channels = extractChannels(payload.path("user_preferences").path("channels"));
        if (channels.isEmpty()) {
            return;
        }
        String source = text(match, "source");
        if (source == null || source.isBlank()) {
            source = "noaa";
        }
        String title = text(match, "title");
        if (title == null || title.isBlank()) {
            title = text(match, "event");
        }
        if (title == null || title.isBlank()) {
            title = "Weather alert";
        }
        String summary = firstNonEmpty(
            text(match, "summary"),
            text(match, "headline"),
            text(match, "event"),
            text(match, "description")
        );
        String severity = text(match, "severity");
        OffsetDateTime triggeredAt = parseTimestamp(match);
        Map<String, Object> payloadMap = objectMapper.convertValue(match, MAP_TYPE);

        Map<String, Object> request = new HashMap<>();
        request.put("user_id", userId);
        request.put("source", source.toLowerCase());
        request.put("source_id", text(match, "alert_id"));
        request.put("title", title);
        request.put("summary", summary);
        request.put("severity", severity != null ? severity.toLowerCase() : null);
        request.put("channels", channels);
        request.put("triggered_at", triggeredAt);
        request.put("payload", payloadMap);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            restTemplate.postForLocation(historyUri, new HttpEntity<>(request, headers));
        } catch (Exception ex) {
            log.warn("Failed to record alert history", ex);
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        return value.asText();
    }

    private static String firstNonEmpty(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static Map<String, Boolean> extractChannels(JsonNode channelsNode) {
        Map<String, Boolean> channels = new HashMap<>();
        if (channelsNode == null || channelsNode.isMissingNode() || !channelsNode.isObject()) {
            return channels;
        }
        Iterator<String> fieldNames = channelsNode.fieldNames();
        while (fieldNames.hasNext()) {
            String name = fieldNames.next();
            boolean enabled = channelsNode.path(name).asBoolean(false);
            if (enabled) {
                channels.put(name, true);
            }
        }
        return channels;
    }

    private static OffsetDateTime parseTimestamp(JsonNode match) {
        for (String field : new String[]{"sent", "effective", "onset", "created_at"}) {
            String candidate = text(match, field);
            if (candidate == null || candidate.isBlank()) {
                continue;
            }
            try {
                return OffsetDateTime.parse(candidate, DateTimeFormatter.ISO_OFFSET_DATE_TIME);
            } catch (DateTimeParseException ignored) {
                // try next format
                try {
                    return OffsetDateTime.parse(candidate);
                } catch (DateTimeParseException ignoredAgain) {
                    // continue
                }
            }
        }
        return OffsetDateTime.now(ZoneOffset.UTC);
    }
}

package com.example.notificationrouter.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class AlertHistoryClientTest {

    private ObjectMapper objectMapper;

    @BeforeEach
    void setup() {
        objectMapper = new ObjectMapper();
    }

    @Test
    void recordsNoaaAlerts() throws Exception {
        RestTemplate restTemplate = new RestTemplateBuilder().build();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restTemplate).ignoreExpectOrder(true).build();
        AlertHistoryClient client = new AlertHistoryClient(restTemplate, objectMapper, "http://localhost/api/v1/alerts/history");

        String payload = "{" +
            "\"match\":{" +
            "\"user_id\":\"99\"," +
            "\"alert_id\":\"noaa-123\"," +
            "\"title\":\"Flood Advisory\"," +
            "\"severity\":\"warning\"," +
            "\"sent\":\"2024-03-10T12:30:00Z\"}," +
            "\"user_preferences\":{" +
            "\"channels\":{\"email\":true,\"sms\":false}}" +
            "}";

        JsonNode root = objectMapper.readTree(payload);

        server.expect(requestTo("http://localhost/api/v1/alerts/history"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(jsonPath("$.user_id").value("99"))
            .andExpect(jsonPath("$.source").value("noaa"))
            .andExpect(jsonPath("$.channels.email").value(true))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        client.recordDispatch(root);
        server.verify();
    }

    @Test
    void skipsCustomAlerts() throws Exception {
        RestTemplate restTemplate = new RestTemplateBuilder().build();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restTemplate).ignoreExpectOrder(true).build();
        AlertHistoryClient client = new AlertHistoryClient(restTemplate, objectMapper, "http://localhost/api/v1/alerts/history");

        String payload = "{" +
            "\"match\":{" +
            "\"user_id\":\"99\"," +
            "\"condition_type\":\"temperature_hot\"}," +
            "\"user_preferences\":{" +
            "\"channels\":{\"email\":true}}" +
            "}";

        JsonNode root = objectMapper.readTree(payload);

        client.recordDispatch(root);
        server.verify();
    }
}

package com.example.smsworker;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.smsworker.repository.SmsLogRepository;
import java.time.Duration;
import java.util.Map;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.test.EmbeddedKafkaBroker;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
@EmbeddedKafka(partitions = 1, topics = {"notify.sms.request.v1", "test.notify.outcome"})
class SmsListenerIT {

    @Autowired
    private EmbeddedKafkaBroker embeddedKafka;

    @Autowired
    private SmsLogRepository repository;

    @Test
    void messageIsLogged() {
        Map<String, Object> props = Map.of(
            ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, embeddedKafka.getBrokersAsString(),
            ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class,
            ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class
        );
        var producerFactory = new DefaultKafkaProducerFactory<String, String>(props);
        KafkaTemplate<String, String> template = new KafkaTemplate<>(producerFactory);
        template.send("notify.sms.request.v1",
            "{\"match\":{\"user_id\":\"user-1\"},\"user_preferences\":{\"phone\":\"+15550000000\"}}"
        );
        template.flush();

        Awaitility.await().atMost(Duration.ofSeconds(5)).untilAsserted(() ->
            assertThat(repository.count()).isGreaterThan(0)
        );
    }
}

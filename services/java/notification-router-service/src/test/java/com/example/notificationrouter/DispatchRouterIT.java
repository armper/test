package com.example.notificationrouter;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.Map;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.test.EmbeddedKafkaBroker;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.kafka.test.utils.KafkaTestUtils;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
@EmbeddedKafka(partitions = 1, topics = {"notify.dispatch.request.v1", "test.notify.email", "test.notify.push", "test.notify.sms"})
class DispatchRouterIT {

    @Autowired
    private EmbeddedKafkaBroker embeddedKafka;

    @Test
    void routesEmailRequests() {
        Map<String, Object> producerProps = Map.of(
            org.apache.kafka.clients.producer.ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, embeddedKafka.getBrokersAsString(),
            org.apache.kafka.clients.producer.ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, org.apache.kafka.common.serialization.StringSerializer.class,
            org.apache.kafka.clients.producer.ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, org.apache.kafka.common.serialization.StringSerializer.class
        );

        KafkaTemplate<String, String> template = new KafkaTemplate<>(
            new DefaultKafkaProducerFactory<>(producerProps)
        );
        var message = "{\"user_preferences\":{\"channels\":{\"email\":true},\"quiet_hours\":null,\"severity_filter\":null}}";
        template.send("notify.dispatch.request.v1", message);
        template.flush();

        var consumerProps = KafkaTestUtils.consumerProps("router-it", "true", embeddedKafka);
        consumerProps.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        var consumerFactory = new DefaultKafkaConsumerFactory<>(consumerProps, new StringDeserializer(), new StringDeserializer());
        var consumer = consumerFactory.createConsumer();
        embeddedKafka.consumeFromAnEmbeddedTopic(consumer, "test.notify.email");

        ConsumerRecords<String, String> records = KafkaTestUtils.getRecords(consumer, Duration.ofSeconds(5));
        consumer.close();

        assertThat(records.count()).isGreaterThan(0);
        ConsumerRecord<String, String> record = records.iterator().next();
        assertThat(record.value()).contains("\"channels\"");
    }
}

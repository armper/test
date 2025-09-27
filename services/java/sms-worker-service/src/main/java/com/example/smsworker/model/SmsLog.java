package com.example.smsworker.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "sms_dispatch_logs")
@Getter
@Setter
public class SmsLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String userId;
    private String phoneNumber;
    private String payload;
    private String status;
    private OffsetDateTime createdAt = OffsetDateTime.now();
}

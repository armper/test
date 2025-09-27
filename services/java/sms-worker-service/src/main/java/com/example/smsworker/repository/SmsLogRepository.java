package com.example.smsworker.repository;

import com.example.smsworker.model.SmsLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SmsLogRepository extends JpaRepository<SmsLog, Long> {
}

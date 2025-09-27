package com.example.adminservice.controller;

import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class DashboardController {

    private final JdbcTemplate jdbcTemplate;

    public DashboardController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/")
    public String index(Model model) {
        Long users = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM user_accounts", Long.class);
        Long alerts = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM alerts", Long.class);
        Long outcomes = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM sms_dispatch_logs", Long.class);

        model.addAttribute("users", users);
        model.addAttribute("alerts", alerts);
        model.addAttribute("outcomes", outcomes);
        return "dashboard";
    }
}

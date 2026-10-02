package com.overtimeproductions.goonginga.config;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    private final JdbcTemplate jdbc;
    public HealthController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping("/health")
    public Map<String, Object> health() { return Map.of("ok", true,"runtime","spring-boot","java",21); }

    @GetMapping("/health/db")
    public ResponseEntity<Map<String, Object>> database() {
        try {
            jdbc.queryForObject("SELECT 1", Integer.class);
            return ResponseEntity.ok(Map.of("ok", true, "database", "connected"));
        } catch (RuntimeException error) {
            return ResponseEntity.internalServerError().body(Map.of("ok", false, "database", "disconnected"));
        }
    }
}

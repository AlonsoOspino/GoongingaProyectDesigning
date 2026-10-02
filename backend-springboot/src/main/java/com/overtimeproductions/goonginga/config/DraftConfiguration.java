package com.overtimeproductions.goonginga.config;

import java.time.Clock;
import java.util.random.RandomGenerator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
public class DraftConfiguration {
    @Bean Clock clock() { return Clock.systemUTC(); }
    @Bean RandomGenerator random() { return new java.security.SecureRandom(); }
}

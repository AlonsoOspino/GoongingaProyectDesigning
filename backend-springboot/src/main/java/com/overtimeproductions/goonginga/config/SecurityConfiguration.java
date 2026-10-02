package com.overtimeproductions.goonginga.config;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfiguration {
    @Bean
    JwtDecoder jwtDecoder(@Value("${draft.jwt-secret:}") String primary,
            @Value("${draft.legacy-jwt-secret:}") String legacy) {
        var decoders = new ArrayList<NimbusJwtDecoder>();
        for (String secret : new java.util.LinkedHashSet<>(java.util.List.of(primary, legacy))) {
            if (secret.isBlank()) continue;
            byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
            if (bytes.length < 32) throw new IllegalStateException("JWT secrets must contain at least 32 UTF-8 bytes.");
            var decoder = NimbusJwtDecoder.withSecretKey(new SecretKeySpec(bytes, "HmacSHA256"))
                    .macAlgorithm(MacAlgorithm.HS256).build();
            decoder.setJwtValidator(JwtValidators.createDefault());
            decoders.add(decoder);
        }
        if (decoders.isEmpty()) throw new IllegalStateException("Configure NETWORK_JWT_SECRET (the existing Node signing secret).");
        return token -> {
            for (var decoder : decoders) {
                try {
                    Jwt jwt = decoder.decode(token);
                    if (jwt.getExpiresAt() == null) throw new BadJwtException("Missing expiration.");
                    return jwt;
                } catch (JwtException ignored) { }
            }
            throw new BadJwtException("Invalid or expired network token.");
        };
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http) throws Exception {
        return http.csrf(csrf -> csrf.disable()).cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ASYNC).permitAll()
                        .requestMatchers(HttpMethod.GET,"/match/*/*/vs-image","/draftAction","/draftTable/by-match/*").permitAll()
                        .requestMatchers(HttpMethod.GET,"/family-feud/games/*","/family-feud/games/*/events").permitAll()
                        .requestMatchers(HttpMethod.POST,"/family-feud/games/*/development-guests").permitAll()
                        .requestMatchers(HttpMethod.GET, "/health", "/health/db", "/actuator/health", "/uploads/**", "/assets/**", "/team", "/team/*", "/tournament", "/tournament/current", "/match", "/match/*", "/network-auth/discord", "/network-auth/discord/callback", "/network-members/recent", "/network-members/players", "/overlay-assets/leaderboard/*", "/playerStat/public", "/playerStat/public/user/*", "/announcements/active", "/minigames/games", "/minigames/games/*", "/minigames/jeopardy/active", "/minigames/system/family-feud", "/map", "/hero", "/news", "/news/*", "/draftTable", "/draft/*/state", "/draft/by-match/*").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/error").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(resource -> resource.jwt(Customizer.withDefaults())
                        .authenticationEntryPoint((req, response, error) -> {
                            response.setStatus(401);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"message\":\"Invalid or missing network session.\"}");
                        }))
                .build();
    }

    @Bean
    CorsConfigurationSource cors(@Value("${draft.cors-origins}") String origins) {
        var config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isBlank()).toList());
        config.setAllowedMethods(java.util.List.of("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(java.util.List.of("Authorization", "Content-Type", "X-Draft-Key"));
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}

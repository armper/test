package com.example.userservice.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.time.Instant;
import java.util.Date;
import java.util.Arrays;
import java.util.function.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private static final Logger logger = LoggerFactory.getLogger(JwtService.class);

    private final Key signingKey;
    private final long expirySeconds;

    public JwtService(
        @Value("${JWT_SECRET:dev-secret-key-please-change}") String secret,
        @Value("${JWT_EXPIRES_SECONDS:3600}") long expirySeconds
    ) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            keyBytes = Arrays.copyOf(keyBytes, 32);
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        this.expirySeconds = expirySeconds;
    }

    public String generateToken(String subject) {
        Instant now = Instant.now();
        return Jwts.builder()
            .setSubject(subject)
            .setIssuedAt(Date.from(now))
            .setExpiration(Date.from(now.plusSeconds(expirySeconds)))
            .signWith(signingKey, SignatureAlgorithm.HS256)
            .compact();
    }

    public boolean isTokenValid(String token, String expectedSubject) {
        try {
            String subject = extractClaim(token, Claims::getSubject);
            Date expiration = extractClaim(token, Claims::getExpiration);
            return subject != null && subject.equalsIgnoreCase(expectedSubject)
                && expiration != null && expiration.toInstant().isAfter(Instant.now());
        } catch (Exception ex) {
            logger.debug("Invalid JWT token", ex);
            return false;
        }
    }

    public String extractSubject(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    private <T> T extractClaim(String token, Function<Claims, T> extractor) {
        Claims claims = parseClaims(token);
        return claims == null ? null : extractor.apply(claims);
    }

    private Claims parseClaims(String token) {
        try {
            return Jwts.parserBuilder()
                .setSigningKey(signingKey)
                .build()
                .parseClaimsJws(token)
                .getBody();
        } catch (Exception ex) {
            logger.debug("Failed to parse JWT", ex);
            return null;
        }
    }
}

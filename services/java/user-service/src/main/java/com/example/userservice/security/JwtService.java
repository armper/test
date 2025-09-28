package com.example.userservice.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.time.Instant;
import java.util.Date;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final Key signingKey;
    private final long expirySeconds;

    public JwtService(
        @Value("${JWT_SECRET:dev-secret-key-please-change}") String secret,
        @Value("${JWT_EXPIRES_SECONDS:3600}") long expirySeconds
    ) {
        byte[] keyBytes = secret.length() >= 32
            ? secret.getBytes(StandardCharsets.UTF_8)
            : Decoders.BASE64.decode(Decoders.BASE64.encode(secret.getBytes(StandardCharsets.UTF_8)));
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
}

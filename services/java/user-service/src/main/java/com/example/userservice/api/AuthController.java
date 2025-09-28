package com.example.userservice.api;

import com.example.userservice.model.UserAccount;
import com.example.userservice.repository.UserAccountRepository;
import com.example.userservice.security.JwtService;
import com.example.userservice.service.UserService;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final UserService userService;
    private final UserAccountRepository repository;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthController(
        UserService userService,
        UserAccountRepository repository,
        AuthenticationManager authenticationManager,
        JwtService jwtService
    ) {
        this.userService = userService;
        this.repository = repository;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    @PostMapping("/register")
    public ResponseEntity<UserAccount> register(@RequestBody RegisterRequest request) {
        UserAccount account = userService.register(request.email(), request.password(), Set.of("user"));
        return ResponseEntity.status(HttpStatus.CREATED).body(account);
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@RequestBody LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );
        SecurityContextHolder.getContext().setAuthentication(authentication);
        String token = jwtService.generateToken(request.email());
        return ResponseEntity.ok(new TokenResponse(token, "bearer"));
    }

    public record RegisterRequest(@Email String email, @NotBlank String password) {}

    public record LoginRequest(@Email String email, @NotBlank String password) {}

    public record TokenResponse(String access_token, String token_type) {}
}

package com.example.userservice.api;

import com.example.userservice.model.UserAccount;
import com.example.userservice.repository.UserAccountRepository;
import com.example.userservice.service.UserService;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.Set;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final UserService userService;
    private final UserAccountRepository repository;

    public AuthController(UserService userService, UserAccountRepository repository) {
        this.userService = userService;
        this.repository = repository;
    }

    @PostMapping("/register")
    public ResponseEntity<UserAccount> register(@RequestBody RegisterRequest request) {
        UserAccount account = userService.register(request.email(), request.password(), Set.of("user"));
        return ResponseEntity.ok(account);
    }

    public record RegisterRequest(@Email String email, @NotBlank String password) {}
}

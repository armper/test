package com.example.userservice.service;

import com.example.userservice.model.UserAccount;
import com.example.userservice.repository.UserAccountRepository;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserService {
    private final UserAccountRepository repository;
    private final PasswordEncoder encoder;

    public UserService(UserAccountRepository repository, PasswordEncoder encoder) {
        this.repository = repository;
        this.encoder = encoder;
    }

    public UserAccount register(String email, String password, Set<String> roles) {
        repository.findByEmail(email).ifPresent(existing -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        });
        UserAccount account = new UserAccount();
        account.setEmail(email);
        account.setPasswordHash(encoder.encode(password));
        account.setRoles(roles);
        return repository.save(account);
    }
}

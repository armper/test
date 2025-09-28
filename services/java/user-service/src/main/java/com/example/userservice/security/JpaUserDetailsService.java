package com.example.userservice.security;

import com.example.userservice.repository.UserAccountRepository;
import java.util.stream.Collectors;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class JpaUserDetailsService implements UserDetailsService {

    private final UserAccountRepository repository;

    public JpaUserDetailsService(UserAccountRepository repository) {
        this.repository = repository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        var account = repository.findByEmail(username)
            .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        var authorities = account.getRoles().stream()
            .map(role -> "ROLE_" + role.toUpperCase())
            .collect(Collectors.toSet());

        return User.withUsername(account.getEmail())
            .password(account.getPasswordHash())
            .authorities(authorities)
            .build();
    }
}

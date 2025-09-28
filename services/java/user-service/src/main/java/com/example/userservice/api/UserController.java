package com.example.userservice.api;

import com.example.userservice.model.UserAccount;
import com.example.userservice.service.UserService;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.security.Principal;
import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> me(Principal principal) {
        UserAccount account = userService.getByEmail(principal.getName());
        UserProfileResponse response = new UserProfileResponse(
            account.getId(),
            account.getEmail(),
            account.getFullName(),
            account.getRoles(),
            Collections.emptyMap(),
            Collections.emptyMap(),
            account.getCreatedAt()
        );
        return ResponseEntity.ok(response);
    }

    public record UserProfileResponse(
        Long id,
        String email,
        @JsonProperty("full_name") String fullName,
        Set<String> roles,
        @JsonProperty("notification_preferences") Map<String, Boolean> notificationPreferences,
        @JsonProperty("default_location") Map<String, Object> defaultLocation,
        @JsonProperty("created_at") OffsetDateTime createdAt
    ) {}
}

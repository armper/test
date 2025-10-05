package com.example.adminservice.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI adminServiceOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("Admin Service API")
                .description("Provides admin dashboards, summaries, and management endpoints for the Weather Alerts platform.")
                .version("v1")
                .contact(new Contact()
                    .name("Weather Alerts Platform")
                    .email("devops@weatheralerts.example"))
                .license(new License()
                    .name("Apache 2.0")
                    .url("https://www.apache.org/licenses/LICENSE-2.0.html")));
    }
}

package com.example.notificationrouter.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI notificationRouterOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("Notification Router Service API")
                .description("Routes alert matches to downstream email, SMS, and push workers using Kafka topics.")
                .version("v1")
                .contact(new Contact()
                    .name("Weather Alerts Platform")
                    .email("devops@weatheralerts.example"))
                .license(new License()
                    .name("Apache 2.0")
                    .url("https://www.apache.org/licenses/LICENSE-2.0.html")));
    }
}

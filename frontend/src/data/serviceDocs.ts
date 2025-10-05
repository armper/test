export type ServiceStack = 'python' | 'java';

export interface ServiceDocConfig {
  id: string;
  name: string;
  description: string;
  stack: ServiceStack;
  docsPath: string;
  openApiPath: string;
  healthPath?: string;
  tags?: string[];
}

export const SERVICE_DOCS: ServiceDocConfig[] = [
  {
    id: 'custom-alerts-service',
    name: 'Custom Alerts Service',
    description: 'Exposes REST endpoints to create and evaluate user-defined weather condition subscriptions.',
    stack: 'python',
    docsPath: '/custom-alerts/docs',
    openApiPath: '/custom-alerts/openapi.json',
    healthPath: '/custom-alerts/healthz',
    tags: ['FastAPI', 'PostgreSQL', 'Kafka'],
  },
  {
    id: 'map-service',
    name: 'Map Service',
    description: 'Stores coverage regions and provides geo datasets consumed by the web map and alert matching.',
    stack: 'python',
    docsPath: '/map-service/docs',
    openApiPath: '/map-service/openapi.json',
    healthPath: '/map-service/healthz',
    tags: ['FastAPI', 'PostGIS'],
  },
  {
    id: 'alerts-matcher-service',
    name: 'Alerts Matcher Service',
    description: 'Matches normalized NOAA alerts against subscriptions and publishes matches for notification routing.',
    stack: 'python',
    docsPath: '/alerts-matcher/docs',
    openApiPath: '/alerts-matcher/openapi.json',
    healthPath: '/alerts-matcher/healthz',
    tags: ['FastAPI', 'Kafka'],
  },
  {
    id: 'alerts-normalizer-service',
    name: 'Alerts Normalizer Service',
    description: 'Polls NOAA CAP feeds, normalizes payloads, and emits canonical alerts for downstream services.',
    stack: 'python',
    docsPath: '/alerts-normalizer/docs',
    openApiPath: '/alerts-normalizer/openapi.json',
    healthPath: '/alerts-normalizer/healthz',
    tags: ['FastAPI', 'NOAA'],
  },
  {
    id: 'user-service',
    name: 'User Service',
    description: 'Handles authentication, registration, and profile management for platform accounts.',
    stack: 'java',
    docsPath: '/user-service/docs',
    openApiPath: '/user-service/openapi.json',
    healthPath: '/user-service/actuator/health',
    tags: ['Spring Boot', 'PostgreSQL', 'JWT'],
  },
  {
    id: 'notification-router-service',
    name: 'Notification Router Service',
    description: 'Dispatches alert matches to email, SMS, and push channels via Kafka topics.',
    stack: 'java',
    docsPath: '/notification-router/docs',
    openApiPath: '/notification-router/openapi.json',
    healthPath: '/notification-router/actuator/health',
    tags: ['Spring Boot', 'Kafka'],
  },
  {
    id: 'sms-worker-service',
    name: 'SMS Worker Service',
    description: 'Consumes routed notifications and records SMS delivery attempts and outcomes.',
    stack: 'java',
    docsPath: '/sms-worker/docs',
    openApiPath: '/sms-worker/openapi.json',
    healthPath: '/sms-worker/actuator/health',
    tags: ['Spring Boot', 'Kafka'],
  },
  {
    id: 'admin-service',
    name: 'Admin Service',
    description: 'Provides aggregate metrics and admin reporting endpoints that power control-plane dashboards.',
    stack: 'java',
    docsPath: '/admin-service/docs',
    openApiPath: '/admin-service/openapi.json',
    healthPath: '/admin-service/actuator/health',
    tags: ['Spring Boot', 'Metrics'],
  },
];

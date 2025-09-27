FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY pom.xml .
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /workspace/target/sms-worker-service-0.1.0-SNAPSHOT.jar app.jar
ENTRYPOINT ["java","-jar","/app/app.jar"]

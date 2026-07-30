# Backend Agent Guide: Server Module (`:server`)

This file provides rules and context specific to the backend server module.

## 1. Tech Stack & Environment
* **Language & Runtime**: Kotlin 2.2+ (Target JVM 21).
* **Framework**: Spring Boot 4.0+.
* **Database / Persistence**: Spring Data JPA / PostgreSQL mapping layer.
* **Dependency Injection**: Native Spring constructor injection.

## 2. Server Module Responsibilities
* **Controllers / APIs**: Standard Spring `@RestController`. Maps incoming HTTP requests to shared domain use-cases.
* **Database Entities**: JPA `@Entity` classes isolating database table schemas. Maps database tables to/from shared domain models.
* **Exception Handling**: Catch domain exceptions via a global `@RestControllerAdvice` and map them to appropriate HTTP status codes.

## 3. Testing Protocols
* **Slice Tests**: Use JUnit 5 and Spring slice tests (`@WebMvcTest`, `@DataJpaTest`) to test HTTP contracts and database mapping logic.
* **Coverage**: Maintain 90%+ test coverage on routing and service logic.

## 4. Useful Commands
* **Run Server**: `./gradlew :server:bootRun`
* **Test Server**: `./gradlew :server:test`
* **Run Detekt**: `./gradlew :server:detekt`

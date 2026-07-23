# AI Agent Guide: Kotlin Multiplatform & Spring Boot Project

Welcome, AI Agent. This file provides the context, structural rules, and coding standards you must follow when modifying or extending this multiplatform codebase.

## 1. Core Architectural Mandate: Maximize Shared Code
* **Shared First**: Every piece of domain logic, request/response payload, and validation rule MUST be authored in the KMP shared module (`:shared`) under `commonMain` to maximize code reuse across backend and web/client platforms.
* **Separation of Concerns**: Keep Spring Boot infrastructure annotations (e.g., `@RestController`, `@Entity`) isolated inside the server module (`:server`). Do not allow Spring annotations to bleed into the `:shared` module's `commonMain` source set.

## 2. Tech Stack & Multiplatform Ecosystem
* **Language**: Kotlin 2.2+ (Target JVM 21 for Server / K2 Compiler)
* **Framework**: Spring Boot 4.0+ (Server target)
* **Serialization**: `kotlinx.serialization` (Shared universally instead of Jackson)
* **Dependency Injection**: 
  * Server: Spring native constructor injection
  * Shared Module / Clients: Compile-time pure DI or simple service locator patterns
* **Build Tool**: Multi-project Gradle via `build.gradle.kts`

## 3. Strict Module Placement & Sharing Rules
To achieve optimal code reuse, follow this mapping matrix:

| Component Type | Module Placement | Allowed Dependencies & Rules |
| :--- | :--- | :--- |
| **DTOs / Payloads** | `:shared/commonMain` | Mark with `@Serializable`. No Jackson or Spring annotations. |
| **Domain Logic / UseCases**| `:shared/commonMain` | Pure Kotlin. Handles business validations and state rules. |
| **Validation Rules** | `:shared/commonMain` | Use pure Kotlin validation functions. Do not use `javax/jakarta.validation`. |
| **HTTP Clients** | `:shared/commonMain` | Built with `Ktor` client for cross-platform/mobile usage. |
| **Controllers / APIs** | `:server` | Standard Spring `@RestController`. Maps Spring requests to Shared UseCases. |
| **Database Entities** | `:server` | Spring Data JPA / PostgreSQL mapping layer. Maps DB tables into Shared Domain models. |

## 4. Coding Standards for Maximum KMP Compatibility
* **Serialization**: Always use `kotlinx.serialization.json.Json` for request/response serialization. The server is configured to use `KotlinSerializationJsonHttpMessageConverter` so Spring understands it seamlessly.
* **Immutability & Data Classes**: Use immutable Kotlin data classes (`val`) for shared models to prevent side effects across concurrent platforms.
* **Exception Handling**: Throw custom standard Kotlin exceptions in `:shared`. The `:server` module must catch these via a global `@RestControllerAdvice` and map them to HTTP status codes. Do not leak HTTP concepts into common code.
* **Null Safety**: Leverage Kotlin nullability natively. Avoid platform-specific wrappers like Java `Optional`.

## 5. Expect / Actual Patterns
* Use `expect` / `actual` keyword pairs sparingly. 
* Lean heavily on **Dependency Inversion** instead: define a pure Kotlin `interface` in `:shared/commonMain` and provide the concrete platform implementation via constructor injection inside the platform-specific module (e.g., implementing an interface via a Spring component in `:server`).

## 6. Testing Protocols
* **Shared Logic**: Write pure Kotlin tests (`kotlin.test`) inside `:shared/commonTest`. These must run successfully on all target platforms.
* **Server Infrastructure**: Use JUnit 5 and Spring slice tests (`@WebMvcTest`, `@DataJpaTest`) inside `:server` to test HTTP contracts and database mapping logic.

## 7. Common Workflow Commands
* **Run Server App**: `./gradlew :server:bootRun`
* **Test Shared Code**: `./gradlew :shared:allTests`
* **Test Server Layer**: `./gradlew :server:test`

## 8. Code Constraints & Quality Mandates
* **File Size Limit**: Keep files concise and modular. Files should not exceed **500 lines**.
* **Method Size Limit**: Keep functions and methods focused. Methods should not exceed **50 lines**.
* **Code Coverage**: Maintain a minimum **90%+ code coverage** limit on business, domain, and routing logic classes in the server and shared modules.

> [!NOTE]
> The agent will not add exceptions to detekt.yml or file-level @file:Suppress annotations.

> [!NOTE]

> Commit after a successful Gradle build. Try to commit frequently; squashing commits is acceptable.

> [!NOTE]
> Use feature branches for each new task. Create a new branch `feature/<task-name>` from `main`, push it to the upstream
repository, and work on that branch. When the task completes, open a PR and merge back.


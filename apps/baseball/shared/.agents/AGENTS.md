# Shared Domain Agent Guide: Shared Module (`:shared`)

This file provides rules and context specific to the cross-platform KMP shared domain module.

## 1. Shared-First Architecture

* **Pure Kotlin**: Author all business logic, validation rules, request/response models, and use cases in
  `:shared/commonMain`.
* **Zero Infrastructure Dependencies**: Keep Spring annotations (`@RestController`, `@Entity`) and Jackson annotations
  strictly out of `commonMain`.
* **Serialization**: Use `kotlinx.serialization` (`@Serializable`) for cross-platform JSON serialization.
* **HTTP Client**: Use Ktor client for cross-platform network calls.

## 2. Coding Patterns

* **Immutability**: Prefer immutable Kotlin data classes (`val`).
* **Dependency Inversion**: Use pure Kotlin interfaces in `commonMain` and inject concrete implementations, minimizing
  `expect`/`actual` pairs.
* **Validation**: Write pure Kotlin validation functions; do not import `javax.validation` or `jakarta.validation`.
* **Null Safety**: Leverage Kotlin nullability natively. Avoid Java `Optional`.

## 3. Testing Protocols

* Write pure Kotlin tests (`kotlin.test`) in `:shared/commonTest` to ensure cross-platform execution.
* Maintain 90%+ code coverage on shared domain logic.

## 4. Useful Commands

* **Run Shared Tests**: `./gradlew :shared:allTests`
* **Run Detekt**: `./gradlew :shared:detekt`

# Frontend Agent Guide: WebApp Module (`:webApp`)

This file provides rules and context specific to the WASM/JS webApp frontend module.

## 1. Tech Stack & Environment
* **Platform Target**: Kotlin WASM / JS (`wasmJsMain`).
* **UI DSL**: `kotlinx.html` DSL with Vanilla CSS / `kotlinx.css`.
* **State Management**: Reactive UI rendering and DOM manipulation via Kotlin HTML builders.

## 2. Detekt & Code Quality Limits
* **Function Length**: Functions and methods must NOT exceed **30 lines** (`LongMethod`).
* **Function Count Limit**: Classes, objects, and files must NOT contain more than **10 functions** (`TooManyFunctions`).
* **Cyclomatic Complexity**: Functions must not exceed cyclomatic complexity of **14**.
* **Strict Rule**: Do NOT add exceptions to `detekt.yml` or use `@file:Suppress` annotations.

## 3. UI Component Design & Naming
* **Descriptive Render Parameters**: Use explicit, non-abbreviated variable and property names for UI parameter data classes (e.g., `LineupUiContext`, `RowRenderData`, `ScorecardRenderParams`). Never use short names like `ctx` or `pName`.
* **UI Modularization**: Delegate rendering steps into small, focused sub-renderer objects in the same package to keep top-level components and classes small.

## 4. Useful Commands
* **Compile Webapp**: `./gradlew webApp:compileKotlinWasmJs`
* **Run Detekt Checks**: `./gradlew :webApp:detekt`
* **Test WebApp**: `./gradlew :webApp:wasmJsBrowserTest`

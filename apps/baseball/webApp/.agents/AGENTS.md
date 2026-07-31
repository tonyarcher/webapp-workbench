# Frontend Agent Guide: WebApp Module (`:webApp`)

This file provides rules and context specific to the Kotlin WASM/JS webApp frontend module.

## 1. Tech Stack, Environment & Web Components Migration

* **Platform Target**: Kotlin WASM / JS (`wasmJsMain`).
* **UI Architecture**: Transitional state. Moving from pure `kotlinx.html` DSL to rendering unified
  `@baseball/web-components`.
* **Component Usage**: Do not write complex new raw HTML string builders or `kotlinx.css` blocks. Instead, instantiate
  and pass properties directly to the standard Web Component tags (e.g., `<baseball-player-badge>`).
* **State & Data Binding**: Pass reactive application data via element attributes or directly as string/primitive
  properties using standard Kotlin browser DOM APIs.

## 2. Detekt & Code Quality Limits

* **Function Length**: Functions and methods must NOT exceed **30 lines** (`LongMethod`).
* **Function Count Limit**: Classes, objects, and files must NOT contain more than **10 functions**
  (`TooManyFunctions`).
* **Cyclomatic Complexity**: Functions must not exceed cyclomatic complexity of **14**.
* **Strict Rule**: Do NOT add exceptions to `detekt.yml` or use `@file:Suppress` annotations. Break complex legacy
  blocks apart rather than suppressing them.

## 3. UI Component Design & Naming

* **Descriptive Render Parameters**: Use explicit, non-abbreviated variable and property names for UI parameter data
  classes (e.g., `RowRenderData`, `ScorecardRenderParams`). Never use short names like `ctx` or
  `pName`.
* **Component Clean Out**: Break up "muddy" or monolithic legacy layout renderers by swapping giant blocks of deep DOM
  trees out for concise Web Component abstractions.

## 4. Useful Commands

* **Compile Webapp**: `./gradlew :webApp:compileKotlinWasmJs`
* **Run Detekt Checks**: `./gradlew :webApp:detekt`
* **Test WebApp**: `./gradlew :webApp:wasmJsBrowserTest`

# Project Guidelines & Core Rules

Welcome. This file provides the general context, quality mandates, and workflow standards for this repository.

## 1. Architecture & Subfolder Boundaries

* **Monorepo Separation**: This project bridges a Kotlin backend webapp and an independent frontend custom elements
  library (`@baseball/webComponents`).
* **Framework Agnosticism**: Web components must remain strictly isolated from Kotlin backend logic and future
  React/TanStack bindings. Keep web components purely standard-compliant.
* **CSS Boundary Rule**:
    * **Global Directory**: Holds design tokens, brand colors, fonts, and global variables (`:root`).
    * **Component Directory**: Holds component-specific structure, layout, and shadow DOM styling. Component styles must
      read from global variables, never hardcoded values.

## 2. Code Quality Mandates

* **File Size Limit**: Keep files concise and modular. Files must not exceed **500 lines**.
* **Method Size Limit**: Keep functions and methods focused. Methods must not exceed **50 lines**.
* **Class & Package Structure**: Prefer short, single-responsibility classes/components. Split functionality across
  focused directories to avoid monolithic files.
* **Naming Conventions**:
    * Do NOT create classes, components, or objects whose names end with `-Er`, `-Or`, `-Manager`, `-Utils`, or
      `-Helper`.
    * Prefer descriptive, domain-specific names or interfaces with concrete implementations.
    * Use long, self-documenting, non-abbreviated variable and property names (e.g., `pitcherName`, `cellBackground`,
      `lineupUiContext`).

## 3. Testing & Bug Fix Workflow Mandates

* **Test Framework**: Web components are tested using `@web/test-runner` with Playwright Chromium (`npm test` or `./gradlew :webApp:testWebComponents`).
* **Bug Fix Mandate**: Whenever fixing a bug or regression in a web component or controller, you **MUST** write a reproduction unit test in `web-components/test/` before or alongside fixing the code.
* **Coverage Mandate**: Maintain a minimum **90% code coverage** threshold across all web component files (`npm run test:coverage`).
* **Gradle Verification Integration**: All web component unit tests are bound to the Gradle `check` lifecycle (`./gradlew check`).

## 4. Communication & Output Guidelines (ADHD & Speed-Reading Optimized)

* **Speed-Reading Optimized**: Keep all text outputs ultra-concise, direct, and structured with bullet points or bold
  keywords.
* **No Token Waste**: Avoid fluff, long preambles, re-explaining context, or repeating code snippets needlessly. Get
  straight to the actions, status, or exact diffs.

## 5. Workflow & Git Standards

* **Branch Management**: Work on feature branches (`feature/<task-name>`) created from `main`. Push feature branches
  upstream and merge via PR upon task completion.
* **Build & Commit Cadence**: Commit frequently after a successful build. Resolving compiler and build errors
  immediately is mandatory.
* **Bug Fix Workflow**:
    1. Reproduce the issue with a failing unit test in `web-components/test/`.
    2. Implement the fix in the web component or Kotlin controller.
    3. Verify all tests pass (`npm test` and `./gradlew :webApp:testWebComponents`).
    4. Verify code coverage meets or exceeds 90% (`npm run test:coverage`).

## 6. Error Handling & Quality Control

* **Compiler & Linter Errors**: Resolve all compiler, linter, TypeScript type-check (`tsc`), and build errors
  immediately.
* **No Suppressions**: Do not add exceptions to linter configurations or use file-level suppression annotations (e.g.,
  `@file:Suppress`, `/* eslint-disable */`, `// @ts-ignore`).
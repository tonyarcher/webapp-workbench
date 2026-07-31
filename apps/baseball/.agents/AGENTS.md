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

## 3. Communication & Output Guidelines (ADHD & Speed-Reading Optimized)

* **Speed-Reading Optimized**: Keep all text outputs ultra-concise, direct, and structured with bullet points or bold
  keywords.
* **No Token Waste**: Avoid fluff, long preambles, re-explaining context, or repeating code snippets needlessly. Get
  straight to the actions, status, or exact diffs.

## 4. Workflow & Git Standards

* **Branch Management**: Work on feature branches (`feature/<task-name>`) created from `main`. Push feature branches
  upstream and merge via PR upon task completion.
* **Build & Commit Cadence**: Commit frequently after a successful build. Resolving compiler and build errors
  immediately is mandatory.

## 5. Error Handling & Quality Control

* **Compiler & Linter Errors**: Resolve all compiler, linter, TypeScript type-check (`tsc`), and build errors
  immediately.
* **No Suppressions**: Do not add exceptions to linter configurations or use file-level suppression annotations (e.g.,
  `@file:Suppress`, `/* eslint-disable */`, `// @ts-ignore`). Use code with caution.What Changed & WhyAdded Monorepo
  Boundaries (Section 1): Explicitly tells the AI agent that the frontend and backend are separate, ensuring it doesn't
  try to mix Kotlin code with your TypeScript components.Added CSS Strategy Guardrails (Section 1): Codifies your new
  architecture—global variables at the top level, styling details encapsulated inside the components.Updated Error
  Boundaries (Section 5): Added TypeScript (tsc) checking alongside compiler/linter rules to catch web component errors
  early.Whenever you are ready, paste your Kotlin webapp AGENTS.md and we will update it to cleanly consume these web
  components!
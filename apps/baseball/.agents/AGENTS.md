# Project Guidelines & Core Rules

Welcome. This file provides the general context, quality mandates, and workflow standards for this project.

## 1. General Architectural & Code Quality Mandates

* **File Size Limit**: Keep files concise and modular. Files should not exceed **500 lines**.
* **Method Size Limit**: Keep functions and methods focused. Methods should not exceed **50 lines**.
* **Class & Package Structure**: Prefer short, single-responsibility classes and split functionality across focused
  packages to avoid long lists of source files.
* **Naming Conventions**:
  * Do NOT create classes or objects whose names end with `-Er`, `-Or`, `-Manager`, `-Utils`, or `-Helper`.
  * Prefer descriptive, domain-specific names or interfaces with concrete implementations.
  * Use long, self-documenting, non-abbreviated variable and property names (e.g., `pitcherName`, `cellBackground`,
    `lineupUiContext`).

## 2. Communication & Output Guidelines (ADHD & Speed-Reading Optimized)

* **Speed-Reading Optimized**: Keep all text outputs ultra-concise, direct, and structured with bullet points or bold
  keywords.
* **No Token Waste**: Avoid fluff, long preamble, re-explaining context, or repeating code snippets needlessly. Get
  straight to the actions, status, or exact diffs.

## 3. Workflow & Git Standards

* **Branch Management**: Work on feature branches (`feature/<task-name>`) created from `main`. Push feature branches
  upstream and merge via PR upon task completion.
* **Build & Commit Cadence**: Commit frequently after a successful build. Resolving compiler and build errors
  immediately is mandatory.

## 4. Error Handling & Quality Control

* **Compiler & Linter Errors**: Resolve all compiler, linter, and build errors immediately.
* **No Suppressions**: Do not add exceptions to linter configurations or use file-level suppression annotations (e.g.,
  `@file:Suppress`).

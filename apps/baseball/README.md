# ⚾ Baseball Scorekeeper & Simulation Web App

A modern, high-fidelity baseball scorekeeping and game simulation web application built using **Kotlin Multiplatform**. It features an interactive digital scorebook that replicates a traditional paper notebook scorecard, paired with a robust game management and scoring backend.

---

## 🚀 Key Features

* **Interactive Visual Scorecard**: 
  * Replicates a traditional paper scorebook layout with dynamic alternating background gradients, dark outline boundaries, and vertical alignment dividers.
  * Draws base advancement paths (red lines for bases reached), ball/strike counts, and automatic out indications.
  * Includes ended-inning slashes (`/`) and a dedicated Runs-Hits-Errors (R-H-E) summary row.
* **Bench & Bullpen Drawer**: 
  * Slide-out roster drawer to manage substitutions (pinch hitters and relief pitchers).
  * Automatically marks subbed-out players with a greyed-out `(Subbed Out)` label, while subbed-in active players are highlighted in bold.
* **Scorekeeping Controls**: 
  * Plate results controls (Walks, Hits, Strikeouts, Groundouts, Flyouts, Popouts, Lineouts) and a Pitch Type selector.
* **Real-time Stats Integration**: 
  * Live-updating stats (AB, R, H, RBI) dynamically tracked on the scorecard grid.
* **Kotlin Multiplatform Architecture**: 
  * Shares game logic, data models, and constants between the client and server modules.

---

## 📂 Project Structure

The project is structured as a multi-module Gradle project:

```
├── shared/           # Core models, scoring constants, and game simulation engine
├── webApp/           # Frontend client application compiled to WebAssembly (Kotlin/Wasm-JS)
└── server/           # Backend Spring Boot server containing authentication, DB, and game services
```

* **`:shared`**: Shared models (`Game`, `Player`, `PlayEvent`, `BoxScore`) and the `LocalPlayEngine` simulation logic.
* **`:webApp`**: Interactive client UI built with Kotlin Wasm-JS DOM builders.
* **`:server`**: Spring Boot REST backend with JWT security configuration and database repositories.

---

## 🛠️ Build and Setup

### Prerequisites
* **Java Development Kit (JDK)**: JDK 17 or higher.

### Compile the Modules
To build the Kotlin multiplatform code and compile the frontend Wasm executable, run:

```bash
# Build server and shared modules
./gradlew :server:build

# Compile the production WebAssembly binary
./gradlew :webApp:compileProductionExecutableKotlinWasmJs
```

### Running Locally
To launch the Spring Boot backend server:
```bash
./gradlew :server:bootRun
```

---

## 🎨 Visual Aesthetics
The visual scorebook is crafted using curated earth-toned color palettes (`#f4f1e7`, `#faf9f6`, `#5a544a`), providing a premium paper texture feel. Cell overflows are cleanly cropped using `overflow: hidden`, and text alignments remain perfectly centered.

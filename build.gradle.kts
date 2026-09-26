/*
 * Root build for the Kotlin API modules.
 *
 * Each API stays independently buildable (cd apps/<app>/api && gradle build).
 * This file only ties them together under one invocation:
 *
 *   gradle buildAll    JS workspaces + every Kotlin API boot jar (API tests/detekt/Jacoco too)
 *   gradle buildJvm    Kotlin/Spring APIs only (bootJar)
 *   gradle buildNode   JS workspaces only (no APIs)
 *   gradle projects    included modules
 *
 * Limit either half to named apps with -Papps (ids, aliases, or folders).
 * An app name selects that app's own service; folder forms select both halves:
 *
 *   gradle buildNode -Papps=rss            # the reader UI
 *   gradle buildJvm -Papps=apps/rss        # the reader's API half
 *   gradle buildJvm -Papps=rss-api         # the API alone
 *
 * The Gradle wrapper is intentionally absent (repo rule: never commit the
 * wrapper jar). Use `gradle` from PATH; a `gradle wrapper` run here would
 * generate untracked wrapper files.
 *
 * App selection, deploy support, and compose driving live in buildSrc
 * (AppMappings.kt, DeploySupport.kt, ComposeSupport.kt); this file registers
 * the tasks.
 */
import workbench.apiJars
import workbench.appFilter
import workbench.appMappings
import workbench.composeArgsFor
import workbench.composeCommand
import workbench.composeLine
import workbench.deployHas
import workbench.deployHelp
import workbench.deployServices
import workbench.deployValidate
import workbench.filteredServices
import workbench.packageJsonBuild
import workbench.prepareGateway
import workbench.resolveDockerHost
import workbench.runProcess
import workbench.selectedApps

val npmCommand = if (System.getProperty("os.name").lowercase().contains("windows")) {
    "npm.cmd"
} else {
    "npm"
}

// Install before anything else: workspace `prepare` scripts build package
// `dist/` output that the apps compile against.
tasks.register<Exec>("npmInstall") {
    group = "build"
    description = "npm install at the repo root (workspace prepare scripts build package dist/)"
    workingDir = rootDir
    commandLine(npmCommand, "install")
}

// One Exec per JavaScript workspace, named for the workspace rather than the
// app, so a workspace used by two apps is built once. vertical-scroll-core is a
// workspace of both lemmy-vertical-scroll and clipstack, and two `vite build`
// runs writing one dist/ would corrupt it.
//
// Within an app the chain is ordered, because a package's dist/ must exist
// before the app that bundles it. Across apps there is no ordering requirement,
// but Gradle will not exploit that: `org.gradle.parallel` parallelizes across
// *projects*, and every one of these tasks is in this single project, so they
// run one at a time. Running them concurrently needs a task that forks the npm
// processes itself, which measured 4s faster and then ran the machine out of
// memory, so the serial chain stands.
//
// The Kotlin APIs are npm workspaces too, but their `build` is `gradle bootJar`
// (buildJvm owns them), so they are not part of this chain.
val appsToBuild = selectedApps().filter { app ->
    appMappings.getValue(app).workspaces.any { workspace ->
        packageJsonBuild(workspace)?.contains("gradle") != true
    }
}

/** Task names cannot hold `@` or the `/` path separator, so flatten them. */
fun nodeTaskName(workspace: String): String = "buildNode-" + workspace.replace("@", "").replace("/", "-")

val nodeTasks = LinkedHashMap<String, TaskProvider<Exec>>()
val nodeChains = mutableListOf<TaskProvider<Exec>>()
appsToBuild.forEach { app ->
    val mapping = appMappings.getValue(app)
    var previous: TaskProvider<Exec>? = null
    // Index within the JavaScript workspaces only, so the last one is the app
    // itself even when a trailing Gradle-build workspace sits in the list.
    val jsWorkspaces = mapping.workspaces.filter { packageJsonBuild(it)?.contains("gradle") != true }
    jsWorkspaces.forEachIndexed { index, workspace ->
        val isLast = index == jsWorkspaces.lastIndex
        if (isLast && workspace in nodeTasks) {
            // Two apps cannot share the workspace that carries their subpath
            // base: the baked APP_BASE_PATH would differ, so one build cannot
            // serve both. Fail here rather than silently bake the first app's
            // base into the second app's assets.
            error(
                "$workspace is the app workspace of more than one app, so each " +
                    "needs its own APP_BASE_PATH; it cannot be built once for both",
            )
        }
        // Snapshot the chain tail into a val: the configuration closure below
        // captures it, and Kotlin cannot smart-cast a captured `var`.
        val prior = previous
        val task = nodeTasks[workspace] ?: tasks
            .register<Exec>(nodeTaskName(workspace)) {
                group = "build"
                description = "Build $workspace"
                dependsOn("npmInstall")
                if (prior != null) {
                    dependsOn(prior)
                }
                workingDir = rootDir
                // Only the app workspace carries the subpath base; libraries do not.
                if (isLast && mapping.basePath.isNotEmpty()) {
                    environment("APP_BASE_PATH", mapping.basePath)
                } else {
                    // Never inherit a stray value (Vite would bake it in).
                    environment("APP_BASE_PATH", "")
                }
                commandLine(
                    npmCommand,
                    "run",
                    if (isLast) mapping.buildScript else "build",
                    "-w",
                    workspace,
                )
            }
            .also { nodeTasks[workspace] = it }
        previous = task
    }
    previous?.let { nodeChains.add(it) }
}

tasks.register("buildNode") {
    group = "build"
    description = "Build the selected JS workspaces (per-app APP_BASE_PATH)"
    // Every workspace task declares npmInstall, so an empty nodeChains (an
    // API-only selection like -Papps=rss-api) reaches no npm at all rather than
    // running the six package `prepare` builds for artifacts no service ships.
    dependsOn(nodeChains)
}

tasks.register("buildJvm") {
    group = "build"
    description = "Build Kotlin API boot jars"
    val services = filteredServices()
    dependsOn(
        subprojects
            .filter { appFilter.isEmpty() || it.name in services }
            .map { "${it.path}:bootJar" },
    )
}

tasks.register("buildAll") {
    group = "build"
    description = "Build JS workspaces and every Kotlin API boot jar"
    dependsOn("buildJvm", "buildNode")
}

tasks.register("checkAll") {
    group = "verification"
    description = "Run every Kotlin API's tests, detekt, and Jacoco gates"
    dependsOn(subprojects.map { "${it.path}:check" })
}

tasks.register("usage") {
    group = "help"
    description = "Show the root build and deploy usage"
    doLast {
        println(
            """
            Root build for webapp-workbench (Node + Kotlin).

              gradle buildAll    JS workspaces + every Kotlin API boot jar
              gradle buildJvm    Kotlin APIs only
              gradle buildNode   JS workspaces only
              gradle checkAll    API tests, detekt, Jacoco gates
              gradle deploy      build, render gateway, mint certs, compose up

            Limit either half to one app with -Papps (ids, aliases, or folders):
              gradle buildAll -Papps=rss
              gradle buildJvm -Papps=apps/rss

            ${deployHelp()}
            """.trimIndent(),
        )
    }
}

// ---------------------------------------------------------------------------
// Deploy (the port of scripts/deploy.py + gen_certs.py + render_gateway.py).
// Python is not involved: the gateway config renders here and certs are minted
// here, so build.py / deploy.py are thin `./gradlew` calls.
//
//   gradle deploy -Pargs="rss"        rebuild one service
//   gradle deploy -Pargs="remote"     force the tunneled remote engine
//   gradle deploy -Pargs="down"       stop the stack
//   gradle deploy -Pargs="status"     compose ps
//   gradle deploy -Ppassthrough="-q"  pass args through to compose
//
// Tokens (no leading dashes): local remote no-build build-only down status help
// ---------------------------------------------------------------------------

tasks.register("deploy") {
    group = "deployment"
    description = "Build host artifacts, render the gateway, and drive docker compose"
    val skipBuild = deployHas("no-build") || deployHas("down") || deployHas("status")
    if (deployHas("help")) {
        doLast { println(deployHelp()) }
        return@register
    }
    deployValidate()
    if (!skipBuild) {
        // Same app selection as -Papps (gradle deploy -Pargs=rss -Papps=rss).
        dependsOn("buildAll")
    }
    doLast {
        val services = deployServices()
        if (!skipBuild) {
            // Jars for the selected services; a bare deploy checks every API.
            val wanted = services.ifEmpty { apiJars.paths.keys.toList() }
            val missing = apiJars.paths.filterKeys { it in wanted }.values.filter { !file(it).exists() }
            if (missing.isNotEmpty()) {
                error("Missing Kotlin boot jars (run `gradle buildAll` first): ${missing.joinToString(", ")}")
            }
        }
        prepareGateway(services)
        val dockerHost = resolveDockerHost()
        val env = mutableMapOf<String, String>()
        if (dockerHost.isNullOrEmpty()) {
            // Match the old docker_env(""): never inherit a remote context.
            env["DOCKER_HOST"] = ""
            env["DOCKER_CONTEXT"] = ""
        } else {
            env["DOCKER_HOST"] = dockerHost
            env["DOCKER_CONTEXT"] = ""
        }
        // One context upload for every service that shares the repo root.
        env["COMPOSE_BAKE"] = "true"
        env["BUILDKIT_PROGRESS"] = "plain"
        val args = composeArgsFor(services)
        val compose = composeCommand()
        val command = composeLine(compose, args)
        val label = if (dockerHost.isNullOrEmpty()) "local Docker" else "remote Docker ($dockerHost)"
        println("==> Using $label")
        println("==> ${command.joinToString(" ")}")
        val (code, _) = runProcess(command, env = env, inherit = true)
        if (code != 0) error("docker compose failed with code $code")
    }
}

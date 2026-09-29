# Plan

Working notes for changes that are agreed but not yet started. One line each,
with the reason, so a later reader knows whether the line is still wanted.

## Write an `apps.json` consistency checker

**Why.** `apps.json` is the single source of truth for app ids, npm workspaces,
compose services, aliases, boot-jar paths and the compose file. Four sections
have to agree with each other and with reality: `apps`, `dockerOnly`, `apiJars`,
and the workspace globs in the root `package.json`.

Nothing enforces that, and the failure is silent. Three services -- `grafana`,
`alloy` and `victoria-logs` -- were in `docker-compose.yml` but absent from the
catalog, so `deploy.py <name>` rejected them as unknown apps and every tool that
reads the catalog (the Gradle app selection, the build fan-out, the gateway
route docs) was skipping the entire observability stack. A working service that
no tool can address is the worst kind of gap: nothing fails, nothing warns.

The same class of rot is already policed for prose. The doc-rot guard in the
script tests checks backticked paths, `npm run` scripts, Gradle task names and
app counts against whatever derives them. `apps.json` has no equivalent, so the
same rule should be extended to it.

**What the script checks.** A Python tool under `tools/`, because that is what
helpers are here. Assertions, each failing with the location so a bad catalog
never half-builds the tree:

- every `dockerOnly` value is a real service in the compose file
- every compose service is either an `apps[].services` entry or a `dockerOnly`
  value -- the check that would have caught the three above
- every `apps[].workspaces` entry resolves to a real npm workspace, and every
  npm workspace belongs to some app or is deliberately unclaimed
- every `apiJars` path is produced by its module's `build.gradle.kts`
- every alias is unique, and no alias shadows an app id
- every `basePath` has a `location` block in `deploy/nginx/default.conf.template`,
  and every app-prefixed location there has a `basePath`

**Not in scope.** Generating or rewriting `apps.json`. This checks; it does not
edit. A generator would be a second source of truth wearing a script's clothes,
which is the failure it is meant to prevent.

**Status.** Not started.

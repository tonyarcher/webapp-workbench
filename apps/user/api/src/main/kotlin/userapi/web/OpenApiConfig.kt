package userapi.web

import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.oas.models.Operation
import io.swagger.v3.oas.models.info.Info
import io.swagger.v3.oas.models.parameters.Parameter
import org.springdoc.core.customizers.OpenApiCustomizer
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

private val UNVERSIONED_PREFIXES =
    listOf("/healthz", "/readyz", "/oauth", "/v3/api-docs", "/swagger-ui", "/webjars")

private fun isUnversioned(path: String): Boolean {
    if (path == "/") return true
    return UNVERSIONED_PREFIXES.any { path.startsWith(it) }
}

private fun ensureVersionParam(operation: Operation) {
    if (operation.parameters?.any { it.name == "X-Api-Version" } == true) return
    operation.addParametersItem(
        Parameter()
            .`in`("header")
            .name("X-Api-Version")
            .required(true)
            .example("1")
            .description("API version (currently 1)"),
    )
}

private fun addVersionHeader(api: OpenAPI) {
    val paths = api.paths ?: return
    for ((path, item) in paths) {
        if (isUnversioned(path)) continue
        item.readOperations()?.forEach { operation -> ensureVersionParam(operation) }
    }
}

@Configuration
class OpenApiConfig {
    @Bean
    fun userOpenApi(): OpenAPI = OpenAPI()
        .info(
            Info()
                .title("user-api")
                .version("1")
                .description(
                    "Identity provider (OAuth2 Code+PKCE, JWKS, passkeys, TOTP). " +
                        "Account routes (including CSRF) require X-Api-Version: 1. " +
                        "Authed routes use wb_session cookie plus X-CSRF-Token header on POSTs. " +
                        "Probes, OAuth and docs stay unversioned.",
                ),
        )

    @Bean
    fun versionHeaderCustomizer(): OpenApiCustomizer = OpenApiCustomizer { api -> addVersionHeader(api) }
}

package rssapi.web

import io.swagger.v3.oas.models.Components
import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.oas.models.Operation
import io.swagger.v3.oas.models.PathItem
import io.swagger.v3.oas.models.info.Info
import io.swagger.v3.oas.models.parameters.Parameter
import io.swagger.v3.oas.models.security.SecurityRequirement
import io.swagger.v3.oas.models.security.SecurityScheme
import org.springdoc.core.customizers.OpenApiCustomizer
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

private val UNVERSIONED_PREFIXES = listOf("/healthz", "/readyz", "/v3/api-docs", "/swagger-ui", "/webjars")

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
        handlePath(path, item)
    }
}

private fun handlePath(path: String, item: PathItem) {
    val ops = item.readOperations() ?: return
    if (isUnversioned(path)) {
        ops.forEach { it.security = emptyList() }
        return
    }
    ops.forEach { operation -> ensureVersionParam(operation) }
}

@Configuration
class OpenApiConfig {
    @Bean
    fun rssOpenApi(): OpenAPI = OpenAPI()
        .info(
            Info()
                .title("rss-api")
                .version("1")
                .description(
                    "RSS reader JSON API. Data routes require X-Api-Version: 1 " +
                        "and Bearer JWT from user-api. Probes, docs and discovery stay unversioned.",
                ),
        )
        .components(
            Components().addSecuritySchemes(
                "bearer",
                SecurityScheme()
                    .type(SecurityScheme.Type.HTTP)
                    .scheme("bearer")
                    .bearerFormat("JWT")
                    .description("user-api JWT with rss-reader audience"),
            ),
        )
        .addSecurityItem(SecurityRequirement().addList("bearer"))

    @Bean
    fun versionHeaderCustomizer(): OpenApiCustomizer = OpenApiCustomizer { api -> addVersionHeader(api) }
}

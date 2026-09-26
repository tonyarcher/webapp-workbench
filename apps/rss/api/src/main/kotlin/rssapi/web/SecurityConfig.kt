package rssapi.web
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.env.Environment
import org.springframework.http.HttpMethod
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.annotation.web.invoke
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.core.AuthenticationException
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.OAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtIssuerValidator
import org.springframework.security.oauth2.jwt.JwtTimestampValidator
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.web.AuthenticationEntryPoint
import org.springframework.security.web.SecurityFilterChain

/** Unauthenticated request handling for the resource server. */
private const val HTTP_UNAUTHORIZED = 401

/**
 * Whether springdoc publishes the API schema and UI. The truthy set matches
 * Spring's relaxed Boolean binding, so the gate and springdoc cannot disagree
 * about a value like `on`.
 */
internal fun swaggerEnabledFromEnv(env: Environment): Boolean =
    env.getProperty("SWAGGER_ENABLED")?.trim()?.lowercase() in setOf("1", "true", "yes", "on")

@Configuration
@EnableWebSecurity
class SecurityConfig(private val env: Environment) {
    @Bean
    fun filterChain(http: HttpSecurity): SecurityFilterChain {
        http {
            csrf { disable() }
            sessionManagement { sessionCreationPolicy = SessionCreationPolicy.STATELESS }
            authorizeHttpRequests {
                authorize(HttpMethod.GET, "/healthz", permitAll)
                authorize(HttpMethod.GET, "/readyz", permitAll)
                authorize(HttpMethod.GET, "/", permitAll)
                if (swaggerEnabledFromEnv(env)) {
                    swaggerDocPaths().forEach { authorize(HttpMethod.GET, it, permitAll) }
                }
                // Actuator stays internal: the gateway does not route /actuator/**,
                // and only health, info, metrics, and prometheus are exposed.
                authorize(HttpMethod.GET, "/actuator/**", permitAll)
                authorize(anyRequest, authenticated)
            }
            oauth2ResourceServer {
                jwt { }
            }
            exceptionHandling {
                authenticationEntryPoint = unauthorizedEntryPoint()
            }
        }
        return http.build()
    }

    /** Doc paths, permitted only when springdoc is switched on. */
    private fun swaggerDocPaths(): List<String> =
        listOf("/v3/api-docs/**", "/swagger-ui.html", "/swagger-ui/**", "/webjars/**")

    private fun unauthorizedEntryPoint(): AuthenticationEntryPoint =
        AuthenticationEntryPoint { _: HttpServletRequest, response: HttpServletResponse, _: AuthenticationException? ->
            response.status = HTTP_UNAUTHORIZED
            response.contentType = "application/json"
            response.writer.write("""{"error":"unauthorized"}""")
        }

    @Bean
    fun jwtDecoder(): JwtDecoder {
        val jwksUri = env.getRequiredProperty("OAUTH_JWKS_URI")
        val issuer = env.getRequiredProperty("OAUTH_ISSUER")
        val audience = env.getProperty("RSS_CLIENT_ID") ?: "rss-reader"
        val decoder = NimbusJwtDecoder.withJwkSetUri(jwksUri).build()
        decoder.setJwtValidator(
            DelegatingOAuth2TokenValidator(
                JwtTimestampValidator(),
                JwtIssuerValidator(issuer),
                audienceValidator(audience),
            ),
        )
        return decoder
    }

    /** Health contributor: probe the JWKS endpoint so a down user-api is visible. */
    @Bean
    @ConditionalOnProperty("OAUTH_JWKS_URI")
    fun jwksHealthIndicator(): JwksHealthIndicator = JwksHealthIndicator(env.getRequiredProperty("OAUTH_JWKS_URI"))
}

internal fun audienceValidator(audience: String): OAuth2TokenValidator<Jwt> = OAuth2TokenValidator { token: Jwt ->
    val aud = token.audience ?: emptyList()
    if (aud.contains(audience)) {
        OAuth2TokenValidatorResult.success()
    } else {
        OAuth2TokenValidatorResult.failure(OAuth2Error("invalid_token", "bad audience", null))
    }
}

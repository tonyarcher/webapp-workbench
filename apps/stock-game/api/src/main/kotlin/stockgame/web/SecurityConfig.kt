package stockgame.web
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
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
internal fun swaggerEnabledFromEnv(env: Map<String, String>): Boolean =
    env["SWAGGER_ENABLED"]?.trim()?.lowercase() in setOf("1", "true", "yes", "on")

@Configuration
@EnableWebSecurity
class SecurityConfig {
    @Bean
    fun filterChain(http: HttpSecurity): SecurityFilterChain {
        http {
            csrf { disable() }
            sessionManagement { sessionCreationPolicy = SessionCreationPolicy.STATELESS }
            authorizeHttpRequests {
                authorize(HttpMethod.GET, "/healthz", permitAll)
                authorize(HttpMethod.GET, "/readyz", permitAll)
                authorize(HttpMethod.GET, "/", permitAll)
                if (swaggerEnabledFromEnv(System.getenv())) {
                    swaggerDocPaths().forEach { authorize(HttpMethod.GET, it, permitAll) }
                }
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
        val jwksUri = System.getenv("OAUTH_JWKS_URI") ?: "http://localhost:3004/oauth/jwks"
        val issuer = System.getenv("OAUTH_ISSUER") ?: "http://localhost/user-api"
        val audience = System.getenv("STOCK_CLIENT_ID") ?: "stock-game"
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
}

internal fun audienceValidator(audience: String): OAuth2TokenValidator<Jwt> = OAuth2TokenValidator { token: Jwt ->
    val aud = token.audience ?: emptyList()
    if (aud.contains(audience)) {
        OAuth2TokenValidatorResult.success()
    } else {
        OAuth2TokenValidatorResult.failure(OAuth2Error("invalid_token", "bad audience", null))
    }
}

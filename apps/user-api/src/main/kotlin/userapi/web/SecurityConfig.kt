package userapi.web

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.annotation.web.invoke
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.web.AuthenticationEntryPoint
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.access.intercept.AuthorizationFilter
import userapi.accounts.AccountServices

@Configuration
@EnableWebSecurity
class SecurityConfig(
    private val mapper: ObjectMapper,
    private val accounts: AccountServices,
) {
    @Bean
    fun filterChain(http: HttpSecurity): SecurityFilterChain {
        http {
            csrf { disable() }
            sessionManagement { sessionCreationPolicy = SessionCreationPolicy.STATELESS }
            addFilterBefore<AuthorizationFilter>(CsrfFilter(mapper))
            addFilterBefore<AuthorizationFilter>(SessionAuthFilter(accounts))
            authorizeHttpRequests {
                authorize(HttpMethod.GET, "/healthz", permitAll)
                authorize(HttpMethod.GET, "/readyz", permitAll)
                authorize(HttpMethod.GET, "/v1/csrf", permitAll)
                authorize(HttpMethod.POST, "/v1/**", permitAll)
                authorize(HttpMethod.GET, "/oauth/authorize", permitAll)
                authorize(HttpMethod.POST, "/oauth/token", permitAll)
                authorize(HttpMethod.GET, "/oauth/jwks", permitAll)
                authorize(anyRequest, authenticated)
            }
            exceptionHandling {
                authenticationEntryPoint = sessionEntryPoint()
            }
        }
        return http.build()
    }

    private fun sessionEntryPoint(): AuthenticationEntryPoint =
        AuthenticationEntryPoint { _: HttpServletRequest, response: HttpServletResponse, _ ->
            response.status = 401
            response.contentType = MediaType.APPLICATION_JSON_VALUE
            response.writer.write(
                mapper.writeValueAsString(ErrBody(ErrDetail("unauthorized", "not signed in"))),
            )
        }
}

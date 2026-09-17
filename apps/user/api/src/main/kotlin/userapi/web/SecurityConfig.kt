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
import org.springframework.security.config.annotation.web.configurers.AuthorizeHttpRequestsConfigurer
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
        http.csrf { it.disable() }
        http.logout { it.disable() }
        http.sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
        http.addFilterBefore(CsrfFilter(mapper), AuthorizationFilter::class.java)
        http.addFilterBefore(SessionAuthFilter(accounts), AuthorizationFilter::class.java)
        http.authorizeHttpRequests { permitPublic(it) }
        http.exceptionHandling { it.authenticationEntryPoint(sessionEntryPoint()) }
        return http.build()
    }

    private fun permitPublic(
        reg: AuthorizeHttpRequestsConfigurer<HttpSecurity>.AuthorizationManagerRequestMatcherRegistry,
    ) {
        reg.requestMatchers(HttpMethod.GET, "/healthz").permitAll()
        reg.requestMatchers(HttpMethod.GET, "/readyz").permitAll()
        reg.requestMatchers(HttpMethod.GET, "/").permitAll()
        reg.requestMatchers(HttpMethod.GET, "/csrf").permitAll()
        reg.requestMatchers(HttpMethod.GET, "/v3/api-docs/**").permitAll()
        reg.requestMatchers(HttpMethod.GET, "/swagger-ui.html").permitAll()
        reg.requestMatchers(HttpMethod.GET, "/swagger-ui/**").permitAll()
        reg.requestMatchers(HttpMethod.GET, "/webjars/**").permitAll()
        reg.requestMatchers(HttpMethod.POST, "/register").permitAll()
        reg.requestMatchers(HttpMethod.POST, "/login").permitAll()
        reg.requestMatchers(HttpMethod.POST, "/login/totp").permitAll()
        reg.requestMatchers(HttpMethod.POST, "/logout").permitAll()
        reg.requestMatchers(HttpMethod.POST, "/totp/**").permitAll()
        reg.requestMatchers(HttpMethod.POST, "/passkey/**").permitAll()
        reg.requestMatchers(HttpMethod.GET, "/oauth/authorize").permitAll()
        reg.requestMatchers(HttpMethod.POST, "/oauth/token").permitAll()
        reg.requestMatchers(HttpMethod.GET, "/oauth/jwks").permitAll()
        reg.anyRequest().authenticated()
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

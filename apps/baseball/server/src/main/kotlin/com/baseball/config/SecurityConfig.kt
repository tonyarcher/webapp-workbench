package com.baseball.config

import com.baseball.repositories.UserRepository
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.Customizer
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.core.userdetails.User
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.core.userdetails.UsernameNotFoundException
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.web.SecurityFilterChain
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

@Configuration
@EnableWebSecurity
class SecurityConfig(
    private val userRepository: UserRepository,
) {
    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    @Bean
    fun userDetailsService(): UserDetailsService =
        UserDetailsService { email ->
            val user =
                userRepository.findByEmail(email)
                    ?: throw UsernameNotFoundException("User not found: $email")
            User
                .withUsername(user.email)
                .password(user.passwordHash)
                .roles("USER")
                .build()
        }

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        val entryPoint = org.springframework.security.web.AuthenticationEntryPoint { _, response, authException ->
            response.status = jakarta.servlet.http.HttpServletResponse.SC_UNAUTHORIZED
            response.writer.write(authException.message ?: "Unauthorized")
        }

        http
            .csrf { it.disable() }
            .cors { it.configurationSource(corsConfigurationSource()) }
            .exceptionHandling { exceptions ->
                exceptions.authenticationEntryPoint(entryPoint)
            }
            .authorizeHttpRequests { auth ->
                auth
                    .requestMatchers("/api/auth/register")
                    .permitAll()
                    .requestMatchers("/api/auth/login-info")
                    .permitAll()
                    .requestMatchers("/h2-console/**")
                    .permitAll()
                    .anyRequest()
                    .authenticated()
            }.headers { headers ->
                headers.frameOptions { it.disable() } // For H2 console
            }.httpBasic { basic ->
                basic.authenticationEntryPoint(entryPoint)
            }
        return http.build()
    }

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val configuration = CorsConfiguration()
        configuration.allowedOrigins = listOf(
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:9000",
            "http://127.0.0.1:9000",
            "http://localhost:8080"
        )
        configuration.allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "OPTIONS")
        configuration.allowedHeaders = listOf("Authorization", "Content-Type", "X-Requested-With")
        configuration.allowCredentials = true

        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/**", configuration)
        return source
    }
}

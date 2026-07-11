package com.baseball.controllers

import com.baseball.entities.UserEntity
import com.baseball.repositories.UserRepository
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder
) {

    @PostMapping("/register")
    fun register(@RequestBody request: RegisterRequest): ResponseEntity<Any> {
        if (userRepository.findByEmail(request.email) != null) {
            return ResponseEntity.badRequest().body(mapOf("error" to "User already exists"))
        }
        val user = UserEntity()
        user.email = request.email
        user.passwordHash = passwordEncoder.encode(request.password) as String
        user.firstName = request.firstName
        user.lastName = request.lastName
        
        val saved = userRepository.save(user)
        return ResponseEntity.ok(UserResponse(saved.email, saved.firstName, saved.lastName))
    }

    @GetMapping("/me")
    fun getMe(authentication: Authentication): ResponseEntity<UserResponse> {
        val email = authentication.name
        val user = userRepository.findByEmail(email) ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(UserResponse(user.email, user.firstName, user.lastName))
    }
}

data class RegisterRequest(
    val email: String,
    val password: String,
    val firstName: String,
    val lastName: String
)

data class UserResponse(
    val email: String,
    val firstName: String,
    val lastName: String
)

package com.baseball.controllers

import com.baseball.entities.UserEntity
import com.baseball.repositories.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito.*
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.security.crypto.password.PasswordEncoder

class AuthControllerTest {
    private lateinit var userRepository: UserRepository
    private lateinit var passwordEncoder: PasswordEncoder
    private lateinit var authController: AuthController

    @BeforeEach
    fun setUp() {
        userRepository = mock(UserRepository::class.java)
        passwordEncoder = mock(PasswordEncoder::class.java)
        authController = AuthController(userRepository, passwordEncoder)
    }

    @Test
    fun testRegisterUserAlreadyExists() {
        val request = RegisterRequest("test@test.com", "pass", "John", "Doe")
        `when`(userRepository.findByEmail("test@test.com")).thenReturn(UserEntity())

        val response = authController.register(request)

        assertEquals(HttpStatus.BAD_REQUEST, response.statusCode)
        val body = response.body as Map<*, *>
        assertEquals("User already exists", body["error"])
    }

    @Test
    fun testRegisterSuccess() {
        val request = RegisterRequest("new@test.com", "pass", "Jane", "Doe")
        `when`(userRepository.findByEmail("new@test.com")).thenReturn(null)
        `when`(passwordEncoder.encode("pass")).thenReturn("hashedPass")

        val expectedUser =
            UserEntity().apply {
                email = "new@test.com"
                passwordHash = "hashedPass"
                firstName = "Jane"
                lastName = "Doe"
            }
        `when`(userRepository.save(any(UserEntity::class.java))).thenReturn(expectedUser)

        val response = authController.register(request)

        assertEquals(HttpStatus.OK, response.statusCode)
        val body = response.body as UserResponse
        assertEquals("new@test.com", body.email)
        assertEquals("Jane", body.firstName)
        assertEquals("Doe", body.lastName)
    }

    @Test
    fun testGetMeUserNotFound() {
        val auth = mock(Authentication::class.java)
        `when`(auth.name).thenReturn("missing@test.com")
        `when`(userRepository.findByEmail("missing@test.com")).thenReturn(null)

        val response = authController.getMe(auth)

        assertEquals(HttpStatus.NOT_FOUND, response.statusCode)
    }

    @Test
    fun testGetMeSuccess() {
        val auth = mock(Authentication::class.java)
        `when`(auth.name).thenReturn("me@test.com")

        val user =
            UserEntity().apply {
                email = "me@test.com"
                firstName = "Alice"
                lastName = "Smith"
            }
        `when`(userRepository.findByEmail("me@test.com")).thenReturn(user)

        val response = authController.getMe(auth)

        assertEquals(HttpStatus.OK, response.statusCode)
        val body = response.body as UserResponse
        assertEquals("me@test.com", body.email)
        assertEquals("Alice", body.firstName)
        assertEquals("Smith", body.lastName)
    }
}

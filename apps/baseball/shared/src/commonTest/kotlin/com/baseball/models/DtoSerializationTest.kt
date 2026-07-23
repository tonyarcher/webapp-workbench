package com.baseball.models

import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals

class DtoSerializationTest {

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun testRegisterRequestDtoSerialization() {
        val dto = RegisterRequestDto(
            email = "test@example.com",
            password = "password123",
            firstName = "John",
            lastName = "Doe"
        )
        val serialized = json.encodeToString(RegisterRequestDto.serializer(), dto)
        val deserialized = json.decodeFromString(RegisterRequestDto.serializer(), serialized)

        assertEquals(dto.email, deserialized.email)
        assertEquals(dto.password, deserialized.password)
        assertEquals(dto.firstName, deserialized.firstName)
        assertEquals(dto.lastName, deserialized.lastName)
    }

    @Test
    fun testUserResponseDtoSerialization() {
        val dto = UserResponseDto(
            email = "user@example.com",
            firstName = "Jane",
            lastName = "Smith"
        )
        val serialized = json.encodeToString(UserResponseDto.serializer(), dto)
        val deserialized = json.decodeFromString(UserResponseDto.serializer(), serialized)

        assertEquals(dto.email, deserialized.email)
        assertEquals(dto.firstName, deserialized.firstName)
        assertEquals(dto.lastName, deserialized.lastName)
    }
}

package com.baseball.models

import kotlinx.serialization.Serializable

@Serializable
data class UserResponseDto(
    val email: String,
    val firstName: String,
    val lastName: String,
)

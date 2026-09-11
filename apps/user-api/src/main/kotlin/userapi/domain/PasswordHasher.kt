package userapi.domain

interface PasswordHasher {
    fun hash(password: String): String
    fun verify(password: String, passwordHash: String): Boolean
}

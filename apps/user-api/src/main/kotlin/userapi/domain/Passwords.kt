package userapi.domain

const val PASSWORD_MIN: Int = 12
const val PASSWORD_MAX: Int = 128

fun validPassword(password: String, username: String): Boolean {
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) return false
    if (password.isBlank()) return false
    return password != username
}

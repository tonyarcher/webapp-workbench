package userapi.crypto

import com.password4j.Argon2Function
import com.password4j.Password
import com.password4j.types.Argon2
import userapi.domain.PasswordHasher

/** OWASP Argon2id: 19 MiB, 2 iterations, parallelism 1, 32-byte hash. */
private const val MEMORY_KIB = 19_456
private const val ITERATIONS = 2
private const val PARALLELISM = 1
private const val HASH_LENGTH = 32

class Argon2Hasher : PasswordHasher {
    private val fn: Argon2Function =
        Argon2Function.getInstance(MEMORY_KIB, ITERATIONS, PARALLELISM, HASH_LENGTH, Argon2.ID)

    override fun hash(password: String): String {
        return Password.hash(password).addRandomSalt().with(fn).result
    }

    override fun verify(password: String, passwordHash: String): Boolean {
        if (passwordHash.isBlank()) return false
        return try {
            val checker = Argon2Function.getInstanceFromHash(passwordHash)
            Password.check(password, passwordHash).with(checker)
        } catch (_: Exception) {
            false
        }
    }
}

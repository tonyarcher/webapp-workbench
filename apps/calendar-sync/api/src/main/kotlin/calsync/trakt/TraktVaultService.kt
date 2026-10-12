package calsync.trakt

import calsync.persist.TraktCredentialEntity
import calsync.persist.TraktCredentialRepo
import calsync.web.ApiException
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.UUID

/** Vault state for one user. Secrets never leave the service. */
data class CredentialStatus(val configured: Boolean, val authorized: Boolean, val expiresAt: Instant?)

/**
 * Trakt credential storage. Owns the vault rows and nothing else: the HTTP
 * flows live in [TraktService], so this class never touches the network and
 * the network code never touches the repository directly.
 */
@Service
class TraktVaultService(private val vault: TraktCredentialRepo) {
    fun saveCredentials(userId: UUID, clientId: String, clientSecret: String) {
        if (clientId.isBlank() || clientSecret.isBlank()) {
            throw ApiException(HttpStatus.BAD_REQUEST, "client id and secret are required")
        }
        val row = vault.findById(userId).orElse(TraktCredentialEntity(userId = userId))
        row.clientId = clientId.trim()
        row.clientSecret = clientSecret.trim()
        // Tokens belong to the previous app registration: rotating app
        // credentials without dropping them would refresh against the wrong
        // client and fail opaquely on every later call.
        row.accessToken = null
        row.refreshToken = null
        row.expiresAt = null
        vault.save(row)
    }

    fun status(userId: UUID): CredentialStatus {
        val row = vault.findById(userId).orElse(null)
        if (row == null || row.clientId.isBlank() || row.clientSecret.isBlank()) {
            return CredentialStatus(configured = false, authorized = false, expiresAt = null)
        }
        val authorized = !row.accessToken.isNullOrBlank() && !row.refreshToken.isNullOrBlank()
        return CredentialStatus(configured = true, authorized = authorized, expiresAt = row.expiresAt)
    }

    fun clear(userId: UUID) {
        if (vault.existsById(userId)) vault.deleteById(userId)
    }

    fun required(userId: UUID): TraktCredentialEntity {
        val row = vault.findById(userId).orElse(null)
        if (row == null || row.clientId.isBlank() || row.clientSecret.isBlank()) {
            throw ApiException(HttpStatus.BAD_REQUEST, "trakt not configured")
        }
        return row
    }

    fun storeTokens(creds: TraktCredentialEntity, tokens: TraktTokens): Instant {
        creds.accessToken = tokens.accessToken
        creds.refreshToken = tokens.refreshToken
        creds.expiresAt = Instant.now().plusSeconds(tokens.expiresIn)
        vault.save(creds)
        return creds.expiresAt ?: Instant.now()
    }

    /**
     * A rejected refresh means dead tokens: drop them so status reports
     * unauthorized instead of failing the same way forever. Always throws;
     * the caller does not continue after this.
     */
    fun dropTokens(creds: TraktCredentialEntity) {
        creds.accessToken = null
        creds.refreshToken = null
        creds.expiresAt = null
        vault.save(creds)
        throw ApiException(HttpStatus.BAD_REQUEST, "trakt authorization expired")
    }

    fun token(userId: UUID): String = vault.findById(userId).orElse(null)?.accessToken.orEmpty()
}

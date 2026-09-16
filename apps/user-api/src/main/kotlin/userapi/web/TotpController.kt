package userapi.web

import jakarta.servlet.http.HttpServletRequest
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import userapi.accounts.AccountServices
import userapi.domain.hashBackupCode
import userapi.domain.newBackupCodes

@RestController
class TotpController(private val accounts: AccountServices) {
    @PostMapping("/v1/totp/begin")
    fun totpBegin(request: HttpServletRequest): TotpBeginBody {
        val store = requireStore(accounts)
        val totpStore = accounts.totpStore ?: throw ApiException(503, "unavailable", "database offline")
        val session = requestSession(request)
        if (session.totpEnabled) throw ApiException(409, "conflict", "totp already enabled")
        val secret = accounts.totp.newSecret()
        totpStore.setPendingSecret(session.userId, secret)
        return TotpBeginBody(secret = secret, otpauth = accounts.totp.otpauth(session.username, secret))
    }

    @PostMapping("/v1/totp/confirm")
    fun totpConfirm(@RequestBody body: TotpConfirmBody, request: HttpServletRequest): BackupCodesBody {
        requireStore(accounts)
        val totpStore = accounts.totpStore ?: throw ApiException(503, "unavailable", "database offline")
        val session = requestSession(request)
        val pending = totpStore.pendingSecret(session.userId)
        if (pending == null || !accounts.totp.verify(pending, body.code, accounts.clock.instant())) {
            throw ApiException(401, "unauthorized", "invalid authenticator code")
        }
        val codes = newBackupCodes()
        totpStore.enableSecret(session.userId, pending)
        totpStore.replaceBackupHashes(session.userId, codes.map { hashBackupCode(it) })
        return BackupCodesBody(backupCodes = codes)
    }
}

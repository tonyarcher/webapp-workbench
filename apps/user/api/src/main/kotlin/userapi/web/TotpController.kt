package userapi.web

import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import userapi.accounts.AccountServices
import userapi.domain.hashBackupCode
import userapi.domain.newBackupCodes

@RestController
class TotpController(private val accounts: AccountServices) {
    @PostMapping("/totp/begin", headers = ["X-Api-Version=1"])
    fun totpBegin(request: HttpServletRequest): TotpBeginBody {
        val store = requireStore(accounts)
        val totpStore =
            accounts.totpStore ?: throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "unavailable", "database offline")
        val session = requestSession(request)
        if (session.totpEnabled) throw ApiException(HttpStatus.CONFLICT, "conflict", "totp already enabled")
        val secret = accounts.totp.newSecret()
        totpStore.setPendingSecret(session.userId, secret)
        return TotpBeginBody(secret = secret, otpauth = accounts.totp.otpauth(session.username, secret))
    }

    @PostMapping("/totp/confirm", headers = ["X-Api-Version=1"])
    fun totpConfirm(@RequestBody body: TotpConfirmBody, request: HttpServletRequest): BackupCodesBody {
        requireStore(accounts)
        val totpStore =
            accounts.totpStore ?: throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "unavailable", "database offline")
        val session = requestSession(request)
        val pending = totpStore.pendingSecret(session.userId)
        if (pending == null || !accounts.totp.verify(pending, body.code, accounts.clock.instant())) {
            throw ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "invalid authenticator code")
        }
        val codes = newBackupCodes()
        totpStore.enableSecret(session.userId, pending)
        totpStore.replaceBackupHashes(session.userId, codes.map { hashBackupCode(it) })
        return BackupCodesBody(backupCodes = codes)
    }
}

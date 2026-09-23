package userapi.web

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import tools.jackson.databind.json.JsonMapper
import userapi.Settings
import userapi.accounts.AccountServices

@RestController
class PasskeyController(
    private val accounts: AccountServices,
    private val settings: Settings,
    private val mapper: JsonMapper,
) {
    @PostMapping("/passkey/register/begin", headers = ["X-Api-Version=1"])
    fun passkeyRegisterBegin(request: HttpServletRequest): PasskeyBeginBody {
        val store = requireStore(accounts)
        val passkeys =
            accounts.passkeys ?: throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "unavailable", "passkeys offline")
        val session = requestSession(request)
        val (id, json) = passkeys.startRegister(session.userId, session.username)
        return PasskeyBeginBody(requestId = id, options = mapper.readTree(json))
    }

    @PostMapping("/passkey/register/finish", headers = ["X-Api-Version=1"])
    fun passkeyRegisterFinish(@RequestBody body: PasskeyFinishBody, request: HttpServletRequest): OkBody {
        requireStore(accounts)
        val passkeys =
            accounts.passkeys ?: throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "unavailable", "passkeys offline")
        val session = requestSession(request)
        passkeys.finishRegister(body.requestId, mapper.writeValueAsString(body.credential), session.userId)
        return OkBody(ok = true)
    }

    @PostMapping("/passkey/login/begin", headers = ["X-Api-Version=1"])
    fun passkeyLoginBegin(request: HttpServletRequest): PasskeyBeginBody {
        checkRate(accounts, "passkey", request)
        val passkeys =
            accounts.passkeys ?: throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "unavailable", "passkeys offline")
        val (id, json) = passkeys.startLogin()
        return PasskeyBeginBody(requestId = id, options = mapper.readTree(json))
    }

    @PostMapping("/passkey/login/finish", headers = ["X-Api-Version=1"])
    fun passkeyLoginFinish(
        @RequestBody body: PasskeyFinishBody,
        request: HttpServletRequest,
        response: HttpServletResponse,
    ): MeBody {
        checkRate(accounts, "passkey", request)
        val store = requireStore(accounts)
        val passkeys =
            accounts.passkeys ?: throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "unavailable", "passkeys offline")
        val username = passkeys.finishLogin(body.requestId, mapper.writeValueAsString(body.credential))
        val userId = passkeys.store.userIdForUsername(username) ?: rejectAuth()
        issueSession(response, settings, store, accounts, userId)
        return MeBody(id = userId.toString(), username = username, totpEnabled = false)
    }
}

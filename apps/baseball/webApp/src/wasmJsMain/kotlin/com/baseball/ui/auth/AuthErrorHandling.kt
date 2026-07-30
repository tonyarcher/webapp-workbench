package com.baseball.ui.auth

import com.baseball.ui.core.DomUiConstants
import org.w3c.dom.HTMLDivElement

// Network & Authentication Status
internal const val STATUS_CONNECT = "connect"
internal const val STATUS_REFUSED = "refused"
internal const val STATUS_NETWORK = "network"
internal const val STATUS_400 = "400"
internal const val STATUS_BAD_REQUEST = "BadRequest"

internal fun showError(banner: HTMLDivElement, message: String) {
    banner.textContent = message
    banner.style.setProperty(DomUiConstants.Css.DISPLAY, DomUiConstants.CssValues.BLOCK)
}

internal fun parseAuthException(e: Throwable): String {
    val msg = e.message ?: ""
    return if (isConnectionError(msg)) {
        "Unable to connect to the server. Please verify that the backend server is running."
    } else {
        "Authentication failed: ${e.message ?: "server error"}"
    }
}

internal fun parseRegisterException(e: Throwable): String {
    val msg = e.message ?: ""
    return when {
        isConnectionError(msg) -> "Unable to connect to the server. Please verify that the backend server is running."
        msg.contains(STATUS_400) ||
                msg.contains(STATUS_BAD_REQUEST, ignoreCase = true) ->
            "An account with this email already exists."

        else -> "Registration failed: ${e.message ?: "server error"}"
    }
}

private fun isConnectionError(msg: String): Boolean {
    val c = msg.contains(STATUS_CONNECT, ignoreCase = true)
    val r = msg.contains(STATUS_REFUSED, ignoreCase = true)
    val n = msg.contains(STATUS_NETWORK, ignoreCase = true)
    return c || r || n
}

internal fun validateEmail(email: String): Boolean {
    val atIndex = email.indexOf('@')
    val dotIndex = email.lastIndexOf('.')
    return atIndex > 0 && dotIndex > atIndex + 1 && dotIndex < email.length - 1
}

package com.baseball.ui.auth

import com.baseball.BaseballConstants
import com.baseball.UiConstants
import org.w3c.dom.HTMLDivElement

internal fun showError(banner: HTMLDivElement, message: String) {
    banner.textContent = message
    banner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
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
        msg.contains(BaseballConstants.STATUS_400) ||
            msg.contains(BaseballConstants.STATUS_BAD_REQUEST, ignoreCase = true) ->
            "An account with this email already exists."
        else -> "Registration failed: ${e.message ?: "server error"}"
    }
}

private fun isConnectionError(msg: String): Boolean {
    val c = msg.contains(BaseballConstants.STATUS_CONNECT, ignoreCase = true)
    val r = msg.contains(BaseballConstants.STATUS_REFUSED, ignoreCase = true)
    val n = msg.contains(BaseballConstants.STATUS_NETWORK, ignoreCase = true)
    return c || r || n
}

internal fun validateEmail(email: String): Boolean {
    val atIndex = email.indexOf('@')
    val dotIndex = email.lastIndexOf('.')
    return atIndex > 0 && dotIndex > atIndex + 1 && dotIndex < email.length - 1
}

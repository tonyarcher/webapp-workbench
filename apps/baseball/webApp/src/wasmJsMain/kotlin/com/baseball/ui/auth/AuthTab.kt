package com.baseball.ui.auth

import com.baseball.BaseballConstants
import com.baseball.UiConstants
import com.baseball.auth.UserAccount
import com.baseball.authService
import com.baseball.ui.css
import com.baseball.ui.div
import com.baseball.ui.launch
import kotlinx.browser.document
import kotlinx.browser.window
import kotlinx.css.*
import kotlinx.html.*
import kotlinx.html.js.onClickFunction
import org.w3c.dom.HTMLDivElement
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLInputElement

internal fun renderLoginTab(container: HTMLElement) {
    container.div(classes = "card") {
        css {
            maxWidth = 450.px
            margin = Margin(2.rem, LinearDimension.auto)
            padding = Padding(2.5.rem)
        }

        h2 {
            +"Log In to Grand Slam"
            css {
                textAlign = TextAlign.center
                marginBottom = 1.5.rem
            }
        }

        div {
            id = "login-error-banner"
            css {
                display = Display.none
                color = Color("var(--accent-red)")
                background = "rgba(255, 42, 59, 0.1)"
                border = Border(1.px, BorderStyle.solid, Color("var(--accent-red)"))
                padding = Padding(0.75.rem)
                borderRadius = 8.px
                marginBottom = 1.rem
                fontSize = 0.9.rem
            }
        }

        form {
            div(classes = "form-group") {
                label { +"Email Address (Username)" }
                input(type = InputType.email, classes = "form-control") {
                    id = "login-email"
                    placeholder = "you@example.com"
                }
            }

            div(classes = "form-group") {
                label { +"Password" }
                input(type = InputType.password, classes = "form-control") {
                    id = "login-password"
                    placeholder = "Enter your password"
                }
            }

            button(classes = "btn") {
                type = ButtonType.button
                +"Log In"
                css {
                    width = 100.pct
                    marginTop = 1.rem
                }
                onClickFunction = { handleLoginClick() }
            }
        }

        p {
            css {
                marginTop = 1.5.rem
                textAlign = TextAlign.center
                fontSize = 0.9.rem
                color = Color("var(--text-secondary)")
            }
            span { +"Don't have an account? " }
            a {
                +"Create Account"
                css {
                    color = Color("var(--accent-red)")
                    cursor = Cursor.pointer
                    fontWeight = FontWeight.bold
                    put("text-decoration", "underline")
                }
                onClickFunction = { window.location.hash = "register" }
            }
        }
    }
}

private fun handleLoginClick() {
    val banner = document.getElementById("login-error-banner") as? HTMLDivElement ?: return
    val emailIn = document.getElementById("login-email") as? HTMLInputElement ?: return
    val passIn = document.getElementById("login-password") as? HTMLInputElement ?: return

    banner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.NONE)
    val email = emailIn.value.trim()
    val password = passIn.value

    if (!validateEmail(email)) {
        showError(banner, "Please enter a valid email address.")
        return
    }
    if (password.length < 6) {
        showError(banner, "Password must be at least 6 characters.")
        return
    }

    launch { executeLogin(email, password, banner) }
}

private suspend fun executeLogin(email: String, pass: String, banner: HTMLDivElement) {
    try {
        val session = authService.login(email, pass)
        if (session != null) {
            window.location.hash = BaseballConstants.TAB_WELCOME
        } else {
            showError(banner, "Invalid email or password.")
        }
    } catch (e: Throwable) {
        showError(banner, parseAuthException(e))
    }
}

internal fun renderRegisterTab(container: HTMLElement) {
    container.div(classes = "card") {
        css {
            maxWidth = 450.px
            margin = Margin(2.rem, LinearDimension.auto)
            padding = Padding(2.5.rem)
        }

        h2 {
            +"Create Account"
            css {
                textAlign = TextAlign.center
                marginBottom = 1.5.rem
            }
        }

        div {
            id = "register-error-banner"
            css {
                display = Display.none
                color = Color("var(--accent-red)")
                background = "rgba(255, 42, 59, 0.1)"
                border = Border(1.px, BorderStyle.solid, Color("var(--accent-red)"))
                padding = Padding(0.75.rem)
                borderRadius = 8.px
                marginBottom = 1.rem
                fontSize = 0.9.rem
            }
        }

        form {
            div(classes = "form-group") {
                label { +"First Name" }
                input(type = InputType.text, classes = "form-control") {
                    id = "register-first-name"
                    placeholder = "John"
                }
            }

            div(classes = "form-group") {
                label { +"Last Name" }
                input(type = InputType.text, classes = "form-control") {
                    id = "register-last-name"
                    placeholder = "Doe"
                }
            }

            div(classes = "form-group") {
                label { +"Email Address (Username)" }
                input(type = InputType.email, classes = "form-control") {
                    id = "register-email"
                    placeholder = "you@example.com"
                }
            }

            div(classes = "form-group") {
                label { +"Password" }
                input(type = InputType.password, classes = "form-control") {
                    id = "register-password"
                    placeholder = "At least 6 characters"
                }
            }

            button(classes = "btn") {
                type = ButtonType.button
                +"Register & Log In"
                css {
                    width = 100.pct
                    marginTop = 1.rem
                }
                onClickFunction = { handleRegisterClick() }
            }
        }

        p {
            css {
                marginTop = 1.5.rem
                textAlign = TextAlign.center
                fontSize = 0.9.rem
                color = Color("var(--text-secondary)")
            }
            span { +"Already have an account? " }
            a {
                +"Log In"
                css {
                    color = Color("var(--accent-red)")
                    cursor = Cursor.pointer
                    fontWeight = FontWeight.bold
                    put("text-decoration", "underline")
                }
                onClickFunction = { window.location.hash = "login" }
            }
        }
    }
}

private fun handleRegisterClick() {
    val banner = document.getElementById("register-error-banner") as? HTMLDivElement ?: return
    val firstIn = document.getElementById("register-first-name") as? HTMLInputElement ?: return
    val lastIn = document.getElementById("register-last-name") as? HTMLInputElement ?: return
    val emailIn = document.getElementById("register-email") as? HTMLInputElement ?: return
    val passIn = document.getElementById("register-password") as? HTMLInputElement ?: return

    banner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.NONE)
    val first = firstIn.value.trim()
    val last = lastIn.value.trim()
    val email = emailIn.value.trim()
    val pass = passIn.value

    if (first.isEmpty() || last.isEmpty()) {
        showError(banner, "Please enter both your first and last name.")
        return
    }
    if (!validateEmail(email)) {
        showError(banner, "Please enter a valid email address.")
        return
    }
    if (pass.length < 6) {
        showError(banner, "Password must be at least 6 characters.")
        return
    }

    launch { executeRegister(first, last, email, pass, banner) }
}

private suspend fun executeRegister(first: String, last: String, email: String, pass: String, banner: HTMLDivElement) {
    try {
        authService.registerUser(UserAccount(email, first, last, pass))
        val session = authService.login(email, pass)
        if (session != null) {
            window.location.hash = BaseballConstants.TAB_WELCOME
        } else {
            showError(banner, "Registration succeeded, but login failed.")
        }
    } catch (e: Throwable) {
        showError(banner, parseRegisterException(e))
    }
}

private fun showError(banner: HTMLDivElement, message: String) {
    banner.textContent = message
    banner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
}

private fun parseAuthException(e: Throwable): String {
    val msg = e.message ?: ""
    return if (isConnectionError(msg)) {
        "Unable to connect to the server. Please verify that the backend server is running."
    } else {
        "Authentication failed: ${e.message ?: "server error"}"
    }
}

private fun parseRegisterException(e: Throwable): String {
    val msg = e.message ?: ""
    return when {
        isConnectionError(msg) -> "Unable to connect to the server. Please verify that the backend server is running."
        msg.contains(BaseballConstants.STATUS_400) || msg.contains(BaseballConstants.STATUS_BAD_REQUEST, ignoreCase = true) ->
            "An account with this email already exists."
        else -> "Registration failed: ${e.message ?: "server error"}"
    }
}

private fun isConnectionError(msg: String): Boolean =
    msg.contains(BaseballConstants.STATUS_CONNECT, ignoreCase = true) ||
        msg.contains(BaseballConstants.STATUS_REFUSED, ignoreCase = true) ||
        msg.contains(BaseballConstants.STATUS_NETWORK, ignoreCase = true)

private fun validateEmail(email: String): Boolean {
    val atIndex = email.indexOf('@')
    val dotIndex = email.lastIndexOf('.')
    return atIndex > 0 && dotIndex > atIndex + 1 && dotIndex < email.length - 1
}

package com.baseball.ui.auth

import com.baseball.auth.UserAccount
import com.baseball.authService
import com.baseball.ui.core.DomUiConstants
import com.baseball.ui.core.css
import com.baseball.ui.core.launch
import com.baseball.ui.state.NavTabs
import kotlinx.browser.document
import kotlinx.browser.window
import kotlinx.css.LinearDimension
import kotlinx.css.Margin
import kotlinx.css.Padding
import kotlinx.css.margin
import kotlinx.css.maxWidth
import kotlinx.css.padding
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.html.div
import kotlinx.html.dom.append
import org.w3c.dom.HTMLDivElement
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLInputElement

internal fun renderLoginTab(container: HTMLElement) {
    container.append {
        div(classes = "card") {
            css {
                maxWidth = 450.px
                margin = Margin(2.rem, LinearDimension.auto)
                padding = Padding(2.5.rem)
            }
            renderLoginHeader()
            renderLoginErrorBanner()
            renderLoginForm()
            renderLoginFooter()
        }
    }
}

internal fun handleLoginClick() {
    val banner = document.getElementById("login-error-banner") as? HTMLDivElement
    val emailIn = document.getElementById("login-email") as? HTMLInputElement
    val passIn = document.getElementById("login-password") as? HTMLInputElement
    if (listOf(banner, emailIn, passIn).any { it == null }) return

    banner!!.style.setProperty(DomUiConstants.Css.DISPLAY, DomUiConstants.CssValues.NONE)
    val email = emailIn!!.value.trim()
    val password = passIn!!.value

    val errorMsg = when {
        !validateEmail(email) -> "Please enter a valid email address."
        password.length < 6 -> "Password must be at least 6 characters."
        else -> null
    }
    if (errorMsg != null) {
        showError(banner, errorMsg)
        return
    }

    launch { executeLogin(email, password, banner) }
}

private suspend fun executeLogin(email: String, pass: String, banner: HTMLDivElement) {
    try {
        val session = authService.login(email, pass)
        if (session != null) {
            window.location.hash = NavTabs.TAB_WELCOME
        } else {
            showError(banner, "Invalid email or password.")
        }
    } catch (expected: Throwable) {
        showError(banner, parseAuthException(expected))
    }
}

internal fun renderRegisterTab(container: HTMLElement) {
    container.append {
        div(classes = "card") {
            css {
                maxWidth = 450.px
                margin = Margin(2.rem, LinearDimension.auto)
                padding = Padding(2.5.rem)
            }
            renderRegisterHeader()
            renderRegisterErrorBanner()
            renderRegisterForm()
            renderRegisterFooter()
        }
    }
}

internal fun handleRegisterClick() {
    val banner = document.getElementById("register-error-banner") as? HTMLDivElement
    val firstIn = document.getElementById("register-first-name") as? HTMLInputElement
    val lastIn = document.getElementById("register-last-name") as? HTMLInputElement
    val emailIn = document.getElementById("register-email") as? HTMLInputElement
    val passIn = document.getElementById("register-password") as? HTMLInputElement
    if (listOf(banner, firstIn, lastIn, emailIn, passIn).any { it == null }) return

    banner!!.style.setProperty(DomUiConstants.Css.DISPLAY, DomUiConstants.CssValues.NONE)
    val first = firstIn!!.value.trim()
    val last = lastIn!!.value.trim()
    val email = emailIn!!.value.trim()
    val pass = passIn!!.value

    val errorMsg = when {
        first.isEmpty() || last.isEmpty() -> "Please enter both your first and last name."
        !validateEmail(email) -> "Please enter a valid email address."
        pass.length < 6 -> "Password must be at least 6 characters."
        else -> null
    }
    if (errorMsg != null) {
        showError(banner, errorMsg)
        return
    }

    launch { executeRegister(first, last, email, pass, banner) }
}

private suspend fun executeRegister(first: String, last: String, email: String, pass: String, banner: HTMLDivElement) {
    try {
        authService.registerUser(UserAccount(email, first, last, pass))
        val session = authService.login(email, pass)
        if (session != null) {
            window.location.hash = NavTabs.TAB_WELCOME
        } else {
            showError(banner, "Registration succeeded, but login failed.")
        }
    } catch (expected: Throwable) {
        showError(banner, parseRegisterException(expected))
    }
}

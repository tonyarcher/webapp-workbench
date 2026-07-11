package com.baseball.ui

import com.baseball.UiConstants

import org.w3c.dom.*
import kotlinx.browser.window
import com.baseball.authService
import com.baseball.auth.UserAccount
import com.baseball.Constants

internal fun renderLoginTab(container: HTMLElement) {
    val card = container.appendElement(UiConstants.Html.DIV, "card") {
        style.setProperty(UiConstants.Css.MAX_WIDTH, "450px")
        style.setProperty(UiConstants.Css.MARGIN, "2rem auto")
        style.setProperty(UiConstants.Css.PADDING, "2.5rem")
    }

    card.appendElement(UiConstants.Html.H2) {
        textContent = "Log In to Grand Slam"
        style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER)
        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1.5rem")
    }

    val errorBanner = card.appendElement(UiConstants.Html.DIV) {
        style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.NONE)
        style.setProperty(UiConstants.Css.COLOR, "var(--accent-red)")
        style.setProperty(UiConstants.Css.BACKGROUND, "rgba(255, 42, 59, 0.1)")
        style.setProperty(UiConstants.Css.BORDER, "1px solid var(--accent-red)")
        style.setProperty(UiConstants.Css.PADDING, "0.75rem")
        style.setProperty(UiConstants.Css.BORDER_RADIUS, "8px")
        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
        style.setProperty(UiConstants.Css.FONT_SIZE, "0.9rem")
    }

    val form = card.appendElement(UiConstants.Html.FORM)

    val fgEmail = form.appendElement(UiConstants.Html.DIV, "form-group")
    fgEmail.appendElement(UiConstants.Html.LABEL) { textContent = "Email Address (Username)" }
    val emailInput = fgEmail.appendElement(UiConstants.Html.INPUT, "form-control") as HTMLInputElement
    emailInput.type = "email"
    emailInput.placeholder = "you@example.com"

    val fgPassword = form.appendElement(UiConstants.Html.DIV, "form-group")
    fgPassword.appendElement(UiConstants.Html.LABEL) { textContent = "Password" }
    val passwordInput = fgPassword.appendElement(UiConstants.Html.INPUT, "form-control") as HTMLInputElement
    passwordInput.type = "password"
    passwordInput.placeholder = "Enter your password"

    val btn = form.appendElement(UiConstants.Html.BUTTON, "btn") as HTMLButtonElement
    btn.type = "button"
    btn.textContent = "Log In"
    btn.style.setProperty(UiConstants.Css.WIDTH, "100%")
    btn.style.setProperty(UiConstants.Css.MARGIN_TOP, "1rem")

    btn.onClick {
        errorBanner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.NONE)
        val email = emailInput.value.trim()
        val password = passwordInput.value

        if (!validateEmail(email)) {
            errorBanner.textContent = "Please enter a valid email address."
            errorBanner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
            return@onClick
        }

        if (password.length < 6) {
            errorBanner.textContent = "Password must be at least 6 characters."
            errorBanner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
            return@onClick
        }

        launch {
            try {
                val session = authService.login(email, password)
                if (session != null) {
                    window.location.hash = Constants.TAB_WELCOME
                } else {
                    errorBanner.textContent = "Invalid email or password."
                    errorBanner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
                }
            } catch (e: Throwable) {
                val msg = e.message ?: ""
                if (msg.contains(Constants.STATUS_CONNECT, ignoreCase = true) || msg.contains(Constants.STATUS_REFUSED, ignoreCase = true) || msg.contains(Constants.STATUS_NETWORK, ignoreCase = true)) {
                    errorBanner.textContent = "Unable to connect to the server. Please verify that your Spring Boot backend is running."
                } else {
                    errorBanner.textContent = "Authentication failed: ${e.message ?: "server error"}"
                }
                errorBanner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
            }
        }
    }

    val toggleLink = card.appendElement(UiConstants.Html.P) {
        style.setProperty(UiConstants.Css.MARGIN_TOP, "1.5rem")
        style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER)
        style.setProperty(UiConstants.Css.FONT_SIZE, "0.9rem")
        style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
    }
    toggleLink.appendElement(UiConstants.Html.SPAN) { textContent = "Don't have an account? " }
    toggleLink.appendElement(UiConstants.Html.A) {
        textContent = "Create Account"
        style.setProperty(UiConstants.Css.COLOR, "var(--accent-red)")
        style.setProperty(UiConstants.Css.CURSOR, UiConstants.CssValues.POINTER)
        style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
        style.setProperty(UiConstants.Css.TEXT_DECORATION, UiConstants.CssValues.UNDERLINE)
        onClick {
            window.location.hash = "register"
        }
    }
}

internal fun renderRegisterTab(container: HTMLElement) {
    val card = container.appendElement(UiConstants.Html.DIV, "card") {
        style.setProperty(UiConstants.Css.MAX_WIDTH, "450px")
        style.setProperty(UiConstants.Css.MARGIN, "2rem auto")
        style.setProperty(UiConstants.Css.PADDING, "2.5rem")
    }

    card.appendElement(UiConstants.Html.H2) {
        textContent = "Create Account"
        style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER)
        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1.5rem")
    }

    val errorBanner = card.appendElement(UiConstants.Html.DIV) {
        style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.NONE)
        style.setProperty(UiConstants.Css.COLOR, "var(--accent-red)")
        style.setProperty(UiConstants.Css.BACKGROUND, "rgba(255, 42, 59, 0.1)")
        style.setProperty(UiConstants.Css.BORDER, "1px solid var(--accent-red)")
        style.setProperty(UiConstants.Css.PADDING, "0.75rem")
        style.setProperty(UiConstants.Css.BORDER_RADIUS, "8px")
        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
        style.setProperty(UiConstants.Css.FONT_SIZE, "0.9rem")
    }

    val form = card.appendElement(UiConstants.Html.FORM)

    val fgFirstName = form.appendElement(UiConstants.Html.DIV, "form-group")
    fgFirstName.appendElement(UiConstants.Html.LABEL) { textContent = "First Name" }
    val firstNameInput = fgFirstName.appendElement(UiConstants.Html.INPUT, "form-control") as HTMLInputElement
    firstNameInput.placeholder = "John"

    val fgLastName = form.appendElement(UiConstants.Html.DIV, "form-group")
    fgLastName.appendElement(UiConstants.Html.LABEL) { textContent = "Last Name" }
    val lastNameInput = fgLastName.appendElement(UiConstants.Html.INPUT, "form-control") as HTMLInputElement
    lastNameInput.placeholder = "Doe"

    val fgEmail = form.appendElement(UiConstants.Html.DIV, "form-group")
    fgEmail.appendElement(UiConstants.Html.LABEL) { textContent = "Email Address (Username)" }
    val emailInput = fgEmail.appendElement(UiConstants.Html.INPUT, "form-control") as HTMLInputElement
    emailInput.type = "email"
    emailInput.placeholder = "you@example.com"

    val fgPassword = form.appendElement(UiConstants.Html.DIV, "form-group")
    fgPassword.appendElement(UiConstants.Html.LABEL) { textContent = "Password" }
    val passwordInput = fgPassword.appendElement(UiConstants.Html.INPUT, "form-control") as HTMLInputElement
    passwordInput.type = "password"
    passwordInput.placeholder = "At least 6 characters"

    val btn = form.appendElement(UiConstants.Html.BUTTON, "btn") as HTMLButtonElement
    btn.type = "button"
    btn.textContent = "Register & Log In"
    btn.style.setProperty(UiConstants.Css.WIDTH, "100%")
    btn.style.setProperty(UiConstants.Css.MARGIN_TOP, "1rem")

    btn.onClick {
        errorBanner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.NONE)
        val firstName = firstNameInput.value.trim()
        val lastName = lastNameInput.value.trim()
        val email = emailInput.value.trim()
        val password = passwordInput.value

        if (firstName.isEmpty() || lastName.isEmpty()) {
            errorBanner.textContent = "Please enter both your first and last name."
            errorBanner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
            return@onClick
        }

        if (!validateEmail(email)) {
            errorBanner.textContent = "Please enter a valid email address."
            errorBanner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
            return@onClick
        }

        if (password.length < 6) {
            errorBanner.textContent = "Password must be at least 6 characters."
            errorBanner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
            return@onClick
        }

        launch {
            try {
                authService.registerUser(
                    UserAccount(email, firstName, lastName, password)
                )
                val session = authService.login(email, password)
                if (session != null) {
                    window.location.hash = Constants.TAB_WELCOME
                } else {
                    errorBanner.textContent = "Registration succeeded, but login failed."
                    errorBanner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
                }
            } catch (e: Throwable) {
                val msg = e.message ?: ""
                if (msg.contains(Constants.STATUS_CONNECT, ignoreCase = true) || msg.contains(Constants.STATUS_REFUSED, ignoreCase = true) || msg.contains(Constants.STATUS_NETWORK, ignoreCase = true)) {
                    errorBanner.textContent = "Unable to connect to the server. Please verify that your Spring Boot backend is running."
                } else if (msg.contains(Constants.STATUS_400) || msg.contains(Constants.STATUS_BAD_REQUEST, ignoreCase = true)) {
                    errorBanner.textContent = "An account with this email already exists."
                } else {
                    errorBanner.textContent = "Registration failed: ${e.message ?: "server error"}"
                }
                errorBanner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
            }
        }
    }

    val toggleLink = card.appendElement(UiConstants.Html.P) {
        style.setProperty(UiConstants.Css.MARGIN_TOP, "1.5rem")
        style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER)
        style.setProperty(UiConstants.Css.FONT_SIZE, "0.9rem")
        style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
    }
    toggleLink.appendElement(UiConstants.Html.SPAN) { textContent = "Already have an account? " }
    toggleLink.appendElement(UiConstants.Html.A) {
        textContent = "Log In"
        style.setProperty(UiConstants.Css.COLOR, "var(--accent-red)")
        style.setProperty(UiConstants.Css.CURSOR, UiConstants.CssValues.POINTER)
        style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
        style.setProperty(UiConstants.Css.TEXT_DECORATION, UiConstants.CssValues.UNDERLINE)
        onClick {
            window.location.hash = "login"
        }
    }
}

private fun validateEmail(email: String): Boolean {
    val atIndex = email.indexOf('@')
    val dotIndex = email.lastIndexOf('.')
    return atIndex > 0 && dotIndex > atIndex + 1 && dotIndex < email.length - 1
}

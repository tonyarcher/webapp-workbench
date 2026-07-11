package com.baseball.ui

import org.w3c.dom.*
import kotlinx.browser.window
import com.baseball.authService
import com.baseball.auth.UserAccount
import com.baseball.Constants

internal fun renderLoginTab(container: HTMLElement) {
    val card = container.appendElement(Constants.Html.DIV, "card") {
        style.setProperty(Constants.Css.MAX_WIDTH, "450px")
        style.setProperty(Constants.Css.MARGIN, "2rem auto")
        style.setProperty(Constants.Css.PADDING, "2.5rem")
    }

    card.appendElement(Constants.Html.H2) {
        textContent = "Log In to Grand Slam"
        style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER)
        style.setProperty(Constants.Css.MARGIN_BOTTOM, "1.5rem")
    }

    val errorBanner = card.appendElement(Constants.Html.DIV) {
        style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.NONE)
        style.setProperty(Constants.Css.COLOR, "var(--accent-red)")
        style.setProperty(Constants.Css.BACKGROUND, "rgba(255, 42, 59, 0.1)")
        style.setProperty(Constants.Css.BORDER, "1px solid var(--accent-red)")
        style.setProperty(Constants.Css.PADDING, "0.75rem")
        style.setProperty(Constants.Css.BORDER_RADIUS, "8px")
        style.setProperty(Constants.Css.MARGIN_BOTTOM, "1rem")
        style.setProperty(Constants.Css.FONT_SIZE, "0.9rem")
    }

    val form = card.appendElement(Constants.Html.FORM)

    val fgEmail = form.appendElement(Constants.Html.DIV, "form-group")
    fgEmail.appendElement(Constants.Html.LABEL) { textContent = "Email Address (Username)" }
    val emailInput = fgEmail.appendElement(Constants.Html.INPUT, "form-control") as HTMLInputElement
    emailInput.type = "email"
    emailInput.placeholder = "you@example.com"

    val fgPassword = form.appendElement(Constants.Html.DIV, "form-group")
    fgPassword.appendElement(Constants.Html.LABEL) { textContent = "Password" }
    val passwordInput = fgPassword.appendElement(Constants.Html.INPUT, "form-control") as HTMLInputElement
    passwordInput.type = "password"
    passwordInput.placeholder = "Enter your password"

    val btn = form.appendElement(Constants.Html.BUTTON, "btn") as HTMLButtonElement
    btn.type = "button"
    btn.textContent = "Log In"
    btn.style.setProperty(Constants.Css.WIDTH, "100%")
    btn.style.setProperty(Constants.Css.MARGIN_TOP, "1rem")

    btn.onClick {
        errorBanner.style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.NONE)
        val email = emailInput.value.trim()
        val password = passwordInput.value

        if (!validateEmail(email)) {
            errorBanner.textContent = "Please enter a valid email address."
            errorBanner.style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.BLOCK)
            return@onClick
        }

        if (password.length < 6) {
            errorBanner.textContent = "Password must be at least 6 characters."
            errorBanner.style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.BLOCK)
            return@onClick
        }

        launch {
            try {
                val session = authService.login(email, password)
                if (session != null) {
                    window.location.hash = Constants.TAB_WELCOME
                } else {
                    errorBanner.textContent = "Invalid email or password."
                    errorBanner.style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.BLOCK)
                }
            } catch (e: Throwable) {
                val msg = e.message ?: ""
                if (msg.contains(Constants.STATUS_CONNECT, ignoreCase = true) || msg.contains(Constants.STATUS_REFUSED, ignoreCase = true) || msg.contains(Constants.STATUS_NETWORK, ignoreCase = true)) {
                    errorBanner.textContent = "Unable to connect to the server. Please verify that your Spring Boot backend is running."
                } else {
                    errorBanner.textContent = "Authentication failed: ${e.message ?: "server error"}"
                }
                errorBanner.style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.BLOCK)
            }
        }
    }

    val toggleLink = card.appendElement(Constants.Html.P) {
        style.setProperty(Constants.Css.MARGIN_TOP, "1.5rem")
        style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER)
        style.setProperty(Constants.Css.FONT_SIZE, "0.9rem")
        style.setProperty(Constants.Css.COLOR, "var(--text-secondary)")
    }
    toggleLink.appendElement(Constants.Html.SPAN) { textContent = "Don't have an account? " }
    toggleLink.appendElement(Constants.Html.A) {
        textContent = "Create Account"
        style.setProperty(Constants.Css.COLOR, "var(--accent-red)")
        style.setProperty(Constants.Css.CURSOR, Constants.CssValues.POINTER)
        style.setProperty(Constants.Css.FONT_WEIGHT, Constants.CssValues.BOLD)
        style.setProperty(Constants.Css.TEXT_DECORATION, Constants.CssValues.UNDERLINE)
        onClick {
            window.location.hash = "register"
        }
    }
}

internal fun renderRegisterTab(container: HTMLElement) {
    val card = container.appendElement(Constants.Html.DIV, "card") {
        style.setProperty(Constants.Css.MAX_WIDTH, "450px")
        style.setProperty(Constants.Css.MARGIN, "2rem auto")
        style.setProperty(Constants.Css.PADDING, "2.5rem")
    }

    card.appendElement(Constants.Html.H2) {
        textContent = "Create Account"
        style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER)
        style.setProperty(Constants.Css.MARGIN_BOTTOM, "1.5rem")
    }

    val errorBanner = card.appendElement(Constants.Html.DIV) {
        style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.NONE)
        style.setProperty(Constants.Css.COLOR, "var(--accent-red)")
        style.setProperty(Constants.Css.BACKGROUND, "rgba(255, 42, 59, 0.1)")
        style.setProperty(Constants.Css.BORDER, "1px solid var(--accent-red)")
        style.setProperty(Constants.Css.PADDING, "0.75rem")
        style.setProperty(Constants.Css.BORDER_RADIUS, "8px")
        style.setProperty(Constants.Css.MARGIN_BOTTOM, "1rem")
        style.setProperty(Constants.Css.FONT_SIZE, "0.9rem")
    }

    val form = card.appendElement(Constants.Html.FORM)

    val fgFirstName = form.appendElement(Constants.Html.DIV, "form-group")
    fgFirstName.appendElement(Constants.Html.LABEL) { textContent = "First Name" }
    val firstNameInput = fgFirstName.appendElement(Constants.Html.INPUT, "form-control") as HTMLInputElement
    firstNameInput.placeholder = "John"

    val fgLastName = form.appendElement(Constants.Html.DIV, "form-group")
    fgLastName.appendElement(Constants.Html.LABEL) { textContent = "Last Name" }
    val lastNameInput = fgLastName.appendElement(Constants.Html.INPUT, "form-control") as HTMLInputElement
    lastNameInput.placeholder = "Doe"

    val fgEmail = form.appendElement(Constants.Html.DIV, "form-group")
    fgEmail.appendElement(Constants.Html.LABEL) { textContent = "Email Address (Username)" }
    val emailInput = fgEmail.appendElement(Constants.Html.INPUT, "form-control") as HTMLInputElement
    emailInput.type = "email"
    emailInput.placeholder = "you@example.com"

    val fgPassword = form.appendElement(Constants.Html.DIV, "form-group")
    fgPassword.appendElement(Constants.Html.LABEL) { textContent = "Password" }
    val passwordInput = fgPassword.appendElement(Constants.Html.INPUT, "form-control") as HTMLInputElement
    passwordInput.type = "password"
    passwordInput.placeholder = "At least 6 characters"

    val btn = form.appendElement(Constants.Html.BUTTON, "btn") as HTMLButtonElement
    btn.type = "button"
    btn.textContent = "Register & Log In"
    btn.style.setProperty(Constants.Css.WIDTH, "100%")
    btn.style.setProperty(Constants.Css.MARGIN_TOP, "1rem")

    btn.onClick {
        errorBanner.style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.NONE)
        val firstName = firstNameInput.value.trim()
        val lastName = lastNameInput.value.trim()
        val email = emailInput.value.trim()
        val password = passwordInput.value

        if (firstName.isEmpty() || lastName.isEmpty()) {
            errorBanner.textContent = "Please enter both your first and last name."
            errorBanner.style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.BLOCK)
            return@onClick
        }

        if (!validateEmail(email)) {
            errorBanner.textContent = "Please enter a valid email address."
            errorBanner.style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.BLOCK)
            return@onClick
        }

        if (password.length < 6) {
            errorBanner.textContent = "Password must be at least 6 characters."
            errorBanner.style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.BLOCK)
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
                    errorBanner.style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.BLOCK)
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
                errorBanner.style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.BLOCK)
            }
        }
    }

    val toggleLink = card.appendElement(Constants.Html.P) {
        style.setProperty(Constants.Css.MARGIN_TOP, "1.5rem")
        style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER)
        style.setProperty(Constants.Css.FONT_SIZE, "0.9rem")
        style.setProperty(Constants.Css.COLOR, "var(--text-secondary)")
    }
    toggleLink.appendElement(Constants.Html.SPAN) { textContent = "Already have an account? " }
    toggleLink.appendElement(Constants.Html.A) {
        textContent = "Log In"
        style.setProperty(Constants.Css.COLOR, "var(--accent-red)")
        style.setProperty(Constants.Css.CURSOR, Constants.CssValues.POINTER)
        style.setProperty(Constants.Css.FONT_WEIGHT, Constants.CssValues.BOLD)
        style.setProperty(Constants.Css.TEXT_DECORATION, Constants.CssValues.UNDERLINE)
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

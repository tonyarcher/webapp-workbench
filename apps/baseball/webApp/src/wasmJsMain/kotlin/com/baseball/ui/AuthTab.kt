package com.baseball.ui

import org.w3c.dom.*
import kotlinx.browser.window
import com.baseball.authService
import com.baseball.auth.UserAccount

internal fun renderLoginTab(container: HTMLElement) {
    val card = container.appendElement("div", "card") {
        style.setProperty("max-width", "450px")
        style.setProperty("margin", "2rem auto")
        style.setProperty("padding", "2.5rem")
    }

    card.appendElement("h2") {
        textContent = "Log In to Grand Slam"
        style.setProperty("text-align", "center")
        style.setProperty("margin-bottom", "1.5rem")
    }

    val errorBanner = card.appendElement("div") {
        style.setProperty("display", "none")
        style.setProperty("color", "var(--accent-red)")
        style.setProperty("background", "rgba(255, 42, 59, 0.1)")
        style.setProperty("border", "1px solid var(--accent-red)")
        style.setProperty("padding", "0.75rem")
        style.setProperty("border-radius", "8px")
        style.setProperty("margin-bottom", "1rem")
        style.setProperty("font-size", "0.9rem")
    }

    val form = card.appendElement("form")

    val fgEmail = form.appendElement("div", "form-group")
    fgEmail.appendElement("label") { textContent = "Email Address (Username)" }
    val emailInput = fgEmail.appendElement("input", "form-control") as HTMLInputElement
    emailInput.type = "email"
    emailInput.placeholder = "you@example.com"

    val fgPassword = form.appendElement("div", "form-group")
    fgPassword.appendElement("label") { textContent = "Password" }
    val passwordInput = fgPassword.appendElement("input", "form-control") as HTMLInputElement
    passwordInput.type = "password"
    passwordInput.placeholder = "Enter your password"

    val btn = form.appendElement("button", "btn") as HTMLButtonElement
    btn.type = "button"
    btn.textContent = "Log In"
    btn.style.setProperty("width", "100%")
    btn.style.setProperty("margin-top", "1rem")

    btn.onClick {
        errorBanner.style.setProperty("display", "none")
        val email = emailInput.value.trim()
        val password = passwordInput.value

        if (!validateEmail(email)) {
            errorBanner.textContent = "Please enter a valid email address."
            errorBanner.style.setProperty("display", "block")
            return@onClick
        }

        if (password.length < 6) {
            errorBanner.textContent = "Password must be at least 6 characters."
            errorBanner.style.setProperty("display", "block")
            return@onClick
        }

        launch {
            try {
                val session = authService.login(email, password)
                if (session != null) {
                    window.location.hash = "welcome"
                } else {
                    errorBanner.textContent = "Invalid email or password."
                    errorBanner.style.setProperty("display", "block")
                }
            } catch (e: Throwable) {
                val msg = e.message ?: ""
                if (msg.contains("connect", ignoreCase = true) || msg.contains("refused", ignoreCase = true) || msg.contains("network", ignoreCase = true)) {
                    errorBanner.textContent = "Unable to connect to the server. Please verify that your Spring Boot backend is running."
                } else {
                    errorBanner.textContent = "Authentication failed: ${e.message ?: "server error"}"
                }
                errorBanner.style.setProperty("display", "block")
            }
        }
    }

    val toggleLink = card.appendElement("p") {
        style.setProperty("margin-top", "1.5rem")
        style.setProperty("text-align", "center")
        style.setProperty("font-size", "0.9rem")
        style.setProperty("color", "var(--text-secondary)")
    }
    toggleLink.appendElement("span") { textContent = "Don't have an account? " }
    toggleLink.appendElement("a") {
        textContent = "Create Account"
        style.setProperty("color", "var(--accent-red)")
        style.setProperty("cursor", "pointer")
        style.setProperty("font-weight", "bold")
        style.setProperty("text-decoration", "underline")
        onClick {
            window.location.hash = "register"
        }
    }
}

internal fun renderRegisterTab(container: HTMLElement) {
    val card = container.appendElement("div", "card") {
        style.setProperty("max-width", "450px")
        style.setProperty("margin", "2rem auto")
        style.setProperty("padding", "2.5rem")
    }

    card.appendElement("h2") {
        textContent = "Create Account"
        style.setProperty("text-align", "center")
        style.setProperty("margin-bottom", "1.5rem")
    }

    val errorBanner = card.appendElement("div") {
        style.setProperty("display", "none")
        style.setProperty("color", "var(--accent-red)")
        style.setProperty("background", "rgba(255, 42, 59, 0.1)")
        style.setProperty("border", "1px solid var(--accent-red)")
        style.setProperty("padding", "0.75rem")
        style.setProperty("border-radius", "8px")
        style.setProperty("margin-bottom", "1rem")
        style.setProperty("font-size", "0.9rem")
    }

    val form = card.appendElement("form")

    val fgFirstName = form.appendElement("div", "form-group")
    fgFirstName.appendElement("label") { textContent = "First Name" }
    val firstNameInput = fgFirstName.appendElement("input", "form-control") as HTMLInputElement
    firstNameInput.placeholder = "John"

    val fgLastName = form.appendElement("div", "form-group")
    fgLastName.appendElement("label") { textContent = "Last Name" }
    val lastNameInput = fgLastName.appendElement("input", "form-control") as HTMLInputElement
    lastNameInput.placeholder = "Doe"

    val fgEmail = form.appendElement("div", "form-group")
    fgEmail.appendElement("label") { textContent = "Email Address (Username)" }
    val emailInput = fgEmail.appendElement("input", "form-control") as HTMLInputElement
    emailInput.type = "email"
    emailInput.placeholder = "you@example.com"

    val fgPassword = form.appendElement("div", "form-group")
    fgPassword.appendElement("label") { textContent = "Password" }
    val passwordInput = fgPassword.appendElement("input", "form-control") as HTMLInputElement
    passwordInput.type = "password"
    passwordInput.placeholder = "At least 6 characters"

    val btn = form.appendElement("button", "btn") as HTMLButtonElement
    btn.type = "button"
    btn.textContent = "Register & Log In"
    btn.style.setProperty("width", "100%")
    btn.style.setProperty("margin-top", "1rem")

    btn.onClick {
        errorBanner.style.setProperty("display", "none")
        val firstName = firstNameInput.value.trim()
        val lastName = lastNameInput.value.trim()
        val email = emailInput.value.trim()
        val password = passwordInput.value

        if (firstName.isEmpty() || lastName.isEmpty()) {
            errorBanner.textContent = "Please enter both your first and last name."
            errorBanner.style.setProperty("display", "block")
            return@onClick
        }

        if (!validateEmail(email)) {
            errorBanner.textContent = "Please enter a valid email address."
            errorBanner.style.setProperty("display", "block")
            return@onClick
        }

        if (password.length < 6) {
            errorBanner.textContent = "Password must be at least 6 characters."
            errorBanner.style.setProperty("display", "block")
            return@onClick
        }

        launch {
            try {
                authService.registerUser(
                    UserAccount(email, firstName, lastName, password)
                )
                val session = authService.login(email, password)
                if (session != null) {
                    window.location.hash = "welcome"
                } else {
                    errorBanner.textContent = "Registration succeeded, but login failed."
                    errorBanner.style.setProperty("display", "block")
                }
            } catch (e: Throwable) {
                val msg = e.message ?: ""
                if (msg.contains("connect", ignoreCase = true) || msg.contains("refused", ignoreCase = true) || msg.contains("network", ignoreCase = true)) {
                    errorBanner.textContent = "Unable to connect to the server. Please verify that your Spring Boot backend is running."
                } else if (msg.contains("400") || msg.contains("BadRequest", ignoreCase = true)) {
                    errorBanner.textContent = "An account with this email already exists."
                } else {
                    errorBanner.textContent = "Registration failed: ${e.message ?: "server error"}"
                }
                errorBanner.style.setProperty("display", "block")
            }
        }
    }

    val toggleLink = card.appendElement("p") {
        style.setProperty("margin-top", "1.5rem")
        style.setProperty("text-align", "center")
        style.setProperty("font-size", "0.9rem")
        style.setProperty("color", "var(--text-secondary)")
    }
    toggleLink.appendElement("span") { textContent = "Already have an account? " }
    toggleLink.appendElement("a") {
        textContent = "Log In"
        style.setProperty("color", "var(--accent-red)")
        style.setProperty("cursor", "pointer")
        style.setProperty("font-weight", "bold")
        style.setProperty("text-decoration", "underline")
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

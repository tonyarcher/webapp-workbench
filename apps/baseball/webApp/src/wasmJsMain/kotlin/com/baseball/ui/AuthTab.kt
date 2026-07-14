package com.baseball.ui

import com.baseball.BaseballConstants
import com.baseball.UiConstants
import org.w3c.dom.*
import kotlinx.browser.window
import com.baseball.authService
import com.baseball.auth.UserAccount
import kotlinx.html.*
import kotlinx.html.js.*

internal fun renderLoginTab(container: HTMLElement) {
    var errorBanner: HTMLDivElement? = null
    var emailInput: HTMLInputElement? = null
    var passwordInput: HTMLInputElement? = null

    container.div(classes = "card") {
        style = "max-width: 450px; margin: 2rem auto; padding: 2.5rem;"

        h2 {
            +"Log In to Grand Slam"
            style = "text-align: center; margin-bottom: 1.5rem;"
        }

        errorBanner = div {
            style = "display: none; color: var(--accent-red); background: rgba(255, 42, 59, 0.1); border: 1px solid var(--accent-red); padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.9rem;"
        } as HTMLDivElement

        form {
            div(classes = "form-group") {
                label { +"Email Address (Username)" }
                emailInput = input(type = InputType.email, classes = "form-control") {
                    placeholder = "you@example.com"
                } as HTMLInputElement
            }

            div(classes = "form-group") {
                label { +"Password" }
                passwordInput = input(type = InputType.password, classes = "form-control") {
                    placeholder = "Enter your password"
                } as HTMLInputElement
            }

            button(classes = "btn") {
                type = ButtonType.button
                +"Log In"
                style = "width: 100%; margin-top: 1rem;"
                onClickFunction = {
                    val banner = errorBanner
                    val emailIn = emailInput
                    val passIn = passwordInput
                    if (banner != null && emailIn != null && passIn != null) {
                        banner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.NONE)
                        val email = emailIn.value.trim()
                        val password = passIn.value

                        if (!validateEmail(email)) {
                            banner.textContent = "Please enter a valid email address."
                            banner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
                        } else if (password.length < 6) {
                            banner.textContent = "Password must be at least 6 characters."
                            banner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
                        } else {
                            launch {
                                try {
                                    val session = authService.login(email, password)
                                    if (session != null) {
                                        window.location.hash = BaseballConstants.TAB_WELCOME
                                    } else {
                                        banner.textContent = "Invalid email or password."
                                        banner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
                                    }
                                } catch (e: Throwable) {
                                    val msg = e.message ?: ""
                                    if (msg.contains(BaseballConstants.STATUS_CONNECT, ignoreCase = true) || msg.contains(BaseballConstants.STATUS_REFUSED, ignoreCase = true) || msg.contains(BaseballConstants.STATUS_NETWORK, ignoreCase = true)) {
                                        banner.textContent = "Unable to connect to the server. Please verify that your Spring Boot backend is running."
                                    } else {
                                        banner.textContent = "Authentication failed: ${e.message ?: "server error"}"
                                    }
                                    banner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
                                }
                            }
                        }
                    }
                }
            }
        }

        p {
            style = "margin-top: 1.5rem; text-align: center; font-size: 0.9rem; color: var(--text-secondary);"
            span { +"Don't have an account? " }
            a {
                +"Create Account"
                style = "color: var(--accent-red); cursor: pointer; font-weight: bold; text-decoration: underline;"
                onClickFunction = {
                    window.location.hash = "register"
                }
            }
        }
    }
}

internal fun renderRegisterTab(container: HTMLElement) {
    var errorBanner: HTMLDivElement? = null
    var firstNameInput: HTMLInputElement? = null
    var lastNameInput: HTMLInputElement? = null
    var emailInput: HTMLInputElement? = null
    var passwordInput: HTMLInputElement? = null

    container.div(classes = "card") {
        style = "max-width: 450px; margin: 2rem auto; padding: 2.5rem;"

        h2 {
            +"Create Account"
            style = "text-align: center; margin-bottom: 1.5rem;"
        }

        errorBanner = div {
            style = "display: none; color: var(--accent-red); background: rgba(255, 42, 59, 0.1); border: 1px solid var(--accent-red); padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.9rem;"
        } as HTMLDivElement

        form {
            div(classes = "form-group") {
                label { +"First Name" }
                firstNameInput = input(type = InputType.text, classes = "form-control") {
                    placeholder = "John"
                } as HTMLInputElement
            }

            div(classes = "form-group") {
                label { +"Last Name" }
                lastNameInput = input(type = InputType.text, classes = "form-control") {
                    placeholder = "Doe"
                } as HTMLInputElement
            }

            div(classes = "form-group") {
                label { +"Email Address (Username)" }
                emailInput = input(type = InputType.email, classes = "form-control") {
                    placeholder = "you@example.com"
                } as HTMLInputElement
            }

            div(classes = "form-group") {
                label { +"Password" }
                passwordInput = input(type = InputType.password, classes = "form-control") {
                    placeholder = "At least 6 characters"
                } as HTMLInputElement
            }

            button(classes = "btn") {
                type = ButtonType.button
                +"Register & Log In"
                style = "width: 100%; margin-top: 1rem;"
                onClickFunction = {
                    val banner = errorBanner
                    val firstIn = firstNameInput
                    val lastIn = lastNameInput
                    val emailIn = emailInput
                    val passIn = passwordInput
                    if (banner != null && firstIn != null && lastIn != null && emailIn != null && passIn != null) {
                        banner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.NONE)
                        val firstName = firstIn.value.trim()
                        val lastName = lastIn.value.trim()
                        val email = emailIn.value.trim()
                        val password = passIn.value

                        if (firstName.isEmpty() || lastName.isEmpty()) {
                            banner.textContent = "Please enter both your first and last name."
                            banner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
                        } else if (!validateEmail(email)) {
                            banner.textContent = "Please enter a valid email address."
                            banner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
                        } else if (password.length < 6) {
                            banner.textContent = "Password must be at least 6 characters."
                            banner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
                        } else {
                            launch {
                                try {
                                    authService.registerUser(
                                        UserAccount(email, firstName, lastName, password)
                                    )
                                    val session = authService.login(email, password)
                                    if (session != null) {
                                        window.location.hash = BaseballConstants.TAB_WELCOME
                                    } else {
                                        banner.textContent = "Registration succeeded, but login failed."
                                        banner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
                                    }
                                } catch (e: Throwable) {
                                    val msg = e.message ?: ""
                                    if (msg.contains(BaseballConstants.STATUS_CONNECT, ignoreCase = true) || msg.contains(BaseballConstants.STATUS_REFUSED, ignoreCase = true) || msg.contains(BaseballConstants.STATUS_NETWORK, ignoreCase = true)) {
                                        banner.textContent = "Unable to connect to the server. Please verify that your Spring Boot backend is running."
                                    } else if (msg.contains(BaseballConstants.STATUS_400) || msg.contains(BaseballConstants.STATUS_BAD_REQUEST, ignoreCase = true)) {
                                        banner.textContent = "An account with this email already exists."
                                    } else {
                                        banner.textContent = "Registration failed: ${e.message ?: "server error"}"
                                    }
                                    banner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.BLOCK)
                                }
                            }
                        }
                    }
                }
            }
        }

        p {
            style = "margin-top: 1.5rem; text-align: center; font-size: 0.9rem; color: var(--text-secondary);"
            span { +"Already have an account? " }
            a {
                +"Log In"
                style = "color: var(--accent-red); cursor: pointer; font-weight: bold; text-decoration: underline;"
                onClickFunction = {
                    window.location.hash = "login"
                }
            }
        }
    }
}

private fun validateEmail(email: String): Boolean {
    val atIndex = email.indexOf('@')
    val dotIndex = email.lastIndexOf('.')
    return atIndex > 0 && dotIndex > atIndex + 1 && dotIndex < email.length - 1
}

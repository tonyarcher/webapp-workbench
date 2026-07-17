package com.baseball.ui.auth

import com.baseball.BaseballConstants
import com.baseball.UiConstants
import com.baseball.auth.UserAccount
import com.baseball.authService
import com.baseball.ui.css
import com.baseball.ui.div
import com.baseball.ui.launch
import kotlinx.browser.window
import kotlinx.css.*
import kotlinx.html.*
import kotlinx.html.js.onClickFunction
import org.w3c.dom.HTMLDivElement
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLInputElement

internal fun renderLoginTab(container: HTMLElement) {
    var errorBanner: HTMLDivElement? = null
    var emailInput: HTMLInputElement? = null
    var passwordInput: HTMLInputElement? = null

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

        errorBanner =
            div {
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
            } as HTMLDivElement

        form {
            div(classes = "form-group") {
                label { +"Email Address (Username)" }
                emailInput =
                    input(type = InputType.email, classes = "form-control") {
                        placeholder = "you@example.com"
                    } as HTMLInputElement
            }

            div(classes = "form-group") {
                label { +"Password" }
                passwordInput =
                    input(type = InputType.password, classes = "form-control") {
                        placeholder = "Enter your password"
                    } as HTMLInputElement
            }

            button(classes = "btn") {
                type = ButtonType.button
                +"Log In"
                css {
                    width = 100.pct
                    marginTop = 1.rem
                }
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
                                    if (msg.contains(BaseballConstants.STATUS_CONNECT, ignoreCase = true) ||
                                        msg.contains(BaseballConstants.STATUS_REFUSED, ignoreCase = true) ||
                                        msg.contains(BaseballConstants.STATUS_NETWORK, ignoreCase = true)
                                    ) {
                                        banner.textContent =
                                            "Unable to connect to the server. Please verify that your Spring Boot backend is running."
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

        errorBanner =
            div {
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
            } as HTMLDivElement

        form {
            div(classes = "form-group") {
                label { +"First Name" }
                firstNameInput =
                    input(type = InputType.text, classes = "form-control") {
                        placeholder = "John"
                    } as HTMLInputElement
            }

            div(classes = "form-group") {
                label { +"Last Name" }
                lastNameInput =
                    input(type = InputType.text, classes = "form-control") {
                        placeholder = "Doe"
                    } as HTMLInputElement
            }

            div(classes = "form-group") {
                label { +"Email Address (Username)" }
                emailInput =
                    input(type = InputType.email, classes = "form-control") {
                        placeholder = "you@example.com"
                    } as HTMLInputElement
            }

            div(classes = "form-group") {
                label { +"Password" }
                passwordInput =
                    input(type = InputType.password, classes = "form-control") {
                        placeholder = "At least 6 characters"
                    } as HTMLInputElement
            }

            button(classes = "btn") {
                type = ButtonType.button
                +"Register & Log In"
                css {
                    width = 100.pct
                    marginTop = 1.rem
                }
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
                                        UserAccount(email, firstName, lastName, password),
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
                                    if (msg.contains(BaseballConstants.STATUS_CONNECT, ignoreCase = true) ||
                                        msg.contains(BaseballConstants.STATUS_REFUSED, ignoreCase = true) ||
                                        msg.contains(BaseballConstants.STATUS_NETWORK, ignoreCase = true)
                                    ) {
                                        banner.textContent =
                                            "Unable to connect to the server. Please verify that your Spring Boot backend is running."
                                    } else if (msg.contains(BaseballConstants.STATUS_400) ||
                                        msg.contains(BaseballConstants.STATUS_BAD_REQUEST, ignoreCase = true)
                                    ) {
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

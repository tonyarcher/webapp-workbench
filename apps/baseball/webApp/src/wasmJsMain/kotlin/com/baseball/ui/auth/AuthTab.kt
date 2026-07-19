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
                onClickFunction = {
                    val banner = document.getElementById("login-error-banner") as? HTMLDivElement
                    val emailIn = document.getElementById("login-email") as? HTMLInputElement
                    val passIn = document.getElementById("login-password") as? HTMLInputElement
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
                                            "Unable to connect to the server. Please verify that the backend server is running."
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
                onClickFunction = {
                    val banner = document.getElementById("register-error-banner") as? HTMLDivElement
                    val firstIn = document.getElementById("register-first-name") as? HTMLInputElement
                    val lastIn = document.getElementById("register-last-name") as? HTMLInputElement
                    val emailIn = document.getElementById("register-email") as? HTMLInputElement
                    val passIn = document.getElementById("register-password") as? HTMLInputElement
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
                                            "Unable to connect to the server. Please verify that the backend server is running."
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

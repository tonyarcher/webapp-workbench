package com.baseball.ui.auth

import com.baseball.BaseballConstants
import com.baseball.UiConstants
import com.baseball.auth.UserAccount
import com.baseball.authService
import com.baseball.ui.css
import com.baseball.ui.launch
import kotlinx.browser.document
import kotlinx.browser.window
import kotlinx.css.Border
import kotlinx.css.BorderStyle
import kotlinx.css.Color
import kotlinx.css.Cursor
import kotlinx.css.Display
import kotlinx.css.FontWeight
import kotlinx.css.LinearDimension
import kotlinx.css.Margin
import kotlinx.css.Padding
import kotlinx.css.TextAlign
import kotlinx.css.background
import kotlinx.css.border
import kotlinx.css.borderRadius
import kotlinx.css.color
import kotlinx.css.cursor
import kotlinx.css.display
import kotlinx.css.fontSize
import kotlinx.css.fontWeight
import kotlinx.css.margin
import kotlinx.css.marginBottom
import kotlinx.css.marginTop
import kotlinx.css.maxWidth
import kotlinx.css.padding
import kotlinx.css.pct
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.css.textAlign
import kotlinx.css.width
import kotlinx.html.ButtonType
import kotlinx.html.DIV
import kotlinx.html.InputType
import kotlinx.html.a
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.form
import kotlinx.html.h2
import kotlinx.html.id
import kotlinx.html.input
import kotlinx.html.js.div
import kotlinx.html.js.onClickFunction
import kotlinx.html.label
import kotlinx.html.p
import kotlinx.html.span
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
}

private fun handleLoginClick() {
    val banner = document.getElementById("login-error-banner") as? HTMLDivElement
    val emailIn = document.getElementById("login-email") as? HTMLInputElement
    val passIn = document.getElementById("login-password") as? HTMLInputElement
    if (banner == null || emailIn == null || passIn == null) return

    banner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.NONE)
    val email = emailIn.value.trim()
    val password = passIn.value

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
            window.location.hash = BaseballConstants.TAB_WELCOME
        } else {
            showError(banner, "Invalid email or password.")
        }
    } catch (e: Throwable) {
        showError(banner, parseAuthException(e))
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

private fun DIV.renderRegisterHeader() {
    h2 {
        +"Create Account"
        css {
            textAlign = TextAlign.center
            marginBottom = 1.5.rem
        }
    }
}

private fun DIV.renderRegisterErrorBanner() {
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
}

private fun DIV.renderRegisterForm() {
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
}

private fun DIV.renderRegisterFooter() {
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

private fun handleRegisterClick() {
    val banner = document.getElementById("register-error-banner") as? HTMLDivElement
    val firstIn = document.getElementById("register-first-name") as? HTMLInputElement
    val lastIn = document.getElementById("register-last-name") as? HTMLInputElement
    val emailIn = document.getElementById("register-email") as? HTMLInputElement
    val passIn = document.getElementById("register-password") as? HTMLInputElement
    if (banner == null || firstIn == null || lastIn == null || emailIn == null || passIn == null) return

    banner.style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.NONE)
    val first = firstIn.value.trim()
    val last = lastIn.value.trim()
    val email = emailIn.value.trim()
    val pass = passIn.value

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
            window.location.hash = BaseballConstants.TAB_WELCOME
        } else {
            showError(banner, "Registration succeeded, but login failed.")
        }
    } catch (e: Throwable) {
        showError(banner, parseRegisterException(e))
    }
}

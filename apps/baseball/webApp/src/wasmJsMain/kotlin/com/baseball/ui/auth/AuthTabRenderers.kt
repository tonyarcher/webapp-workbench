package com.baseball.ui.auth

import com.baseball.ui.core.css
import kotlinx.browser.window
import kotlinx.css.Border
import kotlinx.css.BorderStyle
import kotlinx.css.Color
import kotlinx.css.Cursor
import kotlinx.css.Display
import kotlinx.css.FontWeight
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
import kotlinx.css.marginBottom
import kotlinx.css.marginTop
import kotlinx.css.padding
import kotlinx.css.pct
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.css.textAlign
import kotlinx.css.width
import kotlinx.html.ButtonType
import kotlinx.html.DIV
import kotlinx.html.FORM
import kotlinx.html.InputType
import kotlinx.html.a
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.form
import kotlinx.html.h2
import kotlinx.html.id
import kotlinx.html.input
import kotlinx.html.js.onClickFunction
import kotlinx.html.label
import kotlinx.html.p
import kotlinx.html.span

internal fun DIV.renderLoginHeader() {
    h2 {
        +"Log In to Grand Slam"
        css {
            textAlign = TextAlign.center
            marginBottom = 1.5.rem
        }
    }
}

internal fun DIV.renderLoginErrorBanner() {
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
}

internal fun DIV.renderLoginForm() {
    form {
        renderAuthFormGroup("Email Address (Username)", InputType.email, "login-email", "you@example.com")
        renderAuthFormGroup("Password", InputType.password, "login-password", "Enter your password")

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
}

internal fun DIV.renderLoginFooter() {
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

internal fun DIV.renderRegisterHeader() {
    h2 {
        +"Create Account"
        css {
            textAlign = TextAlign.center
            marginBottom = 1.5.rem
        }
    }
}

internal fun DIV.renderRegisterErrorBanner() {
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

internal fun DIV.renderRegisterForm() {
    form {
        renderAuthFormGroup("First Name", InputType.text, "register-first-name", "John")
        renderAuthFormGroup("Last Name", InputType.text, "register-last-name", "Doe")
        renderAuthFormGroup("Email Address (Username)", InputType.email, "register-email", "you@example.com")
        renderAuthFormGroup("Password", InputType.password, "register-password", "At least 6 characters")

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

internal fun DIV.renderRegisterFooter() {
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

internal fun FORM.renderAuthFormGroup(
    labelText: String,
    inputType: InputType,
    id: String,
    placeholder: String
) {
    div(classes = "form-group") {
        label { +labelText }
        input(type = inputType, classes = "form-control") {
            this.id = id
            this.placeholder = placeholder
        }
    }
}

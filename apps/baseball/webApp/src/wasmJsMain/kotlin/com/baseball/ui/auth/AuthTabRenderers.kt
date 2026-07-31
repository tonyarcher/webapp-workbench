package com.baseball.ui.auth

import kotlinx.browser.window
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
    h2(classes = "auth-header") {
        +"Log In to Grand Slam"
    }
}

internal fun DIV.renderLoginErrorBanner() {
    div(classes = "auth-error-banner") {
        id = "login-error-banner"
    }
}

internal fun DIV.renderLoginForm() {
    form {
        renderAuthFormGroup("Email Address (Username)", InputType.email, "login-email", "you@example.com")
        renderAuthFormGroup("Password", InputType.password, "login-password", "Enter your password")

        button(classes = "btn btn-full") {
            type = ButtonType.button
            +"Log In"
            onClickFunction = { handleLoginClick() }
        }
    }
}

internal fun DIV.renderLoginFooter() {
    p(classes = "auth-footer") {
        span { +"Don't have an account? " }
        a(classes = "auth-link") {
            +"Create Account"
            onClickFunction = { window.location.hash = "register" }
        }
    }
}

internal fun DIV.renderRegisterHeader() {
    h2(classes = "auth-header") {
        +"Create Account"
    }
}

internal fun DIV.renderRegisterErrorBanner() {
    div(classes = "auth-error-banner") {
        id = "register-error-banner"
    }
}

internal fun DIV.renderRegisterForm() {
    form {
        renderAuthFormGroup("First Name", InputType.text, "register-first-name", "John")
        renderAuthFormGroup("Last Name", InputType.text, "register-last-name", "Doe")
        renderAuthFormGroup("Email Address (Username)", InputType.email, "register-email", "you@example.com")
        renderAuthFormGroup("Password", InputType.password, "register-password", "At least 6 characters")

        button(classes = "btn btn-full") {
            type = ButtonType.button
            +"Register & Log In"
            onClickFunction = { handleRegisterClick() }
        }
    }
}

internal fun DIV.renderRegisterFooter() {
    p(classes = "auth-footer") {
        span { +"Already have an account? " }
        a(classes = "auth-link") {
            +"Log In"
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

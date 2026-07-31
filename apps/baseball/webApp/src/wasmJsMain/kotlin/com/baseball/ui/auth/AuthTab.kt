package com.baseball.ui.auth

import com.baseball.auth.UserAccount
import com.baseball.authService
import com.baseball.ui.state.launch
import com.baseball.ui.state.AppViewManager
import com.baseball.ui.state.NavTabs
import kotlinx.browser.document
import kotlinx.browser.window
import org.w3c.dom.Element
import org.w3c.dom.HTMLElement

internal fun renderLoginTab(container: HTMLElement) {
    renderAuthCard(container)
}

internal fun renderRegisterTab(container: HTMLElement) {
    renderAuthCard(container)
}

private fun renderAuthCard(container: HTMLElement, errorMessage: String = "") {
    container.innerHTML = ""
    val card = document.createElement("baseball-auth-card")
    AppViewManager.currentUserSession?.let {
        card.setAttribute("logged-in-user", it.firstName)
    }
    if (errorMessage.isNotEmpty()) {
        card.setAttribute("error-message", errorMessage)
    }

    card.addEventListener("auth-submit", { event ->
        val target = event.target as? Element
        val isSignUp = target?.getAttribute("is-sign-up") == "true"
        val username = target?.getAttribute("username") ?: ""
        val password = target?.getAttribute("password") ?: ""

        launch {
            if (isSignUp) {
                handleSignUp(container, username, password)
            } else {
                handleSignIn(container, username, password)
            }
        }
    })

    card.addEventListener("auth-logout", {
        authService.logout()
        AppViewManager.renderApp()
        AppViewManager.renderCurrentTabContent()
    })

    container.appendChild(card)
}

private suspend fun handleSignIn(container: HTMLElement, email: String, pass: String) {
    try {
        val session = authService.login(email, pass)
        if (session != null) {
            window.location.hash = NavTabs.TAB_WELCOME
        } else {
            renderAuthCard(container, "Invalid email or password.")
        }
    } catch (expected: Throwable) {
        renderAuthCard(container, expected.message ?: "Authentication failed.")
    }
}

private suspend fun handleSignUp(container: HTMLElement, email: String, pass: String) {
    try {
        authService.registerUser(UserAccount(email, "User", "Member", pass))
        val session = authService.login(email, pass)
        if (session != null) {
            window.location.hash = NavTabs.TAB_WELCOME
        } else {
            renderAuthCard(container, "Registration succeeded, but login failed.")
        }
    } catch (expected: Throwable) {
        renderAuthCard(container, expected.message ?: "Registration failed.")
    }
}

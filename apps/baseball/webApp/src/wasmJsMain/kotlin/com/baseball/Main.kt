package com.baseball

import com.baseball.api.*
import com.baseball.auth.*
import com.baseball.game.*
import com.baseball.ui.AppViewManager

// Global interface instantiations promoting coding by interface inheritance
val api: BaseballApi = BaseballApiClient()
val authService: AuthService = AuthManager
val gameService: GameService = LocalGameManager

fun main() {
    AppViewManager.start()
}

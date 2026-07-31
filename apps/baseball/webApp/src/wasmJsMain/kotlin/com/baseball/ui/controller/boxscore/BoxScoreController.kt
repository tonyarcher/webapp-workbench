package com.baseball.ui.controller.boxscore

import com.baseball.game.localBoxScore
import com.baseball.game.localGame
import kotlinx.browser.document
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLElement

object BoxScoreController {
    fun render(container: HTMLElement) {
        container.innerHTML = ""
        val game = localGame
        val boxScore = localBoxScore

        val wrapper = document.createElement("baseball-tab-page-wrapper")
        if (game == null || boxScore == null) {
            wrapper.setAttribute("empty-message", "No active box score available.")
        } else {
            val scoreboard = document.createElement("baseball-scoreboard")
            scoreboard.setAttribute("game-json", Json.encodeToString(game))
            scoreboard.setAttribute("box-score-json", Json.encodeToString(boxScore))
            wrapper.appendChild(scoreboard)
        }
        container.appendChild(wrapper)
    }
}

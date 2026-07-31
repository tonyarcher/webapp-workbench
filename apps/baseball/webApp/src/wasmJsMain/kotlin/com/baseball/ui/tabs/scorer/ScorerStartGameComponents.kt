package com.baseball.ui.tabs.scorer

import com.baseball.models.Game
import com.baseball.ui.gametracking.lineup.isLineupDialogOpen
import com.baseball.ui.state.renderCurrentTab
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h2
import kotlinx.html.h3
import kotlinx.html.js.onClickFunction
import kotlinx.html.p
import org.w3c.dom.HTMLElement
import org.w3c.dom.events.Event

internal fun renderStartGameCard(container: HTMLElement, game: Game) {
    container.append {
        div(classes = "card text-center padding-lg auth-card") {
            h2 { +"Ready to Play!" }
            renderStartGameMatchupText(game)
            renderTeamMatchupPreview(game)
            renderStartGameButton()
        }
    }
}

private fun kotlinx.html.DIV.renderStartGameMatchupText(game: Game) {
    p(classes = "text-muted margin-top-md margin-bottom-lg") {
        +"Matchup: ${game.awayTeam.city} ${game.awayTeam.name} @ ${game.homeTeam.city} ${game.homeTeam.name}"
    }
}

private fun kotlinx.html.DIV.renderStartGameButton() {
    button(classes = "btn btn-primary btn-full") {
        +"START GAME"
        onClickFunction = { _: Event ->
            isLineupDialogOpen = true
            renderCurrentTab()
        }
    }
}

private fun kotlinx.html.DIV.renderTeamMatchupPreview(game: Game) {
    div(classes = "flex-between flex-gap-md margin-bottom-lg") {
        renderTeamAbbrevBox("Away", game.awayTeam.abbreviation)
        renderTeamAbbrevBox("Home", game.homeTeam.abbreviation)
    }
}

private fun kotlinx.html.DIV.renderTeamAbbrevBox(label: String, abbrev: String) {
    div(classes = "pitcher-card flex-grow") {
        div { +label }
        h3 { +abbrev }
    }
}

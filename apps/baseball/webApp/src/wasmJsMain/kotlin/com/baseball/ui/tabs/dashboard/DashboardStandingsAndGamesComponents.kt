package com.baseball.ui.tabs.dashboard

import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.models.TeamStandings
import com.baseball.ui.state.NavTabs
import com.baseball.ui.state.currentTab
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.selectedGameId
import com.baseball.ui.state.updateActiveTabButtons
import kotlinx.browser.document
import kotlinx.html.DIV
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.h3
import kotlinx.html.id
import kotlinx.html.js.onClickFunction
import kotlinx.html.p
import kotlinx.html.span
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.w3c.dom.HTMLElement

@Serializable
private data class StandingsJs(
    val teamName: String,
    val gamesPlayed: Int,
    val wins: Int,
    val losses: Int,
    val winPercentage: Double,
    val runsScored: Int,
    val runsAllowed: Int,
)

internal fun DIV.renderStandingsCard(standings: List<TeamStandings>) {
    val rows = standings.map { s ->
        StandingsJs(
            teamName = s.teamName,
            gamesPlayed = s.gamesPlayed,
            wins = s.wins,
            losses = s.losses,
            winPercentage = s.winPercentage,
            runsScored = s.runsScored,
            runsAllowed = s.runsAllowed,
        )
    }

    div { id = "standings-table-mount-point" }

    val mountPoint = document.getElementById("standings-table-mount-point") as? HTMLElement
    if (mountPoint != null) {
        mountPoint.innerHTML = ""
        val table = document.createElement("baseball-standings-table")
        val jsonString = Json.encodeToString(rows)
        table.setAttribute("standings-json", jsonString)
        mountPoint.appendChild(table)
    }
}

internal fun DIV.renderGamesListCard(games: List<Game>) {
    div(classes = "card") {
        h3 { +"Games Schedule (${games.size})" }
        if (games.isEmpty()) {
            p(classes = "text-muted") { +"No games scheduled yet." }
        } else {
            div(classes = "schedule-list") {
                games.forEach { g -> renderGameCardItem(g) }
            }
        }
    }
}

private fun DIV.renderGameCardItem(g: Game) {
    div(classes = "game-card flex-between") {
        div {
            div(classes = "font-bold") {
                +"${g.awayTeam.city} ${g.awayTeam.name} @ ${g.homeTeam.city} ${g.homeTeam.name}"
            }
            div(classes = "text-muted font-small margin-top-xs") {
                +"Date: ${g.date} | Status: ${g.status}"
            }
        }
        renderGameCardAction(g)
    }
}

private fun DIV.renderGameCardAction(g: Game) {
    div(classes = "flex-center flex-gap-sm") {
        if (g.status == GameStatus.COMPLETED) {
            renderCompletedGameAction(g)
        } else {
            renderActiveGameAction(g)
        }
    }
}

private fun DIV.renderCompletedGameAction(g: Game) {
    span(classes = "font-bold margin-right-md") {
        +"${g.awayScore} - ${g.homeScore}"
    }
    button(classes = "btn btn-secondary") {
        +"Box Score"
        onClickFunction = {
            updateActiveTabButtons()
            renderCurrentTab()
        }
    }
}

private fun DIV.renderActiveGameAction(g: Game) {
    button(classes = "btn btn-primary") {
        +"Score Game"
        onClickFunction = {
            selectedGameId = g.id
            currentTab = NavTabs.TAB_LIVE_SCORER
            updateActiveTabButtons()
            renderCurrentTab()
        }
    }
}

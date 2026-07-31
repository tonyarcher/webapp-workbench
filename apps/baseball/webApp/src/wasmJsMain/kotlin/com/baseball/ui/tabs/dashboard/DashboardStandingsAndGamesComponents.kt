package com.baseball.ui.tabs.dashboard

import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.models.TeamStandings
import com.baseball.ui.state.NavTabs
import com.baseball.ui.state.currentTab
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.selectedGameId
import com.baseball.ui.state.updateActiveTabButtons
import kotlinx.html.DIV
import kotlinx.html.TBODY
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.h2
import kotlinx.html.h3
import kotlinx.html.js.onClickFunction
import kotlinx.html.p
import kotlinx.html.span
import kotlinx.html.table
import kotlinx.html.tbody
import kotlinx.html.td
import kotlinx.html.th
import kotlinx.html.thead
import kotlinx.html.tr

internal fun DIV.renderStandingsCard(standings: List<TeamStandings>) {
    div(classes = "card") {
        h2 { +"League Standings" }
        div(classes = "table-container") {
            table {
                thead {
                    tr {
                        th { +"Team" }; th { +"GP" }; th { +"W" }
                        th { +"L" }; th { +"PCT" }; th { +"RS" }; th { +"RA" }
                    }
                }
                tbody {
                    standings.forEach { row -> renderTeamStandings(row) }
                }
            }
        }
    }
}

private fun TBODY.renderTeamStandings(row: TeamStandings) {
    tr {
        td(classes = "font-bold") { +row.teamName }
        td { +row.gamesPlayed.toString() }
        td { +row.wins.toString() }
        td { +row.losses.toString() }
        td { +formatWinPercentage(row.winPercentage) }
        td { +row.runsScored.toString() }
        td { +row.runsAllowed.toString() }
    }
}

internal fun DIV.renderGamesListCard(games: List<Game>) {
    div(classes = "card") {
        h3 { +"Games Schedule (${games.size})" }
        if (games.isEmpty()) {
            p(classes = "text-muted") {
                +"No games scheduled yet."
            }
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

package com.baseball.ui.tabs.dashboard

import com.baseball.BaseballConstants
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.models.TeamStandings
import com.baseball.ui.UiConstants
import com.baseball.ui.css
import com.baseball.ui.currentTab
import com.baseball.ui.renderCurrentTab
import com.baseball.ui.selectedGameId
import com.baseball.ui.updateActiveTabButtons
import kotlinx.css.Align
import kotlinx.css.Color
import kotlinx.css.Display
import kotlinx.css.FlexDirection
import kotlinx.css.FontWeight
import kotlinx.css.JustifyContent
import kotlinx.css.Overflow
import kotlinx.css.alignItems
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.flexDirection
import kotlinx.css.fontSize
import kotlinx.css.fontWeight
import kotlinx.css.gap
import kotlinx.css.justifyContent
import kotlinx.css.marginBottom
import kotlinx.css.marginRight
import kotlinx.css.marginTop
import kotlinx.css.maxHeight
import kotlinx.css.overflowY
import kotlinx.css.padding
import kotlinx.css.px
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
        td { +row.teamName; css { fontWeight = FontWeight.bold } }
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
            p {
                +"No games scheduled yet."
                css { color = Color("var(--text-secondary)") }
            }
        } else {
            div {
                css {
                    display = Display.flex
                    flexDirection = FlexDirection.column
                    gap = UiConstants.CARD_GAP
                    maxHeight = 400.px
                    overflowY = Overflow.auto
                }
                games.forEach { g -> renderGameCardItem(g) }
            }
        }
    }
}

private fun DIV.renderGameCardItem(g: Game) {
    div(classes = "game-card") {
        css {
            display = Display.flex
            justifyContent = JustifyContent.spaceBetween
            alignItems = Align.center
            padding = UiConstants.CARD_PADDING
            marginBottom = 0.px
        }
        div {
            div {
                css { fontWeight = FontWeight.bold }
                +"${g.awayTeam.city} ${g.awayTeam.name} @ ${g.homeTeam.city} ${g.homeTeam.name}"
            }
            div {
                css {
                    fontSize = UiConstants.FONT_SIZE_MEDIUM
                    color = Color("var(--text-secondary)")
                    marginTop = UiConstants.CARD_GAP_SMALL
                }
                +"Date: ${g.date} | Status: ${g.status}"
            }
        }
        renderGameCardAction(g)
    }
}

private fun DIV.renderGameCardAction(g: Game) {
    div {
        css { display = Display.flex; gap = UiConstants.CARD_GAP_SMALL; alignItems = Align.center }
        if (g.status == GameStatus.COMPLETED) {
            renderCompletedGameAction(g)
        } else {
            renderActiveGameAction(g)
        }
    }
}

private fun DIV.renderCompletedGameAction(g: Game) {
    span {
        css { fontWeight = FontWeight.bold; marginRight = UiConstants.CARD_GAP }
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
            currentTab = BaseballConstants.TAB_LIVE_SCORER
            updateActiveTabButtons()
            renderCurrentTab()
        }
    }
}

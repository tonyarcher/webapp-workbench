package com.baseball.ui

import com.baseball.BaseballConstants
import com.baseball.UiConstants
import com.baseball.api
import com.baseball.game.localGame
import com.baseball.game.localBoxScore
import com.baseball.game.localEvents
import com.baseball.models.*
import com.baseball.ui.components.renderScorebookView
import org.w3c.dom.*
import kotlinx.html.*
import kotlinx.html.js.*
import kotlinx.html.dom.*

internal fun renderBoxScoreTab(container: HTMLElement) {
    if (!isSingleGameMode && selectedGameId == null) {
        container.div(classes = "card") {
            style = "text-align: center; padding: 3rem;"
            p { +"No game selected." }
        }
        return
    }

    launch {
        val game: Game
        val boxScore: BoxScore
        val events: List<PlayEvent>

        if (isSingleGameMode) {
            game = localGame!!
            boxScore = localBoxScore!!
            events = localEvents
        } else {
            game = api.getGame(selectedGameId!!)
            boxScore = api.getGameBoxScore(selectedGameId!!)
            events = api.getGameEvents(selectedGameId!!)
        }

        container.h1 { +"Game Details - Box Score" }

        container.div(classes = "card") {
            h2 { +"${game.awayTeam.city} ${game.awayTeam.name} (${game.awayScore}) vs ${game.homeTeam.city} ${game.homeTeam.name} (${game.homeScore})" }
            p {
                +"Status: ${game.status.name} | Date: ${game.date}"
                style = "color: var(--text-secondary); margin-bottom: 1.5rem;"
            }
            button(classes = "btn btn-secondary") {
                +(if (isSingleGameMode) "Back to Live Scorer" else "Back to Season Dashboard")
                onClickFunction = {
                    currentTab = if (isSingleGameMode) BaseballConstants.TAB_LIVE_SCORER else BaseballConstants.TAB_GAMES
                    updateActiveTabButtons()
                    renderCurrentTab()
                }
            }
        }

        var btnScorebook: HTMLButtonElement? = null
        var btnTraditional: HTMLButtonElement? = null
        var contentContainer: HTMLDivElement? = null

        fun drawTraditionalView() {
            val contentEl = contentContainer ?: return
            contentEl.innerHTML = ""

            val lineScoreCard = contentEl.div(classes = "card") {
                h3 { +"Line Score" }
            }
            renderLineScoreTable(lineScoreCard, boxScore.lineScore, game)

            val grid = contentEl.div(classes = "dashboard-grid") {
                style = "margin-top: 1.5rem;"
            }

            val awayCard = grid.div(classes = "card") {
                h3 { +"${game.awayTeam.name} Batting" }
            }
            renderBattingTable(awayCard, boxScore.awayBatting)

            awayCard.h3 {
                +"${game.awayTeam.name} Pitching"
                style = "margin-top: 1.5rem;"
            }
            renderPitchingTable(awayCard, boxScore.awayPitching)

            val homeCard = grid.div(classes = "card") {
                h3 { +"${game.homeTeam.name} Batting" }
            }
            renderBattingTable(homeCard, boxScore.homeBatting)

            homeCard.h3 {
                +"${game.homeTeam.name} Pitching"
                style = "margin-top: 1.5rem;"
            }
            renderPitchingTable(homeCard, boxScore.homePitching)

            contentEl.div(classes = "card") {
                style = "margin-top: 1.5rem;"
                h3 { +"Game Log History" }
                div(classes = "event-log") {
                    style = "max-height: 350px;"
                    events.forEach { ev ->
                        div(classes = "log-item") {
                            span(classes = "log-desc") { +ev.description }
                            span(classes = "log-inning") { +"${ev.half.name.substring(0, 3)} ${ev.inning}" }
                        }
                    }
                }
            }
        }

        fun drawScorebookView() {
            val contentEl = contentContainer ?: return
            contentEl.innerHTML = ""
            renderScorebookView(contentEl, game, boxScore, events)
        }

        val buttonBar = container.div {
            style = "display: flex; gap: 0.5rem; margin-top: 1.5rem; margin-bottom: 1rem;"

            button(classes = "btn btn-primary") {
                id = "boxscore-btn-scorebook"
                +"Scorebook"
                onClickFunction = {
                    drawScorebookView()
                    btnScorebook?.classList?.add("btn-primary")
                    btnScorebook?.classList?.remove("btn-secondary")
                    btnTraditional?.classList?.add("btn-secondary")
                    btnTraditional?.classList?.remove("btn-primary")
                }
            }

            button(classes = "btn btn-secondary") {
                id = "boxscore-btn-traditional"
                +"Traditional Stats"
                onClickFunction = {
                    drawTraditionalView()
                    btnTraditional?.classList?.add("btn-primary")
                    btnTraditional?.classList?.remove("btn-secondary")
                    btnScorebook?.classList?.add("btn-secondary")
                    btnScorebook?.classList?.remove("btn-primary")
                }
            }
        }

        btnScorebook = buttonBar.querySelector("#boxscore-btn-scorebook") as? HTMLButtonElement
        btnTraditional = buttonBar.querySelector("#boxscore-btn-traditional") as? HTMLButtonElement

        contentContainer = container.div {
            id = "boxscore-content-view"
        }

        drawScorebookView()
    }
}

internal fun renderLineScoreTable(parent: HTMLElement, lineScore: LineScore, game: Game) {
    parent.div(classes = "table-container") {
        table(classes = "linescore-table") {
            thead {
                tr {
                    th { +"Team" }
                    val inningCount = lineScore.awayInningRuns.size
                    for (i in 1..inningCount) {
                        th { +i.toString() }
                    }
                    th(classes = "linescore-stat") { +"R" }
                    th(classes = "linescore-stat") { +"H" }
                    th(classes = "linescore-stat") { +"E" }
                }
            }
            tbody {
                tr {
                    td(classes = "linescore-team") { +game.awayTeam.name }
                    lineScore.awayInningRuns.forEach { runs ->
                        td { +(runs?.toString() ?: "-") }
                    }
                    td(classes = "linescore-stat") { +lineScore.awayRuns.toString() }
                    td(classes = "linescore-stat") { +lineScore.awayHits.toString() }
                    td(classes = "linescore-stat") { +lineScore.awayErrors.toString() }
                }
                tr {
                    td(classes = "linescore-team") { +game.homeTeam.name }
                    lineScore.homeInningRuns.forEach { runs ->
                        td { +(runs?.toString() ?: "-") }
                    }
                    td(classes = "linescore-stat") { +lineScore.homeRuns.toString() }
                    td(classes = "linescore-stat") { +lineScore.homeHits.toString() }
                    td(classes = "linescore-stat") { +lineScore.homeErrors.toString() }
                }
            }
        }
    }
}

internal fun renderBoxScoreTable(parent: HTMLElement, tabId: String, boxScore: BoxScore) {
    parent.innerHTML = ""
    when (tabId) {
        "away-batting" -> renderBattingTable(parent, boxScore.awayBatting)
        "away-pitching" -> renderPitchingTable(parent, boxScore.awayPitching)
        "home-batting" -> renderBattingTable(parent, boxScore.homeBatting)
        "home-pitching" -> renderPitchingTable(parent, boxScore.homePitching)
    }
}

internal fun renderBattingTable(parent: HTMLElement, list: List<PlayerBattingStats>) {
    parent.div(classes = "table-container") {
        table {
            thead {
                tr {
                    th { +"Player (Pos)" }
                    th { +"AB" }
                    th { +"R" }
                    th { +"H" }
                    th { +"RBI" }
                    th { +"BB" }
                    th { +"SO" }
                    th { +"HR" }
                }
            }
            tbody {
                if (list.isEmpty()) {
                    tr {
                        td {
                            colSpan = "8"
                            +"No batting stats recorded yet."
                            style = "color: var(--text-secondary); text-align: center;"
                        }
                    }
                } else {
                    list.forEach { s ->
                        tr {
                            td {
                                +"${s.playerName} (${s.position})"
                                style = "font-weight: bold;"
                            }
                            td { +s.atBats.toString() }
                            td { +s.runs.toString() }
                            td { +s.hits.toString() }
                            td { +s.rbi.toString() }
                            td { +s.walks.toString() }
                            td { +s.strikeOuts.toString() }
                            td { +s.homeRuns.toString() }
                        }
                    }
                }
            }
        }
    }
}

internal fun renderPitchingTable(parent: HTMLElement, list: List<PlayerPitchingStats>) {
    parent.div(classes = "table-container") {
        table {
            thead {
                tr {
                    th { +"Pitcher" }
                    th { +"IP" }
                    th { +"H" }
                    th { +"R" }
                    th { +"ER" }
                    th { +"BB" }
                    th { +"SO" }
                    th { +"HR" }
                }
            }
            tbody {
                if (list.isEmpty()) {
                    tr {
                        td {
                            colSpan = "8"
                            +"No pitching stats recorded yet."
                            style = "color: var(--text-secondary); text-align: center;"
                        }
                    }
                } else {
                    list.forEach { s ->
                        tr {
                            td {
                                +s.playerName
                                style = "font-weight: bold;"
                            }
                            val whole = s.inningsPitchedThirds / 3
                            val rem = s.inningsPitchedThirds % 3
                            val ipStr = "$whole.$rem"
                            td { +ipStr }
                            td { +s.hitsAllowed.toString() }
                            td { +s.runsAllowed.toString() }
                            td { +s.earnedRuns.toString() }
                            td { +s.walksAllowed.toString() }
                            td { +s.strikeoutsRecorded.toString() }
                            td { +s.homeRunsAllowed.toString() }
                        }
                    }
                }
            }
        }
    }
}

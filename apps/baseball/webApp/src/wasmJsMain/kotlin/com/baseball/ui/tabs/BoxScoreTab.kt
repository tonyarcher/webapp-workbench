package com.baseball.ui.tabs

import com.baseball.BaseballConstants
import com.baseball.api
import com.baseball.game.localBoxScore
import com.baseball.game.localEvents
import com.baseball.game.localGame
import com.baseball.models.*
import com.baseball.ui.*

import com.baseball.ui.components.scorebook.renderScorebookView
import kotlinx.css.*
import kotlinx.html.*
import kotlinx.html.js.onClickFunction
import org.w3c.dom.HTMLButtonElement
import org.w3c.dom.HTMLDivElement
import org.w3c.dom.HTMLElement

internal fun renderBoxScoreTab(container: HTMLElement) {
    if (!isSingleGameMode && selectedGameId == null) {
        renderNoGameSelected(container)
        return
    }

    launch {
        val (game, boxScore, events) = loadBoxScoreData()

        container.h1 { +"Game Details - Box Score" }
        renderBoxScoreHeaderCard(container, game)

        var btnScorebook: HTMLButtonElement? = null
        var btnTraditional: HTMLButtonElement? = null
        var contentContainer: HTMLDivElement? = null

        fun drawTraditionalView() {
            val contentEl = contentContainer ?: return
            contentEl.innerHTML = ""
            renderTraditionalBoxScoreView(contentEl, game, boxScore, events)
        }

        fun drawScorebookView() {
            val contentEl = contentContainer ?: return
            contentEl.innerHTML = ""
            renderScorebookView(contentEl, game, boxScore, events)
        }

        val buttonBar = renderBoxScoreToggleButtons(
            container = container,
            onScorebookClick = {
                drawScorebookView()
                btnScorebook?.classList?.add("btn-primary")
                btnScorebook?.classList?.remove("btn-secondary")
                btnTraditional?.classList?.add("btn-secondary")
                btnTraditional?.classList?.remove("btn-primary")
            },
            onTraditionalClick = {
                drawTraditionalView()
                btnTraditional?.classList?.add("btn-primary")
                btnTraditional?.classList?.remove("btn-secondary")
                btnScorebook?.classList?.add("btn-secondary")
                btnScorebook?.classList?.remove("btn-primary")
            }
        )

        btnScorebook = buttonBar.querySelector("#boxscore-btn-scorebook") as? HTMLButtonElement
        btnTraditional = buttonBar.querySelector("#boxscore-btn-traditional") as? HTMLButtonElement

        contentContainer = container.div {
            id = "boxscore-content-view"
        }

        drawScorebookView()
    }
}

private fun renderNoGameSelected(container: HTMLElement) {
    container.div(classes = "card") {
        css {
            textAlign = TextAlign.center
            padding = Padding(3.rem)
        }
        p { +"No game selected." }
    }
}

private suspend fun loadBoxScoreData(): Triple<Game, BoxScore, List<PlayEvent>> {
    return if (isSingleGameMode) {
        Triple(localGame!!, localBoxScore!!, localEvents)
    } else {
        val g = api.getGame(selectedGameId!!)
        val b = api.getGameBoxScore(selectedGameId!!)
        val e = api.getGameEvents(selectedGameId!!)
        Triple(g, b, e)
    }
}

private fun renderBoxScoreHeaderCard(container: HTMLElement, game: Game) {
    container.div(classes = "card") {
        h2 {
            +"${game.awayTeam.city} ${game.awayTeam.name} (${game.awayScore}) vs ${game.homeTeam.city} ${game.homeTeam.name} (${game.homeScore})"
        }
        p {
            +"Status: ${game.status.name} | Date: ${game.date}"
            css {
                color = Color("var(--text-secondary)")
                marginBottom = 1.5.rem
            }
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
}

private fun renderBoxScoreToggleButtons(
    container: HTMLElement,
    onScorebookClick: () -> Unit,
    onTraditionalClick: () -> Unit
): HTMLDivElement {
    return container.div {
        css {
            display = Display.flex
            gap = 0.5.rem
            marginTop = 1.5.rem
            marginBottom = 1.rem
        }

        button(classes = "btn btn-primary") {
            id = "boxscore-btn-scorebook"
            +"Scorebook"
            onClickFunction = { onScorebookClick() }
        }

        button(classes = "btn btn-secondary") {
            id = "boxscore-btn-traditional"
            +"Traditional Stats"
            onClickFunction = { onTraditionalClick() }
        }
    }
}

private fun renderTraditionalBoxScoreView(
    contentEl: HTMLDivElement,
    game: Game,
    boxScore: BoxScore,
    events: List<PlayEvent>
) {
    val lineScoreCard = contentEl.div(classes = "card") {
        h3 { +"Line Score" }
    }
    renderLineScoreTable(lineScoreCard, boxScore.lineScore, game)

    val grid = contentEl.div(classes = "dashboard-grid") {
        css {
            marginTop = 1.5.rem
        }
    }

    renderTeamTraditionalStats(grid, game.awayTeam.name, boxScore.awayBatting, boxScore.awayPitching)
    renderTeamTraditionalStats(grid, game.homeTeam.name, boxScore.homeBatting, boxScore.homePitching)

    renderGameLogCard(contentEl, events)
}

private fun renderTeamTraditionalStats(
    parent: HTMLDivElement,
    teamName: String,
    batting: List<PlayerBattingStats>,
    pitching: List<PlayerPitchingStats>
) {
    val card = parent.div(classes = "card") {
        h3 { +"$teamName Batting" }
    }
    renderBattingTable(card, batting)

    card.h3 {
        +"$teamName Pitching"
        css {
            marginTop = 1.5.rem
        }
    }
    renderPitchingTable(card, pitching)
}

private fun renderGameLogCard(contentEl: HTMLDivElement, events: List<PlayEvent>) {
    contentEl.div(classes = "card") {
        css {
            marginTop = 1.5.rem
        }
        h3 { +"Game Log History" }
        div(classes = "event-log") {
            css {
                maxHeight = 350.px
            }
            events.forEach { ev ->
                div(classes = "log-item") {
                    span(classes = "log-desc") { +ev.description }
                    span(classes = "log-inning") { +"${ev.half.name.substring(0, 3)} ${ev.inning}" }
                }
            }
        }
    }
}

internal fun renderLineScoreTable(
    parent: HTMLElement,
    lineScore: LineScore,
    game: Game,
) {
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
                renderLineScoreRow(game.awayTeam.name, lineScore.awayInningRuns, lineScore.awayRuns, lineScore.awayHits, lineScore.awayErrors)
                renderLineScoreRow(game.homeTeam.name, lineScore.homeInningRuns, lineScore.homeRuns, lineScore.homeHits, lineScore.homeErrors)
            }
        }
    }
}

private fun TBODY.renderLineScoreRow(
    teamName: String,
    inningRuns: List<Int?>,
    runs: Int,
    hits: Int,
    errors: Int
) {
    tr {
        td(classes = "linescore-team") { +teamName }
        inningRuns.forEach { r ->
            td { +(r?.toString() ?: "-") }
        }
        td(classes = "linescore-stat") { +runs.toString() }
        td(classes = "linescore-stat") { +hits.toString() }
        td(classes = "linescore-stat") { +errors.toString() }
    }
}

internal fun renderBattingTable(
    parent: HTMLElement,
    list: List<PlayerBattingStats>,
) {
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
                    renderEmptyTableMessage(8, "No batting stats recorded yet.")
                } else {
                    list.forEach { s -> renderBattingRow(s) }
                }
            }
        }
    }
}

private fun TBODY.renderBattingRow(s: PlayerBattingStats) {
    tr {
        td {
            +"${s.playerName} (${s.position})"
            css { fontWeight = FontWeight.bold }
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

internal fun renderPitchingTable(
    parent: HTMLElement,
    list: List<PlayerPitchingStats>,
) {
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
                    renderEmptyTableMessage(8, "No pitching stats recorded yet.")
                } else {
                    list.forEach { s -> renderPitchingRow(s) }
                }
            }
        }
    }
}

private fun TBODY.renderPitchingRow(s: PlayerPitchingStats) {
    tr {
        td {
            +s.playerName
            css { fontWeight = FontWeight.bold }
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

private fun TBODY.renderEmptyTableMessage(spanCount: Int, message: String) {
    tr {
        td {
            colSpan = spanCount.toString()
            +message
            css {
                color = Color("var(--text-secondary)")
                textAlign = TextAlign.center
            }
        }
    }
}

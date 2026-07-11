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

// BOX SCORE TAB (COMPLETED GAMES DETAIL)
internal fun renderBoxScoreTab(container: HTMLElement) {
    if (!isSingleGameMode && selectedGameId == null) {
        container.appendElement(UiConstants.Html.DIV, "card") {
            style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER)
            style.setProperty(UiConstants.Css.PADDING, "3rem")
            appendElement(UiConstants.Html.P) { textContent = "No game selected." }
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

        container.appendElement(UiConstants.Html.H1) { textContent = "Game Details - Box Score" }

        val mainCard = container.appendElement(UiConstants.Html.DIV, "card")
        mainCard.appendElement(UiConstants.Html.H2) {
            textContent = "${game.awayTeam.city} ${game.awayTeam.name} (${game.awayScore}) vs ${game.homeTeam.city} ${game.homeTeam.name} (${game.homeScore})"
        }
        mainCard.appendElement(UiConstants.Html.P) {
            textContent = "Status: ${game.status.name} | Date: ${game.date}"
            style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
            style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1.5rem")
        }

        mainCard.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
            textContent = if (isSingleGameMode) "Back to Live Scorer" else "Back to Season Dashboard"
            onClick {
                currentTab = if (isSingleGameMode) BaseballConstants.TAB_LIVE_SCORER else BaseballConstants.TAB_GAMES
                updateActiveTabButtons()
                renderCurrentTab()
            }
        }

        // Toggle buttons for Scorebook vs Traditional Stats
        val viewToggleRow = container.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
            style.setProperty(UiConstants.Css.GAP, "0.5rem")
            style.setProperty(UiConstants.Css.MARGIN_TOP, "1.5rem")
            style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
        }

        val contentContainer = container.appendElement(UiConstants.Html.DIV) {
            id = "boxscore-content-view"
        }

        fun drawTraditionalView() {
            contentContainer.innerHTML = ""
            // Line Score
            val lsSection = contentContainer.appendElement(UiConstants.Html.DIV, "card")
            lsSection.appendElement(UiConstants.Html.H3) { textContent = "Line Score" }
            renderLineScoreTable(lsSection, boxScore.lineScore, game)

            // Stats grid
            val statsGrid = contentContainer.appendElement(UiConstants.Html.DIV, "dashboard-grid") { style.setProperty(UiConstants.Css.MARGIN_TOP, "1.5rem") }
            
            val awayCard = statsGrid.appendElement(UiConstants.Html.DIV, "card")
            awayCard.appendElement(UiConstants.Html.H3) { textContent = "${game.awayTeam.name} Batting" }
            renderBattingTable(awayCard, boxScore.awayBatting)
            awayCard.appendElement(UiConstants.Html.H3) { textContent = "${game.awayTeam.name} Pitching"; style.setProperty(UiConstants.Css.MARGIN_TOP, "1.5rem") }
            renderPitchingTable(awayCard, boxScore.awayPitching)

            val homeCard = statsGrid.appendElement(UiConstants.Html.DIV, "card")
            homeCard.appendElement(UiConstants.Html.H3) { textContent = "${game.homeTeam.name} Batting" }
            renderBattingTable(homeCard, boxScore.homeBatting)
            homeCard.appendElement(UiConstants.Html.H3) { textContent = "${game.homeTeam.name} Pitching"; style.setProperty(UiConstants.Css.MARGIN_TOP, "1.5rem") }
            renderPitchingTable(homeCard, boxScore.homePitching)

            // Log history
            val logCard = contentContainer.appendElement(UiConstants.Html.DIV, "card") { style.setProperty(UiConstants.Css.MARGIN_TOP, "1.5rem") }
            logCard.appendElement(UiConstants.Html.H3) { textContent = "Game Log History" }
            val listLog = logCard.appendElement(UiConstants.Html.DIV, "event-log") {
                style.setProperty(UiConstants.Css.MAX_HEIGHT, "350px")
            }
            events.forEach { ev ->
                listLog.appendElement(UiConstants.Html.DIV, "log-item") {
                    appendElement(UiConstants.Html.SPAN, "log-desc") { textContent = ev.description }
                    appendElement(UiConstants.Html.SPAN, "log-inning") { textContent = "${ev.half.name.substring(0,3)} ${ev.inning}" }
                }
            }
        }

        fun drawScorebookView() {
            contentContainer.innerHTML = ""
            renderScorebookView(contentContainer, game, boxScore, events)
        }

        val btnScorebook = viewToggleRow.appendElement(UiConstants.Html.BUTTON, "btn") {
            textContent = "Visual Scorebook"
            onClick {
                drawScorebookView()
                classList.add("btn-primary")
                classList.remove("btn-secondary")
                val other = viewToggleRow.children.item(1) as? HTMLButtonElement
                other?.classList?.add("btn-secondary")
                other?.classList?.remove("btn-primary")
            }
        }
        btnScorebook.classList.add("btn-primary")

        val btnTraditional = viewToggleRow.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
            textContent = "Traditional Stats"
            onClick {
                drawTraditionalView()
                classList.add("btn-primary")
                classList.remove("btn-secondary")
                btnScorebook.classList.add("btn-secondary")
                btnScorebook.classList.remove("btn-primary")
            }
        }

        // Initial default view
        drawScorebookView()
    }
}

// Line Score Table Builder
internal fun renderLineScoreTable(parent: HTMLElement, lineScore: LineScore, game: Game) {
    val tableContainer = parent.appendElement(UiConstants.Html.DIV, "table-container")
    val table = tableContainer.appendElement(UiConstants.Html.TABLE, "linescore-table")
    
    // Header
    val thead = table.appendElement(UiConstants.Html.THEAD)
    val trh = thead.appendElement(UiConstants.Html.TR)
    trh.appendElement(UiConstants.Html.TH) { textContent = "Team" }
    
    val inningCount = lineScore.awayInningRuns.size
    for (i in 1..inningCount) {
        trh.appendElement(UiConstants.Html.TH) { textContent = i.toString() }
    }
    trh.appendElement(UiConstants.Html.TH, "linescore-stat") { textContent = "R" }
    trh.appendElement(UiConstants.Html.TH, "linescore-stat") { textContent = "H" }
    trh.appendElement(UiConstants.Html.TH, "linescore-stat") { textContent = "E" }

    val tbody = table.appendElement(UiConstants.Html.TBODY)
    
    // Away Row
    val tra = tbody.appendElement(UiConstants.Html.TR)
    tra.appendElement(UiConstants.Html.TD, "linescore-team") { textContent = game.awayTeam.name }
    lineScore.awayInningRuns.forEach { runs ->
        tra.appendElement(UiConstants.Html.TD) { textContent = runs?.toString() ?: "-" }
    }
    tra.appendElement(UiConstants.Html.TD, "linescore-stat") { textContent = lineScore.awayRuns.toString() }
    tra.appendElement(UiConstants.Html.TD, "linescore-stat") { textContent = lineScore.awayHits.toString() }
    tra.appendElement(UiConstants.Html.TD, "linescore-stat") { textContent = lineScore.awayErrors.toString() }

    // Home Row
    val trhRow = tbody.appendElement(UiConstants.Html.TR)
    trhRow.appendElement(UiConstants.Html.TD, "linescore-team") { textContent = game.homeTeam.name }
    lineScore.homeInningRuns.forEach { runs ->
        trhRow.appendElement(UiConstants.Html.TD) { textContent = runs?.toString() ?: "-" }
    }
    trhRow.appendElement(UiConstants.Html.TD, "linescore-stat") { textContent = lineScore.homeRuns.toString() }
    trhRow.appendElement(UiConstants.Html.TD, "linescore-stat") { textContent = lineScore.homeHits.toString() }
    trhRow.appendElement(UiConstants.Html.TD, "linescore-stat") { textContent = lineScore.homeErrors.toString() }
}

// Boxscore Stats Table Dispatcher
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
    val tableContainer = parent.appendElement(UiConstants.Html.DIV, "table-container")
    val table = tableContainer.appendElement(UiConstants.Html.TABLE)
    val thead = table.appendElement(UiConstants.Html.THEAD)
    val trh = thead.appendElement(UiConstants.Html.TR)
    trh.appendElement(UiConstants.Html.TH) { textContent = "Player (Pos)" }
    trh.appendElement(UiConstants.Html.TH) { textContent = "AB" }
    trh.appendElement(UiConstants.Html.TH) { textContent = "R" }
    trh.appendElement(UiConstants.Html.TH) { textContent = "H" }
    trh.appendElement(UiConstants.Html.TH) { textContent = "RBI" }
    trh.appendElement(UiConstants.Html.TH) { textContent = "BB" }
    trh.appendElement(UiConstants.Html.TH) { textContent = "SO" }
    trh.appendElement(UiConstants.Html.TH) { textContent = "HR" }

    val tbody = table.appendElement(UiConstants.Html.TBODY)
    if (list.isEmpty()) {
        val trd = tbody.appendElement(UiConstants.Html.TR)
        trd.appendElement(UiConstants.Html.TD) { 
            setAttribute("colspan", "8")
            textContent = "No batting stats recorded yet."
            style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
            style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER)
        }
    } else {
        list.forEach { s ->
            val trd = tbody.appendElement(UiConstants.Html.TR)
            trd.appendElement(UiConstants.Html.TD) { textContent = "${s.playerName} (${s.position})"; style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD) }
            trd.appendElement(UiConstants.Html.TD) { textContent = s.atBats.toString() }
            trd.appendElement(UiConstants.Html.TD) { textContent = s.runs.toString() }
            trd.appendElement(UiConstants.Html.TD) { textContent = s.hits.toString() }
            trd.appendElement(UiConstants.Html.TD) { textContent = s.rbi.toString() }
            trd.appendElement(UiConstants.Html.TD) { textContent = s.walks.toString() }
            trd.appendElement(UiConstants.Html.TD) { textContent = s.strikeOuts.toString() }
            trd.appendElement(UiConstants.Html.TD) { textContent = s.homeRuns.toString() }
        }
    }
}

internal fun renderPitchingTable(parent: HTMLElement, list: List<PlayerPitchingStats>) {
    val tableContainer = parent.appendElement(UiConstants.Html.DIV, "table-container")
    val table = tableContainer.appendElement(UiConstants.Html.TABLE)
    val thead = table.appendElement(UiConstants.Html.THEAD)
    val trh = thead.appendElement(UiConstants.Html.TR)
    trh.appendElement(UiConstants.Html.TH) { textContent = "Pitcher" }
    trh.appendElement(UiConstants.Html.TH) { textContent = "IP" }
    trh.appendElement(UiConstants.Html.TH) { textContent = "H" }
    trh.appendElement(UiConstants.Html.TH) { textContent = "R" }
    trh.appendElement(UiConstants.Html.TH) { textContent = "ER" }
    trh.appendElement(UiConstants.Html.TH) { textContent = "BB" }
    trh.appendElement(UiConstants.Html.TH) { textContent = "SO" }
    trh.appendElement(UiConstants.Html.TH) { textContent = "HR" }

    val tbody = table.appendElement(UiConstants.Html.TBODY)
    if (list.isEmpty()) {
        val trd = tbody.appendElement(UiConstants.Html.TR)
        trd.appendElement(UiConstants.Html.TD) { 
            setAttribute("colspan", "8")
            textContent = "No pitching stats recorded yet."
            style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
            style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER)
        }
    } else {
        list.forEach { s ->
            val trd = tbody.appendElement(UiConstants.Html.TR)
            trd.appendElement(UiConstants.Html.TD) { textContent = s.playerName; style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD) }
            
            val whole = s.inningsPitchedThirds / 3
            val rem = s.inningsPitchedThirds % 3
            val ipStr = "$whole.$rem"
            
            trd.appendElement(UiConstants.Html.TD) { textContent = ipStr }
            trd.appendElement(UiConstants.Html.TD) { textContent = s.hitsAllowed.toString() }
            trd.appendElement(UiConstants.Html.TD) { textContent = s.runsAllowed.toString() }
            trd.appendElement(UiConstants.Html.TD) { textContent = s.earnedRuns.toString() }
            trd.appendElement(UiConstants.Html.TD) { textContent = s.walksAllowed.toString() }
            trd.appendElement(UiConstants.Html.TD) { textContent = s.strikeoutsRecorded.toString() }
            trd.appendElement(UiConstants.Html.TD) { textContent = s.homeRunsAllowed.toString() }
        }
    }
}

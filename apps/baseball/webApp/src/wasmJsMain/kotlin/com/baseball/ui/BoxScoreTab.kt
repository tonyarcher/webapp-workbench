package com.baseball.ui

import com.baseball.api
import com.baseball.game.localGame
import com.baseball.game.localBoxScore
import com.baseball.game.localEvents
import com.baseball.models.*
import com.baseball.Constants
import com.baseball.ui.components.renderScorebookView
import org.w3c.dom.*

// BOX SCORE TAB (COMPLETED GAMES DETAIL)
internal fun renderBoxScoreTab(container: HTMLElement) {
    if (!isSingleGameMode && selectedGameId == null) {
        container.appendElement(Constants.Html.DIV, "card") {
            style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER)
            style.setProperty(Constants.Css.PADDING, "3rem")
            appendElement(Constants.Html.P) { textContent = "No game selected." }
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

        container.appendElement(Constants.Html.H1) { textContent = "Game Details - Box Score" }

        val mainCard = container.appendElement(Constants.Html.DIV, "card")
        mainCard.appendElement(Constants.Html.H2) {
            textContent = "${game.awayTeam.city} ${game.awayTeam.name} (${game.awayScore}) vs ${game.homeTeam.city} ${game.homeTeam.name} (${game.homeScore})"
        }
        mainCard.appendElement(Constants.Html.P) {
            textContent = "Status: ${game.status.name} | Date: ${game.date}"
            style.setProperty(Constants.Css.COLOR, "var(--text-secondary)")
            style.setProperty(Constants.Css.MARGIN_BOTTOM, "1.5rem")
        }

        mainCard.appendElement(Constants.Html.BUTTON, "btn btn-secondary") {
            textContent = if (isSingleGameMode) "Back to Live Scorer" else "Back to Season Dashboard"
            onClick {
                currentTab = if (isSingleGameMode) Constants.TAB_LIVE_SCORER else Constants.TAB_GAMES
                updateActiveTabButtons()
                renderCurrentTab()
            }
        }

        // Toggle buttons for Scorebook vs Traditional Stats
        val viewToggleRow = container.appendElement(Constants.Html.DIV) {
            style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.FLEX)
            style.setProperty(Constants.Css.GAP, "0.5rem")
            style.setProperty(Constants.Css.MARGIN_TOP, "1.5rem")
            style.setProperty(Constants.Css.MARGIN_BOTTOM, "1rem")
        }

        val contentContainer = container.appendElement(Constants.Html.DIV) {
            id = "boxscore-content-view"
        }

        fun drawTraditionalView() {
            contentContainer.innerHTML = ""
            // Line Score
            val lsSection = contentContainer.appendElement(Constants.Html.DIV, "card")
            lsSection.appendElement(Constants.Html.H3) { textContent = "Line Score" }
            renderLineScoreTable(lsSection, boxScore.lineScore, game)

            // Stats grid
            val statsGrid = contentContainer.appendElement(Constants.Html.DIV, "dashboard-grid") { style.setProperty(Constants.Css.MARGIN_TOP, "1.5rem") }
            
            val awayCard = statsGrid.appendElement(Constants.Html.DIV, "card")
            awayCard.appendElement(Constants.Html.H3) { textContent = "${game.awayTeam.name} Batting" }
            renderBattingTable(awayCard, boxScore.awayBatting)
            awayCard.appendElement(Constants.Html.H3) { textContent = "${game.awayTeam.name} Pitching"; style.setProperty(Constants.Css.MARGIN_TOP, "1.5rem") }
            renderPitchingTable(awayCard, boxScore.awayPitching)

            val homeCard = statsGrid.appendElement(Constants.Html.DIV, "card")
            homeCard.appendElement(Constants.Html.H3) { textContent = "${game.homeTeam.name} Batting" }
            renderBattingTable(homeCard, boxScore.homeBatting)
            homeCard.appendElement(Constants.Html.H3) { textContent = "${game.homeTeam.name} Pitching"; style.setProperty(Constants.Css.MARGIN_TOP, "1.5rem") }
            renderPitchingTable(homeCard, boxScore.homePitching)

            // Log history
            val logCard = contentContainer.appendElement(Constants.Html.DIV, "card") { style.setProperty(Constants.Css.MARGIN_TOP, "1.5rem") }
            logCard.appendElement(Constants.Html.H3) { textContent = "Game Log History" }
            val listLog = logCard.appendElement(Constants.Html.DIV, "event-log") {
                style.setProperty(Constants.Css.MAX_HEIGHT, "350px")
            }
            events.forEach { ev ->
                listLog.appendElement(Constants.Html.DIV, "log-item") {
                    appendElement(Constants.Html.SPAN, "log-desc") { textContent = ev.description }
                    appendElement(Constants.Html.SPAN, "log-inning") { textContent = "${ev.half.name.substring(0,3)} ${ev.inning}" }
                }
            }
        }

        fun drawScorebookView() {
            contentContainer.innerHTML = ""
            renderScorebookView(contentContainer, game, boxScore, events)
        }

        val btnScorebook = viewToggleRow.appendElement(Constants.Html.BUTTON, "btn") {
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

        val btnTraditional = viewToggleRow.appendElement(Constants.Html.BUTTON, "btn btn-secondary") {
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
    val tableContainer = parent.appendElement(Constants.Html.DIV, "table-container")
    val table = tableContainer.appendElement(Constants.Html.TABLE, "linescore-table")
    
    // Header
    val thead = table.appendElement(Constants.Html.THEAD)
    val trh = thead.appendElement(Constants.Html.TR)
    trh.appendElement(Constants.Html.TH) { textContent = "Team" }
    
    val inningCount = lineScore.awayInningRuns.size
    for (i in 1..inningCount) {
        trh.appendElement(Constants.Html.TH) { textContent = i.toString() }
    }
    trh.appendElement(Constants.Html.TH, "linescore-stat") { textContent = "R" }
    trh.appendElement(Constants.Html.TH, "linescore-stat") { textContent = "H" }
    trh.appendElement(Constants.Html.TH, "linescore-stat") { textContent = "E" }

    val tbody = table.appendElement(Constants.Html.TBODY)
    
    // Away Row
    val tra = tbody.appendElement(Constants.Html.TR)
    tra.appendElement(Constants.Html.TD, "linescore-team") { textContent = game.awayTeam.name }
    lineScore.awayInningRuns.forEach { runs ->
        tra.appendElement(Constants.Html.TD) { textContent = runs?.toString() ?: "-" }
    }
    tra.appendElement(Constants.Html.TD, "linescore-stat") { textContent = lineScore.awayRuns.toString() }
    tra.appendElement(Constants.Html.TD, "linescore-stat") { textContent = lineScore.awayHits.toString() }
    tra.appendElement(Constants.Html.TD, "linescore-stat") { textContent = lineScore.awayErrors.toString() }

    // Home Row
    val trhRow = tbody.appendElement(Constants.Html.TR)
    trhRow.appendElement(Constants.Html.TD, "linescore-team") { textContent = game.homeTeam.name }
    lineScore.homeInningRuns.forEach { runs ->
        trhRow.appendElement(Constants.Html.TD) { textContent = runs?.toString() ?: "-" }
    }
    trhRow.appendElement(Constants.Html.TD, "linescore-stat") { textContent = lineScore.homeRuns.toString() }
    trhRow.appendElement(Constants.Html.TD, "linescore-stat") { textContent = lineScore.homeHits.toString() }
    trhRow.appendElement(Constants.Html.TD, "linescore-stat") { textContent = lineScore.homeErrors.toString() }
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
    val tableContainer = parent.appendElement(Constants.Html.DIV, "table-container")
    val table = tableContainer.appendElement(Constants.Html.TABLE)
    val thead = table.appendElement(Constants.Html.THEAD)
    val trh = thead.appendElement(Constants.Html.TR)
    trh.appendElement(Constants.Html.TH) { textContent = "Player (Pos)" }
    trh.appendElement(Constants.Html.TH) { textContent = "AB" }
    trh.appendElement(Constants.Html.TH) { textContent = "R" }
    trh.appendElement(Constants.Html.TH) { textContent = "H" }
    trh.appendElement(Constants.Html.TH) { textContent = "RBI" }
    trh.appendElement(Constants.Html.TH) { textContent = "BB" }
    trh.appendElement(Constants.Html.TH) { textContent = "SO" }
    trh.appendElement(Constants.Html.TH) { textContent = "HR" }

    val tbody = table.appendElement(Constants.Html.TBODY)
    if (list.isEmpty()) {
        val trd = tbody.appendElement(Constants.Html.TR)
        trd.appendElement(Constants.Html.TD) { 
            setAttribute("colspan", "8")
            textContent = "No batting stats recorded yet."
            style.setProperty(Constants.Css.COLOR, "var(--text-secondary)")
            style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER)
        }
    } else {
        list.forEach { s ->
            val trd = tbody.appendElement(Constants.Html.TR)
            trd.appendElement(Constants.Html.TD) { textContent = "${s.playerName} (${s.position})"; style.setProperty(Constants.Css.FONT_WEIGHT, Constants.CssValues.BOLD) }
            trd.appendElement(Constants.Html.TD) { textContent = s.atBats.toString() }
            trd.appendElement(Constants.Html.TD) { textContent = s.runs.toString() }
            trd.appendElement(Constants.Html.TD) { textContent = s.hits.toString() }
            trd.appendElement(Constants.Html.TD) { textContent = s.rbi.toString() }
            trd.appendElement(Constants.Html.TD) { textContent = s.walks.toString() }
            trd.appendElement(Constants.Html.TD) { textContent = s.strikeOuts.toString() }
            trd.appendElement(Constants.Html.TD) { textContent = s.homeRuns.toString() }
        }
    }
}

internal fun renderPitchingTable(parent: HTMLElement, list: List<PlayerPitchingStats>) {
    val tableContainer = parent.appendElement(Constants.Html.DIV, "table-container")
    val table = tableContainer.appendElement(Constants.Html.TABLE)
    val thead = table.appendElement(Constants.Html.THEAD)
    val trh = thead.appendElement(Constants.Html.TR)
    trh.appendElement(Constants.Html.TH) { textContent = "Pitcher" }
    trh.appendElement(Constants.Html.TH) { textContent = "IP" }
    trh.appendElement(Constants.Html.TH) { textContent = "H" }
    trh.appendElement(Constants.Html.TH) { textContent = "R" }
    trh.appendElement(Constants.Html.TH) { textContent = "ER" }
    trh.appendElement(Constants.Html.TH) { textContent = "BB" }
    trh.appendElement(Constants.Html.TH) { textContent = "SO" }
    trh.appendElement(Constants.Html.TH) { textContent = "HR" }

    val tbody = table.appendElement(Constants.Html.TBODY)
    if (list.isEmpty()) {
        val trd = tbody.appendElement(Constants.Html.TR)
        trd.appendElement(Constants.Html.TD) { 
            setAttribute("colspan", "8")
            textContent = "No pitching stats recorded yet."
            style.setProperty(Constants.Css.COLOR, "var(--text-secondary)")
            style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER)
        }
    } else {
        list.forEach { s ->
            val trd = tbody.appendElement(Constants.Html.TR)
            trd.appendElement(Constants.Html.TD) { textContent = s.playerName; style.setProperty(Constants.Css.FONT_WEIGHT, Constants.CssValues.BOLD) }
            
            val whole = s.inningsPitchedThirds / 3
            val rem = s.inningsPitchedThirds % 3
            val ipStr = "$whole.$rem"
            
            trd.appendElement(Constants.Html.TD) { textContent = ipStr }
            trd.appendElement(Constants.Html.TD) { textContent = s.hitsAllowed.toString() }
            trd.appendElement(Constants.Html.TD) { textContent = s.runsAllowed.toString() }
            trd.appendElement(Constants.Html.TD) { textContent = s.earnedRuns.toString() }
            trd.appendElement(Constants.Html.TD) { textContent = s.walksAllowed.toString() }
            trd.appendElement(Constants.Html.TD) { textContent = s.strikeoutsRecorded.toString() }
            trd.appendElement(Constants.Html.TD) { textContent = s.homeRunsAllowed.toString() }
        }
    }
}

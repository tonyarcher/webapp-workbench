package com.baseball.ui

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
        container.appendElement("div", "card") {
            style.setProperty("text-align", "center")
            style.setProperty("padding", "3rem")
            appendElement("p") { textContent = "No game selected." }
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

        container.appendElement("h1") { textContent = "Game Details - Box Score" }

        val mainCard = container.appendElement("div", "card")
        mainCard.appendElement("h2") {
            textContent = "${game.awayTeam.city} ${game.awayTeam.name} (${game.awayScore}) vs ${game.homeTeam.city} ${game.homeTeam.name} (${game.homeScore})"
        }
        mainCard.appendElement("p") {
            textContent = "Status: ${game.status.name} | Date: ${game.date}"
            style.setProperty("color", "var(--text-secondary)")
            style.setProperty("margin-bottom", "1.5rem")
        }

        mainCard.appendElement("button", "btn btn-secondary") {
            textContent = if (isSingleGameMode) "Back to Live Scorer" else "Back to Season Dashboard"
            onClick {
                currentTab = if (isSingleGameMode) "live-scorer" else "games"
                updateActiveTabButtons()
                renderCurrentTab()
            }
        }

        // Toggle buttons for Scorebook vs Traditional Stats
        val viewToggleRow = container.appendElement("div") {
            style.setProperty("display", "flex")
            style.setProperty("gap", "0.5rem")
            style.setProperty("margin-top", "1.5rem")
            style.setProperty("margin-bottom", "1rem")
        }

        val contentContainer = container.appendElement("div") {
            id = "boxscore-content-view"
        }

        fun drawTraditionalView() {
            contentContainer.innerHTML = ""
            // Line Score
            val lsSection = contentContainer.appendElement("div", "card")
            lsSection.appendElement("h3") { textContent = "Line Score" }
            renderLineScoreTable(lsSection, boxScore.lineScore, game)

            // Stats grid
            val statsGrid = contentContainer.appendElement("div", "dashboard-grid") { style.setProperty("margin-top", "1.5rem") }
            
            val awayCard = statsGrid.appendElement("div", "card")
            awayCard.appendElement("h3") { textContent = "${game.awayTeam.name} Batting" }
            renderBattingTable(awayCard, boxScore.awayBatting)
            awayCard.appendElement("h3") { textContent = "${game.awayTeam.name} Pitching"; style.setProperty("margin-top", "1.5rem") }
            renderPitchingTable(awayCard, boxScore.awayPitching)

            val homeCard = statsGrid.appendElement("div", "card")
            homeCard.appendElement("h3") { textContent = "${game.homeTeam.name} Batting" }
            renderBattingTable(homeCard, boxScore.homeBatting)
            homeCard.appendElement("h3") { textContent = "${game.homeTeam.name} Pitching"; style.setProperty("margin-top", "1.5rem") }
            renderPitchingTable(homeCard, boxScore.homePitching)

            // Log history
            val logCard = contentContainer.appendElement("div", "card") { style.setProperty("margin-top", "1.5rem") }
            logCard.appendElement("h3") { textContent = "Game Log History" }
            val listLog = logCard.appendElement("div", "event-log") {
                style.setProperty("max-height", "350px")
            }
            events.forEach { ev ->
                listLog.appendElement("div", "log-item") {
                    appendElement("span", "log-desc") { textContent = ev.description }
                    appendElement("span", "log-inning") { textContent = "${ev.half.name.substring(0,3)} ${ev.inning}" }
                }
            }
        }

        fun drawScorebookView() {
            contentContainer.innerHTML = ""
            renderScorebookView(contentContainer, game, boxScore, events)
        }

        val btnScorebook = viewToggleRow.appendElement("button", "btn") {
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

        val btnTraditional = viewToggleRow.appendElement("button", "btn btn-secondary") {
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
    val tableContainer = parent.appendElement("div", "table-container")
    val table = tableContainer.appendElement("table", "linescore-table")
    
    // Header
    val thead = table.appendElement("thead")
    val trh = thead.appendElement("tr")
    trh.appendElement("th") { textContent = "Team" }
    
    val inningCount = lineScore.awayInningRuns.size
    for (i in 1..inningCount) {
        trh.appendElement("th") { textContent = i.toString() }
    }
    trh.appendElement("th", "linescore-stat") { textContent = "R" }
    trh.appendElement("th", "linescore-stat") { textContent = "H" }
    trh.appendElement("th", "linescore-stat") { textContent = "E" }

    val tbody = table.appendElement("tbody")
    
    // Away Row
    val tra = tbody.appendElement("tr")
    tra.appendElement("td", "linescore-team") { textContent = game.awayTeam.name }
    lineScore.awayInningRuns.forEach { runs ->
        tra.appendElement("td") { textContent = runs?.toString() ?: "-" }
    }
    tra.appendElement("td", "linescore-stat") { textContent = lineScore.awayRuns.toString() }
    tra.appendElement("td", "linescore-stat") { textContent = lineScore.awayHits.toString() }
    tra.appendElement("td", "linescore-stat") { textContent = lineScore.awayErrors.toString() }

    // Home Row
    val trhRow = tbody.appendElement("tr")
    trhRow.appendElement("td", "linescore-team") { textContent = game.homeTeam.name }
    lineScore.homeInningRuns.forEach { runs ->
        trhRow.appendElement("td") { textContent = runs?.toString() ?: "-" }
    }
    trhRow.appendElement("td", "linescore-stat") { textContent = lineScore.homeRuns.toString() }
    trhRow.appendElement("td", "linescore-stat") { textContent = lineScore.homeHits.toString() }
    trhRow.appendElement("td", "linescore-stat") { textContent = lineScore.homeErrors.toString() }
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
    val tableContainer = parent.appendElement("div", "table-container")
    val table = tableContainer.appendElement("table")
    val thead = table.appendElement("thead")
    val trh = thead.appendElement("tr")
    trh.appendElement("th") { textContent = "Player (Pos)" }
    trh.appendElement("th") { textContent = "AB" }
    trh.appendElement("th") { textContent = "R" }
    trh.appendElement("th") { textContent = "H" }
    trh.appendElement("th") { textContent = "RBI" }
    trh.appendElement("th") { textContent = "BB" }
    trh.appendElement("th") { textContent = "SO" }
    trh.appendElement("th") { textContent = "HR" }

    val tbody = table.appendElement("tbody")
    if (list.isEmpty()) {
        val trd = tbody.appendElement("tr")
        trd.appendElement("td") { 
            setAttribute("colspan", "8")
            textContent = "No batting stats recorded yet."
            style.setProperty("color", "var(--text-secondary)")
            style.setProperty("text-align", "center")
        }
    } else {
        list.forEach { s ->
            val trd = tbody.appendElement("tr")
            trd.appendElement("td") { textContent = "${s.playerName} (${s.position})"; style.setProperty("font-weight", "700") }
            trd.appendElement("td") { textContent = s.atBats.toString() }
            trd.appendElement("td") { textContent = s.runs.toString() }
            trd.appendElement("td") { textContent = s.hits.toString() }
            trd.appendElement("td") { textContent = s.rbi.toString() }
            trd.appendElement("td") { textContent = s.walks.toString() }
            trd.appendElement("td") { textContent = s.strikeOuts.toString() }
            trd.appendElement("td") { textContent = s.homeRuns.toString() }
        }
    }
}

internal fun renderPitchingTable(parent: HTMLElement, list: List<PlayerPitchingStats>) {
    val tableContainer = parent.appendElement("div", "table-container")
    val table = tableContainer.appendElement("table")
    val thead = table.appendElement("thead")
    val trh = thead.appendElement("tr")
    trh.appendElement("th") { textContent = "Pitcher" }
    trh.appendElement("th") { textContent = "IP" }
    trh.appendElement("th") { textContent = "H" }
    trh.appendElement("th") { textContent = "R" }
    trh.appendElement("th") { textContent = "ER" }
    trh.appendElement("th") { textContent = "BB" }
    trh.appendElement("th") { textContent = "SO" }
    trh.appendElement("th") { textContent = "HR" }

    val tbody = table.appendElement("tbody")
    if (list.isEmpty()) {
        val trd = tbody.appendElement("tr")
        trd.appendElement("td") { 
            setAttribute("colspan", "8")
            textContent = "No pitching stats recorded yet."
            style.setProperty("color", "var(--text-secondary)")
            style.setProperty("text-align", "center")
        }
    } else {
        list.forEach { s ->
            val trd = tbody.appendElement("tr")
            trd.appendElement("td") { textContent = s.playerName; style.setProperty("font-weight", "700") }
            
            val whole = s.inningsPitchedThirds / 3
            val rem = s.inningsPitchedThirds % 3
            val ipStr = "$whole.$rem"
            
            trd.appendElement("td") { textContent = ipStr }
            trd.appendElement("td") { textContent = s.hitsAllowed.toString() }
            trd.appendElement("td") { textContent = s.runsAllowed.toString() }
            trd.appendElement("td") { textContent = s.earnedRuns.toString() }
            trd.appendElement("td") { textContent = s.walksAllowed.toString() }
            trd.appendElement("td") { textContent = s.strikeoutsRecorded.toString() }
            trd.appendElement("td") { textContent = s.homeRunsAllowed.toString() }
        }
    }
}

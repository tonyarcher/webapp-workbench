package com.baseball.ui

import com.baseball.api
import com.baseball.game.*
import com.baseball.models.*
import com.baseball.ui.components.*
import org.w3c.dom.*
import kotlinx.browser.document
import kotlinx.browser.window

// Sub batting swap handler
internal fun substituteBatter(isHome: Boolean, lineupIndex: Int, newPlayerId: Long) {
    val lineup = if (isHome) localHomeLineup else localAwayLineup
    val bench = if (isHome) localHomeBench else localAwayBench
    val oldPlayer = lineup[lineupIndex]
    val newPlayer = bench.find { it.id == newPlayerId } ?: return

    // Swap
    lineup[lineupIndex] = newPlayer
    bench.remove(newPlayer)
    localPlayersSubbedOut.add(oldPlayer.id!!)

    // If it's the current batter slot, update game state
    val game = localGame ?: return
    val currentHalf = game.gameState.half
    val isCurrentBatterHome = currentHalf == HalfInning.BOTTOM
    if (isHome == isCurrentBatterHome && (if (isHome) localHomeBatterIndex else localAwayBatterIndex) == lineupIndex) {
        localGame = game.copy(
            gameState = game.gameState.copy(
                currentBatterId = newPlayer.id,
                currentBatterName = newPlayer.name
            )
        )
    }
    saveLocalState()
}

// Sub pitching swap handler
internal fun substitutePitcher(isHome: Boolean, newPitcherId: Long) {
    val bench = if (isHome) localHomeBench else localAwayBench
    val newPitcher = bench.find { it.id == newPitcherId } ?: return
    val oldPitcherId = if (isHome) localHomeActivePitcherId else localAwayActivePitcherId

    // Swap
    bench.remove(newPitcher)
    localPlayersSubbedOut.add(oldPitcherId)
    
    if (isHome) {
        localHomeActivePitcherId = newPitcher.id!!
        localHomeActivePitcherName = newPitcher.name
    } else {
        localAwayActivePitcherId = newPitcher.id!!
        localAwayActivePitcherName = newPitcher.name
    }

    val game = localGame ?: return
    val currentHalf = game.gameState.half
    val isHomePitching = currentHalf == HalfInning.TOP
    if (isHome == isHomePitching) {
        localGame = game.copy(
            gameState = game.gameState.copy(
                currentPitcherId = newPitcher.id,
                currentPitcherName = newPitcher.name
            )
        )
    }
    saveLocalState()
}

// LIVE SCORER TAB
internal fun renderLiveScorerTab(container: HTMLElement) {
    if (!isSingleGameMode && selectedGameId == null) {
        container.appendElement("div", "card") {
            style.setProperty("text-align", "center")
            style.setProperty("padding", "3rem")
            appendElement("p") { textContent = "No game selected. Go to Season Dashboard to select one." }
        }
        return
    }

    launch {
        val game: Game
        val events: List<PlayEvent>
        val boxScore: BoxScore
        val homeRoster: List<Player>
        val awayRoster: List<Player>

        if (isSingleGameMode) {
            game = localGame!!
            events = localEvents
            boxScore = localBoxScore!!
            homeRoster = localHomeRoster
            awayRoster = localAwayRoster
        } else {
            game = api.getGame(selectedGameId!!)
            events = api.getGameEvents(selectedGameId!!)
            boxScore = api.getGameBoxScore(selectedGameId!!)
            homeRoster = api.getTeamRoster(game.homeTeam.id!!)
            awayRoster = api.getTeamRoster(game.awayTeam.id!!)

            // Bootstrap client-side lineups for remote game
            if (localAwayLineup.isEmpty()) {
                localAwayLineup.addAll(awayRoster.filter { it.position != "P" }.take(9))
                localAwayBench.addAll(awayRoster.filter { it.position == "P" && it.id != game.gameState.currentPitcherId } + awayRoster.drop(10))
                localAwayActivePitcherId = game.gameState.currentPitcherId ?: awayRoster.find { it.position == "P" }?.id ?: 210L
                localAwayActivePitcherName = game.gameState.currentPitcherName ?: awayRoster.find { it.position == "P" }?.name ?: "Sonny Gray"
                localAwayBatterIndex = localAwayLineup.indexOfFirst { it.id == game.gameState.currentBatterId }.coerceAtLeast(0)
            }
            if (localHomeLineup.isEmpty()) {
                localHomeLineup.addAll(homeRoster.filter { it.position != "P" }.take(9))
                localHomeBench.addAll(homeRoster.filter { it.position == "P" && it.id != game.gameState.currentPitcherId } + homeRoster.drop(10))
                localHomeActivePitcherId = game.gameState.currentPitcherId ?: homeRoster.find { it.position == "P" }?.id ?: 110L
                localHomeActivePitcherName = game.gameState.currentPitcherName ?: homeRoster.find { it.position == "P" }?.name ?: "Justin Steele"
                localHomeBatterIndex = localHomeLineup.indexOfFirst { it.id == game.gameState.currentBatterId }.coerceAtLeast(0)
            }
        }

        val titleRow = container.appendElement("div") {
            style.setProperty("display", "flex")
            style.setProperty("justify-content", "space-between")
            style.setProperty("align-items", "center")
            style.setProperty("margin-bottom", "1rem")
        }
        titleRow.appendElement("h1") {
            textContent = "Live Scoring: ${game.awayTeam.city} @ ${game.homeTeam.city}"
            style.setProperty("margin-bottom", "0")
        }
        if (isSingleGameMode) {
            titleRow.appendElement("button", "btn btn-danger") {
                textContent = "Reset / New Game"
                style.setProperty("padding", "0.5rem 1rem")
                onClick {
                    if (window.confirm("Are you sure you want to reset and start a new game? All current statistics and events will be lost.")) {
                        initLocalGame(forceReset = true)
                        renderCurrentTab()
                    }
                }
            }
        }

        val topGrid = container.appendElement("div", "scorekeeper-grid")

        // 1. Digital LED Scoreboard
        val leftCol = topGrid.appendElement("div", "scoreboard-led")
        renderScorerLedScoreboard(leftCol, game)

        // 2. Play Actions & Lineup Selector
        val rightCol = topGrid.appendElement("div", "card")
        renderGameScoringControls(rightCol, game, homeRoster, awayRoster, boxScore)

        // 3. Play Monitoring Tabs (Play-by-play vs Visual Scorebook)
        val monitoringCard = container.appendElement("div", "card") { style.setProperty("margin-top", "2rem") }
        val monitoringHeader = monitoringCard.appendElement("div") {
            style.setProperty("display", "flex")
            style.setProperty("justify-content", "space-between")
            style.setProperty("align-items", "center")
            style.setProperty("border-bottom", "1px solid rgba(255, 255, 255, 0.1)")
            style.setProperty("padding-bottom", "0.5rem")
            style.setProperty("margin-bottom", "1rem")
        }

        monitoringHeader.appendElement("h2") {
            textContent = "Live Game Monitoring"
            style.setProperty("margin", "0")
        }

        val toggleGroup = monitoringHeader.appendElement("div") {
            style.setProperty("display", "flex")
            style.setProperty("gap", "0.5rem")
        }

        val monitorContent = monitoringCard.appendElement("div")

        fun showLog() {
            monitorContent.innerHTML = ""
            val logDiv = monitorContent.appendElement("div", "event-log")
            if (events.isEmpty()) {
                logDiv.appendElement("div") { textContent = "No events logged for this game yet." }
            } else {
                events.forEachIndexed { index, ev ->
                    val player = (homeRoster + awayRoster).find { it.name == ev.batterName }
                    val position = player?.position ?: "DH"
                    
                    val endedInning = if (index + 1 < events.size) {
                        events[index + 1].half != ev.half || events[index + 1].inning != ev.inning
                    } else {
                        val outsOnPlay = if (ev.description.contains("Double Play") || ev.description.contains("DP")) 2 
                                         else if (ev.eventType in listOf(ScoringEventType.STRIKEOUT, ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT, ScoringEventType.SACRIFICE_FLY, ScoringEventType.FIELDER_CHOICE)) 1 
                                         else 0
                        ev.outsBefore + outsOnPlay >= 3
                    }

                    val endedStr = when {
                        ev.eventType in listOf(ScoringEventType.SINGLE, ScoringEventType.WALK, ScoringEventType.HIT_BY_PITCH, ScoringEventType.ERROR) -> "1B"
                        ev.eventType == ScoringEventType.DOUBLE -> "2B"
                        ev.eventType == ScoringEventType.TRIPLE -> "3B"
                        ev.eventType == ScoringEventType.HOME_RUN -> "Run Scored"
                        else -> "Out"
                    }

                    val notation = getScorebookNotation(ev)

                    logDiv.appendElement("div", "log-item") {
                        style.setProperty("display", "flex")
                        style.setProperty("flex-direction", "column")
                        style.setProperty("padding", "0.75rem")
                        style.setProperty("border-bottom", "1px solid rgba(255, 255, 255, 0.05)")
                        if (endedInning) {
                            style.setProperty("background", "rgba(255, 42, 59, 0.05)")
                            style.setProperty("border-left", "4px solid var(--accent-red)")
                        }

                        val row = appendElement("div") {
                            style.setProperty("display", "flex")
                            style.setProperty("justify-content", "space-between")
                            style.setProperty("align-items", "center")
                            style.setProperty("width", "100%")
                        }

                        row.appendElement("span", "log-desc") {
                            val header = "${ev.batterName} ($position) - Inning ${ev.inning} (${if (ev.half == HalfInning.TOP) "Top" else "Bottom"})"
                            val notStr = if (notation.isNotEmpty()) " [$notation]" else ""
                            val endingDetail = if (endedInning && endedStr != "Run Scored" && endedStr != "Out") "LOB" else endedStr
                            
                            innerHTML = "<span style='color: var(--accent-yellow); font-weight: 700;'>$header</span>$notStr - ${ev.description} <span style='color: var(--text-secondary); font-size: 0.8rem;'>[Ended: $endingDetail]</span>"
                        }

                        if (endedInning) {
                            row.appendElement("span") {
                                textContent = " ─── / (Side Retired)"
                                style.setProperty("color", "var(--accent-red)")
                                style.setProperty("font-weight", "bold")
                                style.setProperty("font-size", "0.9rem")
                            }
                        }
                    }
                }
            }
        }

        fun showScorecard() {
            monitorContent.innerHTML = ""
            renderScorebookView(monitorContent, game, boxScore, events)
        }

        val btnLog = toggleGroup.appendElement("button", "btn btn-secondary") {
            textContent = "Play-By-By Play Log"
            onClick {
                showLog()
                classList.add("btn-primary")
                classList.remove("btn-secondary")
                val other = toggleGroup.children.item(1) as? HTMLButtonElement
                other?.classList?.add("btn-secondary")
                other?.classList?.remove("btn-primary")
            }
        }

        val btnScorecard = toggleGroup.appendElement("button", "btn") {
            textContent = "Visual Scorebook"
            onClick {
                showScorecard()
                classList.add("btn-primary")
                classList.remove("btn-secondary")
                btnLog.classList.add("btn-secondary")
                btnLog.classList.remove("btn-primary")
            }
        }
        btnScorecard.classList.add("btn-primary") // Default to scorebook

        // Default view
        showScorecard()
    }
}

internal fun getScorebookNotation(ev: PlayEvent): String {
    return when (ev.eventType) {
        ScoringEventType.SINGLE -> "1B"
        ScoringEventType.DOUBLE -> "2B"
        ScoringEventType.TRIPLE -> "3B"
        ScoringEventType.HOME_RUN -> "HR"
        ScoringEventType.WALK -> "BB"
        ScoringEventType.HIT_BY_PITCH -> "HBP"
        ScoringEventType.STRIKEOUT -> "K"
        ScoringEventType.GROUNDOUT -> {
            val matchNum = Regex("to .*? \\((\\d)\\)").find(ev.description)
            val posNum = matchNum?.groupValues?.get(1) ?: "3"
            "GO $posNum-3"
        }
        ScoringEventType.FLYOUT -> {
            val matchNum = Regex("to .*? \\((\\d)\\)").find(ev.description)
            val posNum = matchNum?.groupValues?.get(1) ?: "8"
            "F$posNum"
        }
        ScoringEventType.LINE_OUT -> {
            val matchNum = Regex("to .*? \\((\\d)\\)").find(ev.description)
            val posNum = matchNum?.groupValues?.get(1) ?: "6"
            "L$posNum"
        }
        ScoringEventType.POP_OUT -> {
            val matchNum = Regex("to .*? \\((\\d)\\)").find(ev.description)
            val posNum = matchNum?.groupValues?.get(1) ?: "4"
            "P$posNum"
        }
        ScoringEventType.SACRIFICE_FLY -> "SF"
        ScoringEventType.ERROR -> "E"
        ScoringEventType.FIELDER_CHOICE -> "FC"
        else -> ""
    }
}

package com.baseball.ui

import com.baseball.UiConstants
import com.baseball.BaseballConstants

import com.baseball.api
import com.baseball.game.*
import com.baseball.models.*
import com.baseball.ui.components.*
import org.w3c.dom.*
import kotlinx.browser.document
import kotlinx.browser.window

var isResetDialogOpen = false

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
    com.baseball.game.onOpenLineupSetupDialog = {
        isLineupDialogOpen = true
        renderCurrentTab()
    }

    if (!isSingleGameMode && selectedGameId == null) {
        container.appendElement(UiConstants.Html.DIV, "card") {
            style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER)
            style.setProperty(UiConstants.Css.PADDING, "3rem")
            appendElement(UiConstants.Html.P) { textContent = "No game selected. Go to Season Dashboard to select one." }
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
                localAwayLineup.addAll(awayRoster.filter { it.position != BaseballConstants.Positions.P }.take(9))
                localAwayBench.addAll(awayRoster.filter { it.position == BaseballConstants.Positions.P && it.id != game.gameState.currentPitcherId } + awayRoster.drop(10))
                localAwayActivePitcherId = game.gameState.currentPitcherId ?: awayRoster.find { it.position == BaseballConstants.Positions.P }?.id ?: 210L
                localAwayActivePitcherName = game.gameState.currentPitcherName ?: awayRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Sonny Gray"
                localAwayBatterIndex = localAwayLineup.indexOfFirst { it.id == game.gameState.currentBatterId }.coerceAtLeast(0)
            }
            if (localHomeLineup.isEmpty()) {
                localHomeLineup.addAll(homeRoster.filter { it.position != BaseballConstants.Positions.P }.take(9))
                localHomeBench.addAll(homeRoster.filter { it.position == BaseballConstants.Positions.P && it.id != game.gameState.currentPitcherId } + homeRoster.drop(10))
                localHomeActivePitcherId = game.gameState.currentPitcherId ?: homeRoster.find { it.position == BaseballConstants.Positions.P }?.id ?: 110L
                localHomeActivePitcherName = game.gameState.currentPitcherName ?: homeRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Justin Steele"
                localHomeBatterIndex = localHomeLineup.indexOfFirst { it.id == game.gameState.currentBatterId }.coerceAtLeast(0)
            }
        }

        val titleRow = container.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
            style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.SPACE_BETWEEN)
            style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
            style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
        }
        titleRow.appendElement(UiConstants.Html.H1) {
            textContent = "Live Scoring: ${game.awayTeam.city} @ ${game.homeTeam.city}"
            style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0")
        }
        if (isSingleGameMode) {
            val controlBtns = titleRow.appendElement(UiConstants.Html.DIV) {
                style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                style.setProperty(UiConstants.Css.GAP, "0.5rem")
            }
            if (localEvents.isNotEmpty()) {
                controlBtns.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
                    textContent = "⎌ Undo Action"
                    style.setProperty(UiConstants.Css.PADDING, "0.5rem 1rem")
                    onClick {
                        com.baseball.game.undoLastLocalEvent()
                        renderCurrentTab()
                    }
                }
            }
            controlBtns.appendElement(UiConstants.Html.BUTTON, "btn btn-danger") {
                textContent = "New Game"
                style.setProperty(UiConstants.Css.PADDING, "0.5rem 1rem")
                onClick {
                    isResetDialogOpen = true
                    renderCurrentTab()
                }
            }
        }

        val topGrid = container.appendElement(UiConstants.Html.DIV, "scorekeeper-grid")

        // 1. Digital LED Scoreboard
        val leftCol = topGrid.appendElement(UiConstants.Html.DIV, "scoreboard-led")
        renderScorerLedScoreboard(leftCol, game)

        // 2. Play Actions & Lineup Selector
        val rightCol = topGrid.appendElement(UiConstants.Html.DIV, "card")
        renderGameScoringControls(rightCol, game, homeRoster, awayRoster, boxScore)

        // 3. Play Monitoring Tabs (Play-by-play vs Visual Scorebook)
        val monitoringCard = container.appendElement(UiConstants.Html.DIV, "card") { style.setProperty(UiConstants.Css.MARGIN_TOP, "2rem") }
        val monitoringHeader = monitoringCard.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
            style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.SPACE_BETWEEN)
            style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
            style.setProperty(UiConstants.Css.BORDER_BOTTOM, "1px solid rgba(255, 255, 255, 0.1)")
            style.setProperty(UiConstants.Css.PADDING_BOTTOM, "0.5rem")
            style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
        }

        monitoringHeader.appendElement(UiConstants.Html.H2) {
            textContent = "Live Game Monitoring"
            style.setProperty(UiConstants.Css.MARGIN, "0")
        }

        val toggleGroup = monitoringHeader.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
            style.setProperty(UiConstants.Css.GAP, "0.5rem")
        }

        val monitorContent = monitoringCard.appendElement(UiConstants.Html.DIV)

        fun showLog() {
            monitorContent.innerHTML = ""
            val logDiv = monitorContent.appendElement(UiConstants.Html.DIV, "event-log")
            if (events.isEmpty()) {
                logDiv.appendElement(UiConstants.Html.DIV) { textContent = "No events logged for this game yet." }
            } else {
                events.forEachIndexed { index, ev ->
                    val player = (homeRoster + awayRoster).find { it.name == ev.batterName }
                    val position = player?.position ?: "DH"
                    
                    val endedInning = if (index + 1 < events.size) {
                        events[index + 1].half != ev.half || events[index + 1].inning != ev.inning
                    } else {
                        val outsOnPlay = if (ev.description.contains(BaseballConstants.DESC_DOUBLE_PLAY) || ev.description.contains(BaseballConstants.DESC_DP)) 2 
                                         else if (ev.eventType in listOf(ScoringEventType.STRIKEOUT, ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT, ScoringEventType.SACRIFICE_FLY, ScoringEventType.FIELDER_CHOICE)) 1 
                                         else 0
                        ev.outsBefore + outsOnPlay >= 3
                    }

                    val endedStr = when {
                        ev.eventType in listOf(ScoringEventType.SINGLE, ScoringEventType.WALK, ScoringEventType.HIT_BY_PITCH, ScoringEventType.ERROR) -> BaseballConstants.PLAY_RESULT_1B
                        ev.eventType == ScoringEventType.DOUBLE -> BaseballConstants.PLAY_RESULT_2B
                        ev.eventType == ScoringEventType.TRIPLE -> BaseballConstants.PLAY_RESULT_3B
                        ev.eventType == ScoringEventType.HOME_RUN -> BaseballConstants.PLAY_RESULT_RUN_SCORED
                        else -> BaseballConstants.PLAY_RESULT_OUT
                    }

                    val notation = getScorebookNotation(ev)

                    logDiv.appendElement(UiConstants.Html.DIV, "log-item") {
                        style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                        style.setProperty(UiConstants.Css.FLEX_DIRECTION, UiConstants.CssValues.COLUMN)
                        style.setProperty(UiConstants.Css.PADDING, "0.75rem")
                        style.setProperty(UiConstants.Css.BORDER_BOTTOM, "1px solid rgba(255, 255, 255, 0.05)")
                        if (endedInning) {
                            style.setProperty(UiConstants.Css.BACKGROUND, "rgba(255, 42, 59, 0.05)")
                            style.setProperty(UiConstants.Css.BORDER_LEFT, "4px solid var(--accent-red)")
                        }

                        val row = appendElement(UiConstants.Html.DIV) {
                            style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                            style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.SPACE_BETWEEN)
                            style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
                            style.setProperty(UiConstants.Css.WIDTH, "100%")
                        }

                        row.appendElement(UiConstants.Html.SPAN, "log-desc") {
                            val header = "${ev.batterName} ($position) - Inning ${ev.inning} (${if (ev.half == HalfInning.TOP) "Top" else "Bottom"})"
                            val notStr = if (notation.isNotEmpty()) " [$notation]" else ""
                            val endingDetail = if (endedInning && endedStr != BaseballConstants.PLAY_RESULT_RUN_SCORED && endedStr != BaseballConstants.PLAY_RESULT_OUT) BaseballConstants.PLAY_RESULT_LOB else endedStr
                            val cleanedDesc = ev.description.substringBefore(" | Adv:")
                            innerHTML = "<span style='color: var(--accent-yellow); font-weight: 700;'>$header</span>$notStr - $cleanedDesc <span style='color: var(--text-secondary); font-size: 0.8rem;'>[Ended: $endingDetail]</span>"
                        }

                        if (endedInning) {
                            row.appendElement(UiConstants.Html.SPAN) {
                                textContent = " ─── / (Side Retired)"
                                style.setProperty(UiConstants.Css.COLOR, "var(--accent-red)")
                                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                                style.setProperty(UiConstants.Css.FONT_SIZE, "0.9rem")
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

        val btnLog = toggleGroup.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
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

        val btnScorecard = toggleGroup.appendElement(UiConstants.Html.BUTTON, "btn") {
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

        if (isLineupDialogOpen) {
            val overlay = LineupSetupOverlay(container)
            overlay.render()
        }

        if (isResetDialogOpen) {
            val resetOverlay = container.appendElement(UiConstants.Html.DIV) {
                style.setProperty(UiConstants.Css.POSITION, "fixed")
                style.setProperty(UiConstants.Css.TOP, "0")
                style.setProperty(UiConstants.Css.LEFT, "0")
                style.setProperty(UiConstants.Css.WIDTH, "100vw")
                style.setProperty(UiConstants.Css.HEIGHT, "100vh")
                style.setProperty(UiConstants.Css.BACKGROUND, "rgba(10, 15, 30, 0.8)")
                style.setProperty(UiConstants.Css.BACKDROP_FILTER, "blur(12px)")
                style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                style.setProperty(UiConstants.Css.ALIGN_ITEMS, "center")
                style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.CENTER)
                style.setProperty(UiConstants.Css.Z_INDEX, "10000")
            }

            val resetModal = resetOverlay.appendElement(UiConstants.Html.DIV, "card") {
                style.setProperty(UiConstants.Css.WIDTH, "90%")
                style.setProperty(UiConstants.Css.MAX_WIDTH, "450px")
                style.setProperty(UiConstants.Css.PADDING, "2rem")
                style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER)
            }

            resetModal.appendElement(UiConstants.Html.H2) {
                textContent = "Start a New Game"
                style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
            }
            resetModal.appendElement(UiConstants.Html.P) {
                textContent = "Are you sure you want to reset? All current game progress and stats will be permanently lost."
                style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1.5rem")
                style.setProperty(UiConstants.Css.COLOR, "var(--text-secondary)")
            }

            val btnCol = resetModal.appendElement(UiConstants.Html.DIV) {
                style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                style.setProperty(UiConstants.Css.FLEX_DIRECTION, UiConstants.CssValues.COLUMN)
                style.setProperty(UiConstants.Css.GAP, "0.75rem")
            }

            btnCol.appendElement(UiConstants.Html.BUTTON, "btn btn-primary") {
                textContent = "Restart with Current Lineups"
                onClick {
                    isResetDialogOpen = false
                    resetLocalGame(toInitialLineups = true)
                    renderCurrentTab()
                }
            }

            btnCol.appendElement(UiConstants.Html.BUTTON, "btn btn-action") {
                textContent = "Configure New Lineups"
                style.setProperty(UiConstants.Css.BACKGROUND, "linear-gradient(135deg, #3b82f6, #8b5cf6)")
                onClick {
                    isResetDialogOpen = false
                    isLineupDialogOpen = true
                    renderCurrentTab()
                }
            }

            btnCol.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
                textContent = "Cancel"
                onClick {
                    isResetDialogOpen = false
                    renderCurrentTab()
                }
            }
        }
    }
}

internal fun getScorebookNotation(ev: PlayEvent): String {
    val suffix = if (ev.description.contains("(Double Play)")) " DP" else ""
    return when (ev.eventType) {
        ScoringEventType.SINGLE -> "1B"
        ScoringEventType.DOUBLE -> "2B"
        ScoringEventType.TRIPLE -> "3B"
        ScoringEventType.HOME_RUN -> "HR"
        ScoringEventType.WALK -> "BB"
        ScoringEventType.HIT_BY_PITCH -> "HBP"
        ScoringEventType.STRIKEOUT -> "K$suffix"
        ScoringEventType.GROUNDOUT -> {
            val runnerOutMatch = Regex("Runner Out: (\\d+(?:-\\d+)*U?)").find(ev.description)
            val seqMatch = Regex("Groundout: (\\d+(?:-\\d+)*U?)").find(ev.description)
            val baseNotation = when {
                runnerOutMatch != null -> runnerOutMatch.groupValues[1]
                seqMatch != null -> seqMatch.groupValues[1]
                else -> {
                    val matchNum = Regex("to .*? \\((\\d)\\)").find(ev.description)
                    val posNum = matchNum?.groupValues?.get(1) ?: "3"
                    "$posNum-3"
                }
            }
            "$baseNotation$suffix"
        }
        ScoringEventType.FLYOUT -> {
            val matchNum = Regex("to .*? \\((\\d)\\)").find(ev.description)
            val posNum = matchNum?.groupValues?.get(1) ?: "8"
            "F$posNum$suffix"
        }
        ScoringEventType.LINE_OUT -> {
            val matchNum = Regex("to .*? \\((\\d)\\)").find(ev.description)
            val posNum = matchNum?.groupValues?.get(1) ?: "6"
            "L$posNum$suffix"
        }
        ScoringEventType.POP_OUT -> {
            val matchNum = Regex("to .*? \\((\\d)\\)").find(ev.description)
            val posNum = matchNum?.groupValues?.get(1) ?: "4"
            "P$posNum$suffix"
        }
        ScoringEventType.SACRIFICE_FLY -> "SF"
        ScoringEventType.ERROR -> "E"
        ScoringEventType.FIELDER_CHOICE -> {
            val runnerOutMatch = Regex("Runner Out: (\\d+(?:-\\d+)*U?)").find(ev.description)
            val seqMatch = Regex("Fielder's Choice: (\\d+(?:-\\d+)*U?)").find(ev.description)
            val baseNotation = when {
                runnerOutMatch != null -> runnerOutMatch.groupValues[1]
                seqMatch != null -> seqMatch.groupValues[1]
                else -> "FC"
            }
            "$baseNotation$suffix"
        }
        ScoringEventType.STOLEN_BASE -> {
            if (ev.description.contains("to 3B")) "SB3"
            else if (ev.description.contains("to Home")) "SBH"
            else "SB"
        }
        ScoringEventType.CAUGHT_STEALING -> {
            val seqMatch = Regex("Caught Stealing: .*? \\((\\d+(?:-\\d+)*U?)\\)").find(ev.description)
            if (seqMatch != null) "CS ${seqMatch.groupValues[1]}" else "CS"
        }
        ScoringEventType.PICKED_OFF -> {
            val seqMatch = Regex("Picked Off: .*? \\((\\d+(?:-\\d+)*U?)\\)").find(ev.description)
            if (seqMatch != null) "PO ${seqMatch.groupValues[1]}" else "PO"
        }
        ScoringEventType.WILD_PITCH -> "WP"
        ScoringEventType.PASSED_BALL -> "PB"
        ScoringEventType.BALK -> "BK"
        else -> ""
    }
}

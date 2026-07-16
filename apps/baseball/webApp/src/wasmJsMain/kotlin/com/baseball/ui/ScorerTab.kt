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
import kotlinx.html.*
import kotlinx.html.js.*
import kotlinx.html.dom.*
import kotlinx.css.*

var isResetDialogOpen = false

internal fun substituteBatter(isHome: Boolean, lineupIndex: Int, newPlayerId: Long) {
    val lineup = if (isHome) localHomeLineup else localAwayLineup
    val bench = if (isHome) localHomeBench else localAwayBench
    val oldPlayer = lineup[lineupIndex]
    val newPlayer = bench.find { it.id == newPlayerId } ?: return

    lineup[lineupIndex] = newPlayer
    bench.remove(newPlayer)
    localPlayersSubbedOut.add(oldPlayer.id!!)

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

internal fun substitutePitcher(isHome: Boolean, newPitcherId: Long) {
    val bench = if (isHome) localHomeBench else localAwayBench
    val newPitcher = bench.find { it.id == newPitcherId } ?: return
    val oldPitcherId = if (isHome) localHomeActivePitcherId else localAwayActivePitcherId

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

internal fun renderLiveScorerTab(container: HTMLElement) {
    com.baseball.game.onOpenLineupSetupDialog = {
        isLineupDialogOpen = true
        renderCurrentTab()
    }

    if (!isSingleGameMode && selectedGameId == null) {
        container.div(classes = "card") {
            css {
                textAlign = TextAlign.center
                padding = Padding(3.rem)
            }
            p { +"No game selected. Go to Season Dashboard to select one." }
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

        var btnLog: HTMLButtonElement? = null
        var btnScorecard: HTMLButtonElement? = null
        var monitorContent: HTMLDivElement? = null

        fun showLog() {
            val monitorEl = monitorContent ?: return
            monitorEl.innerHTML = ""
            monitorEl.div(classes = "event-log") {
                if (events.isEmpty()) {
                    div { +"No events logged for this game yet." }
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

                        div(classes = "log-item") {
                            css {
                                display = Display.flex
                                flexDirection = FlexDirection.column
                                padding = Padding(0.75.rem)
                                borderBottom = Border(1.px, BorderStyle.solid, Color("rgba(255, 255, 255, 0.05)"))
                                if (endedInning) {
                                    background = "rgba(255, 42, 59, 0.05)"
                                    borderLeft = Border(4.px, BorderStyle.solid, Color("var(--accent-red)"))
                                }
                            }

                            div {
                                css {
                                    display = Display.flex
                                    justifyContent = JustifyContent.spaceBetween
                                    alignItems = Align.center
                                    width = 100.pct
                                }

                                span(classes = "log-desc") {
                                    val header = "${ev.batterName} ($position) - Inning ${ev.inning} (${if (ev.half == HalfInning.TOP) "Top" else "Bottom"})"
                                    val notStr = if (notation.isNotEmpty()) " [$notation]" else ""
                                    val endingDetail = if (endedInning && endedStr != BaseballConstants.PLAY_RESULT_RUN_SCORED && endedStr != BaseballConstants.PLAY_RESULT_OUT) BaseballConstants.PLAY_RESULT_LOB else endedStr
                                    val cleanedDesc = ev.description.substringBefore(" | Adv:")
                                    unsafe {
                                        raw("<span style='color: var(--accent-yellow); font-weight: 700;'>$header</span>$notStr - $cleanedDesc <span style='color: var(--text-secondary); font-size: 0.8rem;'>[Ended: $endingDetail]</span>")
                                    }
                                }

                                if (endedInning) {
                                    span {
                                        +" ─── / (Side Retired)"
                                        css {
                                            color = Color("var(--accent-red)")
                                            fontWeight = FontWeight.bold
                                            fontSize = 0.9.rem
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        fun showScorecard() {
            val monitorEl = monitorContent ?: return
            monitorEl.innerHTML = ""
            renderScorebookView(monitorEl, game, boxScore, events)
        }

        container.div {
            css {
                display = Display.flex
                justifyContent = JustifyContent.spaceBetween
                alignItems = Align.center
                marginBottom = 1.rem
            }
            h1 {
                +"Live Scoring: ${game.awayTeam.city} @ ${game.homeTeam.city}"
                css { marginBottom = 0.rem }
            }

            if (isSingleGameMode) {
                div {
                    css {
                        display = Display.flex
                        gap = 0.5.rem
                    }
                    if (localEvents.isNotEmpty()) {
                        button(classes = "btn btn-secondary") {
                            +"⎌ Undo Action"
                            css { padding = Padding(0.5.rem, 1.rem) }
                            onClickFunction = {
                                undoLastLocalEvent()
                                renderCurrentTab()
                            }
                        }
                    }
                    button(classes = "btn btn-danger") {
                        +"New Game"
                        css { padding = Padding(0.5.rem, 1.rem) }
                        onClickFunction = {
                            isResetDialogOpen = true
                            renderCurrentTab()
                        }
                    }
                }
            }
        }

        val topGrid = container.div(classes = "scorekeeper-grid")

        // 1. Digital LED Scoreboard
        val leftCol = topGrid.div(classes = "scoreboard-led")
        renderScorerLedScoreboard(leftCol, game)

        // 2. Play Actions & Lineup Selector
        val rightCol = topGrid.div(classes = "card")
        renderGameScoringControls(rightCol, game, homeRoster, awayRoster, boxScore)

        // 3. Play Monitoring Tabs
        val monitorCard = container.div(classes = "card") {
            css { marginTop = 2.rem }

            div {
                css {
                    display = Display.flex
                    justifyContent = JustifyContent.spaceBetween
                    alignItems = Align.center
                    borderBottom = Border(1.px, BorderStyle.solid, Color("rgba(255, 255, 255, 0.1)"))
                    paddingBottom = 0.5.rem
                    marginBottom = 1.rem
                }

                h2 {
                    +"Live Game Monitoring"
                    css { margin = Margin(0.px) }
                }

                div {
                    css {
                        display = Display.flex
                        gap = 0.5.rem
                    }

                    button(classes = "btn btn-secondary") {
                        id = "scorer-btn-log"
                        +"Play-By-Play Log"
                        onClickFunction = {
                            showLog()
                            btnLog?.classList?.add("btn-primary")
                            btnLog?.classList?.remove("btn-secondary")
                            btnScorecard?.classList?.add("btn-secondary")
                            btnScorecard?.classList?.remove("btn-primary")
                        }
                    }

                    button(classes = "btn btn-primary") {
                        id = "scorer-btn-scorecard"
                        +"Scorebook"
                        onClickFunction = {
                            showScorecard()
                            btnScorecard?.classList?.add("btn-primary")
                            btnScorecard?.classList?.remove("btn-secondary")
                            btnLog?.classList?.add("btn-secondary")
                            btnLog?.classList?.remove("btn-primary")
                        }
                    }
                }
            }
        }

        btnLog = monitorCard.querySelector("#scorer-btn-log") as? HTMLButtonElement
        btnScorecard = monitorCard.querySelector("#scorer-btn-scorecard") as? HTMLButtonElement

        monitorContent = monitorCard.div {
            id = "monitor-content-container"
        }

        // Default view
        showScorecard()

        if (isLineupDialogOpen) {
            val overlay = LineupSetupOverlay(container)
            overlay.render()
        }

        if (isResetDialogOpen) {
            container.div {
                css {
                    position = Position.fixed
                    top = 0.px
                    left = 0.px
                    width = LinearDimension("100vw")
                    height = LinearDimension("100vh")
                    background = "rgba(10, 15, 30, 0.8)"
                    put("backdrop-filter", "blur(12px)")
                    display = Display.flex
                    alignItems = Align.center
                    justifyContent = JustifyContent.center
                    zIndex = 10000
                }

                div(classes = "card") {
                    css {
                        width = 90.pct
                        maxWidth = 450.px
                        padding = Padding(2.rem)
                        textAlign = TextAlign.center
                    }

                    h2 {
                        +"Start a New Game"
                        css { marginBottom = 1.rem }
                    }
                    p {
                        +"Are you sure you want to reset? All current game progress and stats will be permanently lost."
                        css {
                            marginBottom = 1.5.rem
                            color = Color("var(--text-secondary)")
                        }
                    }

                    div {
                        css {
                            display = Display.flex
                            flexDirection = FlexDirection.column
                            gap = 0.75.rem
                        }

                        button(classes = "btn btn-primary") {
                            +"Restart with Current Lineups"
                            onClickFunction = {
                                isResetDialogOpen = false
                                resetLocalGame(toInitialLineups = true)
                                renderCurrentTab()
                            }
                        }

                        button(classes = "btn btn-action") {
                            +"Configure New Lineups"
                            css { put("background", "linear-gradient(135deg, #3b82f6, #8b5cf6)") }
                            onClickFunction = {
                                isResetDialogOpen = false
                                isLineupDialogOpen = true
                                renderCurrentTab()
                            }
                        }

                        button(classes = "btn btn-secondary") {
                            +"Cancel"
                            onClickFunction = {
                                isResetDialogOpen = false
                                renderCurrentTab()
                            }
                        }
                    }
                }
            }
        }
    }
}

internal fun getScorebookNotation(ev: PlayEvent): String {
    val suffix = if (ev.description.contains("(Double Play)") || ev.description.contains("(DP)")) " DP" else ""
    return when (ev.eventType) {
        ScoringEventType.SINGLE -> {
            val locNum = getHitLocationNumber(ev.description)
            if (locNum != null) "1B$locNum" else "1B"
        }
        ScoringEventType.DOUBLE -> {
            val locNum = getHitLocationNumber(ev.description)
            if (locNum != null) "2B$locNum" else "2B"
        }
        ScoringEventType.TRIPLE -> {
            val locNum = getHitLocationNumber(ev.description)
            if (locNum != null) "3B$locNum" else "3B"
        }
        ScoringEventType.HOME_RUN -> {
            val locNum = getHitLocationNumber(ev.description)
            if (locNum != null) "HR$locNum" else "HR"
        }
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

fun getHitLocationNumber(desc: String): String? {
    return when {
        desc.contains("Left Field") -> "7"
        desc.contains("Center Field") -> "8"
        desc.contains("Right Field") -> "9"
        desc.contains("Shortstop") -> "6"
        desc.contains("2nd Base") || desc.contains("Second Base") -> "4"
        desc.contains("3rd Base") || desc.contains("Third Base") -> "5"
        desc.contains("1st Base") || desc.contains("First Base") -> "3"
        desc.contains("Pitcher") -> "1"
        desc.contains("Catcher") -> "2"
        desc.contains("Infield") -> "IF"
        else -> null
    }
}

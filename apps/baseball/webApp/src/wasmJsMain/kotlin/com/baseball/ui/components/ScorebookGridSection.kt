package com.baseball.ui.components

import com.baseball.UiConstants
import com.baseball.BaseballConstants
import com.baseball.models.*
import com.baseball.game.*
import com.baseball.ui.*
import org.w3c.dom.*
import kotlinx.browser.document
import kotlinx.browser.window
import kotlinx.html.*
import kotlinx.html.js.*
import kotlinx.html.dom.*

data class RunnerProgression(
    val maxBase: Int,
    val outAtBase: Int?,
    val outDetail: String?
)

fun renderScorecardSheet(container: HTMLElement, game: Game, boxScore: BoxScore, events: List<PlayEvent>, half: HalfInning) {
    val isHomeBatting = half == HalfInning.BOTTOM
    val battingTeam = if (isHomeBatting) game.homeTeam else game.awayTeam
    val pitchingTeam = if (isHomeBatting) game.awayTeam else game.homeTeam
    val battingStatsList = if (isHomeBatting) boxScore.homeBatting else boxScore.awayBatting

    val teamEvents = events.filter { it.half == half }

    val slots = Array(9) { mutableListOf<PlayEvent>() }
    teamEvents.forEachIndexed { index, event ->
        slots[index % 9].add(event)
    }

    val slotPlayers = Array(9) { slotIdx ->
        val playersInSlot = mutableListOf<String>()
        slots[slotIdx].forEach { ev ->
            if (!playersInSlot.contains(ev.batterName)) {
                playersInSlot.add(ev.batterName)
            }
        }
        if (playersInSlot.isEmpty()) {
            val roster = if (isHomeBatting) localHomeLineup else localAwayLineup
            if (roster.size > slotIdx) {
                playersInSlot.add(roster[slotIdx].name)
            } else {
                playersInSlot.add("Batter ${slotIdx + 1}")
            }
        }
        playersInSlot
    }

    val maxInning = events.maxOfOrNull { it.inning }?.coerceAtLeast(9) ?: 9

    val isHome = !isHomeBatting
    val fieldingBench = if (isHome) localHomeBench else localAwayBench
    val activePitcherName = if (isHome) localHomeActivePitcherName else localAwayActivePitcherName
    val benchList = if (isHomeBatting) localHomeBench else localAwayBench

    val baseRunners = mutableMapOf<String, Int>()
    val playAdvancements = mutableMapOf<PlayEvent, Int>()
    val playOutNumbers = mutableMapOf<PlayEvent, Int>()
    val playProgressions = mutableMapOf<PlayEvent, RunnerProgression>()

    for (inn in 1..maxInning) {
        val innEvents = teamEvents.filter { it.inning == inn }
        baseRunners.clear()
        var currentOuts = 0

        fun parseRunnerAdvances(description: String): Map<String, Int> {
            val marker = " | Adv: "
            if (!description.contains(marker)) return emptyMap()
            val parts = description.substringAfter(marker).split(",")
            val map = mutableMapOf<String, Int>()
            parts.forEach { part ->
                val pair = part.split("->")
                if (pair.size == 2) {
                    val pId = pair[0]
                    val base = pair[1].toIntOrNull()
                    if (base != null) {
                        map[pId] = base
                    }
                }
            }
            return map
        }

        innEvents.forEach { ev ->
            val isOut = ev.eventType in listOf(
                ScoringEventType.STRIKEOUT, ScoringEventType.GROUNDOUT,
                ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT,
                ScoringEventType.POP_OUT, ScoringEventType.SACRIFICE_FLY
            )

            var finalBase = 0
            when (ev.eventType) {
                ScoringEventType.SINGLE, ScoringEventType.WALK, ScoringEventType.HIT_BY_PITCH, ScoringEventType.ERROR, ScoringEventType.FIELDER_CHOICE -> {
                    finalBase = 1
                }
                ScoringEventType.DOUBLE -> {
                    finalBase = 2
                }
                ScoringEventType.TRIPLE -> {
                    finalBase = 3
                }
                ScoringEventType.HOME_RUN -> {
                    finalBase = 4
                }
                else -> {}
            }

            val isDoublePlay = ev.description.contains("(Double Play)")
            if (isDoublePlay) {
                val subAdvances = parseRunnerAdvances(ev.description)
                val outRunnerEntry = baseRunners.entries.find { rEntry ->
                    val pId = (localAwayRoster + localHomeRoster).find { it.name == rEntry.key }?.id
                    pId != null && subAdvances[pId.toString()] == 0
                }

                if (outRunnerEntry != null) {
                    val outRunnerName = outRunnerEntry.key
                    baseRunners.remove(outRunnerName)

                    val runnerEv = innEvents.takeWhile { it != ev }.findLast { it.batterName == outRunnerName }
                    if (runnerEv != null) {
                        currentOuts++
                        playOutNumbers[runnerEv] = currentOuts
                    } else {
                        currentOuts++
                    }
                } else {
                    currentOuts++
                }

                currentOuts++
                playOutNumbers[ev] = currentOuts
            } else if (isOut) {
                currentOuts++
                playOutNumbers[ev] = currentOuts
            } else {
                baseRunners[ev.batterName] = finalBase
            }

            if (ev.runsScoredOnPlay > 0) {
                var runsToScore = ev.runsScoredOnPlay
                if (ev.eventType == ScoringEventType.HOME_RUN) {
                    finalBase = 4
                    runsToScore--
                }
                val activeRunners = baseRunners.entries.filter { it.key != ev.batterName && it.value < 4 }.sortedByDescending { it.value }
                for (r in activeRunners) {
                    if (runsToScore > 0) {
                        baseRunners[r.key] = 4
                        runsToScore--
                    }
                }
                if (runsToScore > 0 && finalBase < 4) {
                    finalBase = 4
                }
            }

            playAdvancements[ev] = baseRunners[ev.batterName] ?: finalBase
        }

        innEvents.forEachIndexed { evIdx, ev ->
            val isResolving = ev.eventType in listOf(
                ScoringEventType.SINGLE, ScoringEventType.DOUBLE, ScoringEventType.TRIPLE, ScoringEventType.HOME_RUN,
                ScoringEventType.WALK, ScoringEventType.HIT_BY_PITCH, ScoringEventType.STRIKEOUT,
                ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT,
                ScoringEventType.ERROR, ScoringEventType.FIELDER_CHOICE, ScoringEventType.SACRIFICE_FLY
            )
            if (isResolving) {
                var maxB = playAdvancements[ev] ?: 0
                var outB: Int? = null
                var outDet: String? = null

                val isOut = ev.eventType in listOf(
                    ScoringEventType.STRIKEOUT, ScoringEventType.GROUNDOUT,
                    ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT,
                    ScoringEventType.POP_OUT, ScoringEventType.SACRIFICE_FLY
                )
                if (isOut) {
                    outB = 1
                    outDet = getScorebookNotation(ev)
                } else if (maxB > 0) {
                    val rName = ev.batterName
                    val pId = (localAwayRoster + localHomeRoster).find { it.name == rName }?.id
                    if (pId != null) {
                        var currentB = maxB
                        for (i in (evIdx + 1) until innEvents.size) {
                            val subEv = innEvents[i]
                            val subAdvances = parseRunnerAdvances(subEv.description)
                            val targetBase = subAdvances[pId.toString()]
                            if (targetBase != null) {
                                if (targetBase > 0) {
                                    currentB = targetBase
                                    maxB = maxOf(maxB, targetBase)
                                } else if (targetBase == 0) {
                                    outB = currentB + 1
                                    outDet = when (subEv.eventType) {
                                        ScoringEventType.CAUGHT_STEALING -> getScorebookNotation(subEv)
                                        ScoringEventType.PICKED_OFF -> getScorebookNotation(subEv)
                                        else -> {
                                            val match = Regex("Runner Out: (\\d+(?:-\\d+)*U?)").find(subEv.description)
                                            val fullSeq = match?.groupValues?.get(1)
                                            if (fullSeq != null) {
                                                val parts = fullSeq.substringBefore("U").split("-")
                                                if (parts.size >= 3) {
                                                    "${parts[0]}-${parts[1]}"
                                                } else {
                                                    fullSeq
                                                }
                                            } else {
                                                "Out"
                                            }
                                        }
                                    }
                                    break
                                }
                            } else {
                                if (subEv.runsScoredOnPlay > 0 && subAdvances.isEmpty()) {
                                    if (subEv.eventType == ScoringEventType.HOME_RUN) {
                                        maxB = 4
                                        currentB = 4
                                    }
                                }
                            }
                        }
                    }
                }
                playProgressions[ev] = RunnerProgression(maxB, outB, outDet)
            }
        }
    }

    fun openSubSelector(container: HTMLElement, idx: Int) {
        val bench = if (isHomeBatting) localHomeBench else localAwayBench
        val subOptions = bench.filter { it.position != BaseballConstants.Positions.P && !localPlayersSubbedOut.contains(it.id) }
        if (subOptions.isEmpty()) {
            window.alert("No bench batters available!")
        } else {
            val selectOverlay = document.createElement(UiConstants.Html.SELECT) as HTMLSelectElement
            selectOverlay.className = "form-control"
            selectOverlay.style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem")
            selectOverlay.style.setProperty(UiConstants.Css.PADDING, "2px")

            val defOpt = document.createElement(UiConstants.Html.OPTION) as HTMLOptionElement
            defOpt.textContent = "Select pinch hitter..."
            selectOverlay.appendChild(defOpt)

            subOptions.forEach { optPlayer ->
                val opt = document.createElement(UiConstants.Html.OPTION) as HTMLOptionElement
                opt.value = optPlayer.id.toString()
                opt.textContent = "${optPlayer.name} (#${optPlayer.jerseyNumber} - ${optPlayer.position})"
                selectOverlay.appendChild(opt)
            }

            selectOverlay.addEventListener("change", {
                val valId = selectOverlay.value.toLongOrNull()
                if (valId != null) {
                    substituteBatter(isHomeBatting, idx, valId)
                    renderCurrentTab()
                } else {
                    renderCurrentTab()
                }
            })
            selectOverlay.addEventListener("blur", {
                renderCurrentTab()
            })
            container.innerHTML = ""
            container.appendChild(selectOverlay)
            selectOverlay.focus()
        }
    }

    fun TD.renderInningCell(ev: PlayEvent?, cellBg: String) {
        style = "border-right: 1px solid #9c9384; padding: 0; height: 42.5px; width: 75px; background: $cellBg;"

        div {
            style = "position: relative; width: 100%; height: 100%; box-sizing: border-box; padding: 2px; overflow: hidden;"

            if (ev != null) {
                val prog = playProgressions[ev]
                val base = prog?.maxBase ?: (playAdvancements[ev] ?: 0)
                val outNum = playOutNumbers[ev]
                val outAtBase = prog?.outAtBase
                val outDetail = prog?.outDetail
                val notation = getScorebookNotation(ev)

                val diamond = div {
                    style = "position: absolute; top: 50%; left: 50%; width: 26px; height: 26px; margin-top: -13px; margin-left: -13px; border: 1px dashed #d2cdc6; transform: rotate(45deg); z-index: 1;"
                    if (base >= 1) style += " border-right: 2px solid #ff2a3b;"
                    if (base >= 2) style += " border-top: 2px solid #ff2a3b;"
                    if (base >= 3) style += " border-left: 2px solid #ff2a3b;"
                    if (base >= 4) style += " border-bottom: 2px solid #ff2a3b; background-color: rgba(255, 42, 59, 0.25);"
                }

                if (outAtBase != null && outDetail != null && outAtBase > 1) {
                    div {
                        +outDetail
                        style = "position: absolute; " + when (outAtBase) {
                            2 -> "top: 2px; right: 2px;"
                            3 -> "top: 2px; left: 2px;"
                            4 -> "bottom: 2px; left: 2px;"
                            else -> ""
                        } + " font-size: 0.5rem; color: #ff2a3b; font-weight: bold; background-color: rgba(255, 255, 255, 0.85); padding: 1px 2px; border-radius: 2px; z-index: 5;"
                    }
                }

                div {
                    +notation
                    style = "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: bold; font-size: 0.75rem; z-index: 2;"
                }

                div {
                    style = "position: absolute; top: 2px; left: 4px; display: flex; flex-direction: column; gap: 1px; z-index: 3;"

                    div {
                        style = "display: flex; gap: 1px;"
                        for (b in 1..3) {
                            span {
                                style = "width: 3px; height: 3px; border-radius: 50%; background-color: ${if (b <= ev.balls) "#ffcc00" else "#d2cdc6"};"
                            }
                        }
                    }
                    div {
                        style = "display: flex; gap: 1px;"
                        for (s in 1..2) {
                            span {
                                style = "width: 3px; height: 3px; border-radius: 50%; background-color: ${if (s <= ev.strikes) "#ff2a3b" else "#d2cdc6"};"
                            }
                        }
                    }
                }

                if (outNum != null) {
                    div {
                        +outNum.toString()
                        style = "position: absolute; bottom: 2px; right: 10px; width: 11px; height: 11px; border: 1px solid #ff2a3b; border-radius: 50%; font-size: 0.55rem; display: flex; justify-content: center; align-items: center; color: #ff2a3b; font-weight: bold; z-index: 3;"
                    }
                }

                val nextEv = teamEvents.getOrNull(teamEvents.indexOf(ev) + 1)
                val endedInning = if (nextEv != null) {
                    nextEv.inning != ev.inning || nextEv.half != ev.half
                } else {
                    val outsOnPlay = if (ev.description.contains(BaseballConstants.DESC_DOUBLE_PLAY) || ev.description.contains(BaseballConstants.DESC_DP)) 2
                    else if (ev.eventType in listOf(ScoringEventType.STRIKEOUT, ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT, ScoringEventType.SACRIFICE_FLY, ScoringEventType.FIELDER_CHOICE)) 1
                    else 0
                    ev.outsBefore + outsOnPlay >= 3
                }

                if (endedInning) {
                    div {
                        style = "position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; background: linear-gradient(to bottom right, transparent calc(50% - 0.5px), #ff2a3b, transparent calc(50% + 1px)); pointer-events: none; z-index: 4;"
                    }
                }
            } else {
                div {
                    style = "position: absolute; top: 50%; left: 50%; width: 8px; height: 8px; margin-top: -4px; margin-left: -4px; border: 1px dashed #e2ded5; transform: rotate(45deg);"
                }
            }
        }
    }

    container.div {
        style = "display: grid; grid-template-columns: 150px 1fr 1fr 180px; border: 2px solid #5a544a; background-color: #eae5dc; padding: 0.75rem; margin-bottom: 1rem; font-weight: bold;"

        div {
            +(if (isHomeBatting) "BOTTOM" else "TOP")
            style = "font-size: 2rem; color: #ff2a3b; letter-spacing: 2px;"
        }

        div {
            style = "display: flex; flex-direction: column; justify-content: center;"
            div { +"TEAM: ${battingTeam.city.uppercase()} ${battingTeam.name.uppercase()}" }
            div {
                +"MANAGER: ${if (isHomeBatting) "COUNSELL, C." else "REYNOLDS, J."}"
                style = "font-size: 0.85rem; color: #555; margin-top: 0.25rem;"
            }
        }

        div {
            style = "display: flex; flex-direction: column; justify-content: center;"
            div { +"PITCHING OPPONENT: ${pitchingTeam.name.uppercase()}" }
            div {
                +"UMPIRES: HP: CULBRETH, F. | 1B: NELSON, J."
                style = "font-size: 0.85rem; color: #555; margin-top: 0.25rem;"
            }
        }

        div {
            style = "display: flex; flex-direction: column; justify-content: center; align-items: flex-end; font-size: 0.8rem;"
            div { +"KEEPING SCORE BY: ☒ WEBAPP" }
            div { +"FIRST PITCH: 7:05 PM" }

            if (game.status != GameStatus.COMPLETED) {
                button(classes = "btn") {
                    +"Bench & Bullpen"
                    style = "margin-top: 0.4rem; font-size: 0.75rem; padding: 2px 8px; background: rgba(0, 0, 0, 0.05); border: 1px solid #5a544a; border-radius: 4px; cursor: pointer;"
                    onClickFunction = {
                        val drawer = document.getElementById("roster-drawer-element") as? HTMLElement
                        if (drawer != null) {
                            val isHidden = drawer.style.getPropertyValue(UiConstants.Css.DISPLAY) == UiConstants.CssValues.NONE
                            drawer.style.setProperty(UiConstants.Css.DISPLAY, if (isHidden) UiConstants.CssValues.BLOCK else UiConstants.CssValues.NONE)
                        }
                    }
                }
            }
        }
    }

    container.div {
        id = "roster-drawer-element"
        style = "display: none; background-color: #fcfbfa; border: 2px solid #5a544a; border-top: none; padding: 1rem; margin-top: -1.1rem; margin-bottom: 1.5rem; font-family: 'Courier New', Courier, monospace;"

        div {
            style = "display: flex; justify-content: space-between; gap: 2rem;"

            div {
                style = "flex: 1;"
                h4 {
                    +"AVAILABLE BENCH BATTERS"
                    style = "margin: 0 0 0.5rem 0; font-size: 0.85rem; color: #ff2a3b;"
                }
                val availableBatters = benchList.filter { it.position != BaseballConstants.Positions.P && !localPlayersSubbedOut.contains(it.id) }
                if (availableBatters.isEmpty()) {
                    div {
                        +"No batters left on bench"
                        style = "font-size: 0.8rem; color: #777;"
                    }
                } else {
                    availableBatters.forEach { p ->
                        div {
                            +"• ${p.name} (#${p.jerseyNumber} - ${p.position})"
                            style = "font-size: 0.8rem; margin-bottom: 0.25rem;"
                        }
                    }
                }
            }

            div {
                style = "flex: 1;"
                h4 {
                    +"ACTIVE PITCHER & BULLPEN"
                    style = "margin: 0 0 0.5rem 0; font-size: 0.85rem; color: #ff2a3b;"
                }
                div {
                    +"Current Pitcher: $activePitcherName"
                    style = "font-size: 0.8rem; font-weight: bold; margin-bottom: 0.5rem;"
                }

                val pSubs = fieldingBench.filter { it.position == BaseballConstants.Positions.P && !localPlayersSubbedOut.contains(it.id) }
                if (pSubs.isEmpty()) {
                    div {
                        +"No relief pitchers available in bullpen"
                        style = "font-size: 0.8rem; color: #777;"
                    }
                } else {
                    div {
                        style = "display: flex; align-items: center; gap: 0.5rem;"
                        span {
                            +"Change Pitcher:"
                            style = "font-size: 0.8rem;"
                        }
                        select(classes = "form-control") {
                            style = "font-size: 0.75rem; padding: 2px;"
                            option { +"Select relief pitcher..." }
                            pSubs.forEach { optPlayer ->
                                option {
                                    value = optPlayer.id.toString()
                                    +"${optPlayer.name} (#${optPlayer.jerseyNumber})"
                                }
                            }
                            onChangeFunction = { event ->
                                val valId = (event.target as HTMLSelectElement).value.toLongOrNull()
                                if (valId != null) {
                                    substitutePitcher(isHome, valId)
                                    renderCurrentTab()
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    val tableWrapper = container.div {
        style = "overflow-x: auto; border: 2px solid #5a544a; margin-bottom: 1.5rem;"
    }

    val tableEl = tableWrapper.table {
        style = "width: 100%; border-collapse: collapse; background-color: #f9f7f2;"
    }

    val theadEl = tableEl.thead {
        style = "background-color: #eae5dc;"
    }
    val theadTr = theadEl.tr {
        style = "border-bottom: 2px solid #5a544a;"
    }
    theadTr.th {
        +"PLAYER"
        style = "border-right: 2px solid #5a544a; padding: 0.5rem; width: 220px; text-align: left;"
    }
    theadTr.th {
        +"Pos"
        style = "border-right: 2px solid #5a544a; padding: 0.5rem; width: 50px; text-align: center;"
    }
    for (i in 1..maxInning) {
        theadTr.th {
            +i.toString()
            style = "border-right: 1px solid #9c9384; width: 75px; text-align: center;"
        }
    }
    listOf("AB", "R", "H", "RBI").forEach { sh ->
        theadTr.th {
            +sh
            style = "border-left: ${if (sh == "AB") "2px solid #5a544a" else "1px solid #9c9384"}; width: 45px; text-align: center;"
        }
    }

    val tbodyEl = tableEl.tbody { }

    for (slotIdx in 0..8) {
        val players = slotPlayers[slotIdx]
        val hasSub = players.size > 1
        val isEvenRow = slotIdx % 2 == 1
        val cellBg = if (isEvenRow) "linear-gradient(180deg, #f4f1e7 0%, #ebe6d9 100%)" else "linear-gradient(180deg, #faf9f6 0%, #f3f0e8 100%)"

        val pName0 = players.getOrNull(0) ?: ""
        val starterPos = battingStatsList.find { it.playerName == pName0 }?.position ?: BaseballConstants.Positions.DH

        val tr0 = tbodyEl.tr {
            style = "border-bottom: ${if (hasSub) "1px solid #9c9384" else "1px solid #5a544a"}; height: 42.5px;"
        }

        val tdPlayer0 = tr0.td {
            style = "border-right: 2px solid #5a544a; padding: 0 0.5rem; vertical-align: middle; background: $cellBg; height: 42.5px;"

            val row0 = div {
                style = "display: flex; justify-content: space-between; align-items: center; width: 100%;"
                span {
                    if (hasSub) {
                        +"${slotIdx + 1}. $pName0 (Subbed Out)"
                        style = "color: #777; font-weight: normal; font-size: 0.85rem;"
                    } else {
                        +"${slotIdx + 1}. $pName0"
                        style = "font-weight: bold; font-size: 0.95rem;"
                    }
                }
                if (!hasSub && game.status != GameStatus.COMPLETED) {
                    button(classes = "btn") {
                        +"Sub"
                        style = "padding: 2px 6px; font-size: 0.7rem; background-color: #5a544a; color: white; font-weight: bold; border: none; border-radius: 4px; cursor: pointer;"
                        onClickFunction = { event ->
                            val btnEl = event.target as? HTMLButtonElement
                            val parentCell = btnEl?.parentElement?.parentElement as? HTMLElement
                            if (parentCell != null) {
                                openSubSelector(parentCell, slotIdx)
                            }
                        }
                    }
                }
            }
        }

        tr0.td {
            +starterPos
            style = "border-right: 2px solid #5a544a; padding: 0.5rem; text-align: center; font-weight: bold; background: $cellBg;"
        }

        var tr1: HTMLTableRowElement? = null
        var pName1 = ""

        if (hasSub) {
            pName1 = players[1]
            val subPos = battingStatsList.find { it.playerName == pName1 }?.position ?: BaseballConstants.Positions.DH
            tr1 = tbodyEl.tr {
                style = "border-bottom: 1px solid #5a544a; height: 42.5px;"
            }

            tr1.td {
                style = "border-right: 2px solid #5a544a; padding: 0 0.5rem; vertical-align: middle; background: $cellBg; height: 42.5px;"

                div {
                    style = "display: flex; justify-content: space-between; align-items: center; width: 100%;"
                    span {
                        +"${slotIdx + 1}. $pName1"
                        style = "font-weight: bold; font-size: 0.95rem; color: #2b2a28;"
                    }
                    if (game.status != GameStatus.COMPLETED) {
                        button(classes = "btn") {
                            +"Sub"
                            style = "padding: 2px 6px; font-size: 0.7rem; background-color: #5a544a; color: white; font-weight: bold; border: none; border-radius: 4px; cursor: pointer;"
                            onClickFunction = { event ->
                                val btnEl = event.target as? HTMLButtonElement
                                val parentCell = btnEl?.parentElement?.parentElement as? HTMLElement
                                if (parentCell != null) {
                                    openSubSelector(parentCell, slotIdx)
                                }
                            }
                        }
                    }
                }
            }

            tr1.td {
                +subPos
                style = "border-right: 2px solid #5a544a; padding: 0.5rem; text-align: center; font-weight: bold; background: $cellBg;"
            }
        }

        for (inn in 1..maxInning) {
            val ev = teamEvents.find { (teamEvents.indexOf(it) % 9 == slotIdx) && it.inning == inn }
            val isSubPlay = ev != null && hasSub && ev.batterName == players[1]

            if (isSubPlay && tr1 != null) {
                tr0.td { renderInningCell(null, cellBg) }
                tr1.td { renderInningCell(ev, cellBg) }
            } else {
                tr0.td { renderInningCell(ev, cellBg) }
                if (hasSub && tr1 != null) {
                    tr1.td { renderInningCell(null, cellBg) }
                }
            }
        }

        val stat0 = battingStatsList.find { it.playerName == pName0 }
        tr0.td {
            +(stat0?.atBats?.toString() ?: "0")
            style = "border-left: 2px solid #5a544a; border-right: 1px solid #9c9384; text-align: center; font-weight: bold; background: $cellBg;"
        }
        tr0.td {
            +(stat0?.runs?.toString() ?: "0")
            style = "border-right: 1px solid #9c9384; text-align: center; font-weight: bold; background: $cellBg;"
        }
        tr0.td {
            +(stat0?.hits?.toString() ?: "0")
            style = "border-right: 1px solid #9c9384; text-align: center; font-weight: bold; background: $cellBg;"
        }
        tr0.td {
            +(stat0?.rbi?.toString() ?: "0")
            style = "border-right: 1px solid #9c9384; text-align: center; font-weight: bold; background: $cellBg;"
        }

        if (hasSub && tr1 != null) {
            val stat1 = battingStatsList.find { it.playerName == pName1 }
            tr1.td {
                +(stat1?.atBats?.toString() ?: "")
                style = "border-left: 2px solid #5a544a; border-right: 1px solid #9c9384; text-align: center; font-weight: bold; background: $cellBg;"
            }
            tr1.td {
                +(stat1?.runs?.toString() ?: "")
                style = "border-right: 1px solid #9c9384; text-align: center; font-weight: bold; background: $cellBg;"
            }
            tr1.td {
                +(stat1?.hits?.toString() ?: "")
                style = "border-right: 1px solid #9c9384; text-align: center; font-weight: bold; background: $cellBg;"
            }
            tr1.td {
                +(stat1?.rbi?.toString() ?: "")
                style = "border-right: 1px solid #9c9384; text-align: center; font-weight: bold; background: $cellBg;"
            }
        }
    }

    val rheTr = tbodyEl.tr {
        style = "background-color: #eae5dc; border-top: 2px solid #5a544a; height: 40px;"
    }
    rheTr.td {
        colSpan = "2"
        +"RUNS-HITS-ERRORS"
        style = "border-right: 2px solid #5a544a; padding: 0.5rem; font-weight: bold; font-size: 0.75rem; white-space: nowrap;"
    }
    for (inn in 1..maxInning) {
        val innEvents = teamEvents.filter { it.inning == inn }
        val runs = innEvents.sumOf { it.runsScoredOnPlay }
        val hits = innEvents.count { it.eventType in listOf(ScoringEventType.SINGLE, ScoringEventType.DOUBLE, ScoringEventType.TRIPLE, ScoringEventType.HOME_RUN) }
        val errors = innEvents.count { it.eventType == ScoringEventType.ERROR }

        rheTr.td {
            +"$runs-$hits-$errors"
            style = "border-right: 1px solid #9c9384; text-align: center; font-weight: bold; font-size: 0.75rem; color: #ff2a3b; white-space: nowrap; width: 75px; position: relative;"

            div {
                style = "position: absolute; top: 0; right: 0; width: 100%; height: 100%; background: linear-gradient(to top right, transparent calc(50% - 0.5px), #5a544a, transparent calc(50% + 1px)); pointer-events: none; opacity: 0.3;"
            }
        }
    }
    for (s in 1..4) {
        rheTr.td {
            style = "border-right: 1px solid #9c9384;"
        }
    }

    renderScorebookBottomSection(
        container = container,
        game = game,
        boxScore = boxScore,
        isHomeBatting = isHomeBatting,
        maxInning = maxInning,
        localAwayRoster = localAwayRoster,
        localHomeRoster = localHomeRoster,
        localAwayActivePitcherId = localAwayActivePitcherId,
        localHomeActivePitcherId = localHomeActivePitcherId,
        localAwayActivePitcherName = localAwayActivePitcherName,
        localHomeActivePitcherName = localHomeActivePitcherName
    )
}

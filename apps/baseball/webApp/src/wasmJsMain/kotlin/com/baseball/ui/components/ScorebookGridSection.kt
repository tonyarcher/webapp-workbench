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

fun renderScorecardSheet(container: HTMLElement, game: Game, boxScore: BoxScore, events: List<PlayEvent>, half: HalfInning) {
    val isHomeBatting = half == HalfInning.BOTTOM
    val battingTeam = if (isHomeBatting) game.homeTeam else game.awayTeam
    val pitchingTeam = if (isHomeBatting) game.awayTeam else game.homeTeam
    val battingStatsList = if (isHomeBatting) boxScore.homeBatting else boxScore.awayBatting
    val teamEvents = events.filter { it.half == half }

    val slots = Array(9) { mutableListOf<PlayEvent>() }
    teamEvents.forEachIndexed { index, event -> slots[index % 9].add(event) }

    val slotPlayers = buildSlotPlayers(isHomeBatting, slots)
    val maxInning = events.maxOfOrNull { it.inning }?.coerceAtLeast(9) ?: 9

    val parser = ScorecardParser(teamEvents, localAwayRoster, localHomeRoster, maxInning)

    renderHeaderPanel(container, isHomeBatting, game, battingTeam, pitchingTeam)
    renderRosterDrawer(container, isHomeBatting, game)
    renderScorecardTable(container, game, slotPlayers, battingStatsList, teamEvents, maxInning, parser, isHomeBatting)

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

private fun DIV.renderHeaderPanelCol1(isHomeBatting: Boolean) {
    div {
        +(if (isHomeBatting) "BOTTOM" else "TOP")
        style = "font-size: 2rem; color: #ff2a3b; letter-spacing: 2px;"
    }
}

private fun DIV.renderHeaderPanelCol2(battingTeam: Team, isHomeBatting: Boolean) {
    div {
        style = "display: flex; flex-direction: column; justify-content: center;"
        div { +"TEAM: ${battingTeam.city.uppercase()} ${battingTeam.name.uppercase()}" }
        div {
            +"MANAGER: ${if (isHomeBatting) "COUNSELL, C." else "REYNOLDS, J."}"
            style = "font-size: 0.85rem; color: #555; margin-top: 0.25rem;"
        }
    }
}

private fun DIV.renderHeaderPanelCol3(pitchingTeam: Team) {
    div {
        style = "display: flex; flex-direction: column; justify-content: center;"
        div { +"PITCHING OPPONENT: ${pitchingTeam.name.uppercase()}" }
        div {
            +"UMPIRES: HP: CULBRETH, F. | 1B: NELSON, J."
            style = "font-size: 0.85rem; color: #555; margin-top: 0.25rem;"
        }
    }
}

private fun DIV.renderHeaderPanelCol4(game: Game) {
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

private fun renderHeaderPanel(container: HTMLElement, isHomeBatting: Boolean, game: Game, battingTeam: Team, pitchingTeam: Team) {
    container.div {
        style = "display: grid; grid-template-columns: 150px 1fr 1fr 180px; border: 2px solid #5a544a; background-color: #eae5dc; padding: 0.75rem; margin-bottom: 1rem; font-weight: bold;"
        renderHeaderPanelCol1(isHomeBatting)
        renderHeaderPanelCol2(battingTeam, isHomeBatting)
        renderHeaderPanelCol3(pitchingTeam)
        renderHeaderPanelCol4(game)
    }
}

private fun renderRosterDrawer(container: HTMLElement, isHomeBatting: Boolean, game: Game) {
    val isHome = !isHomeBatting
    val fieldingBench = if (isHome) localHomeBench else localAwayBench
    val activePitcherName = if (isHome) localHomeActivePitcherName else localAwayActivePitcherName
    val benchList = if (isHomeBatting) localHomeBench else localAwayBench

    container.div {
        id = "roster-drawer-element"
        style = "display: none; background-color: #fcfbfa; border: 2px solid #5a544a; border-top: none; padding: 1rem; margin-top: -1.1rem; margin-bottom: 1.5rem; font-family: 'Courier New', Courier, monospace;"

        div {
            style = "display: flex; justify-content: space-between; gap: 2rem;"
            renderBenchBattersList(this, benchList)
            renderBullpenSection(this, isHome, activePitcherName, fieldingBench)
        }
    }
}

private fun DIV.renderBenchBattersList(parent: DIV, benchList: List<Player>) {
    parent.div {
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
}

private fun DIV.renderBullpenSection(parent: DIV, isHome: Boolean, activePitcherName: String, fieldingBench: List<Player>) {
    parent.div {
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
            renderPitcherSelector(this, isHome, pSubs)
        }
    }
}

private fun DIV.renderPitcherSelector(parent: DIV, isHome: Boolean, pSubs: List<Player>) {
    parent.div {
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

private fun renderScorecardTable(
    container: HTMLElement,
    game: Game,
    slotPlayers: Array<MutableList<String>>,
    battingStatsList: List<PlayerBattingStats>,
    teamEvents: List<PlayEvent>,
    maxInning: Int,
    parser: ScorecardParser,
    isHomeBatting: Boolean
) {
    val tableWrapper = container.div {
        style = "overflow-x: auto; border: 2px solid #5a544a; margin-bottom: 1.5rem;"
    }

    val tableEl = tableWrapper.table {
        style = "width: 100%; border-collapse: collapse; background-color: #f9f7f2;"
    }

    renderTableHeader(tableEl, maxInning)

    val tbodyEl = tableEl.tbody { }

    for (slotIdx in 0..8) {
        renderSlotRows(tbodyEl, game, slotIdx, slotPlayers[slotIdx], battingStatsList, teamEvents, maxInning, parser, isHomeBatting)
    }

    renderSummaryRow(tbodyEl, teamEvents, maxInning)
}

private fun renderTableHeader(tableEl: HTMLTableElement, maxInning: Int) {
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
}

private fun renderSubRow(tbodyEl: HTMLTableSectionElement, slotIdx: Int, pName1: String, battingStatsList: List<PlayerBattingStats>, cellBg: String, game: Game, isHomeBatting: Boolean): HTMLTableRowElement {
    val tr1 = tbodyEl.tr {
        style = "border-bottom: 1px solid #5a544a; height: 42.5px;"
    }
    val subPos = battingStatsList.find { it.playerName == pName1 }?.position ?: BaseballConstants.Positions.DH
    renderPlayerCell(tr1, slotIdx, pName1, false, cellBg, game, isHomeBatting)
    tr1.td {
        +subPos
        style = "border-right: 2px solid #5a544a; padding: 0.5rem; text-align: center; font-weight: bold; background: $cellBg;"
    }
    return tr1
}

private fun renderSlotRows(
    tbodyEl: HTMLTableSectionElement,
    game: Game,
    slotIdx: Int,
    players: List<String>,
    battingStatsList: List<PlayerBattingStats>,
    teamEvents: List<PlayEvent>,
    maxInning: Int,
    parser: ScorecardParser,
    isHomeBatting: Boolean
) {
    val hasSub = players.size > 1
    val cellBg = if (slotIdx % 2 == 1) "linear-gradient(180deg, #f4f1e7 0%, #ebe6d9 100%)" else "linear-gradient(180deg, #faf9f6 0%, #f3f0e8 100%)"

    val pName0 = players.getOrNull(0) ?: ""
    val starterPos = battingStatsList.find { it.playerName == pName0 }?.position ?: BaseballConstants.Positions.DH

    val tr0 = tbodyEl.tr {
        style = "border-bottom: ${if (hasSub) "1px solid #9c9384" else "1px solid #5a544a"}; height: 42.5px;"
    }

    renderPlayerCell(tr0, slotIdx, pName0, hasSub, cellBg, game, isHomeBatting)

    tr0.td {
        +starterPos
        style = "border-right: 2px solid #5a544a; padding: 0.5rem; text-align: center; font-weight: bold; background: $cellBg;"
    }

    var tr1: HTMLTableRowElement? = null
    var pName1 = ""

    if (hasSub) {
        pName1 = players[1]
        tr1 = renderSubRow(tbodyEl, slotIdx, pName1, battingStatsList, cellBg, game, isHomeBatting)
    }

    renderInningCells(tr0, tr1, slotIdx, players, teamEvents, maxInning, parser, cellBg)
    renderStatCells(tr0, tr1, pName0, pName1, hasSub, battingStatsList, cellBg)
}

private fun DIV.renderSubButton(slotIdx: Int, isHomeBatting: Boolean) {
    button {
        +"Sub"
        style = "padding: 2px 6px; font-size: 0.7rem; background-color: #5a544a; color: white; font-weight: bold; border: none; border-radius: 4px; cursor: pointer;"
        onClickFunction = { event ->
            val btnEl = event.target as? HTMLButtonElement
            val parentCell = btnEl?.parentElement?.parentElement as? HTMLElement
            if (parentCell != null) {
                openSubSelector(parentCell, slotIdx, isHomeBatting)
            }
        }
    }
}

private fun renderPlayerCell(
    tr: HTMLTableRowElement,
    slotIdx: Int,
    pName: String,
    hasSub: Boolean,
    cellBg: String,
    game: Game,
    isHomeBatting: Boolean
) {
    tr.td {
        style = "border-right: 2px solid #5a544a; padding: 0 0.5rem; vertical-align: middle; background: $cellBg; height: 42.5px;"
        div {
            style = "display: flex; justify-content: space-between; align-items: center; width: 100%;"
            span {
                +pName
                style = "font-weight: bold; font-family: 'Courier New', Courier, monospace;"
            }
            if (!hasSub && game.status != GameStatus.COMPLETED) {
                renderSubButton(slotIdx, isHomeBatting)
            }
        }
    }
}

private fun renderInningCells(
    tr0: HTMLTableRowElement,
    tr1: HTMLTableRowElement?,
    slotIdx: Int,
    players: List<String>,
    teamEvents: List<PlayEvent>,
    maxInning: Int,
    parser: ScorecardParser,
    cellBg: String
) {
    val hasSub = players.size > 1
    for (inn in 1..maxInning) {
        val ev = teamEvents.find { (teamEvents.indexOf(it) % 9 == slotIdx) && it.inning == inn }
        val isSubPlay = ev != null && hasSub && ev.batterName == players[1]

        if (isSubPlay && tr1 != null) {
            tr0.td { renderInningCell(this, null, cellBg, teamEvents, parser) }
            tr1.td { renderInningCell(this, ev, cellBg, teamEvents, parser) }
        } else {
            tr0.td { renderInningCell(this, ev, cellBg, teamEvents, parser) }
            if (hasSub && tr1 != null) {
                tr1.td { renderInningCell(this, null, cellBg, teamEvents, parser) }
            }
        }
    }
}

private fun renderStatCells(
    tr0: HTMLTableRowElement,
    tr1: HTMLTableRowElement?,
    pName0: String,
    pName1: String,
    hasSub: Boolean,
    battingStatsList: List<PlayerBattingStats>,
    cellBg: String
) {
    val stat0 = battingStatsList.find { it.playerName == pName0 }
    listOf(stat0?.atBats, stat0?.runs, stat0?.hits, stat0?.rbi).forEachIndexed { i, stat ->
        tr0.td {
            +(stat?.toString() ?: "0")
            style = "${if (i == 0) "border-left: 2px solid #5a544a; " else ""}border-right: 1px solid #9c9384; text-align: center; font-weight: bold; background: $cellBg;"
        }
    }

    if (hasSub && tr1 != null) {
        val stat1 = battingStatsList.find { it.playerName == pName1 }
        listOf(stat1?.atBats, stat1?.runs, stat1?.hits, stat1?.rbi).forEachIndexed { i, stat ->
            tr1.td {
                +(stat?.toString() ?: "")
                style = "${if (i == 0) "border-left: 2px solid #5a544a; " else ""}border-right: 1px solid #9c9384; text-align: center; font-weight: bold; background: $cellBg;"
            }
        }
    }
}

private fun renderSummaryRow(tbodyEl: HTMLTableSectionElement, teamEvents: List<PlayEvent>, maxInning: Int) {
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
        rheTr.td { style = "border-right: 1px solid #9c9384;" }
    }
}

private fun renderInningCell(td: TD, ev: PlayEvent?, cellBg: String, teamEvents: List<PlayEvent>, parser: ScorecardParser) {
    td.style = "border-right: 1px solid #9c9384; padding: 0; height: 42.5px; width: 75px; background: $cellBg;"
    td.div {
        style = "position: relative; width: 100%; height: 100%; box-sizing: border-box; padding: 2px; overflow: hidden;"
        if (ev != null) {
            val prog = parser.playProgressions[ev]
            val base = prog?.maxBase ?: (parser.playAdvancements[ev] ?: 0)
            val outNum = parser.playOutNumbers[ev]
            val outAtBase = prog?.outAtBase
            val outDetail = prog?.outDetail
            val notation = getScorebookNotation(ev)

            renderInningDiamond(this, base)
            renderOutDetails(this, outAtBase, outDetail)
            div {
                +notation
                style = "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: bold; font-size: 0.75rem; z-index: 2;"
            }
            renderCountBallsStrikes(this, ev)
            renderOutCircle(this, outNum)
            renderEndedInningDiagonal(this, ev, teamEvents)
        } else {
            div {
                style = "position: absolute; top: 50%; left: 50%; width: 8px; height: 8px; margin-top: -4px; margin-left: -4px; border: 1px dashed #e2ded5; transform: rotate(45deg);"
            }
        }
    }
}

private fun renderInningDiamond(parent: DIV, base: Int) {
    parent.div {
        style = "position: absolute; top: 50%; left: 50%; width: 26px; height: 26px; margin-top: -13px; margin-left: -13px; border: 1px dashed #d2cdc6; transform: rotate(45deg); z-index: 1;"
        if (base >= 1) style += " border-right: 2px solid #ff2a3b;"
        if (base >= 2) style += " border-top: 2px solid #ff2a3b;"
        if (base >= 3) style += " border-left: 2px solid #ff2a3b;"
        if (base >= 4) style += " border-bottom: 2px solid #ff2a3b; background-color: rgba(255, 42, 59, 0.25);"
    }
}

private fun renderOutDetails(parent: DIV, outAtBase: Int?, outDetail: String?) {
    if (outAtBase != null && outDetail != null && outAtBase > 1) {
        parent.div {
            +outDetail
            style = "position: absolute; " + when (outAtBase) {
                2 -> "top: 2px; right: 2px;"
                3 -> "top: 2px; left: 2px;"
                4 -> "bottom: 2px; left: 2px;"
                else -> ""
            } + " font-size: 0.5rem; color: #ff2a3b; font-weight: bold; background-color: rgba(255, 255, 255, 0.85); padding: 1px 2px; border-radius: 2px; z-index: 5;"
        }
    }
}

private fun renderCountBallsStrikes(parent: DIV, ev: PlayEvent) {
    parent.div {
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
}

private fun renderOutCircle(parent: DIV, outNum: Int?) {
    if (outNum != null) {
        parent.div {
            +outNum.toString()
            style = "position: absolute; bottom: 2px; right: 10px; width: 11px; height: 11px; border: 1px solid #ff2a3b; border-radius: 50%; font-size: 0.55rem; display: flex; justify-content: center; align-items: center; color: #ff2a3b; font-weight: bold; z-index: 3;"
        }
    }
}

private fun renderEndedInningDiagonal(parent: DIV, ev: PlayEvent, teamEvents: List<PlayEvent>) {
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
        parent.div {
            style = "position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; background: linear-gradient(to bottom right, transparent calc(50% - 0.5px), #ff2a3b, transparent calc(50% + 1px)); pointer-events: none; z-index: 4;"
        }
    }
}

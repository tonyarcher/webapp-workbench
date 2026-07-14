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

fun renderScorecardSheet(container: HTMLElement, game: Game, boxScore: BoxScore, events: List<PlayEvent>, half: HalfInning) {
    ScorebookGridRenderer.renderScorecardSheet(container, game, boxScore, events, half)
}

object ScorebookGridRenderer : ScorecardUiPresenter {
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
                style = "display: flex; gap: 2rem;"
                div {
                    style = "flex: 1;"
                    h4 { +"BENCH BATTERS" }
                    val batters = benchList.filter { it.position != BaseballConstants.Positions.P && !localPlayersSubbedOut.contains(it.id) }
                    if (batters.isEmpty()) {
                        p { +"None available" }
                    } else {
                        batters.forEach { p ->
                            div { +"#${p.jerseyNumber} ${p.name} (${p.position})" }
                        }
                    }
                }
                div {
                    style = "flex: 1;"
                    h4 { +"BULLPEN" }
                    val pitchers = fieldingBench.filter { it.position == BaseballConstants.Positions.P && it.name != activePitcherName }
                    if (pitchers.isEmpty()) {
                        p { +"None available" }
                    } else {
                        pitchers.forEach { p ->
                            div {
                                +"#${p.jerseyNumber} ${p.name} (LHP/RHP)"
                                if (game.status != GameStatus.COMPLETED) {
                                    button(classes = "btn") {
                                        +"Call up"
                                        style = "margin-left: 0.5rem; font-size: 0.7rem; padding: 1px 4px;"
                                        onClickFunction = {
                                            substitutePitcher(isHome, p.id!!)
                                            renderCurrentTab()
                                        }
                                    }
                                }
                            }
                        }
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
        val divWrapper = container.append.div {
            style = "width: 100%; overflow-x: auto; border: 2px solid #5a544a;"
        }
        val tableEl = divWrapper.table {
            style = "border-collapse: collapse; background-color: #faf9f6; min-width: 1000px; width: 100%; color: #2b2a28; font-size: 0.85rem;"
        }
        val theadEl = tableEl.thead {
            style = "background: #eae5dc; border-bottom: 2px solid #5a544a;"
        }
        val theadTr = theadEl.tr {
            style = "height: 35px;"
        }

        theadTr.th {
            +"BATTERS"
            style = "border-right: 2px solid #5a544a; padding: 0.5rem; text-align: left; width: 180px;"
        }
        theadTr.th {
            +"POS"
            style = "border-right: 2px solid #5a544a; padding: 0.5rem; text-align: center; width: 45px;"
        }

        for (inn in 1..maxInning) {
            theadTr.th {
                +inn.toString()
                style = "border-right: 1px solid #9c9384; width: 75px; text-align: center;"
            }
        }

        listOf("AB", "R", "H", "RBI").forEach { sh ->
            theadTr.th {
                +sh
                style = "border-left: ${if (sh == "AB") "2px solid #5a544a" else "1px solid #9c9384"}; width: 45px; text-align: center;"
            }
        }

        val tbodyEl = tableEl.tbody {}
        for (slotIdx in 0..8) {
            val players = slotPlayers[slotIdx]
            renderSlotRows(tbodyEl, game, slotIdx, players, battingStatsList, teamEvents, maxInning, parser, isHomeBatting)
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
        val stat1 = if (hasSub) battingStatsList.find { it.playerName == pName1 } else null

        listOf(
            { s: PlayerBattingStats? -> s?.atBats?.toString() ?: "0" },
            { s: PlayerBattingStats? -> s?.runs?.toString() ?: "0" },
            { s: PlayerBattingStats? -> s?.hits?.toString() ?: "0" },
            { s: PlayerBattingStats? -> s?.rbi?.toString() ?: "0" }
        ).forEachIndexed { statIdx, selector ->
            val val0 = selector(stat0)
            val val1 = selector(stat1)
            tr0.td {
                +val0
                style = "border-left: ${if (statIdx == 0) "2px solid #5a544a" else "1px solid #9c9384"}; text-align: center; background: $cellBg; font-weight: bold;"
            }
            if (hasSub && tr1 != null) {
                tr1.td {
                    +val1
                    style = "border-left: ${if (statIdx == 0) "2px solid #5a544a" else "1px solid #9c9384"}; text-align: center; background: $cellBg; font-weight: bold;"
                }
            }
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
                    style = "width: 100%; height: 100%;"
                }
            }
        }
    }

    private fun DIV.renderInningDiamond(parent: DIV, base: Int) {
        parent.div {
            style = "position: absolute; top: 8px; left: 24px; width: 24px; height: 24px; border: 1px solid #dcd8cf; transform: rotate(45deg); z-index: 1;"
            if (base >= 1) {
                div {
                    style = "position: absolute; bottom: -1px; right: -1px; width: 13px; height: 1px; background-color: #5a544a; transform: rotate(-45deg); transform-origin: bottom right;"
                }
            }
            if (base >= 2) {
                div {
                    style = "position: absolute; top: -1px; right: -1px; width: 13px; height: 1px; background-color: #5a544a; transform: rotate(45deg); transform-origin: top right;"
                }
            }
            if (base >= 3) {
                div {
                    style = "position: absolute; top: -1px; left: -1px; width: 13px; height: 1px; background-color: #5a544a; transform: rotate(-45deg); transform-origin: top left;"
                }
            }
            if (base >= 4) {
                div {
                    style = "position: absolute; bottom: -1px; left: -1px; width: 13px; height: 1px; background-color: #5a544a; transform: rotate(45deg); transform-origin: bottom left;"
                }
                div {
                    style = "position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; background-color: rgba(90, 84, 74, 0.2);"
                }
            }
        }
    }

    private fun DIV.renderOutDetails(parent: DIV, outAtBase: Int?, outDetail: String?) {
        if (outAtBase != null && outDetail != null) {
            parent.div {
                +outDetail
                val (t, l) = when (outAtBase) {
                    1 -> Pair("18px", "48px")
                    2 -> Pair("1px", "32px")
                    3 -> Pair("18px", "12px")
                    else -> Pair("30px", "32px")
                }
                style = "position: absolute; top: $t; left: $l; font-size: 0.65rem; color: #ff2a3b; font-weight: bold; z-index: 3;"
            }
        }
    }

    private fun DIV.renderCountBallsStrikes(parent: DIV, ev: PlayEvent) {
        if (ev.balls > 0 || ev.strikes > 0) {
            parent.div {
                style = "position: absolute; top: 2px; left: 4px; font-size: 0.6rem; color: #777; font-family: monospace;"
                +"${ev.balls}-${ev.strikes}"
            }
        }
    }

    private fun DIV.renderOutCircle(parent: DIV, outNum: Int?) {
        if (outNum != null) {
            parent.div {
                +outNum.toString()
                style = "position: absolute; bottom: 2px; left: 4px; width: 11px; height: 11px; border: 1px solid #ff2a3b; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 0.55rem; color: #ff2a3b; font-weight: bold;"
            }
        }
    }

    private fun DIV.renderEndedInningDiagonal(parent: DIV, ev: PlayEvent, teamEvents: List<PlayEvent>) {
        val playIdx = teamEvents.indexOf(ev)
        val nextPlay = teamEvents.getOrNull(playIdx + 1)
        val endedInning = ev.outsAfter == 3 && (nextPlay == null || nextPlay.inning > ev.inning)
        if (endedInning) {
            parent.div {
                style = "position: absolute; bottom: -10px; right: -10px; width: 35px; height: 1px; background-color: #5a544a; transform: rotate(-45deg); transform-origin: bottom right; z-index: 4;"
            }
        }
    }
}

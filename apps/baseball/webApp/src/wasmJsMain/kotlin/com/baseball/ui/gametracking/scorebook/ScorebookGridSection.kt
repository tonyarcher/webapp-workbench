package com.baseball.ui.gametracking.scorebook

import com.baseball.game.BaseballConstants
import com.baseball.game.localAwayActivePitcherId
import com.baseball.game.localAwayActivePitcherName
import com.baseball.game.localAwayBench
import com.baseball.game.localAwayRoster
import com.baseball.game.localHomeActivePitcherId
import com.baseball.game.localHomeActivePitcherName
import com.baseball.game.localHomeBench
import com.baseball.game.localHomeRoster
import com.baseball.game.localPlayersSubbedOut
import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.models.HalfInning
import com.baseball.models.PlayEvent
import com.baseball.models.Player
import com.baseball.models.PlayerBattingStats
import com.baseball.models.Team
import com.baseball.ui.core.DomUiConstants
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.substitutePitcher
import kotlinx.browser.document
import kotlinx.html.DIV
import kotlinx.html.TD
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h4
import kotlinx.html.id
import kotlinx.html.js.div
import kotlinx.html.js.onClickFunction
import kotlinx.html.js.td
import kotlinx.html.js.tr
import kotlinx.html.p
import kotlinx.html.span
import kotlinx.html.table
import kotlinx.html.tbody
import kotlinx.html.th
import kotlinx.html.thead
import kotlinx.html.tr
import org.w3c.dom.HTMLButtonElement
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLTableRowElement
import org.w3c.dom.HTMLTableSectionElement

fun renderScorecardSheet(
    container: HTMLElement,
    game: Game,
    boxScore: BoxScore,
    events: List<PlayEvent>,
    half: HalfInning,
) {
    ScorebookGridRenderer.renderScorecardSheet(container, game, boxScore, events, half)
}

object ScorebookGridRenderer : ScorecardUiPresenter {
    fun renderScorecardSheet(
        container: HTMLElement,
        game: Game,
        boxScore: BoxScore,
        events: List<PlayEvent>,
        half: HalfInning,
    ) {
        val isHomeBatting = half == HalfInning.BOTTOM
        val battingTeam = if (isHomeBatting) game.homeTeam else game.awayTeam
        val pitchingTeam = if (isHomeBatting) game.awayTeam else game.homeTeam
        val teamEvents = events.filter { it.half == half }
        val maxInning = events.maxOfOrNull { it.inning }?.coerceAtLeast(9) ?: 9

        val params = createRenderParams(isHomeBatting, boxScore, teamEvents, maxInning)

        ScorebookHeaderPanelUi.renderHeaderPanel(container, isHomeBatting, game, battingTeam, pitchingTeam)
        ScorebookRosterDrawerUi.renderRosterDrawer(container, isHomeBatting, game)
        ScorebookTableGridUi.renderScorecardTable(container, game, params)

        renderScorebookBottomSection(
            container = container,
            isHomeBatting = isHomeBatting,
            teamState = ScorebookTeamState(
                awayRoster = localAwayRoster,
                homeRoster = localHomeRoster,
                awayActivePitcherId = localAwayActivePitcherId,
                homeActivePitcherId = localHomeActivePitcherId,
                awayActivePitcherName = localAwayActivePitcherName,
                homeActivePitcherName = localHomeActivePitcherName,
            ),
            data = ScorebookSectionData(
                game = game,
                boxScore = boxScore,
                maxInning = maxInning,
            ),
        )
    }

    private fun createRenderParams(
        isHomeBatting: Boolean,
        boxScore: BoxScore,
        teamEvents: List<PlayEvent>,
        maxInning: Int,
    ): ScorecardRenderParams {
        val battingStatsList = if (isHomeBatting) boxScore.homeBatting else boxScore.awayBatting
        val slots = Array(9) { mutableListOf<PlayEvent>() }
        teamEvents.forEachIndexed { index, event -> slots[index % 9].add(event) }
        val playersByBattingSlot = buildPlayersByBattingSlot(isHomeBatting, slots)
        val parser = ScorecardParser(teamEvents, localAwayRoster, localHomeRoster, maxInning)
        return ScorecardRenderParams(
            playersByBattingSlot = playersByBattingSlot,
            battingStatsList = battingStatsList,
            teamEvents = teamEvents,
            maxInning = maxInning,
            parser = parser,
            isHomeBatting = isHomeBatting,
        )
    }
}

private object ScorebookHeaderPanelUi {
    fun renderHeaderPanel(
        container: HTMLElement,
        isHomeBatting: Boolean,
        game: Game,
        battingTeam: Team,
        pitchingTeam: Team,
    ) {
        container.append {
            div(classes = "scorebook-header-panel") {
                renderHeaderPanelCol1(isHomeBatting)
                renderHeaderPanelCol2(battingTeam, isHomeBatting)
                renderHeaderPanelCol3(pitchingTeam)
                renderHeaderPanelCol4(game)
            }
        }
    }

    private fun DIV.renderHeaderPanelCol1(isHomeBatting: Boolean) {
        div(classes = "scorebook-half-tag") {
            +(if (isHomeBatting) "BOTTOM" else "TOP")
        }
    }

    private fun DIV.renderHeaderPanelCol2(
        battingTeam: Team,
        isHomeBatting: Boolean,
    ) {
        div(classes = "scorebook-team-info") {
            div { +"TEAM: ${battingTeam.city.uppercase()} ${battingTeam.name.uppercase()}" }
            div(classes = "scorebook-manager-tag") {
                +"MANAGER: ${if (isHomeBatting) "COUNSELL, C." else "REYNOLDS, J."}"
            }
        }
    }

    private fun DIV.renderHeaderPanelCol3(pitchingTeam: Team) {
        div(classes = "scorebook-pitcher-info") {
            div { +"PITCHING OPPONENT: ${pitchingTeam.name.uppercase()}" }
            div(classes = "scorebook-umpire-tag") {
                +"UMPIRES: HP: CULBRETH, F. | 1B: NELSON, J."
            }
        }
    }

    private fun DIV.renderHeaderPanelCol4(game: Game) {
        div(classes = "scorebook-meta-col") {
            div { +"KEEPING SCORE BY: ☑ WEBAPP" }
            div { +"FIRST PITCH: 7:05 PM" }
            renderBenchButton(game)
        }
    }

    private fun DIV.renderBenchButton(game: Game) {
        if (game.status != GameStatus.COMPLETED) {
            button(classes = "btn scorebook-bench-btn") {
                +"Bench & Bullpen"
                onClickFunction = {
                    val drawer = document.getElementById("roster-drawer-element") as? HTMLElement
                    if (drawer != null) {
                        val isHidden = drawer.style.getPropertyValue(DomUiConstants.Css.DISPLAY) ==
                                DomUiConstants.CssValues.NONE
                        drawer.style.setProperty(
                            DomUiConstants.Css.DISPLAY,
                            if (isHidden) DomUiConstants.CssValues.BLOCK else DomUiConstants.CssValues.NONE,
                        )
                    }
                }
            }
        }
    }
}

private object ScorebookRosterDrawerUi {
    fun renderRosterDrawer(
        container: HTMLElement,
        isHomeBatting: Boolean,
        game: Game,
    ) {
        val isHome = !isHomeBatting
        val fieldingBench = if (isHome) localHomeBench else localAwayBench
        val activePitcherName = if (isHome) localHomeActivePitcherName else localAwayActivePitcherName
        val benchList = if (isHomeBatting) localHomeBench else localAwayBench

        container.append {
            div(classes = "roster-drawer") {
                id = "roster-drawer-element"
                div(classes = "roster-drawer-inner") {
                    renderBenchBattersCol(benchList)
                    renderBullpenCol(fieldingBench, activePitcherName, isHome, game)
                }
            }
        }
    }

    private fun DIV.renderBenchBattersCol(benchList: List<Player>) {
        div(classes = "roster-drawer-col") {
            h4 { +"BENCH BATTERS" }
            val batters = benchList.filter {
                it.position != BaseballConstants.Positions.P && !localPlayersSubbedOut.contains(it.id)
            }
            if (batters.isEmpty()) {
                p { +"None available" }
            } else {
                batters.forEach { p ->
                    div { +"#${p.jerseyNumber} ${p.name} (${p.position})" }
                }
            }
        }
    }

    private fun DIV.renderBullpenCol(
        fieldingBench: List<Player>,
        activePitcherName: String,
        isHome: Boolean,
        game: Game,
    ) {
        div(classes = "roster-drawer-col") {
            h4 { +"BULLPEN" }
            val pitchers = fieldingBench.filter {
                it.position == BaseballConstants.Positions.P && it.name != activePitcherName
            }
            if (pitchers.isEmpty()) {
                p { +"None available" }
            } else {
                pitchers.forEach { p ->
                    div {
                        +"#${p.jerseyNumber} ${p.name} (LHP/RHP)"
                        renderCallUpButton(game, isHome, p.id)
                    }
                }
            }
        }
    }

    private fun DIV.renderCallUpButton(game: Game, isHome: Boolean, pitcherId: Long?) {
        if (game.status != GameStatus.COMPLETED && pitcherId != null) {
            button(classes = "btn callup-btn") {
                +"Call up"
                onClickFunction = {
                    substitutePitcher(isHome, pitcherId)
                    renderCurrentTab()
                }
            }
        }
    }
}

private object ScorebookTableGridUi {
    fun renderScorecardTable(
        container: HTMLElement,
        game: Game,
        params: ScorecardRenderParams,
    ) {
        ScorebookTableContainerUi.buildScorecardTableHtml(container, params.maxInning)
        populateTableSlots(container, game, params)
    }

    private fun populateTableSlots(
        container: HTMLElement,
        game: Game,
        params: ScorecardRenderParams,
    ) {
        val tableEl = container.querySelector("#scorecard-table-el") as HTMLElement
        val tbodyEl = tableEl.querySelector("#scorebook-tbody") as HTMLTableSectionElement
        for (slotIdx in 0..8) {
            val players = params.playersByBattingSlot[slotIdx]
            renderSlotRows(tbodyEl, game, slotIdx, players, params)
        }
    }

    private fun renderSubRow(
        tbodyEl: HTMLTableSectionElement,
        slotIdx: Int,
        rowRenderData: RowRenderData,
        game: Game,
        params: ScorecardRenderParams,
    ): HTMLTableRowElement {
        val rowId = "sub-row-$slotIdx"
        tbodyEl.append {
            tr {
                id = rowId
            }
        }
        val tr1 = tbodyEl.querySelector("#$rowId") as HTMLTableRowElement
        val subPos = params.battingStatsList.find { it.playerName == rowRenderData.substitutePlayerName }?.position
            ?: BaseballConstants.Positions.DH
        ScorebookRowCellUi.renderPlayerCell(
            tr1,
            game,
            PlayerCellData(
                slotIdx,
                rowRenderData.substitutePlayerName,
                false,
                params.isHomeBatting,
                rowRenderData.cellBackground,
            )
        )
        ScorebookRowCellUi.renderPosTd(tr1, subPos)
        return tr1
    }

    private fun createSlotRow(tbodyEl: HTMLTableSectionElement, rowId: String): HTMLTableRowElement {
        tbodyEl.append {
            tr {
                id = rowId
            }
        }
        return tbodyEl.querySelector("#$rowId") as HTMLTableRowElement
    }

    private fun renderSlotRows(
        tbodyEl: HTMLTableSectionElement,
        game: Game,
        slotIdx: Int,
        players: List<String>,
        params: ScorecardRenderParams,
    ) {
        val hasSub = players.size > 1
        val cellBackground = getCellBackground(slotIdx)

        val playerName0 = players.getOrNull(0) ?: ""
        val starterPos =
            params.battingStatsList.find { it.playerName == playerName0 }?.position ?: BaseballConstants.Positions.DH

        val tr0 = createSlotRow(tbodyEl, "slot-row-$slotIdx")

        ScorebookRowCellUi.renderPlayerCell(
            tr0,
            game,
            PlayerCellData(slotIdx, playerName0, hasSub, params.isHomeBatting, cellBackground)
        )
        ScorebookRowCellUi.renderPosTd(tr0, starterPos)

        var tr1: HTMLTableRowElement? = null
        if (hasSub) {
            val substitutePlayerName = players[1]
            tr1 = renderSubRow(tbodyEl, slotIdx, RowRenderData(substitutePlayerName, cellBackground), game, params)
        }

        ScorebookInningCellUi.renderInningCells(tr0, tr1, RowData(slotIdx, players, cellBackground), params)
        ScorebookRowCellUi.renderStatCells(tr0, tr1, RowData(slotIdx, players, cellBackground), params)
    }

    private fun getCellBackground(slotIdx: Int) =
        if (slotIdx % 2 == 1) {
            "linear-gradient(180deg, #f4f1e7 0%, #ebe6d9 100%)"
        } else {
            "linear-gradient(180deg, #faf9f6 0%, #f3f0e8 100%)"
        }
}

private object ScorebookTableContainerUi {
    fun buildScorecardTableHtml(container: HTMLElement, maxInning: Int) {
        container.append {
            div(classes = "scorecard-table-wrapper") {
                id = "scorecard-table-wrapper"
                buildTableStructure(maxInning)
            }
        }
    }

    private fun kotlinx.html.DIV.buildTableStructure(maxInning: Int) {
        table(classes = "scorecard-table") {
            id = "scorecard-table-el"
            thead(classes = "scorecard-thead") {
                renderScorecardTableHeader(maxInning)
            }
            tbody {
                id = "scorebook-tbody"
            }
        }
    }

    private fun kotlinx.html.THEAD.renderScorecardTableHeader(maxInning: Int) {
        tr {
            id = "scorebook-header-row"
            renderBattersAndPosHeaders()
            renderInningHeaderCols(maxInning)
            renderStatHeaderCols()
        }
    }

    private fun kotlinx.html.TR.renderBattersAndPosHeaders() {
        th(classes = "th-batter-header") {
            +"BATTERS"
        }
        th(classes = "th-pos-header") {
            +"POS"
        }
    }

    private fun kotlinx.html.TR.renderInningHeaderCols(maxInning: Int) {
        for (inn in 1..maxInning) {
            th(classes = "th-inning-header") {
                +inn.toString()
            }
        }
    }

    private fun kotlinx.html.TR.renderStatHeaderCols() {
        listOf("AB", "R", "H", "RBI").forEach { sh ->
            th(classes = if (sh == "AB") "th-stat-header first" else "th-stat-header") {
                +sh
            }
        }
    }
}

private object ScorebookRowCellUi {
    fun renderPosTd(tr: HTMLTableRowElement, position: String) {
        tr.append {
            td(classes = "text-center font-bold") {
                +position
            }
        }
    }

    private fun DIV.renderSubButton(
        slotIdx: Int,
        isHomeBatting: Boolean,
    ) {
        button(classes = "sub-btn-scorebook") {
            +"Sub"
            onClickFunction = { event ->
                val btnEl = event.target as? HTMLButtonElement
                val parentCell = btnEl?.parentElement?.parentElement as? HTMLElement
                if (parentCell != null) {
                    ScorebookGridRenderer.openSubSelector(parentCell, slotIdx, isHomeBatting)
                }
            }
        }
    }

    fun renderPlayerCell(
        tr: HTMLTableRowElement,
        game: Game,
        data: PlayerCellData,
    ) {
        tr.append {
            td {
                div(classes = "player-cell-content") {
                    renderPlayerName(data.playerName)
                    if (!data.hasSub && game.status != GameStatus.COMPLETED) {
                        renderSubButton(data.slotIdx, data.isHomeBatting)
                    }
                }
            }
        }
    }

    private fun DIV.renderPlayerName(name: String) {
        span(classes = "player-name-span") {
            +name
        }
    }

    fun renderStatCells(
        tr0: HTMLTableRowElement,
        tr1: HTMLTableRowElement?,
        rowData: RowData,
        params: ScorecardRenderParams,
    ) {
        val playerName0 = rowData.players.getOrNull(0) ?: ""
        val substitutePlayerName = if (rowData.players.size > 1) rowData.players[1] else ""
        val hasSub = rowData.players.size > 1
        val stat0 = params.battingStatsList.find { it.playerName == playerName0 }
        val stat1 = if (hasSub) params.battingStatsList.find { it.playerName == substitutePlayerName } else null

        listOf(
            { s: PlayerBattingStats? -> s?.atBats?.toString() ?: "0" },
            { s: PlayerBattingStats? -> s?.runs?.toString() ?: "0" },
            { s: PlayerBattingStats? -> s?.hits?.toString() ?: "0" },
            { s: PlayerBattingStats? -> s?.rbi?.toString() ?: "0" }
        ).forEachIndexed { statIdx, selector ->
            val val0 = selector(stat0)
            val val1 = selector(stat1)
            appendStatTd(tr0, val0, statIdx == 0)
            if (hasSub && tr1 != null) {
                appendStatTd(tr1, val1, statIdx == 0)
            }
        }
    }

    private fun appendStatTd(
        tr: HTMLTableRowElement,
        value: String,
        isFirst: Boolean,
    ) {
        val tdClasses = if (isFirst) {
            "text-center font-bold th-stat-header first"
        } else {
            "text-center font-bold th-stat-header"
        }
        tr.append {
            td(classes = tdClasses) {
                +value
            }
        }
    }
}

private object ScorebookInningCellUi {
    fun renderInningCells(
        tr0: HTMLTableRowElement,
        tr1: HTMLTableRowElement?,
        rowData: RowData,
        params: ScorecardRenderParams,
    ) {
        val hasSub = rowData.players.size > 1
        for (inn in 1..params.maxInning) {
            val ev = params.teamEvents.find { event ->
                (params.teamEvents.indexOf(event) % 9 == rowData.slotIdx) && event.inning == inn
            }
            val isSubPlay = ev != null && hasSub && ev.batterName == rowData.players[1]

            if (isSubPlay && tr1 != null) {
                renderInningCellWrapper(tr0, null, params.teamEvents, params.parser)
                renderInningCellWrapper(tr1, ev, params.teamEvents, params.parser)
            } else {
                renderInningCellWrapper(tr0, ev, params.teamEvents, params.parser)
                if (hasSub && tr1 != null) {
                    renderInningCellWrapper(tr1, null, params.teamEvents, params.parser)
                }
            }
        }
    }

    private fun renderInningCellWrapper(
        tr: HTMLTableRowElement,
        ev: PlayEvent?,
        teamEvents: List<PlayEvent>,
        parser: ScorecardParser,
    ) {
        tr.append {
            td(classes = "th-inning-header") {
                renderInningCell(ev, teamEvents, parser)
            }
        }
    }

    private fun TD.renderInningCell(
        ev: PlayEvent?,
        teamEvents: List<PlayEvent>,
        parser: ScorecardParser,
    ) {
        div(classes = "inning-cell-box") {
            if (ev != null) {
                renderEventInInningCell(ev, parser, teamEvents)
            } else {
                div { }
            }
        }
    }

    private fun DIV.renderEventInInningCell(
        ev: PlayEvent,
        parser: ScorecardParser,
        teamEvents: List<PlayEvent>,
    ) {
        val prog = parser.playProgressions[ev]
        val base = prog?.maxBase ?: (parser.playAdvancements[ev] ?: 0)
        val outNum = parser.playOutNumbers[ev]
        val outAtBase = prog?.outAtBase
        val outDetail = prog?.outDetail
        val notation = getScorebookNotation(ev)

        renderInningDiamond(base)
        ScorebookCellAnnotationUi.renderOutDetails(this, outAtBase, outDetail)
        div(classes = "notation-tag") {
            +notation
        }
        ScorebookCellAnnotationUi.renderCountBallsStrikes(this, ev)
        ScorebookCellAnnotationUi.renderOutCircle(this, outNum)
        ScorebookCellAnnotationUi.renderEndedInningDiagonal(this, ev, teamEvents)
    }

    private fun DIV.renderInningDiamond(
        base: Int,
    ) {
        val diamondClass = when (base) {
            1 -> "inning-diamond-shape b1"
            2 -> "inning-diamond-shape b2"
            3 -> "inning-diamond-shape b3"
            4 -> "inning-diamond-shape b4"
            else -> "inning-diamond-shape"
        }
        div(classes = diamondClass) { }
    }
}

private object ScorebookCellAnnotationUi {
    fun renderOutDetails(
        parent: DIV,
        outAtBase: Int?,
        outDetail: String?,
    ) {
        if (outAtBase != null && outDetail != null) {
            parent.div(classes = "text-accent-red font-bold") {
                +outDetail
            }
        }
    }

    fun renderCountBallsStrikes(
        parent: DIV,
        ev: PlayEvent,
    ) {
        if (ev.balls > 0 || ev.strikes > 0) {
            parent.div(classes = "count-tag") {
                +"${ev.balls}-${ev.strikes}"
            }
        }
    }

    fun renderOutCircle(
        parent: DIV,
        outNum: Int?,
    ) {
        if (outNum != null) {
            parent.div(classes = "out-circle") {
                +outNum.toString()
            }
        }
    }

    fun renderEndedInningDiagonal(
        parent: DIV,
        ev: PlayEvent,
        teamEvents: List<PlayEvent>,
    ) {
        val playIdx = teamEvents.indexOf(ev)
        val nextPlay = teamEvents.getOrNull(playIdx + 1)
        val endedInning = ev.outsAfter == 3 && (nextPlay == null || nextPlay.inning > ev.inning)
        if (endedInning) {
            parent.div(classes = "inning-diagonal-line") { }
        }
    }
}

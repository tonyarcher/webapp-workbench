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
import com.baseball.models.PlayerBattingStats
import com.baseball.models.Team
import com.baseball.ui.core.DomUiConstants
import com.baseball.ui.core.css
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.substitutePitcher
import kotlinx.browser.document
import kotlinx.css.Align
import kotlinx.css.Border
import kotlinx.css.BorderCollapse
import kotlinx.css.BorderStyle
import kotlinx.css.BoxSizing
import kotlinx.css.Color
import kotlinx.css.Cursor
import kotlinx.css.Display
import kotlinx.css.FlexDirection
import kotlinx.css.FontWeight
import kotlinx.css.JustifyContent
import kotlinx.css.LinearDimension
import kotlinx.css.Overflow
import kotlinx.css.Padding
import kotlinx.css.Position
import kotlinx.css.TextAlign
import kotlinx.css.VerticalAlign
import kotlinx.css.alignItems
import kotlinx.css.background
import kotlinx.css.backgroundColor
import kotlinx.css.border
import kotlinx.css.borderBottom
import kotlinx.css.borderCollapse
import kotlinx.css.borderLeft
import kotlinx.css.borderRadius
import kotlinx.css.borderRight
import kotlinx.css.borderTop
import kotlinx.css.borderTopStyle
import kotlinx.css.bottom
import kotlinx.css.boxSizing
import kotlinx.css.color
import kotlinx.css.cursor
import kotlinx.css.display
import kotlinx.css.flexDirection
import kotlinx.css.flexGrow
import kotlinx.css.fontFamily
import kotlinx.css.fontSize
import kotlinx.css.fontWeight
import kotlinx.css.gap
import kotlinx.css.height
import kotlinx.css.justifyContent
import kotlinx.css.left
import kotlinx.css.letterSpacing
import kotlinx.css.marginBottom
import kotlinx.css.marginLeft
import kotlinx.css.marginTop
import kotlinx.css.minWidth
import kotlinx.css.overflow
import kotlinx.css.overflowX
import kotlinx.css.padding
import kotlinx.css.pct
import kotlinx.css.position
import kotlinx.css.properties.deg
import kotlinx.css.properties.rotate
import kotlinx.css.properties.transform
import kotlinx.css.properties.translate
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.css.right
import kotlinx.css.textAlign
import kotlinx.css.top
import kotlinx.css.verticalAlign
import kotlinx.css.width
import kotlinx.css.zIndex
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
        val battingStatsList = if (isHomeBatting) boxScore.homeBatting else boxScore.awayBatting
        val teamEvents = events.filter { it.half == half }

        val slots = Array(9) { mutableListOf<PlayEvent>() }
        teamEvents.forEachIndexed { index, event ->
            slots[index % 9].add(event)
        }

        val playersByBattingSlot = buildPlayersByBattingSlot(isHomeBatting, slots)
        val maxInning = events.maxOfOrNull { it.inning }?.coerceAtLeast(9) ?: 9

        val parser = ScorecardParser(teamEvents, localAwayRoster, localHomeRoster, maxInning)

        renderHeaderPanel(container, isHomeBatting, game, battingTeam, pitchingTeam)
        renderRosterDrawer(container, isHomeBatting, game)
        renderScorecardTable(
            container,
            game,
            ScorecardRenderParams(
                playersByBattingSlot = playersByBattingSlot,
                battingStatsList = battingStatsList,
                teamEvents = teamEvents,
                maxInning = maxInning,
                parser = parser,
                isHomeBatting = isHomeBatting,
            )
        )

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

    private fun DIV.renderHeaderPanelCol1(isHomeBatting: Boolean) {
        div {
            +(if (isHomeBatting) "BOTTOM" else "TOP")
            css {
                fontSize = 2.rem
                color = Color("#ff2a3b")
                letterSpacing = 2.px
            }
        }
    }

    private fun DIV.renderHeaderPanelCol2(
        battingTeam: Team,
        isHomeBatting: Boolean,
    ) {
        div {
            css {
                display = Display.flex
                flexDirection = FlexDirection.column
                justifyContent = JustifyContent.center
            }
            div { +"TEAM: ${battingTeam.city.uppercase()} ${battingTeam.name.uppercase()}" }
            div {
                +"MANAGER: ${if (isHomeBatting) "COUNSELL, C." else "REYNOLDS, J."}"
                css {
                    fontSize = 0.85.rem
                    color = Color("#555")
                    marginTop = 0.25.rem
                }
            }
        }
    }

    private fun DIV.renderHeaderPanelCol3(pitchingTeam: Team) {
        div {
            css {
                display = Display.flex
                flexDirection = FlexDirection.column
                justifyContent = JustifyContent.center
            }
            div { +"PITCHING OPPONENT: ${pitchingTeam.name.uppercase()}" }
            div {
                +"UMPIRES: HP: CULBRETH, F. | 1B: NELSON, J."
                css {
                    fontSize = 0.85.rem
                    color = Color("#555")
                    marginTop = 0.25.rem
                }
            }
        }
    }

    private fun DIV.renderHeaderPanelCol4(game: Game) {
        div {
            css {
                display = Display.flex
                flexDirection = FlexDirection.column
                justifyContent = JustifyContent.center
                alignItems = Align.flexEnd
                fontSize = 0.8.rem
            }
            div { +"KEEPING SCORE BY: ☑ WEBAPP" }
            div { +"FIRST PITCH: 7:05 PM" }

            if (game.status != GameStatus.COMPLETED) {
                button(classes = "btn") {
                    +"Bench & Bullpen"
                    css {
                        marginTop = 0.4.rem
                        fontSize = 0.75.rem
                        padding = Padding(2.px, 8.px)
                        background = "rgba(0, 0, 0, 0.05)"
                        border = Border(1.px, BorderStyle.solid, Color("#5a544a"))
                        borderRadius = 4.px
                        cursor = Cursor.pointer
                    }
                    onClickFunction = {
                        val drawer = document.getElementById("roster-drawer-element") as? HTMLElement
                        if (drawer != null) {
                            val isHidden =
                                drawer.style.getPropertyValue(DomUiConstants.Css.DISPLAY) == DomUiConstants.CssValues.NONE
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

    private fun renderHeaderPanel(
        container: HTMLElement,
        isHomeBatting: Boolean,
        game: Game,
        battingTeam: Team,
        pitchingTeam: Team,
    ) {
        container.append {
            div {
                css {
                    display = Display.grid
                    put("grid-template-columns", "150px 1fr 1fr 180px")
                    border = Border(2.px, BorderStyle.solid, Color("#5a544a"))
                    backgroundColor = Color("#eae5dc")
                    padding = Padding(0.75.rem)
                    marginBottom = 1.rem
                    fontWeight = FontWeight.bold
                }
                renderHeaderPanelCol1(isHomeBatting)
                renderHeaderPanelCol2(battingTeam, isHomeBatting)
                renderHeaderPanelCol3(pitchingTeam)
                renderHeaderPanelCol4(game)
            }
        }
    }

    private fun renderRosterDrawer(
        container: HTMLElement,
        isHomeBatting: Boolean,
        game: Game,
    ) {
        val isHome = !isHomeBatting
        val fieldingBench = if (isHome) localHomeBench else localAwayBench
        val activePitcherName = if (isHome) localHomeActivePitcherName else localAwayActivePitcherName
        val benchList = if (isHomeBatting) localHomeBench else localAwayBench

        container.append {
            div {
                id = "roster-drawer-element"
                css {
                    display = Display.none
                    backgroundColor = Color("#fcfbfa")
                    border = Border(2.px, BorderStyle.solid, Color("#5a544a"))
                    borderTopStyle = BorderStyle.none
                    padding = Padding(1.rem)
                    marginTop = (-1.1).rem
                    marginBottom = 1.5.rem
                    fontFamily = "'Courier New', Courier, monospace"
                }

                div {
                    css {
                        display = Display.flex
                        gap = 2.rem
                    }
                    div {
                        css { flexGrow = 1.0 }
                        h4 { +"BENCH BATTERS" }
                        val batters =
                            benchList.filter {
                                it.position != BaseballConstants.Positions.P &&
                                        !localPlayersSubbedOut.contains(
                                            it.id,
                                        )
                            }
                        if (batters.isEmpty()) {
                            p { +"None available" }
                        } else {
                            batters.forEach { p ->
                                div { +"#${p.jerseyNumber} ${p.name} (${p.position})" }
                            }
                        }
                    }
                    div {
                        css { flexGrow = 1.0 }
                        h4 { +"BULLPEN" }
                        val pitchers = fieldingBench.filter {
                            it.position == BaseballConstants.Positions.P &&
                                    it.name != activePitcherName
                        }
                        if (pitchers.isEmpty()) {
                            p { +"None available" }
                        } else {
                            pitchers.forEach { p ->
                                div {
                                    +"#${p.jerseyNumber} ${p.name} (LHP/RHP)"
                                    if (game.status != GameStatus.COMPLETED) {
                                        button(classes = "btn") {
                                            +"Call up"
                                            css {
                                                marginLeft = 0.5.rem
                                                fontSize = 0.7.rem
                                                padding = Padding(1.px, 4.px)
                                            }
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
    }

    private fun renderScorecardTable(
        container: HTMLElement,
        game: Game,
        params: ScorecardRenderParams,
    ) {
        container.append {
            div {
                id = "scorecard-table-wrapper"
                css {
                    width = 100.pct
                    overflowX = Overflow.auto
                    border = Border(2.px, BorderStyle.solid, Color("#5a544a"))
                }
                table {
                    id = "scorecard-table-el"
                    css {
                        borderCollapse = BorderCollapse.collapse
                        backgroundColor = Color("#faf9f6")
                        minWidth = 1000.px
                        width = 100.pct
                        color = Color("#2b2a28")
                        fontSize = 0.85.rem
                    }
                    thead {
                        css {
                            background = "#eae5dc"
                            borderBottom = Border(2.px, BorderStyle.solid, Color("#5a544a"))
                        }
                        tr {
                            id = "scorebook-header-row"
                            css { height = 35.px }
                            th {
                                +"BATTERS"
                                css {
                                    borderRight = Border(2.px, BorderStyle.solid, Color("#5a544a"))
                                    padding = Padding(0.5.rem)
                                    textAlign = TextAlign.left
                                    width = 180.px
                                }
                            }
                            th {
                                +"POS"
                                css {
                                    borderRight = Border(2.px, BorderStyle.solid, Color("#5a544a"))
                                    padding = Padding(0.5.rem)
                                    textAlign = TextAlign.center
                                    width = 45.px
                                }
                            }
                            for (inn in 1..params.maxInning) {
                                th {
                                    +inn.toString()
                                    css {
                                        borderRight = Border(1.px, BorderStyle.solid, Color("#9c9384"))
                                        width = 75.px
                                        textAlign = TextAlign.center
                                    }
                                }
                            }
                            listOf("AB", "R", "H", "RBI").forEach { sh ->
                                th {
                                    +sh
                                    css {
                                        borderLeft = Border(
                                            if (sh == "AB") 2.px else 1.px,
                                            BorderStyle.solid,
                                            Color(if (sh == "AB") "#5a544a" else "#9c9384")
                                        )
                                        width = 45.px
                                        textAlign = TextAlign.center
                                    }
                                }
                            }
                        }
                    }
                    tbody {
                        id = "scorebook-tbody"
                    }
                }
            }
        }

        val tableEl = container.querySelector("#scorecard-table-el") as HTMLElement
        val tbodyEl = tableEl.querySelector("#scorebook-tbody") as HTMLTableSectionElement
        for (slotIdx in 0..8) {
            val players = params.playersByBattingSlot[slotIdx]
            renderSlotRows(
                tbodyEl,
                game,
                slotIdx,
                players,
                params
            )
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
                css {
                    borderBottom = Border(1.px, BorderStyle.solid, Color("#5a544a"))
                    height = 42.5.px
                }
            }
        }
        val tr1 = tbodyEl.querySelector("#$rowId") as HTMLTableRowElement
        val subPos = params.battingStatsList.find { it.playerName == rowRenderData.substitutePlayerName }?.position
            ?: BaseballConstants.Positions.DH
        renderPlayerCell(
            tr1,
            game,
            PlayerCellData(slotIdx, rowRenderData.substitutePlayerName, false, params.isHomeBatting, rowRenderData.cellBackground)
        )

        tr1.append {
            td {
                +subPos
                css {
                    borderRight = Border(2.px, BorderStyle.solid, Color("#5a544a"))
                    padding = Padding(0.5.rem)
                    textAlign = TextAlign.center
                    fontWeight = FontWeight.bold
                    background = rowRenderData.cellBackground
                }
            }
        }
        return tr1
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

        val rowId = "slot-row-$slotIdx"
        tbodyEl.append {
            tr {
                id = rowId
                css {
                    borderBottom = Border(1.px, BorderStyle.solid, Color(if (hasSub) "#9c9384" else "#5a544a"))
                    height = 42.5.px
                }
            }
        }
        val tr0 = tbodyEl.querySelector("#$rowId") as HTMLTableRowElement

        renderPlayerCell(tr0, game, PlayerCellData(slotIdx, playerName0, hasSub, params.isHomeBatting, cellBackground))

        tr0.append {
            td {
                +starterPos
                css {
                    borderRight = Border(2.px, BorderStyle.solid, Color("#5a544a"))
                    padding = Padding(0.5.rem)
                    textAlign = TextAlign.center
                    fontWeight = FontWeight.bold
                    background = cellBackground
                }
            }
        }

        var tr1: HTMLTableRowElement? = null
        var substitutePlayerName = ""

        if (hasSub) {
            substitutePlayerName = players[1]
            tr1 = renderSubRow(tbodyEl, slotIdx, RowRenderData(substitutePlayerName, cellBackground), game, params)
        }

        renderInningCells(tr0, tr1, RowData(slotIdx, players, cellBackground), params)
        renderStatCells(tr0, tr1, RowData(slotIdx, players, cellBackground), params)
    }

private fun getCellBackground(slotIdx: Int) =
    if (slotIdx % 2 == 1) {
        "linear-gradient(180deg, #f4f1e7 0%, #ebe6d9 100%)"
    } else {
        "linear-gradient(180deg, #faf9f6 0%, #f3f0e8 100%)"
    }

    private fun DIV.renderSubButton(
        slotIdx: Int,
        isHomeBatting: Boolean,
    ) {
        button {
            +"Sub"
            css {
                padding = Padding(2.px, 6.px)
                fontSize = 0.7.rem
                backgroundColor = Color("#5a544a")
                color = Color.white
                fontWeight = FontWeight.bold
                border = Border.none
                borderRadius = 4.px
                cursor = Cursor.pointer
            }
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
        game: Game,
        data: PlayerCellData,
    ) {
        tr.append {
            td {
                css {
                    borderRight = Border(2.px, BorderStyle.solid, Color("#5a544a"))
                    padding = Padding(0.px, 0.5.rem)
                    verticalAlign = VerticalAlign.middle
                    background = data.cellBackground
                    height = 42.5.px
                }
                div {
                    css {
                        display = Display.flex
                        justifyContent = JustifyContent.spaceBetween
                        alignItems = Align.center
                        width = 100.pct
                    }
                    renderPlayerName(data.playerName)
                    if (!data.hasSub && game.status != GameStatus.COMPLETED) {
                        renderSubButton(data.slotIdx, data.isHomeBatting)
                    }
                }
            }
        }
    }

private fun DIV.renderPlayerName(name: String) {
    span {
        +name
        css {
            fontWeight = FontWeight.bold
            fontFamily = "'Courier New', Courier, monospace"
        }
    }
}

    private fun renderInningCells(
        tr0: HTMLTableRowElement,
        tr1: HTMLTableRowElement?,
        rowData: RowData,
        params: ScorecardRenderParams,
    ) {
        val hasSub = rowData.players.size > 1
        for (inn in 1..params.maxInning) {
            val ev = params.teamEvents.find { (params.teamEvents.indexOf(it) % 9 == rowData.slotIdx) && it.inning == inn }
            val isSubPlay = ev != null && hasSub && ev.batterName == rowData.players[1]

            if (isSubPlay && tr1 != null) {
                renderInningCellWrapper(tr0, null, rowData.cellBackground, params.teamEvents, params.parser)
                renderInningCellWrapper(tr1, ev, rowData.cellBackground, params.teamEvents, params.parser)
            } else {
                renderInningCellWrapper(tr0, ev, rowData.cellBackground, params.teamEvents, params.parser)
                if (hasSub && tr1 != null) {
                    renderInningCellWrapper(tr1, null, rowData.cellBackground, params.teamEvents, params.parser)
                }
            }
        }
    }

    private fun renderInningCellWrapper(
        tr: HTMLTableRowElement,
        ev: PlayEvent?,
        cellBackground: String,
        teamEvents: List<PlayEvent>,
        parser: ScorecardParser,
    ) {
        tr.append {
            td {
                renderInningCell(ev, cellBackground, teamEvents, parser)
            }
        }
    }

    private fun renderStatCells(
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
            tr0.append {
                td {
                    +val0
                    css {
                        borderLeft = Border(
                            if (statIdx == 0) 2.px else 1.px,
                            BorderStyle.solid,
                            Color(if (statIdx == 0) "#5a544a" else "#9c9384")
                        )
                        textAlign = TextAlign.center
                        background = rowData.cellBackground
                        fontWeight = FontWeight.bold
                    }
                }
            }
            if (hasSub && tr1 != null) {
                tr1.append {
                    td {
                        +val1
                        css {
                            borderLeft = Border(
                                if (statIdx == 0) 2.px else 1.px,
                                BorderStyle.solid,
                                Color(if (statIdx == 0) "#5a544a" else "#9c9384")
                            )
                            textAlign = TextAlign.center
                            background = rowData.cellBackground
                            fontWeight = FontWeight.bold
                        }
                    }
                }
            }
        }
    }

    private fun TD.renderInningCell(
        ev: PlayEvent?,
        cellBackground: String,
        teamEvents: List<PlayEvent>,
        parser: ScorecardParser,
    ) {
        css {
            borderRight = Border(1.px, BorderStyle.solid, Color("#9c9384"))
            padding = Padding(0.px)
            height = 42.5.px
            width = 75.px
            background = cellBackground
        }
        div {
            css {
                position = Position.relative
                width = 100.pct
                height = 100.pct
                boxSizing = BoxSizing.borderBox
                padding = Padding(2.px)
                overflow = Overflow.hidden
            }
            if (ev != null) {
                val prog = parser.playProgressions[ev]
                val base = prog?.maxBase ?: (parser.playAdvancements[ev] ?: 0)
                val outNum = parser.playOutNumbers[ev]
                val outAtBase = prog?.outAtBase
                val outDetail = prog?.outDetail
                val notation = getScorebookNotation(ev)

                renderInningDiamond(base)
                renderOutDetails(outAtBase, outDetail)
                div {
                    +notation
                    css {
                        position = Position.absolute
                        top = 50.pct
                        left = 50.pct
                        transform {
                            translate((-50).pct, (-50).pct)
                        }
                        fontWeight = FontWeight.bold
                        fontSize = 0.75.rem
                        zIndex = 2
                    }
                }
                renderCountBallsStrikes(ev)
                renderOutCircle(outNum)
                renderEndedInningDiagonal(ev, teamEvents)
            } else {
                div {
                    css {
                        width = 100.pct
                        height = 100.pct
                    }
                }
            }
        }
    }

    private fun DIV.renderInningDiamond(
        base: Int,
    ) {
        div {
            css {
                position = Position.absolute
                top = 50.pct
                left = 50.pct
                width = 26.px
                height = 26.px
                marginTop = (-13).px
                marginLeft = (-13).px
                border = Border(1.px, BorderStyle.dashed, Color("#d2cdc6"))
                transform { rotate(45.deg) }
                zIndex = 1

                if (base >= 1) {
                    borderRight = Border(2.px, BorderStyle.solid, Color("#ff2a3b"))
                }
                if (base >= 2) {
                    borderTop = Border(2.px, BorderStyle.solid, Color("#ff2a3b"))
                }
                if (base >= 3) {
                    borderLeft = Border(2.px, BorderStyle.solid, Color("#ff2a3b"))
                }
                if (base >= 4) {
                    borderBottom = Border(2.px, BorderStyle.solid, Color("#ff2a3b"))
                    backgroundColor = Color("rgba(255, 42, 59, 0.25)")
                }
            }
        }
    }

    private fun DIV.renderOutDetails(
        outAtBase: Int?,
        outDetail: String?,
    ) {
        if (outAtBase != null && outDetail != null) {
            div {
                +outDetail
                val (t, l) =
                    when (outAtBase) {
                        1 -> Pair("18px", "48px")
                        2 -> Pair("1px", "32px")
                        3 -> Pair("18px", "12px")
                        else -> Pair("30px", "32px")
                    }
                css {
                    position = Position.absolute
                    top = t.toPxOrPctOrRem()
                    left = l.toPxOrPctOrRem()
                    fontSize = 0.65.rem
                    color = Color("#ff2a3b")
                    fontWeight = FontWeight.bold
                    zIndex = 3
                }
            }
        }
    }

    private fun String.toPxOrPctOrRem(): LinearDimension =
        if (endsWith("px")) {
            substringBefore("px").toInt().px
        } else if (endsWith("rem")) {
            substringBefore("rem").toDouble().rem
        } else if (endsWith("%")) {
            substringBefore("%").toDouble().pct
        } else {
            0.px
        }

    private fun DIV.renderCountBallsStrikes(
        ev: PlayEvent,
    ) {
        if (ev.balls > 0 || ev.strikes > 0) {
            div {
                css {
                    position = Position.absolute
                    top = 2.px
                    left = 4.px
                    fontSize = 0.6.rem
                    color = Color("#777")
                    fontFamily = "monospace"
                }
                +"${ev.balls}-${ev.strikes}"
            }
        }
    }

    private fun DIV.renderOutCircle(
        outNum: Int?,
    ) {
        if (outNum != null) {
            div {
                +outNum.toString()
                css {
                    position = Position.absolute
                    bottom = 2.px
                    left = 4.px
                    width = 11.px
                    height = 11.px
                    border = Border(1.px, BorderStyle.solid, Color("#ff2a3b"))
                    borderRadius = 50.pct
                    display = Display.flex
                    justifyContent = JustifyContent.center
                    alignItems = Align.center
                    fontSize = 0.55.rem
                    color = Color("#ff2a3b")
                    fontWeight = FontWeight.bold
                }
            }
        }
    }

    private fun DIV.renderEndedInningDiagonal(
        ev: PlayEvent,
        teamEvents: List<PlayEvent>,
    ) {
        val playIdx = teamEvents.indexOf(ev)
        val nextPlay = teamEvents.getOrNull(playIdx + 1)
        val endedInning = ev.outsAfter == 3 && (nextPlay == null || nextPlay.inning > ev.inning)
        if (endedInning) {
            div {
                css {
                    position = Position.absolute
                    bottom = (-10).px
                    right = (-10).px
                    width = 35.px
                    height = 1.px
                    backgroundColor = Color("#5a544a")
                    transform { rotate((-45).deg) }
                    put("transform-origin", "bottom right")
                    zIndex = 4
                }
            }
        }
    }
}

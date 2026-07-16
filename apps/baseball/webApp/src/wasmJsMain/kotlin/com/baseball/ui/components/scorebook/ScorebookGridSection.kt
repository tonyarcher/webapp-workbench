package com.baseball.ui.components.scorebook

import com.baseball.BaseballConstants
import com.baseball.UiConstants
import com.baseball.game.*
import com.baseball.models.*
import com.baseball.ui.*
import kotlinx.browser.document
import kotlinx.css.*
import kotlinx.html.*
import kotlinx.html.dom.append
import kotlinx.html.js.div
import kotlinx.html.js.onClickFunction
import org.w3c.dom.HTMLButtonElement
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLTableRowElement
import org.w3c.dom.HTMLTableSectionElement

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
            css {
                fontSize = 2.rem
                color = Color("#ff2a3b")
                letterSpacing = 2.px
            }
        }
    }

    private fun DIV.renderHeaderPanelCol2(battingTeam: Team, isHomeBatting: Boolean) {
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
            div { +"KEEPING SCORE BY: â˜’ WEBAPP" }
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

    private fun renderRosterDrawer(container: HTMLElement, isHomeBatting: Boolean, game: Game) {
        val isHome = !isHomeBatting
        val fieldingBench = if (isHome) localHomeBench else localAwayBench
        val activePitcherName = if (isHome) localHomeActivePitcherName else localAwayActivePitcherName
        val benchList = if (isHomeBatting) localHomeBench else localAwayBench

        container.div {
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
                    css { flexGrow = 1.0 }
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
            css {
                width = 100.pct
                overflowX = Overflow.auto
                border = Border(2.px, BorderStyle.solid, Color("#5a544a"))
            }
        }
        val tableEl = divWrapper.table {
            css {
                borderCollapse = BorderCollapse.collapse
                backgroundColor = Color("#faf9f6")
                minWidth = 1000.px
                width = 100.pct
                color = Color("#2b2a28")
                fontSize = 0.85.rem
            }
        }
        val theadEl = tableEl.thead {
            css {
                background = "#eae5dc"
                borderBottom = Border(2.px, BorderStyle.solid, Color("#5a544a"))
            }
        }
        val theadTr = theadEl.tr {
            css { height = 35.px }
        }

        theadTr.th {
            +"BATTERS"
            css {
                borderRight = Border(2.px, BorderStyle.solid, Color("#5a544a"))
                padding = Padding(0.5.rem)
                textAlign = TextAlign.left
                width = 180.px
            }
        }
        theadTr.th {
            +"POS"
            css {
                borderRight = Border(2.px, BorderStyle.solid, Color("#5a544a"))
                padding = Padding(0.5.rem)
                textAlign = TextAlign.center
                width = 45.px
            }
        }

        for (inn in 1..maxInning) {
            theadTr.th {
                +inn.toString()
                css {
                    borderRight = Border(1.px, BorderStyle.solid, Color("#9c9384"))
                    width = 75.px
                    textAlign = TextAlign.center
                }
            }
        }

        listOf("AB", "R", "H", "RBI").forEach { sh ->
            theadTr.th {
                +sh
                css {
                    borderLeft = Border(if (sh == "AB") 2.px else 1.px, BorderStyle.solid, Color(if (sh == "AB") "#5a544a" else "#9c9384"))
                    width = 45.px
                    textAlign = TextAlign.center
                }
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
            css {
                borderBottom = Border(1.px, BorderStyle.solid, Color("#5a544a"))
                height = 42.5.px
            }
        }
        val subPos = battingStatsList.find { it.playerName == pName1 }?.position ?: BaseballConstants.Positions.DH
        renderPlayerCell(tr1, slotIdx, pName1, false, cellBg, game, isHomeBatting)
        tr1.td {
            +subPos
            css {
                borderRight = Border(2.px, BorderStyle.solid, Color("#5a544a"))
                padding = Padding(0.5.rem)
                textAlign = TextAlign.center
                fontWeight = FontWeight.bold
                background = cellBg
            }
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
            css {
                borderBottom = Border(1.px, BorderStyle.solid, Color(if (hasSub) "#9c9384" else "#5a544a"))
                height = 42.5.px
            }
        }

        renderPlayerCell(tr0, slotIdx, pName0, hasSub, cellBg, game, isHomeBatting)

        tr0.td {
            +starterPos
            css {
                borderRight = Border(2.px, BorderStyle.solid, Color("#5a544a"))
                padding = Padding(0.5.rem)
                textAlign = TextAlign.center
                fontWeight = FontWeight.bold
                background = cellBg
            }
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
        slotIdx: Int,
        pName: String,
        hasSub: Boolean,
        cellBg: String,
        game: Game,
        isHomeBatting: Boolean
    ) {
        tr.td {
            css {
                borderRight = Border(2.px, BorderStyle.solid, Color("#5a544a"))
                padding = Padding(0.px, 0.5.rem)
                verticalAlign = VerticalAlign.middle
                background = cellBg
                height = 42.5.px
            }
            div {
                css {
                    display = Display.flex
                    justifyContent = JustifyContent.spaceBetween
                    alignItems = Align.center
                    width = 100.pct
                }
                span {
                    +pName
                    css {
                        fontWeight = FontWeight.bold
                        fontFamily = "'Courier New', Courier, monospace"
                    }
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
                css {
                    borderLeft = Border(if (statIdx == 0) 2.px else 1.px, BorderStyle.solid, Color(if (statIdx == 0) "#5a544a" else "#9c9384"))
                    textAlign = TextAlign.center
                    background = cellBg
                    fontWeight = FontWeight.bold
                }
            }
            if (hasSub && tr1 != null) {
                tr1.td {
                    +val1
                    css {
                        borderLeft = Border(if (statIdx == 0) 2.px else 1.px, BorderStyle.solid, Color(if (statIdx == 0) "#5a544a" else "#9c9384"))
                        textAlign = TextAlign.center
                        background = cellBg
                        fontWeight = FontWeight.bold
                    }
                }
            }
        }
    }

    private fun renderInningCell(td: TD, ev: PlayEvent?, cellBg: String, teamEvents: List<PlayEvent>, parser: ScorecardParser) {
        td.css {
            borderRight = Border(1.px, BorderStyle.solid, Color("#9c9384"))
            padding = Padding(0.px)
            height = 42.5.px
            width = 75.px
            background = cellBg
        }
        td.div {
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

                renderInningDiamond(this, base)
                renderOutDetails(this, outAtBase, outDetail)
                div {
                    +notation
                    css {
                        position = Position.absolute
                        top = 50.pct
                        left = 50.pct
                        put("transform", "translate(-50%, -50%)")
                        fontWeight = FontWeight.bold
                        fontSize = 0.75.rem
                        zIndex = 2
                    }
                }
                renderCountBallsStrikes(this, ev)
                renderOutCircle(this, outNum)
                renderEndedInningDiagonal(this, ev, teamEvents)
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

    private fun DIV.renderInningDiamond(parent: DIV, base: Int) {
        parent.div {
            css {
                position = Position.absolute
                top = 8.px
                left = 24.px
                width = 24.px
                height = 24.px
                border = Border(1.px, BorderStyle.solid, Color("#dcd8cf"))
                put("transform", "rotate(45deg)")
                zIndex = 1
            }
            if (base >= 1) {
                div {
                    css {
                        position = Position.absolute
                        bottom = (-1).px
                        right = (-1).px
                        width = 13.px
                        height = 1.px
                        backgroundColor = Color("#5a544a")
                        put("transform", "rotate(-45deg)")
                        put("transform-origin", "bottom right")
                    }
                }
            }
            if (base >= 2) {
                div {
                    css {
                        position = Position.absolute
                        top = (-1).px
                        right = (-1).px
                        width = 13.px
                        height = 1.px
                        backgroundColor = Color("#5a544a")
                        put("transform", "rotate(45deg)")
                        put("transform-origin", "top right")
                    }
                }
            }
            if (base >= 3) {
                div {
                    css {
                        position = Position.absolute
                        top = (-1).px
                        left = (-1).px
                        width = 13.px
                        height = 1.px
                        backgroundColor = Color("#5a544a")
                        put("transform", "rotate(-45deg)")
                        put("transform-origin", "top left")
                    }
                }
            }
            if (base >= 4) {
                div {
                    css {
                        position = Position.absolute
                        bottom = (-1).px
                        left = (-1).px
                        width = 13.px
                        height = 1.px
                        backgroundColor = Color("#5a544a")
                        put("transform", "rotate(45deg)")
                        put("transform-origin", "bottom left")
                    }
                }
                div {
                    css {
                        position = Position.absolute
                        top = 2.px
                        left = 2.px
                        width = 18.px
                        height = 18.px
                        backgroundColor = Color("rgba(90, 84, 74, 0.2)")
                    }
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

    private fun String.toPxOrPctOrRem(): LinearDimension {
        return if (endsWith("px")) substringBefore("px").toInt().px
        else if (endsWith("rem")) substringBefore("rem").toDouble().rem
        else if (endsWith("%")) substringBefore("%").toDouble().pct
        else 0.px
    }

    private fun DIV.renderCountBallsStrikes(parent: DIV, ev: PlayEvent) {
        if (ev.balls > 0 || ev.strikes > 0) {
            parent.div {
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

    private fun DIV.renderOutCircle(parent: DIV, outNum: Int?) {
        if (outNum != null) {
            parent.div {
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

    private fun DIV.renderEndedInningDiagonal(parent: DIV, ev: PlayEvent, teamEvents: List<PlayEvent>) {
        val playIdx = teamEvents.indexOf(ev)
        val nextPlay = teamEvents.getOrNull(playIdx + 1)
        val endedInning = ev.outsAfter == 3 && (nextPlay == null || nextPlay.inning > ev.inning)
        if (endedInning) {
            parent.div {
                css {
                    position = Position.absolute
                    bottom = (-10).px
                    right = (-10).px
                    width = 35.px
                    height = 1.px
                    backgroundColor = Color("#5a544a")
                    put("transform", "rotate(-45deg)")
                    put("transform-origin", "bottom right")
                    zIndex = 4
                }
            }
        }
    }
}

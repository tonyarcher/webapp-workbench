package com.baseball.ui.components

import com.baseball.UiConstants
import com.baseball.BaseballConstants

import com.baseball.models.*
import com.baseball.game.*
import com.baseball.ui.getScorebookNotation
import com.baseball.ui.appendElement
import com.baseball.ui.onClick
import com.baseball.ui.substituteBatter
import com.baseball.ui.substitutePitcher
import com.baseball.ui.renderCurrentTab
import com.baseball.ui.createElement
import org.w3c.dom.*
import kotlinx.browser.document
import kotlinx.browser.window

data class RunnerProgression(
    val maxBase: Int,
    val outAtBase: Int?,
    val outDetail: String?
)

// Renders the main scorecard paper sheet (Headers, lineups, innings grid, totals, and calls bottom section)
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

    val headerSection = container.appendElement(UiConstants.Html.DIV) {
        style.setProperty(UiConstants.Css.DISPLAY, "grid")
        style.setProperty("grid-template-columns", "150px 1fr 1fr 180px")
        style.setProperty(UiConstants.Css.BORDER, "2px solid #5a544a")
        style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "#eae5dc")
        style.setProperty(UiConstants.Css.PADDING, "0.75rem")
        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
        style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
    }

    headerSection.appendElement(UiConstants.Html.DIV) {
        textContent = if (isHomeBatting) "BOTTOM" else "TOP"
        style.setProperty(UiConstants.Css.FONT_SIZE, "2rem")
        style.setProperty(UiConstants.Css.COLOR, "#ff2a3b")
        style.setProperty("letter-spacing", "2px")
    }

    val teamInfo = headerSection.appendElement(UiConstants.Html.DIV) {
        style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
        style.setProperty(UiConstants.Css.FLEX_DIRECTION, UiConstants.CssValues.COLUMN)
        style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.CENTER)
    }
    teamInfo.appendElement(UiConstants.Html.DIV) { textContent = "TEAM: ${battingTeam.city.uppercase()} ${battingTeam.name.uppercase()}" }
    teamInfo.appendElement(UiConstants.Html.DIV) { 
        textContent = "MANAGER: ${if (isHomeBatting) "COUNSELL, C." else "REYNOLDS, J."}"
        style.setProperty(UiConstants.Css.FONT_SIZE, "0.85rem")
        style.setProperty(UiConstants.Css.COLOR, "#555")
        style.setProperty(UiConstants.Css.MARGIN_TOP, "0.25rem")
    }

    val gameInfo = headerSection.appendElement(UiConstants.Html.DIV) {
        style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
        style.setProperty(UiConstants.Css.FLEX_DIRECTION, UiConstants.CssValues.COLUMN)
        style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.CENTER)
    }
    gameInfo.appendElement(UiConstants.Html.DIV) { textContent = "PITCHING OPPONENT: ${pitchingTeam.name.uppercase()}" }
    gameInfo.appendElement(UiConstants.Html.DIV) { 
        textContent = "UMPIRES: HP: CULBRETH, F. | 1B: NELSON, J." 
        style.setProperty(UiConstants.Css.FONT_SIZE, "0.85rem")
        style.setProperty(UiConstants.Css.COLOR, "#555")
        style.setProperty(UiConstants.Css.MARGIN_TOP, "0.25rem")
    }

    val keepingScore = headerSection.appendElement(UiConstants.Html.DIV) {
        style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
        style.setProperty(UiConstants.Css.FLEX_DIRECTION, UiConstants.CssValues.COLUMN)
        style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.CENTER)
        style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.FLEX_END)
        style.setProperty(UiConstants.Css.FONT_SIZE, "0.8rem")
    }
    keepingScore.appendElement(UiConstants.Html.DIV) { textContent = "KEEPING SCORE BY: ☒ WEBAPP" }
    keepingScore.appendElement(UiConstants.Html.DIV) { textContent = "FIRST PITCH: 7:05 PM" }

    if (game.status != GameStatus.COMPLETED) {
        keepingScore.appendElement(UiConstants.Html.BUTTON, "btn") {
            textContent = "Bench & Bullpen"
            style.setProperty(UiConstants.Css.MARGIN_TOP, "0.4rem")
            style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem")
            style.setProperty(UiConstants.Css.PADDING, "2px 8px")
            style.setProperty(UiConstants.Css.BACKGROUND, "rgba(0, 0, 0, 0.05)")
            style.setProperty(UiConstants.Css.BORDER, "1px solid #5a544a")
            style.setProperty(UiConstants.Css.BORDER_RADIUS, "4px")
            style.setProperty(UiConstants.Css.CURSOR, UiConstants.CssValues.POINTER)
            onClick {
                val drawer = document.getElementById("roster-drawer-element") as? HTMLElement
                if (drawer != null) {
                    val isHidden = drawer.style.getPropertyValue(UiConstants.Css.DISPLAY) == UiConstants.CssValues.NONE
                    drawer.style.setProperty(UiConstants.Css.DISPLAY, if (isHidden) UiConstants.CssValues.BLOCK else UiConstants.CssValues.NONE)
                }
            }
        }
    }

    // Collapsible Bench & Bullpen Drawer
    val rosterDrawer = container.appendElement(UiConstants.Html.DIV) {
        id = "roster-drawer-element"
        style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.NONE)
        style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "#fcfbfa")
        style.setProperty(UiConstants.Css.BORDER, "2px solid #5a544a")
        style.setProperty(UiConstants.Css.BORDER_TOP, UiConstants.CssValues.NONE)
        style.setProperty(UiConstants.Css.PADDING, "1rem")
        style.setProperty(UiConstants.Css.MARGIN_TOP, "-1.1rem")
        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1.5rem")
        style.setProperty("font-family", "'Courier New', Courier, monospace")
    }

    val isHome = !isHomeBatting
    val fieldingBench = if (isHome) localHomeBench else localAwayBench
    val activePitcherName = if (isHome) localHomeActivePitcherName else localAwayActivePitcherName

    val drawerContent = rosterDrawer.appendElement(UiConstants.Html.DIV) {
        style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
        style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.SPACE_BETWEEN)
        style.setProperty(UiConstants.Css.GAP, "2rem")
    }

    // Left side: Bench
    val benchCol = drawerContent.appendElement(UiConstants.Html.DIV) {
        style.setProperty(UiConstants.Css.FLEX, "1")
    }
    benchCol.appendElement(UiConstants.Html.H4) {
        textContent = "AVAILABLE BENCH BATTERS"
        style.setProperty(UiConstants.Css.MARGIN, "0 0 0.5rem 0")
        style.setProperty(UiConstants.Css.FONT_SIZE, "0.85rem")
        style.setProperty(UiConstants.Css.COLOR, "#ff2a3b")
    }
    val benchList = if (isHomeBatting) localHomeBench else localAwayBench
    val availableBatters = benchList.filter { it.position != BaseballConstants.Positions.P && !localPlayersSubbedOut.contains(it.id) }
    if (availableBatters.isEmpty()) {
        benchCol.appendElement(UiConstants.Html.DIV) { textContent = "No batters left on bench"; style.setProperty(UiConstants.Css.FONT_SIZE, "0.8rem"); style.setProperty(UiConstants.Css.COLOR, "#777") }
    } else {
        availableBatters.forEach { p ->
            benchCol.appendElement(UiConstants.Html.DIV) {
                textContent = "• ${p.name} (#${p.jerseyNumber} - ${p.position})"
                style.setProperty(UiConstants.Css.FONT_SIZE, "0.8rem")
                style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.25rem")
            }
        }
    }

    // Right side: Bullpen
    val bullpenCol = drawerContent.appendElement(UiConstants.Html.DIV) {
        style.setProperty(UiConstants.Css.FLEX, "1")
    }
    bullpenCol.appendElement(UiConstants.Html.H4) {
        textContent = "ACTIVE PITCHER & BULLPEN"
        style.setProperty(UiConstants.Css.MARGIN, "0 0 0.5rem 0")
        style.setProperty(UiConstants.Css.FONT_SIZE, "0.85rem")
        style.setProperty(UiConstants.Css.COLOR, "#ff2a3b")
    }
    bullpenCol.appendElement(UiConstants.Html.DIV) {
        textContent = "Current Pitcher: $activePitcherName"
        style.setProperty(UiConstants.Css.FONT_SIZE, "0.8rem")
        style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.5rem")
    }

    val pSubs = fieldingBench.filter { it.position == BaseballConstants.Positions.P && !localPlayersSubbedOut.contains(it.id) }
    if (pSubs.isEmpty()) {
        bullpenCol.appendElement(UiConstants.Html.DIV) { textContent = "No relief pitchers available in bullpen"; style.setProperty(UiConstants.Css.FONT_SIZE, "0.8rem"); style.setProperty(UiConstants.Css.COLOR, "#777") }
    } else {
        val changePitcherRow = bullpenCol.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
            style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
            style.setProperty(UiConstants.Css.GAP, "0.5rem")
        }
        changePitcherRow.appendElement(UiConstants.Html.SPAN) { textContent = "Change Pitcher:"; style.setProperty(UiConstants.Css.FONT_SIZE, "0.8rem") }
        val selectOverlay = changePitcherRow.appendElement(UiConstants.Html.SELECT) as HTMLSelectElement
        selectOverlay.className = "form-control"
        selectOverlay.style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem")
        selectOverlay.style.setProperty(UiConstants.Css.PADDING, "2px")
        
        val defOpt = document.createElement(UiConstants.Html.OPTION) as HTMLOptionElement
        defOpt.textContent = "Select relief pitcher..."
        selectOverlay.appendChild(defOpt)
        
        pSubs.forEach { optPlayer ->
            val opt = document.createElement(UiConstants.Html.OPTION) as HTMLOptionElement
            opt.value = optPlayer.id.toString()
            opt.textContent = "${optPlayer.name} (#${optPlayer.jerseyNumber})"
            selectOverlay.appendChild(opt)
        }
        
        selectOverlay.addEventListener("change", {
            val valId = selectOverlay.value.toLongOrNull()
            if (valId != null) {
                substitutePitcher(isHome, valId)
                renderCurrentTab()
            }
        })
    }

    val tableWrapper = container.appendElement(UiConstants.Html.DIV) {
        style.setProperty("overflow-x", "auto")
        style.setProperty(UiConstants.Css.BORDER, "2px solid #5a544a")
        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1.5rem")
    }

    val table = tableWrapper.appendElement(UiConstants.Html.TABLE) {
        style.setProperty(UiConstants.Css.WIDTH, "100%")
        style.setProperty(UiConstants.Css.BORDER_COLLAPSE, UiConstants.CssValues.COLLAPSE)
        style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "#f9f7f2")
    }

    val thead = table.appendElement(UiConstants.Html.THEAD) {
        style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "#eae5dc")
    }
    val trh = thead.appendElement(UiConstants.Html.TR) {
        style.setProperty(UiConstants.Css.BORDER_BOTTOM, "2px solid #5a544a")
    }

    trh.appendElement(UiConstants.Html.TH) {
        textContent = "PLAYER"
        style.setProperty("border-right", "2px solid #5a544a")
        style.setProperty(UiConstants.Css.PADDING, "0.5rem")
        style.setProperty(UiConstants.Css.WIDTH, "220px")
        style.setProperty(UiConstants.Css.TEXT_ALIGN, "left")
    }
    trh.appendElement(UiConstants.Html.TH) {
        textContent = "Pos"
        style.setProperty("border-right", "2px solid #5a544a")
        style.setProperty(UiConstants.Css.PADDING, "0.5rem")
        style.setProperty(UiConstants.Css.WIDTH, "50px")
        style.setProperty(UiConstants.Css.TEXT_ALIGN, "center")
    }

    for (i in 1..maxInning) {
        trh.appendElement(UiConstants.Html.TH) {
            textContent = i.toString()
            style.setProperty("border-right", "1px solid #9c9384")
            style.setProperty(UiConstants.Css.WIDTH, "75px")
            style.setProperty(UiConstants.Css.TEXT_ALIGN, "center")
        }
    }

    val statsHeaders = listOf("AB", "R", "H", "RBI")
    statsHeaders.forEach { sh ->
        trh.appendElement(UiConstants.Html.TH) {
            textContent = sh
            style.setProperty("border-left", if (sh == BaseballConstants.METRIC_AB) "2px solid #5a544a" else "1px solid #9c9384")
            style.setProperty(UiConstants.Css.WIDTH, "45px")
            style.setProperty(UiConstants.Css.TEXT_ALIGN, "center")
        }
    }

    val tbody = table.appendElement(UiConstants.Html.TBODY)

    val baseRunners = mutableMapOf<String, Int>()
    val playAdvancements = mutableMapOf<PlayEvent, Int>()
    val playOutNumbers = mutableMapOf<PlayEvent, Int>()
    val playProgressions = mutableMapOf<PlayEvent, RunnerProgression>()

    for (inn in 1..maxInning) {
        val innEvents = teamEvents.filter { it.inning == inn }
        baseRunners.clear()
        var currentOuts = 0

        innEvents.forEach { ev ->
            val isOut = ev.eventType in listOf(
                ScoringEventType.STRIKEOUT, ScoringEventType.GROUNDOUT,
                ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT,
                ScoringEventType.POP_OUT, ScoringEventType.SACRIFICE_FLY
            )

            var finalBase = 0
            when (ev.eventType) {
                ScoringEventType.SINGLE, ScoringEventType.WALK, ScoringEventType.HIT_BY_PITCH, ScoringEventType.ERROR -> {
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

            if (isOut) {
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

        // Trace detailed base progressions for each resolving plate event
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

    // Helper to open sub selector overlay
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

    // Helper to render inning cells for starter/sub rows
    fun renderInningCell(tr: HTMLElement, ev: PlayEvent?, cellBg: String) {
        val tdCell = tr.appendElement(UiConstants.Html.TD) {
            style.setProperty("border-right", "1px solid #9c9384")
            style.setProperty(UiConstants.Css.PADDING, "0")
            style.setProperty(UiConstants.Css.HEIGHT, "42.5px")
            style.setProperty(UiConstants.Css.WIDTH, "75px")
            style.setProperty(UiConstants.Css.BACKGROUND, cellBg)
        }

        val cellWrapper = tdCell.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.POSITION, UiConstants.CssValues.RELATIVE)
            style.setProperty(UiConstants.Css.WIDTH, "100%")
            style.setProperty(UiConstants.Css.HEIGHT, "100%")
            style.setProperty(UiConstants.Css.BOX_SIZING, UiConstants.CssValues.BORDER_BOX)
            style.setProperty(UiConstants.Css.PADDING, "2px")
            style.setProperty(UiConstants.Css.OVERFLOW, UiConstants.CssValues.HIDDEN)
        }

        if (ev != null) {
            val prog = playProgressions[ev]
            val base = prog?.maxBase ?: (playAdvancements[ev] ?: 0)
            val outNum = playOutNumbers[ev]
            val outAtBase = prog?.outAtBase
            val outDetail = prog?.outDetail
            val notation = getScorebookNotation(ev)

            val diamond = cellWrapper.appendElement(UiConstants.Html.DIV) {
                style.setProperty(UiConstants.Css.POSITION, UiConstants.CssValues.ABSOLUTE)
                style.setProperty(UiConstants.Css.TOP, "50%")
                style.setProperty(UiConstants.Css.LEFT, "50%")
                style.setProperty(UiConstants.Css.WIDTH, "26px")
                style.setProperty(UiConstants.Css.HEIGHT, "26px")
                style.setProperty("margin-top", "-13px")
                style.setProperty("margin-left", "-13px")
                style.setProperty(UiConstants.Css.BORDER, "1px dashed #d2cdc6")
                style.setProperty(UiConstants.Css.TRANSFORM, "rotate(45deg)")
                style.setProperty(UiConstants.Css.Z_INDEX, "1")
            }

            if (base >= 1) diamond.style.setProperty(UiConstants.Css.BORDER_RIGHT, "2px solid #ff2a3b")
            if (base >= 2) diamond.style.setProperty(UiConstants.Css.BORDER_TOP, "2px solid #ff2a3b")
            if (base >= 3) diamond.style.setProperty(UiConstants.Css.BORDER_LEFT, "2px solid #ff2a3b")
            if (base >= 4) {
                diamond.style.setProperty(UiConstants.Css.BORDER_BOTTOM, "2px solid #ff2a3b")
                diamond.style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "rgba(255, 42, 59, 0.25)")
            }

            if (outAtBase != null && outDetail != null && outAtBase > 1) {
                cellWrapper.appendElement(UiConstants.Html.DIV) {
                    textContent = outDetail
                    style.setProperty(UiConstants.Css.POSITION, UiConstants.CssValues.ABSOLUTE)
                    when (outAtBase) {
                        2 -> {
                            style.setProperty(UiConstants.Css.TOP, "2px")
                            style.setProperty(UiConstants.Css.RIGHT, "2px")
                        }
                        3 -> {
                            style.setProperty(UiConstants.Css.TOP, "2px")
                            style.setProperty(UiConstants.Css.LEFT, "2px")
                        }
                        4 -> {
                            style.setProperty(UiConstants.Css.BOTTOM, "2px")
                            style.setProperty(UiConstants.Css.LEFT, "2px")
                        }
                    }
                    style.setProperty(UiConstants.Css.FONT_SIZE, "0.5rem")
                    style.setProperty(UiConstants.Css.COLOR, "#ff2a3b")
                    style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                    style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "rgba(255, 255, 255, 0.85)")
                    style.setProperty(UiConstants.Css.PADDING, "1px 2px")
                    style.setProperty(UiConstants.Css.BORDER_RADIUS, "2px")
                    style.setProperty(UiConstants.Css.Z_INDEX, "5")
                }
            }

            cellWrapper.appendElement(UiConstants.Html.DIV) {
                textContent = notation
                style.setProperty(UiConstants.Css.POSITION, UiConstants.CssValues.ABSOLUTE)
                style.setProperty(UiConstants.Css.TOP, "50%")
                style.setProperty(UiConstants.Css.LEFT, "50%")
                style.setProperty(UiConstants.Css.TRANSFORM, "translate(-50%, -50%)")
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem")
                style.setProperty(UiConstants.Css.Z_INDEX, "2")
            }

            val countDiv = cellWrapper.appendElement(UiConstants.Html.DIV) {
                style.setProperty(UiConstants.Css.POSITION, UiConstants.CssValues.ABSOLUTE)
                style.setProperty(UiConstants.Css.TOP, "2px")
                style.setProperty(UiConstants.Css.LEFT, "4px")
                style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                style.setProperty(UiConstants.Css.FLEX_DIRECTION, UiConstants.CssValues.COLUMN)
                style.setProperty(UiConstants.Css.GAP, "1px")
                style.setProperty(UiConstants.Css.Z_INDEX, "3")
            }

            val bRow = countDiv.appendElement(UiConstants.Html.DIV) { style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX); style.setProperty(UiConstants.Css.GAP, "1px") }
            for (b in 1..3) {
                bRow.appendElement(UiConstants.Html.SPAN) {
                    style.setProperty(UiConstants.Css.WIDTH, "3px")
                    style.setProperty(UiConstants.Css.HEIGHT, "3px")
                    style.setProperty(UiConstants.Css.BORDER_RADIUS, "50%")
                    style.setProperty(UiConstants.Css.BACKGROUND_COLOR, if (b <= ev.balls) "#ffcc00" else "#d2cdc6")
                }
            }
            val sRow = countDiv.appendElement(UiConstants.Html.DIV) { style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX); style.setProperty(UiConstants.Css.GAP, "1px") }
            for (s in 1..2) {
                sRow.appendElement(UiConstants.Html.SPAN) {
                    style.setProperty(UiConstants.Css.WIDTH, "3px")
                    style.setProperty(UiConstants.Css.HEIGHT, "3px")
                    style.setProperty(UiConstants.Css.BORDER_RADIUS, "50%")
                    style.setProperty(UiConstants.Css.BACKGROUND_COLOR, if (s <= ev.strikes) "#ff2a3b" else "#d2cdc6")
                }
            }

            if (outNum != null) {
                cellWrapper.appendElement(UiConstants.Html.DIV) {
                    textContent = outNum.toString()
                    style.setProperty(UiConstants.Css.POSITION, UiConstants.CssValues.ABSOLUTE)
                    style.setProperty(UiConstants.Css.BOTTOM, "2px")
                    style.setProperty(UiConstants.Css.RIGHT, "10px")
                    style.setProperty(UiConstants.Css.WIDTH, "11px")
                    style.setProperty(UiConstants.Css.HEIGHT, "11px")
                    style.setProperty(UiConstants.Css.BORDER, "1px solid #ff2a3b")
                    style.setProperty(UiConstants.Css.BORDER_RADIUS, "50%")
                    style.setProperty(UiConstants.Css.FONT_SIZE, "0.55rem")
                    style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                    style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.CENTER)
                    style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
                    style.setProperty(UiConstants.Css.COLOR, "#ff2a3b")
                    style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                    style.setProperty(UiConstants.Css.Z_INDEX, "3")
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
                cellWrapper.appendElement(UiConstants.Html.DIV) {
                    style.setProperty(UiConstants.Css.POSITION, UiConstants.CssValues.ABSOLUTE)
                    style.setProperty(UiConstants.Css.BOTTOM, "0")
                    style.setProperty(UiConstants.Css.RIGHT, "0")
                    style.setProperty(UiConstants.Css.WIDTH, "10px")
                    style.setProperty(UiConstants.Css.HEIGHT, "10px")
                    style.setProperty(UiConstants.Css.BACKGROUND, "linear-gradient(to bottom right, transparent calc(50% - 0.5px), #ff2a3b, transparent calc(50% + 1px))")
                    style.setProperty(UiConstants.Css.POINTER_EVENTS, UiConstants.CssValues.NONE)
                    style.setProperty(UiConstants.Css.Z_INDEX, "4")
                }
            }
        } else {
            cellWrapper.appendElement(UiConstants.Html.DIV) {
                style.setProperty(UiConstants.Css.POSITION, UiConstants.CssValues.ABSOLUTE)
                style.setProperty(UiConstants.Css.TOP, "50%")
                style.setProperty(UiConstants.Css.LEFT, "50%")
                style.setProperty(UiConstants.Css.WIDTH, "8px")
                style.setProperty(UiConstants.Css.HEIGHT, "8px")
                style.setProperty("margin-top", "-4px")
                style.setProperty("margin-left", "-4px")
                style.setProperty(UiConstants.Css.BORDER, "1px dashed #e2ded5")
                style.setProperty(UiConstants.Css.TRANSFORM, "rotate(45deg)")
            }
        }
    }

    for (slotIdx in 0..8) {
        val players = slotPlayers[slotIdx]
        val hasSub = players.size > 1
        val isEvenRow = slotIdx % 2 == 1
        val cellBg = if (isEvenRow) "linear-gradient(180deg, #f4f1e7 0%, #ebe6d9 100%)" else "linear-gradient(180deg, #faf9f6 0%, #f3f0e8 100%)"

        // --- ROW 0: STARTER ---
        val tr0 = tbody.appendElement(UiConstants.Html.TR) {
            style.setProperty("border-bottom", if (hasSub) "1px solid #9c9384" else "1px solid #5a544a")
            style.setProperty(UiConstants.Css.HEIGHT, "42.5px")
        }

        val tdPlayer0 = tr0.appendElement(UiConstants.Html.TD) {
            style.setProperty("border-right", "2px solid #5a544a")
            style.setProperty(UiConstants.Css.PADDING, "0 0.5rem")
            style.setProperty("vertical-align", "middle")
            style.setProperty(UiConstants.Css.BACKGROUND, cellBg)
            style.setProperty(UiConstants.Css.HEIGHT, "42.5px")
        }

        val pName0 = players.getOrNull(0) ?: ""
        val row0 = tdPlayer0.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
            style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.SPACE_BETWEEN)
            style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
            style.setProperty(UiConstants.Css.WIDTH, "100%")
        }
        row0.appendElement(UiConstants.Html.SPAN) {
            if (hasSub) {
                textContent = "${slotIdx + 1}. $pName0 (Subbed Out)"
                style.setProperty(UiConstants.Css.COLOR, "#777")
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.NORMAL)
                style.setProperty(UiConstants.Css.FONT_SIZE, "0.85rem")
            } else {
                textContent = "${slotIdx + 1}. $pName0"
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                style.setProperty(UiConstants.Css.FONT_SIZE, "0.95rem")
            }
        }

        if (!hasSub && game.status != GameStatus.COMPLETED) {
            row0.appendElement(UiConstants.Html.BUTTON, "btn") {
                textContent = "Sub"
                style.setProperty(UiConstants.Css.PADDING, "2px 6px")
                style.setProperty(UiConstants.Css.FONT_SIZE, "0.7rem")
                style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "#5a544a")
                style.setProperty(UiConstants.Css.COLOR, "white")
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                style.setProperty(UiConstants.Css.BORDER, UiConstants.CssValues.NONE)
                style.setProperty(UiConstants.Css.BORDER_RADIUS, "4px")
                style.setProperty(UiConstants.Css.CURSOR, UiConstants.CssValues.POINTER)
                onClick {
                    openSubSelector(row0, slotIdx)
                }
            }
        }

        val starterPos = battingStatsList.find { it.playerName == pName0 }?.position ?: BaseballConstants.Positions.DH
        tr0.appendElement(UiConstants.Html.TD) {
            textContent = starterPos
            style.setProperty("border-right", "2px solid #5a544a")
            style.setProperty(UiConstants.Css.PADDING, "0.5rem")
            style.setProperty(UiConstants.Css.TEXT_ALIGN, "center")
            style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
            style.setProperty(UiConstants.Css.BACKGROUND, cellBg)
        }

        // --- ROW 1: SUBSTITUTE (Only if hasSub is true) ---
        var tr1: HTMLElement? = null
        if (hasSub) {
            tr1 = tbody.appendElement(UiConstants.Html.TR) {
                style.setProperty("border-bottom", "1px solid #5a544a") // outer/notebook border
                style.setProperty(UiConstants.Css.HEIGHT, "42.5px")
            }

            val tdPlayer1 = tr1.appendElement(UiConstants.Html.TD) {
                style.setProperty("border-right", "2px solid #5a544a")
                style.setProperty(UiConstants.Css.PADDING, "0 0.5rem")
                style.setProperty("vertical-align", "middle")
                style.setProperty(UiConstants.Css.BACKGROUND, cellBg)
                style.setProperty(UiConstants.Css.HEIGHT, "42.5px")
            }

            val pName1 = players[1]
            val row1 = tdPlayer1.appendElement(UiConstants.Html.DIV) {
                style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.SPACE_BETWEEN)
                style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
                style.setProperty(UiConstants.Css.WIDTH, "100%")
            }
            row1.appendElement(UiConstants.Html.SPAN) {
                textContent = "${slotIdx + 1}. $pName1"
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                style.setProperty(UiConstants.Css.FONT_SIZE, "0.95rem")
                style.setProperty(UiConstants.Css.COLOR, "#2b2a28")
            }
            if (game.status != GameStatus.COMPLETED) {
                row1.appendElement(UiConstants.Html.BUTTON, "btn") {
                    textContent = "Sub"
                    style.setProperty(UiConstants.Css.PADDING, "2px 6px")
                    style.setProperty(UiConstants.Css.FONT_SIZE, "0.7rem")
                    style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "#5a544a")
                    style.setProperty(UiConstants.Css.COLOR, "white")
                    style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                    style.setProperty(UiConstants.Css.BORDER, UiConstants.CssValues.NONE)
                    style.setProperty(UiConstants.Css.BORDER_RADIUS, "4px")
                    style.setProperty(UiConstants.Css.CURSOR, UiConstants.CssValues.POINTER)
                    onClick {
                        openSubSelector(row1, slotIdx)
                    }
                }
            }

            val subPos = battingStatsList.find { it.playerName == pName1 }?.position ?: BaseballConstants.Positions.DH
            tr1.appendElement(UiConstants.Html.TD) {
                textContent = subPos
                style.setProperty("border-right", "2px solid #5a544a")
                style.setProperty(UiConstants.Css.PADDING, "0.5rem")
                style.setProperty(UiConstants.Css.TEXT_ALIGN, "center")
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                style.setProperty(UiConstants.Css.BACKGROUND, cellBg)
            }
        }

        // --- INNING CELLS ---
        for (inn in 1..maxInning) {
            val ev = teamEvents.find { (teamEvents.indexOf(it) % 9 == slotIdx) && it.inning == inn }
            val isSubPlay = ev != null && hasSub && ev.batterName == players[1]

            if (isSubPlay && tr1 != null) {
                renderInningCell(tr0, null, cellBg)
                renderInningCell(tr1, ev, cellBg)
            } else {
                renderInningCell(tr0, ev, cellBg)
                if (hasSub && tr1 != null) {
                    renderInningCell(tr1, null, cellBg)
                }
            }
        }

        // --- STATS CELLS ---
        val stat0 = battingStatsList.find { it.playerName == pName0 }
        tr0.appendElement(UiConstants.Html.TD) {
            textContent = stat0?.atBats?.toString() ?: "0"
            style.setProperty("border-left", "2px solid #5a544a")
            style.setProperty("border-right", "1px solid #9c9384")
            style.setProperty(UiConstants.Css.TEXT_ALIGN, "center")
            style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
            style.setProperty(UiConstants.Css.BACKGROUND, cellBg)
        }
        tr0.appendElement(UiConstants.Html.TD) {
            textContent = stat0?.runs?.toString() ?: "0"
            style.setProperty("border-right", "1px solid #9c9384")
            style.setProperty(UiConstants.Css.TEXT_ALIGN, "center")
            style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
            style.setProperty(UiConstants.Css.BACKGROUND, cellBg)
        }
        tr0.appendElement(UiConstants.Html.TD) {
            textContent = stat0?.hits?.toString() ?: "0"
            style.setProperty("border-right", "1px solid #9c9384")
            style.setProperty(UiConstants.Css.TEXT_ALIGN, "center")
            style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
            style.setProperty(UiConstants.Css.BACKGROUND, cellBg)
        }
        tr0.appendElement(UiConstants.Html.TD) {
            textContent = stat0?.rbi?.toString() ?: "0"
            style.setProperty("border-right", "1px solid #9c9384")
            style.setProperty(UiConstants.Css.TEXT_ALIGN, "center")
            style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
            style.setProperty(UiConstants.Css.BACKGROUND, cellBg)
        }

        if (hasSub && tr1 != null) {
            val pName1 = players[1]
            val stat1 = battingStatsList.find { it.playerName == pName1 }
            tr1.appendElement(UiConstants.Html.TD) {
                textContent = stat1?.atBats?.toString() ?: ""
                style.setProperty("border-left", "2px solid #5a544a")
                style.setProperty("border-right", "1px solid #9c9384")
                style.setProperty(UiConstants.Css.TEXT_ALIGN, "center")
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                style.setProperty(UiConstants.Css.BACKGROUND, cellBg)
            }
            tr1.appendElement(UiConstants.Html.TD) {
                textContent = stat1?.runs?.toString() ?: ""
                style.setProperty("border-right", "1px solid #9c9384")
                style.setProperty(UiConstants.Css.TEXT_ALIGN, "center")
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                style.setProperty(UiConstants.Css.BACKGROUND, cellBg)
            }
            tr1.appendElement(UiConstants.Html.TD) {
                textContent = stat1?.hits?.toString() ?: ""
                style.setProperty("border-right", "1px solid #9c9384")
                style.setProperty(UiConstants.Css.TEXT_ALIGN, "center")
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                style.setProperty(UiConstants.Css.BACKGROUND, cellBg)
            }
            tr1.appendElement(UiConstants.Html.TD) {
                textContent = stat1?.rbi?.toString() ?: ""
                style.setProperty("border-right", "1px solid #9c9384")
                style.setProperty(UiConstants.Css.TEXT_ALIGN, "center")
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                style.setProperty(UiConstants.Css.BACKGROUND, cellBg)
            }
        }
    }

    val trSummary = tbody.appendElement(UiConstants.Html.TR) {
        style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "#eae5dc")
        style.setProperty("border-top", "2px solid #5a544a")
        style.setProperty(UiConstants.Css.HEIGHT, "40px")
    }

    trSummary.appendElement(UiConstants.Html.TD) {
        setAttribute("colspan", "2")
        textContent = "RUNS-HITS-ERRORS"
        style.setProperty("border-right", "2px solid #5a544a")
        style.setProperty(UiConstants.Css.PADDING, "0.5rem")
        style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
        style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem")
        style.setProperty(UiConstants.Css.WHITE_SPACE, UiConstants.CssValues.NOWRAP)
    }

    for (inn in 1..maxInning) {
        val innEvents = teamEvents.filter { it.inning == inn }
        val runs = innEvents.sumOf { it.runsScoredOnPlay }
        val hits = innEvents.count { it.eventType in listOf(ScoringEventType.SINGLE, ScoringEventType.DOUBLE, ScoringEventType.TRIPLE, ScoringEventType.HOME_RUN) }
        val errors = innEvents.count { it.eventType == ScoringEventType.ERROR }

        trSummary.appendElement(UiConstants.Html.TD) {
            textContent = "$runs-$hits-$errors"
            style.setProperty("border-right", "1px solid #9c9384")
            style.setProperty(UiConstants.Css.TEXT_ALIGN, "center")
            style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
            style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem")
            style.setProperty(UiConstants.Css.COLOR, "#ff2a3b")
            style.setProperty(UiConstants.Css.WHITE_SPACE, UiConstants.CssValues.NOWRAP)
            style.setProperty(UiConstants.Css.WIDTH, "75px")
            
            style.setProperty(UiConstants.Css.POSITION, UiConstants.CssValues.RELATIVE)
            appendElement(UiConstants.Html.DIV) {
                style.setProperty(UiConstants.Css.POSITION, UiConstants.CssValues.ABSOLUTE)
                style.setProperty(UiConstants.Css.TOP, "0")
                style.setProperty(UiConstants.Css.RIGHT, "0")
                style.setProperty(UiConstants.Css.WIDTH, "100%")
                style.setProperty(UiConstants.Css.HEIGHT, "100%")
                style.setProperty("background", "linear-gradient(to top right, transparent calc(50% - 0.5px), #5a544a, transparent calc(50% + 1px))")
                style.setProperty(UiConstants.Css.POINTER_EVENTS, UiConstants.CssValues.NONE)
                style.setProperty(UiConstants.Css.OPACITY, "0.3")
            }
        }
    }

    for (s in 1..4) {
        trSummary.appendElement(UiConstants.Html.TD) {
            style.setProperty("border-right", "1px solid #9c9384")
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

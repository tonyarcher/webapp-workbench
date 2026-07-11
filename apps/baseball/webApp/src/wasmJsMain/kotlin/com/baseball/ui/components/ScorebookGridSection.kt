package com.baseball.ui.components

import com.baseball.Constants
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

    val headerSection = container.appendElement("div") {
        style.setProperty("display", "grid")
        style.setProperty("grid-template-columns", "150px 1fr 1fr 180px")
        style.setProperty("border", "2px solid #5a544a")
        style.setProperty("background-color", "#eae5dc")
        style.setProperty("padding", "0.75rem")
        style.setProperty("margin-bottom", "1rem")
        style.setProperty("font-weight", "bold")
    }

    headerSection.appendElement("div") {
        textContent = if (isHomeBatting) "BOTTOM" else "TOP"
        style.setProperty("font-size", "2rem")
        style.setProperty("color", "#ff2a3b")
        style.setProperty("letter-spacing", "2px")
    }

    val teamInfo = headerSection.appendElement("div") {
        style.setProperty("display", "flex")
        style.setProperty("flex-direction", "column")
        style.setProperty("justify-content", "center")
    }
    teamInfo.appendElement("div") { textContent = "TEAM: ${battingTeam.city.uppercase()} ${battingTeam.name.uppercase()}" }
    teamInfo.appendElement("div") { 
        textContent = "MANAGER: ${if (isHomeBatting) "COUNSELL, C." else "REYNOLDS, J."}"
        style.setProperty("font-size", "0.85rem")
        style.setProperty("color", "#555")
        style.setProperty("margin-top", "0.25rem")
    }

    val gameInfo = headerSection.appendElement("div") {
        style.setProperty("display", "flex")
        style.setProperty("flex-direction", "column")
        style.setProperty("justify-content", "center")
    }
    gameInfo.appendElement("div") { textContent = "PITCHING OPPONENT: ${pitchingTeam.name.uppercase()}" }
    gameInfo.appendElement("div") { 
        textContent = "UMPIRES: HP: CULBRETH, F. | 1B: NELSON, J." 
        style.setProperty("font-size", "0.85rem")
        style.setProperty("color", "#555")
        style.setProperty("margin-top", "0.25rem")
    }

    val keepingScore = headerSection.appendElement("div") {
        style.setProperty("display", "flex")
        style.setProperty("flex-direction", "column")
        style.setProperty("justify-content", "center")
        style.setProperty("align-items", "flex-end")
        style.setProperty("font-size", "0.8rem")
    }
    keepingScore.appendElement("div") { textContent = "KEEPING SCORE BY: ☒ WEBAPP" }
    keepingScore.appendElement("div") { textContent = "FIRST PITCH: 7:05 PM" }

    if (game.status != GameStatus.COMPLETED) {
        keepingScore.appendElement("button", "btn") {
            textContent = "Bench & Bullpen"
            style.setProperty("margin-top", "0.4rem")
            style.setProperty("font-size", "0.75rem")
            style.setProperty("padding", "2px 8px")
            style.setProperty("background", "rgba(0, 0, 0, 0.05)")
            style.setProperty("border", "1px solid #5a544a")
            style.setProperty("border-radius", "4px")
            style.setProperty("cursor", "pointer")
            onClick {
                val drawer = document.getElementById("roster-drawer-element") as? HTMLElement
                if (drawer != null) {
                    val isHidden = drawer.style.getPropertyValue("display") == "none"
                    drawer.style.setProperty("display", if (isHidden) "block" else "none")
                }
            }
        }
    }

    // Collapsible Bench & Bullpen Drawer
    val rosterDrawer = container.appendElement("div") {
        id = "roster-drawer-element"
        style.setProperty("display", "none")
        style.setProperty("background-color", "#fcfbfa")
        style.setProperty("border", "2px solid #5a544a")
        style.setProperty("border-top", "none")
        style.setProperty("padding", "1rem")
        style.setProperty("margin-top", "-1.1rem")
        style.setProperty("margin-bottom", "1.5rem")
        style.setProperty("font-family", "'Courier New', Courier, monospace")
    }

    val isHome = !isHomeBatting
    val fieldingBench = if (isHome) localHomeBench else localAwayBench
    val activePitcherName = if (isHome) localHomeActivePitcherName else localAwayActivePitcherName

    val drawerContent = rosterDrawer.appendElement("div") {
        style.setProperty("display", "flex")
        style.setProperty("justify-content", "space-between")
        style.setProperty("gap", "2rem")
    }

    // Left side: Bench
    val benchCol = drawerContent.appendElement("div") {
        style.setProperty("flex", "1")
    }
    benchCol.appendElement("h4") {
        textContent = "AVAILABLE BENCH BATTERS"
        style.setProperty("margin", "0 0 0.5rem 0")
        style.setProperty("font-size", "0.85rem")
        style.setProperty("color", "#ff2a3b")
    }
    val benchList = if (isHomeBatting) localHomeBench else localAwayBench
    val availableBatters = benchList.filter { it.position != Constants.Positions.P && !localPlayersSubbedOut.contains(it.id) }
    if (availableBatters.isEmpty()) {
        benchCol.appendElement("div") { textContent = "No batters left on bench"; style.setProperty("font-size", "0.8rem"); style.setProperty("color", "#777") }
    } else {
        availableBatters.forEach { p ->
            benchCol.appendElement("div") {
                textContent = "• ${p.name} (#${p.jerseyNumber} - ${p.position})"
                style.setProperty("font-size", "0.8rem")
                style.setProperty("margin-bottom", "0.25rem")
            }
        }
    }

    // Right side: Bullpen
    val bullpenCol = drawerContent.appendElement("div") {
        style.setProperty("flex", "1")
    }
    bullpenCol.appendElement("h4") {
        textContent = "ACTIVE PITCHER & BULLPEN"
        style.setProperty("margin", "0 0 0.5rem 0")
        style.setProperty("font-size", "0.85rem")
        style.setProperty("color", "#ff2a3b")
    }
    bullpenCol.appendElement("div") {
        textContent = "Current Pitcher: $activePitcherName"
        style.setProperty("font-size", "0.8rem")
        style.setProperty("font-weight", "bold")
        style.setProperty("margin-bottom", "0.5rem")
    }

    val pSubs = fieldingBench.filter { it.position == Constants.Positions.P && !localPlayersSubbedOut.contains(it.id) }
    if (pSubs.isEmpty()) {
        bullpenCol.appendElement("div") { textContent = "No relief pitchers available in bullpen"; style.setProperty("font-size", "0.8rem"); style.setProperty("color", "#777") }
    } else {
        val changePitcherRow = bullpenCol.appendElement("div") {
            style.setProperty("display", "flex")
            style.setProperty("align-items", "center")
            style.setProperty("gap", "0.5rem")
        }
        changePitcherRow.appendElement("span") { textContent = "Change Pitcher:"; style.setProperty("font-size", "0.8rem") }
        val selectOverlay = changePitcherRow.appendElement("select") as HTMLSelectElement
        selectOverlay.className = "form-control"
        selectOverlay.style.setProperty("font-size", "0.75rem")
        selectOverlay.style.setProperty("padding", "2px")
        
        val defOpt = document.createElement("option") as HTMLOptionElement
        defOpt.textContent = "Select relief pitcher..."
        selectOverlay.appendChild(defOpt)
        
        pSubs.forEach { optPlayer ->
            val opt = document.createElement("option") as HTMLOptionElement
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

    val tableWrapper = container.appendElement("div") {
        style.setProperty("overflow-x", "auto")
        style.setProperty("border", "2px solid #5a544a")
        style.setProperty("margin-bottom", "1.5rem")
    }

    val table = tableWrapper.appendElement("table") {
        style.setProperty("width", "100%")
        style.setProperty("border-collapse", "collapse")
        style.setProperty("background-color", "#f9f7f2")
    }

    val thead = table.appendElement("thead") {
        style.setProperty("background-color", "#eae5dc")
    }
    val trh = thead.appendElement("tr") {
        style.setProperty("border-bottom", "2px solid #5a544a")
    }

    trh.appendElement("th") {
        textContent = "PLAYER"
        style.setProperty("border-right", "2px solid #5a544a")
        style.setProperty("padding", "0.5rem")
        style.setProperty("width", "220px")
        style.setProperty("text-align", "left")
    }
    trh.appendElement("th") {
        textContent = "Pos"
        style.setProperty("border-right", "2px solid #5a544a")
        style.setProperty("padding", "0.5rem")
        style.setProperty("width", "50px")
        style.setProperty("text-align", "center")
    }

    for (i in 1..maxInning) {
        trh.appendElement("th") {
            textContent = i.toString()
            style.setProperty("border-right", "1px solid #9c9384")
            style.setProperty("width", "75px")
            style.setProperty("text-align", "center")
        }
    }

    val statsHeaders = listOf("AB", "R", "H", "RBI")
    statsHeaders.forEach { sh ->
        trh.appendElement("th") {
            textContent = sh
            style.setProperty("border-left", if (sh == "AB") "2px solid #5a544a" else "1px solid #9c9384")
            style.setProperty("width", "45px")
            style.setProperty("text-align", "center")
        }
    }

    val tbody = table.appendElement("tbody")

    val baseRunners = mutableMapOf<String, Int>()
    val playAdvancements = mutableMapOf<PlayEvent, Int>()
    val playOutNumbers = mutableMapOf<PlayEvent, Int>()

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
    }

    // Helper to open sub selector overlay
    fun openSubSelector(container: HTMLElement, idx: Int) {
        val bench = if (isHomeBatting) localHomeBench else localAwayBench
        val subOptions = bench.filter { it.position != Constants.Positions.P && !localPlayersSubbedOut.contains(it.id) }
        if (subOptions.isEmpty()) {
            window.alert("No bench batters available!")
        } else {
            val selectOverlay = document.createElement("select") as HTMLSelectElement
            selectOverlay.className = "form-control"
            selectOverlay.style.setProperty("font-size", "0.75rem")
            selectOverlay.style.setProperty("padding", "2px")
            
            val defOpt = document.createElement("option") as HTMLOptionElement
            defOpt.textContent = "Select pinch hitter..."
            selectOverlay.appendChild(defOpt)
            
            subOptions.forEach { optPlayer ->
                val opt = document.createElement("option") as HTMLOptionElement
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
        val tdCell = tr.appendElement("td") {
            style.setProperty("border-right", "1px solid #9c9384")
            style.setProperty("padding", "0")
            style.setProperty("height", "42.5px")
            style.setProperty("width", "75px")
            style.setProperty("background", cellBg)
        }

        val cellWrapper = tdCell.appendElement("div") {
            style.setProperty("position", "relative")
            style.setProperty("width", "100%")
            style.setProperty("height", "100%")
            style.setProperty("box-sizing", "border-box")
            style.setProperty("padding", "2px")
            style.setProperty("overflow", "hidden")
        }

        if (ev != null) {
            val notation = getScorebookNotation(ev)
            val base = playAdvancements[ev] ?: 0
            val outNum = playOutNumbers[ev]

            val diamond = cellWrapper.appendElement("div") {
                style.setProperty("position", "absolute")
                style.setProperty("top", "50%")
                style.setProperty("left", "50%")
                style.setProperty("width", "26px")
                style.setProperty("height", "26px")
                style.setProperty("margin-top", "-13px")
                style.setProperty("margin-left", "-13px")
                style.setProperty("border", "1px dashed #d2cdc6")
                style.setProperty("transform", "rotate(45deg)")
                style.setProperty("z-index", "1")
            }

            if (base >= 1) diamond.style.setProperty("border-right", "2px solid #ff2a3b")
            if (base >= 2) diamond.style.setProperty("border-top", "2px solid #ff2a3b")
            if (base >= 3) diamond.style.setProperty("border-left", "2px solid #ff2a3b")
            if (base >= 4) {
                diamond.style.setProperty("border-bottom", "2px solid #ff2a3b")
                diamond.style.setProperty("background-color", "rgba(255, 42, 59, 0.25)")
            }

            cellWrapper.appendElement("div") {
                textContent = notation
                style.setProperty("position", "absolute")
                style.setProperty("top", "50%")
                style.setProperty("left", "50%")
                style.setProperty("transform", "translate(-50%, -50%)")
                style.setProperty("font-weight", "bold")
                style.setProperty("font-size", "0.75rem")
                style.setProperty("z-index", "2")
            }

            val countDiv = cellWrapper.appendElement("div") {
                style.setProperty("position", "absolute")
                style.setProperty("top", "2px")
                style.setProperty("left", "4px")
                style.setProperty("display", "flex")
                style.setProperty("flex-direction", "column")
                style.setProperty("gap", "1px")
                style.setProperty("z-index", "3")
            }

            val bRow = countDiv.appendElement("div") { style.setProperty("display", "flex"); style.setProperty("gap", "1px") }
            for (b in 1..3) {
                bRow.appendElement("span") {
                    style.setProperty("width", "3px")
                    style.setProperty("height", "3px")
                    style.setProperty("border-radius", "50%")
                    style.setProperty("background-color", if (b <= ev.balls) "#ffcc00" else "#d2cdc6")
                }
            }
            val sRow = countDiv.appendElement("div") { style.setProperty("display", "flex"); style.setProperty("gap", "1px") }
            for (s in 1..2) {
                sRow.appendElement("span") {
                    style.setProperty("width", "3px")
                    style.setProperty("height", "3px")
                    style.setProperty("border-radius", "50%")
                    style.setProperty("background-color", if (s <= ev.strikes) "#ff2a3b" else "#d2cdc6")
                }
            }

            if (outNum != null) {
                cellWrapper.appendElement("div") {
                    textContent = outNum.toString()
                    style.setProperty("position", "absolute")
                    style.setProperty("bottom", "2px")
                    style.setProperty("right", "10px")
                    style.setProperty("width", "11px")
                    style.setProperty("height", "11px")
                    style.setProperty("border", "1px solid #ff2a3b")
                    style.setProperty("border-radius", "50%")
                    style.setProperty("font-size", "0.55rem")
                    style.setProperty("display", "flex")
                    style.setProperty("justify-content", "center")
                    style.setProperty("align-items", "center")
                    style.setProperty("color", "#ff2a3b")
                    style.setProperty("font-weight", "bold")
                    style.setProperty("z-index", "3")
                }
            }

            val nextEv = teamEvents.getOrNull(teamEvents.indexOf(ev) + 1)
            val endedInning = if (nextEv != null) {
                nextEv.inning != ev.inning || nextEv.half != ev.half
            } else {
                val outsOnPlay = if (ev.description.contains("Double Play") || ev.description.contains("DP")) 2 
                                 else if (ev.eventType in listOf(ScoringEventType.STRIKEOUT, ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT, ScoringEventType.SACRIFICE_FLY, ScoringEventType.FIELDER_CHOICE)) 1 
                                 else 0
                ev.outsBefore + outsOnPlay >= 3
            }

            if (endedInning) {
                cellWrapper.appendElement("div") {
                    style.setProperty("position", "absolute")
                    style.setProperty("bottom", "0")
                    style.setProperty("right", "0")
                    style.setProperty("width", "10px")
                    style.setProperty("height", "10px")
                    style.setProperty("background", "linear-gradient(to bottom right, transparent calc(50% - 0.5px), #ff2a3b, transparent calc(50% + 1px))")
                    style.setProperty("pointer-events", "none")
                    style.setProperty("z-index", "4")
                }
            }
        } else {
            cellWrapper.appendElement("div") {
                style.setProperty("position", "absolute")
                style.setProperty("top", "50%")
                style.setProperty("left", "50%")
                style.setProperty("width", "8px")
                style.setProperty("height", "8px")
                style.setProperty("margin-top", "-4px")
                style.setProperty("margin-left", "-4px")
                style.setProperty("border", "1px dashed #e2ded5")
                style.setProperty("transform", "rotate(45deg)")
            }
        }
    }

    for (slotIdx in 0..8) {
        val players = slotPlayers[slotIdx]
        val hasSub = players.size > 1
        val isEvenRow = slotIdx % 2 == 1
        val cellBg = if (isEvenRow) "linear-gradient(180deg, #f4f1e7 0%, #ebe6d9 100%)" else "linear-gradient(180deg, #faf9f6 0%, #f3f0e8 100%)"

        // --- ROW 0: STARTER ---
        val tr0 = tbody.appendElement("tr") {
            style.setProperty("border-bottom", if (hasSub) "1px solid #9c9384" else "1px solid #5a544a")
            style.setProperty("height", "42.5px")
        }

        val tdPlayer0 = tr0.appendElement("td") {
            style.setProperty("border-right", "2px solid #5a544a")
            style.setProperty("padding", "0 0.5rem")
            style.setProperty("vertical-align", "middle")
            style.setProperty("background", cellBg)
            style.setProperty("height", "42.5px")
        }

        val pName0 = players.getOrNull(0) ?: ""
        val row0 = tdPlayer0.appendElement("div") {
            style.setProperty("display", "flex")
            style.setProperty("justify-content", "space-between")
            style.setProperty("align-items", "center")
            style.setProperty("width", "100%")
        }
        row0.appendElement("span") {
            if (hasSub) {
                textContent = "${slotIdx + 1}. $pName0 (Subbed Out)"
                style.setProperty("color", "#777")
                style.setProperty("font-weight", "normal")
                style.setProperty("font-size", "0.85rem")
            } else {
                textContent = "${slotIdx + 1}. $pName0"
                style.setProperty("font-weight", "bold")
                style.setProperty("font-size", "0.95rem")
            }
        }

        if (!hasSub && game.status != GameStatus.COMPLETED) {
            row0.appendElement("button", "btn") {
                textContent = "Sub"
                style.setProperty("padding", "2px 6px")
                style.setProperty("font-size", "0.7rem")
                style.setProperty("background-color", "#5a544a")
                style.setProperty("color", "white")
                style.setProperty("font-weight", "bold")
                style.setProperty("border", "none")
                style.setProperty("border-radius", "4px")
                style.setProperty("cursor", "pointer")
                onClick {
                    openSubSelector(row0, slotIdx)
                }
            }
        }

        val starterPos = battingStatsList.find { it.playerName == pName0 }?.position ?: Constants.Positions.DH
        tr0.appendElement("td") {
            textContent = starterPos
            style.setProperty("border-right", "2px solid #5a544a")
            style.setProperty("padding", "0.5rem")
            style.setProperty("text-align", "center")
            style.setProperty("font-weight", "bold")
            style.setProperty("background", cellBg)
        }

        // --- ROW 1: SUBSTITUTE (Only if hasSub is true) ---
        var tr1: HTMLElement? = null
        if (hasSub) {
            tr1 = tbody.appendElement("tr") {
                style.setProperty("border-bottom", "1px solid #5a544a") // outer/notebook border
                style.setProperty("height", "42.5px")
            }

            val tdPlayer1 = tr1.appendElement("td") {
                style.setProperty("border-right", "2px solid #5a544a")
                style.setProperty("padding", "0 0.5rem")
                style.setProperty("vertical-align", "middle")
                style.setProperty("background", cellBg)
                style.setProperty("height", "42.5px")
            }

            val pName1 = players[1]
            val row1 = tdPlayer1.appendElement("div") {
                style.setProperty("display", "flex")
                style.setProperty("justify-content", "space-between")
                style.setProperty("align-items", "center")
                style.setProperty("width", "100%")
            }
            row1.appendElement("span") {
                textContent = "${slotIdx + 1}. $pName1"
                style.setProperty("font-weight", "bold")
                style.setProperty("font-size", "0.95rem")
                style.setProperty("color", "#2b2a28")
            }
            if (game.status != GameStatus.COMPLETED) {
                row1.appendElement("button", "btn") {
                    textContent = "Sub"
                    style.setProperty("padding", "2px 6px")
                    style.setProperty("font-size", "0.7rem")
                    style.setProperty("background-color", "#5a544a")
                    style.setProperty("color", "white")
                    style.setProperty("font-weight", "bold")
                    style.setProperty("border", "none")
                    style.setProperty("border-radius", "4px")
                    style.setProperty("cursor", "pointer")
                    onClick {
                        openSubSelector(row1, slotIdx)
                    }
                }
            }

            val subPos = battingStatsList.find { it.playerName == pName1 }?.position ?: Constants.Positions.DH
            tr1.appendElement("td") {
                textContent = subPos
                style.setProperty("border-right", "2px solid #5a544a")
                style.setProperty("padding", "0.5rem")
                style.setProperty("text-align", "center")
                style.setProperty("font-weight", "bold")
                style.setProperty("background", cellBg)
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
        tr0.appendElement("td") {
            textContent = stat0?.atBats?.toString() ?: "0"
            style.setProperty("border-left", "2px solid #5a544a")
            style.setProperty("border-right", "1px solid #9c9384")
            style.setProperty("text-align", "center")
            style.setProperty("font-weight", "bold")
            style.setProperty("background", cellBg)
        }
        tr0.appendElement("td") {
            textContent = stat0?.runs?.toString() ?: "0"
            style.setProperty("border-right", "1px solid #9c9384")
            style.setProperty("text-align", "center")
            style.setProperty("font-weight", "bold")
            style.setProperty("background", cellBg)
        }
        tr0.appendElement("td") {
            textContent = stat0?.hits?.toString() ?: "0"
            style.setProperty("border-right", "1px solid #9c9384")
            style.setProperty("text-align", "center")
            style.setProperty("font-weight", "bold")
            style.setProperty("background", cellBg)
        }
        tr0.appendElement("td") {
            textContent = stat0?.rbi?.toString() ?: "0"
            style.setProperty("border-right", "1px solid #9c9384")
            style.setProperty("text-align", "center")
            style.setProperty("font-weight", "bold")
            style.setProperty("background", cellBg)
        }

        if (hasSub && tr1 != null) {
            val pName1 = players[1]
            val stat1 = battingStatsList.find { it.playerName == pName1 }
            tr1.appendElement("td") {
                textContent = stat1?.atBats?.toString() ?: ""
                style.setProperty("border-left", "2px solid #5a544a")
                style.setProperty("border-right", "1px solid #9c9384")
                style.setProperty("text-align", "center")
                style.setProperty("font-weight", "bold")
                style.setProperty("background", cellBg)
            }
            tr1.appendElement("td") {
                textContent = stat1?.runs?.toString() ?: ""
                style.setProperty("border-right", "1px solid #9c9384")
                style.setProperty("text-align", "center")
                style.setProperty("font-weight", "bold")
                style.setProperty("background", cellBg)
            }
            tr1.appendElement("td") {
                textContent = stat1?.hits?.toString() ?: ""
                style.setProperty("border-right", "1px solid #9c9384")
                style.setProperty("text-align", "center")
                style.setProperty("font-weight", "bold")
                style.setProperty("background", cellBg)
            }
            tr1.appendElement("td") {
                textContent = stat1?.rbi?.toString() ?: ""
                style.setProperty("border-right", "1px solid #9c9384")
                style.setProperty("text-align", "center")
                style.setProperty("font-weight", "bold")
                style.setProperty("background", cellBg)
            }
        }
    }

    val trSummary = tbody.appendElement("tr") {
        style.setProperty("background-color", "#eae5dc")
        style.setProperty("border-top", "2px solid #5a544a")
        style.setProperty("height", "40px")
    }

    trSummary.appendElement("td") {
        setAttribute("colspan", "2")
        textContent = "RUNS-HITS-ERRORS"
        style.setProperty("border-right", "2px solid #5a544a")
        style.setProperty("padding", "0.5rem")
        style.setProperty("font-weight", "bold")
        style.setProperty("font-size", "0.75rem")
        style.setProperty("white-space", "nowrap")
    }

    for (inn in 1..maxInning) {
        val innEvents = teamEvents.filter { it.inning == inn }
        val runs = innEvents.sumOf { it.runsScoredOnPlay }
        val hits = innEvents.count { it.eventType in listOf(ScoringEventType.SINGLE, ScoringEventType.DOUBLE, ScoringEventType.TRIPLE, ScoringEventType.HOME_RUN) }
        val errors = innEvents.count { it.eventType == ScoringEventType.ERROR }

        trSummary.appendElement("td") {
            textContent = "$runs-$hits-$errors"
            style.setProperty("border-right", "1px solid #9c9384")
            style.setProperty("text-align", "center")
            style.setProperty("font-weight", "bold")
            style.setProperty("font-size", "0.75rem")
            style.setProperty("color", "#ff2a3b")
            style.setProperty("white-space", "nowrap")
            style.setProperty("width", "75px")
            
            style.setProperty("position", "relative")
            appendElement("div") {
                style.setProperty("position", "absolute")
                style.setProperty("top", "0")
                style.setProperty("right", "0")
                style.setProperty("width", "100%")
                style.setProperty("height", "100%")
                style.setProperty("background", "linear-gradient(to top right, transparent calc(50% - 0.5px), #5a544a, transparent calc(50% + 1px))")
                style.setProperty("pointer-events", "none")
                style.setProperty("opacity", "0.3")
            }
        }
    }

    for (s in 1..4) {
        trSummary.appendElement("td") {
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

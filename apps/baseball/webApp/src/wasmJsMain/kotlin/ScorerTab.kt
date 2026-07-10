package com.baseball

import com.baseball.AppViewManager.renderCurrentTab
import com.baseball.LocalGameManager.recordLocalPlayEvent
import com.baseball.models.*
import org.w3c.dom.*
import kotlinx.browser.document
import kotlinx.browser.window

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
}

// LIVE SCORER TAB
internal fun renderLiveScorerTab(container: HTMLElement) {
    if (!isSingleGameMode && selectedGameId == null) {
        container.appendElement("div", "card") {
            style.textAlign = "center"
            style.padding = "3rem"
            appendElement("p") { textContent = "No game selected. Go to Season Dashboard to select one." }
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
                localAwayLineup.addAll(awayRoster.filter { it.position != "P" }.take(9))
                localAwayBench.addAll(awayRoster.filter { it.position == "P" && it.id != game.gameState.currentPitcherId } + awayRoster.drop(10))
                localAwayActivePitcherId = game.gameState.currentPitcherId ?: awayRoster.find { it.position == "P" }?.id ?: 210L
                localAwayActivePitcherName = game.gameState.currentPitcherName ?: awayRoster.find { it.position == "P" }?.name ?: "Sonny Gray"
                localAwayBatterIndex = localAwayLineup.indexOfFirst { it.id == game.gameState.currentBatterId }.coerceAtLeast(0)
            }
            if (localHomeLineup.isEmpty()) {
                localHomeLineup.addAll(homeRoster.filter { it.position != "P" }.take(9))
                localHomeBench.addAll(homeRoster.filter { it.position == "P" && it.id != game.gameState.currentPitcherId } + homeRoster.drop(10))
                localHomeActivePitcherId = game.gameState.currentPitcherId ?: homeRoster.find { it.position == "P" }?.id ?: 110L
                localHomeActivePitcherName = game.gameState.currentPitcherName ?: homeRoster.find { it.position == "P" }?.name ?: "Justin Steele"
                localHomeBatterIndex = localHomeLineup.indexOfFirst { it.id == game.gameState.currentBatterId }.coerceAtLeast(0)
            }
        }

        container.appendElement("h1") {
            textContent = "Live Scoring: ${game.awayTeam.city} @ ${game.homeTeam.city}"
        }

        val topGrid = container.appendElement("div", "scorekeeper-grid")

        // 1. Digital LED Scoreboard
        val leftCol = topGrid.appendElement("div", "scoreboard-led")
        val sbHeader = leftCol.appendElement("div", "scoreboard-header")
        
        val inningSymbol = if (game.gameState.half == HalfInning.TOP) "▲" else "▼"
        sbHeader.appendElement("span", "inning-display") {
            textContent = "$inningSymbol Inning ${game.gameState.inning}"
        }
        sbHeader.appendElement("span", "outs-indicator") {
            val outsStr = when (game.gameState.outs) {
                0 -> "No Outs"
                1 -> "1 Out"
                2 -> "2 Outs"
                else -> "3 Outs"
            }
            textContent = outsStr
        }

        // Team Scores Row
        val awayRow = leftCol.appendElement("div", "scoreboard-row")
        awayRow.appendElement("span", "team-led-name") { textContent = game.awayTeam.abbreviation }
        awayRow.appendElement("span", "team-led-score") { textContent = game.awayScore.toString() }

        val homeRow = leftCol.appendElement("div", "scoreboard-row")
        homeRow.appendElement("span", "team-led-name") { textContent = game.homeTeam.abbreviation }
        homeRow.appendElement("span", "team-led-score") { textContent = game.homeScore.toString() }

        val countRow = leftCol.appendElement("div", "scoreboard-row") { style.marginTop = "1rem" }
        countRow.appendElement("span", "count-display") {
            textContent = "Count: ${game.gameState.balls} - ${game.gameState.strikes}"
        }
        countRow.appendElement("span") {
            textContent = "R-H-E: ${game.awayScore}-${game.awayHits}-${game.awayErrors} vs ${game.homeScore}-${game.homeHits}-${game.homeErrors}"
            style.color = "var(--text-secondary)"
            style.fontSize = "0.9rem"
        }

        // Diamond Bases Visualization
        val diamondContainer = leftCol.appendElement("div", "diamond-container")
        val baseDiamond = diamondContainer.appendElement("div", "base-diamond")
        
        baseDiamond.appendElement("div", "base base-first" + if (game.gameState.runnerFirstId != null) " occupied" else "") {
            appendElement("div", "base-label") {
                textContent = "1st"
                style.top = "-15px"
                style.right = "-15px"
            }
        }
        baseDiamond.appendElement("div", "base base-second" + if (game.gameState.runnerSecondId != null) " occupied" else "") {
            appendElement("div", "base-label") {
                textContent = "2nd"
                style.top = "-15px"
                style.left = "-15px"
            }
        }
        baseDiamond.appendElement("div", "base base-third" + if (game.gameState.runnerThirdId != null) " occupied" else "") {
            appendElement("div", "base-label") {
                textContent = "3rd"
                style.bottom = "-15px"
                style.left = "-15px"
            }
        }
        baseDiamond.appendElement("div", "base base-home")
        
        // Runner details on LED
        val runnersDetails = leftCol.appendElement("div") {
            style.fontSize = "0.85rem"
            style.marginTop = "1rem"
            style.color = "var(--text-secondary)"
            style.borderTop = "1px solid #1a2f24"
            style.paddingTop = "0.5rem"
        }
        if (game.gameState.runnerFirstName != null) runnersDetails.appendElement("div") { textContent = "1B: ${game.gameState.runnerFirstName}" }
        if (game.gameState.runnerSecondName != null) runnersDetails.appendElement("div") { textContent = "2B: ${game.gameState.runnerSecondName}" }
        if (game.gameState.runnerThirdName != null) runnersDetails.appendElement("div") { textContent = "3B: ${game.gameState.runnerThirdName}" }

        // 2. Play Actions & Lineup Selector
        val rightCol = topGrid.appendElement("div", "card")
        
        if (game.status == GameStatus.COMPLETED) {
            rightCol.appendElement("div") {
                style.textAlign = "center"
                style.padding = "2rem"
                appendElement("h2") { textContent = "GAME COMPLETED" }
                val scoreStr = "${game.awayTeam.name} ${game.awayScore}, ${game.homeTeam.name} ${game.homeScore}"
                appendElement("p") { textContent = "Final: $scoreStr" }
                
                appendElement("button", "btn") {
                    style.marginTop = "1.5rem"
                    textContent = "View Final Box Score"
                    onClick {
                        currentTab = "boxscore"
                        updateActiveTabButtons()
                        renderCurrentTab()
                    }
                }
            }
        } else {
            rightCol.appendElement("h2") { textContent = "Plate Matchup" }

            // Matchup Card (Scorebook Style)
            val matchupCard = rightCol.appendElement("div") {
                style.marginBottom = "1.5rem"
                style.background = "linear-gradient(135deg, rgba(27, 53, 36, 0.9) 0%, rgba(13, 26, 18, 0.95) 100%)"
                style.border = "1px solid rgba(74, 222, 128, 0.2)"
                style.padding = "1.25rem"
                style.borderRadius = "12px"
            }
            
            val vsRow = matchupCard.appendElement("div") {
                style.display = "flex"
                style.justifyContent = "space-between"
                style.alignItems = "center"
                style.textAlign = "center"
            }
            
            // Batter info
            val batterBox = vsRow.appendElement("div") { style.flex = "1" }
            batterBox.appendElement("div") { textContent = "CURRENT BATTER"; style.fontSize = "0.75rem"; style.color = "var(--accent-green)" }
            batterBox.appendElement("div") { 
                textContent = game.gameState.currentBatterName ?: "None"
                style.fontSize = "1.2rem"
                style.fontWeight = "800"
                style.color = "var(--text-primary)"
            }
            val currBatter = (awayRoster + homeRoster).find { it.id == game.gameState.currentBatterId }
            batterBox.appendElement("div") {
                textContent = currBatter?.let { "${it.position} | #${it.jerseyNumber} | Bat: ${it.battingHand}" } ?: ""
                style.fontSize = "0.85rem"
                style.color = "var(--text-secondary)"
            }
            
            // VS divider
            vsRow.appendElement("div") {
                textContent = "VS"
                style.fontSize = "1.3rem"
                style.fontWeight = "900"
                style.margin = "0 1.5rem"
                style.color = "rgba(74, 222, 128, 0.4)"
            }
            
            // Pitcher info
            val pitcherBox = vsRow.appendElement("div") { style.flex = "1" }
            pitcherBox.appendElement("div") { textContent = "CURRENT PITCHER"; style.fontSize = "0.75rem"; style.color = "var(--accent-green)" }
            pitcherBox.appendElement("div") { 
                textContent = game.gameState.currentPitcherName ?: "None"
                style.fontSize = "1.2rem"
                style.fontWeight = "800"
                style.color = "var(--text-primary)"
            }
            val currPitcher = (awayRoster + homeRoster).find { it.id == game.gameState.currentPitcherId }
            pitcherBox.appendElement("div") {
                textContent = currPitcher?.let { "${it.position} | #${it.jerseyNumber} | Throw: ${it.throwingHand}" } ?: ""
                style.fontSize = "0.85rem"
                style.color = "var(--text-secondary)"
            }

            // Game action triggers
            val actionGridWrapper = rightCol.appendElement("div") {
                style.marginTop = "1rem"
            }
            
            var optionalPitchType: String? = null
            
            fun triggerScoringEvent(
                type: ScoringEventType,
                detail: String? = null,
                isDoublePlay: Boolean = false,
                isError: Boolean = false,
                runnerAdvanceMap: Map<String, Int>? = null
            ) {
                val bId = game.gameState.currentBatterId
                val pId = game.gameState.currentPitcherId
                if (bId != null && pId != null) {
                    val finalDescription = buildString {
                        if (optionalPitchType != null) {
                            append("$optionalPitchType - ")
                        }
                        if (detail != null) {
                            append(detail)
                        }
                    }.takeIf { it.isNotEmpty() }

                    if (isSingleGameMode) {
                        recordLocalPlayEvent(type, bId, pId, finalDescription, isDoublePlay, isError, runnerAdvanceMap)
                        renderCurrentTab()
                    } else {
                        launch {
                            api.recordGameEvent(game.id!!, ScoringEventRequest(
                                eventType = type,
                                batterId = bId,
                                pitcherId = pId,
                                description = finalDescription,
                                isDoublePlay = isDoublePlay,
                                isError = isError,
                                runnerAdvanceMap = runnerAdvanceMap
                            ))
                            renderCurrentTab() // reload view
                        }
                    }
                } else {
                    window.alert("Please ensure a batter and pitcher are selected!")
                }
            }

            fun renderActionGrid() {
                actionGridWrapper.innerHTML = ""
                
                // Pitch Types Toggle
                val pitchTypeRow = actionGridWrapper.appendElement("div") {
                    style.display = "flex"
                    style.setProperty("gap", "0.5rem")
                    style.marginBottom = "1rem"
                    style.flexWrap = "wrap"
                }
                val pitchTypes = listOf("Fastball", "Breaking Ball", "Offspeed")
                pitchTypes.forEach { pType ->
                    val isSelected = pType == optionalPitchType
                    pitchTypeRow.appendElement("button", if (isSelected) "btn btn-primary" else "btn btn-secondary") {
                        textContent = pType
                        style.flex = "1"
                        style.fontSize = "0.85rem"
                        style.padding = "0.4rem"
                        onClick {
                            optionalPitchType = if (isSelected) null else pType
                            renderActionGrid()
                        }
                    }
                }
                
                val actionGrid = actionGridWrapper.appendElement("div", "action-grid")
                
                fun renderStep2(type: ScoringEventType, baseLabel: String, isHit: Boolean) {
                    var hasError = false
                    var hasDoublePlay = false
                    
                    val runnerAdvances = mutableMapOf<String, Int>()
                    
                    fun drawStep2UI() {
                        actionGridWrapper.innerHTML = ""
                        actionGridWrapper.appendElement("h3") {
                            textContent = "Step 2: $baseLabel Details"
                            style.marginBottom = "1rem"
                            style.color = "var(--accent-green)"
                            style.fontSize = "1.2rem"
                        }
                        
                        // Modifiers Row
                        val modifiersRow = actionGridWrapper.appendElement("div") {
                            style.display = "flex"
                            style.setProperty("gap", "0.5rem")
                            style.marginBottom = "1rem"
                        }
                        
                        modifiersRow.appendElement("button", if (hasError) "btn btn-danger" else "btn btn-secondary") {
                            textContent = if (hasError) "Error Active" else "+ Add Error"
                            onClick {
                                hasError = !hasError
                                drawStep2UI()
                            }
                        }
                        
                        if (!isHit) {
                            modifiersRow.appendElement("button", if (hasDoublePlay) "btn btn-primary" else "btn btn-secondary") {
                                textContent = if (hasDoublePlay) "Double Play Active" else "+ Add Double Play"
                                onClick {
                                    hasDoublePlay = !hasDoublePlay
                                    if (hasDoublePlay) {
                                        val leadRunnerId = game.gameState.runnerThirdId ?: game.gameState.runnerSecondId ?: game.gameState.runnerFirstId
                                        if (leadRunnerId != null) {
                                            runnerAdvances[leadRunnerId.toString()] = 0
                                        }
                                    } else {
                                        runnerAdvances.clear()
                                    }
                                    drawStep2UI()
                                }
                            }
                        }
                        
                        // Runner Advancement Section
                        val r1 = game.gameState.runnerFirstId to game.gameState.runnerFirstName
                        val r2 = game.gameState.runnerSecondId to game.gameState.runnerSecondName
                        val r3 = game.gameState.runnerThirdId to game.gameState.runnerThirdName
                        
                        val activeRunners = listOfNotNull(
                            r1.first?.let { it to ("Runner on 1B: " + r1.second) },
                            r2.first?.let { it to ("Runner on 2B: " + r2.second) },
                            r3.first?.let { it to ("Runner on 3B: " + r3.second) }
                        )
                        
                        if (activeRunners.isNotEmpty() || hasError) {
                            actionGridWrapper.appendElement("div") {
                                textContent = "Runner Base Advancement (Optional)"
                                style.fontWeight = "bold"
                                style.fontSize = "0.9rem"
                                style.color = "var(--text-secondary)"
                                style.marginBottom = "0.5rem"
                            }
                            
                            val runnersList = if (hasError) {
                                activeRunners + (game.gameState.currentBatterId!! to "Batter: ${game.gameState.currentBatterName}")
                            } else {
                                activeRunners
                            }
                            
                            runnersList.forEach { (runnerId, label) ->
                                val row = actionGridWrapper.appendElement("div") {
                                    style.display = "flex"
                                    style.alignItems = "center"
                                    style.justifyContent = "space-between"
                                    style.marginBottom = "0.5rem"
                                    style.setProperty("gap", "0.5rem")
                                    style.background = "rgba(255, 255, 255, 0.03)"
                                    style.padding = "0.4rem"
                                    style.borderRadius = "4px"
                                }
                                row.appendElement("span") {
                                    textContent = label
                                    style.fontSize = "0.85rem"
                                    style.flex = "1"
                                }
                                
                                val btnGroup = row.appendElement("div") {
                                    style.display = "flex"
                                    style.setProperty("gap", "0.2rem")
                                }
                                
                                val currentDest = runnerAdvances[runnerId.toString()]
                                
                                val options = if (runnerId == game.gameState.currentBatterId) {
                                    listOf(0 to "Out", 1 to "1B", 2 to "2B", 3 to "3B", 4 to "HR")
                                } else {
                                    listOf(0 to "Out", 2 to "2B", 3 to "3B", 4 to "Score")
                                }
                                
                                options.forEach { (baseVal, baseLabel) ->
                                    val isSelected = currentDest == baseVal
                                    val btnClass = if (isSelected) {
                                        if (baseVal == 0) "btn btn-danger" else "btn btn-primary"
                                    } else "btn btn-secondary"
                                    
                                    btnGroup.appendElement("button", btnClass) {
                                        textContent = baseLabel
                                        style.padding = "0.2rem 0.4rem"
                                        style.fontSize = "0.75rem"
                                        onClick {
                                            if (isSelected) {
                                                runnerAdvances.remove(runnerId.toString())
                                            } else {
                                                runnerAdvances[runnerId.toString()] = baseVal
                                            }
                                            drawStep2UI()
                                        }
                                    }
                                }
                            }
                        }
                        
                        // Locations Grid
                        actionGridWrapper.appendElement("div") {
                            textContent = "Select Hit/Out Fielder to Complete Play"
                            style.fontWeight = "bold"
                            style.fontSize = "0.9rem"
                            style.color = "var(--text-secondary)"
                            style.marginTop = "1rem"
                            style.marginBottom = "0.5rem"
                        }
                        
                        val locGrid = actionGridWrapper.appendElement("div", "action-grid") {
                            style.marginBottom = "1rem"
                        }
                        
                        val locations = if (isHit) {
                            listOf("Left Field", "Center Field", "Right Field", "Infield", "Down the Line", "Gap")
                        } else {
                            listOf("Pitcher (1)", "Catcher (2)", "1st Base (3)", "2nd Base (4)", "3rd Base (5)", "Shortstop (6)", "Left Field (7)", "Center Field (8)", "Right Field (9)")
                        }
                        
                        locations.forEach { loc ->
                            locGrid.appendElement("button", "btn btn-action") {
                                textContent = loc
                                onClick {
                                    val detail = buildString {
                                        append("$baseLabel to $loc")
                                        if (hasDoublePlay) {
                                            append(" (Double Play)")
                                        }
                                        if (hasError) {
                                            append(" (with Error)")
                                        }
                                    }
                                    triggerScoringEvent(type, detail, hasDoublePlay, hasError, runnerAdvances.takeIf { it.isNotEmpty() })
                                }
                            }
                        }
                        
                        // Fast fallback if they want to submit without a specific location
                        locGrid.appendElement("button", "btn btn-action") {
                            textContent = "Unspecified Location"
                            style.background = "rgba(255, 255, 255, 0.1)"
                            onClick {
                                val detail = buildString {
                                    append(baseLabel)
                                    if (hasDoublePlay) {
                                        append(" (Double Play)")
                                    }
                                    if (hasError) {
                                        append(" (with Error)")
                                    }
                                }
                                triggerScoringEvent(type, detail, hasDoublePlay, hasError, runnerAdvances.takeIf { it.isNotEmpty() })
                            }
                        }
                        
                        val btnRow = actionGridWrapper.appendElement("div") {
                            style.display = "flex"
                            style.setProperty("gap", "1rem")
                        }
                        btnRow.appendElement("button", "btn btn-secondary") {
                            textContent = "Cancel"
                            style.flex = "1"
                            onClick { renderActionGrid() }
                        }
                    }
                    
                    drawStep2UI()
                }
                
                // Action Buttons
                listOf(
                    ScoringEventType.BALL to "Ball (B+1)",
                    ScoringEventType.STRIKE to "Strike (S+1)",
                    ScoringEventType.FOUL to "Foul",
                    ScoringEventType.SINGLE to "Single (1B)",
                    ScoringEventType.DOUBLE to "Double (2B)",
                    ScoringEventType.TRIPLE to "Triple (3B)",
                    ScoringEventType.HOME_RUN to "Home Run (HR)",
                    ScoringEventType.WALK to "Walk (BB)",
                    ScoringEventType.HIT_BY_PITCH to "HBP",
                    ScoringEventType.STRIKEOUT to "Strikeout (K)",
                    ScoringEventType.GROUNDOUT to "Groundout",
                    ScoringEventType.FLYOUT to "Flyout",
                    ScoringEventType.LINE_OUT to "Line Out",
                    ScoringEventType.POP_OUT to "Pop Out",
                    ScoringEventType.SACRIFICE_FLY to "Sac Fly",
                    ScoringEventType.ERROR to "Reached on Error",
                    ScoringEventType.FIELDER_CHOICE to "Fielder's Choice"
                ).forEach { (type, label) ->
                    val btnClass = when (type) {
                        ScoringEventType.BALL -> "btn btn-secondary btn-action"
                        ScoringEventType.STRIKE, ScoringEventType.STRIKEOUT -> "btn btn-danger btn-action"
                        ScoringEventType.FOUL -> "btn btn-secondary btn-action"
                        ScoringEventType.SINGLE, ScoringEventType.DOUBLE, ScoringEventType.TRIPLE, ScoringEventType.HOME_RUN -> "btn btn-action"
                        else -> "btn btn-secondary btn-action"
                    }
                    actionGrid.appendElement("button", btnClass) {
                        textContent = label
                        onClick { 
                            val isHit = type in listOf(ScoringEventType.SINGLE, ScoringEventType.DOUBLE, ScoringEventType.TRIPLE, ScoringEventType.HOME_RUN)
                            val isOut = type in listOf(ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT)
                            if (isHit || isOut) {
                                renderStep2(type, label, isHit)
                            } else {
                                triggerScoringEvent(type)
                            }
                        }
                    }
                }
            }
            
            renderActionGrid()
            
            // Lineups and substitutions card
            val scorebookCard = rightCol.appendElement("div") {
                style.marginTop = "2rem"
                style.borderTop = "1px solid rgba(255, 255, 255, 0.08)"
                style.paddingTop = "1.5rem"
            }
            scorebookCard.appendElement("h2") { textContent = "Team Scorebook & Lineups" }
            
            val teamTabs = scorebookCard.appendElement("div", "tab-headers")
            
            val activeLineupTab = if (game.gameState.half == HalfInning.TOP) "away" else "home"
            var viewedLineup = activeLineupTab
            
            val lineupContent = scorebookCard.appendElement("div") { style.marginTop = "1rem" }
            
            fun refreshLineupView() {
                lineupContent.innerHTML = ""
                val isHome = viewedLineup == "home"
                val team = if (isHome) game.homeTeam else game.awayTeam
                val lineup = if (isHome) localHomeLineup else localAwayLineup
                val bench = if (isHome) localHomeBench else localAwayBench
                
                lineupContent.appendElement("h3") {
                    textContent = "${team.name} Active Lineup"
                    style.marginBottom = "1rem"
                    style.fontSize = "1rem"
                }
                
                val tableContainer = lineupContent.appendElement("div", "table-container")
                val table = tableContainer.appendElement("table")
                val thead = table.appendElement("thead")
                val trh = thead.appendElement("tr")
                trh.appendElement("th") { textContent = "Slot" }
                trh.appendElement("th") { textContent = "Player" }
                trh.appendElement("th") { textContent = "Pos" }
                trh.appendElement("th") { textContent = "Action" }
                
                val tbody = table.appendElement("tbody")
                
                lineup.forEachIndexed { idx, player ->
                    val isCurrent = game.gameState.currentBatterId == player.id
                    val trd = tbody.appendElement("tr") {
                        if (isCurrent) {
                            style.background = "rgba(74, 222, 128, 0.12)"
                            style.borderLeft = "4px solid var(--accent-green)"
                        }
                    }
                    trd.appendElement("td") { textContent = "${idx + 1}"; style.fontWeight = "700" }
                    trd.appendElement("td") { textContent = "${player.name} (#${player.jerseyNumber})" }
                    trd.appendElement("td") { textContent = player.position; style.color = "var(--accent-green)" }
                    
                    val tdCell = trd.appendElement("td")
                    tdCell.appendElement("button", "btn btn-secondary") {
                        style.padding = "0.2rem 0.5rem"
                        style.fontSize = "0.75rem"
                        textContent = "Sub"
                        onClick {
                            val subOptions = bench.filter { it.position != "P" && !localPlayersSubbedOut.contains(it.id) }
                            if (subOptions.isEmpty()) {
                                window.alert("No bench batters available!")
                            } else {
                                val selectOverlay = createElement("select", "form-control") as HTMLSelectElement
                                selectOverlay.style.marginTop = "0.5rem"
                                selectOverlay.style.padding = "0.2rem"
                                selectOverlay.style.fontSize = "0.85rem"
                                
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
                                        substituteBatter(isHome, idx, valId)
                                        renderCurrentTab()
                                    }
                                })
                                tdCell.appendChild(selectOverlay)
                            }
                        }
                    }
                }
                
                // Active Pitcher / Bullpen section
                val activePitcherId = if (isHome) localHomeActivePitcherId else localAwayActivePitcherId
                val activePitcherName = if (isHome) localHomeActivePitcherName else localAwayActivePitcherName
                
                val pSection = lineupContent.appendElement("div", "game-card") {
                    style.marginTop = "1.5rem"
                    style.display = "flex"
                    style.justifyContent = "space-between"
                    style.alignItems = "center"
                    style.padding = "1rem"
                    style.border = "1px solid rgba(255, 255, 255, 0.05)"
                    style.borderRadius = "8px"
                }
                
                val pInfo = pSection.appendElement("div")
                pInfo.appendElement("div") { textContent = "ACTIVE PITCHER"; style.fontSize = "0.7rem"; style.color = "var(--text-secondary)" }
                pInfo.appendElement("div") { textContent = activePitcherName; style.fontWeight = "700" }
                
                pSection.appendElement("button", "btn btn-secondary") {
                    style.padding = "0.3rem 0.75rem"
                    style.fontSize = "0.8rem"
                    textContent = "Change Pitcher"
                    onClick {
                        val pSubs = bench.filter { it.position == "P" && !localPlayersSubbedOut.contains(it.id) }
                        if (pSubs.isEmpty()) {
                            window.alert("No bullpen pitchers available!")
                        } else {
                            val selectOverlay = createElement("select", "form-control") as HTMLSelectElement
                            selectOverlay.style.marginTop = "0.5rem"
                            selectOverlay.style.padding = "0.2rem"
                            selectOverlay.style.fontSize = "0.85rem"
                            
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
                            pSection.appendChild(selectOverlay)
                        }
                    }
                }
            }
            
            // Render Tab headers
            val tabAway = teamTabs.appendElement("div", "tab-header" + if (viewedLineup == "away") " active" else "") {
                textContent = "${game.awayTeam.abbreviation} (Batting)"
                onClick {
                    viewedLineup = "away"
                    refreshLineupView()
                    val nodes = document.querySelectorAll("#team-tab-home, #team-tab-away")
                    for (i in 0 until nodes.length) {
                        (nodes.item(i) as? HTMLElement)?.classList?.remove("active")
                    }
                    classList.add("active")
                }
                id = "team-tab-away"
            }
            val tabHome = teamTabs.appendElement("div", "tab-header" + if (viewedLineup == "home") " active" else "") {
                textContent = "${game.homeTeam.abbreviation} (Fielding)"
                onClick {
                    viewedLineup = "home"
                    refreshLineupView()
                    val nodes = document.querySelectorAll("#team-tab-home, #team-tab-away")
                    for (i in 0 until nodes.length) {
                        (nodes.item(i) as? HTMLElement)?.classList?.remove("active")
                    }
                    classList.add("active")
                }
                id = "team-tab-home"
            }
            
            refreshLineupView()
        }

        // 3. Line Score Table
        val lineScoreCard = container.appendElement("div", "card") { style.marginTop = "2rem" }
        lineScoreCard.appendElement("h2") { textContent = "Line Score" }
        renderLineScoreTable(lineScoreCard, boxScore.lineScore, game)

        // 4. Box Score Details (Batting/Pitching stats in tabs)
        val boxScoreCard = container.appendElement("div", "card") { style.marginTop = "2rem" }
        boxScoreCard.appendElement("h2") { textContent = "Game Stats" }
        
        val tabHeaders = boxScoreCard.appendElement("div", "tab-headers")
        val tabsList = listOf(
            "away-batting" to "${game.awayTeam.abbreviation} Batting",
            "away-pitching" to "${game.awayTeam.abbreviation} Pitching",
            "home-batting" to "${game.homeTeam.abbreviation} Batting",
            "home-pitching" to "${game.homeTeam.abbreviation} Pitching"
        )
        
        val statsContainer = boxScoreCard.appendElement("div", "tab-container")

        tabsList.forEach { (tid, label) ->
            tabHeaders.appendElement("div", "tab-header" + if (activeBoxScoreTab == tid) " active" else "") {
                textContent = label
                onClick {
                    activeBoxScoreTab = tid
                    renderCurrentTab()
                }
            }
        }

        renderBoxScoreTable(statsContainer, activeBoxScoreTab, boxScore)

        // 5. Play-by-play log
        val logCard = container.appendElement("div", "card") { style.marginTop = "2rem" }
        logCard.appendElement("h2") { textContent = "Play-By-Play Log" }
        val logDiv = logCard.appendElement("div", "event-log")
        
        if (events.isEmpty()) {
            logDiv.appendElement("div") { textContent = "No events logged for this game yet." }
        } else {
            events.forEach { ev ->
                logDiv.appendElement("div", "log-item") {
                    appendElement("span", "log-desc") { textContent = ev.description }
                    appendElement("span", "log-inning") { textContent = "${ev.half.name.substring(0,3)} ${ev.inning} (${ev.outsBefore} Out)" }
                }
            }
        }
    }
}

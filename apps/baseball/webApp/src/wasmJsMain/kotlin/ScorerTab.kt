package com.baseball

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
            val actionGrid = rightCol.appendElement("div", "action-grid")
            
            fun triggerScoringEvent(type: ScoringEventType) {
                val bId = game.gameState.currentBatterId
                val pId = game.gameState.currentPitcherId
                if (bId != null && pId != null) {
                    if (isSingleGameMode) {
                        recordLocalPlayEvent(type, bId, pId)
                        renderCurrentTab()
                    } else {
                        launch {
                            api.recordGameEvent(game.id!!, ScoringEventRequest(
                                eventType = type,
                                batterId = bId,
                                pitcherId = pId
                            ))
                            renderCurrentTab() // reload view
                        }
                    }
                } else {
                    window.alert("Please ensure a batter and pitcher are selected!")
                }
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
                    onClick { triggerScoringEvent(type) }
                }
            }
            
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

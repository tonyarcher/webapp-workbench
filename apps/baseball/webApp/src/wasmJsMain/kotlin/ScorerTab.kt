package com.baseball

import com.baseball.models.*
import org.w3c.dom.*
import kotlinx.browser.document
import kotlinx.browser.window

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
            rightCol.appendElement("h2") { textContent = "At-Bat Controller" }

            val battingTeamRoster = if (game.gameState.half == HalfInning.TOP) awayRoster else homeRoster
            val pitchingTeamRoster = if (game.gameState.half == HalfInning.TOP) homeRoster else awayRoster

            // Batter / Pitcher Selection
            val lineUpRow = rightCol.appendElement("div") {
                style.display = "flex"
                style.setProperty("gap", "1rem")
                style.marginBottom = "1.5rem"
            }

            val batterGroup = lineUpRow.appendElement("div") { style.flex = "1" }
            batterGroup.appendElement("label") { textContent = "Current Batter"; style.fontSize = "0.85rem"; style.color = "var(--text-secondary)" }
            val batterSelect = batterGroup.appendElement("select", "form-control") as HTMLSelectElement
            battingTeamRoster.forEach { p ->
                val opt = document.createElement("option") as HTMLOptionElement
                opt.value = p.id.toString()
                opt.textContent = "${p.jerseyNumber} - ${p.name} (${p.position})"
                if (game.gameState.currentBatterId == p.id) opt.selected = true
                batterSelect.appendChild(opt)
            }

            val pitcherGroup = lineUpRow.appendElement("div") { style.flex = "1" }
            pitcherGroup.appendElement("label") { textContent = "Current Pitcher"; style.fontSize = "0.85rem"; style.color = "var(--text-secondary)" }
            val pitcherSelect = pitcherGroup.appendElement("select", "form-control") as HTMLSelectElement
            pitchingTeamRoster.forEach { p ->
                val opt = document.createElement("option") as HTMLOptionElement
                opt.value = p.id.toString()
                opt.textContent = "${p.jerseyNumber} - ${p.name} (${p.position})"
                if (game.gameState.currentPitcherId == p.id) opt.selected = true
                pitcherSelect.appendChild(opt)
            }

            // Game action triggers
            val actionGrid = rightCol.appendElement("div", "action-grid")
            
            fun triggerScoringEvent(type: ScoringEventType) {
                val bId = batterSelect.value.toLongOrNull()
                val pId = pitcherSelect.value.toLongOrNull()
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

            // Buttons
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

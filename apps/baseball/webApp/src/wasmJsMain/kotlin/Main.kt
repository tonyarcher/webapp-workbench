package com.baseball

import com.baseball.api.BaseballApiClient
import com.baseball.models.*
import kotlinx.browser.document
import kotlinx.browser.window
import kotlinx.coroutines.*
import org.w3c.dom.*
import org.w3c.dom.events.Event

// App state variables
private val api = BaseballApiClient()
private var currentTab = "leagues"

private var selectedLeagueId: Long? = null
private var selectedSeasonId: Long? = null
private var selectedTeamId: Long? = null
private var selectedGameId: Long? = null

private var leaguesList = emptyList<League>()
private var teamsList = emptyList<Team>()
private var seasonsList = emptyList<Season>()

// Modes state
private var isWelcomeScreen = true
private var isSingleGameMode = false
private var serverOnline = false
private var serverConnectionError: String? = null

// Offline / Single Game Mode state
private var localGame: Game? = null
private var localEvents = mutableListOf<PlayEvent>()
private var localBoxScore: BoxScore? = null
private var localHomeRoster = emptyList<Player>()
private var localAwayRoster = emptyList<Player>()
private var activeBoxScoreTab = "away-batting"

fun main() {
    window.onload = {
        renderApp()
        // Background check for server online status
        launch {
            try {
                api.getLeagues()
                serverOnline = true
            } catch (e: Exception) {
                serverOnline = false
            }
            renderApp()
        }
    }
}

// Global Coroutine Scope Helper
private fun launch(block: suspend () -> Unit) {
    @OptIn(DelicateCoroutinesApi::class)
    GlobalScope.launch(Dispatchers.Main) {
        try {
            block()
        } catch (e: Throwable) {
            println("Coroutine exception: ${e.message}")
            e.printStackTrace()
        }
    }
}

// DOM Helper functions
private fun createElement(tag: String, classes: String = "", init: HTMLElement.() -> Unit = {}): HTMLElement {
    val el = document.createElement(tag) as HTMLElement
    if (classes.isNotEmpty()) {
        el.className = classes
    }
    el.init()
    return el
}

private fun HTMLElement.appendElement(tag: String, classes: String = "", init: HTMLElement.() -> Unit = {}): HTMLElement {
    val el = createElement(tag, classes, init)
    this.appendChild(el)
    return el
}

private fun HTMLElement.onClick(handler: (Event) -> Unit) {
    this.addEventListener("click", { event ->
        handler(event)
    })
}

private fun goBackToWelcome() {
    isWelcomeScreen = true
    selectedGameId = null
    serverConnectionError = null
    renderApp()
}

private fun initLocalGame() {
    val chc = Team(1L, "Cubs", "CHC", "Chicago")
    val stl = Team(2L, "Cardinals", "STL", "St. Louis")
    
    localHomeRoster = listOf(
        Player(101L, 1L, "Nico Hoerner", "2B", 2, "R", "R"),
        Player(102L, 1L, "Dansby Swanson", "SS", 7, "R", "R"),
        Player(103L, 1L, "Seiya Suzuki", "RF", 27, "R", "R"),
        Player(104L, 1L, "Cody Bellinger", "CF", 24, "L", "L"),
        Player(105L, 1L, "Christopher Morel", "DH", 19, "R", "R"),
        Player(106L, 1L, "Ian Happ", "LF", 94, "S", "R"),
        Player(107L, 1L, "Michael Busch", "1B", 29, "L", "R"),
        Player(108L, 1L, "Nick Madrigal", "3B", 20, "R", "R"),
        Player(109L, 1L, "Yan Gomes", "C", 18, "R", "R"),
        Player(110L, 1L, "Justin Steele", "P", 35, "L", "L")
    )
    
    localAwayRoster = listOf(
        Player(201L, 2L, "Brendan Donovan", "LF", 33, "L", "R"),
        Player(202L, 2L, "Paul Goldschmidt", "1B", 46, "R", "R"),
        Player(203L, 2L, "Nolan Arenado", "3B", 28, "R", "R"),
        Player(204L, 2L, "Willson Contreras", "C", 40, "R", "R"),
        Player(205L, 2L, "Nolan Gorman", "2B", 24, "L", "R"),
        Player(206L, 2L, "Lars Nootbaar", "RF", 21, "L", "R"),
        Player(207L, 2L, "Jordan Walker", "DH", 22, "R", "R"),
        Player(208L, 2L, "Masyn Winn", "SS", 0, "R", "R"),
        Player(209L, 2L, "Victor Scott II", "CF", 11, "L", "R"),
        Player(210L, 2L, "Sonny Gray", "P", 54, "R", "R")
    )
    
    localGame = Game(
        id = 1L,
        seasonId = 1L,
        homeTeam = chc,
        awayTeam = stl,
        date = "2026-07-10",
        status = GameStatus.SCHEDULED,
        homeScore = 0,
        awayScore = 0,
        homeHits = 0,
        awayHits = 0,
        homeErrors = 0,
        awayErrors = 0,
        gameState = GameState(
            inning = 1,
            half = HalfInning.TOP,
            outs = 0,
            balls = 0,
            strikes = 0,
            runnerFirstId = null,
            runnerSecondId = null,
            runnerThirdId = null,
            runnerFirstName = null,
            runnerSecondName = null,
            runnerThirdName = null,
            currentBatterId = 201L,
            currentBatterName = "Brendan Donovan",
            currentPitcherId = 110L,
            currentPitcherName = "Justin Steele"
        )
    )
    
    localBoxScore = BoxScore(
        gameId = 1L,
        homeTeamName = "Cubs",
        awayTeamName = "Cardinals",
        lineScore = LineScore(
            gameId = 1L,
            awayRuns = 0,
            homeRuns = 0,
            awayHits = 0,
            homeHits = 0,
            awayErrors = 0,
            homeErrors = 0,
            awayInningRuns = emptyList(),
            homeInningRuns = emptyList()
        ),
        homeBatting = localHomeRoster.filter { it.position != "P" }.map { PlayerBattingStats(it.id!!, it.name, it.jerseyNumber, it.position) },
        awayBatting = localAwayRoster.filter { it.position != "P" }.map { PlayerBattingStats(it.id!!, it.name, it.jerseyNumber, it.position) },
        homePitching = localHomeRoster.filter { it.position == "P" }.map { PlayerPitchingStats(it.id!!, it.name, it.jerseyNumber, it.position) },
        awayPitching = localAwayRoster.filter { it.position == "P" }.map { PlayerPitchingStats(it.id!!, it.name, it.jerseyNumber, it.position) }
    )
    
    localEvents = mutableListOf()
}

private fun recordLocalPlayEvent(eventType: ScoringEventType, batterId: Long, pitcherId: Long) {
    val game = localGame ?: return
    val boxScore = localBoxScore ?: return
    
    val batter = (localAwayRoster + localHomeRoster).find { it.id == batterId } ?: return
    val pitcher = (localAwayRoster + localHomeRoster).find { it.id == pitcherId } ?: return

    var currentInning = game.gameState.inning
    var currentHalf = game.gameState.half
    var outs = game.gameState.outs
    var balls = game.gameState.balls
    var strikes = game.gameState.strikes
    var firstId = game.gameState.runnerFirstId
    var secondId = game.gameState.runnerSecondId
    var thirdId = game.gameState.runnerThirdId
    var firstName = game.gameState.runnerFirstName
    var secondName = game.gameState.runnerSecondName
    var thirdName = game.gameState.runnerThirdName

    var homeScore = game.homeScore
    var awayScore = game.awayScore
    var homeHits = game.homeHits
    var awayHits = game.awayHits
    var homeErrors = game.homeErrors
    var awayErrors = game.awayErrors
    
    var resolvedType = eventType
    var outsAdded = 0
    var basesMoved = 0
    var isWalk = false
    var isHbp = false
    var desc = ""

    when (eventType) {
        ScoringEventType.BALL -> {
            balls += 1
            desc = "Ball to ${batter.name}"
            if (balls >= 4) {
                resolvedType = ScoringEventType.WALK
                isWalk = true
                desc = "Walk for ${batter.name}"
            }
        }
        ScoringEventType.STRIKE -> {
            strikes += 1
            desc = "Strike to ${batter.name}"
            if (strikes >= 3) {
                resolvedType = ScoringEventType.STRIKEOUT
                outsAdded = 1
                desc = "Strikeout for ${batter.name}"
            }
        }
        ScoringEventType.FOUL -> {
            desc = "Foul by ${batter.name}"
            if (strikes < 2) strikes += 1
        }
        ScoringEventType.SINGLE -> { basesMoved = 1; desc = "Single by ${batter.name}" }
        ScoringEventType.DOUBLE -> { basesMoved = 2; desc = "Double by ${batter.name}" }
        ScoringEventType.TRIPLE -> { basesMoved = 3; desc = "Triple by ${batter.name}" }
        ScoringEventType.HOME_RUN -> { basesMoved = 4; desc = "Home run by ${batter.name}!" }
        ScoringEventType.WALK -> { isWalk = true; desc = "Walk for ${batter.name}" }
        ScoringEventType.HIT_BY_PITCH -> { isHbp = true; desc = "Hit by pitch for ${batter.name}" }
        ScoringEventType.STRIKEOUT -> { outsAdded = 1; desc = "Strikeout for ${batter.name}" }
        ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT -> {
            outsAdded = 1
            desc = "${eventType.name.lowercase().replace("_", " ")} by ${batter.name}"
        }
        ScoringEventType.SACRIFICE_FLY -> { outsAdded = 1; desc = "Sacrifice fly by ${batter.name}" }
        ScoringEventType.ERROR -> { basesMoved = 1; desc = "Error on play. ${batter.name} reaches base" }
        ScoringEventType.FIELDER_CHOICE -> { outsAdded = 1; basesMoved = 1; desc = "Fielder's choice. ${batter.name} reaches" }
    }

    val isResolved = resolvedType != ScoringEventType.BALL && resolvedType != ScoringEventType.STRIKE && resolvedType != ScoringEventType.FOUL
    val runsScoredList = mutableListOf<Long>()

    if (isResolved) {
        balls = 0
        strikes = 0

        val battingList = if (batter.teamId == game.homeTeam.id) boxScore.homeBatting.toMutableList() else boxScore.awayBatting.toMutableList()
        val pitchingList = if (pitcher.teamId == game.homeTeam.id) boxScore.homePitching.toMutableList() else boxScore.awayPitching.toMutableList()

        var bStats = battingList.find { it.playerId == batterId } ?: PlayerBattingStats(batterId, batter.name, batter.jerseyNumber, batter.position)
        var pStats = pitchingList.find { it.playerId == pitcherId } ?: PlayerPitchingStats(pitcherId, pitcher.name, pitcher.jerseyNumber, pitcher.position)

        when (resolvedType) {
            ScoringEventType.SINGLE -> { bStats = bStats.copy(hits = bStats.hits + 1, atBats = bStats.atBats + 1); pStats = pStats.copy(hitsAllowed = pStats.hitsAllowed + 1); if (currentHalf == HalfInning.TOP) awayHits++ else homeHits++ }
            ScoringEventType.DOUBLE -> { bStats = bStats.copy(hits = bStats.hits + 1, doubles = bStats.doubles + 1, atBats = bStats.atBats + 1); pStats = pStats.copy(hitsAllowed = pStats.hitsAllowed + 1); if (currentHalf == HalfInning.TOP) awayHits++ else homeHits++ }
            ScoringEventType.TRIPLE -> { bStats = bStats.copy(hits = bStats.hits + 1, triples = bStats.triples + 1, atBats = bStats.atBats + 1); pStats = pStats.copy(hitsAllowed = pStats.hitsAllowed + 1); if (currentHalf == HalfInning.TOP) awayHits++ else homeHits++ }
            ScoringEventType.HOME_RUN -> { bStats = bStats.copy(hits = bStats.hits + 1, homeRuns = bStats.homeRuns + 1, runs = bStats.runs + 1, atBats = bStats.atBats + 1); pStats = pStats.copy(hitsAllowed = pStats.hitsAllowed + 1, homeRunsAllowed = pStats.homeRunsAllowed + 1); if (currentHalf == HalfInning.TOP) awayHits++ else homeHits++ }
            ScoringEventType.WALK -> { bStats = bStats.copy(walks = bStats.walks + 1); pStats = pStats.copy(walksAllowed = pStats.walksAllowed + 1) }
            ScoringEventType.HIT_BY_PITCH -> { bStats = bStats.copy(hitByPitch = bStats.hitByPitch + 1) }
            ScoringEventType.STRIKEOUT -> { bStats = bStats.copy(strikeOuts = bStats.strikeOuts + 1, atBats = bStats.atBats + 1); pStats = pStats.copy(strikeoutsRecorded = pStats.strikeoutsRecorded + 1) }
            ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT, ScoringEventType.FIELDER_CHOICE -> { bStats = bStats.copy(atBats = bStats.atBats + 1) }
            ScoringEventType.ERROR -> { bStats = bStats.copy(atBats = bStats.atBats + 1); if (currentHalf == HalfInning.TOP) homeErrors++ else awayErrors++ }
            ScoringEventType.SACRIFICE_FLY -> {}
            else -> {}
        }

        if (outsAdded > 0) {
            pStats = pStats.copy(inningsPitchedThirds = pStats.inningsPitchedThirds + outsAdded)
        }

        if (basesMoved > 0 || isWalk || isHbp) {
            val runner1 = firstId
            val runner2 = secondId
            val runner3 = thirdId

            if (isWalk || isHbp) {
                if (runner1 != null) {
                    if (runner2 != null) {
                        if (runner3 != null) {
                            runsScoredList.add(runner3)
                            thirdId = runner2; thirdName = secondName
                            secondId = runner1; secondName = firstName
                            firstId = batterId; firstName = batter.name
                        } else {
                            thirdId = runner2; thirdName = secondName
                            secondId = runner1; secondName = firstName
                            firstId = batterId; firstName = batter.name
                        }
                    } else {
                        secondId = runner1; secondName = firstName
                        firstId = batterId; firstName = batter.name
                    }
                } else {
                    firstId = batterId; firstName = batter.name
                }
            } else {
                if (basesMoved == 1) {
                    if (runner3 != null) runsScoredList.add(runner3)
                    if (runner2 != null) runsScoredList.add(runner2)
                    thirdId = null; thirdName = null
                    secondId = runner1; secondName = firstName
                    firstId = batterId; firstName = batter.name
                } else if (basesMoved == 2) {
                    if (runner3 != null) runsScoredList.add(runner3)
                    if (runner2 != null) runsScoredList.add(runner2)
                    thirdId = runner1; thirdName = firstName
                    secondId = batterId; secondName = batter.name
                    firstId = null; firstName = null
                } else if (basesMoved == 3) {
                    if (runner3 != null) runsScoredList.add(runner3)
                    if (runner2 != null) runsScoredList.add(runner2)
                    if (runner1 != null) runsScoredList.add(runner1)
                    thirdId = batterId; thirdName = batter.name
                    secondId = null; secondName = null
                    firstId = null; firstName = null
                } else if (basesMoved == 4) {
                    if (runner3 != null) runsScoredList.add(runner3)
                    if (runner2 != null) runsScoredList.add(runner2)
                    if (runner1 != null) runsScoredList.add(runner1)
                    runsScoredList.add(batterId)
                    thirdId = null; thirdName = null
                    secondId = null; secondName = null
                    firstId = null; firstName = null
                }
            }
        }

        if (resolvedType == ScoringEventType.SACRIFICE_FLY) {
            val runner3 = thirdId
            if (runner3 != null) {
                runsScoredList.add(runner3)
                thirdId = null; thirdName = null
            }
        }

        outs += outsAdded
        if (outs >= 3) {
            firstId = null; firstName = null
            secondId = null; secondName = null
            thirdId = null; thirdName = null
            outs = 0

            if (currentHalf == HalfInning.TOP) {
                currentHalf = HalfInning.BOTTOM
            } else {
                currentHalf = HalfInning.TOP
                currentInning += 1
            }
        }

        val homeBattingMutable = boxScore.homeBatting.toMutableList()
        val awayBattingMutable = boxScore.awayBatting.toMutableList()
        val homePitchingMutable = boxScore.homePitching.toMutableList()
        val awayPitchingMutable = boxScore.awayPitching.toMutableList()

        if (batter.teamId == game.homeTeam.id) {
            homeBattingMutable.removeAll { it.playerId == batterId }
            homeBattingMutable.add(bStats)
        } else {
            awayBattingMutable.removeAll { it.playerId == batterId }
            awayBattingMutable.add(bStats)
        }

        if (pitcher.teamId == game.homeTeam.id) {
            homePitchingMutable.removeAll { it.playerId == pitcherId }
            homePitchingMutable.add(pStats)
        } else {
            awayPitchingMutable.removeAll { it.playerId == pitcherId }
            awayPitchingMutable.add(pStats)
        }

        localBoxScore = boxScore.copy(
            homeBatting = homeBattingMutable,
            awayBatting = awayBattingMutable,
            homePitching = homePitchingMutable,
            awayPitching = awayPitchingMutable
        )
    }

    runsScoredList.forEach { runnerId ->
        val battingList = if (batter.teamId == game.homeTeam.id) localBoxScore!!.homeBatting.toMutableList() else localBoxScore!!.awayBatting.toMutableList()
        var bStats = battingList.find { it.playerId == batterId } ?: PlayerBattingStats(batterId, batter.name, batter.jerseyNumber, batter.position)
        bStats = bStats.copy(rbi = bStats.rbi + 1)
        if (batter.teamId == game.homeTeam.id) {
            val homeMutable = localBoxScore!!.homeBatting.toMutableList()
            homeMutable.removeAll { it.playerId == batterId }
            homeMutable.add(bStats)
            localBoxScore = localBoxScore!!.copy(homeBatting = homeMutable)
        } else {
            val awayMutable = localBoxScore!!.awayBatting.toMutableList()
            awayMutable.removeAll { it.playerId == batterId }
            awayMutable.add(bStats)
            localBoxScore = localBoxScore!!.copy(awayBatting = awayMutable)
        }

        if (runnerId != batterId) {
            val runner = (localAwayRoster + localHomeRoster).find { it.id == runnerId }!!
            val runnerBattingList = if (runner.teamId == game.homeTeam.id) localBoxScore!!.homeBatting.toMutableList() else localBoxScore!!.awayBatting.toMutableList()
            var rStats = runnerBattingList.find { it.playerId == runnerId } ?: PlayerBattingStats(runnerId, runner.name, runner.jerseyNumber, runner.position)
            rStats = rStats.copy(runs = rStats.runs + 1)
            if (runner.teamId == game.homeTeam.id) {
                val homeMutable = localBoxScore!!.homeBatting.toMutableList()
                homeMutable.removeAll { it.playerId == runnerId }
                homeMutable.add(rStats)
                localBoxScore = localBoxScore!!.copy(homeBatting = homeMutable)
            } else {
                val awayMutable = localBoxScore!!.awayBatting.toMutableList()
                awayMutable.removeAll { it.playerId == runnerId }
                awayMutable.add(rStats)
                localBoxScore = localBoxScore!!.copy(awayBatting = awayMutable)
            }
        }

        val pitchingList = if (pitcher.teamId == game.homeTeam.id) localBoxScore!!.homePitching.toMutableList() else localBoxScore!!.awayPitching.toMutableList()
        var pStats = pitchingList.find { it.playerId == pitcherId } ?: PlayerPitchingStats(pitcherId, pitcher.name, pitcher.jerseyNumber, pitcher.position)
        pStats = pStats.copy(runsAllowed = pStats.runsAllowed + 1, earnedRuns = pStats.earnedRuns + 1)
        if (pitcher.teamId == game.homeTeam.id) {
            val homeMutable = localBoxScore!!.homePitching.toMutableList()
            homeMutable.removeAll { it.playerId == pitcherId }
            homeMutable.add(pStats)
            localBoxScore = localBoxScore!!.copy(homePitching = homeMutable)
        } else {
            val awayMutable = localBoxScore!!.awayPitching.toMutableList()
            awayMutable.removeAll { it.playerId == pitcherId }
            awayMutable.add(pStats)
            localBoxScore = localBoxScore!!.copy(awayPitching = awayMutable)
        }

        val lineScore = localBoxScore!!.lineScore
        val awayInnings = lineScore.awayInningRuns.toMutableList()
        val homeInnings = lineScore.homeInningRuns.toMutableList()

        while (awayInnings.size < currentInning) awayInnings.add(null)
        while (homeInnings.size < currentInning) homeInnings.add(null)

        if (game.gameState.half == HalfInning.TOP) {
            awayScore += 1
            awayInnings[currentInning - 1] = (awayInnings[currentInning - 1] ?: 0) + 1
        } else {
            homeScore += 1
            homeInnings[currentInning - 1] = (homeInnings[currentInning - 1] ?: 0) + 1
        }

        localBoxScore = localBoxScore!!.copy(
            lineScore = lineScore.copy(
                awayInningRuns = awayInnings,
                homeInningRuns = homeInnings,
                awayRuns = awayScore,
                homeRuns = homeScore
            )
        )
    }

    var status = game.status
    if (status == GameStatus.SCHEDULED) status = GameStatus.IN_PROGRESS
    
    if (currentInning >= 9) {
        val isTopComplete = currentHalf == HalfInning.BOTTOM && outs == 0
        val isBottomComplete = currentHalf == HalfInning.TOP && currentInning > 9
        
        if (isTopComplete && homeScore > awayScore) {
            status = GameStatus.COMPLETED
        } else if (currentHalf == HalfInning.BOTTOM && homeScore > awayScore) {
            status = GameStatus.COMPLETED
        } else if (isBottomComplete && awayScore > homeScore) {
            status = GameStatus.COMPLETED
        } else if (isBottomComplete && homeScore > awayScore) {
            status = GameStatus.COMPLETED
        }
    }

    localGame = game.copy(
        status = status,
        homeScore = homeScore,
        awayScore = awayScore,
        homeHits = homeHits,
        awayHits = awayHits,
        homeErrors = homeErrors,
        awayErrors = awayErrors,
        gameState = game.gameState.copy(
            inning = currentInning,
            half = currentHalf,
            outs = outs,
            balls = balls,
            strikes = strikes,
            runnerFirstId = firstId,
            runnerSecondId = secondId,
            runnerThirdId = thirdId,
            runnerFirstName = firstName,
            runnerSecondName = secondName,
            runnerThirdName = thirdName,
            currentBatterId = batterId,
            currentBatterName = batter.name,
            currentPitcherId = pitcherId,
            currentPitcherName = pitcher.name
        )
    )

    val ev = PlayEvent(
        id = (localEvents.size + 1).toLong(),
        gameId = game.id ?: 1L,
        inning = currentInning,
        half = currentHalf,
        outsBefore = game.gameState.outs,
        outsAfter = outs,
        balls = game.gameState.balls,
        strikes = game.gameState.strikes,
        batterName = batter.name,
        pitcherName = pitcher.name,
        eventType = resolvedType,
        description = desc,
        runsScoredOnPlay = runsScoredList.size,
        timestamp = ""
    )
    localEvents.add(ev)
}

private fun renderWelcomeScreen(container: HTMLElement) {
    val welcome = container.appendElement("div", "welcome-container")
    
    welcome.appendElement("div", "welcome-logo") {
        innerHTML = "<span>GRAND SLAM</span> BASEBALL TRACKER"
    }
    
    welcome.appendElement("p", "welcome-subtitle") {
        textContent = "Exhibition Game Mode (Offline) & Full League Season Mode (Online)"
    }
    
    if (serverConnectionError != null) {
        welcome.appendElement("div", "server-error-banner") {
            textContent = serverConnectionError!!
        }
    }
    
    val grid = welcome.appendElement("div", "mode-grid")
    
    val cardExhibition = grid.appendElement("div", "mode-card offline") {
        onClick {
            serverConnectionError = null
            isWelcomeScreen = false
            isSingleGameMode = true
            initLocalGame()
            currentTab = "live-scorer"
            renderApp()
            renderCurrentTab()
        }
    }
    cardExhibition.appendElement("div", "mode-icon") { textContent = "⚾" }
    cardExhibition.appendElement("div", "mode-title") { textContent = "Single Game Mode" }
    cardExhibition.appendElement("div", "mode-desc") {
        textContent = "Play or score a local exhibition game between Chicago and St. Louis. Runs entirely in your browser with no server connection required."
    }
    val statusLocal = cardExhibition.appendElement("div", "server-status")
    statusLocal.appendElement("span", "status-dot green")
    statusLocal.appendElement("span", "status-text online") { textContent = "Client-Side Only" }

    val cardSeason = grid.appendElement("div", "mode-card online") {
        onClick {
            serverConnectionError = null
            launch {
                try {
                    leaguesList = api.getLeagues()
                    teamsList = api.getTeams()
                    if (leaguesList.isNotEmpty()) {
                        selectedLeagueId = leaguesList.first().id
                        seasonsList = api.getSeasons(selectedLeagueId!!)
                        if (seasonsList.isNotEmpty()) {
                            selectedSeasonId = seasonsList.first().id
                        }
                    }
                    isWelcomeScreen = false
                    isSingleGameMode = false
                    currentTab = "leagues"
                    renderApp()
                    renderCurrentTab()
                } catch (e: Exception) {
                    serverConnectionError = "Unable to connect to the server. Please check that your Spring Boot backend is running."
                    renderApp()
                }
            }
        }
    }
    cardSeason.appendElement("div", "mode-icon") { textContent = "🏆" }
    cardSeason.appendElement("div", "mode-title") { textContent = "League & Season Mode" }
    cardSeason.appendElement("div", "mode-desc") {
        textContent = "Manage complete baseball leagues, schedule round-robin seasons, track standings, and record live games backed by your database server."
    }
    
    val statusServer = cardSeason.appendElement("div", "server-status")
    val dot = statusServer.appendElement("span", "status-dot")
    val text = statusServer.appendElement("span", "status-text")
    
    if (serverOnline) {
        dot.className = "status-dot green"
        text.className = "status-text online"
        text.textContent = "Server Online"
    } else {
        dot.className = "status-dot red"
        text.className = "status-text offline"
        text.textContent = "Check Connection"
    }
}

private fun renderApp() {
    val app = document.getElementById("app") as? HTMLElement ?: return
    app.innerHTML = ""

    if (isWelcomeScreen) {
        renderWelcomeScreen(app)
        return
    }

    val header = app.appendElement("header")
    val headerContainer = header.appendElement("div", "header-container")
    
    val logo = headerContainer.appendElement("div", "logo") {
        style.cursor = "pointer"
        onClick {
            goBackToWelcome()
        }
    }
    logo.innerHTML = "<span>GRAND SLAM</span> BASEBALL"
    
    val nav = headerContainer.appendElement("nav")
    
    nav.appendElement("button", "back-to-welcome") {
        textContent = "← Back to Menu"
        onClick {
            goBackToWelcome()
        }
    }

    if (!isSingleGameMode) {
        nav.appendElement("button", "nav-btn") {
            id = "nav-btn-leagues"
            textContent = "Leagues & Seasons"
            onClick {
                currentTab = "leagues"
                updateActiveTabButtons()
                renderCurrentTab()
            }
        }
        
        nav.appendElement("button", "nav-btn") {
            id = "nav-btn-teams"
            textContent = "Teams & Rosters"
            onClick {
                currentTab = "teams"
                updateActiveTabButtons()
                renderCurrentTab()
            }
        }
        
        nav.appendElement("button", "nav-btn") {
            id = "nav-btn-games"
            textContent = "Season Dashboard"
            onClick {
                currentTab = "games"
                updateActiveTabButtons()
                renderCurrentTab()
            }
        }
    }
    
    val btnLive = nav.appendElement("button", "nav-btn") {
        id = "nav-btn-live"
        textContent = "Live Scoring"
        style.display = if (isSingleGameMode || selectedGameId != null) "inline-block" else "none"
        onClick {
            currentTab = "live-scorer"
            updateActiveTabButtons()
            renderCurrentTab()
        }
    }

    val btnBoxScore = nav.appendElement("button", "nav-btn") {
        id = "nav-btn-boxscore"
        textContent = "Box Score"
        style.display = if (isSingleGameMode || selectedGameId != null) "inline-block" else "none"
        onClick {
            currentTab = "boxscore"
            updateActiveTabButtons()
            renderCurrentTab()
        }
    }

    app.appendElement("main") {
        id = "content-area"
    }

    updateActiveTabButtons()
}

private fun updateActiveTabButtons() {
    val navButtons = document.querySelectorAll(".nav-btn")
    for (i in 0 until navButtons.length) {
        val btn = navButtons.item(i) as HTMLElement
        btn.classList.remove("active")
    }

    val btnLive = document.getElementById("nav-btn-live") as? HTMLButtonElement
    val btnBoxScore = document.getElementById("nav-btn-boxscore") as? HTMLButtonElement

    if (isSingleGameMode || selectedGameId != null) {
        btnLive?.style?.display = "inline-block"
        btnBoxScore?.style?.display = "inline-block"
    } else {
        btnLive?.style?.display = "none"
        btnBoxScore?.style?.display = "none"
    }

    val btnActive = when (currentTab) {
        "live-scorer" -> btnLive
        "boxscore" -> btnBoxScore
        else -> {
            when (currentTab) {
                "leagues" -> document.getElementById("nav-btn-leagues")
                "teams" -> document.getElementById("nav-btn-teams")
                "games" -> document.getElementById("nav-btn-games")
                else -> null
            }
        }
    }
    btnActive?.classList?.add("active")
}

private fun renderCurrentTab() {
    val contentArea = document.getElementById("content-area") as? HTMLElement ?: return
    contentArea.innerHTML = ""

    when (currentTab) {
        "leagues" -> renderLeaguesTab(contentArea)
        "teams" -> renderTeamsTab(contentArea)
        "games" -> renderSeasonDashboardTab(contentArea)
        "live-scorer" -> renderLiveScorerTab(contentArea)
        "boxscore" -> renderBoxScoreTab(contentArea)
    }
}



// LEAGUES AND SEASONS TAB
private fun renderLeaguesTab(container: HTMLElement) {
    container.appendElement("h1") { textContent = "Leagues & Seasons" }
    
    val grid = container.appendElement("div", "dashboard-grid")
    
    // Left side: leagues list
    val leftCol = grid.appendElement("div", "card")
    leftCol.appendElement("h2") { textContent = "Available Leagues" }
    
    val leaguesListDiv = leftCol.appendElement("div")
    
    fun refreshLeaguesUI() {
        leaguesListDiv.innerHTML = ""
        if (leaguesList.isEmpty()) {
            leaguesListDiv.appendElement("p") {
                textContent = "No leagues found. Create one to get started!"
                style.color = "var(--text-secondary)"
            }
        } else {
            leaguesList.forEach { league ->
                val card = leaguesListDiv.appendElement("div", "game-card") {
                    style.marginBottom = "0.75rem"
                    style.display = "flex"
                    style.flexDirection = "column"
                    style.alignItems = "flex-start"
                    
                    val titleRow = appendElement("div") {
                        style.fontWeight = "700"
                        style.fontSize = "1.1rem"
                        textContent = league.name
                    }
                    
                    val selectBtn = appendElement("button", "btn btn-secondary") {
                        style.marginTop = "0.5rem"
                        style.padding = "0.25rem 0.75rem"
                        style.fontSize = "0.85rem"
                        textContent = if (selectedLeagueId == league.id) "Active League" else "Select League"
                        if (selectedLeagueId == league.id) {
                            classList.add("active")
                        }
                        onClick {
                            selectedLeagueId = league.id
                            launch {
                                seasonsList = api.getSeasons(league.id!!)
                                selectedSeasonId = seasonsList.firstOrNull()?.id
                                refreshLeaguesUI()
                            }
                        }
                    }
                }
            }
        }
    }
    
    refreshLeaguesUI()

    // Right side: Create League Form & Seasons manager
    val rightCol = grid.appendElement("div")
    
    // Form to create league
    val createLeagueCard = rightCol.appendElement("div", "card") {
        style.marginBottom = "2rem"
    }
    createLeagueCard.appendElement("h2") { textContent = "Create New League" }
    
    val form = createLeagueCard.appendElement("form")
    val fg = form.appendElement("div", "form-group")
    fg.appendElement("label") { textContent = "League Name" }
    val inputName = fg.appendElement("input", "form-control") as HTMLInputElement
    inputName.placeholder = "e.g., National Baseball League"
    
    val submitBtn = form.appendElement("button", "btn") as HTMLButtonElement
    submitBtn.type = "button"
    submitBtn.textContent = "Create League"
    submitBtn.onClick {
        val name = inputName.value.trim()
        if (name.isNotEmpty()) {
            launch {
                val newLeague = api.createLeague(League(name = name))
                leaguesList = api.getLeagues()
                selectedLeagueId = newLeague.id
                seasonsList = emptyList()
                selectedSeasonId = null
                inputName.value = ""
                refreshLeaguesUI()
                renderCurrentTab()
            }
        }
    }

    // Seasons panel if league is selected
    if (selectedLeagueId != null) {
        val seasonsCard = rightCol.appendElement("div", "card")
        seasonsCard.appendElement("h2") { textContent = "Seasons in Selected League" }
        
        val seasonsListDiv = seasonsCard.appendElement("div") {
            style.marginBottom = "1.5rem"
        }
        
        fun refreshSeasonsUI() {
            seasonsListDiv.innerHTML = ""
            if (seasonsList.isEmpty()) {
                seasonsListDiv.appendElement("p") {
                    textContent = "No seasons in this league yet."
                    style.color = "var(--text-secondary)"
                }
            } else {
                seasonsList.forEach { season ->
                    val seasonItem = seasonsListDiv.appendElement("div", "game-card") {
                        style.marginBottom = "0.5rem"
                        style.padding = "0.75rem"
                        style.display = "flex"
                        style.justifyContent = "space-between"
                        style.alignItems = "center"
                        
                        appendElement("span") {
                            textContent = "${season.name} (${season.year})"
                            style.fontWeight = "600"
                        }
                        
                        appendElement("button", "btn btn-secondary") {
                            style.padding = "0.25rem 0.5rem"
                            style.fontSize = "0.8rem"
                            textContent = "Go to Dashboard"
                            onClick {
                                selectedSeasonId = season.id
                                currentTab = "games"
                                updateActiveTabButtons()
                                renderCurrentTab()
                            }
                        }
                    }
                }
            }
        }
        
        refreshSeasonsUI()

        // Create Season Form
        seasonsCard.appendElement("h3") { textContent = "Create New Season" }
        val sForm = seasonsCard.appendElement("form")
        
        val sfg1 = sForm.appendElement("div", "form-group")
        sfg1.appendElement("label") { textContent = "Season Name" }
        val inputSName = sfg1.appendElement("input", "form-control") as HTMLInputElement
        inputSName.placeholder = "e.g., 2026 Regular Season"
        
        val sfg2 = sForm.appendElement("div", "form-group")
        sfg2.appendElement("label") { textContent = "Year" }
        val inputSYear = sfg2.appendElement("input", "form-control") as HTMLInputElement
        inputSYear.type = "number"
        inputSYear.value = "2026"
        
        val sSubmit = sForm.appendElement("button", "btn") as HTMLButtonElement
        sSubmit.type = "button"
        sSubmit.textContent = "Create Season"
        sSubmit.onClick {
            val name = inputSName.value.trim()
            val yearStr = inputSYear.value.trim()
            if (name.isNotEmpty() && yearStr.isNotEmpty()) {
                launch {
                    api.createSeason(Season(leagueId = selectedLeagueId!!, name = name, year = yearStr.toInt()))
                    seasonsList = api.getSeasons(selectedLeagueId!!)
                    inputSName.value = ""
                    refreshSeasonsUI()
                }
            }
        }
    }
}

// TEAMS AND ROSTERS TAB
private fun renderTeamsTab(container: HTMLElement) {
    container.appendElement("h1") { textContent = "Teams & Rosters" }
    
    val grid = container.appendElement("div", "dashboard-grid")
    
    // Left Column: List of Teams
    val leftCol = grid.appendElement("div", "card")
    leftCol.appendElement("h2") { textContent = "Teams" }
    val teamsListDiv = leftCol.appendElement("div")
    
    fun refreshTeamsUI() {
        teamsListDiv.innerHTML = ""
        if (teamsList.isEmpty()) {
            teamsListDiv.appendElement("p") {
                textContent = "No teams created yet."
                style.color = "var(--text-secondary)"
            }
        } else {
            teamsList.forEach { team ->
                teamsListDiv.appendElement("div", "game-card") {
                    style.marginBottom = "0.75rem"
                    style.display = "flex"
                    style.justifyContent = "space-between"
                    style.alignItems = "center"
                    
                    val info = appendElement("div") {
                        val title = appendElement("div") {
                            style.fontWeight = "700"
                            textContent = "${team.city} ${team.name}"
                        }
                        val abb = appendElement("div") {
                            style.fontSize = "0.85rem"
                            style.color = "var(--text-secondary)"
                            textContent = team.abbreviation
                        }
                    }
                    
                    appendElement("button", "btn btn-secondary") {
                        textContent = if (selectedTeamId == team.id) "Viewing Roster" else "View Roster"
                        if (selectedTeamId == team.id) classList.add("active")
                        onClick {
                            selectedTeamId = team.id
                            refreshTeamsUI()
                            renderCurrentTab()
                        }
                    }
                }
            }
        }
    }
    refreshTeamsUI()

    // Right Column: Create Team Form / Roster View
    val rightCol = grid.appendElement("div")
    
    // Create Team Form
    val createTeamCard = rightCol.appendElement("div", "card") {
        style.marginBottom = "2rem"
    }
    createTeamCard.appendElement("h2") { textContent = "Add Team" }
    val tForm = createTeamCard.appendElement("form")
    
    val tfg1 = tForm.appendElement("div", "form-group")
    tfg1.appendElement("label") { textContent = "City" }
    val inputCity = tfg1.appendElement("input", "form-control") as HTMLInputElement
    inputCity.placeholder = "e.g., Boston"
    
    val tfg2 = tForm.appendElement("div", "form-group")
    tfg2.appendElement("label") { textContent = "Team Name" }
    val inputTName = tfg2.appendElement("input", "form-control") as HTMLInputElement
    inputTName.placeholder = "e.g., Red Sox"

    val tfg3 = tForm.appendElement("div", "form-group")
    tfg3.appendElement("label") { textContent = "Abbreviation" }
    val inputAbb = tfg3.appendElement("input", "form-control") as HTMLInputElement
    inputAbb.placeholder = "e.g., BOS"
    
    val tSubmit = tForm.appendElement("button", "btn") as HTMLButtonElement
    tSubmit.type = "button"
    tSubmit.textContent = "Create Team"
    tSubmit.onClick {
        val city = inputCity.value.trim()
        val name = inputTName.value.trim()
        val abb = inputAbb.value.trim()
        if (city.isNotEmpty() && name.isNotEmpty() && abb.isNotEmpty()) {
            launch {
                api.createTeam(Team(city = city, name = name, abbreviation = abb))
                teamsList = api.getTeams()
                inputCity.value = ""
                inputTName.value = ""
                inputAbb.value = ""
                refreshTeamsUI()
            }
        }
    }

    // Roster panel if team is selected
    if (selectedTeamId != null) {
        val rosterCard = rightCol.appendElement("div", "card")
        val team = teamsList.find { it.id == selectedTeamId }
        rosterCard.appendElement("h2") { textContent = "${team?.city} ${team?.name} Roster" }
        
        val rosterDiv = rosterCard.appendElement("div") {
            style.marginBottom = "1.5rem"
        }
        
        fun refreshRoster() {
            launch {
                val roster = api.getTeamRoster(selectedTeamId!!)
                rosterDiv.innerHTML = ""
                if (roster.isEmpty()) {
                    rosterDiv.appendElement("p") {
                        textContent = "No players on this roster."
                        style.color = "var(--text-secondary)"
                    }
                } else {
                    val tableContainer = rosterDiv.appendElement("div", "table-container")
                    val table = tableContainer.appendElement("table")
                    val thead = table.appendElement("thead")
                    val trh = thead.appendElement("tr")
                    trh.appendElement("th") { textContent = "#" }
                    trh.appendElement("th") { textContent = "Name" }
                    trh.appendElement("th") { textContent = "Pos" }
                    trh.appendElement("th") { textContent = "B/T" }
                    
                    val tbody = table.appendElement("tbody")
                    roster.forEach { p ->
                        val trd = tbody.appendElement("tr")
                        trd.appendElement("td") { textContent = p.jerseyNumber.toString(); style.fontWeight = "700" }
                        trd.appendElement("td") { textContent = p.name }
                        trd.appendElement("td") { textContent = p.position; style.color = "var(--accent-green)" }
                        trd.appendElement("td") { textContent = "${p.battingHand}/${p.throwingHand}" }
                    }
                }
            }
        }
        
        refreshRoster()

        // Add Player Form
        rosterCard.appendElement("h3") { textContent = "Add Player to Roster" }
        val pForm = rosterCard.appendElement("form")
        
        val pfg1 = pForm.appendElement("div", "form-group")
        pfg1.appendElement("label") { textContent = "Player Name" }
        val inputPName = pfg1.appendElement("input", "form-control") as HTMLInputElement
        inputPName.placeholder = "e.g., Dustin Pedroia"
        
        val pfg2 = pForm.appendElement("div", "form-group")
        pfg2.appendElement("label") { textContent = "Position" }
        val inputPos = pfg2.appendElement("select", "form-control") as HTMLSelectElement
        listOf("P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH").forEach { pos ->
            val opt = document.createElement("option") as HTMLOptionElement
            opt.value = pos
            opt.textContent = pos
            inputPos.appendChild(opt)
        }

        val pfg3 = pForm.appendElement("div", "form-group")
        pfg3.appendElement("label") { textContent = "Jersey Number" }
        val inputNum = pfg3.appendElement("input", "form-control") as HTMLInputElement
        inputNum.type = "number"
        inputNum.value = "15"

        val pfg4 = pForm.appendElement("div", "form-group")
        pfg4.appendElement("label") { textContent = "Batting / Throwing Hand" }
        val pfg4Row = pfg4.appendElement("div") {
            style.display = "flex"
            style.setProperty("gap", "1rem")
        }
        val selectBat = pfg4Row.appendElement("select", "form-control") as HTMLSelectElement
        listOf("R", "L", "S").forEach { h ->
            val opt = document.createElement("option") as HTMLOptionElement
            opt.value = h
            opt.textContent = "Bat: $h"
            selectBat.appendChild(opt)
        }
        val selectThrow = pfg4Row.appendElement("select", "form-control") as HTMLSelectElement
        listOf("R", "L").forEach { h ->
            val opt = document.createElement("option") as HTMLOptionElement
            opt.value = h
            opt.textContent = "Throw: $h"
            selectThrow.appendChild(opt)
        }
        
        val pSubmit = pForm.appendElement("button", "btn") as HTMLButtonElement
        pSubmit.type = "button"
        pSubmit.textContent = "Add Player"
        pSubmit.onClick {
            val name = inputPName.value.trim()
            val pos = inputPos.value
            val num = inputNum.value.toIntOrNull() ?: 0
            val bat = selectBat.value
            val thr = selectThrow.value
            if (name.isNotEmpty()) {
                launch {
                    api.createPlayer(Player(
                        teamId = selectedTeamId,
                        name = name,
                        position = pos,
                        jerseyNumber = num,
                        battingHand = bat,
                        throwingHand = thr
                    ))
                    inputPName.value = ""
                    refreshRoster()
                }
            }
        }
    }
}

// SEASON DASHBOARD TAB
private fun renderSeasonDashboardTab(container: HTMLElement) {
    container.appendElement("h1") { textContent = "Season Dashboard" }

    // Dropdown selectors for League & Season
    val selectorCard = container.appendElement("div", "card") {
        style.marginBottom = "2rem"
        style.display = "flex"
        style.setProperty("gap", "1.5rem")
        style.alignItems = "flex-end"
    }

    val lg1 = selectorCard.appendElement("div", "form-group") { style.marginBottom = "0"; style.flex = "1" }
    lg1.appendElement("label") { textContent = "Active League" }
    val selectL = lg1.appendElement("select", "form-control") as HTMLSelectElement
    leaguesList.forEach { league ->
        val opt = document.createElement("option") as HTMLOptionElement
        opt.value = league.id.toString()
        opt.textContent = league.name
        if (selectedLeagueId == league.id) opt.selected = true
        selectL.appendChild(opt)
    }

    val lg2 = selectorCard.appendElement("div", "form-group") { style.marginBottom = "0"; style.flex = "1" }
    lg2.appendElement("label") { textContent = "Active Season" }
    val selectS = lg2.appendElement("select", "form-control") as HTMLSelectElement
    
    fun populateSeasonsDropdown() {
        selectS.innerHTML = ""
        seasonsList.forEach { season ->
            val opt = document.createElement("option") as HTMLOptionElement
            opt.value = season.id.toString()
            opt.textContent = "${season.name} (${season.year})"
            if (selectedSeasonId == season.id) opt.selected = true
            selectS.appendChild(opt)
        }
    }
    populateSeasonsDropdown()

    val fetchBtn = selectorCard.appendElement("button", "btn") { textContent = "Load Season" }

    selectL.addEventListener("change", {
        val lid = selectL.value.toLongOrNull()
        if (lid != null) {
            selectedLeagueId = lid
            launch {
                seasonsList = api.getSeasons(lid)
                selectedSeasonId = seasonsList.firstOrNull()?.id
                populateSeasonsDropdown()
            }
        }
    })

    fetchBtn.onClick {
        selectedSeasonId = selectS.value.toLongOrNull()
        renderCurrentTab()
    }

    if (selectedSeasonId == null) {
        container.appendElement("div", "card") {
            style.textAlign = "center"
            style.padding = "3rem"
            appendElement("p") {
                textContent = "Please select a league and season above, then click Load Season."
                style.color = "var(--text-secondary)"
            }
        }
        return
    }

    // Dashboard Content
    launch {
        val dash = api.getSeasonDashboard(selectedSeasonId!!)
        
        val grid = container.appendElement("div", "dashboard-grid")
        
        // Left Column: Standings
        val leftCol = grid.appendElement("div", "card")
        leftCol.appendElement("h2") { textContent = "League Standings" }
        
        val tableContainer = leftCol.appendElement("div", "table-container")
        val table = tableContainer.appendElement("table")
        val thead = table.appendElement("thead")
        val trh = thead.appendElement("tr")
        trh.appendElement("th") { textContent = "Team" }
        trh.appendElement("th") { textContent = "GP" }
        trh.appendElement("th") { textContent = "W" }
        trh.appendElement("th") { textContent = "L" }
        trh.appendElement("th") { textContent = "PCT" }
        trh.appendElement("th") { textContent = "RS" }
        trh.appendElement("th") { textContent = "RA" }

        val tbody = table.appendElement("tbody")
        dash.standings.forEach { row ->
            val trd = tbody.appendElement("tr")
            trd.appendElement("td") { textContent = row.teamName; style.fontWeight = "700" }
            trd.appendElement("td") { textContent = row.gamesPlayed.toString() }
            trd.appendElement("td") { textContent = row.wins.toString() }
            trd.appendElement("td") { textContent = row.losses.toString() }
            trd.appendElement("td") { 
                textContent = if (row.winPercentage.toString().startsWith("0.")) {
                    row.winPercentage.toString().substring(1)
                } else if (row.winPercentage == 1.0) {
                    "1.000"
                } else {
                    ".000"
                }
            }
            trd.appendElement("td") { textContent = row.runsScored.toString() }
            trd.appendElement("td") { textContent = row.runsAllowed.toString() }
        }

        // Right Column: Games
        val rightCol = grid.appendElement("div")
        
        val actionsCard = rightCol.appendElement("div", "card") {
            style.marginBottom = "1.5rem"
            style.display = "flex"
            style.justifyContent = "space-between"
            style.alignItems = "center"
        }
        actionsCard.appendElement("h3") { textContent = "Schedule Manager" }
        
        val generateBtn = actionsCard.appendElement("button", "btn") {
            textContent = "Generate Round-Robin Schedule"
        }
        if (dash.games.isNotEmpty()) {
            generateBtn.setAttribute("disabled", "true")
            generateBtn.className = "btn btn-secondary"
            generateBtn.style.opacity = "0.5"
            generateBtn.style.cursor = "not-allowed"
        } else {
            generateBtn.onClick {
                launch {
                    api.generateSchedule(selectedSeasonId!!)
                    renderCurrentTab()
                }
            }
        }

        val gamesCard = rightCol.appendElement("div", "card")
        gamesCard.appendElement("h2") { textContent = "Games Schedule" }
        
        val gamesListDiv = gamesCard.appendElement("div", "game-list")
        if (dash.games.isEmpty()) {
            gamesListDiv.appendElement("p") {
                textContent = "No games scheduled yet. Generate a schedule above!"
                style.color = "var(--text-secondary)"
            }
        } else {
            dash.games.forEach { game ->
                gamesListDiv.appendElement("div", "game-card") {
                    onClick {
                        selectedGameId = game.id
                        if (game.status == GameStatus.COMPLETED) {
                            currentTab = "boxscore"
                        } else {
                            currentTab = "live-scorer"
                        }
                        updateActiveTabButtons()
                        renderCurrentTab()
                    }
                    
                    val teamScore = appendElement("div", "game-team-score")
                    val awayRow = teamScore.appendElement("div", "game-team-row")
                    awayRow.appendElement("span", "team-name-tag") { textContent = game.awayTeam.name }
                    awayRow.appendElement("span", "score-num") { textContent = game.awayScore.toString() }
                    
                    val homeRow = teamScore.appendElement("div", "game-team-row")
                    homeRow.appendElement("span", "team-name-tag") { textContent = game.homeTeam.name }
                    homeRow.appendElement("span", "score-num") { textContent = game.homeScore.toString() }
                    
                    val meta = appendElement("div", "game-meta")
                    val badgeClass = when (game.status) {
                        GameStatus.SCHEDULED -> "badge badge-scheduled"
                        GameStatus.IN_PROGRESS -> "badge badge-live"
                        GameStatus.COMPLETED -> "badge badge-completed"
                    }
                    meta.appendElement("span", badgeClass) { textContent = game.status.name }
                    meta.appendElement("span") {
                        textContent = game.date
                        style.fontSize = "0.85rem"
                        style.color = "var(--text-secondary)"
                    }
                }
            }
        }
    }
}

// LIVE SCORER TAB
private fun renderLiveScorerTab(container: HTMLElement) {
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
        val homePlate = baseDiamond.appendElement("div", "base base-home")
        
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

// BOX SCORE TAB (COMPLETED GAMES DETAIL)
private fun renderBoxScoreTab(container: HTMLElement) {
    if (!isSingleGameMode && selectedGameId == null) {
        container.appendElement("div", "card") {
            style.textAlign = "center"
            style.padding = "3rem"
            appendElement("p") { textContent = "No game selected." }
        }
        return
    }

    launch {
        val game: Game
        val boxScore: BoxScore
        val events: List<PlayEvent>

        if (isSingleGameMode) {
            game = localGame!!
            boxScore = localBoxScore!!
            events = localEvents
        } else {
            game = api.getGame(selectedGameId!!)
            boxScore = api.getGameBoxScore(selectedGameId!!)
            events = api.getGameEvents(selectedGameId!!)
        }

        container.appendElement("h1") { textContent = "Game Details - Box Score" }

        val mainCard = container.appendElement("div", "card")
        mainCard.appendElement("h2") {
            textContent = "${game.awayTeam.city} ${game.awayTeam.name} (${game.awayScore}) vs ${game.homeTeam.city} ${game.homeTeam.name} (${game.homeScore})"
        }
        mainCard.appendElement("p") {
            textContent = "Status: ${game.status.name} | Date: ${game.date}"
            style.color = "var(--text-secondary)"
            style.marginBottom = "1.5rem"
        }

        mainCard.appendElement("button", "btn btn-secondary") {
            textContent = if (isSingleGameMode) "Back to Live Scorer" else "Back to Season Dashboard"
            onClick {
                currentTab = if (isSingleGameMode) "live-scorer" else "games"
                updateActiveTabButtons()
                renderCurrentTab()
            }
        }

        // Line Score
        val lsSection = container.appendElement("div", "card") { style.marginTop = "1.5rem" }
        lsSection.appendElement("h3") { textContent = "Line Score" }
        renderLineScoreTable(lsSection, boxScore.lineScore, game)

        // Stats grid
        val statsGrid = container.appendElement("div", "dashboard-grid") { style.marginTop = "1.5rem" }
        
        val awayCard = statsGrid.appendElement("div", "card")
        awayCard.appendElement("h3") { textContent = "${game.awayTeam.name} Batting" }
        renderBattingTable(awayCard, boxScore.awayBatting)
        awayCard.appendElement("h3") { textContent = "${game.awayTeam.name} Pitching"; style.marginTop = "1.5rem" }
        renderPitchingTable(awayCard, boxScore.awayPitching)

        val homeCard = statsGrid.appendElement("div", "card")
        homeCard.appendElement("h3") { textContent = "${game.homeTeam.name} Batting" }
        renderBattingTable(homeCard, boxScore.homeBatting)
        homeCard.appendElement("h3") { textContent = "${game.homeTeam.name} Pitching"; style.marginTop = "1.5rem" }
        renderPitchingTable(homeCard, boxScore.homePitching)

        // Log history
        val logCard = container.appendElement("div", "card") { style.marginTop = "1.5rem" }
        logCard.appendElement("h3") { textContent = "Game Log History" }
        val listLog = logCard.appendElement("div", "event-log") {
            style.maxHeight = "350px"
        }
        events.forEach { ev ->
            listLog.appendElement("div", "log-item") {
                appendElement("span", "log-desc") { textContent = ev.description }
                appendElement("span", "log-inning") { textContent = "${ev.half.name.substring(0,3)} ${ev.inning}" }
            }
        }
    }
}

// Line Score Table Builder
private fun renderLineScoreTable(parent: HTMLElement, lineScore: LineScore, game: Game) {
    val tableContainer = parent.appendElement("div", "table-container")
    val table = tableContainer.appendElement("table", "linescore-table")
    
    // Header
    val thead = table.appendElement("thead")
    val trh = thead.appendElement("tr")
    trh.appendElement("th") { textContent = "Team" }
    
    val inningCount = lineScore.awayInningRuns.size
    for (i in 1..inningCount) {
        trh.appendElement("th") { textContent = i.toString() }
    }
    trh.appendElement("th", "linescore-stat") { textContent = "R" }
    trh.appendElement("th", "linescore-stat") { textContent = "H" }
    trh.appendElement("th", "linescore-stat") { textContent = "E" }

    val tbody = table.appendElement("tbody")
    
    // Away Row
    val tra = tbody.appendElement("tr")
    tra.appendElement("td", "linescore-team") { textContent = game.awayTeam.name }
    lineScore.awayInningRuns.forEach { runs ->
        tra.appendElement("td") { textContent = runs?.toString() ?: "-" }
    }
    tra.appendElement("td", "linescore-stat") { textContent = lineScore.awayRuns.toString() }
    tra.appendElement("td", "linescore-stat") { textContent = lineScore.awayHits.toString() }
    tra.appendElement("td", "linescore-stat") { textContent = lineScore.awayErrors.toString() }

    // Home Row
    val trhRow = tbody.appendElement("tr")
    trhRow.appendElement("td", "linescore-team") { textContent = game.homeTeam.name }
    lineScore.homeInningRuns.forEach { runs ->
        trhRow.appendElement("td") { textContent = runs?.toString() ?: "-" }
    }
    trhRow.appendElement("td", "linescore-stat") { textContent = lineScore.homeRuns.toString() }
    trhRow.appendElement("td", "linescore-stat") { textContent = lineScore.homeHits.toString() }
    trhRow.appendElement("td", "linescore-stat") { textContent = lineScore.homeErrors.toString() }
}

// Boxscore Stats Table Dispatcher
private fun renderBoxScoreTable(parent: HTMLElement, tabId: String, boxScore: BoxScore) {
    parent.innerHTML = ""
    when (tabId) {
        "away-batting" -> renderBattingTable(parent, boxScore.awayBatting)
        "away-pitching" -> renderPitchingTable(parent, boxScore.awayPitching)
        "home-batting" -> renderBattingTable(parent, boxScore.homeBatting)
        "home-pitching" -> renderPitchingTable(parent, boxScore.homePitching)
    }
}

private fun renderBattingTable(parent: HTMLElement, list: List<PlayerBattingStats>) {
    val tableContainer = parent.appendElement("div", "table-container")
    val table = tableContainer.appendElement("table")
    val thead = table.appendElement("thead")
    val trh = thead.appendElement("tr")
    trh.appendElement("th") { textContent = "Player (Pos)" }
    trh.appendElement("th") { textContent = "AB" }
    trh.appendElement("th") { textContent = "R" }
    trh.appendElement("th") { textContent = "H" }
    trh.appendElement("th") { textContent = "RBI" }
    trh.appendElement("th") { textContent = "BB" }
    trh.appendElement("th") { textContent = "SO" }
    trh.appendElement("th") { textContent = "HR" }

    val tbody = table.appendElement("tbody")
    if (list.isEmpty()) {
        val trd = tbody.appendElement("tr")
        trd.appendElement("td") { 
            setAttribute("colspan", "8")
            textContent = "No batting stats recorded yet."
            style.color = "var(--text-secondary)"
            style.textAlign = "center"
        }
    } else {
        list.forEach { s ->
            val trd = tbody.appendElement("tr")
            trd.appendElement("td") { textContent = "${s.playerName} (${s.position})"; style.fontWeight = "700" }
            trd.appendElement("td") { textContent = s.atBats.toString() }
            trd.appendElement("td") { textContent = s.runs.toString() }
            trd.appendElement("td") { textContent = s.hits.toString() }
            trd.appendElement("td") { textContent = s.rbi.toString() }
            trd.appendElement("td") { textContent = s.walks.toString() }
            trd.appendElement("td") { textContent = s.strikeOuts.toString() }
            trd.appendElement("td") { textContent = s.homeRuns.toString() }
        }
    }
}

private fun renderPitchingTable(parent: HTMLElement, list: List<PlayerPitchingStats>) {
    val tableContainer = parent.appendElement("div", "table-container")
    val table = tableContainer.appendElement("table")
    val thead = table.appendElement("thead")
    val trh = thead.appendElement("tr")
    trh.appendElement("th") { textContent = "Pitcher" }
    trh.appendElement("th") { textContent = "IP" }
    trh.appendElement("th") { textContent = "H" }
    trh.appendElement("th") { textContent = "R" }
    trh.appendElement("th") { textContent = "ER" }
    trh.appendElement("th") { textContent = "BB" }
    trh.appendElement("th") { textContent = "SO" }
    trh.appendElement("th") { textContent = "HR" }

    val tbody = table.appendElement("tbody")
    if (list.isEmpty()) {
        val trd = tbody.appendElement("tr")
        trd.appendElement("td") { 
            setAttribute("colspan", "8")
            textContent = "No pitching stats recorded yet."
            style.color = "var(--text-secondary)"
            style.textAlign = "center"
        }
    } else {
        list.forEach { s ->
            val trd = tbody.appendElement("tr")
            trd.appendElement("td") { textContent = s.playerName; style.fontWeight = "700" }
            
            // Format IP thirds. E.g. 10 is 3.1 IP.
            val whole = s.inningsPitchedThirds / 3
            val rem = s.inningsPitchedThirds % 3
            val ipStr = "$whole.$rem"
            
            trd.appendElement("td") { textContent = ipStr }
            trd.appendElement("td") { textContent = s.hitsAllowed.toString() }
            trd.appendElement("td") { textContent = s.runsAllowed.toString() }
            trd.appendElement("td") { textContent = s.earnedRuns.toString() }
            trd.appendElement("td") { textContent = s.walksAllowed.toString() }
            trd.appendElement("td") { textContent = s.strikeoutsRecorded.toString() }
            trd.appendElement("td") { textContent = s.homeRunsAllowed.toString() }
        }
    }
}

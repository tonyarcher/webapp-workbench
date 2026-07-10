package com.baseball

import com.baseball.api.BaseballApiClient
import com.baseball.models.*
import kotlinx.browser.document
import kotlinx.browser.window
import kotlinx.coroutines.*
import org.w3c.dom.*
import org.w3c.dom.events.Event

// App state variables
internal val api = BaseballApiClient()
internal var currentTab = "leagues"

internal var selectedLeagueId: Long? = null
internal var selectedSeasonId: Long? = null
internal var selectedTeamId: Long? = null
internal var selectedGameId: Long? = null

internal var leaguesList = emptyList<League>()
internal var teamsList = emptyList<Team>()
internal var seasonsList = emptyList<Season>()

// Modes state
internal var isWelcomeScreen = true
internal var isSingleGameMode = false
internal var serverOnline = false
internal var serverConnectionError: String? = null

// Offline / Single Game Mode state
internal var localGame: Game? = null
internal var localEvents = mutableListOf<PlayEvent>()
internal var localBoxScore: BoxScore? = null
internal var localHomeRoster = emptyList<Player>()
internal var localAwayRoster = emptyList<Player>()
internal var activeBoxScoreTab = "away-batting"

// Lineup, Bench, and Batting Order Rotation state
internal val localAwayLineup = mutableListOf<Player>()
internal val localHomeLineup = mutableListOf<Player>()
internal val localAwayBench = mutableListOf<Player>()
internal val localHomeBench = mutableListOf<Player>()
internal var localAwayBatterIndex = 0
internal var localHomeBatterIndex = 0
internal val localPlayersSubbedOut = mutableSetOf<Long>() // IDs of players who left the game and cannot re-enter
internal var localAwayActivePitcherId = 210L
internal var localAwayActivePitcherName = "Sonny Gray"
internal var localHomeActivePitcherId = 110L
internal var localHomeActivePitcherName = "Justin Steele"

fun main() {
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

// Global Coroutine Scope Helper
internal fun launch(block: suspend () -> Unit) {
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
internal fun createElement(tag: String, classes: String = "", init: HTMLElement.() -> Unit = {}): HTMLElement {
    val el = document.createElement(tag) as HTMLElement
    if (classes.isNotEmpty()) {
        el.className = classes
    }
    el.init()
    return el
}

internal fun HTMLElement.appendElement(tag: String, classes: String = "", init: HTMLElement.() -> Unit = {}): HTMLElement {
    val el = createElement(tag, classes, init)
    this.appendChild(el)
    return el
}

internal fun HTMLElement.onClick(handler: (Event) -> Unit) {
    this.addEventListener("click", { event ->
        handler(event)
    })
}

internal fun goBackToWelcome() {
    isWelcomeScreen = true
    selectedGameId = null
    serverConnectionError = null
    renderApp()
}

private fun initLocalGame() {
    val chc = Team(1L, "Cubs", "CHC", "Chicago")
    val stl = Team(2L, "Cardinals", "STL", "St. Louis")
    
    // Starters + Bench Players
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
        Player(110L, 1L, "Justin Steele", "P", 35, "L", "L"),
        // Home Bench
        Player(111L, 1L, "Patrick Wisdom", "3B", 39, "R", "R"),
        Player(112L, 1L, "Miguel Amaya", "C", 7, "R", "R"),
        Player(113L, 1L, "Shota Imanaga", "P", 18, "L", "L")
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
        Player(210L, 2L, "Sonny Gray", "P", 54, "R", "R"),
        // Away Bench
        Player(211L, 2L, "Alec Burleson", "1B", 41, "L", "R"),
        Player(212L, 2L, "Ivan Herrera", "C", 47, "R", "R"),
        Player(213L, 2L, "Ryan Helsley", "P", 56, "R", "R")
    )
    
    // Set Lineups & Benches
    localAwayActivePitcherId = 210L
    localAwayActivePitcherName = "Sonny Gray"
    localHomeActivePitcherId = 110L
    localHomeActivePitcherName = "Justin Steele"

    localAwayLineup.clear()
    localAwayLineup.addAll(localAwayRoster.filter { it.position != "P" }.take(9))
    localAwayBench.clear()
    localAwayBench.addAll(localAwayRoster.filter { it.position == "P" && it.id != 210L } + localAwayRoster.drop(10))
    localAwayBatterIndex = 0

    localHomeLineup.clear()
    localHomeLineup.addAll(localHomeRoster.filter { it.position != "P" }.take(9))
    localHomeBench.clear()
    localHomeBench.addAll(localHomeRoster.filter { it.position == "P" && it.id != 110L } + localHomeRoster.drop(10))
    localHomeBatterIndex = 0

    localPlayersSubbedOut.clear()

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
        homeBatting = (localHomeLineup + localHomeBench.filter { it.position != "P" }).map { PlayerBattingStats(it.id!!, it.name, it.jerseyNumber, it.position) },
        awayBatting = (localAwayLineup + localAwayBench.filter { it.position != "P" }).map { PlayerBattingStats(it.id!!, it.name, it.jerseyNumber, it.position) },
        homePitching = (localHomeRoster.filter { it.position == "P" } + localHomeBench.filter { it.position == "P" }).map { PlayerPitchingStats(it.id!!, it.name, it.jerseyNumber, it.position) },
        awayPitching = (localAwayRoster.filter { it.position == "P" } + localAwayBench.filter { it.position == "P" }).map { PlayerPitchingStats(it.id!!, it.name, it.jerseyNumber, it.position) }
    )
    
    localEvents = mutableListOf()
}

internal fun recordLocalPlayEvent(eventType: ScoringEventType, batterId: Long, pitcherId: Long) {
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

    if (isResolved) {
        if (game.gameState.half == HalfInning.TOP) {
            localAwayBatterIndex = (localAwayBatterIndex + 1) % 9
        } else {
            localHomeBatterIndex = (localHomeBatterIndex + 1) % 9
        }
    }

    val nextBatter = if (currentHalf == HalfInning.TOP) {
        localAwayLineup[localAwayBatterIndex]
    } else {
        localHomeLineup[localHomeBatterIndex]
    }

    val nextPitcherId = if (currentHalf == HalfInning.TOP) localHomeActivePitcherId else localAwayActivePitcherId
    val nextPitcherName = if (currentHalf == HalfInning.TOP) localHomeActivePitcherName else localAwayActivePitcherName

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
            currentBatterId = nextBatter.id,
            currentBatterName = nextBatter.name,
            currentPitcherId = nextPitcherId,
            currentPitcherName = nextPitcherName
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

internal fun updateActiveTabButtons() {
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

internal fun renderCurrentTab() {
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

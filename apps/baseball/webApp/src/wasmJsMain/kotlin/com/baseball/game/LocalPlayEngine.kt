package com.baseball.game

import com.baseball.models.*

fun recordLocalPlayEventInternal(
    eventType: ScoringEventType,
    batterId: Long,
    pitcherId: Long,
    descriptionDetail: String? = null,
    isDoublePlay: Boolean = false,
    isError: Boolean = false,
    runnerAdvanceMap: Map<String, Int>? = null
) {
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
    var desc = descriptionDetail ?: ""

    var bStats = (if (batter.teamId == game.homeTeam.id) boxScore.homeBatting else boxScore.awayBatting)
        .find { it.playerId == batterId } ?: PlayerBattingStats(batterId, batter.name, batter.jerseyNumber, batter.position)
    var pStats = (if (pitcher.teamId == game.homeTeam.id) boxScore.homePitching else boxScore.awayPitching)
        .find { it.playerId == pitcherId } ?: PlayerPitchingStats(pitcherId, pitcher.name, pitcher.jerseyNumber, pitcher.position)

    when (eventType) {
        ScoringEventType.BALL -> {
            balls += 1
            if (desc.isEmpty()) desc = "Ball to ${batter.name}"
            if (balls >= 4) {
                resolvedType = ScoringEventType.WALK
                isWalk = true
                desc = "Walk for ${batter.name}"
            }
        }
        ScoringEventType.STRIKE -> {
            strikes += 1
            if (desc.isEmpty()) desc = "Strike to ${batter.name}"
            if (strikes >= 3) {
                resolvedType = ScoringEventType.STRIKEOUT
                outsAdded = 1
                desc = "Strikeout for ${batter.name}"
            }
        }
        ScoringEventType.FOUL -> {
            if (desc.isEmpty()) desc = "Foul by ${batter.name}"
            if (strikes < 2) strikes += 1
        }
        ScoringEventType.SINGLE -> { basesMoved = 1; if (desc.isEmpty()) desc = "Single by ${batter.name}" }
        ScoringEventType.DOUBLE -> { basesMoved = 2; if (desc.isEmpty()) desc = "Double by ${batter.name}" }
        ScoringEventType.TRIPLE -> { basesMoved = 3; if (desc.isEmpty()) desc = "Triple by ${batter.name}" }
        ScoringEventType.HOME_RUN -> { basesMoved = 4; if (desc.isEmpty()) desc = "Home run by ${batter.name}!" }
        ScoringEventType.WALK -> { isWalk = true; if (desc.isEmpty()) desc = "Walk for ${batter.name}" }
        ScoringEventType.HIT_BY_PITCH -> { isHbp = true; if (desc.isEmpty()) desc = "Hit by pitch for ${batter.name}" }
        ScoringEventType.STRIKEOUT -> { outsAdded = 1; if (desc.isEmpty()) desc = "Strikeout for ${batter.name}" }
        ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT -> {
            outsAdded = 1
            if (desc.isEmpty()) desc = "${eventType.name.lowercase().replace("_", " ")} by ${batter.name}"
        }
        ScoringEventType.SACRIFICE_FLY -> { outsAdded = 1; if (desc.isEmpty()) desc = "Sacrifice fly by ${batter.name}" }
        ScoringEventType.ERROR -> { basesMoved = 1; if (desc.isEmpty()) desc = "Error on play. ${batter.name} reaches base" }
        ScoringEventType.FIELDER_CHOICE -> { outsAdded = 1; basesMoved = 1; if (desc.isEmpty()) desc = "Fielder's choice. ${batter.name} reaches" }
        ScoringEventType.STOLEN_BASE -> { if (desc.isEmpty()) desc = "Stolen Base" }
        ScoringEventType.CAUGHT_STEALING -> { outsAdded = 1; if (desc.isEmpty()) desc = "Caught Stealing" }
        ScoringEventType.PICKED_OFF -> { outsAdded = 1; if (desc.isEmpty()) desc = "Picked Off" }
        ScoringEventType.WILD_PITCH -> { if (desc.isEmpty()) desc = "Wild Pitch" }
        ScoringEventType.PASSED_BALL -> { if (desc.isEmpty()) desc = "Passed Ball" }
        ScoringEventType.BALK -> { if (desc.isEmpty()) desc = "Balk" }
    }

    if (isDoublePlay) {
        outsAdded = maxOf(outsAdded, 2)
    }
    if (isError && eventType != ScoringEventType.ERROR) {
        if (currentHalf == HalfInning.TOP) homeErrors++ else awayErrors++
    }

    val isResolved = resolvedType in listOf(
        ScoringEventType.SINGLE, ScoringEventType.DOUBLE, ScoringEventType.TRIPLE, ScoringEventType.HOME_RUN,
        ScoringEventType.WALK, ScoringEventType.HIT_BY_PITCH, ScoringEventType.STRIKEOUT,
        ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT,
        ScoringEventType.ERROR, ScoringEventType.FIELDER_CHOICE, ScoringEventType.SACRIFICE_FLY
    )

    val runsScoredList = mutableListOf<Long>()

    if (isResolved) {
        balls = 0
        strikes = 0

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
    }

    if (outsAdded > 0) {
        val actualOutsAdded = minOf(outsAdded, 3 - outs)
        if (actualOutsAdded > 0) {
            pStats = pStats.copy(inningsPitchedThirds = pStats.inningsPitchedThirds + actualOutsAdded)
        }
    }

    if (runnerAdvanceMap != null && runnerAdvanceMap.isNotEmpty()) {
        firstId = null; firstName = null
        secondId = null; secondName = null
        thirdId = null; thirdName = null

        runnerAdvanceMap.forEach { (pIdStr, targetBase) ->
            val pId = pIdStr.toLongOrNull() ?: return@forEach
            val pName = (localAwayRoster + localHomeRoster).find { it.id == pId }?.name ?: "Runner"
            when (targetBase) {
                1 -> { firstId = pId; firstName = pName }
                2 -> { secondId = pId; secondName = pName }
                3 -> { thirdId = pId; thirdName = pName }
                4 -> runsScoredList.add(pId)
                0 -> {
                    if (pId != batter.id) {
                        outsAdded = maxOf(outsAdded, 1)
                    }
                }
            }
        }

        if (isResolved && !runnerAdvanceMap.containsKey(batter.id.toString())) {
            if (basesMoved == 1) { firstId = batter.id; firstName = batter.name }
            else if (basesMoved == 2) { secondId = batter.id; secondName = batter.name }
            else if (basesMoved == 3) { thirdId = batter.id; thirdName = batter.name }
            else if (basesMoved == 4) runsScoredList.add(batter.id!!)
            else if (outsAdded == 0 && (isWalk || isHbp || eventType == ScoringEventType.ERROR || eventType == ScoringEventType.FIELDER_CHOICE)) {
                firstId = batter.id; firstName = batter.name
            }
        }
    } else {
        if (isDoublePlay) {
            if (thirdId != null) { thirdId = null; thirdName = null }
            else if (secondId != null) { secondId = null; secondName = null }
            else if (firstId != null) { firstId = null; firstName = null }
        }

        if (basesMoved > 0 || isWalk || isHbp) {
            val runner1 = firstId
            val runner2 = secondId
            val runner3 = thirdId
            val runner1Name = firstName
            val runner2Name = secondName
            val runner3Name = thirdName

            if (isWalk || isHbp) {
                if (runner1 != null) {
                    if (runner2 != null) {
                        if (runner3 != null) {
                            runsScoredList.add(runner3)
                            thirdId = runner2; thirdName = runner2Name
                            secondId = runner1; secondName = runner1Name
                            firstId = batter.id; firstName = batter.name
                        } else {
                            thirdId = runner2; thirdName = runner2Name
                            secondId = runner1; secondName = runner1Name
                            firstId = batter.id; firstName = batter.name
                        }
                    } else {
                        secondId = runner1; secondName = runner1Name
                        firstId = batter.id; firstName = batter.name
                    }
                } else {
                    firstId = batter.id; firstName = batter.name
                }
            } else {
                if (basesMoved == 1) {
                    if (runner3 != null) runsScoredList.add(runner3)
                    if (runner2 != null) runsScoredList.add(runner2)
                    thirdId = null; thirdName = null
                    secondId = runner1; secondName = runner1Name
                    firstId = batter.id; firstName = batter.name
                } else if (basesMoved == 2) {
                    if (runner3 != null) runsScoredList.add(runner3)
                    if (runner2 != null) runsScoredList.add(runner2)
                    thirdId = runner1; thirdName = runner1Name
                    secondId = batter.id; secondName = batter.name
                    firstId = null; firstName = null
                } else if (basesMoved == 3) {
                    if (runner3 != null) runsScoredList.add(runner3)
                    if (runner2 != null) runsScoredList.add(runner2)
                    if (runner1 != null) runsScoredList.add(runner1)
                    thirdId = batter.id; thirdName = batter.name
                    secondId = null; secondName = null
                    firstId = null; firstName = null
                } else if (basesMoved == 4) {
                    if (runner3 != null) runsScoredList.add(runner3)
                    if (runner2 != null) runsScoredList.add(runner2)
                    if (runner1 != null) runsScoredList.add(runner1)
                    runsScoredList.add(batter.id!!)
                    thirdId = null; thirdName = null
                    secondId = null; secondName = null
                    firstId = null; firstName = null
                }
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

    val advancesStr = runnerAdvanceMap?.let { map ->
        " | Adv: " + map.entries.joinToString(",") { "${it.key}->${it.value}" }
    } ?: ""
    val finalDesc = desc + advancesStr

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
        description = finalDesc,
        runsScoredOnPlay = runsScoredList.size,
        timestamp = ""
    )
    localEvents.add(ev)
    saveLocalState()
}

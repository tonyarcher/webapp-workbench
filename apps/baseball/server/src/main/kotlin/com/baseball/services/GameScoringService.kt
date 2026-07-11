package com.baseball.services

import com.baseball.entities.*
import com.baseball.models.*
import com.baseball.repositories.*
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class GameScoringService(
    private val gameRepository: GameRepository,
    private val gameInningRepository: GameInningRepository,
    private val playerRepository: PlayerRepository,
    private val teamRepository: TeamRepository,
    private val playEventRepository: PlayEventRepository,
    private val battingRepository: PlayerGameBattingStatsRepository,
    private val pitchingRepository: PlayerGamePitchingStatsRepository,
    private val seasonRepository: SeasonRepository
) {

    @Transactional
    fun recordPlayEvent(gameId: Long, request: ScoringEventRequest): Game {
        val game = gameRepository.findById(gameId).orElseThrow { IllegalArgumentException("Game not found: $gameId") }
        
        if (game.status == GameStatus.COMPLETED) {
            throw IllegalStateException("Cannot record events for a completed game")
        }
        if (game.status == GameStatus.SCHEDULED) {
            game.status = GameStatus.IN_PROGRESS
        }

        val batter = playerRepository.findById(request.batterId).orElseThrow { IllegalArgumentException("Batter not found: ${request.batterId}") }
        val pitcher = playerRepository.findById(request.pitcherId).orElseThrow { IllegalArgumentException("Pitcher not found: ${request.pitcherId}") }

        game.currentBatterId = batter.id
        game.currentPitcherId = pitcher.id

        val batterStats = getOrCreateBattingStats(gameId, batter.id!!)
        val pitcherStats = getOrCreatePitchingStats(gameId, pitcher.id!!)

        var eventType = request.eventType
        var description = request.description ?: ""
        var outsAdded = 0
        var basesMoved = 0
        var isWalk = false
        var isHitByPitch = false

        when (request.eventType) {
            ScoringEventType.BALL -> {
                game.balls += 1
                description = if (description.isEmpty()) "Ball to ${batter.name}" else description
                if (game.balls >= 4) {
                    eventType = ScoringEventType.WALK
                    isWalk = true
                    description = "Walk for ${batter.name}"
                }
            }
            ScoringEventType.STRIKE -> {
                game.strikes += 1
                description = if (description.isEmpty()) "Strike to ${batter.name}" else description
                if (game.strikes >= 3) {
                    eventType = ScoringEventType.STRIKEOUT
                    outsAdded = 1
                    description = "Strikeout for ${batter.name}"
                }
            }
            ScoringEventType.FOUL -> {
                description = if (description.isEmpty()) "Foul by ${batter.name}" else description
                if (game.strikes < 2) {
                    game.strikes += 1
                }
            }
            ScoringEventType.SINGLE -> {
                basesMoved = 1
                description = if (description.isEmpty()) "Single by ${batter.name}" else description
            }
            ScoringEventType.DOUBLE -> {
                basesMoved = 2
                description = if (description.isEmpty()) "Double by ${batter.name}" else description
            }
            ScoringEventType.TRIPLE -> {
                basesMoved = 3
                description = if (description.isEmpty()) "Triple by ${batter.name}" else description
            }
            ScoringEventType.HOME_RUN -> {
                basesMoved = 4
                description = if (description.isEmpty()) "Home run by ${batter.name}!" else description
            }
            ScoringEventType.WALK -> {
                isWalk = true
                description = if (description.isEmpty()) "Walk for ${batter.name}" else description
            }
            ScoringEventType.HIT_BY_PITCH -> {
                isHitByPitch = true
                description = if (description.isEmpty()) "Hit by pitch for ${batter.name}" else description
            }
            ScoringEventType.STRIKEOUT -> {
                outsAdded = 1
                description = if (description.isEmpty()) "Strikeout for ${batter.name}" else description
            }
            ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT -> {
                outsAdded = 1
                description = if (description.isEmpty()) "${eventType.name.lowercase().replace("_", " ")} by ${batter.name}" else description
            }
            ScoringEventType.SACRIFICE_FLY -> {
                outsAdded = 1
                description = if (description.isEmpty()) "Sacrifice fly by ${batter.name}" else description
            }
            ScoringEventType.ERROR -> {
                basesMoved = 1
                description = if (description.isEmpty()) "Error on play. ${batter.name} reaches base" else description
            }
            ScoringEventType.FIELDER_CHOICE -> {
                outsAdded = 1
                basesMoved = 1 // batter reaches on fielder's choice
                description = if (description.isEmpty()) "Fielder's choice. ${batter.name} reaches" else description
            }
        }

        if (request.isDoublePlay) {
            outsAdded = maxOf(outsAdded, 2)
        }
        if (request.isError && request.eventType != ScoringEventType.ERROR) {
            incrementTeamErrors(game)
        }

        val runsScoredList = mutableListOf<Long>()
        val outsBefore = game.outs

        // If plate appearance resolved (not just BALL, STRIKE, FOUL)
        if (eventType != ScoringEventType.BALL && eventType != ScoringEventType.STRIKE && eventType != ScoringEventType.FOUL) {
            // Reset count
            game.balls = 0
            game.strikes = 0

            // Apply Batting/Pitching Stat Changes
            when (eventType) {
                ScoringEventType.SINGLE -> {
                    batterStats.hits += 1
                    batterStats.atBats += 1
                    pitcherStats.hitsAllowed += 1
                    incrementTeamHits(game)
                }
                ScoringEventType.DOUBLE -> {
                    batterStats.hits += 1
                    batterStats.doubles += 1
                    batterStats.atBats += 1
                    pitcherStats.hitsAllowed += 1
                    incrementTeamHits(game)
                }
                ScoringEventType.TRIPLE -> {
                    batterStats.hits += 1
                    batterStats.triples += 1
                    batterStats.atBats += 1
                    pitcherStats.hitsAllowed += 1
                    incrementTeamHits(game)
                }
                ScoringEventType.HOME_RUN -> {
                    batterStats.hits += 1
                    batterStats.homeRuns += 1
                    batterStats.runs += 1
                    batterStats.atBats += 1
                    pitcherStats.hitsAllowed += 1
                    pitcherStats.homeRunsAllowed += 1
                    incrementTeamHits(game)
                }
                ScoringEventType.WALK -> {
                    batterStats.walks += 1
                    pitcherStats.walksAllowed += 1
                }
                ScoringEventType.HIT_BY_PITCH -> {
                    batterStats.hitByPitch += 1
                }
                ScoringEventType.STRIKEOUT -> {
                    batterStats.strikeOuts += 1
                    batterStats.atBats += 1
                    pitcherStats.strikeoutsRecorded += 1
                }
                ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT, ScoringEventType.FIELDER_CHOICE -> {
                    batterStats.atBats += 1
                }
                ScoringEventType.ERROR -> {
                    batterStats.atBats += 1
                    incrementTeamErrors(game)
                }
                ScoringEventType.SACRIFICE_FLY -> {
                    // No at-bat, but could lead to RBI
                }
            }

            if (outsAdded > 0) {
                val actualOutsAdded = minOf(outsAdded, 3 - outsBefore)
                if (actualOutsAdded > 0) {
                    pitcherStats.inningsPitchedThirds += actualOutsAdded
                }
            }

            // Run advancement logic
            val advanceMap = request.runnerAdvanceMap
            if (advanceMap != null && advanceMap.isNotEmpty()) {
                // Clear bases first
                game.runnerFirstId = null
                game.runnerSecondId = null
                game.runnerThirdId = null

                advanceMap.forEach { (pIdStr, targetBase) ->
                    val pId = pIdStr.toLongOrNull() ?: return@forEach
                    when (targetBase) {
                        1 -> game.runnerFirstId = pId
                        2 -> game.runnerSecondId = pId
                        3 -> game.runnerThirdId = pId
                        4 -> runsScoredList.add(pId)
                        0 -> {
                            // If runner is explicitly marked as out
                            if (pId != batter.id) {
                                outsAdded = maxOf(outsAdded, 1)
                            }
                        }
                    }
                }

                // If batter is not in advance map, place batter based on defaults
                if (!advanceMap.containsKey(batter.id.toString())) {
                    if (basesMoved == 1) game.runnerFirstId = batter.id
                    else if (basesMoved == 2) game.runnerSecondId = batter.id
                    else if (basesMoved == 3) game.runnerThirdId = batter.id
                    else if (basesMoved == 4) runsScoredList.add(batter.id!!)
                    else if (outsAdded == 0 && (isWalk || isHitByPitch || eventType == ScoringEventType.ERROR || eventType == ScoringEventType.FIELDER_CHOICE)) {
                        game.runnerFirstId = batter.id
                    }
                }
            } else {
                // Default double play removal if no advance map provided
                if (request.isDoublePlay) {
                    if (game.runnerThirdId != null) game.runnerThirdId = null
                    else if (game.runnerSecondId != null) game.runnerSecondId = null
                    else if (game.runnerFirstId != null) game.runnerFirstId = null
                }

                if (basesMoved > 0 || isWalk || isHitByPitch) {
                    val runner1 = game.runnerFirstId
                    val runner2 = game.runnerSecondId
                    val runner3 = game.runnerThirdId

                    if (isWalk || isHitByPitch) {
                        // Forced base runner advancement
                        if (runner1 != null) {
                            if (runner2 != null) {
                                if (runner3 != null) {
                                    runsScoredList.add(runner3)
                                    game.runnerThirdId = runner2
                                    game.runnerSecondId = runner1
                                    game.runnerFirstId = batter.id
                                } else {
                                    game.runnerThirdId = runner2
                                    game.runnerSecondId = runner1
                                    game.runnerFirstId = batter.id
                                }
                            } else {
                                game.runnerSecondId = runner1
                                game.runnerFirstId = batter.id
                            }
                        } else {
                            game.runnerFirstId = batter.id
                        }
                    } else {
                        // Hit or error advancement
                        if (basesMoved == 1) {
                            if (runner3 != null) runsScoredList.add(runner3)
                            if (runner2 != null) runsScoredList.add(runner2)
                            game.runnerThirdId = null
                            game.runnerSecondId = runner1
                            game.runnerFirstId = batter.id
                        } else if (basesMoved == 2) {
                            if (runner3 != null) runsScoredList.add(runner3)
                            if (runner2 != null) runsScoredList.add(runner2)
                            game.runnerThirdId = runner1
                            game.runnerSecondId = batter.id
                            game.runnerFirstId = null
                        } else if (basesMoved == 3) {
                            if (runner3 != null) runsScoredList.add(runner3)
                            if (runner2 != null) runsScoredList.add(runner2)
                            if (runner1 != null) runsScoredList.add(runner1)
                            game.runnerThirdId = batter.id
                            game.runnerSecondId = null
                            game.runnerFirstId = null
                        } else if (basesMoved == 4) {
                            if (runner3 != null) runsScoredList.add(runner3)
                            if (runner2 != null) runsScoredList.add(runner2)
                            if (runner1 != null) runsScoredList.add(runner1)
                            runsScoredList.add(batter.id!!)
                            game.runnerThirdId = null
                            game.runnerSecondId = null
                            game.runnerFirstId = null
                        }
                    }
                }
            }

            // Standard sacrifice fly advancement
            if (eventType == ScoringEventType.SACRIFICE_FLY) {
                val runner3 = game.runnerThirdId
                if (runner3 != null) {
                    runsScoredList.add(runner3)
                    game.runnerThirdId = null
                }
            }

            // Handle Outs
            game.outs += outsAdded
            if (game.outs >= 3) {
                // Clear bases for the next half inning
                game.runnerFirstId = null
                game.runnerSecondId = null
                game.runnerThirdId = null
                game.outs = 0

                // Inning transition
                val currentInning = game.inning
                val currentHalf = game.half

                // Initialize inning record if not exists
                getOrCreateInningRuns(game.id!!, currentInning)

                if (currentHalf == HalfInning.TOP) {
                    game.half = HalfInning.BOTTOM
                } else {
                    game.half = HalfInning.TOP
                    game.inning += 1
                }
                
                checkGameCompletion(game)
            }
        }

        // Apply Runs Scored
        runsScoredList.forEach { runnerId ->
            batterStats.rbi += 1
            if (runnerId != batter.id) {
                val runnerStats = getOrCreateBattingStats(gameId, runnerId)
                runnerStats.runs += 1
                battingRepository.save(runnerStats)
            }
            pitcherStats.runsAllowed += 1
            pitcherStats.earnedRuns += 1 // assume all are earned for simplicity

            // Add run to game score
            val currentInningRuns = getOrCreateInningRuns(game.id!!, game.inning)
            if (game.half == HalfInning.TOP) {
                game.awayScore += 1
                currentInningRuns.awayRuns = (currentInningRuns.awayRuns ?: 0) + 1
            } else {
                game.homeScore += 1
                currentInningRuns.homeRuns = (currentInningRuns.homeRuns ?: 0) + 1
            }
            gameInningRepository.save(currentInningRuns)
        }

        // Check if game has ended outside the 3-out transition (e.g. walk-off)
        if (runsScoredList.isNotEmpty()) {
            checkGameCompletion(game)
        }

        // Save batting/pitching stats
        battingRepository.save(batterStats)
        pitchingRepository.save(pitcherStats)

        // Save game play event
        val playEvent = PlayEventEntity(
            gameId = game.id!!,
            inning = game.inning,
            half = game.half,
            outsBefore = outsBefore,
            outsAfter = game.outs,
            balls = game.balls,
            strikes = game.strikes,
            batterName = batter.name,
            pitcherName = pitcher.name,
            eventType = eventType,
            description = description,
            runsScoredOnPlay = runsScoredList.size,
            timestamp = Instant.now().toString()
        )
        playEventRepository.save(playEvent)

        val saved = gameRepository.save(game)
        return mapGameToDomain(saved)
    }

    private fun checkGameCompletion(game: GameEntity) {
        // A baseball game is completed if:
        // 1. It is at least the 9th inning.
        // 2. The home team leads in the middle of the 9th (after Top 9 completes).
        // 3. The home team scores the winning run in the bottom of the 9th or later (walk-off).
        // 4. The away team leads after the Bottom of the 9th (or any subsequent inning) completes.
        
        if (game.inning >= 9) {
            val isTopComplete = game.half == HalfInning.BOTTOM && game.outs == 0 // We just transitioned to Bottom 9
            val isBottomComplete = game.half == HalfInning.TOP && game.inning > 9 // We just transitioned to Top 10
            
            if (isTopComplete && game.homeScore > game.awayScore) {
                game.status = GameStatus.COMPLETED
            } else if (game.half == HalfInning.BOTTOM && game.homeScore > game.awayScore) {
                // Walk-off during bottom of 9th or later
                game.status = GameStatus.COMPLETED
            } else if (isBottomComplete && game.awayScore > game.homeScore) {
                game.status = GameStatus.COMPLETED
            } else if (isBottomComplete && game.homeScore > game.awayScore) {
                game.status = GameStatus.COMPLETED
            }
        }
    }

    private fun incrementTeamHits(game: GameEntity) {
        if (game.half == HalfInning.TOP) {
            game.awayHits += 1
        } else {
            game.homeHits += 1
        }
    }

    private fun incrementTeamErrors(game: GameEntity) {
        // An error by the defense adds an error to the defensive team's score.
        // If it is TOP of the inning, the HOME team is on defense and gets the error.
        // If it is BOTTOM of the inning, the AWAY team is on defense.
        if (game.half == HalfInning.TOP) {
            game.homeErrors += 1
        } else {
            game.awayErrors += 1
        }
    }

    private fun getOrCreateBattingStats(gameId: Long, playerId: Long): PlayerGameBattingStatsEntity {
        return battingRepository.findByGameIdAndPlayerId(gameId, playerId)
            ?: PlayerGameBattingStatsEntity(gameId = gameId, playerId = playerId)
    }

    private fun getOrCreatePitchingStats(gameId: Long, playerId: Long): PlayerGamePitchingStatsEntity {
        return pitchingRepository.findByGameIdAndPlayerId(gameId, playerId)
            ?: PlayerGamePitchingStatsEntity(gameId = gameId, playerId = playerId)
    }

    private fun getOrCreateInningRuns(gameId: Long, inning: Int): GameInningEntity {
        return gameInningRepository.findByGameIdAndInning(gameId, inning)
            ?: gameInningRepository.save(GameInningEntity(gameId = gameId, inning = inning, awayRuns = 0, homeRuns = 0))
    }

    @Transactional(readOnly = true)
    fun getGameDomain(gameId: Long): Game {
        val game = gameRepository.findById(gameId).orElseThrow { IllegalArgumentException("Game not found: $gameId") }
        return mapGameToDomain(game)
    }

    private fun mapGameToDomain(game: GameEntity): Game {
        val homeTeam = teamRepository.findById(game.homeTeamId).orElseThrow { IllegalArgumentException("Home Team not found: ${game.homeTeamId}") }.toDomain()
        val awayTeam = teamRepository.findById(game.awayTeamId).orElseThrow { IllegalArgumentException("Away Team not found: ${game.awayTeamId}") }.toDomain()
        
        val runner1 = game.runnerFirstId?.let { playerRepository.findById(it).orElse(null)?.name }
        val runner2 = game.runnerSecondId?.let { playerRepository.findById(it).orElse(null)?.name }
        val runner3 = game.runnerThirdId?.let { playerRepository.findById(it).orElse(null)?.name }
        
        val batter = game.currentBatterId?.let { playerRepository.findById(it).orElse(null)?.name }
        val pitcher = game.currentPitcherId?.let { playerRepository.findById(it).orElse(null)?.name }

        return game.toDomain(
            homeTeam = homeTeam,
            awayTeam = awayTeam,
            runnerFirstName = runner1,
            runnerSecondName = runner2,
            runnerThirdName = runner3,
            currentBatterName = batter,
            currentPitcherName = pitcher
        )
    }

    @Transactional(readOnly = true)
    fun getBoxScore(gameId: Long): BoxScore {
        val game = gameRepository.findById(gameId).orElseThrow { IllegalArgumentException("Game not found: $gameId") }
        val homeTeam = teamRepository.findById(game.homeTeamId).orElseThrow().toDomain()
        val awayTeam = teamRepository.findById(game.awayTeamId).orElseThrow().toDomain()

        val innings = gameInningRepository.findAllByGameIdOrderByInningAsc(gameId)
        
        // Ensure at least 9 innings are represented in line score
        val awayInningRuns = mutableListOf<Int?>()
        val homeInningRuns = mutableListOf<Int?>()
        val maxInnings = maxOf(9, innings.maxOfOrNull { it.inning } ?: 9)
        
        for (i in 1..maxInnings) {
            val inn = innings.find { it.inning == i }
            awayInningRuns.add(inn?.awayRuns)
            homeInningRuns.add(inn?.homeRuns)
        }

        val lineScore = LineScore(
            gameId = gameId,
            awayInningRuns = awayInningRuns,
            homeInningRuns = homeInningRuns,
            awayRuns = game.awayScore,
            homeRuns = game.homeScore,
            awayHits = game.awayHits,
            homeHits = game.homeHits,
            awayErrors = game.awayErrors,
            homeErrors = game.homeErrors
        )

        val battingStats = battingRepository.findAllByGameId(gameId)
        val pitchingStats = pitchingRepository.findAllByGameId(gameId)

        val homeBatting = mutableListOf<PlayerBattingStats>()
        val awayBatting = mutableListOf<PlayerBattingStats>()
        val homePitching = mutableListOf<PlayerPitchingStats>()
        val awayPitching = mutableListOf<PlayerPitchingStats>()

        battingStats.forEach { stat ->
            val player = playerRepository.findById(stat.playerId).orElseThrow()
            val domainStat = stat.toDomain(player.name, player.jerseyNumber, player.position)
            if (player.teamId == game.homeTeamId) {
                homeBatting.add(domainStat)
            } else {
                awayBatting.add(domainStat)
            }
        }

        pitchingStats.forEach { stat ->
            val player = playerRepository.findById(stat.playerId).orElseThrow()
            val domainStat = stat.toDomain(player.name, player.jerseyNumber, player.position)
            if (player.teamId == game.homeTeamId) {
                homePitching.add(domainStat)
            } else {
                awayPitching.add(domainStat)
            }
        }

        return BoxScore(
            gameId = gameId,
            homeTeamName = homeTeam.name,
            awayTeamName = awayTeam.name,
            lineScore = lineScore,
            homeBatting = homeBatting,
            awayBatting = awayBatting,
            homePitching = homePitching,
            awayPitching = awayPitching
        )
    }

    @Transactional(readOnly = true)
    fun getSeasonDashboard(seasonId: Long): SeasonDashboard {
        val season = seasonRepository.findById(seasonId).orElseThrow { IllegalArgumentException("Season not found: $seasonId") }
        val games = gameRepository.findAllBySeasonId(seasonId).map { mapGameToDomain(it) }
        
        // Compute Standings
        val teamStatsMap = mutableMapOf<Long, TeamStandings>()
        
        // Populate all teams
        val allTeams = teamRepository.findAll()
        allTeams.forEach { team ->
            teamStatsMap[team.id!!] = TeamStandings(
                teamId = team.id!!,
                teamName = team.name,
                wins = 0,
                losses = 0,
                winPercentage = 0.0,
                gamesPlayed = 0,
                runsScored = 0,
                runsAllowed = 0
            )
        }

        games.forEach { game ->
            if (game.status == GameStatus.COMPLETED) {
                val homeStats = teamStatsMap[game.homeTeam.id]!!
                val awayStats = teamStatsMap[game.awayTeam.id]!!
                
                val homeWins = if (game.homeScore > game.awayScore) 1 else 0
                val homeLosses = if (game.homeScore < game.awayScore) 1 else 0
                val awayWins = if (game.awayScore > game.homeScore) 1 else 0
                val awayLosses = if (game.awayScore < game.homeScore) 1 else 0

                teamStatsMap[game.homeTeam.id!!] = homeStats.copy(
                    wins = homeStats.wins + homeWins,
                    losses = homeStats.losses + homeLosses,
                    gamesPlayed = homeStats.gamesPlayed + 1,
                    runsScored = homeStats.runsScored + game.homeScore,
                    runsAllowed = homeStats.runsAllowed + game.awayScore
                )

                teamStatsMap[game.awayTeam.id!!] = awayStats.copy(
                    wins = awayStats.wins + awayWins,
                    losses = awayStats.losses + awayLosses,
                    gamesPlayed = awayStats.gamesPlayed + 1,
                    runsScored = awayStats.runsScored + game.awayScore,
                    runsAllowed = awayStats.runsAllowed + game.homeScore
                )
            }
        }

        // Calculate percentages and sort
        val standings = teamStatsMap.values.map { stats ->
            val percentage = if (stats.gamesPlayed > 0) stats.wins.toDouble() / stats.gamesPlayed else 0.0
            stats.copy(winPercentage = Math.round(percentage * 1000.0) / 1000.0)
        }.sortedWith(compareByDescending<TeamStandings> { it.winPercentage }.thenByDescending { it.wins })

        return SeasonDashboard(
            seasonId = seasonId,
            seasonName = season.name,
            standings = standings,
            games = games
        )
    }
}

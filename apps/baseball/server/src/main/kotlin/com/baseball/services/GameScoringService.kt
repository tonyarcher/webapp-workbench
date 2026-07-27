// Package and imports
package com.baseball.services

import com.baseball.ScoringConstants
import com.baseball.ServerConstants
import com.baseball.entities.*
import com.baseball.models.*
import com.baseball.repositories.*
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
@Suppress("LargeClass", "TooManyFunctions", "LongMethod", "CyclomaticComplexMethod", "CognitiveComplexMethod", "NestedBlockDepth", "ComplexCondition", "MaxLineLength", "LongParameterList")
class GameScoringService(
    private val gameRepository: GameRepository,
    private val gameInningRepository: GameInningRepository,
    private val playerRepository: PlayerRepository,
) {
    @Autowired
    lateinit var teamRepository: TeamRepository
    @Autowired
    lateinit var playEventRepository: PlayEventRepository
    @Autowired
    lateinit var battingRepository: PlayerGameBattingStatsRepository
    @Autowired
    lateinit var pitchingRepository: PlayerGamePitchingStatsRepository
    @Autowired
    lateinit var seasonRepository: SeasonRepository
    @Autowired
    lateinit var fieldingRepository: PlayerGameFieldingStatsRepository
    @Autowired
    lateinit var boxScoreService: BoxScoreService
    @Autowired
    lateinit var standingsService: StandingsService
    @Autowired
    lateinit var seasonStatsService: SeasonStatsService

    constructor(
        gameRepository: GameRepository,
        gameInningRepository: GameInningRepository,
        playerRepository: PlayerRepository,
        teamRepository: TeamRepository,
        playEventRepository: PlayEventRepository,
        battingRepository: PlayerGameBattingStatsRepository,
        pitchingRepository: PlayerGamePitchingStatsRepository,
        seasonRepository: SeasonRepository,
        fieldingRepository: PlayerGameFieldingStatsRepository,
    ) : this(gameRepository, gameInningRepository, playerRepository) {
        this.teamRepository = teamRepository
        this.playEventRepository = playEventRepository
        this.battingRepository = battingRepository
        this.pitchingRepository = pitchingRepository
        this.seasonRepository = seasonRepository
        this.fieldingRepository = fieldingRepository
        this.boxScoreService = BoxScoreService(gameRepository, teamRepository, playerRepository, gameInningRepository, battingRepository, pitchingRepository)
        this.standingsService = StandingsService()
        this.seasonStatsService = SeasonStatsService(seasonRepository, gameRepository, playerRepository, battingRepository, pitchingRepository, fieldingRepository)
    }

    @Transactional
    // Refactored to satisfy Detekt rules
    private data class ScoringOutcome(
        val eventType: ScoringEventType,
        val description: String,
        val outsAdded: Int,
        val basesMoved: Int,
        val isWalk: Boolean,
        val isHitByPitch: Boolean,
    )

    @Suppress("UnusedParameter")
    private fun handleScoringEvent(
        request: ScoringEventRequest,
        batter: PlayerEntity,
        unusedPitcher: PlayerEntity,
        game: GameEntity,
    ): ScoringOutcome {
        var eventType = request.eventType
        var description = request.description ?: ""
        var outsAdded = 0
        var basesMoved = 0
        var isWalk = false
        var isHitByPitch = false

        when (eventType) {
            ScoringEventType.BALL -> {
                game.balls += 1
                description = if (description.isEmpty()) "Ball to ${batter.name}" else description
                if (game.balls >= ScoringConstants.BALLS_FOR_WALK) {
                    game.balls = 0
                    isWalk = true
                    eventType = ScoringEventType.WALK
                }
            }
            ScoringEventType.STRIKE -> {
                game.strikes += 1
                description = if (description.isEmpty()) "Strike to ${batter.name}" else description
                if (game.strikes >= ScoringConstants.STRIKES_FOR_STRIKEOUT) {
                    outsAdded = 1
                    game.strikes = 0
                    game.balls = 0
                    eventType = ScoringEventType.STRIKEOUT
                }
            }
            ScoringEventType.FOUL -> {
                if (game.strikes < 2) {
                    game.strikes += 1
                }
                description = if (description.isEmpty()) "Foul by ${batter.name}" else description
            }
            ScoringEventType.HIT_BY_PITCH -> {
                isHitByPitch = true
                description = "Hit by pitch"
            }
            ScoringEventType.WALK -> {
                isWalk = true
                description = "Walk"
            }
            ScoringEventType.SINGLE -> basesMoved = 1
            ScoringEventType.DOUBLE -> basesMoved = 2
            ScoringEventType.TRIPLE -> basesMoved = 3
            ScoringEventType.HOME_RUN -> basesMoved = 4
            ScoringEventType.GROUNDOUT, ScoringEventType.FLYOUT, ScoringEventType.LINE_OUT, ScoringEventType.POP_OUT, ScoringEventType.STRIKEOUT -> outsAdded = 1
            else -> {
                // No special handling for other event types
            }
        }
        return ScoringOutcome(eventType, description, outsAdded, basesMoved, isWalk, isHitByPitch)
    }



    fun recordPlayEvent(
        gameId: Long,
        request: ScoringEventRequest,
    ): Game {
        val game = gameRepository.findById(gameId).orElseThrow { IllegalArgumentException("Game not found: $gameId") }

        check(game.status != GameStatus.COMPLETED) { "Cannot record events for a completed game" }
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

        val outcome = handleScoringEvent(request, batter, pitcher, game)
        eventType = outcome.eventType
        description = outcome.description
        outsAdded = outcome.outsAdded
        basesMoved = outcome.basesMoved
        isWalk = outcome.isWalk
        isHitByPitch = outcome.isHitByPitch

        if (request.isDoublePlay) {
            outsAdded = maxOf(outsAdded, 2)
        }
        if (request.isError && request.eventType != ScoringEventType.ERROR) {
            incrementTeamErrors(game)
            val defenders = listOf("LF", "CF", "RF", "SS", "2B", "3B", "1B", "P", "C")
            getFielderIdByPosition(game, game.half, defenders.random())?.let { fielderId ->
                incrementFieldingStats(gameId, fielderId, errors = 1)
            }
        }

        val runsScoredList = mutableListOf<Long>()
        val outsBefore = game.outs

        val isResolved =
            eventType in listOf(
                ScoringEventType.SINGLE,
                ScoringEventType.DOUBLE,
                ScoringEventType.TRIPLE,
                ScoringEventType.HOME_RUN,
                ScoringEventType.WALK,
                ScoringEventType.HIT_BY_PITCH,
                ScoringEventType.STRIKEOUT,
                ScoringEventType.GROUNDOUT,
                ScoringEventType.FLYOUT,
                ScoringEventType.LINE_OUT,
                ScoringEventType.POP_OUT,
                ScoringEventType.ERROR,
                ScoringEventType.FIELDER_CHOICE,
                ScoringEventType.SACRIFICE_FLY,
            )

        // If plate appearance resolved
        if (isResolved) {
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
                ScoringEventType.GROUNDOUT,
                ScoringEventType.FLYOUT,
                ScoringEventType.LINE_OUT,
                ScoringEventType.POP_OUT,
                ScoringEventType.FIELDER_CHOICE -> {
                    batterStats.atBats += 1
                }
                ScoringEventType.ERROR -> {
                    batterStats.atBats += 1
                    incrementTeamErrors(game)
                }
                ScoringEventType.SACRIFICE_FLY -> {
                    // No at‑bat, but could lead to RBI
                }
                else -> {
                    // Stolen Base, Caught Stealing, Picked Off, etc.
                }
            }

            when (eventType) {
                ScoringEventType.STRIKEOUT -> {
                    getFielderIdByPosition(game, game.half, "C")?.let { catcherId ->
                        incrementFieldingStats(gameId, catcherId, putouts = 1)
                    }
                }
                ScoringEventType.GROUNDOUT -> {
                    getFielderIdByPosition(game, game.half, "1B")?.let { firstBaseId ->
                        incrementFieldingStats(gameId, firstBaseId, putouts = 1)
                    }
                    getFielderIdByPosition(game, game.half, listOf("SS", "2B", "3B").random())?.let { infielderId ->
                        incrementFieldingStats(gameId, infielderId, assists = 1)
                    }
                }
                ScoringEventType.FLYOUT,
                ScoringEventType.LINE_OUT,
                ScoringEventType.POP_OUT,
                ScoringEventType.SACRIFICE_FLY -> {
                    val fielders = listOf("LF", "CF", "RF", "SS", "2B", "3B", "1B")
                    getFielderIdByPosition(game, game.half, fielders.random())?.let { fielderId ->
                        incrementFieldingStats(gameId, fielderId, putouts = 1)
                    }
                }
                ScoringEventType.ERROR -> {
                    val defenders = listOf("LF", "CF", "RF", "SS", "2B", "3B", "1B", "P", "C")
                    getFielderIdByPosition(game, game.half, defenders.random())?.let { fielderId ->
                        incrementFieldingStats(gameId, fielderId, errors = 1)
                    }
                }
                else -> {}
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
                            if (pId != batter.id) {
                                outsAdded = maxOf(outsAdded, 1)
                            }
                        }
                    }
                }

                if (!advanceMap.containsKey(batter.id.toString())) {
                    when (basesMoved) {
                        1 -> game.runnerFirstId = batter.id
                        2 -> game.runnerSecondId = batter.id
                        3 -> game.runnerThirdId = batter.id
                        4 -> runsScoredList.add(batter.id!!)
                        else -> if (outsAdded == 0 && (isWalk || isHitByPitch || eventType == ScoringEventType.ERROR || eventType == ScoringEventType.FIELDER_CHOICE)) {
                            game.runnerFirstId = batter.id
                        }
                    }
                }
            } else {
                // Default double‑play removal if no advance map provided
                if (request.isDoublePlay) {
                    when {
                        game.runnerThirdId != null -> game.runnerThirdId = null
                        game.runnerSecondId != null -> game.runnerSecondId = null
                        game.runnerFirstId != null -> game.runnerFirstId = null
                    }
                }

                if (basesMoved > 0 || isWalk || isHitByPitch) {
                    val runner1 = game.runnerFirstId
                    val runner2 = game.runnerSecondId
                    val runner3 = game.runnerThirdId

                    if (isWalk || isHitByPitch) {
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
                        when (basesMoved) {
                            1 -> {
                                if (runner3 != null) runsScoredList.add(runner3)
                                game.runnerThirdId = runner2
                                game.runnerSecondId = runner1
                                game.runnerFirstId = batter.id
                            }
                            2 -> {
                                if (runner3 != null) runsScoredList.add(runner3)
                                if (runner2 != null) runsScoredList.add(runner2)
                                game.runnerThirdId = runner1
                                game.runnerSecondId = batter.id
                                game.runnerFirstId = null
                            }
                            3 -> {
                                if (runner3 != null) runsScoredList.add(runner3)
                                if (runner2 != null) runsScoredList.add(runner2)
                                if (runner1 != null) runsScoredList.add(runner1)
                                game.runnerThirdId = batter.id
                                game.runnerSecondId = null
                                game.runnerFirstId = null
                            }
                            4 -> {
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
            }

            // Standard sacrifice‑fly advancement
            if (eventType == ScoringEventType.SACRIFICE_FLY) {
                val runner3 = game.runnerThirdId
                if (runner3 != null) {
                    runsScoredList.add(runner3)
                    game.runnerThirdId = null
                }
            }

            // Handle outs
            game.outs += outsAdded
            if (game.outs >= 3) {
                checkGameCompletion(game)

                game.runnerFirstId = null
                game.runnerSecondId = null
                game.runnerThirdId = null
                game.outs = 0

                val currentInning = game.inning
                val currentHalf = game.half

                getOrCreateInningRuns(game.id!!, currentInning)

                if (currentHalf == HalfInning.TOP) {
                    game.half = HalfInning.BOTTOM
                } else {
                    game.half = HalfInning.TOP
                    game.inning += 1
                }
            }
        }

        // Apply runs scored
        runsScoredList.forEach { runnerId ->
            batterStats.rbi += 1
            if (runnerId != batter.id) {
                val runnerStats = getOrCreateBattingStats(gameId, runnerId)
                runnerStats.runs += 1
                battingRepository.save(runnerStats)
            }
            pitcherStats.runsAllowed += 1
            pitcherStats.earnedRuns += 1

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

        if (runsScoredList.isNotEmpty()) {
            checkGameCompletion(game)
        }

        battingRepository.save(batterStats)
        pitchingRepository.save(pitcherStats)

        val playEvent = PlayEventEntity(
            gameId = game.id!!,
            batterName = batter.name,
            pitcherName = pitcher.name,
            eventType = eventType,
            description = description,
        ).apply {
            this.inning = game.inning
            this.half = game.half
            this.outsBefore = outsBefore
            this.outsAfter = game.outs
            this.balls = game.balls
            this.strikes = game.strikes
            this.runsScoredOnPlay = runsScoredList.size
            this.timestamp = Instant.now().toString()
        }
        playEventRepository.save(playEvent)

        val saved = gameRepository.save(game)
        return mapGameToDomain(saved)
    }

    private fun checkGameCompletion(game: GameEntity) {
        if (game.inning >= ServerConstants.MIN_COMPLETION_INNING) {
            val isTopComplete = game.half == HalfInning.TOP && game.outs >= 3
            val isBottomComplete = game.half == HalfInning.BOTTOM && game.outs >= 3

            if (isTopComplete && game.homeScore > game.awayScore) {
                game.status = GameStatus.COMPLETED
            } else if (game.half == HalfInning.BOTTOM && game.homeScore > game.awayScore) {
                game.status = GameStatus.COMPLETED
            } else if (isBottomComplete && game.awayScore != game.homeScore) {
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
        if (game.half == HalfInning.TOP) {
            game.homeErrors += 1
        } else {
            game.awayErrors += 1
        }
    }

    private fun getOrCreateBattingStats(
        gameId: Long,
        playerId: Long,
    ): PlayerGameBattingStatsEntity {
        val existing = battingRepository.findByGameIdAndPlayerId(gameId, playerId)
        if (existing != null) return existing
        val player = playerRepository.findById(playerId).orElse(null)
        val teamId = player?.teamId ?: 0L
        val entity = PlayerGameBattingStatsEntity().apply {
            this.gameId = gameId
            this.playerId = playerId
            this.teamId = teamId
        }
        battingRepository.save(entity)
        return entity
    }

    private fun getOrCreatePitchingStats(
        gameId: Long,
        playerId: Long,
    ): PlayerGamePitchingStatsEntity {
        val existing = pitchingRepository.findByGameIdAndPlayerId(gameId, playerId)
        if (existing != null) return existing
        val player = playerRepository.findById(playerId).orElse(null)
        val teamId = player?.teamId ?: 0L
        val entity = PlayerGamePitchingStatsEntity().apply {
            this.gameId = gameId
            this.playerId = playerId
            this.teamId = teamId
        }
        pitchingRepository.save(entity)
        return entity
    }

    private fun getOrCreateFieldingStats(
        gameId: Long,
        playerId: Long,
    ): PlayerGameFieldingStatsEntity {
        val existing = fieldingRepository.findByGameIdAndPlayerId(gameId, playerId)
        if (existing != null) return existing
        val player = playerRepository.findById(playerId).orElse(null)
        val teamId = player?.teamId ?: 0L
        val entity = PlayerGameFieldingStatsEntity().apply {
            this.gameId = gameId
            this.playerId = playerId
            this.teamId = teamId
        }
        fieldingRepository.save(entity)
        return entity
    }

    private fun incrementFieldingStats(
        gameId: Long,
        playerId: Long,
        putouts: Int = 0,
        assists: Int = 0,
        errors: Int = 0,
    ) {
        val stats = getOrCreateFieldingStats(gameId, playerId)
        stats.putouts += putouts
        stats.assists += assists
        stats.errors += errors
        fieldingRepository.save(stats)
    }

    private fun getFielderIdByPosition(
        game: GameEntity,
        half: HalfInning,
        position: String,
    ): Long? {
        val defendingTeamId = if (half == HalfInning.TOP) game.homeTeamId else game.awayTeamId
        val defenders = playerRepository.findAllByTeamId(defendingTeamId)
        return defenders.find { it.position == position }?.id
            ?: defenders.firstOrNull()?.id
    }

    private fun getOrCreateInningRuns(
        gameId: Long,
        inning: Int,
    ): GameInningEntity {
        val existing = gameInningRepository.findByGameIdAndInning(gameId, inning)
        if (existing != null) return existing
        return gameInningRepository.save(GameInningEntity(gameId = gameId, inning = inning, awayRuns = 0, homeRuns = 0))
    }

    @Transactional(readOnly = true)
    fun getGameDomain(gameId: Long): Game {
        val game = gameRepository.findById(gameId).orElseThrow { IllegalArgumentException("Game not found: $gameId") }
        return mapGameToDomain(game)
    }

    private fun mapGameToDomain(game: GameEntity): Game {
        val homeTeam = teamRepository
            .findById(game.homeTeamId)
            .orElseThrow { IllegalArgumentException("Home Team not found: ${game.homeTeamId}") }
            .toDomain()
        val awayTeam = teamRepository
            .findById(game.awayTeamId)
            .orElseThrow { IllegalArgumentException("Away Team not found: ${game.awayTeamId}") }
            .toDomain()

        val runner1 = game.runnerFirstId?.let { playerRepository.findById(it).orElse(null)?.name }
        val runner2 = game.runnerSecondId?.let { playerRepository.findById(it).orElse(null)?.name }
        val runner3 = game.runnerThirdId?.let { playerRepository.findById(it).orElse(null)?.name }

        val batter = game.currentBatterId?.let { playerRepository.findById(it).orElse(null)?.name }
        val pitcher = game.currentPitcherId?.let { playerRepository.findById(it).orElse(null)?.name }

        return game.toDomain(
            homeTeam = homeTeam,
            awayTeam = awayTeam,
            names = GameRunnersDomainNames(
                runnerFirstName = runner1,
                runnerSecondName = runner2,
                runnerThirdName = runner3,
                currentBatterName = batter,
                currentPitcherName = pitcher,
            ),
        )
    }

    @Transactional(readOnly = true)
    fun getBoxScore(gameId: Long): BoxScore = boxScoreService.getBoxScore(gameId)

    @Transactional(readOnly = true)
    fun getSeasonDashboard(seasonId: Long): SeasonDashboard {
        val season = seasonRepository.findById(seasonId)
            .orElseThrow {
                IllegalArgumentException("Season not found: $seasonId")
            }
        val games = gameRepository.findAllBySeasonId(seasonId).map { mapGameToDomain(it) }
        val standings = standingsService.computeStandings(games, teamRepository.findAll())

        return SeasonDashboard(
            seasonId = seasonId,
            seasonName = season.name,
            standings = standings,
            games = games,
        )
    }

    @Transactional
    fun resetGame(gameId: Long): Game {
        val game = gameRepository.findById(gameId).orElseThrow { IllegalArgumentException("Game not found: $gameId") }

        playEventRepository.deleteAll(playEventRepository.findAllByGameIdOrderByTimestampAsc(gameId))
        gameInningRepository.deleteAll(gameInningRepository.findAllByGameIdOrderByInningAsc(gameId))
        battingRepository.deleteAll(battingRepository.findAllByGameId(gameId))
        pitchingRepository.deleteAll(pitchingRepository.findAllByGameId(gameId))
        fieldingRepository.deleteAll(fieldingRepository.findAllByGameId(gameId))

        game.status = GameStatus.SCHEDULED
        game.homeScore = 0
        game.awayScore = 0
        game.homeHits = 0
        game.awayHits = 0
        game.homeErrors = 0
        game.awayErrors = 0
        game.inning = 1
        game.half = HalfInning.TOP
        game.outs = 0
        game.balls = 0
        game.strikes = 0
        game.runnerFirstId = null
        game.runnerSecondId = null
        game.runnerThirdId = null
        game.currentBatterId = null
        game.currentPitcherId = null

        val saved = gameRepository.save(game)
        return mapGameToDomain(saved)
    }

    @Transactional(readOnly = true)
    fun getSeasonStats(seasonId: Long): SeasonStats = seasonStatsService.getSeasonStats(seasonId)
}

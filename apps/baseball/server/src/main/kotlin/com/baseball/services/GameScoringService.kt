package com.baseball.services

import com.baseball.entities.GameEntity
import com.baseball.entities.GameRunnersDomainNames
import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.models.HalfInning
import com.baseball.models.ScoringEventRequest
import com.baseball.models.SeasonDashboard
import com.baseball.models.SeasonStats
import com.baseball.repositories.GameInningRepository
import com.baseball.repositories.GameRepository
import com.baseball.repositories.PlayEventRepository
import com.baseball.repositories.PlayerGameBattingStatsRepository
import com.baseball.repositories.PlayerGameFieldingStatsRepository
import com.baseball.repositories.PlayerGamePitchingStatsRepository
import com.baseball.repositories.PlayerRepository
import com.baseball.repositories.SeasonRepository
import com.baseball.repositories.TeamRepository
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
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

    @Autowired
    var scoringLogicService: ScoringLogicService = ScoringLogicService()

    data class Repositories(
        val team: TeamRepository,
        val playEvent: PlayEventRepository,
        val batting: PlayerGameBattingStatsRepository,
        val pitching: PlayerGamePitchingStatsRepository,
        val season: SeasonRepository,
        val fielding: PlayerGameFieldingStatsRepository,
    )

    constructor(
        gameRepository: GameRepository,
        gameInningRepository: GameInningRepository,
        playerRepository: PlayerRepository,
        repos: Repositories,
    ) : this(gameRepository, gameInningRepository, playerRepository) {
        this.teamRepository = repos.team
        this.playEventRepository = repos.playEvent
        this.battingRepository = repos.batting
        this.pitchingRepository = repos.pitching
        this.seasonRepository = repos.season
        this.fieldingRepository = repos.fielding
        this.boxScoreService = BoxScoreService(
            gameRepository, repos.team, playerRepository,
            gameInningRepository, repos.batting, repos.pitching,
        )
        this.standingsService = StandingsService()
        this.seasonStatsService = SeasonStatsService(
            repos.season, gameRepository, playerRepository,
            repos.batting, repos.pitching, repos.fielding,
        )
    }


    private val recorder: GamePlayEventRecorder
        get() = GamePlayEventRecorder(
            EventRecorderRepositories(
                gameRepository,
                gameInningRepository,
                playerRepository,
                if (::teamRepository.isInitialized) teamRepository else null,
                if (::playEventRepository.isInitialized) playEventRepository else null,
                if (::battingRepository.isInitialized) battingRepository else null,
                if (::pitchingRepository.isInitialized) pitchingRepository else null,
                if (::fieldingRepository.isInitialized) fieldingRepository else null,
            ),
            scoringLogicService,
            ::mapGameToDomain,
        )

    fun recordPlayEvent(gameId: Long, request: ScoringEventRequest): Game =
        recorder.record(gameId, request)

    @Transactional(readOnly = true)
    fun getGameDomain(gameId: Long): Game {
        val game = gameRepository.findById(gameId).orElseThrow { IllegalArgumentException("Game not found: $gameId") }
        return mapGameToDomain(game)
    }

    private fun mapGameToDomain(game: GameEntity): Game {
        val homeTeam = teamRepository.findById(game.homeTeamId)
            .orElseThrow { IllegalArgumentException("Home Team not found: ${game.homeTeamId}") }.toDomain()
        val awayTeam = teamRepository.findById(game.awayTeamId)
            .orElseThrow { IllegalArgumentException("Away Team not found: ${game.awayTeamId}") }.toDomain()

        val runner1 = game.runnerFirstId?.let { playerRepository.findById(it).orElse(null)?.name }
        val runner2 = game.runnerSecondId?.let { playerRepository.findById(it).orElse(null)?.name }
        val runner3 = game.runnerThirdId?.let { playerRepository.findById(it).orElse(null)?.name }
        val batter = game.currentBatterId?.let { playerRepository.findById(it).orElse(null)?.name }
        val pitcher = game.currentPitcherId?.let { playerRepository.findById(it).orElse(null)?.name }

        return game.toDomain(
            homeTeam = homeTeam, awayTeam = awayTeam,
            names = GameRunnersDomainNames(
                runnerFirstName = runner1, runnerSecondName = runner2, runnerThirdName = runner3,
                currentBatterName = batter, currentPitcherName = pitcher,
            ),
        )
    }

    @Transactional(readOnly = true)
    fun getBoxScore(gameId: Long): BoxScore = boxScoreService.getBoxScore(gameId)

    @Transactional(readOnly = true)
    fun getSeasonDashboard(seasonId: Long): SeasonDashboard {
        val season = seasonRepository.findById(seasonId)
            .orElseThrow { IllegalArgumentException("Season not found: $seasonId") }
        val games = gameRepository.findAllBySeasonId(seasonId).map { mapGameToDomain(it) }
        val standings = standingsService.computeStandings(games, teamRepository.findAll())

        return SeasonDashboard(
            seasonId = seasonId, seasonName = season.name,
            standings = standings, games = games,
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
        game.homeScore = 0; game.awayScore = 0; game.homeHits = 0; game.awayHits = 0
        game.homeErrors = 0; game.awayErrors = 0; game.inning = 1; game.half = HalfInning.TOP
        game.outs = 0; game.balls = 0; game.strikes = 0
        game.runnerFirstId = null; game.runnerSecondId = null; game.runnerThirdId = null
        game.currentBatterId = null; game.currentPitcherId = null

        val saved = gameRepository.save(game)
        return mapGameToDomain(saved)
    }

    @Transactional(readOnly = true)
    fun getSeasonStats(seasonId: Long): SeasonStats = seasonStatsService.getSeasonStats(seasonId)
}

package com.baseball.controllers

import com.baseball.entities.GameEntity
import com.baseball.entities.LeagueEntity
import com.baseball.entities.PlayerEntity
import com.baseball.entities.SeasonEntity
import com.baseball.entities.TeamEntity
import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.models.League
import com.baseball.models.PlayEvent
import com.baseball.models.Player
import com.baseball.models.ScoringEventRequest
import com.baseball.models.Season
import com.baseball.models.SeasonDashboard
import com.baseball.models.SeasonStats
import com.baseball.models.Team
import com.baseball.repositories.GameRepository
import com.baseball.repositories.LeagueRepository
import com.baseball.repositories.PlayEventRepository
import com.baseball.repositories.PlayerRepository
import com.baseball.repositories.SeasonRepository
import com.baseball.repositories.TeamRepository
import com.baseball.services.GameScoringService
import org.springframework.web.bind.annotation.CrossOrigin
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

@RestController
@RequestMapping("/api/leagues")
@CrossOrigin(origins = ["*"])
class LeagueController(
    private val repository: LeagueRepository,
) {
    @GetMapping
    fun getAll(): List<League> = repository.findAll().map { it.toDomain() }

    @GetMapping("/{id}")
    fun getOne(
        @PathVariable id: Long,
    ): League = repository.findById(id).orElseThrow().toDomain()

    @PostMapping
    fun create(
        @RequestBody league: League,
    ): League {
        val entity = LeagueEntity(name = league.name)
        return repository.save(entity).toDomain()
    }

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: Long,
        @RequestBody league: League,
    ): League {
        val entity = repository.findById(id).orElseThrow()
        entity.name = league.name
        return repository.save(entity).toDomain()
    }

    @DeleteMapping("/{id}")
    fun delete(
        @PathVariable id: Long,
    ) = repository.deleteById(id)
}

@RestController
@RequestMapping("/api/seasons")
@CrossOrigin(origins = ["*"])
class SeasonController(
    private val repository: SeasonRepository,
    private val gameRepository: GameRepository,
    private val teamRepository: TeamRepository,
    private val scoringService: GameScoringService,
) {
    @GetMapping
    fun getAll(): List<Season> = repository.findAll().map { it.toDomain() }

    @GetMapping("/by-league/{leagueId}")
    fun getByLeague(
        @PathVariable leagueId: Long,
    ): List<Season> = repository.findAllByLeagueId(leagueId).map { it.toDomain() }

    @PostMapping
    fun create(
        @RequestBody season: Season,
    ): Season {
        val entity = SeasonEntity(leagueId = season.leagueId, name = season.name, year = season.year)
        return repository.save(entity).toDomain()
    }

    @GetMapping("/{id}/dashboard")
    fun getDashboard(
        @PathVariable id: Long,
    ): SeasonDashboard {
        val dash = scoringService.getSeasonDashboard(id)
        return dash.copy(games = dash.games.sortedWith(compareBy<Game> { it.date }.thenBy { it.id }))
    }

    @GetMapping("/{id}/stats")
    fun getStats(
        @PathVariable id: Long,
    ): SeasonStats = scoringService.getSeasonStats(id)

    @PostMapping("/{id}/generate-schedule")
    fun generateSchedule(
        @PathVariable id: Long,
    ): List<Game> {
        val teams = teamRepository.findAll()
        check(teams.size >= 2) { "Need at least 2 teams to generate a schedule" }

        val games = mutableListOf<GameEntity>()
        var date = LocalDate.now()

        // Generate round robin schedule (each team plays every other team once home and once away)
        for (i in teams.indices) {
            for (j in teams.indices) {
                if (i != j) {
                    val home = teams[i]
                    val away = teams[j]

                    val game =
                        GameEntity(
                            seasonId = id,
                            homeTeamId = home.id!!,
                            awayTeamId = away.id!!,
                            date = date.toString(),
                            status = GameStatus.SCHEDULED,
                        )
                    games.add(game)
                    date = date.plusDays(1)
                }
            }
        }

        gameRepository.saveAll(games)
        val dash = scoringService.getSeasonDashboard(id)
        return dash.games.sortedWith(compareBy<Game> { it.date }.thenBy { it.id })
    }
}

@RestController
@RequestMapping("/api/teams")
@CrossOrigin(origins = ["*"])
class TeamController(
    private val repository: TeamRepository,
    private val playerRepository: PlayerRepository,
) {
    @GetMapping
    fun getAll(): List<Team> = repository.findAll().map { it.toDomain() }

    @GetMapping("/{id}")
    fun getOne(
        @PathVariable id: Long,
    ): Team = repository.findById(id).orElseThrow().toDomain()

    @PostMapping
    fun create(
        @RequestBody team: Team,
    ): Team {
        val entity = TeamEntity(name = team.name, abbreviation = team.abbreviation, city = team.city)
        return repository.save(entity).toDomain()
    }

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: Long,
        @RequestBody team: Team,
    ): Team {
        val entity = repository.findById(id).orElseThrow()
        entity.name = team.name
        entity.abbreviation = team.abbreviation
        entity.city = team.city
        return repository.save(entity).toDomain()
    }

    @DeleteMapping("/{id}")
    fun delete(
        @PathVariable id: Long,
    ) = repository.deleteById(id)

    @GetMapping("/{id}/roster")
    fun getRoster(
        @PathVariable id: Long,
    ): List<Player> = playerRepository.findAllByTeamId(id).filter { !it.deleted }.map { it.toDomain() }
}

@RestController
@RequestMapping("/api/players")
@CrossOrigin(origins = ["*"])
class PlayerController(
    private val repository: PlayerRepository,
) {
    @GetMapping
    fun getAll(): List<Player> = repository.findAll().map { it.toDomain() }

    @GetMapping("/{id}")
    fun getOne(
        @PathVariable id: Long,
    ): Player = repository.findById(id).orElseThrow().toDomain()

    @PostMapping
    fun create(
        @RequestBody player: Player,
    ): Player {
        val entity =
            PlayerEntity(
                name = player.name,
                position = player.position,
                teamId = player.teamId,
                jerseyNumber = player.jerseyNumber,
                battingHand = player.battingHand,
            ).apply { throwingHand = player.throwingHand }
        return repository.save(entity).toDomain()
    }

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: Long,
        @RequestBody player: Player,
    ): Player {
        val entity = repository.findById(id).orElseThrow()
        entity.teamId = player.teamId
        entity.name = player.name
        entity.position = player.position
        entity.jerseyNumber = player.jerseyNumber
        entity.battingHand = player.battingHand
        entity.throwingHand = player.throwingHand
        return repository.save(entity).toDomain()
    }

    @DeleteMapping("/{id}")
    fun delete(
        @PathVariable id: Long,
    ) {
        val entity = repository.findById(id).orElseThrow()
        entity.teamId = null
        entity.deleted = true
        repository.save(entity)
    }
}

@RestController
@RequestMapping("/api/games")
@CrossOrigin(origins = ["*"])
class GameController(
    private val repository: GameRepository,
    private val scoringService: GameScoringService,
    private val playEventRepository: PlayEventRepository,
) {
    @GetMapping("/{id}")
    fun getOne(
        @PathVariable id: Long,
    ): Game = scoringService.getGameDomain(id)

    @PostMapping
    fun create(
        @RequestBody game: Game,
    ): Game {
        val entity =
            GameEntity(
                seasonId = game.seasonId,
                homeTeamId = game.homeTeam.id!!,
                awayTeamId = game.awayTeam.id!!,
                date = game.date,
                status = GameStatus.SCHEDULED,
            )
        val saved = repository.save(entity)
        return scoringService.getGameDomain(saved.id!!)
    }

    @PostMapping("/{id}/event")
    fun recordEvent(
        @PathVariable id: Long,
        @RequestBody request: ScoringEventRequest,
    ): Game = scoringService.recordPlayEvent(id, request)

    @GetMapping("/{id}/boxscore")
    fun getBoxScore(
        @PathVariable id: Long,
    ): BoxScore = scoringService.getBoxScore(id)

    @GetMapping("/{id}/events")
    fun getEvents(
        @PathVariable id: Long,
    ): List<PlayEvent> = playEventRepository.findAllByGameIdOrderByTimestampAsc(id).map { it.toDomain() }

    @PostMapping("/{id}/reset")
    fun resetGame(
        @PathVariable id: Long,
    ): Game = scoringService.resetGame(id)

    @PostMapping("/{id}/start")
    fun startGame(
        @PathVariable id: Long,
    ): Game {
        val game = repository.findById(id).orElseThrow()
        game.status = GameStatus.IN_PROGRESS
        repository.save(game)
        return scoringService.getGameDomain(id)
    }
}

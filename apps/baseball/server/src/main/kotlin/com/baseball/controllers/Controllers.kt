package com.baseball.controllers

import com.baseball.entities.*
import com.baseball.models.*
import com.baseball.repositories.*
import com.baseball.services.GameScoringService
import org.springframework.web.bind.annotation.*
import java.time.LocalDate

@RestController
@RequestMapping("/api/leagues")
@CrossOrigin(origins = ["*"])
class LeagueController(private val repository: LeagueRepository) {

    @GetMapping
    fun getAll(): List<League> = repository.findAll().map { it.toDomain() }

    @GetMapping("/{id}")
    fun getOne(@PathVariable id: Long): League = repository.findById(id).orElseThrow().toDomain()

    @PostMapping
    fun create(@RequestBody league: League): League {
        val entity = LeagueEntity(name = league.name)
        return repository.save(entity).toDomain()
    }

    @PutMapping("/{id}")
    fun update(@PathVariable id: Long, @RequestBody league: League): League {
        val entity = repository.findById(id).orElseThrow()
        entity.name = league.name
        return repository.save(entity).toDomain()
    }

    @DeleteMapping("/{id}")
    fun delete(@PathVariable id: Long) = repository.deleteById(id)
}

@RestController
@RequestMapping("/api/seasons")
@CrossOrigin(origins = ["*"])
class SeasonController(
    private val repository: SeasonRepository,
    private val gameRepository: GameRepository,
    private val teamRepository: TeamRepository,
    private val scoringService: GameScoringService
) {

    @GetMapping
    fun getAll(): List<Season> = repository.findAll().map { it.toDomain() }

    @GetMapping("/by-league/{leagueId}")
    fun getByLeague(@PathVariable leagueId: Long): List<Season> =
        repository.findAllByLeagueId(leagueId).map { it.toDomain() }

    @PostMapping
    fun create(@RequestBody season: Season): Season {
        val entity = SeasonEntity(leagueId = season.leagueId, name = season.name, year = season.year)
        return repository.save(entity).toDomain()
    }

    @GetMapping("/{id}/dashboard")
    fun getDashboard(@PathVariable id: Long): SeasonDashboard {
        val dash = scoringService.getSeasonDashboard(id)
        return dash.copy(games = dash.games.sortedWith(compareBy<Game> { it.date }.thenBy { it.id }))
    }

    @GetMapping("/{id}/stats")
    fun getStats(@PathVariable id: Long): SeasonStats = scoringService.getSeasonStats(id)

    @PostMapping("/{id}/generate-schedule")
    fun generateSchedule(@PathVariable id: Long): List<Game> {
        val teams = teamRepository.findAll()
        if (teams.size < 2) throw IllegalStateException("Need at least 2 teams to generate a schedule")
        
        val games = mutableListOf<GameEntity>()
        var date = LocalDate.now()

        // Generate round robin schedule (each team plays every other team once home and once away)
        for (i in 0 until teams.size) {
            for (j in 0 until teams.size) {
                if (i != j) {
                    val home = teams[i]
                    val away = teams[j]
                    
                    val game = GameEntity(
                        seasonId = id,
                        homeTeamId = home.id!!,
                        awayTeamId = away.id!!,
                        date = date.toString(),
                        status = GameStatus.SCHEDULED
                    )
                    games.add(game)
                    date = date.plusDays(1) // increment day
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
    private val playerRepository: PlayerRepository
) {

    @GetMapping
    fun getAll(): List<Team> = repository.findAll().map { it.toDomain() }

    @GetMapping("/{id}")
    fun getOne(@PathVariable id: Long): Team = repository.findById(id).orElseThrow().toDomain()

    @PostMapping
    fun create(@RequestBody team: Team): Team {
        val entity = TeamEntity(name = team.name, abbreviation = team.abbreviation, city = team.city)
        return repository.save(entity).toDomain()
    }

    @PutMapping("/{id}")
    fun update(@PathVariable id: Long, @RequestBody team: Team): Team {
        val entity = repository.findById(id).orElseThrow()
        entity.name = team.name
        entity.abbreviation = team.abbreviation
        entity.city = team.city
        return repository.save(entity).toDomain()
    }

    @DeleteMapping("/{id}")
    fun delete(@PathVariable id: Long) = repository.deleteById(id)
    
    @GetMapping("/{id}/roster")
    fun getRoster(@PathVariable id: Long): List<Player> =
        playerRepository.findAllByTeamId(id).filter { !it.deleted }.map { it.toDomain() }
}

@RestController
@RequestMapping("/api/players")
@CrossOrigin(origins = ["*"])
class PlayerController(private val repository: PlayerRepository) {

    @GetMapping
    fun getAll(): List<Player> = repository.findAll().map { it.toDomain() }

    @GetMapping("/{id}")
    fun getOne(@PathVariable id: Long): Player = repository.findById(id).orElseThrow().toDomain()

    @PostMapping
    fun create(@RequestBody player: Player): Player {
        val entity = PlayerEntity(
            teamId = player.teamId,
            name = player.name,
            position = player.position,
            jerseyNumber = player.jerseyNumber,
            battingHand = player.battingHand,
            throwingHand = player.throwingHand
        )
        return repository.save(entity).toDomain()
    }

    @PutMapping("/{id}")
    fun update(@PathVariable id: Long, @RequestBody player: Player): Player {
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
    fun delete(@PathVariable id: Long) {
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
    private val playEventRepository: PlayEventRepository
) {

    @GetMapping("/{id}")
    fun getOne(@PathVariable id: Long): Game = scoringService.getGameDomain(id)

    @PostMapping
    fun create(@RequestBody game: Game): Game {
        val entity = GameEntity(
            seasonId = game.seasonId,
            homeTeamId = game.homeTeam.id!!,
            awayTeamId = game.awayTeam.id!!,
            date = game.date,
            status = GameStatus.SCHEDULED
        )
        val saved = repository.save(entity)
        return scoringService.getGameDomain(saved.id!!)
    }

    @PostMapping("/{id}/event")
    fun recordEvent(@PathVariable id: Long, @RequestBody request: ScoringEventRequest): Game {
        return scoringService.recordPlayEvent(id, request)
    }

    @GetMapping("/{id}/boxscore")
    fun getBoxScore(@PathVariable id: Long): BoxScore = scoringService.getBoxScore(id)

    @GetMapping("/{id}/events")
    fun getEvents(@PathVariable id: Long): List<PlayEvent> =
        playEventRepository.findAllByGameIdOrderByTimestampAsc(id).map { it.toDomain() }

    @PostMapping("/{id}/reset")
    fun resetGame(@PathVariable id: Long): Game {
        return scoringService.resetGame(id)
    }
}

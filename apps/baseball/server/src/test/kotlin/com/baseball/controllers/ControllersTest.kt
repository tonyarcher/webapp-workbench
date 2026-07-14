package com.baseball.controllers

import com.baseball.entities.*
import com.baseball.models.*
import com.baseball.repositories.*
import com.baseball.services.GameScoringService
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.*
import java.util.*

class ControllersTest {

    // --- LEAGUE ---
    @Test
    fun testLeagueController() {
        val repo = mock(LeagueRepository::class.java)
        val controller = LeagueController(repo)

        val entity = LeagueEntity(id = 1L, name = "MLB")
        `when`(repo.findAll()).thenReturn(listOf(entity))
        `when`(repo.findById(1L)).thenReturn(Optional.of(entity))
        `when`(repo.save(any(LeagueEntity::class.java))).thenReturn(entity)

        // getAll
        val all = controller.getAll()
        assertEquals(1, all.size)
        assertEquals("MLB", all[0].name)

        // getOne
        val one = controller.getOne(1L)
        assertEquals("MLB", one.name)

        // create
        val created = controller.create(League(1L, "MLB"))
        assertEquals("MLB", created.name)

        // update
        val updated = controller.update(1L, League(1L, "MLB New"))
        assertEquals("MLB New", updated.name)

        // delete
        controller.delete(1L)
        verify(repo, times(1)).deleteById(1L)
    }

    // --- SEASON ---
    @Test
    fun testSeasonController() {
        val repo = mock(SeasonRepository::class.java)
        val gameRepo = mock(GameRepository::class.java)
        val teamRepo = mock(TeamRepository::class.java)
        val scoringService = mock(GameScoringService::class.java)
        val controller = SeasonController(repo, gameRepo, teamRepo, scoringService)

        val entity = SeasonEntity(id = 1L, leagueId = 10L, name = "2026", year = 2026)
        `when`(repo.findAll()).thenReturn(listOf(entity))
        `when`(repo.findAllByLeagueId(10L)).thenReturn(listOf(entity))
        `when`(repo.save(any(SeasonEntity::class.java))).thenReturn(entity)

        // getAll
        assertEquals(1, controller.getAll().size)

        // getByLeague
        assertEquals(1, controller.getByLeague(10L).size)

        // create
        val created = controller.create(Season(1L, 10L, "2026", 2026))
        assertEquals("2026", created.name)

        // getDashboard
        val mockDashboard = SeasonDashboard(1L, "2026", emptyList<TeamStandings>(), emptyList<Game>())
        `when`(scoringService.getSeasonDashboard(1L)).thenReturn(mockDashboard)
        assertEquals(mockDashboard, controller.getDashboard(1L))
    }

    @Test
    fun testSeasonControllerGenerateScheduleException() {
        val repo = mock(SeasonRepository::class.java)
        val gameRepo = mock(GameRepository::class.java)
        val teamRepo = mock(TeamRepository::class.java)
        val scoringService = mock(GameScoringService::class.java)
        val controller = SeasonController(repo, gameRepo, teamRepo, scoringService)

        `when`(teamRepo.findAll()).thenReturn(listOf(TeamEntity(id = 1L, name = "Cubs")))

        assertThrows(IllegalStateException::class.java) {
            controller.generateSchedule(1L)
        }
    }

    @Test
    fun testSeasonControllerGenerateScheduleSuccess() {
        val repo = mock(SeasonRepository::class.java)
        val gameRepo = mock(GameRepository::class.java)
        val teamRepo = mock(TeamRepository::class.java)
        val scoringService = mock(GameScoringService::class.java)
        val controller = SeasonController(repo, gameRepo, teamRepo, scoringService)

        val team1 = TeamEntity(id = 1L, name = "Cubs")
        val team2 = TeamEntity(id = 2L, name = "Cards")
        `when`(teamRepo.findAll()).thenReturn(listOf(team1, team2))

        val mockDashboard = SeasonDashboard(1L, "2026", emptyList<TeamStandings>(), emptyList<Game>())
        `when`(scoringService.getSeasonDashboard(1L)).thenReturn(mockDashboard)

        val result = controller.generateSchedule(1L)
        assertNotNull(result)
        verify(gameRepo, times(1)).saveAll(anyList())
    }

    // --- TEAM ---
    @Test
    fun testTeamController() {
        val repo = mock(TeamRepository::class.java)
        val playerRepo = mock(PlayerRepository::class.java)
        val controller = TeamController(repo, playerRepo)

        val entity = TeamEntity(id = 1L, name = "Cubs", abbreviation = "CHC", city = "Chicago")
        `when`(repo.findAll()).thenReturn(listOf(entity))
        `when`(repo.findById(1L)).thenReturn(Optional.of(entity))
        `when`(repo.save(any(TeamEntity::class.java))).thenReturn(entity)

        // getAll
        assertEquals(1, controller.getAll().size)

        // getOne
        assertEquals("Cubs", controller.getOne(1L).name)

        // create
        val created = controller.create(Team(1L, "Cubs", "CHC", "Chicago"))
        assertEquals("Cubs", created.name)

        // update
        val updated = controller.update(1L, Team(1L, "Cubs New", "CHC", "Chicago"))
        assertEquals("Cubs New", updated.name)

        // delete
        controller.delete(1L)
        verify(repo, times(1)).deleteById(1L)

        // getRoster
        `when`(playerRepo.findAllByTeamId(1L)).thenReturn(listOf(PlayerEntity(id = 5L, name = "Suzuki", position = "RF", teamId = 1L)))
        val roster = controller.getRoster(1L)
        assertEquals(1, roster.size)
        assertEquals("Suzuki", roster[0].name)
    }

    // --- PLAYER ---
    @Test
    fun testPlayerController() {
        val repo = mock(PlayerRepository::class.java)
        val controller = PlayerController(repo)

        val entity = PlayerEntity(id = 1L, name = "Happ", position = "LF", teamId = 10L, jerseyNumber = 14)
        `when`(repo.findAll()).thenReturn(listOf(entity))
        `when`(repo.findById(1L)).thenReturn(Optional.of(entity))
        `when`(repo.save(any(PlayerEntity::class.java))).thenReturn(entity)

        // getAll
        assertEquals(1, controller.getAll().size)

        // getOne
        assertEquals("Happ", controller.getOne(1L).name)

        // create
        val created = controller.create(Player(1L, 10L, "Happ", "LF", 14, "R", "R"))
        assertEquals("Happ", created.name)

        // update
        val updated = controller.update(1L, Player(1L, 10L, "Happ New", "LF", 14, "R", "R"))
        assertEquals("Happ New", updated.name)

        // delete
        controller.delete(1L)
        verify(repo, times(1)).deleteById(1L)
    }

    // --- GAME ---
    @Test
    fun testGameController() {
        val repo = mock(GameRepository::class.java)
        val scoringService = mock(GameScoringService::class.java)
        val playEventRepo = mock(PlayEventRepository::class.java)
        val teamRepo = mock(TeamRepository::class.java)
        val controller = GameController(repo, scoringService, playEventRepo, teamRepo)

        val mockTeam = Team(100L, "Cubs", "CHC", "Chicago")
        val mockGame = Game(
            id = 1L,
            seasonId = 10L,
            homeTeam = mockTeam,
            awayTeam = mockTeam,
            date = "2026-07-14",
            status = GameStatus.SCHEDULED,
            awayScore = 0,
            homeScore = 0,
            awayHits = 0,
            homeHits = 0,
            awayErrors = 0,
            homeErrors = 0,
            gameState = GameState()
        )
        `when`(scoringService.getGameDomain(1L)).thenReturn(mockGame)

        // getOne
        assertEquals(mockGame, controller.getOne(1L))

        // create
        val gameEntity = GameEntity(id = 1L, seasonId = 10L, homeTeamId = 100L, awayTeamId = 100L, date = "2026-07-14")
        `when`(repo.save(any(GameEntity::class.java))).thenReturn(gameEntity)
        val created = controller.create(mockGame)
        assertEquals(mockGame, created)

        // recordEvent
        val request = ScoringEventRequest(ScoringEventType.SINGLE, 2L, 3L)
        `when`(scoringService.recordPlayEvent(1L, request)).thenReturn(mockGame)
        assertEquals(mockGame, controller.recordEvent(1L, request))

        // getBoxScore
        val mockBoxScore = BoxScore(
            gameId = 1L,
            homeTeamName = "Cubs",
            awayTeamName = "Cards",
            lineScore = LineScore(1L, emptyList<Int?>(), emptyList<Int?>(), 0, 0, 0, 0, 0, 0),
            homeBatting = emptyList<PlayerBattingStats>(),
            awayBatting = emptyList<PlayerBattingStats>(),
            homePitching = emptyList<PlayerPitchingStats>(),
            awayPitching = emptyList<PlayerPitchingStats>()
        )
        `when`(scoringService.getBoxScore(1L)).thenReturn(mockBoxScore)
        assertEquals(mockBoxScore, controller.getBoxScore(1L))

        // getEvents
        val playEntity = PlayEventEntity(id = 5L, gameId = 1L, batterName = "Happ", pitcherName = "Steele")
        `when`(playEventRepo.findAllByGameIdOrderByTimestampAsc(1L)).thenReturn(listOf(playEntity))
        val events = controller.getEvents(1L)
        assertEquals(1, events.size)
        assertEquals("Happ", events[0].batterName)
    }
}

package com.baseball

import com.baseball.entities.*
import com.baseball.models.GameStatus
import com.baseball.models.HalfInning
import com.baseball.models.ScoringEventRequest
import com.baseball.models.ScoringEventType
import com.baseball.repositories.*
import com.baseball.services.GameScoringService
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.*
import java.util.*

class GameScoringServiceTest {
    private lateinit var gameRepository: GameRepository
    private lateinit var gameInningRepository: GameInningRepository
    private lateinit var playerRepository: PlayerRepository
    private lateinit var teamRepository: TeamRepository
    private lateinit var playEventRepository: PlayEventRepository
    private lateinit var battingRepository: PlayerGameBattingStatsRepository
    private lateinit var pitchingRepository: PlayerGamePitchingStatsRepository
    private lateinit var seasonRepository: SeasonRepository
    private lateinit var fieldingRepository: PlayerGameFieldingStatsRepository

    private lateinit var scoringService: GameScoringService

    @BeforeEach
    fun setup() {
        gameRepository = mock(GameRepository::class.java)
        gameInningRepository = mock(GameInningRepository::class.java)
        playerRepository = mock(PlayerRepository::class.java)
        teamRepository = mock(TeamRepository::class.java)
        playEventRepository = mock(PlayEventRepository::class.java)
        battingRepository = mock(PlayerGameBattingStatsRepository::class.java)
        pitchingRepository = mock(PlayerGamePitchingStatsRepository::class.java)
        seasonRepository = mock(SeasonRepository::class.java)
        fieldingRepository = mock(PlayerGameFieldingStatsRepository::class.java)

        scoringService =
            GameScoringService(
                gameRepository,
                gameInningRepository,
                playerRepository,
                teamRepository,
                playEventRepository,
                battingRepository,
                pitchingRepository,
                seasonRepository,
                fieldingRepository,
            )
    }

    @Test
    fun testRecordPlayEventExceptions() {
        `when`(gameRepository.findById(1L)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) {
            scoringService.recordPlayEvent(1L, ScoringEventRequest(ScoringEventType.SINGLE, 2L, 3L))
        }

        val completedGame = GameEntity(id = 1L, status = GameStatus.COMPLETED)
        `when`(gameRepository.findById(1L)).thenReturn(Optional.of(completedGame))
        assertThrows(IllegalStateException::class.java) {
            scoringService.recordPlayEvent(1L, ScoringEventRequest(ScoringEventType.SINGLE, 2L, 3L))
        }

        val inProgressGame = GameEntity(id = 1L, status = GameStatus.IN_PROGRESS)
        `when`(gameRepository.findById(1L)).thenReturn(Optional.of(inProgressGame))
        `when`(playerRepository.findById(2L)).thenReturn(Optional.empty())
        assertThrows(IllegalArgumentException::class.java) {
            scoringService.recordPlayEvent(1L, ScoringEventRequest(ScoringEventType.SINGLE, 2L, 3L))
        }
    }

    @Test
    fun testRecordSingleEvent() {
        val gameId = 1L
        val batterId = 2L
        val pitcherId = 3L

        val gameEntity =
            GameEntity(
                id = gameId,
                seasonId = 10L,
                homeTeamId = 100L,
                awayTeamId = 200L,
                status = GameStatus.SCHEDULED,
                awayScore = 0,
                homeScore = 0,
                awayHits = 0,
                homeHits = 0,
            )

        val batter = PlayerEntity(id = batterId, name = "John Batter", position = "LF", teamId = 200L)
        val pitcher = PlayerEntity(id = pitcherId, name = "Jim Pitcher", position = "P", teamId = 100L)

        `when`(gameRepository.findById(gameId)).thenReturn(Optional.of(gameEntity))
        `when`(playerRepository.findById(batterId)).thenReturn(Optional.of(batter))
        `when`(playerRepository.findById(pitcherId)).thenReturn(Optional.of(pitcher))

        `when`(teamRepository.findById(100L)).thenReturn(Optional.of(TeamEntity(100L, "Cardinals", "STL", "St. Louis")))
        `when`(teamRepository.findById(200L)).thenReturn(Optional.of(TeamEntity(200L, "Cubs", "CHC", "Chicago")))

        `when`(battingRepository.findByGameIdAndPlayerId(gameId, batterId)).thenReturn(null)
        `when`(pitchingRepository.findByGameIdAndPlayerId(gameId, pitcherId)).thenReturn(null)

        `when`(gameRepository.save(any(GameEntity::class.java))).thenAnswer { it.getArgument(0) }
        `when`(battingRepository.save(any(PlayerGameBattingStatsEntity::class.java))).thenAnswer { it.getArgument(0) }
        `when`(pitchingRepository.save(any(PlayerGamePitchingStatsEntity::class.java))).thenAnswer { it.getArgument(0) }

        val request =
            ScoringEventRequest(
                eventType = ScoringEventType.SINGLE,
                batterId = batterId,
                pitcherId = pitcherId,
            )
        val updatedGame = scoringService.recordPlayEvent(gameId, request)

        assertNotNull(updatedGame)
        assertEquals(1, updatedGame.awayHits)
        assertEquals(batterId, updatedGame.gameState.runnerFirstId)
        assertEquals(0, updatedGame.gameState.balls)
        assertEquals(0, updatedGame.gameState.strikes)
        assertEquals(GameStatus.IN_PROGRESS, gameEntity.status)
    }

    @Test
    fun testBallIncrementsAndWalk() {
        val gameId = 1L
        val batterId = 2L
        val pitcherId = 3L
        val gameEntity =
            GameEntity(
                id = gameId,
                homeTeamId = 100L,
                awayTeamId = 200L,
                balls = 3,
                strikes = 1,
            )
        val batter = PlayerEntity(id = batterId, name = "Batter", teamId = 200L)
        val pitcher = PlayerEntity(id = pitcherId, name = "Pitcher", teamId = 100L)

        `when`(gameRepository.findById(gameId)).thenReturn(Optional.of(gameEntity))
        `when`(playerRepository.findById(batterId)).thenReturn(Optional.of(batter))
        `when`(playerRepository.findById(pitcherId)).thenReturn(Optional.of(pitcher))
        `when`(teamRepository.findById(100L)).thenReturn(Optional.of(TeamEntity(100L, "Cards", "STL", "St. Louis")))
        `when`(teamRepository.findById(200L)).thenReturn(Optional.of(TeamEntity(200L, "Cubs", "CHC", "Chicago")))

        `when`(gameRepository.save(any(GameEntity::class.java))).thenAnswer { it.getArgument(0) }

        val updatedGame = scoringService.recordPlayEvent(gameId, ScoringEventRequest(ScoringEventType.BALL, batterId, pitcherId))
        assertEquals(0, updatedGame.gameState.balls)
        assertEquals(batterId, updatedGame.gameState.runnerFirstId)
    }

    @Test
    fun testStrikeoutAndFoul() {
        val gameId = 1L
        val batterId = 2L
        val pitcherId = 3L
        val gameEntity =
            GameEntity(
                id = gameId,
                homeTeamId = 100L,
                awayTeamId = 200L,
                balls = 1,
                strikes = 1,
            )
        val batter = PlayerEntity(id = batterId, name = "Batter", teamId = 200L)
        val pitcher = PlayerEntity(id = pitcherId, name = "Pitcher", teamId = 100L)

        `when`(gameRepository.findById(gameId)).thenReturn(Optional.of(gameEntity))
        `when`(playerRepository.findById(batterId)).thenReturn(Optional.of(batter))
        `when`(playerRepository.findById(pitcherId)).thenReturn(Optional.of(pitcher))
        `when`(teamRepository.findById(100L)).thenReturn(Optional.of(TeamEntity(100L, "Cards", "STL", "St. Louis")))
        `when`(teamRepository.findById(200L)).thenReturn(Optional.of(TeamEntity(200L, "Cubs", "CHC", "Chicago")))
        `when`(gameRepository.save(any(GameEntity::class.java))).thenAnswer { it.getArgument(0) }

        // Foul first (strikes should become 2)
        var updated = scoringService.recordPlayEvent(gameId, ScoringEventRequest(ScoringEventType.FOUL, batterId, pitcherId))
        assertEquals(2, updated.gameState.strikes)

        // Another foul (strikes should stay 2)
        updated = scoringService.recordPlayEvent(gameId, ScoringEventRequest(ScoringEventType.FOUL, batterId, pitcherId))
        assertEquals(2, updated.gameState.strikes)

        // Strike 3
        updated = scoringService.recordPlayEvent(gameId, ScoringEventRequest(ScoringEventType.STRIKE, batterId, pitcherId))
        assertEquals(0, updated.gameState.strikes)
        assertEquals(1, updated.gameState.outs)
    }

    @Test
    fun testSacFlyAndErrors() {
        val gameId = 1L
        val batterId = 2L
        val pitcherId = 3L
        val gameEntity =
            GameEntity(
                id = gameId,
                homeTeamId = 100L,
                awayTeamId = 200L,
                runnerThirdId = 4L,
                half = HalfInning.TOP,
            )
        val batter = PlayerEntity(id = batterId, name = "Batter", teamId = 200L)
        val pitcher = PlayerEntity(id = pitcherId, name = "Pitcher", teamId = 100L)

        `when`(gameRepository.findById(gameId)).thenReturn(Optional.of(gameEntity))
        `when`(playerRepository.findById(batterId)).thenReturn(Optional.of(batter))
        `when`(playerRepository.findById(pitcherId)).thenReturn(Optional.of(pitcher))
        `when`(playerRepository.findById(4L)).thenReturn(Optional.of(PlayerEntity(id = 4L, name = "Runner", teamId = 200L)))
        `when`(teamRepository.findById(100L)).thenReturn(Optional.of(TeamEntity(100L, "Cards", "STL", "St. Louis")))
        `when`(teamRepository.findById(200L)).thenReturn(Optional.of(TeamEntity(200L, "Cubs", "CHC", "Chicago")))
        `when`(gameRepository.save(any(GameEntity::class.java))).thenAnswer { it.getArgument(0) }
        `when`(gameInningRepository.findByGameIdAndInning(anyLong(), anyInt())).thenReturn(GameInningEntity(1, 0, 0))

        // Sac Fly
        var updated = scoringService.recordPlayEvent(gameId, ScoringEventRequest(ScoringEventType.SACRIFICE_FLY, batterId, pitcherId))
        assertNull(updated.gameState.runnerThirdId)
        assertEquals(1, updated.awayScore)

        // Reached on Error
        updated = scoringService.recordPlayEvent(gameId, ScoringEventRequest(ScoringEventType.ERROR, batterId, pitcherId))
        assertEquals(1, gameEntity.homeErrors)
    }

    @Test
    fun testCustomRunnerAdvanceMap() {
        val gameId = 1L
        val batterId = 2L
        val pitcherId = 3L
        val gameEntity =
            GameEntity(
                id = gameId,
                homeTeamId = 100L,
                awayTeamId = 200L,
                runnerFirstId = 4L,
                runnerSecondId = 5L,
            )
        val batter = PlayerEntity(id = batterId, name = "Batter", teamId = 200L)
        val pitcher = PlayerEntity(id = pitcherId, name = "Pitcher", teamId = 100L)

        `when`(gameRepository.findById(gameId)).thenReturn(Optional.of(gameEntity))
        `when`(playerRepository.findById(batterId)).thenReturn(Optional.of(batter))
        `when`(playerRepository.findById(pitcherId)).thenReturn(Optional.of(pitcher))
        `when`(playerRepository.findById(4L)).thenReturn(Optional.of(PlayerEntity(id = 4L, name = "R1", teamId = 200L)))
        `when`(playerRepository.findById(5L)).thenReturn(Optional.of(PlayerEntity(id = 5L, name = "R2", teamId = 200L)))
        `when`(teamRepository.findById(100L)).thenReturn(Optional.of(TeamEntity(100L, "Cards", "STL", "St. Louis")))
        `when`(teamRepository.findById(200L)).thenReturn(Optional.of(TeamEntity(200L, "Cubs", "CHC", "Chicago")))
        `when`(gameRepository.save(any(GameEntity::class.java))).thenAnswer { it.getArgument(0) }
        `when`(gameInningRepository.findByGameIdAndInning(anyLong(), anyInt())).thenReturn(GameInningEntity(1, 0, 0))

        val advanceMap =
            mapOf(
                "4" to 3, // R1 to 3B
                "5" to 4, // R2 scores
                "2" to 2, // Batter to 2B
            )
        val request =
            ScoringEventRequest(
                eventType = ScoringEventType.DOUBLE,
                batterId = batterId,
                pitcherId = pitcherId,
                runnerAdvanceMap = advanceMap,
            )
        val updated = scoringService.recordPlayEvent(gameId, request)
        assertEquals(batterId, updated.gameState.runnerSecondId)
        assertEquals(4L, updated.gameState.runnerThirdId)
        assertNull(updated.gameState.runnerFirstId)
    }

    @Test
    fun testInningAndGameTransitions() {
        val gameId = 1L
        val batterId = 2L
        val pitcherId = 3L
        val gameEntity =
            GameEntity(
                id = gameId,
                homeTeamId = 100L,
                awayTeamId = 200L,
                outs = 2,
                inning = 9,
                half = HalfInning.TOP,
                awayScore = 2,
                homeScore = 3,
            )
        val batter = PlayerEntity(id = batterId, name = "Batter", teamId = 200L)
        val pitcher = PlayerEntity(id = pitcherId, name = "Pitcher", teamId = 100L)

        `when`(gameRepository.findById(gameId)).thenReturn(Optional.of(gameEntity))
        `when`(playerRepository.findById(batterId)).thenReturn(Optional.of(batter))
        `when`(playerRepository.findById(pitcherId)).thenReturn(Optional.of(pitcher))
        `when`(teamRepository.findById(100L)).thenReturn(Optional.of(TeamEntity(100L, "Cards", "STL", "St. Louis")))
        `when`(teamRepository.findById(200L)).thenReturn(Optional.of(TeamEntity(200L, "Cubs", "CHC", "Chicago")))
        `when`(gameRepository.save(any(GameEntity::class.java))).thenAnswer { it.getArgument(0) }
        `when`(
            gameInningRepository.findByGameIdAndInning(anyLong(), anyInt()),
        ).thenReturn(GameInningEntity(inning = 9, awayRuns = 0, homeRuns = 0))
        `when`(gameInningRepository.save(any(GameInningEntity::class.java))).thenAnswer { it.getArgument(0) }

        val request =
            ScoringEventRequest(
                eventType = ScoringEventType.STRIKEOUT,
                batterId = batterId,
                pitcherId = pitcherId,
            )
        val updated = scoringService.recordPlayEvent(gameId, request)
        assertEquals(GameStatus.COMPLETED, updated.status)
    }

    @Test
    fun testGetBoxScoreAndGameDomain() {
        val gameId = 1L
        val gameEntity =
            GameEntity(
                id = gameId,
                homeTeamId = 100L,
                awayTeamId = 200L,
                awayScore = 1,
                homeScore = 2,
                awayHits = 5,
                homeHits = 7,
                runnerFirstId = 40L,
                runnerSecondId = 50L,
                runnerThirdId = 60L,
                currentBatterId = 70L,
                currentPitcherId = 80L,
            )
        `when`(gameRepository.findById(gameId)).thenReturn(Optional.of(gameEntity))
        `when`(teamRepository.findById(100L)).thenReturn(Optional.of(TeamEntity(100L, "Cards", "STL", "St. Louis")))
        `when`(teamRepository.findById(200L)).thenReturn(Optional.of(TeamEntity(200L, "Cubs", "CHC", "Chicago")))

        val player1 = PlayerEntity(id = 40L, name = "First Runner", teamId = 200L)
        val player2 = PlayerEntity(id = 50L, name = "Second Runner", teamId = 200L)
        val player3 = PlayerEntity(id = 60L, name = "Third Runner", teamId = 200L)
        val player4 = PlayerEntity(id = 70L, name = "Batter", teamId = 200L)
        val player5 = PlayerEntity(id = 80L, name = "Pitcher", teamId = 100L)

        `when`(playerRepository.findById(40L)).thenReturn(Optional.of(player1))
        `when`(playerRepository.findById(50L)).thenReturn(Optional.of(player2))
        `when`(playerRepository.findById(60L)).thenReturn(Optional.of(player3))
        `when`(playerRepository.findById(70L)).thenReturn(Optional.of(player4))
        `when`(playerRepository.findById(80L)).thenReturn(Optional.of(player5))

        `when`(gameInningRepository.findAllByGameIdOrderByInningAsc(gameId)).thenReturn(
            listOf(
                GameInningEntity(
                    1,
                    0,
                    1,
                ),
            ),
        )

        val batting1 = PlayerGameBattingStatsEntity(playerId = 70L, atBats = 2, hits = 1)
        val pitching1 = PlayerGamePitchingStatsEntity(playerId = 80L, runsAllowed = 1)

        `when`(battingRepository.findAllByGameId(gameId)).thenReturn(listOf(batting1))
        `when`(pitchingRepository.findAllByGameId(gameId)).thenReturn(listOf(pitching1))

        val boxScore = scoringService.getBoxScore(gameId)
        assertEquals("Cards", boxScore.homeTeamName)
        assertEquals("Cubs", boxScore.awayTeamName)
        assertEquals(1, boxScore.awayBatting.size)
        assertEquals(1, boxScore.homePitching.size)

        val domain = scoringService.getGameDomain(gameId)
        assertEquals(gameId, domain.id)
        assertEquals("First Runner", domain.gameState.runnerFirstName)
    }

    @Test
    fun testGetSeasonDashboard() {
        val seasonId = 1L
        val seasonEntity = SeasonEntity(id = seasonId, leagueId = 10L, name = "2026", year = 2026)
        `when`(seasonRepository.findById(seasonId)).thenReturn(Optional.of(seasonEntity))

        val game1 =
            GameEntity(
                id = 101L,
                seasonId = seasonId,
                homeTeamId = 100L,
                awayTeamId = 200L,
                status = GameStatus.COMPLETED,
                homeScore = 5,
                awayScore = 3,
            )
        `when`(gameRepository.findAllBySeasonId(seasonId)).thenReturn(listOf(game1))

        val team1 = TeamEntity(id = 100L, name = "Cards", abbreviation = "STL", city = "St. Louis")
        val team2 = TeamEntity(id = 200L, name = "Cubs", abbreviation = "CHC", city = "Chicago")
        `when`(teamRepository.findAll()).thenReturn(listOf(team1, team2))
        `when`(teamRepository.findById(100L)).thenReturn(Optional.of(team1))
        `when`(teamRepository.findById(200L)).thenReturn(Optional.of(team2))

        val dashboard = scoringService.getSeasonDashboard(seasonId)
        assertEquals("2026", dashboard.seasonName)
        assertEquals(2, dashboard.standings.size)
        assertEquals(100L, dashboard.standings[0].teamId)
        assertEquals(1, dashboard.standings[0].wins)
    }

    @Test
    fun testOtherEventTypes() {
        val gameId = 1L
        val batterId = 2L
        val pitcherId = 3L
        val gameEntity =
            GameEntity(
                id = gameId,
                homeTeamId = 100L,
                awayTeamId = 200L,
                runnerFirstId = 4L,
            )
        val batter = PlayerEntity(id = batterId, name = "Batter", teamId = 200L)
        val pitcher = PlayerEntity(id = pitcherId, name = "Pitcher", teamId = 100L)

        `when`(gameRepository.findById(gameId)).thenReturn(Optional.of(gameEntity))
        `when`(playerRepository.findById(batterId)).thenReturn(Optional.of(batter))
        `when`(playerRepository.findById(pitcherId)).thenReturn(Optional.of(pitcher))
        `when`(playerRepository.findById(4L)).thenReturn(Optional.of(PlayerEntity(id = 4L, name = "Runner", teamId = 200L)))
        `when`(teamRepository.findById(100L)).thenReturn(Optional.of(TeamEntity(100L, "Cards", "STL", "St. Louis")))
        `when`(teamRepository.findById(200L)).thenReturn(Optional.of(TeamEntity(200L, "Cubs", "CHC", "Chicago")))
        `when`(gameRepository.save(any(GameEntity::class.java))).thenAnswer { it.getArgument(0) }
        `when`(gameInningRepository.findByGameIdAndInning(anyLong(), anyInt())).thenReturn(GameInningEntity(1, 0, 0))
        `when`(gameInningRepository.save(any(GameInningEntity::class.java))).thenAnswer { it.getArgument(0) }

        // TRIPLE
        var updated = scoringService.recordPlayEvent(gameId, ScoringEventRequest(ScoringEventType.TRIPLE, batterId, pitcherId))
        assertEquals(batterId, updated.gameState.runnerThirdId)

        // HOME RUN
        updated = scoringService.recordPlayEvent(gameId, ScoringEventRequest(ScoringEventType.HOME_RUN, batterId, pitcherId))
        assertNull(updated.gameState.runnerThirdId)

        // HIT_BY_PITCH
        updated = scoringService.recordPlayEvent(gameId, ScoringEventRequest(ScoringEventType.HIT_BY_PITCH, batterId, pitcherId))
        assertEquals(batterId, updated.gameState.runnerFirstId)

        // BALK
        updated = scoringService.recordPlayEvent(gameId, ScoringEventRequest(ScoringEventType.BALK, batterId, pitcherId))

        // STOLEN_BASE
        val mapSB = mapOf("4" to 2)
        updated =
            scoringService.recordPlayEvent(
                gameId,
                ScoringEventRequest(ScoringEventType.STOLEN_BASE, batterId, pitcherId, runnerAdvanceMap = mapSB),
            )

        // CAUGHT_STEALING
        val mapCS = mapOf("4" to 0)
        updated =
            scoringService.recordPlayEvent(
                gameId,
                ScoringEventRequest(ScoringEventType.CAUGHT_STEALING, batterId, pitcherId, runnerAdvanceMap = mapCS),
            )

        // PICKED_OFF
        val mapPO = mapOf("4" to 0)
        updated =
            scoringService.recordPlayEvent(
                gameId,
                ScoringEventRequest(ScoringEventType.PICKED_OFF, batterId, pitcherId, runnerAdvanceMap = mapPO),
            )
    }
}

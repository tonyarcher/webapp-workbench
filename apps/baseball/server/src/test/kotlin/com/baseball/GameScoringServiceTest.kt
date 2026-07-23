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
import org.mockito.ArgumentMatchers.*
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
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
            ).apply {
                this.awayScore = 0
                this.homeScore = 0
                this.awayHits = 0
                this.homeHits = 0
            }

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
            ).apply {
                this.balls = 3
                this.strikes = 1
            }
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
            ).apply {
                this.balls = 1
                this.strikes = 1
            }
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
            ).apply {
                this.runnerThirdId = 4L
                this.half = HalfInning.TOP
            }
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
            ).apply {
                this.runnerFirstId = 4L
                this.runnerSecondId = 5L
            }
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
            ).apply {
                this.outs = 2
                this.inning = 9
                this.half = HalfInning.TOP
                this.awayScore = 2
                this.homeScore = 3
            }
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
            ).apply {
                this.awayScore = 1
                this.homeScore = 2
                this.awayHits = 5
                this.homeHits = 7
                this.runnerFirstId = 40L
                this.runnerSecondId = 50L
                this.runnerThirdId = 60L
                this.currentBatterId = 70L
                this.currentPitcherId = 80L
            }
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
        val pitching1 = PlayerGamePitchingStatsEntity(playerId = 80L).apply { runsAllowed = 1 }

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
            ).apply {
                this.homeScore = 5
                this.awayScore = 3
            }
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
            ).apply {
                this.runnerFirstId = 4L
            }
        val batter = PlayerEntity(id = batterId, name = "Batter", position = "DH", teamId = 200L)
        val pitcher = PlayerEntity(id = pitcherId, name = "Pitcher", position = "P", teamId = 100L)


        val ss = PlayerEntity(id = 50L, name = "Shortstop", position = "SS", teamId = 100L)
        val c = PlayerEntity(id = 51L, name = "Catcher", position = "C", teamId = 100L)
        `when`(playerRepository.findAll()).thenReturn(listOf(batter, pitcher, ss, c))
        `when`(playerRepository.findAllByTeamId(100L)).thenReturn(listOf(pitcher, ss, c))

        `when`(playerRepository.findById(batterId)).thenReturn(Optional.of(batter))
        `when`(playerRepository.findById(pitcherId)).thenReturn(Optional.of(pitcher))
        `when`(playerRepository.findById(4L)).thenReturn(Optional.of(PlayerEntity(id = 4L, name = "Runner", teamId = 200L)))
        `when`(playerRepository.findById(50L)).thenReturn(Optional.of(ss))
        `when`(playerRepository.findById(51L)).thenReturn(Optional.of(c))
        `when`(fieldingRepository.save(any(PlayerGameFieldingStatsEntity::class.java))).thenAnswer { it.getArgument(0) }


        `when`(teamRepository.findById(100L)).thenReturn(Optional.of(TeamEntity(100L, "Cards", "STL", "St. Louis")))
        `when`(teamRepository.findById(200L)).thenReturn(Optional.of(TeamEntity(200L, "Cubs", "CHC", "Chicago")))
        `when`(gameRepository.findById(gameId)).thenAnswer { Optional.of(gameEntity) }
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

        // WILD_PITCH
        val mapWP = mapOf("4" to 2)
        updated = scoringService.recordPlayEvent(gameId, ScoringEventRequest(ScoringEventType.WILD_PITCH, batterId, pitcherId, runnerAdvanceMap = mapWP))

        // PASSED_BALL
        updated = scoringService.recordPlayEvent(gameId, ScoringEventRequest(ScoringEventType.PASSED_BALL, batterId, pitcherId, runnerAdvanceMap = mapWP))

        // ERROR
        updated = scoringService.recordPlayEvent(gameId, ScoringEventRequest(ScoringEventType.ERROR, batterId, pitcherId, isError = true))

        // SACRIFICE_FLY
        updated = scoringService.recordPlayEvent(gameId, ScoringEventRequest(ScoringEventType.SACRIFICE_FLY, batterId, pitcherId))

        // FIELDER_CHOICE
        updated = scoringService.recordPlayEvent(gameId, ScoringEventRequest(ScoringEventType.FIELDER_CHOICE, batterId, pitcherId))

        // DOUBLE PLAY
        updated = scoringService.recordPlayEvent(gameId, ScoringEventRequest(ScoringEventType.GROUNDOUT, batterId, pitcherId, isDoublePlay = true))
    }

    @Test
    fun testBasesLoadedWalkAndInningTransition() {
        val gameId = 1L
        val batterId = 2L
        val pitcherId = 3L
        val gameEntity =
            GameEntity(
                id = gameId,
                status = GameStatus.IN_PROGRESS,
                homeTeamId = 100L,
                awayTeamId = 200L,
            ).apply {
                this.outs = 2
                this.runnerFirstId = 10L
                this.runnerSecondId = 11L
                this.runnerThirdId = 12L
                this.inning = 9
                this.half = HalfInning.BOTTOM
                this.homeScore = 3
                this.awayScore = 3
            }

        `when`(gameRepository.findById(gameId)).thenReturn(Optional.of(gameEntity))
        `when`(gameRepository.save(any(GameEntity::class.java))).thenAnswer { it.getArgument(0) }

        val batter = PlayerEntity(id = batterId, name = "WalkBatter", jerseyNumber = 9, position = "DH", teamId = 100L)
        val pitcher = PlayerEntity(id = pitcherId, name = "Pitcher", jerseyNumber = 34, position = "P", teamId = 200L)
        val r1 = PlayerEntity(id = 10L, name = "R1", jerseyNumber = 1, position = "1B", teamId = 100L)
        val r2 = PlayerEntity(id = 11L, name = "R2", jerseyNumber = 2, position = "2B", teamId = 100L)
        val r3 = PlayerEntity(id = 12L, name = "R3", jerseyNumber = 3, position = "3B", teamId = 100L)
        `when`(playerRepository.findAll()).thenReturn(listOf(batter, pitcher, r1, r2, r3))
        `when`(playerRepository.findById(batterId)).thenReturn(Optional.of(batter))
        `when`(playerRepository.findById(pitcherId)).thenReturn(Optional.of(pitcher))
        `when`(playerRepository.findById(10L)).thenReturn(Optional.of(r1))
        `when`(playerRepository.findById(11L)).thenReturn(Optional.of(r2))
        `when`(playerRepository.findById(12L)).thenReturn(Optional.of(r3))

        val teamHome = TeamEntity(id = 100L, name = "Cards", abbreviation = "STL", city = "St. Louis")
        val teamAway = TeamEntity(id = 200L, name = "Cubs", abbreviation = "CHC", city = "Chicago")
        `when`(teamRepository.findById(100L)).thenReturn(Optional.of(teamHome))
        `when`(teamRepository.findById(200L)).thenReturn(Optional.of(teamAway))

        `when`(gameInningRepository.findAllByGameIdOrderByInningAsc(gameId)).thenReturn(emptyList())

        `when`(battingRepository.save(any(PlayerGameBattingStatsEntity::class.java))).thenAnswer { it.getArgument(0) }
        `when`(pitchingRepository.save(any(PlayerGamePitchingStatsEntity::class.java))).thenAnswer { it.getArgument(0) }
        `when`(fieldingRepository.save(any(PlayerGameFieldingStatsEntity::class.java))).thenAnswer { it.getArgument(0) }
        `when`(gameInningRepository.save(any(GameInningEntity::class.java))).thenAnswer { it.getArgument(0) }

        // Bases-loaded WALK in 9th bottom (walkoff)
        val updated = scoringService.recordPlayEvent(

            gameId,
            ScoringEventRequest(ScoringEventType.WALK, batterId, pitcherId)
        )

        assertEquals(4, updated.homeScore)
        assertEquals(GameStatus.COMPLETED, updated.status)
    }





    @Test
    fun testResetGame() {
        val gameId = 1L
        val gameEntity = GameEntity(id = gameId, status = GameStatus.COMPLETED, homeTeamId = 100L, awayTeamId = 200L)
        `when`(gameRepository.findById(gameId)).thenReturn(Optional.of(gameEntity))
        `when`(gameRepository.save(any(GameEntity::class.java))).thenAnswer { it.getArgument(0) }
        `when`(teamRepository.findById(100L)).thenReturn(Optional.of(TeamEntity(100L, "Cards", "STL", "St. Louis")))
        `when`(teamRepository.findById(200L)).thenReturn(Optional.of(TeamEntity(200L, "Cubs", "CHC", "Chicago")))

        val reset = scoringService.resetGame(gameId)
        assertEquals(GameStatus.SCHEDULED, reset.status)
        assertEquals(0, reset.homeScore)
        assertEquals(0, reset.awayScore)
    }

    @Test
    fun testGetSeasonStats() {
        val seasonId = 1L
        val seasonEntity = SeasonEntity(id = seasonId, name = "2026", year = 2026, leagueId = 10L)
        `when`(seasonRepository.findById(seasonId)).thenReturn(Optional.of(seasonEntity))

        val game1 = GameEntity(id = 101L, seasonId = seasonId, homeTeamId = 100L, awayTeamId = 200L)
        `when`(gameRepository.findAllBySeasonId(seasonId)).thenReturn(listOf(game1))

        val player = PlayerEntity(id = 10L, name = "Yogi", jerseyNumber = 8, position = "C", teamId = 100L)
        `when`(playerRepository.findAll()).thenReturn(listOf(player))

        val batting = PlayerGameBattingStatsEntity(id = 1L, gameId = 101L, playerId = 10L, teamId = 100L, atBats = 4, hits = 2)
        `when`(battingRepository.findAllByGameIdIn(listOf(101L))).thenReturn(listOf(batting))

        val pitching = PlayerGamePitchingStatsEntity(id = 2L, gameId = 101L, playerId = 10L, teamId = 100L, inningsPitchedThirds = 3, strikeoutsRecorded = 2)
        `when`(pitchingRepository.findAllByGameIdIn(listOf(101L))).thenReturn(listOf(pitching))

        val fielding = PlayerGameFieldingStatsEntity().apply {
            id = 3L
            gameId = 101L
            playerId = 10L
            teamId = 100L
            putouts = 5
            assists = 1
            errors = 0
        }
        `when`(fieldingRepository.findAllByGameIdIn(listOf(101L))).thenReturn(listOf(fielding))

        val stats = scoringService.getSeasonStats(seasonId)
        assertEquals(seasonId, stats.seasonId)
        assertEquals(1, stats.battingStats.size)
        assertEquals(2, stats.battingStats[0].hits)
        assertEquals(1, stats.fieldingStats.size)
        assertEquals(5, stats.fieldingStats[0].putouts)
    }

    @Test
    fun testNotFoundExceptions() {
        `when`(gameRepository.findById(999L)).thenReturn(Optional.empty())
        `when`(seasonRepository.findById(999L)).thenReturn(Optional.empty())

        assertThrows(IllegalArgumentException::class.java) { scoringService.getGameDomain(999L) }
        assertThrows(IllegalArgumentException::class.java) { scoringService.getBoxScore(999L) }
        assertThrows(IllegalArgumentException::class.java) { scoringService.getSeasonDashboard(999L) }
        assertThrows(IllegalArgumentException::class.java) { scoringService.getSeasonStats(999L) }
        assertThrows(IllegalArgumentException::class.java) { scoringService.resetGame(999L) }
    }
}


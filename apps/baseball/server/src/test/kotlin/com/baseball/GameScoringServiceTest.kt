package com.baseball

import com.baseball.entities.*
import com.baseball.models.*
import com.baseball.repositories.*
import com.baseball.services.GameScoringService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
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

        scoringService = GameScoringService(
            gameRepository,
            gameInningRepository,
            playerRepository,
            teamRepository,
            playEventRepository,
            battingRepository,
            pitchingRepository,
            seasonRepository
        )
    }

    @Test
    fun testRecordSingleEvent() {
        // Arrange
        val gameId = 1L
        val batterId = 2L
        val pitcherId = 3L

        val gameEntity = GameEntity(
            id = gameId,
            seasonId = 10L,
            homeTeamId = 100L,
            awayTeamId = 200L,
            status = GameStatus.IN_PROGRESS,
            awayScore = 0,
            homeScore = 0,
            awayHits = 0,
            homeHits = 0
        )

        val batter = PlayerEntity(id = batterId, name = "John Batter", position = "LF", teamId = 200L)
        val pitcher = PlayerEntity(id = pitcherId, name = "Jim Pitcher", position = "P", teamId = 100L)

        `when`(gameRepository.findById(gameId)).thenReturn(Optional.of(gameEntity))
        `when`(playerRepository.findById(batterId)).thenReturn(Optional.of(batter))
        `when`(playerRepository.findById(pitcherId)).thenReturn(Optional.of(pitcher))
        
        `when`(teamRepository.findById(100L)).thenReturn(Optional.of(TeamEntity(100L, "Cardinals", "STL", "St. Louis")))
        `when`(teamRepository.findById(200L)).thenReturn(Optional.of(TeamEntity(200L, "Cubs", "CHC", "Chicago")))

        // Mock empty batting / pitching stats lookup
        `when`(battingRepository.findByGameIdAndPlayerId(gameId, batterId)).thenReturn(null)
        `when`(pitchingRepository.findByGameIdAndPlayerId(gameId, pitcherId)).thenReturn(null)

        // Mock saves
        `when`(gameRepository.save(any(GameEntity::class.java))).thenAnswer { it.getArgument(0) }
        `when`(battingRepository.save(any(PlayerGameBattingStatsEntity::class.java))).thenAnswer { it.getArgument(0) }
        `when`(pitchingRepository.save(any(PlayerGamePitchingStatsEntity::class.java))).thenAnswer { it.getArgument(0) }

        // Act
        val request = ScoringEventRequest(
            eventType = ScoringEventType.SINGLE,
            batterId = batterId,
            pitcherId = pitcherId
        )
        val updatedGame = scoringService.recordPlayEvent(gameId, request)

        // Assert
        assertNotNull(updatedGame)
        assertEquals(1, updatedGame.awayHits) // Single adds a hit for away team (TOP inning)
        assertEquals(batterId, updatedGame.gameState.runnerFirstId) // Batter goes to first base
        assertEquals(0, updatedGame.gameState.balls) // Count resets
        assertEquals(0, updatedGame.gameState.strikes)

        verify(gameRepository, times(1)).save(any(GameEntity::class.java))
        verify(battingRepository, times(1)).save(any(PlayerGameBattingStatsEntity::class.java))
        verify(pitchingRepository, times(1)).save(any(PlayerGamePitchingStatsEntity::class.java))
    }

    @Test
    fun testRecordStrikeoutEvent() {
        // Arrange
        val gameId = 1L
        val batterId = 2L
        val pitcherId = 3L

        val gameEntity = GameEntity(
            id = gameId,
            seasonId = 10L,
            homeTeamId = 100L,
            awayTeamId = 200L,
            status = GameStatus.IN_PROGRESS,
            outs = 0,
            balls = 0,
            strikes = 2
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

        // Act
        val request = ScoringEventRequest(
            eventType = ScoringEventType.STRIKE,
            batterId = batterId,
            pitcherId = pitcherId
        )
        val updatedGame = scoringService.recordPlayEvent(gameId, request)

        // Assert
        assertEquals(1, updatedGame.gameState.outs) // Strike 3 adds an out
        assertEquals(0, updatedGame.gameState.balls) // Count resets
        assertEquals(0, updatedGame.gameState.strikes)
    }
}

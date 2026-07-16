package com.baseball

import com.baseball.game.*
import com.baseball.models.*
import com.baseball.seed.SeedData
import kotlin.test.*

class LineupSetupTest {

    @Test
    fun testStartNewGameWithDH() {
        val chc = SeedData.teamCubs
        val stl = SeedData.teamCardinals

        val homeLineup = (1..9).map { 
            Player(100L + it, 1L, "Home $it", if (it == 1) "DH" else "OF", it, "R", "R") 
        }
        val awayLineup = (1..9).map { 
            Player(200L + it, 2L, "Away $it", if (it == 1) "DH" else "OF", it, "R", "R") 
        }

        val homeBench = listOf(Player(110L, 1L, "Home Pitcher", "P", 99, "L", "L"))
        val awayBench = listOf(Player(210L, 2L, "Away Pitcher", "P", 98, "R", "R"))

        startNewGame(
            homeTeam = chc,
            awayTeam = stl,
            homeLineup = homeLineup,
            awayLineup = awayLineup,
            homeBench = homeBench,
            awayBench = awayBench,
            homeActivePitcherId = 110L,
            awayActivePitcherId = 210L,
            useDh = true
        )

        val game = localGame
        assertNotNull(game)
        assertEquals(chc, game.homeTeam)
        assertEquals(stl, game.awayTeam)

        // Verify active pitchers are selected
        assertEquals(110L, game.gameState.currentPitcherId)
        assertEquals("Home Pitcher", game.gameState.currentPitcherName)

        // Verify DH setting is saved
        assertTrue(localUseDh)

        // Verify initial lineup copies are saved for reset
        assertEquals(9, initialHomeLineup.size)
        assertEquals(9, initialAwayLineup.size)
        assertEquals("Home 1", initialHomeLineup.first().name)
        assertEquals("DH", initialHomeLineup.first().position)
    }

    @Test
    fun testStartNewGameWithoutDH() {
        val chc = SeedData.teamCubs
        val stl = SeedData.teamCardinals

        val homeLineup = (1..9).map { 
            Player(100L + it, 1L, "Home $it", if (it == 9) "P" else "OF", it, "R", "R") 
        }
        val awayLineup = (1..9).map { 
            Player(200L + it, 2L, "Away $it", if (it == 9) "P" else "OF", it, "R", "R") 
        }

        startNewGame(
            homeTeam = chc,
            awayTeam = stl,
            homeLineup = homeLineup,
            awayLineup = awayLineup,
            homeBench = emptyList(),
            awayBench = emptyList(),
            homeActivePitcherId = 109L,
            awayActivePitcherId = 209L,
            useDh = false
        )

        val game = localGame
        assertNotNull(game)
        assertFalse(localUseDh)

        // Pitcher should be part of the lineup and active pitcher id is matched
        assertEquals(109L, game.gameState.currentPitcherId)
        assertEquals("Home 9", game.gameState.currentPitcherName)
        assertEquals("P", initialHomeLineup[8].position)
    }

    @Test
    fun testResetGameRestoresRoster() {
        val chc = SeedData.teamCubs
        val stl = SeedData.teamCardinals

        val homeLineup = (1..9).map { 
            Player(100L + it, 1L, "Home $it", if (it == 1) "DH" else "OF", it, "R", "R") 
        }
        val awayLineup = (1..9).map { 
            Player(200L + it, 2L, "Away $it", if (it == 1) "DH" else "OF", it, "R", "R") 
        }
        val homeBench = listOf(Player(110L, 1L, "Home Pitcher", "P", 99, "L", "L"))
        val awayBench = listOf(Player(210L, 2L, "Away Pitcher", "P", 98, "R", "R"))

        startNewGame(
            homeTeam = chc,
            awayTeam = stl,
            homeLineup = homeLineup,
            awayLineup = awayLineup,
            homeBench = homeBench,
            awayBench = awayBench,
            homeActivePitcherId = 110L,
            awayActivePitcherId = 210L,
            useDh = true
        )

        // Make modifications to simulate game play
        localGame = localGame!!.copy(homeScore = 5, awayScore = 3)
        localEvents.add(PlayEvent(1L, 1L, 1, HalfInning.TOP, 0, 1, 0, 0, "Away 1", "Home Pitcher", ScoringEventType.GROUNDOUT, "Ground out", 0, ""))

        // Reset to initial lineups
        resetLocalGame(toInitialLineups = true)

        // Scores and events should be reset, but rosters remain the same
        val resetGame = localGame
        assertNotNull(resetGame)
        assertEquals(0, resetGame.homeScore)
        assertEquals(0, resetGame.awayScore)
        assertTrue(localEvents.isEmpty())
        assertEquals("Home 1", localHomeLineup.first().name)
        assertEquals(110L, localHomeActivePitcherId)
    }

    @Test
    fun testOwnerIdFutureProofing() {
        val testLeague = League(1L, "Owner League", "user_123")
        val testSeason = Season(1L, 1L, "Owner Season", 2026, "user_123")
        val testTeam = Team(1L, "Owner Team", "OWN", "Owner City", "user_123")
        
        assertEquals("user_123", testLeague.ownerId)
        assertEquals("user_123", testSeason.ownerId)
        assertEquals("user_123", testTeam.ownerId)
    }
}

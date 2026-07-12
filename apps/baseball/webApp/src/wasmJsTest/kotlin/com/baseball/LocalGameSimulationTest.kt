package com.baseball

import com.baseball.models.*
import com.baseball.game.*
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class LocalGameSimulationTest {

    @Test
    fun testSimulateMultipleGames() {
        // Simulate 3 full games to verify stats accumulation and rules
        for (gameIndex in 1..3) {
            initLocalGame(forceReset = true)
            val game = localGame
            assertNotNull(game)
            assertEquals(GameStatus.SCHEDULED, game.status)

            var playCount = 0
            // We loop until the game status transitions to COMPLETED
            while (localGame?.status != GameStatus.COMPLETED && playCount < 1000) {
                val currGame = localGame!!
                val batterId = currGame.gameState.currentBatterId!!
                val pitcherId = currGame.gameState.currentPitcherId!!

                // Generate a deterministic sequence of events to ensure hits, walks, outs, and runs occur
                val eventType = when (playCount % 12) {
                    0 -> ScoringEventType.SINGLE
                    1 -> ScoringEventType.STRIKEOUT
                    2 -> ScoringEventType.GROUNDOUT
                    3 -> ScoringEventType.WALK
                    4 -> ScoringEventType.DOUBLE
                    5 -> ScoringEventType.FLYOUT
                    6 -> ScoringEventType.STRIKEOUT
                    7 -> ScoringEventType.HOME_RUN
                    8 -> ScoringEventType.GROUNDOUT
                    9 -> ScoringEventType.SINGLE
                    10 -> ScoringEventType.FLYOUT
                    11 -> ScoringEventType.GROUNDOUT
                    else -> ScoringEventType.GROUNDOUT
                }

                recordLocalPlayEvent(
                    eventType = eventType,
                    batterId = batterId,
                    pitcherId = pitcherId,
                    descriptionDetail = "Play $playCount: ${eventType.name}"
                )
                playCount++
            }

            val finalGame = localGame!!
            val finalBoxScore = localBoxScore!!

            assertEquals(GameStatus.COMPLETED, finalGame.status)
            assertTrue(playCount > 50, "Game should have lasted for a reasonable number of plays")

            // 1. Verify Line Score Sum matches Total Score
            val lineScore = finalBoxScore.lineScore
            val sumAwayInningRuns = lineScore.awayInningRuns.filterNotNull().sum()
            val sumHomeInningRuns = lineScore.homeInningRuns.filterNotNull().sum()

            assertEquals(finalGame.awayScore, sumAwayInningRuns, "Away score should match line score sum")
            assertEquals(finalGame.homeScore, sumHomeInningRuns, "Home score should match line score sum")

            // 2. Verify Pitching runs allowed matches opposing batting runs
            val totalAwayRunsScoredByBatters = finalBoxScore.awayBatting.sumOf { it.runs }
            val totalHomeRunsScoredByBatters = finalBoxScore.homeBatting.sumOf { it.runs }
            val totalAwayPitchingRunsAllowed = finalBoxScore.awayPitching.sumOf { it.runsAllowed }
            val totalHomePitchingRunsAllowed = finalBoxScore.homePitching.sumOf { it.runsAllowed }

            assertEquals(finalGame.awayScore, totalAwayRunsScoredByBatters, "Away team runs in batting stats should match total score")
            assertEquals(finalGame.homeScore, totalHomeRunsScoredByBatters, "Home team runs in batting stats should match total score")

            // Pitchers from Home team pitch to Away batters (and vice versa)
            assertEquals(finalGame.awayScore, totalHomePitchingRunsAllowed, "Home pitching runs allowed should match away team score")
            assertEquals(finalGame.homeScore, totalAwayPitchingRunsAllowed, "Away pitching runs allowed should match home team score")

            // 3. Verify hits totals
            val totalAwayBattingHits = finalBoxScore.awayBatting.sumOf { it.hits }
            val totalHomeBattingHits = finalBoxScore.homeBatting.sumOf { it.hits }
            val totalAwayPitchingHitsAllowed = finalBoxScore.awayPitching.sumOf { it.hitsAllowed }
            val totalHomePitchingHitsAllowed = finalBoxScore.homePitching.sumOf { it.hitsAllowed }

            assertEquals(finalGame.awayHits, totalAwayBattingHits)
            assertEquals(finalGame.homeHits, totalHomeBattingHits)
            assertEquals(finalGame.awayHits, totalHomePitchingHitsAllowed)
            assertEquals(finalGame.homeHits, totalAwayPitchingHitsAllowed)
        }
    }

    @Test
    fun testBaseRunningAndThrowSequences() {
        initLocalGame(forceReset = true)
        val game = localGame!!
        val batterId = game.gameState.currentBatterId!!
        val pitcherId = game.gameState.currentPitcherId!!

        // 1. Single to put batter on base
        recordLocalPlayEvent(
            eventType = ScoringEventType.SINGLE,
            batterId = batterId,
            pitcherId = pitcherId,
            descriptionDetail = "Single by batter"
        )
        
        // Batter should now be on 1B
        val runner1 = localGame!!.gameState.runnerFirstId
        assertNotNull(runner1)

        // 2. Stolen Base to move runner to 2B
        recordLocalPlayEvent(
            eventType = ScoringEventType.STOLEN_BASE,
            batterId = localGame!!.gameState.currentBatterId!!,
            pitcherId = localGame!!.gameState.currentPitcherId!!,
            descriptionDetail = "Stolen Base: Runner to 2B",
            runnerAdvanceMap = mapOf(runner1.toString() to 2)
        )

        // Runner should now be on 2B, batter's count and lineup index preserved
        assertEquals(runner1, localGame!!.gameState.runnerSecondId)
        assertEquals(0, localGame!!.gameState.balls)
        assertEquals(0, localGame!!.gameState.strikes)

        // 3. Caught Stealing to get runner out with a throw sequence
        recordLocalPlayEvent(
            eventType = ScoringEventType.CAUGHT_STEALING,
            batterId = localGame!!.gameState.currentBatterId!!,
            pitcherId = localGame!!.gameState.currentPitcherId!!,
            descriptionDetail = "Caught Stealing: Runner (2-5)",
            runnerAdvanceMap = mapOf(runner1.toString() to 0)
        )

        // Runner should be out, outs incremented to 1
        assertEquals(null, localGame!!.gameState.runnerSecondId)
        assertEquals(1, localGame!!.gameState.outs)
    }

    @Test
    fun testExhaustiveDoublePlayAndThrowScenarios() {
        initLocalGame(forceReset = true)
        val game = localGame!!
        val batter1Id = game.gameState.currentBatterId!!
        val pitcherId = game.gameState.currentPitcherId!!

        // Yogi Harry gets a Single
        recordLocalPlayEvent(
            eventType = ScoringEventType.SINGLE,
            batterId = batter1Id,
            pitcherId = pitcherId,
            descriptionDetail = "Single"
        )
        val runner1 = localGame!!.gameState.runnerFirstId
        assertNotNull(runner1)

        // Babe Hammer hits a double play (1-6-3)
        val batter2Id = localGame!!.gameState.currentBatterId!!
        recordLocalPlayEvent(
            eventType = ScoringEventType.GROUNDOUT,
            batterId = batter2Id,
            pitcherId = pitcherId,
            descriptionDetail = "Groundout to Shortstop (Runner Out: 1-6-3) (Double Play)",
            isDoublePlay = true,
            runnerAdvanceMap = mapOf(runner1.toString() to 0)
        )

        // Verify state is correct
        assertEquals(2, localGame!!.gameState.outs)
        assertEquals(null, localGame!!.gameState.runnerFirstId)

        // Verify scorebook notation
        val playEvents = localEvents
        val batter1Name = (localAwayRoster + localHomeRoster).find { it.id == batter1Id }?.name ?: ""
        val batter2Name = (localAwayRoster + localHomeRoster).find { it.id == batter2Id }?.name ?: ""

        val YogiSingle = playEvents.find { it.batterName == batter1Name && it.eventType == ScoringEventType.SINGLE }!!
        val BabeDP = playEvents.find { it.batterName == batter2Name && it.eventType == ScoringEventType.GROUNDOUT }!!

        val notationYogi = com.baseball.ui.getScorebookNotation(YogiSingle)
        val notationBabe = com.baseball.ui.getScorebookNotation(BabeDP)

        assertEquals("1B", notationYogi)
        assertEquals("1-6-3 DP", notationBabe)
    }

    @Test
    fun testUndoLastLocalEvent() {
        initLocalGame(forceReset = true)
        val game = localGame!!
        val batterId = game.gameState.currentBatterId!!
        val pitcherId = game.gameState.currentPitcherId!!

        // 1. Record strike (pitch)
        recordLocalPlayEvent(
            eventType = ScoringEventType.STRIKE,
            batterId = batterId,
            pitcherId = pitcherId,
            descriptionDetail = "Strike 1"
        )
        assertEquals(1, localGame!!.gameState.strikes)
        assertEquals(1, localEvents.size)

        // 2. Record ball (pitch)
        recordLocalPlayEvent(
            eventType = ScoringEventType.BALL,
            batterId = batterId,
            pitcherId = pitcherId,
            descriptionDetail = "Ball 1"
        )
        assertEquals(1, localGame!!.gameState.balls)
        assertEquals(1, localGame!!.gameState.strikes)
        assertEquals(2, localEvents.size)

        // Undo last pitch (Ball 1)
        undoLastLocalEvent()
        assertEquals(0, localGame!!.gameState.balls)
        assertEquals(1, localGame!!.gameState.strikes)
        assertEquals(1, localEvents.size)

        // 3. Record a Single (play)
        recordLocalPlayEvent(
            eventType = ScoringEventType.SINGLE,
            batterId = batterId,
            pitcherId = pitcherId,
            descriptionDetail = "Single"
        )
        assertNotNull(localGame!!.gameState.runnerFirstId)
        assertEquals(2, localEvents.size)

        // Undo last play (Single)
        undoLastLocalEvent()
        assertEquals(null, localGame!!.gameState.runnerFirstId)
        assertEquals(1, localGame!!.gameState.strikes)
        assertEquals(0, localGame!!.gameState.balls)
        assertEquals(1, localEvents.size)
    }

    @Test
    fun testHitLocationScorecardNotations() {
        initLocalGame(forceReset = true)
        val game = localGame!!
        val batterId = game.gameState.currentBatterId!!
        val pitcherId = game.gameState.currentPitcherId!!

        // Single to Left Field
        recordLocalPlayEvent(
            eventType = ScoringEventType.SINGLE,
            batterId = batterId,
            pitcherId = pitcherId,
            descriptionDetail = "Single to Left Field"
        )
        val notation = com.baseball.ui.getScorebookNotation(localEvents.last())
        assertEquals("1B7", notation)
    }
}

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
}

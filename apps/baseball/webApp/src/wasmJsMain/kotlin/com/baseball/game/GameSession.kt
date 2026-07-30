package com.baseball.game

import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.GameState
import com.baseball.models.GameStatus
import com.baseball.models.HalfInning
import com.baseball.models.LineScore
import com.baseball.models.Player
import com.baseball.models.PlayerBattingStats
import com.baseball.models.PlayerPitchingStats
import com.baseball.models.Team

internal fun buildNewGameSession(
    homeTeam: Team,
    awayTeam: Team,
    useDh: Boolean,
    homeConfig: TeamLineupConfig,
    awayConfig: TeamLineupConfig,
): Pair<Game, BoxScore> {
    val homeRoster = homeConfig.lineup + homeConfig.bench
    val homeActivePitcherName = homeRoster.find { it.id == homeConfig.activePitcherId }?.name ?: "Pitcher"
    val game = buildGameInstance(
        homeTeam = homeTeam,
        awayTeam = awayTeam,
        awayLineup = awayConfig.lineup,
        homeActivePitcherId = homeConfig.activePitcherId,
        homeActivePitcherName = homeActivePitcherName,
    )
    val boxScore = buildBoxScoreInstance(homeTeam, awayTeam, useDh, homeConfig, awayConfig)
    return Pair(game, boxScore)
}

private fun buildGameInstance(
    homeTeam: Team,
    awayTeam: Team,
    awayLineup: List<Player>,
    homeActivePitcherId: Long,
    homeActivePitcherName: String,
): Game {
    val firstAwayBatter = awayLineup.firstOrNull()
    return Game(
        id = 1L,
        seasonId = 1L,
        homeTeam = homeTeam,
        awayTeam = awayTeam,
        date = "2026-07-10",
        status = GameStatus.SCHEDULED,
        homeScore = 0,
        awayScore = 0,
        homeHits = 0,
        awayHits = 0,
        homeErrors = 0,
        awayErrors = 0,
        gameState = GameState(
            inning = 1,
            half = HalfInning.TOP,
            outs = 0,
            balls = 0,
            strikes = 0,
            currentBatterId = firstAwayBatter?.id,
            currentBatterName = firstAwayBatter?.name,
            currentPitcherId = homeActivePitcherId,
            currentPitcherName = homeActivePitcherName,
        ),
    )
}

private fun buildBattingStats(
    lineup: List<Player>,
    bench: List<Player>,
    useDh: Boolean,
): List<PlayerBattingStats> {
    val lineupStats = lineup.map { PlayerBattingStats(it.id!!, it.name, it.jerseyNumber, it.position) }
    val benchStats = bench.filter { useDh || it.position != BaseballConstants.Positions.P }
        .map { PlayerBattingStats(it.id!!, it.name, it.jerseyNumber, it.position) }
    return lineupStats + benchStats
}

private fun buildPitchingStats(lineup: List<Player>, bench: List<Player>): List<PlayerPitchingStats> {
    return (lineup + bench).filter { it.position == BaseballConstants.Positions.P }
        .map { PlayerPitchingStats(it.id!!, it.name, it.jerseyNumber, it.position) }
}

private fun buildBoxScoreInstance(
    homeTeam: Team,
    awayTeam: Team,
    useDh: Boolean,
    homeConfig: TeamLineupConfig,
    awayConfig: TeamLineupConfig,
): BoxScore {
    return BoxScore(
        gameId = 1L,
        homeTeamName = homeTeam.name,
        awayTeamName = awayTeam.name,
        lineScore = LineScore(
            gameId = 1L,
            awayRuns = 0,
            homeRuns = 0,
            awayHits = 0,
            homeHits = 0,
            awayErrors = 0,
            homeErrors = 0,
            awayInningRuns = emptyList(),
            homeInningRuns = emptyList(),
        ),
        homeBatting = buildBattingStats(homeConfig.lineup, homeConfig.bench, useDh),
        awayBatting = buildBattingStats(awayConfig.lineup, awayConfig.bench, useDh),
        homePitching = buildPitchingStats(homeConfig.lineup, homeConfig.bench),
        awayPitching = buildPitchingStats(awayConfig.lineup, awayConfig.bench),
    )
}

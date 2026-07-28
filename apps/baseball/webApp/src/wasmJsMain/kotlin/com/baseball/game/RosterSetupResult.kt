package com.baseball.game

import com.baseball.models.Player
import com.baseball.models.Team
import com.baseball.seed.SeedData

data class RosterSetupResult(
    val homeRoster: List<Player>,
    val awayRoster: List<Player>,
    val homeActivePitcherName: String,
    val awayActivePitcherName: String,
)

internal fun setupGameRosters(
    homeTeam: Team,
    awayTeam: Team,
    homeConfig: TeamLineupConfig,
    awayConfig: TeamLineupConfig,
): RosterSetupResult {
    val homeActiveP = (homeConfig.lineup + homeConfig.bench).find { it.id == homeConfig.activePitcherId }
    val homeRoster = if (homeActiveP == null) {
        val defaultP = SeedData.cubsRoster.find { it.id == homeConfig.activePitcherId }
            ?: Player(homeConfig.activePitcherId, homeTeam.id, "Pitcher", "P", 99, "R", "R")
        homeConfig.lineup + homeConfig.bench + defaultP
    } else {
        homeConfig.lineup + homeConfig.bench
    }

    val awayActiveP = (awayConfig.lineup + awayConfig.bench).find { it.id == awayConfig.activePitcherId }
    val awayRoster = if (awayActiveP == null) {
        val defaultP = SeedData.cardinalsRoster.find { it.id == awayConfig.activePitcherId }
            ?: Player(awayConfig.activePitcherId, awayTeam.id, "Pitcher", "P", 99, "R", "R")
        awayConfig.lineup + awayConfig.bench + defaultP
    } else {
        awayConfig.lineup + awayConfig.bench
    }

    val homeActivePitcherName = homeRoster.find { it.id == homeConfig.activePitcherId }?.name ?: "Pitcher"
    val awayActivePitcherName = awayRoster.find { it.id == awayConfig.activePitcherId }?.name ?: "Pitcher"

    return RosterSetupResult(
        homeRoster = homeRoster,
        awayRoster = awayRoster,
        homeActivePitcherName = homeActivePitcherName,
        awayActivePitcherName = awayActivePitcherName,
    )
}

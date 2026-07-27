package com.baseball.services

import com.baseball.entities.TeamEntity
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.models.TeamStandings
import org.springframework.stereotype.Service

@Service
class StandingsService {

    fun computeStandings(
        games: List<Game>,
        allTeams: List<TeamEntity>,
    ): List<TeamStandings> {
        val teamStatsMap = initializeTeamStats(allTeams)
        processCompletedGames(games, teamStatsMap)
        return calculateWinPercentages(teamStatsMap)
    }

    private fun initializeTeamStats(allTeams: List<TeamEntity>): MutableMap<Long, TeamStandings> {
        val teamStatsMap = mutableMapOf<Long, TeamStandings>()
        for (team in allTeams) {
            team.id?.let { id ->
                teamStatsMap[id] = TeamStandings(
                    teamId = id,
                    teamName = team.name,
                    wins = 0,
                    losses = 0,
                    winPercentage = 0.0,
                    gamesPlayed = 0,
                    runsScored = 0,
                    runsAllowed = 0,
                )
            }
        }
        return teamStatsMap
    }

    private fun processCompletedGames(games: List<Game>, teamStatsMap: MutableMap<Long, TeamStandings>) {
        games.filter { it.status == GameStatus.COMPLETED }.forEach { game ->
            val homeStats = teamStatsMap[game.homeTeam.id!!] ?: return@forEach
            val awayStats = teamStatsMap[game.awayTeam.id!!] ?: return@forEach
            val homeWon = game.homeScore > game.awayScore
            teamStatsMap[game.homeTeam.id!!] = homeStats.copy(
                wins = homeStats.wins + if (homeWon) 1 else 0,
                losses = homeStats.losses + if (!homeWon) 1 else 0,
                gamesPlayed = homeStats.gamesPlayed + 1,
                runsScored = homeStats.runsScored + game.homeScore,
                runsAllowed = homeStats.runsAllowed + game.awayScore,
            )
            teamStatsMap[game.awayTeam.id!!] = awayStats.copy(
                wins = awayStats.wins + if (!homeWon) 1 else 0,
                losses = awayStats.losses + if (homeWon) 1 else 0,
                gamesPlayed = awayStats.gamesPlayed + 1,
                runsScored = awayStats.runsScored + game.awayScore,
                runsAllowed = awayStats.runsAllowed + game.homeScore,
            )
        }
    }

    private fun calculateWinPercentages(teamStatsMap: MutableMap<Long, TeamStandings>): List<TeamStandings> {
        return teamStatsMap.values.map { stats ->
            val totalGames = stats.wins + stats.losses
            val winPct = if (totalGames > 0) stats.wins.toDouble() / totalGames else 0.0
            stats.copy(winPercentage = winPct)
        }.sortedWith(compareByDescending<TeamStandings> { it.winPercentage }.thenByDescending { it.wins })
    }
}

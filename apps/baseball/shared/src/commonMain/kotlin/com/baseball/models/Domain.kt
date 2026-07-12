package com.baseball.models

import kotlinx.serialization.Serializable

@Serializable
data class League(
    val id: Long? = null,
    val name: String,
    val ownerId: String? = null
)

@Serializable
data class Season(
    val id: Long? = null,
    val leagueId: Long,
    val name: String,
    val year: Int,
    val ownerId: String? = null
)

@Serializable
data class Team(
    val id: Long? = null,
    val name: String,
    val abbreviation: String,
    val city: String,
    val ownerId: String? = null
)

@Serializable
data class Player(
    val id: Long? = null,
    val teamId: Long? = null, // null means free agent
    val name: String,
    val position: String, // e.g., P, C, 1B, 2B, 3B, SS, LF, CF, RF, DH
    val jerseyNumber: Int,
    val battingHand: String, // R, L, S
    val throwingHand: String // R, L
)

@Serializable
enum class GameStatus {
    SCHEDULED,
    IN_PROGRESS,
    COMPLETED
}

@Serializable
enum class HalfInning {
    TOP,
    BOTTOM
}

@Serializable
data class RunnerState(
    val first: Player? = null,
    val second: Player? = null,
    val third: Player? = null
)

@Serializable
data class GameState(
    val inning: Int = 1,
    val half: HalfInning = HalfInning.TOP,
    val outs: Int = 0,
    val balls: Int = 0,
    val strikes: Int = 0,
    val runnerFirstId: Long? = null,
    val runnerSecondId: Long? = null,
    val runnerThirdId: Long? = null,
    val runnerFirstName: String? = null,
    val runnerSecondName: String? = null,
    val runnerThirdName: String? = null,
    val currentBatterId: Long? = null,
    val currentBatterName: String? = null,
    val currentPitcherId: Long? = null,
    val currentPitcherName: String? = null
)

@Serializable
data class Game(
    val id: Long? = null,
    val seasonId: Long,
    val homeTeam: Team,
    val awayTeam: Team,
    val date: String, // YYYY-MM-DD
    val status: GameStatus = GameStatus.SCHEDULED,
    val homeScore: Int = 0,
    val awayScore: Int = 0,
    val homeHits: Int = 0,
    val awayHits: Int = 0,
    val homeErrors: Int = 0,
    val awayErrors: Int = 0,
    val gameState: GameState = GameState(),
    val ownerId: String? = null
)

@Serializable
data class LineScore(
    val gameId: Long,
    val awayInningRuns: List<Int?>, // [1, 0, 2, ...] null if not played yet
    val homeInningRuns: List<Int?>,
    val awayRuns: Int,
    val homeRuns: Int,
    val awayHits: Int,
    val homeHits: Int,
    val awayErrors: Int,
    val homeErrors: Int
)

@Serializable
enum class ScoringEventType {
    BALL,
    STRIKE,
    FOUL,
    SINGLE,
    DOUBLE,
    TRIPLE,
    HOME_RUN,
    WALK,
    HIT_BY_PITCH,
    STRIKEOUT,
    GROUNDOUT,
    FLYOUT,
    LINE_OUT,
    POP_OUT,
    ERROR,
    FIELDER_CHOICE,
    SACRIFICE_FLY,
    STOLEN_BASE,
    CAUGHT_STEALING,
    PICKED_OFF,
    WILD_PITCH,
    PASSED_BALL,
    BALK
}

@Serializable
data class PlayEvent(
    val id: Long? = null,
    val gameId: Long,
    val inning: Int,
    val half: HalfInning,
    val outsBefore: Int,
    val outsAfter: Int,
    val balls: Int,
    val strikes: Int,
    val batterName: String,
    val pitcherName: String,
    val eventType: ScoringEventType,
    val description: String,
    val runsScoredOnPlay: Int = 0,
    val timestamp: String // ISO 8601
)

@Serializable
data class PlayerBattingStats(
    val playerId: Long,
    val playerName: String,
    val jerseyNumber: Int,
    val position: String,
    val atBats: Int = 0,
    val runs: Int = 0,
    val hits: Int = 0,
    val rbi: Int = 0,
    val doubles: Int = 0,
    val triples: Int = 0,
    val homeRuns: Int = 0,
    val walks: Int = 0,
    val strikeOuts: Int = 0,
    val hitByPitch: Int = 0
)

@Serializable
data class PlayerPitchingStats(
    val playerId: Long,
    val playerName: String,
    val jerseyNumber: Int,
    val position: String,
    val inningsPitchedThirds: Int = 0, // e.g. 9 is 3.0 IP, 10 is 3.1 IP (3 and 1/3)
    val hitsAllowed: Int = 0,
    val runsAllowed: Int = 0,
    val earnedRuns: Int = 0,
    val walksAllowed: Int = 0,
    val strikeoutsRecorded: Int = 0,
    val homeRunsAllowed: Int = 0
)

@Serializable
data class BoxScore(
    val gameId: Long,
    val homeTeamName: String,
    val awayTeamName: String,
    val lineScore: LineScore,
    val homeBatting: List<PlayerBattingStats>,
    val awayBatting: List<PlayerBattingStats>,
    val homePitching: List<PlayerPitchingStats>,
    val awayPitching: List<PlayerPitchingStats>
)

@Serializable
data class TeamStandings(
    val teamId: Long,
    val teamName: String,
    val wins: Int,
    val losses: Int,
    val winPercentage: Double,
    val gamesPlayed: Int,
    val runsScored: Int,
    val runsAllowed: Int
)

@Serializable
data class SeasonDashboard(
    val seasonId: Long,
    val seasonName: String,
    val standings: List<TeamStandings>,
    val games: List<Game>
)

@Serializable
data class ScoringEventRequest(
    val eventType: ScoringEventType,
    val batterId: Long,
    val pitcherId: Long,
    val description: String? = null,
    val isDoublePlay: Boolean = false,
    val isError: Boolean = false,
    val runnerOutId: Long? = null,
    val runnerAdvanceMap: Map<String, Int>? = null
)

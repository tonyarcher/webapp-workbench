package com.baseball.entities

import com.baseball.models.*
import jakarta.persistence.*

data class GameRunnersDomainNames(
    val runnerFirstName: String? = null,
    val runnerSecondName: String? = null,
    val runnerThirdName: String? = null,
    val currentBatterName: String? = null,
    val currentPitcherName: String? = null,
)

@Entity
@Table(name = "leagues")
class LeagueEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    var name: String = "",
) {
    fun toDomain() = League(id = id, name = name)
}

@Entity
@Table(name = "seasons")
class SeasonEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    var leagueId: Long = 0L,
    var name: String = "",
    @Column(name = "season_year")
    var year: Int = 0,
) {
    fun toDomain() = Season(id = id, leagueId = leagueId, name = name, year = year)
}

@Entity
@Table(name = "teams")
class TeamEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    var name: String = "",
    var abbreviation: String = "",
    var city: String = "",
) {
    fun toDomain() = Team(id = id, name = name, abbreviation = abbreviation, city = city)
}

@Entity
@Table(name = "players")
class PlayerEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
    var teamId: Long? = null
    var name: String = ""
    @Column(name = "player_position")
    var position: String = ""
    var jerseyNumber: Int = 0
    var battingHand: String = "R"
    var throwingHand: String = "R"
    var deleted: Boolean = false

    constructor()
    constructor(
        id: Long? = null,
        name: String = "",
        position: String = "",
        teamId: Long? = null,
        jerseyNumber: Int = 0,
        battingHand: String = "R",
    ) {
        this.id = id
        this.name = name
        this.position = position
        this.teamId = teamId
        this.jerseyNumber = jerseyNumber
        this.battingHand = battingHand
    }

    fun toDomain() =
        Player(
            id = id,
            teamId = teamId,
            name = name,
            position = position,
            jerseyNumber = jerseyNumber,
            battingHand = battingHand,
            throwingHand = throwingHand,
            deleted = deleted,
        )
}

@Entity
@Table(name = "games")
class GameEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
    var seasonId: Long = 0L
    var homeTeamId: Long = 0L
    var awayTeamId: Long = 0L
    @Column(name = "game_date")
    var date: String = ""
    @Enumerated(EnumType.STRING)
    var status: GameStatus = GameStatus.SCHEDULED
    var homeScore: Int = 0
    var awayScore: Int = 0
    var homeHits: Int = 0
    var awayHits: Int = 0
    var homeErrors: Int = 0
    var awayErrors: Int = 0
    var inning: Int = 1
    @Enumerated(EnumType.STRING)
    var half: HalfInning = HalfInning.TOP
    var outs: Int = 0
    var balls: Int = 0
    var strikes: Int = 0
    var runnerFirstId: Long? = null
    var runnerSecondId: Long? = null
    var runnerThirdId: Long? = null
    var currentBatterId: Long? = null
    var currentPitcherId: Long? = null

    constructor()
    constructor(
        id: Long? = null,
        seasonId: Long = 0L,
        homeTeamId: Long = 0L,
        awayTeamId: Long = 0L,
        date: String = "",
        status: GameStatus = GameStatus.SCHEDULED,
    ) {
        this.id = id
        this.seasonId = seasonId
        this.homeTeamId = homeTeamId
        this.awayTeamId = awayTeamId
        this.date = date
        this.status = status
    }

    fun toDomain(
        homeTeam: Team,
        awayTeam: Team,
        names: GameRunnersDomainNames,
    ) = Game(
        id = id, seasonId = seasonId, homeTeam = homeTeam, awayTeam = awayTeam,
        date = date, status = status, homeScore = homeScore, awayScore = awayScore,
        homeHits = homeHits, awayHits = awayHits, homeErrors = homeErrors, awayErrors = awayErrors,
        gameState = GameState(
            inning = inning, half = half, outs = outs, balls = balls, strikes = strikes,
            runnerFirstId = runnerFirstId, runnerSecondId = runnerSecondId, runnerThirdId = runnerThirdId,
            runnerFirstName = names.runnerFirstName, runnerSecondName = names.runnerSecondName,
            runnerThirdName = names.runnerThirdName, currentBatterId = currentBatterId,
            currentBatterName = names.currentBatterName, currentPitcherId = currentPitcherId,
            currentPitcherName = names.currentPitcherName,
        ),
    )
}

@Entity
@Table(name = "game_innings")
class GameInningEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    var gameId: Long = 0L,
    var inning: Int = 1,
    var awayRuns: Int? = null,
    var homeRuns: Int? = null,
)

@Entity
@Table(name = "play_events")
class PlayEventEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
    var gameId: Long = 0L
    var inning: Int = 1
    @Enumerated(EnumType.STRING)
    var half: HalfInning = HalfInning.TOP
    var outsBefore: Int = 0
    var outsAfter: Int = 0
    var balls: Int = 0
    var strikes: Int = 0
    var batterName: String = ""
    var pitcherName: String = ""
    @Enumerated(EnumType.STRING)
    var eventType: ScoringEventType = ScoringEventType.SINGLE
    var description: String = ""
    var runsScoredOnPlay: Int = 0
    @Column(name = "event_timestamp")
    var timestamp: String = ""

    constructor()
    constructor(
        id: Long? = null,
        gameId: Long = 0L,
        batterName: String = "",
        pitcherName: String = "",
        eventType: ScoringEventType = ScoringEventType.SINGLE,
        description: String = "",
    ) {
        this.id = id
        this.gameId = gameId
        this.batterName = batterName
        this.pitcherName = pitcherName
        this.eventType = eventType
        this.description = description
    }

    fun toDomain() =
        PlayEvent(
            id = id, gameId = gameId, inning = inning, half = half,
            outsBefore = outsBefore, outsAfter = outsAfter, balls = balls, strikes = strikes,
            batterName = batterName, pitcherName = pitcherName, eventType = eventType,
            description = description, runsScoredOnPlay = runsScoredOnPlay, timestamp = timestamp,
        )
}

@Entity
@Table(name = "player_game_batting_stats")
class PlayerGameBattingStatsEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
    var gameId: Long = 0L
    var playerId: Long = 0L
    var teamId: Long = 0L
    var atBats: Int = 0
    var runs: Int = 0
    var hits: Int = 0
    var rbi: Int = 0
    var doubles: Int = 0
    var triples: Int = 0
    var homeRuns: Int = 0
    var walks: Int = 0
    var strikeOuts: Int = 0
    var hitByPitch: Int = 0

    constructor()
    constructor(
        id: Long? = null,
        gameId: Long = 0L,
        playerId: Long = 0L,
        teamId: Long = 0L,
        atBats: Int = 0,
        hits: Int = 0,
    ) {
        this.id = id
        this.gameId = gameId
        this.playerId = playerId
        this.teamId = teamId
        this.atBats = atBats
        this.hits = hits
    }

    fun toDomain(
        playerName: String,
        jerseyNumber: Int,
        position: String,
    ) = PlayerBattingStats(
        playerId = playerId, playerName = playerName, jerseyNumber = jerseyNumber, position = position,
        atBats = atBats, runs = runs, hits = hits, rbi = rbi, doubles = doubles, triples = triples,
        homeRuns = homeRuns, walks = walks, strikeOuts = strikeOuts, hitByPitch = hitByPitch,
    )
}

@Entity
@Table(name = "player_game_pitching_stats")
class PlayerGamePitchingStatsEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
    var gameId: Long = 0L
    var playerId: Long = 0L
    var teamId: Long = 0L
    var inningsPitchedThirds: Int = 0
    var hitsAllowed: Int = 0
    var runsAllowed: Int = 0
    var earnedRuns: Int = 0
    var walksAllowed: Int = 0
    var strikeoutsRecorded: Int = 0
    var homeRunsAllowed: Int = 0

    constructor()
    constructor(
        id: Long? = null,
        gameId: Long = 0L,
        playerId: Long = 0L,
        teamId: Long = 0L,
        inningsPitchedThirds: Int = 0,
        strikeoutsRecorded: Int = 0,
    ) {
        this.id = id
        this.gameId = gameId
        this.playerId = playerId
        this.teamId = teamId
        this.inningsPitchedThirds = inningsPitchedThirds
        this.strikeoutsRecorded = strikeoutsRecorded
    }

    fun toDomain(
        playerName: String,
        jerseyNumber: Int,
        position: String,
    ) = PlayerPitchingStats(
        playerId = playerId, playerName = playerName, jerseyNumber = jerseyNumber, position = position,
        inningsPitchedThirds = inningsPitchedThirds, hitsAllowed = hitsAllowed, runsAllowed = runsAllowed,
        earnedRuns = earnedRuns, walksAllowed = walksAllowed, strikeoutsRecorded = strikeoutsRecorded,
        homeRunsAllowed = homeRunsAllowed,
    )
}

@Entity
@Table(name = "users")
class UserEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(unique = true, nullable = false)
    var email: String = "",
    @Column(nullable = false)
    var passwordHash: String = "",
    var firstName: String = "",
    var lastName: String = "",
)

@Entity
@Table(name = "player_game_fielding_stats")
class PlayerGameFieldingStatsEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
    var gameId: Long = 0L
    var playerId: Long = 0L
    var teamId: Long = 0L
    var putouts: Int = 0
    var assists: Int = 0
    var errors: Int = 0

    constructor()

    fun toDomain(
        playerName: String,
        jerseyNumber: Int,
        position: String,
    ) = PlayerFieldingStats(
        playerId = playerId, playerName = playerName, jerseyNumber = jerseyNumber, position = position,
        putouts = putouts, assists = assists, errors = errors,
    )
}

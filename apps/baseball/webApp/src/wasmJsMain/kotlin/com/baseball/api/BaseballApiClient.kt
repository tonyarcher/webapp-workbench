package com.baseball.api

import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.League
import com.baseball.models.PlayEvent
import com.baseball.models.Player
import com.baseball.models.RegisterRequestDto
import com.baseball.models.ScoringEventRequest
import com.baseball.models.Season
import com.baseball.models.SeasonDashboard
import com.baseball.models.SeasonStats
import com.baseball.models.Team
import com.baseball.models.UserResponseDto
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.browser.window
import kotlinx.serialization.json.Json

private fun createHttpClient(): HttpClient = HttpClient {
    install(ContentNegotiation) {
        json(Json {
            ignoreUnknownKeys = true
            isLenient = true
        })
    }
    defaultRequest {
        val token = window.localStorage.getItem("auth_token")
        if (!token.isNullOrEmpty()) {
            header("Authorization", token)
        }
    }
}

private fun resolveBaseUrl(): String {
    val h = window.location.hostname
    val isLocalhost = h == "localhost" || h == "127.0.0.1" || h.isEmpty()
    return if (isLocalhost && window.location.port == "3000") {
        "http://localhost:8080"
    } else {
        "${window.location.protocol}//${window.location.host}"
    }
}

class AuthApiClient(private val client: HttpClient, private val baseUrl: String) : AuthApi {
    override suspend fun register(request: RegisterRequestDto): UserResponseDto =
        client.post("$baseUrl/api/auth/register") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()

    override suspend fun getMe(basicAuthToken: String): UserResponseDto =
        client.get("$baseUrl/api/auth/me") {
            header("Authorization", basicAuthToken)
        }.body()
}

class LeagueApiClient(private val client: HttpClient, private val baseUrl: String) : LeagueApi {
    override suspend fun getLeagues(): List<League> = client.get("$baseUrl/api/leagues").body()

    override suspend fun createLeague(league: League): League =
        client.post("$baseUrl/api/leagues") {
            contentType(ContentType.Application.Json)
            setBody(league)
        }.body()

    override suspend fun getSeasons(leagueId: Long): List<Season> =
        client.get("$baseUrl/api/seasons/by-league/$leagueId").body()

    override suspend fun createSeason(season: Season): Season =
        client.post("$baseUrl/api/seasons") {
            contentType(ContentType.Application.Json)
            setBody(season)
        }.body()

    override suspend fun getSeasonDashboard(seasonId: Long): SeasonDashboard =
        client.get("$baseUrl/api/seasons/$seasonId/dashboard").body()

    override suspend fun generateSchedule(seasonId: Long): List<Game> =
        client.post("$baseUrl/api/seasons/$seasonId/generate-schedule").body()

    override suspend fun getSeasonStats(seasonId: Long): SeasonStats =
        client.get("$baseUrl/api/seasons/$seasonId/stats").body()
}

class TeamApiClient(private val client: HttpClient, private val baseUrl: String) : TeamApi {
    override suspend fun getTeams(): List<Team> = client.get("$baseUrl/api/teams").body()

    override suspend fun createTeam(team: Team): Team =
        client.post("$baseUrl/api/teams") {
            contentType(ContentType.Application.Json)
            setBody(team)
        }.body()

    override suspend fun getTeamRoster(teamId: Long): List<Player> =
        client.get("$baseUrl/api/teams/$teamId/roster").body()

    override suspend fun getPlayers(): List<Player> = client.get("$baseUrl/api/players").body()

    override suspend fun createPlayer(player: Player): Player =
        client.post("$baseUrl/api/players") {
            contentType(ContentType.Application.Json)
            setBody(player)
        }.body()

    override suspend fun deletePlayer(playerId: Long) {
        client.delete("$baseUrl/api/players/$playerId")
    }
}

class GameApiClient(private val client: HttpClient, private val baseUrl: String) : GameApi {
    override suspend fun getGames(seasonId: Long): List<Game> =
        client.get("$baseUrl/api/games/by-season/$seasonId").body()

    override suspend fun getGame(gameId: Long): Game =
        client.get("$baseUrl/api/games/$gameId").body()

    override suspend fun createGame(game: Game): Game =
        client.post("$baseUrl/api/games") {
            contentType(ContentType.Application.Json)
            setBody(game)
        }.body()

    override suspend fun recordGameEvent(gameId: Long, request: ScoringEventRequest): Game =
        client.post("$baseUrl/api/games/$gameId/event") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()

    override suspend fun getGameBoxScore(gameId: Long): BoxScore =
        client.get("$baseUrl/api/games/$gameId/boxscore").body()

    override suspend fun getGameEvents(gameId: Long): List<PlayEvent> =
        client.get("$baseUrl/api/games/$gameId/events").body()

    override suspend fun resetGame(gameId: Long): Game =
        client.post("$baseUrl/api/games/$gameId/reset").body()

    override suspend fun startGame(gameId: Long): Game =
        client.post("$baseUrl/api/games/$gameId/start").body()
}

class BaseballApiClient private constructor(
    private val authApi: AuthApi,
    private val leagueApi: LeagueApi,
    private val teamApi: TeamApi,
    private val gameApi: GameApi,
) : BaseballApi, AuthApi by authApi, LeagueApi by leagueApi, TeamApi by teamApi, GameApi by gameApi {
    constructor() : this(createHttpClient(), resolveBaseUrl())

    private constructor(client: HttpClient, baseUrl: String) : this(
        AuthApiClient(client, baseUrl),
        LeagueApiClient(client, baseUrl),
        TeamApiClient(client, baseUrl),
        GameApiClient(client, baseUrl),
    )
}

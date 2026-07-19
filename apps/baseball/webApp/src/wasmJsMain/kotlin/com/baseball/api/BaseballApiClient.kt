package com.baseball.api

import com.baseball.models.*
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.browser.window
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class RegisterRequestDto(
    val email: String,
    val password: String,
    val firstName: String,
    val lastName: String,
)

@Serializable
data class UserResponseDto(
    val email: String,
    val firstName: String,
    val lastName: String,
)

class BaseballApiClient : BaseballApi {
    private val client =
        HttpClient {
            install(ContentNegotiation) {
                json(
                    Json {
                        ignoreUnknownKeys = true
                        isLenient = true
                    },
                )
            }
            defaultRequest {
                val token = window.localStorage.getItem("auth_token")
                if (!token.isNullOrEmpty()) {
                    header("Authorization", token)
                }
            }
        }

    private val baseUrl = run {
        val loc = kotlinx.browser.window.location
        if ((loc.hostname == "localhost" || loc.hostname == "127.0.0.1" || loc.hostname.isEmpty()) && loc.port == "3000") {
            "http://localhost:8080"
        } else {
            "${loc.protocol}//${loc.host}"
        }
    }

    override suspend fun register(request: RegisterRequestDto): UserResponseDto =
        client
            .post("$baseUrl/api/auth/register") {
                contentType(ContentType.Application.Json)
                setBody(request)
            }.body()

    override suspend fun getMe(basicAuthToken: String): UserResponseDto =
        client
            .get("$baseUrl/api/auth/me") {
                header("Authorization", basicAuthToken)
            }.body()

    override suspend fun getLeagues(): List<League> = client.get("$baseUrl/api/leagues").body()

    override suspend fun createLeague(league: League): League =
        client
            .post("$baseUrl/api/leagues") {
                contentType(ContentType.Application.Json)
                setBody(league)
            }.body()

    override suspend fun getSeasons(leagueId: Long): List<Season> = client.get("$baseUrl/api/seasons/by-league/$leagueId").body()

    override suspend fun createSeason(season: Season): Season =
        client
            .post("$baseUrl/api/seasons") {
                contentType(ContentType.Application.Json)
                setBody(season)
            }.body()

    override suspend fun getSeasonDashboard(seasonId: Long): SeasonDashboard = client.get("$baseUrl/api/seasons/$seasonId/dashboard").body()

    override suspend fun generateSchedule(seasonId: Long): List<Game> = client.post("$baseUrl/api/seasons/$seasonId/generate-schedule").body()

    override suspend fun getTeams(): List<Team> = client.get("$baseUrl/api/teams").body()

    override suspend fun createTeam(team: Team): Team =
        client
            .post("$baseUrl/api/teams") {
                contentType(ContentType.Application.Json)
                setBody(team)
            }.body()

    override suspend fun getTeamRoster(teamId: Long): List<Player> = client.get("$baseUrl/api/teams/$teamId/roster").body()

    override suspend fun getPlayers(): List<Player> = client.get("$baseUrl/api/players").body()

    override suspend fun createPlayer(player: Player): Player =
        client
            .post("$baseUrl/api/players") {
                contentType(ContentType.Application.Json)
                setBody(player)
            }.body()

    override suspend fun getGames(seasonId: Long): List<Game> = client.get("$baseUrl/api/games/by-season/$seasonId").body()

    override suspend fun getGame(gameId: Long): Game = client.get("$baseUrl/api/games/$gameId").body()

    override suspend fun createGame(game: Game): Game =
        client
            .post("$baseUrl/api/games") {
                contentType(ContentType.Application.Json)
                setBody(game)
            }.body()

    override suspend fun recordGameEvent(
        gameId: Long,
        request: ScoringEventRequest,
    ): Game =
        client
            .post("$baseUrl/api/games/$gameId/event") {
                contentType(ContentType.Application.Json)
                setBody(request)
            }.body()

    override suspend fun getGameBoxScore(gameId: Long): BoxScore = client.get("$baseUrl/api/games/$gameId/boxscore").body()

    override suspend fun getGameEvents(gameId: Long): List<PlayEvent> = client.get("$baseUrl/api/games/$gameId/events").body()

    override suspend fun deletePlayer(playerId: Long) {
        client.delete("$baseUrl/api/players/$playerId")
    }

    override suspend fun resetGame(gameId: Long): Game = client.post("$baseUrl/api/games/$gameId/reset").body()

    override suspend fun getSeasonStats(seasonId: Long): SeasonStats = client.get("$baseUrl/api/seasons/$seasonId/stats").body()
}

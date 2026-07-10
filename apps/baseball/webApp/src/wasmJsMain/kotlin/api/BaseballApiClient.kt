package com.baseball.api

import com.baseball.models.*
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.Json

class BaseballApiClient {
    private val client = HttpClient {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
            })
        }
    }

    private val baseUrl = "http://localhost:8080"

    suspend fun getLeagues(): List<League> {
        return client.get("$baseUrl/api/leagues").body()
    }

    suspend fun createLeague(league: League): League {
        return client.post("$baseUrl/api/leagues") {
            contentType(ContentType.Application.Json)
            setBody(league)
        }.body()
    }

    suspend fun getSeasons(leagueId: Long): List<Season> {
        return client.get("$baseUrl/api/seasons/by-league/$leagueId").body()
    }

    suspend fun createSeason(season: Season): Season {
        return client.post("$baseUrl/api/seasons") {
            contentType(ContentType.Application.Json)
            setBody(season)
        }.body()
    }

    suspend fun getSeasonDashboard(seasonId: Long): SeasonDashboard {
        return client.get("$baseUrl/api/seasons/$seasonId/dashboard").body()
    }

    suspend fun generateSchedule(seasonId: Long): List<Game> {
        return client.post("$baseUrl/api/seasons/$seasonId/generate-schedule").body()
    }

    suspend fun getTeams(): List<Team> {
        return client.get("$baseUrl/api/teams").body()
    }

    suspend fun createTeam(team: Team): Team {
        return client.post("$baseUrl/api/teams") {
            contentType(ContentType.Application.Json)
            setBody(team)
        }.body()
    }

    suspend fun getTeamRoster(teamId: Long): List<Player> {
        return client.get("$baseUrl/api/teams/$teamId/roster").body()
    }

    suspend fun getPlayers(): List<Player> {
        return client.get("$baseUrl/api/players").body()
    }

    suspend fun createPlayer(player: Player): Player {
        return client.post("$baseUrl/api/players") {
            contentType(ContentType.Application.Json)
            setBody(player)
        }.body()
    }

    suspend fun getGame(gameId: Long): Game {
        return client.get("$baseUrl/api/games/$gameId").body()
    }

    suspend fun createGame(game: Game): Game {
        return client.post("$baseUrl/api/games") {
            contentType(ContentType.Application.Json)
            setBody(game)
        }.body()
    }

    suspend fun recordGameEvent(gameId: Long, request: ScoringEventRequest): Game {
        return client.post("$baseUrl/api/games/$gameId/event") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }

    suspend fun getGameBoxScore(gameId: Long): BoxScore {
        return client.get("$baseUrl/api/games/$gameId/boxscore").body()
    }

    suspend fun getGameEvents(gameId: Long): List<PlayEvent> {
        return client.get("$baseUrl/api/games/$gameId/events").body()
    }
}

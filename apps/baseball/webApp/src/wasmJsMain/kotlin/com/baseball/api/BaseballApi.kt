package com.baseball.api

import com.baseball.models.*

interface BaseballApi {
    suspend fun register(request: RegisterRequestDto): UserResponseDto

    suspend fun getMe(basicAuthToken: String): UserResponseDto

    suspend fun getLeagues(): List<League>

    suspend fun createLeague(league: League): League

    suspend fun getSeasons(leagueId: Long): List<Season>

    suspend fun createSeason(season: Season): Season

    suspend fun getSeasonDashboard(seasonId: Long): SeasonDashboard

    suspend fun generateSchedule(seasonId: Long): List<Game>

    suspend fun getTeams(): List<Team>

    suspend fun createTeam(team: Team): Team

    suspend fun getTeamRoster(teamId: Long): List<Player>

    suspend fun getGames(seasonId: Long): List<Game>

    suspend fun getGame(gameId: Long): Game

    suspend fun getGameEvents(gameId: Long): List<PlayEvent>

    suspend fun getGameBoxScore(gameId: Long): BoxScore

    suspend fun recordGameEvent(
        gameId: Long,
        request: ScoringEventRequest,
    ): Game

    suspend fun getPlayers(): List<Player>

    suspend fun createPlayer(player: Player): Player

    suspend fun createGame(game: Game): Game

    suspend fun deletePlayer(playerId: Long)

    suspend fun resetGame(gameId: Long): Game

    suspend fun getSeasonStats(seasonId: Long): SeasonStats

    suspend fun startGame(gameId: Long): Game
}

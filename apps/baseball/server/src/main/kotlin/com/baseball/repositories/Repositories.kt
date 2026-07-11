package com.baseball.repositories

import com.baseball.entities.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface LeagueRepository : JpaRepository<LeagueEntity, Long>

@Repository
interface SeasonRepository : JpaRepository<SeasonEntity, Long> {
    fun findAllByLeagueId(leagueId: Long): List<SeasonEntity>
}

@Repository
interface TeamRepository : JpaRepository<TeamEntity, Long>

@Repository
interface PlayerRepository : JpaRepository<PlayerEntity, Long> {
    fun findAllByTeamId(teamId: Long): List<PlayerEntity>
}

@Repository
interface GameRepository : JpaRepository<GameEntity, Long> {
    fun findAllBySeasonId(seasonId: Long): List<GameEntity>
}

@Repository
interface GameInningRepository : JpaRepository<GameInningEntity, Long> {
    fun findAllByGameIdOrderByInningAsc(gameId: Long): List<GameInningEntity>
    fun findByGameIdAndInning(gameId: Long, inning: Int): GameInningEntity?
}

@Repository
interface PlayEventRepository : JpaRepository<PlayEventEntity, Long> {
    fun findAllByGameIdOrderByTimestampAsc(gameId: Long): List<PlayEventEntity>
}

@Repository
interface PlayerGameBattingStatsRepository : JpaRepository<PlayerGameBattingStatsEntity, Long> {
    fun findAllByGameId(gameId: Long): List<PlayerGameBattingStatsEntity>
    fun findByGameIdAndPlayerId(gameId: Long, playerId: Long): PlayerGameBattingStatsEntity?
}

@Repository
interface PlayerGamePitchingStatsRepository : JpaRepository<PlayerGamePitchingStatsEntity, Long> {
    fun findAllByGameId(gameId: Long): List<PlayerGamePitchingStatsEntity>
    fun findByGameIdAndPlayerId(gameId: Long, playerId: Long): PlayerGamePitchingStatsEntity?
}

@Repository
interface UserRepository : JpaRepository<UserEntity, Long> {
    fun findByEmail(email: String): UserEntity?
}

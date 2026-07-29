package com.baseball.services

import com.baseball.entities.GameInningEntity
import com.baseball.entities.PlayerGameBattingStatsEntity
import com.baseball.entities.PlayerGameFieldingStatsEntity
import com.baseball.entities.PlayerGamePitchingStatsEntity

class GamePlayStatsRecorder(private val repos: EventRecorderRepositories) {
    fun getOrCreateBattingStats(gameId: Long, playerId: Long): PlayerGameBattingStatsEntity {
        val existing = repos.battingRepository?.findByGameIdAndPlayerId(gameId, playerId)
        if (existing != null) return existing
        val player = repos.playerRepository.findById(playerId).orElse(null)
        val teamId = player?.teamId ?: 0L
        val entity = PlayerGameBattingStatsEntity().apply {
            this.gameId = gameId
            this.playerId = playerId
            this.teamId = teamId
        }
        repos.battingRepository?.save(entity)
        return entity
    }

    fun getOrCreatePitchingStats(gameId: Long, playerId: Long): PlayerGamePitchingStatsEntity {
        val existing = repos.pitchingRepository?.findByGameIdAndPlayerId(gameId, playerId)
        if (existing != null) return existing
        val player = repos.playerRepository.findById(playerId).orElse(null)
        val teamId = player?.teamId ?: 0L
        val entity = PlayerGamePitchingStatsEntity().apply {
            this.gameId = gameId
            this.playerId = playerId
            this.teamId = teamId
        }
        repos.pitchingRepository?.save(entity)
        return entity
    }

    fun getOrCreateFieldingStats(gameId: Long, playerId: Long): PlayerGameFieldingStatsEntity {
        val existing = repos.fieldingRepository?.findByGameIdAndPlayerId(gameId, playerId)
        if (existing != null) return existing
        val player = repos.playerRepository.findById(playerId).orElse(null)
        val teamId = player?.teamId ?: 0L
        val entity = PlayerGameFieldingStatsEntity().apply {
            this.gameId = gameId
            this.playerId = playerId
            this.teamId = teamId
        }
        repos.fieldingRepository?.save(entity)
        return entity
    }

    fun incrementFieldingStats(
        gameId: Long,
        playerId: Long,
        putouts: Int = 0,
        assists: Int = 0,
        errors: Int = 0,
    ) {
        val stats = getOrCreateFieldingStats(gameId, playerId)
        stats.putouts += putouts
        stats.assists += assists
        stats.errors += errors
        repos.fieldingRepository?.save(stats)
    }

    fun getOrCreateInningRuns(gameId: Long, inning: Int): GameInningEntity {
        val existing = repos.gameInningRepository.findByGameIdAndInning(gameId, inning)
        if (existing != null) return existing
        return repos.gameInningRepository.save(
            GameInningEntity(
                gameId = gameId,
                inning = inning,
                awayRuns = 0,
                homeRuns = 0,
            )
        )
    }
}

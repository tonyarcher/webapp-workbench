package com.baseball.services

import com.baseball.repositories.GameInningRepository

data class LineScoreParams(
    val gameId: Long,
    val gameInningRepository: GameInningRepository,
    val awayScore: Int,
    val homeScore: Int,
    val awayHits: Int,
    val homeHits: Int,
    val awayErrors: Int,
    val homeErrors: Int
)

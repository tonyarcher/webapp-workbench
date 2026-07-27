package com.baseball.services

import com.baseball.ServerConstants
import com.baseball.models.LineScore
import com.baseball.repositories.GameInningRepository

fun createLineScore(params: LineScoreParams): LineScore {
    val innings = params.gameInningRepository.findAllByGameIdOrderByInningAsc(params.gameId)
    val maxInnings = maxOf(
        ServerConstants.MIN_COMPLETION_INNING,
        innings.maxOfOrNull { it.inning } ?: ServerConstants.MIN_COMPLETION_INNING
    )
    val awayInningRuns = mutableListOf<Int?>()
    val homeInningRuns = mutableListOf<Int?>()
    for (i in 1..maxInnings) {
        val inn = innings.find { it.inning == i }
        awayInningRuns.add(inn?.awayRuns)
        homeInningRuns.add(inn?.homeRuns)
    }
    return LineScore(
        gameId = params.gameId,
        awayInningRuns = awayInningRuns,
        homeInningRuns = homeInningRuns,
        awayRuns = params.awayScore,
        homeRuns = params.homeScore,
        awayHits = params.awayHits,
        homeHits = params.homeHits,
        awayErrors = params.awayErrors,
        homeErrors = params.homeErrors,
    )
}

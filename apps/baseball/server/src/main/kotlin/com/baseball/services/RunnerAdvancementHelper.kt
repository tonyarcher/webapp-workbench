package com.baseball.services

object RunnerAdvancementHelper {
    fun advanceRunnersOnWalk(state: RunnerState) {
        val g = state.game
        val b = state.batter
        val r1 = state.r1
        val r2 = state.r2
        val r3 = state.r3
        val rList = state.runsScoredList

        if (r1 != null) {
            if (r2 != null) {
                if (r3 != null) rList.add(r3)
                g.runnerThirdId = r2
                g.runnerSecondId = r1
                g.runnerFirstId = b.id
            } else {
                g.runnerSecondId = r1
                g.runnerFirstId = b.id
            }
        } else {
            g.runnerFirstId = b.id
        }
    }

    fun advanceRunnersSingle(state: RunnerState) {
        val g = state.game
        val b = state.batter
        val r1 = state.r1
        val r2 = state.r2
        val r3 = state.r3
        val rList = state.runsScoredList

        if (r3 != null) rList.add(r3)
        g.runnerThirdId = r2
        g.runnerSecondId = r1
        g.runnerFirstId = b.id
    }

    fun advanceRunnersDouble(state: RunnerState) {
        val g = state.game
        val b = state.batter
        val r1 = state.r1
        val r2 = state.r2
        val r3 = state.r3
        val rList = state.runsScoredList

        if (r3 != null) rList.add(r3)
        if (r2 != null) rList.add(r2)
        g.runnerThirdId = r1
        g.runnerSecondId = b.id
        g.runnerFirstId = null
    }

    fun advanceRunnersTriple(state: RunnerState) {
        val g = state.game
        val b = state.batter
        val r1 = state.r1
        val r2 = state.r2
        val r3 = state.r3
        val rList = state.runsScoredList

        if (r3 != null) rList.add(r3)
        if (r2 != null) rList.add(r2)
        if (r1 != null) rList.add(r1)
        g.runnerThirdId = b.id
        g.runnerSecondId = null
        g.runnerFirstId = null
    }

    fun advanceRunnersHomeRun(state: RunnerState) {
        val g = state.game
        val b = state.batter
        val r1 = state.r1
        val r2 = state.r2
        val r3 = state.r3
        val rList = state.runsScoredList

        if (r3 != null) rList.add(r3)
        if (r2 != null) rList.add(r2)
        if (r1 != null) rList.add(r1)
        rList.add(b.id!!)
        g.runnerThirdId = null
        g.runnerSecondId = null
        g.runnerFirstId = null
    }

    fun advanceRunnersOnHit(basesMoved: Int, state: RunnerState) {
        when (basesMoved) {
            1 -> advanceRunnersSingle(state)
            2 -> advanceRunnersDouble(state)
            3 -> advanceRunnersTriple(state)
            4 -> advanceRunnersHomeRun(state)
        }
    }
}

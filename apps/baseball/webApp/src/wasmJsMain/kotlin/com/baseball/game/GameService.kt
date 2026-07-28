package com.baseball.game

interface GameService {
    fun initGame(forceReset: Boolean = false)

    fun recordPlayEvent(input: PlayEventInput)
}

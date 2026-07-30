package com.baseball.game

import kotlinx.browser.window
import kotlinx.serialization.json.Json

internal const val KEY_LOCAL_GAME_STATE = "local_game_state"

fun saveLocalState() {
    try {
        val state = buildCurrentLocalGameState()
        val json = Json.encodeToString(LocalGameState.serializer(), state)
        window.localStorage.setItem(KEY_LOCAL_GAME_STATE, json)
    } catch (e: kotlinx.serialization.SerializationException) {
        println("Error saving local state: ${e.message}")
    } catch (e: IllegalStateException) {
        println("Error saving local state: ${e.message}")
    }
}

fun loadLocalState(): Boolean {
    var result = false
    try {
        val json = window.localStorage.getItem(KEY_LOCAL_GAME_STATE)
        if (json != null) {
            val state = Json.decodeFromString(LocalGameState.serializer(), json)
            applyLoadedLocalGameState(state)
            result = true
        }
    } catch (e: kotlinx.serialization.SerializationException) {
        println("Error loading local state: ${e.message}")
    } catch (e: IllegalStateException) {
        println("Error loading local state: ${e.message}")
    }
    return result
}

internal fun buildCurrentLocalGameState(): LocalGameState = LocalGameState(
    game = localGame,
    events = localEvents,
    boxScore = localBoxScore,
    homeRoster = localHomeRoster,
    awayRoster = localAwayRoster,
    awayLineup = localAwayLineup,
    homeLineup = localHomeLineup,
    awayBench = localAwayBench,
    homeBench = localHomeBench,
    awayBatterIndex = localAwayBatterIndex,
    homeBatterIndex = localHomeBatterIndex,
    playersSubbedOut = localPlayersSubbedOut.toList(),
    awayActivePitcherId = localAwayActivePitcherId,
    awayActivePitcherName = localAwayActivePitcherName,
    homeActivePitcherId = localHomeActivePitcherId,
    homeActivePitcherName = localHomeActivePitcherName,
    useDh = localUseDh,
    initialAwayLineup = initialAwayLineup.toList(),
    initialHomeLineup = initialHomeLineup.toList(),
    initialAwayBench = initialAwayBench.toList(),
    initialHomeBench = initialHomeBench.toList(),
    initialAwayActivePitcherId = initialAwayActivePitcherId,
    initialAwayActivePitcherName = initialAwayActivePitcherName,
    initialHomeActivePitcherId = initialHomeActivePitcherId,
    initialHomeActivePitcherName = initialHomeActivePitcherName,
)

internal fun applyLoadedLocalGameState(state: LocalGameState) {
    localGame = state.game
    localEvents.clear()
    localEvents.addAll(state.events)
    localBoxScore = state.boxScore
    applyRosterState(state)
    applyInitialConfigState(state)
}

private fun applyRosterState(state: LocalGameState) {
    localHomeRoster = state.homeRoster
    localAwayRoster = state.awayRoster
    localAwayLineup.clear(); localAwayLineup.addAll(state.awayLineup)
    localHomeLineup.clear(); localHomeLineup.addAll(state.homeLineup)
    localAwayBench.clear(); localAwayBench.addAll(state.awayBench)
    localHomeBench.clear(); localHomeBench.addAll(state.homeBench)
    localAwayBatterIndex = state.awayBatterIndex
    localHomeBatterIndex = state.homeBatterIndex
    localPlayersSubbedOut.clear(); localPlayersSubbedOut.addAll(state.playersSubbedOut)
    localAwayActivePitcherId = state.awayActivePitcherId
    localAwayActivePitcherName = state.awayActivePitcherName
    localHomeActivePitcherId = state.homeActivePitcherId
    localHomeActivePitcherName = state.homeActivePitcherName
}

private fun applyInitialConfigState(state: LocalGameState) {
    localUseDh = state.useDh
    initialAwayLineup.clear(); initialAwayLineup.addAll(state.initialAwayLineup)
    initialHomeLineup.clear(); initialHomeLineup.addAll(state.initialHomeLineup)
    initialAwayBench.clear(); initialAwayBench.addAll(state.initialAwayBench)
    initialHomeBench.clear(); initialHomeBench.addAll(state.initialHomeBench)
    initialAwayActivePitcherId = state.initialAwayActivePitcherId
    initialAwayActivePitcherName = state.initialAwayActivePitcherName
    initialHomeActivePitcherId = state.initialHomeActivePitcherId
    initialHomeActivePitcherName = state.initialHomeActivePitcherName
}

internal fun parseAdvanceMap(description: String): Map<String, Int>? {
    val marker = " | Adv: "
    if (!description.contains(marker)) return null
    val parts = description.substringAfter(marker).split(",")
    val map = mutableMapOf<String, Int>()
    parts.forEach { part ->
        val pair = part.split("->")
        if (pair.size == 2) {
            val base = pair[1].toIntOrNull()
            if (base != null) map[pair[0]] = base
        }
    }
    return map
}

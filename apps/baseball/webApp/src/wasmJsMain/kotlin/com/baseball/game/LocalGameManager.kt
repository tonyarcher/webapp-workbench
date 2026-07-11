package com.baseball.game

import com.baseball.models.*
import com.baseball.seed.SeedData
import com.baseball.Constants
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.browser.window

@Serializable
data class LocalGameState(
    val game: Game?,
    val events: List<PlayEvent>,
    val boxScore: BoxScore?,
    val homeRoster: List<Player>,
    val awayRoster: List<Player>,
    val awayLineup: List<Player>,
    val homeLineup: List<Player>,
    val awayBench: List<Player>,
    val homeBench: List<Player>,
    val awayBatterIndex: Int,
    val homeBatterIndex: Int,
    val playersSubbedOut: List<Long>,
    val awayActivePitcherId: Long,
    val awayActivePitcherName: String,
    val homeActivePitcherId: Long,
    val homeActivePitcherName: String
)

var localGame: Game? = null
val localEvents = mutableListOf<PlayEvent>()
var localBoxScore: BoxScore? = null
var localHomeRoster = emptyList<Player>()
var localAwayRoster = emptyList<Player>()

val localAwayLineup = mutableListOf<Player>()
val localHomeLineup = mutableListOf<Player>()
val localAwayBench = mutableListOf<Player>()
val localHomeBench = mutableListOf<Player>()

var localAwayBatterIndex = 0
var localHomeBatterIndex = 0
val localPlayersSubbedOut = mutableSetOf<Long>()

var localAwayActivePitcherId = SeedData.cardinalsRoster.find { it.position == Constants.Positions.P }?.id ?: 210L
var localAwayActivePitcherName = SeedData.cardinalsRoster.find { it.position == Constants.Positions.P }?.name ?: "Sonny Gray"
var localHomeActivePitcherId = SeedData.cubsRoster.find { it.position == Constants.Positions.P }?.id ?: 110L
var localHomeActivePitcherName = SeedData.cubsRoster.find { it.position == Constants.Positions.P }?.name ?: "Justin Steele"

object LocalGameManager : GameService {

    override fun initLocalGame(forceReset: Boolean) {
        if (!forceReset && loadLocalState()) {
            return
        }
        val chc = SeedData.teamCubs
        val stl = SeedData.teamCardinals
        
        localHomeRoster = SeedData.cubsRoster
        localAwayRoster = SeedData.cardinalsRoster
        
        val homeP = localHomeRoster.find { it.position == Constants.Positions.P } ?: Player(110L, 1L, "Justin Steele", Constants.Positions.P, 35, "L", "L")
        val awayP = localAwayRoster.find { it.position == Constants.Positions.P } ?: Player(210L, 2L, "Sonny Gray", Constants.Positions.P, 54, "R", "R")
        
        localAwayActivePitcherId = awayP.id!!
        localAwayActivePitcherName = awayP.name
        localHomeActivePitcherId = homeP.id!!
        localHomeActivePitcherName = homeP.name

        localAwayLineup.clear()
        localAwayLineup.addAll(localAwayRoster.filter { it.position != Constants.Positions.P }.take(9))
        localAwayBench.clear()
        localAwayBench.addAll(localAwayRoster.filter { it.position == Constants.Positions.P && it.id != localAwayActivePitcherId } + localAwayRoster.drop(10))
        localAwayBatterIndex = 0

        localHomeLineup.clear()
        localHomeLineup.addAll(localHomeRoster.filter { it.position != Constants.Positions.P }.take(9))
        localHomeBench.clear()
        localHomeBench.addAll(localHomeRoster.filter { it.position == Constants.Positions.P && it.id != localHomeActivePitcherId } + localHomeRoster.drop(10))
        localHomeBatterIndex = 0

        localPlayersSubbedOut.clear()

        val firstAwayBatter = localAwayLineup.firstOrNull() ?: localAwayRoster.first()

        localGame = Game(
            id = 1L,
            seasonId = 1L,
            homeTeam = chc,
            awayTeam = stl,
            date = "2026-07-10",
            status = GameStatus.SCHEDULED,
            homeScore = 0,
            awayScore = 0,
            homeHits = 0,
            awayHits = 0,
            homeErrors = 0,
            awayErrors = 0,
            gameState = GameState(
                inning = 1,
                half = HalfInning.TOP,
                outs = 0,
                balls = 0,
                strikes = 0,
                runnerFirstId = null,
                runnerSecondId = null,
                runnerThirdId = null,
                runnerFirstName = null,
                runnerSecondName = null,
                runnerThirdName = null,
                currentBatterId = firstAwayBatter.id,
                currentBatterName = firstAwayBatter.name,
                currentPitcherId = localHomeActivePitcherId,
                currentPitcherName = localHomeActivePitcherName
            )
        )
        
        localBoxScore = BoxScore(
            gameId = 1L,
            homeTeamName = chc.name,
            awayTeamName = stl.name,
            lineScore = LineScore(
                gameId = 1L,
                awayRuns = 0,
                homeRuns = 0,
                awayHits = 0,
                homeHits = 0,
                awayErrors = 0,
                homeErrors = 0,
                awayInningRuns = emptyList(),
                homeInningRuns = emptyList()
            ),
            homeBatting = (localHomeLineup + localHomeBench.filter { it.position != Constants.Positions.P }).map { PlayerBattingStats(it.id!!, it.name, it.jerseyNumber, it.position) },
            awayBatting = (localAwayLineup + localAwayBench.filter { it.position != Constants.Positions.P }).map { PlayerBattingStats(it.id!!, it.name, it.jerseyNumber, it.position) },
            homePitching = (localHomeRoster.filter { it.position == Constants.Positions.P } + localHomeBench.filter { it.position == Constants.Positions.P }).map { PlayerPitchingStats(it.id!!, it.name, it.jerseyNumber, it.position) },
            awayPitching = (localAwayRoster.filter { it.position == Constants.Positions.P } + localAwayBench.filter { it.position == Constants.Positions.P }).map { PlayerPitchingStats(it.id!!, it.name, it.jerseyNumber, it.position) }
        )
        
        localEvents.clear()
        saveLocalState()
    }

    override fun recordLocalPlayEvent(
        eventType: ScoringEventType,
        batterId: Long,
        pitcherId: Long,
        descriptionDetail: String?,
        isDoublePlay: Boolean,
        isError: Boolean,
        runnerAdvanceMap: Map<String, Int>?
    ) {
        recordLocalPlayEventInternal(
            eventType = eventType,
            batterId = batterId,
            pitcherId = pitcherId,
            descriptionDetail = descriptionDetail,
            isDoublePlay = isDoublePlay,
            isError = isError,
            runnerAdvanceMap = runnerAdvanceMap
        )
    }
}

fun initLocalGame(forceReset: Boolean = false) {
    LocalGameManager.initLocalGame(forceReset)
}

fun recordLocalPlayEvent(
    eventType: ScoringEventType,
    batterId: Long,
    pitcherId: Long,
    descriptionDetail: String? = null,
    isDoublePlay: Boolean = false,
    isError: Boolean = false,
    runnerAdvanceMap: Map<String, Int>? = null
) {
    LocalGameManager.recordLocalPlayEvent(
        eventType = eventType,
        batterId = batterId,
        pitcherId = pitcherId,
        descriptionDetail = descriptionDetail,
        isDoublePlay = isDoublePlay,
        isError = isError,
        runnerAdvanceMap = runnerAdvanceMap
    )
}

fun saveLocalState() {
    try {
        val state = LocalGameState(
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
            homeActivePitcherName = localHomeActivePitcherName
        )
        val json = Json.encodeToString(LocalGameState.serializer(), state)
        window.localStorage.setItem(Constants.KEY_LOCAL_GAME_STATE, json)
    } catch (e: Exception) {
        println("Error saving local state: ${e.message}")
    }
}

fun loadLocalState(): Boolean {
    try {
        val json = window.localStorage.getItem(Constants.KEY_LOCAL_GAME_STATE) ?: return false
        val state = Json.decodeFromString(LocalGameState.serializer(), json)
        
        localGame = state.game
        localEvents.clear()
        localEvents.addAll(state.events)
        localBoxScore = state.boxScore
        localHomeRoster = state.homeRoster
        localAwayRoster = state.awayRoster
        
        localAwayLineup.clear()
        localAwayLineup.addAll(state.awayLineup)
        localHomeLineup.clear()
        localHomeLineup.addAll(state.homeLineup)
        localAwayBench.clear()
        localAwayBench.addAll(state.awayBench)
        localHomeBench.clear()
        localHomeBench.addAll(state.homeBench)
        
        localAwayBatterIndex = state.awayBatterIndex
        localHomeBatterIndex = state.homeBatterIndex
        localPlayersSubbedOut.clear()
        localPlayersSubbedOut.addAll(state.playersSubbedOut)
        
        localAwayActivePitcherId = state.awayActivePitcherId
        localAwayActivePitcherName = state.awayActivePitcherName
        localHomeActivePitcherId = state.homeActivePitcherId
        localHomeActivePitcherName = state.homeActivePitcherName
        return true
    } catch (e: Exception) {
        println("Error loading local state: ${e.message}")
        return false
    }
}

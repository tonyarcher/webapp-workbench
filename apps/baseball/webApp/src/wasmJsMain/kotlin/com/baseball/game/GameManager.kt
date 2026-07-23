package com.baseball.game

import com.baseball.BaseballConstants
import com.baseball.game.engine.PlayInput
import com.baseball.models.*
import com.baseball.seed.SeedData
import kotlinx.browser.window
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

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
    val homeActivePitcherName: String,
    // Cached initial configurations for resetting
    val useDh: Boolean = true,
    val initialAwayLineup: List<Player> = emptyList(),
    val initialHomeLineup: List<Player> = emptyList(),
    val initialAwayBench: List<Player> = emptyList(),
    val initialHomeBench: List<Player> = emptyList(),
    val initialAwayActivePitcherId: Long = 0L,
    val initialAwayActivePitcherName: String = "",
    val initialHomeActivePitcherId: Long = 0L,
    val initialHomeActivePitcherName: String = "",
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

var localAwayActivePitcherId = SeedData.cardinalsRoster.find { it.position == BaseballConstants.Positions.P }?.id ?: 210L
var localAwayActivePitcherName = SeedData.cardinalsRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Sonny Gray"
var localHomeActivePitcherId = SeedData.cubsRoster.find { it.position == BaseballConstants.Positions.P }?.id ?: 110L
var localHomeActivePitcherName = SeedData.cubsRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Justin Steele"

// Initial configurations cache
var localUseDh = true
val initialAwayLineup = mutableListOf<Player>()
val initialHomeLineup = mutableListOf<Player>()
val initialAwayBench = mutableListOf<Player>()
val initialHomeBench = mutableListOf<Player>()
var initialAwayActivePitcherId = 0L
var initialAwayActivePitcherName = ""
var initialHomeActivePitcherId = 0L
var initialHomeActivePitcherName = ""

// Callback interface or delegate to notify UI to open lineup setup dialog
var onOpenLineupSetupDialog: (() -> Unit)? = null

fun clearLiveScorerCache() {
    localAwayLineup.clear()
    localHomeLineup.clear()
    localAwayBench.clear()
    localHomeBench.clear()
    localAwayBatterIndex = 0
    localHomeBatterIndex = 0
    localPlayersSubbedOut.clear()
    initialAwayLineup.clear()
    initialHomeLineup.clear()
    initialAwayBench.clear()
    initialHomeBench.clear()
    initialAwayActivePitcherId = 0L
    initialAwayActivePitcherName = ""
    initialHomeActivePitcherId = 0L
    initialHomeActivePitcherName = ""
}

object GameManager : GameService {
    private fun initDefaultGameSession() {
        val chc = SeedData.teamCubs
        val stl = SeedData.teamCardinals

        localHomeRoster = SeedData.cubsRoster
        localAwayRoster = SeedData.cardinalsRoster

        val homeP = localHomeRoster.find { it.position == BaseballConstants.Positions.P }
            ?: Player(110L, 1L, "Justin Steele", BaseballConstants.Positions.P, 35, "L", "L")
        val awayP = localAwayRoster.find { it.position == BaseballConstants.Positions.P }
            ?: Player(210L, 2L, "Sonny Gray", BaseballConstants.Positions.P, 54, "R", "R")

        val homeLineupPlayers = localHomeRoster.filter { it.position != BaseballConstants.Positions.P }.take(9)
        val awayLineupPlayers = localAwayRoster.filter { it.position != BaseballConstants.Positions.P }.take(9)
        val homeBenchPlayers = localHomeRoster.filter { it.position == BaseballConstants.Positions.P && it.id != homeP.id } + localHomeRoster.drop(10)
        val awayBenchPlayers = localAwayRoster.filter { it.position == BaseballConstants.Positions.P && it.id != awayP.id } + localAwayRoster.drop(10)

        startNewGame(
            homeTeam = chc,
            awayTeam = stl,
            homeLineup = homeLineupPlayers,
            awayLineup = awayLineupPlayers,
            homeBench = homeBenchPlayers,
            awayBench = awayBenchPlayers,
            homeActivePitcherId = homeP.id!!,
            awayActivePitcherId = awayP.id!!,
            useDh = true,
        )
    }

    override fun initGame(forceReset: Boolean) {
        if (!forceReset && loadLocalState()) {
            return
        }
        initDefaultGameSession()
    }

    private fun createCurrentSessionState(game: Game, boxScore: BoxScore): GameSessionState =
        GameSessionState(
            game = game,
            boxScore = boxScore,
            homeRoster = localHomeRoster,
            awayRoster = localAwayRoster,
            homeLineup = localHomeLineup,
            awayLineup = localAwayLineup,
            homeBench = localHomeBench,
            awayBench = localAwayBench,
            homeBatterIndex = localHomeBatterIndex,
            awayBatterIndex = localAwayBatterIndex,
            playersSubbedOut = localPlayersSubbedOut.toList(),
            homeActivePitcherId = localHomeActivePitcherId,
            homeActivePitcherName = localHomeActivePitcherName,
            awayActivePitcherId = localAwayActivePitcherId,
            awayActivePitcherName = localAwayActivePitcherName,
        )

    @Suppress("LongParameterList")
    override fun recordPlayEvent(
        eventType: ScoringEventType,
        batterId: Long,
        pitcherId: Long,
        descriptionDetail: String?,
        isDoublePlay: Boolean,
        isError: Boolean,
        runnerAdvanceMap: Map<String, Int>?,
    ) {
        val game = localGame ?: return
        val boxScore = localBoxScore ?: return
        val currentState = createCurrentSessionState(game, boxScore)

        val playInput = PlayInput(
            eventType = eventType,
            batterId = batterId,
            pitcherId = pitcherId,
            descriptionDetail = descriptionDetail,
            isDoublePlay = isDoublePlay,
            isError = isError,
            runnerAdvanceMap = runnerAdvanceMap,
            nextEventId = (localEvents.size + 1).toLong(),
        )
        val (nextState, ev) = PlayEngine.processPlay(state = currentState, input = playInput)

        localGame = nextState.game
        localBoxScore = nextState.boxScore
        localHomeBatterIndex = nextState.homeBatterIndex
        localAwayBatterIndex = nextState.awayBatterIndex

        localEvents.add(ev)
        saveLocalState()
    }
}

fun initGame(forceReset: Boolean = false) {
    GameManager.initGame(forceReset)
}

@Suppress("LongParameterList")
fun recordPlayEvent(
    eventType: ScoringEventType,
    batterId: Long,
    pitcherId: Long,
    descriptionDetail: String? = null,
    isDoublePlay: Boolean = false,
    isError: Boolean = false,
    runnerAdvanceMap: Map<String, Int>? = null,
) {
    GameManager.recordPlayEvent(
        eventType = eventType,
        batterId = batterId,
        pitcherId = pitcherId,
        descriptionDetail = descriptionDetail,
        isDoublePlay = isDoublePlay,
        isError = isError,
        runnerAdvanceMap = runnerAdvanceMap,
    )
}

private fun initializeGameRosters(
    homeTeam: Team,
    awayTeam: Team,
    homeLineup: List<Player>,
    awayLineup: List<Player>,
    homeBench: List<Player>,
    awayBench: List<Player>,
    homeActivePitcherId: Long,
    awayActivePitcherId: Long,
) {
    val homeActiveP = (homeLineup + homeBench).find { it.id == homeActivePitcherId }
    localHomeRoster = if (homeActiveP == null) {
        val defaultP = SeedData.cubsRoster.find { it.id == homeActivePitcherId }
            ?: Player(homeActivePitcherId, homeTeam.id, "Pitcher", "P", 99, "R", "R")
        homeLineup + homeBench + defaultP
    } else {
        homeLineup + homeBench
    }

    val awayActiveP = (awayLineup + awayBench).find { it.id == awayActivePitcherId }
    localAwayRoster = if (awayActiveP == null) {
        val defaultP = SeedData.cardinalsRoster.find { it.id == awayActivePitcherId }
            ?: Player(awayActivePitcherId, awayTeam.id, "Pitcher", "P", 99, "R", "R")
        awayLineup + awayBench + defaultP
    } else {
        awayLineup + awayBench
    }

    localHomeActivePitcherId = homeActivePitcherId
    localHomeActivePitcherName = localHomeRoster.find { it.id == homeActivePitcherId }?.name ?: "Pitcher"
    localAwayActivePitcherId = awayActivePitcherId
    localAwayActivePitcherName = localAwayRoster.find { it.id == awayActivePitcherId }?.name ?: "Pitcher"

    localAwayLineup.clear()
    localAwayLineup.addAll(awayLineup)
    localAwayBench.clear()
    localAwayBench.addAll(awayBench)
    localAwayBatterIndex = 0

    localHomeLineup.clear()
    localHomeLineup.addAll(homeLineup)
    localHomeBench.clear()
    localHomeBench.addAll(homeBench)
    localHomeBatterIndex = 0

    localPlayersSubbedOut.clear()
}

private fun cacheInitialGameConfig(
    homeLineup: List<Player>,
    awayLineup: List<Player>,
    homeBench: List<Player>,
    awayBench: List<Player>,
    useDh: Boolean,
) {
    localUseDh = useDh
    initialAwayLineup.clear()
    initialAwayLineup.addAll(awayLineup)
    initialHomeLineup.clear()
    initialHomeLineup.addAll(homeLineup)
    initialAwayBench.clear()
    initialAwayBench.addAll(awayBench)
    initialHomeBench.clear()
    initialHomeBench.addAll(homeBench)
    initialAwayActivePitcherId = localAwayActivePitcherId
    initialAwayActivePitcherName = localAwayActivePitcherName
    initialHomeActivePitcherId = localHomeActivePitcherId
    initialHomeActivePitcherName = localHomeActivePitcherName
}

private fun createNewGameSession(homeTeam: Team, awayTeam: Team, useDh: Boolean) {
    val firstAwayBatter = localAwayLineup.firstOrNull() ?: localAwayRoster.first()

    localGame = Game(
        id = 1L,
        seasonId = 1L,
        homeTeam = homeTeam,
        awayTeam = awayTeam,
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
            currentPitcherName = localHomeActivePitcherName,
        ),
    )

    localBoxScore = BoxScore(
        gameId = 1L,
        homeTeamName = homeTeam.name,
        awayTeamName = awayTeam.name,
        lineScore = LineScore(
            gameId = 1L,
            awayRuns = 0,
            homeRuns = 0,
            awayHits = 0,
            homeHits = 0,
            awayErrors = 0,
            homeErrors = 0,
            awayInningRuns = emptyList(),
            homeInningRuns = emptyList(),
        ),
        homeBatting = localHomeLineup.map { PlayerBattingStats(it.id!!, it.name, it.jerseyNumber, it.position) } +
            localHomeBench.filter { useDh || it.position != BaseballConstants.Positions.P }
                .map { PlayerBattingStats(it.id!!, it.name, it.jerseyNumber, it.position) },
        awayBatting = localAwayLineup.map { PlayerBattingStats(it.id!!, it.name, it.jerseyNumber, it.position) } +
            localAwayBench.filter { useDh || it.position != BaseballConstants.Positions.P }
                .map { PlayerBattingStats(it.id!!, it.name, it.jerseyNumber, it.position) },
        homePitching = localHomeRoster.filter { it.position == BaseballConstants.Positions.P }
            .map { PlayerPitchingStats(it.id!!, it.name, it.jerseyNumber, it.position) },
        awayPitching = localAwayRoster.filter { it.position == BaseballConstants.Positions.P }
            .map { PlayerPitchingStats(it.id!!, it.name, it.jerseyNumber, it.position) },
    )

    localEvents.clear()
    saveLocalState()
}

@Suppress("LongParameterList")
fun startNewGame(
    homeTeam: Team,
    awayTeam: Team,
    homeLineup: List<Player>,
    awayLineup: List<Player>,
    homeBench: List<Player>,
    awayBench: List<Player>,
    homeActivePitcherId: Long,
    awayActivePitcherId: Long,
    useDh: Boolean,
) {
    initializeGameRosters(
        homeTeam = homeTeam,
        awayTeam = awayTeam,
        homeLineup = homeLineup,
        awayLineup = awayLineup,
        homeBench = homeBench,
        awayBench = awayBench,
        homeActivePitcherId = homeActivePitcherId,
        awayActivePitcherId = awayActivePitcherId,
    )
    cacheInitialGameConfig(
        homeLineup = homeLineup,
        awayLineup = awayLineup,
        homeBench = homeBench,
        awayBench = awayBench,
        useDh = useDh,
    )
    createNewGameSession(homeTeam, awayTeam, useDh)
}

fun resetLocalGame(toInitialLineups: Boolean) {
    if (toInitialLineups) {
        val homeT = localGame?.homeTeam ?: SeedData.teamCubs
        val awayT = localGame?.awayTeam ?: SeedData.teamCardinals
        startNewGame(
            homeTeam = homeT,
            awayTeam = awayT,
            homeLineup = initialHomeLineup.toList(),
            awayLineup = initialAwayLineup.toList(),
            homeBench = initialHomeBench.toList(),
            awayBench = initialAwayBench.toList(),
            homeActivePitcherId = initialHomeActivePitcherId,
            awayActivePitcherId = initialAwayActivePitcherId,
            useDh = localUseDh,
        )
    } else {
        onOpenLineupSetupDialog?.invoke()
    }
}

private fun buildCurrentLocalGameState(): LocalGameState = LocalGameState(
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

fun saveLocalState() {
    try {
        val state = buildCurrentLocalGameState()
        val json = Json.encodeToString(LocalGameState.serializer(), state)
        window.localStorage.setItem(BaseballConstants.KEY_LOCAL_GAME_STATE, json)
    } catch (e: Exception) {
        println("Error saving local state: ${e.message}")
    }
}

private fun applyLoadedLocalGameState(state: LocalGameState) {
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

    localUseDh = state.useDh
    initialAwayLineup.clear()
    initialAwayLineup.addAll(state.initialAwayLineup)
    initialHomeLineup.clear()
    initialHomeLineup.addAll(state.initialHomeLineup)
    initialAwayBench.clear()
    initialAwayBench.addAll(state.initialAwayBench)
    initialHomeBench.clear()
    initialHomeBench.addAll(state.initialHomeBench)
    initialAwayActivePitcherId = state.initialAwayActivePitcherId
    initialAwayActivePitcherName = state.initialAwayActivePitcherName
    initialHomeActivePitcherId = state.initialHomeActivePitcherId
    initialHomeActivePitcherName = state.initialHomeActivePitcherName
}

fun loadLocalState(): Boolean {
    try {
        val json = window.localStorage.getItem(BaseballConstants.KEY_LOCAL_GAME_STATE) ?: return false
        val state = Json.decodeFromString(LocalGameState.serializer(), json)
        applyLoadedLocalGameState(state)
        return true
    } catch (e: Exception) {
        println("Error loading local state: ${e.message}")
        return false
    }
}

private fun parseAdvanceMap(description: String): Map<String, Int>? {
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

fun undoLastLocalEvent() {
    if (localEvents.isEmpty()) return
    val eventsToReplay = localEvents.dropLast(1)

    val homeT = localGame?.homeTeam ?: SeedData.teamCubs
    val awayT = localGame?.awayTeam ?: SeedData.teamCardinals
    startNewGame(
        homeTeam = homeT,
        awayTeam = awayT,
        homeLineup = initialHomeLineup.toList(),
        awayLineup = initialAwayLineup.toList(),
        homeBench = initialHomeBench.toList(),
        awayBench = initialAwayBench.toList(),
        homeActivePitcherId = initialHomeActivePitcherId,
        awayActivePitcherId = initialAwayActivePitcherId,
        useDh = localUseDh,
    )

    eventsToReplay.forEach { ev ->
        val cleanDesc = ev.description.substringBefore(" | Adv:")
        val advanceMap = parseAdvanceMap(ev.description)
        val allRoster = localAwayRoster + localHomeRoster
        val bId = allRoster.find { it.name == ev.batterName }?.id ?: localGame!!.gameState.currentBatterId!!
        val pId = allRoster.find { it.name == ev.pitcherName }?.id ?: localGame!!.gameState.currentPitcherId!!

        recordPlayEvent(
            eventType = ev.eventType,
            batterId = bId,
            pitcherId = pId,
            descriptionDetail = cleanDesc,
            isDoublePlay = ev.description.contains("(Double Play)"),
            isError = ev.description.contains("(with Error)"),
            runnerAdvanceMap = advanceMap,
        )
    }
}

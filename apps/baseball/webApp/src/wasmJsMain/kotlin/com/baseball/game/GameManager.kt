package com.baseball.game

import com.baseball.game.engine.PlayInput
import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.PlayEvent
import com.baseball.models.Player
import com.baseball.models.Team
import com.baseball.seed.SeedData
import kotlinx.serialization.Serializable

const val P = "P"

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

var localAwayActivePitcherId = SeedData.cardinalsRoster.find { it.position == P }
    ?.id ?: 210L
var localAwayActivePitcherName = SeedData.cardinalsRoster.find {
    it.position == P
}
    ?.name ?: "Sonny Gray"
var localHomeActivePitcherId = SeedData.cubsRoster.find {
    it.position == P
}
    ?.id ?: 110L
var localHomeActivePitcherName = SeedData.cubsRoster.find {
    it.position == P
}
    ?.name ?: "Justin Steele"

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

object GameManager : GameService {
    private fun initDefaultGameSession() {
        val chc = SeedData.teamCubs
        val stl = SeedData.teamCardinals

        localHomeRoster = SeedData.cubsRoster
        localAwayRoster = SeedData.cardinalsRoster

        val homeP = localHomeRoster.find { it.position == P }
            ?: Player(110L, 1L, "Justin Steele", P, 35, "L", "L")
        val awayP = localAwayRoster.find { it.position == P }
            ?: Player(210L, 2L, "Sonny Gray", P, 54, "R", "R")

        val homeLineupPlayers = localHomeRoster.filter { it.position != P }.take(9)
        val awayLineupPlayers = localAwayRoster.filter { it.position != P }.take(9)
        val homeBenchPlayers = localHomeRoster.filter {
            it.position == P && it.id != homeP.id
        } + localHomeRoster.drop(10)
        val awayBenchPlayers = localAwayRoster.filter {
            it.position == P && it.id != awayP.id
        } + localAwayRoster.drop(10)

        startNewGame(
            homeTeam = chc,
            awayTeam = stl,
            homeConfig = TeamLineupConfig(homeLineupPlayers, homeBenchPlayers, homeP.id!!),
            awayConfig = TeamLineupConfig(awayLineupPlayers, awayBenchPlayers, awayP.id!!),
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

    override fun recordPlayEvent(input: PlayEventInput) {
        val game = localGame ?: return
        val boxScore = localBoxScore ?: return
        val currentState = createCurrentSessionState(game, boxScore)

        val playInput = PlayInput(
            eventType = input.eventType,
            batterId = input.batterId,
            pitcherId = input.pitcherId,
            descriptionDetail = input.descriptionDetail,
            isDoublePlay = input.isDoublePlay,
            isError = input.isError,
            runnerAdvanceMap = input.runnerAdvanceMap,
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

fun recordPlayEvent(input: PlayEventInput) {
    GameManager.recordPlayEvent(input)
}

private fun initializeGameRosters(
    homeTeam: Team,
    awayTeam: Team,
    homeConfig: TeamLineupConfig,
    awayConfig: TeamLineupConfig,
) {
    val result = setupGameRosters(homeTeam, awayTeam, homeConfig, awayConfig)
    localHomeRoster = result.homeRoster
    localAwayRoster = result.awayRoster
    localHomeActivePitcherId = homeConfig.activePitcherId
    localHomeActivePitcherName = result.homeActivePitcherName
    localAwayActivePitcherId = awayConfig.activePitcherId
    localAwayActivePitcherName = result.awayActivePitcherName
    localAwayLineup.clear(); localAwayLineup.addAll(awayConfig.lineup)
    localAwayBench.clear(); localAwayBench.addAll(awayConfig.bench)
    localAwayBatterIndex = 0
    localHomeLineup.clear(); localHomeLineup.addAll(homeConfig.lineup)
    localHomeBench.clear(); localHomeBench.addAll(homeConfig.bench)
    localHomeBatterIndex = 0
    localPlayersSubbedOut.clear()
}

private fun createNewGameSession(
    homeTeam: Team,
    awayTeam: Team,
    useDh: Boolean,
    homeConfig: TeamLineupConfig,
    awayConfig: TeamLineupConfig,
) {
    val (game, boxScore) = buildNewGameSession(
        homeTeam = homeTeam,
        awayTeam = awayTeam,
        useDh = useDh,
        homeConfig = homeConfig,
        awayConfig = awayConfig,
    )
    localGame = game
    localBoxScore = boxScore
    localEvents.clear()
    saveLocalState()
}

fun startNewGame(
    homeTeam: Team,
    awayTeam: Team,
    homeConfig: TeamLineupConfig,
    awayConfig: TeamLineupConfig,
    useDh: Boolean,
) {
    initializeGameRosters(homeTeam, awayTeam, homeConfig, awayConfig)
    localUseDh = useDh
    initialAwayLineup.clear()
    initialAwayLineup.addAll(awayConfig.lineup)
    initialHomeLineup.clear()
    initialHomeLineup.addAll(homeConfig.lineup)
    initialAwayBench.clear()
    initialAwayBench.addAll(awayConfig.bench)
    initialHomeBench.clear()
    initialHomeBench.addAll(homeConfig.bench)
    initialAwayActivePitcherId = localAwayActivePitcherId
    initialAwayActivePitcherName = localAwayActivePitcherName
    initialHomeActivePitcherId = localHomeActivePitcherId
    initialHomeActivePitcherName = localHomeActivePitcherName
    createNewGameSession(homeTeam, awayTeam, useDh, homeConfig, awayConfig)
}

fun resetLocalGame(toInitialLineups: Boolean) {
    if (toInitialLineups) {
        val homeT = localGame?.homeTeam ?: SeedData.teamCubs
        val awayT = localGame?.awayTeam ?: SeedData.teamCardinals
        startNewGame(
            homeTeam = homeT,
            awayTeam = awayT,
            homeConfig = TeamLineupConfig(
                initialHomeLineup.toList(),
                initialHomeBench.toList(),
                initialHomeActivePitcherId,
            ),
            awayConfig = TeamLineupConfig(
                initialAwayLineup.toList(),
                initialAwayBench.toList(),
                initialAwayActivePitcherId,
            ),
            useDh = localUseDh,
        )
    } else {
        onOpenLineupSetupDialog?.invoke()
    }
}


fun undoLastLocalEvent() {
    if (localEvents.isEmpty()) return
    val eventsToReplay = localEvents.dropLast(1)
    resetToInitialGame()
    replayEvents(eventsToReplay)
}

private fun resetToInitialGame() {
    val homeT = localGame?.homeTeam ?: SeedData.teamCubs
    val awayT = localGame?.awayTeam ?: SeedData.teamCardinals
    startNewGame(
        homeTeam = homeT,
        awayTeam = awayT,
        homeConfig = TeamLineupConfig(
            initialHomeLineup.toList(),
            initialHomeBench.toList(),
            initialHomeActivePitcherId,
        ),
        awayConfig = TeamLineupConfig(
            initialAwayLineup.toList(),
            initialAwayBench.toList(),
            initialAwayActivePitcherId,
        ),
        useDh = localUseDh,
    )
}

private fun replayEvents(events: List<PlayEvent>) {
    events.forEach { ev ->
        val cleanDesc = ev.description.substringBefore(" | Adv:")
        val advanceMap = parseAdvanceMap(ev.description)
        val allRoster = localAwayRoster + localHomeRoster
        val bId = allRoster.find { it.name == ev.batterName }?.id ?: localGame!!.gameState.currentBatterId!!
        val pId = allRoster.find { it.name == ev.pitcherName }?.id ?: localGame!!.gameState.currentPitcherId!!

        recordPlayEvent(
            PlayEventInput(
                eventType = ev.eventType,
                batterId = bId,
                pitcherId = pId,
                descriptionDetail = cleanDesc,
                isDoublePlay = ev.description.contains("(Double Play)"),
                isError = ev.description.contains("(with Error)"),
                runnerAdvanceMap = advanceMap,
            ),
        )
    }
}

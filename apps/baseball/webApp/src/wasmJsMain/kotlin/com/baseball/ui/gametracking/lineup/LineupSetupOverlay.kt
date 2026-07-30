package com.baseball.ui.gametracking.lineup

import com.baseball.models.Player
import com.baseball.seed.SeedData
import com.baseball.ui.state.AppViewManager
import com.baseball.ui.state.isSingleGameMode
import com.baseball.ui.state.renderCurrentTab
import org.w3c.dom.HTMLElement

var isLineupDialogOpen = false

private fun getDefaultPosition(index: Int): String =
    when (index) {
        0 -> "DH"
        1 -> "C"
        2 -> "1B"
        3 -> "2B"
        4 -> "3B"
        5 -> "SS"
        6 -> "LF"
        7 -> "CF"
        8 -> "RF"
        else -> "DH"
    }


class LineupSetupOverlay(
    private val container: HTMLElement,
    private val homeRosterParam: List<Player> = emptyList(),
    private val awayRosterParam: List<Player> = emptyList(),
    private val homeTeamParam: com.baseball.models.Team? = null,
    private val awayTeamParam: com.baseball.models.Team? = null,
) {
    private var useDh = true
    private var homeTeam = SeedData.teamCubs
    private var awayTeam = SeedData.teamCardinals

    private val awayLineupInputs =
        MutableList(9) { index ->
            val pos = if (index == 0) "DH" else getDefaultPosition(index)
            PlayerInputs("", "", pos)
        }

    private val homeLineupInputs =
        MutableList(9) { index ->
            val pos = if (index == 0) "DH" else getDefaultPosition(index)
            PlayerInputs("", "", pos)
        }

    private var awayPitcherNameInput = ""
    private var awayPitcherNumberInput = ""
    private var homePitcherNameInput = ""
    private var homePitcherNumberInput = ""

    private var validationError: String? = null

    private val setAwayPitcher = { n: String, num: String -> awayPitcherNameInput = n; awayPitcherNumberInput = num }
    private val setHomePitcher = { n: String, num: String -> homePitcherNameInput = n; homePitcherNumberInput = num }


    private fun createLineupCallbacks(): LineupCallbacks {
        val cubs = SeedData.cubsRoster
        val cards = SeedData.cardinalsRoster
        fun dhToggle(newVal: Boolean) {
            useDh = newVal
            validationError = null
            adjustLineupPositions(
                LineupAdjustConfig(
                    useDh, awayLineupInputs, homeLineupInputs,
                    awayPitcherNameInput, awayPitcherNumberInput,
                    homePitcherNameInput, homePitcherNumberInput
                )
            )
            render()
        }

        fun loadDefault() {
            validationError = null
            val cfg = PopulateRostersConfig(useDh, awayLineupInputs, homeLineupInputs, setAwayPitcher, setHomePitcher)
            populateWithRosters(cubs, cards, cfg)
            render()
        }

        fun doRandom() {
            validationError = null
            populateRostersWithRandom(useDh, awayLineupInputs, homeLineupInputs, setAwayPitcher, setHomePitcher)
            render()
        }
        return LineupCallbacks(
            onDhToggle = ::dhToggle,
            onLoadDefault = ::loadDefault,
            onRandom = ::doRandom,
            onBack = { isLineupDialogOpen = false; AppViewManager.goBackToWelcome() },
            onStartSave = createOnStartSave(
                CurrentLineupState(
                    homeTeam, awayTeam, useDh,
                    awayLineupInputs, homeLineupInputs,
                    awayPitcherNameInput, awayPitcherNumberInput,
                    homePitcherNameInput, homePitcherNumberInput
                ),
                isSingleGameMode,
                { validationError = it },
                { isLineupDialogOpen = false; renderCurrentTab() },
                { render() }
            ),
        )
    }

    init {
        if (homeTeamParam != null) homeTeam = homeTeamParam
        if (awayTeamParam != null) awayTeam = awayTeamParam
        populateWithRosters(
            homeRosterParam,
            awayRosterParam,
            PopulateRostersConfig(useDh, awayLineupInputs, homeLineupInputs, setAwayPitcher, setHomePitcher)
        )
    }


    fun render() {
        container.innerHTML = ""
        val cb = createLineupCallbacks()
        renderOverlayContainer(container) {
            renderModalContent(
                useDh,
                validationError,
                LineupUiContext(
                    useDh, awayTeam.name, homeTeam.name,
                    awayLineupInputs, homeLineupInputs,
                    awayPitcherNameInput, awayPitcherNumberInput,
                    homePitcherNameInput, homePitcherNumberInput
                ),
                LineupPitcherChangeHandlers(
                    onAwayPitcherNameChange = { newName: String -> awayPitcherNameInput = newName },
                    onAwayPitcherNumberChange = { newNumber: String -> awayPitcherNumberInput = newNumber },
                    onHomePitcherNameChange = { newName: String -> homePitcherNameInput = newName },
                    onHomePitcherNumberChange = { newNumber: String -> homePitcherNumberInput = newNumber }
                ),
                cb
            )
        }
    }
}


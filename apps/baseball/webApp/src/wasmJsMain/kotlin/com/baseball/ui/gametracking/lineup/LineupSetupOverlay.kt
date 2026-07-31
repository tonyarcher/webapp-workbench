package com.baseball.ui.gametracking.lineup

import com.baseball.models.Player
import com.baseball.models.Team
import com.baseball.seed.SeedData
import com.baseball.ui.state.goBackToWelcome
import com.baseball.ui.state.isSingleGameMode
import com.baseball.ui.state.renderCurrentTab
import kotlinx.browser.document
import org.w3c.dom.Element
import org.w3c.dom.HTMLElement

var isLineupDialogOpen = false

class LineupSetupOverlay(
    private val container: HTMLElement,
    private val homeRosterParam: List<Player> = emptyList(),
    private val awayRosterParam: List<Player> = emptyList(),
    private val homeTeamParam: Team? = null,
    private val awayTeamParam: Team? = null,
) {
    private var useDh = true
    private var homeTeam = homeTeamParam ?: SeedData.teamCubs
    private var awayTeam = awayTeamParam ?: SeedData.teamCardinals

    private val awayLineupInputs = MutableList(9) { index ->
        PlayerInputs("", "", if (index == 0) "DH" else getDefaultPos(index))
    }

    private val homeLineupInputs = MutableList(9) { index ->
        PlayerInputs("", "", if (index == 0) "DH" else getDefaultPos(index))
    }

    private var awayPitcherNameInput = ""
    private var awayPitcherNumberInput = ""
    private var homePitcherNameInput = ""
    private var homePitcherNumberInput = ""

    private var validationError: String? = null

    private val setAwayPitcher = { n: String, num: String ->
        awayPitcherNameInput = n
        awayPitcherNumberInput = num
    }
    private val setHomePitcher = { n: String, num: String ->
        homePitcherNameInput = n
        homePitcherNumberInput = num
    }

    init {
        populateWithRosters(
            homeRosterParam,
            awayRosterParam,
            PopulateRostersConfig(useDh, awayLineupInputs, homeLineupInputs, setAwayPitcher, setHomePitcher)
        )
    }

    fun render() {
        container.innerHTML = ""
        val element = document.createElement("baseball-lineup-setup")
        element.setAttribute("away-team-name", awayTeam.name)
        element.setAttribute("home-team-name", homeTeam.name)
        validationError?.let { element.setAttribute("validation-error", it) }

        bindEvents(element)
        container.appendChild(element)
    }

    private fun bindEvents(element: Element) {
        element.addEventListener("cancel-lineup", {
            isLineupDialogOpen = false
            goBackToWelcome()
        })

        element.addEventListener("load-defaults", {
            validationError = null
            populateWithRosters(
                SeedData.cubsRoster,
                SeedData.cardinalsRoster,
                PopulateRostersConfig(useDh, awayLineupInputs, homeLineupInputs, setAwayPitcher, setHomePitcher)
            )
            render()
        })

        element.addEventListener("randomize-lineup", {
            validationError = null
            populateRostersWithRandom(useDh, awayLineupInputs, homeLineupInputs, setAwayPitcher, setHomePitcher)
            render()
        })

        element.addEventListener("start-game", { handleStartGameEvent() })
    }

    private fun handleStartGameEvent() {
        val config = CurrentLineupState(
            homeTeam, awayTeam, useDh,
            awayLineupInputs, homeLineupInputs,
            awayPitcherNameInput, awayPitcherNumberInput,
            homePitcherNameInput, homePitcherNumberInput
        )
        val onStart = createOnStartSave(
            config,
            isSingleGameMode,
            { err -> validationError = err },
            { isLineupDialogOpen = false; renderCurrentTab() },
            { render() }
        )
        onStart()
    }

    private fun getDefaultPos(index: Int): String = when (index) {
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
}

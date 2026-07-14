package com.baseball.ui.components

import com.baseball.UiConstants
import com.baseball.BaseballConstants
import com.baseball.models.Player
import com.baseball.models.Team
import com.baseball.game.startNewGame
import com.baseball.ui.*
import com.baseball.seed.SeedData
import org.w3c.dom.*
import kotlinx.browser.document
import kotlin.random.Random
import kotlinx.html.*
import kotlinx.html.js.*
import kotlinx.html.dom.*

var isLineupDialogOpen = false

class LineupSetupOverlay(private val container: HTMLElement) : DomBuilder {

    private var useDh = true
    private var homeTeam = SeedData.teamCubs
    private var awayTeam = SeedData.teamCardinals

    private val awayLineupInputs = MutableList(9) { index ->
        val pos = if (index == 0) "DH" else getDefaultPosition(index)
        PlayerInputs("", "", pos)
    }

    private val homeLineupInputs = MutableList(9) { index ->
        val pos = if (index == 0) "DH" else getDefaultPosition(index)
        PlayerInputs("", "", pos)
    }

    private var awayPitcherNameInput = ""
    private var awayPitcherNumberInput = ""
    private var homePitcherNameInput = ""
    private var homePitcherNumberInput = ""

    private var validationError: String? = null

    init {
        populateWithRosters(useSeedRosters = true)
    }

    private fun getDefaultPosition(index: Int): String {
        return when (index) {
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

    private fun populateWithRosters(useSeedRosters: Boolean) {
        if (useSeedRosters) {
            val awayRoster = SeedData.cardinalsRoster
            val homeRoster = SeedData.cubsRoster

            val awayP = awayRoster.find { it.position == BaseballConstants.Positions.P }
            awayPitcherNameInput = awayP?.name ?: "Sonny Gray"
            awayPitcherNumberInput = awayP?.jerseyNumber?.toString() ?: "54"

            val homeP = homeRoster.find { it.position == BaseballConstants.Positions.P }
            homePitcherNameInput = homeP?.name ?: "Justin Steele"
            homePitcherNumberInput = homeP?.jerseyNumber?.toString() ?: "35"

            if (useDh) {
                val awayBatters = awayRoster.filter { it.position != BaseballConstants.Positions.P }.take(9)
                awayBatters.forEachIndexed { i, p ->
                    awayLineupInputs[i] = PlayerInputs(p.name, p.jerseyNumber.toString(), p.position)
                }
                val homeBatters = homeRoster.filter { it.position != BaseballConstants.Positions.P }.take(9)
                homeBatters.forEachIndexed { i, p ->
                    homeLineupInputs[i] = PlayerInputs(p.name, p.jerseyNumber.toString(), p.position)
                }
            } else {
                val awayBatters = awayRoster.filter { it.position != BaseballConstants.Positions.P }.take(8)
                awayBatters.forEachIndexed { i, p ->
                    awayLineupInputs[i] = PlayerInputs(p.name, p.jerseyNumber.toString(), p.position)
                }
                awayLineupInputs[8] = PlayerInputs(awayPitcherNameInput, awayPitcherNumberInput, "P")

                val homeBatters = homeRoster.filter { it.position != BaseballConstants.Positions.P }.take(8)
                homeBatters.forEachIndexed { i, p ->
                    homeLineupInputs[i] = PlayerInputs(p.name, p.jerseyNumber.toString(), p.position)
                }
                homeLineupInputs[8] = PlayerInputs(homePitcherNameInput, homePitcherNumberInput, "P")
            }
        } else {
            val firstNames = listOf(
                "Babe", "Slider", "Fastball", "Windup", "HomeRun", "Bunt", "Knuckle", "Curve", "Spitball",
                "Slugger", "Spanky", "Shorty", "Flash", "Scoop", "Dusty", "Lefty", "Stretch", "Catfish",
                "Dizzy", "Yogi", "Skip", "Hammerin'", "Outlaw", "Blaze", "Ace", "Rusty", "Chippy"
            )
            val lastNames = listOf(
                "Ruthless", "McGavin", "Freddie", "Willie", "Harry", "Master", "Jones", "Rodriguez", "O'Malley",
                "Swinger", "Slugson", "Smacker", "Speedy", "Gloveman", "Aces", "Striker", "Grandslam", "Outlaw",
                "Biggs", "Thunder", "Blaze", "Hammer", "Winn", "Steele", "Gray", "Bonds", "Ripken"
            )

            fun randomPlayer(pos: String): PlayerInputs {
                val name = "${firstNames.random()} ${lastNames.random()}"
                val num = Random.nextInt(1, 100).toString()
                return PlayerInputs(name, num, pos)
            }

            val randomAwayP = randomPlayer("P")
            awayPitcherNameInput = randomAwayP.name
            awayPitcherNumberInput = randomAwayP.jerseyNumber

            val randomHomeP = randomPlayer("P")
            homePitcherNameInput = randomHomeP.name
            homePitcherNumberInput = randomHomeP.jerseyNumber

            val positions = listOf("C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH")
            val selectedAwayPositions = if (useDh) positions else positions.filter { it != "DH" } + "P"
            val selectedHomePositions = if (useDh) positions else positions.filter { it != "DH" } + "P"

            for (i in 0..8) {
                awayLineupInputs[i] = randomPlayer(selectedAwayPositions[i])
                homeLineupInputs[i] = randomPlayer(selectedHomePositions[i])
            }
        }
    }

    fun render() {
        container.innerHTML = ""

        container.div {
            style = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(10, 15, 30, 0.8); backdrop-filter: blur(12px); display: flex; align-items: flex-start; justify-content: center; z-index: 10000; overflow-y: auto; padding: 2rem 1rem;"

            div(classes = "lineup-modal-content card") {
                style = "width: 100%; max-width: 1000px; padding: 2rem; box-shadow: 0 10px 40px rgba(0,0,0,0.5);"

                h1 {
                    +"Game Roster & Lineup Setup"
                    style = "text-align: center; margin-bottom: 1.5rem;"
                }

                val errorMsg = validationError
                if (errorMsg != null) {
                    div(classes = "server-error-banner") {
                        +errorMsg
                        style = "margin-bottom: 1rem;"
                    }
                }

                div {
                    style = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; background: rgba(255, 255, 255, 0.03); padding: 1rem; border-radius: 8px;"

                    label {
                        style = "display: flex; align-items: center; gap: 0.5rem; cursor: pointer;"
                        input(type = InputType.checkBox) {
                            checked = useDh
                            onChangeFunction = { event ->
                                useDh = (event.target as HTMLInputElement).checked
                                validationError = null
                                adjustLineupPositions()
                                render()
                            }
                        }
                        span {
                            +"Enable Designated Hitter (DH)"
                            style = "font-weight: bold;"
                        }
                    }

                    div {
                        style = "display: flex; gap: 0.75rem;"
                        button(classes = "btn btn-secondary") {
                            +"Load Default Roster"
                            onClickFunction = {
                                validationError = null
                                populateWithRosters(useSeedRosters = true)
                                render()
                            }
                        }
                        button(classes = "btn btn-action") {
                            +"Populate Random Example Data"
                            style = "background: linear-gradient(135deg, #3b82f6, #8b5cf6);"
                            onClickFunction = {
                                validationError = null
                                populateWithRosters(useSeedRosters = false)
                                render()
                            }
                        }
                    }
                }

                div {
                    style = "display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;"

                    renderTeamColumn(isHome = false)
                    renderTeamColumn(isHome = true)
                }

                div {
                    style = "display: flex; justify-content: space-between; margin-top: 1.5rem;"
                    button(classes = "btn btn-secondary") {
                        +"← Go Back to Welcome"
                        onClickFunction = {
                            isLineupDialogOpen = false
                            AppViewManager.goBackToWelcome()
                        }
                    }
                    button(classes = "btn btn-primary") {
                        +"⚾ Start & Save Game"
                        onClickFunction = {
                            if (validateAndSave()) {
                                isLineupDialogOpen = false
                                renderCurrentTab()
                            } else {
                                render()
                            }
                        }
                    }
                }
            }
        }
    }

    private fun adjustLineupPositions() {
        if (useDh) {
            if (awayLineupInputs[8].position == "P") {
                awayLineupInputs[8] = PlayerInputs(awayLineupInputs[8].name, awayLineupInputs[8].jerseyNumber, "RF")
            }
            if (awayLineupInputs[0].position != "DH") {
                awayLineupInputs[0] = PlayerInputs(awayLineupInputs[0].name, awayLineupInputs[0].jerseyNumber, "DH")
            }
            if (homeLineupInputs[8].position == "P") {
                homeLineupInputs[8] = PlayerInputs(homeLineupInputs[8].name, homeLineupInputs[8].jerseyNumber, "RF")
            }
            if (homeLineupInputs[0].position != "DH") {
                homeLineupInputs[0] = PlayerInputs(homeLineupInputs[0].name, homeLineupInputs[0].jerseyNumber, "DH")
            }
        } else {
            if (awayLineupInputs[0].position == "DH") {
                awayLineupInputs[0] = PlayerInputs(awayLineupInputs[0].name, awayLineupInputs[0].jerseyNumber, "LF")
            }
            awayLineupInputs[8] = PlayerInputs(awayPitcherNameInput, awayPitcherNumberInput, "P")
            if (homeLineupInputs[0].position == "DH") {
                homeLineupInputs[0] = PlayerInputs(homeLineupInputs[0].name, homeLineupInputs[0].jerseyNumber, "LF")
            }
            homeLineupInputs[8] = PlayerInputs(homePitcherNameInput, homePitcherNumberInput, "P")
        }
    }

    private fun DIV.renderTeamColumn(isHome: Boolean) {
        div {
            style = "background: rgba(255, 255, 255, 0.02); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);"

            h2 {
                +(if (isHome) "Home Team: ${homeTeam.name}" else "Away Team: ${awayTeam.name}")
                style = "color: " + (if (isHome) "var(--accent-yellow);" else "var(--accent-blue);") + " margin-bottom: 1rem;"
            }

            if (useDh) {
                div {
                    style = "display: flex; gap: 0.5rem; margin-bottom: 1.25rem; padding-bottom: 1rem; border-bottom: 1px dashed rgba(255,255,255,0.1); align-items: center;"
                    span {
                        +"Starting Pitcher:"
                        style = "font-weight: bold; width: 100px;"
                    }
                    input(type = InputType.text, classes = "form-control") {
                        placeholder = "Pitcher Name"
                        value = if (isHome) homePitcherNameInput else awayPitcherNameInput
                        style = "flex: 1;"
                        onChangeFunction = { event ->
                            val txt = (event.target as HTMLInputElement).value
                            if (isHome) homePitcherNameInput = txt else awayPitcherNameInput = txt
                        }
                    }
                    input(type = InputType.number, classes = "form-control") {
                        placeholder = "No."
                        value = if (isHome) homePitcherNumberInput else awayPitcherNumberInput
                        style = "width: 60px;"
                        onChangeFunction = { event ->
                            val txt = (event.target as HTMLInputElement).value
                            if (isHome) homePitcherNumberInput = txt else awayPitcherNumberInput = txt
                        }
                    }
                }
            }

            div {
                style = "display: grid; grid-template-columns: 40px 1fr 60px 80px; gap: 0.5rem; margin-bottom: 0.5rem; padding: 0 0.5rem; font-weight: bold; color: rgba(255,255,255,0.6);"
                div { +"Slot" }
                div { +"Batter Name" }
                div { +"No." }
                div { +"Pos" }
            }

            val list = if (isHome) homeLineupInputs else awayLineupInputs
            for (i in 0..8) {
                val item = list[i]
                div {
                    style = "display: grid; grid-template-columns: 40px 1fr 60px 80px; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center;"

                    span {
                        +"${i + 1}"
                        style = "text-align: center; color: rgba(255,255,255,0.4); font-weight: bold;"
                    }

                    input(type = InputType.text, classes = "form-control") {
                        placeholder = "Enter Player Name"
                        value = item.name
                        onChangeFunction = { event ->
                            val txt = (event.target as HTMLInputElement).value
                            list[i] = list[i].copy(name = txt)
                        }
                    }

                    input(type = InputType.number, classes = "form-control") {
                        placeholder = "#"
                        value = item.jerseyNumber
                        onChangeFunction = { event ->
                            val txt = (event.target as HTMLInputElement).value
                            list[i] = list[i].copy(jerseyNumber = txt)
                        }
                    }

                    select(classes = "form-control") {
                        val availablePositions = listOf("P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH")
                        availablePositions.forEach { pos ->
                            option {
                                value = pos
                                +pos
                                selected = (pos == item.position)
                            }
                        }
                        onChangeFunction = { event ->
                            val selectVal = (event.target as HTMLSelectElement).value
                            list[i] = list[i].copy(position = selectVal)
                        }
                    }
                }
            }
        }
    }

    private fun validateAndSave(): Boolean {
        fun validateTeam(isHome: Boolean, list: List<PlayerInputs>, pName: String, pNum: String): Pair<List<Player>, List<Player>>? {
            val teamName = if (isHome) homeTeam.name else awayTeam.name

            if (list.any { it.name.trim().isEmpty() }) {
                validationError = "Error in $teamName Lineup: All player names must be filled."
                return null
            }

            val nums = list.map { it.jerseyNumber.toIntOrNull() }
            if (nums.any { it == null || it < 0 || it > 99 }) {
                validationError = "Error in $teamName Lineup: Jersey numbers must be integers between 0 and 99."
                return null
            }

            if (useDh) {
                if (pName.trim().isEmpty() || pNum.toIntOrNull() == null) {
                    validationError = "Error in $teamName Lineup: Starting Pitcher name and number must be filled when DH is enabled."
                    return null
                }
            }

            val allNums = if (useDh) nums + pNum.toInt() else nums
            if (allNums.size != allNums.toSet().size) {
                validationError = "Error in $teamName Lineup: Duplicate jersey numbers are not allowed."
                return null
            }

            val baseId = if (isHome) 1000L else 2000L
            val tId = if (isHome) homeTeam.id else awayTeam.id

            val lineupPlayers = list.mapIndexed { idx, item ->
                Player(
                    id = baseId + idx + 1,
                    teamId = tId,
                    name = item.name.trim(),
                    position = item.position,
                    jerseyNumber = item.jerseyNumber.toInt(),
                    battingHand = "R",
                    throwingHand = "R"
                )
            }

            val benchPlayers = mutableListOf<Player>()
            var activePitcherId = baseId + 10L

            if (useDh) {
                val pPlayer = Player(
                    id = baseId + 10L,
                    teamId = tId,
                    name = pName.trim(),
                    position = "P",
                    jerseyNumber = pNum.toInt(),
                    battingHand = "R",
                    throwingHand = "R"
                )
                benchPlayers.add(pPlayer)
                activePitcherId = pPlayer.id!!
            } else {
                val pitcherLineupIndex = list.indexOfFirst { it.position == "P" }
                if (pitcherLineupIndex == -1) {
                    validationError = "Error in $teamName Lineup: Pitcher (P) must be included in the batting lineup when DH is disabled."
                    return null
                }
                activePitcherId = lineupPlayers[pitcherLineupIndex].id!!
            }

            if (!useDh) {
                val pCount = list.count { it.position == "P" }
                if (pCount != 1) {
                    validationError = "Error in $teamName Lineup: Lineup must contain exactly one Pitcher (P) in the batting order when DH is disabled."
                    return null
                }
            } else {
                val pCount = list.count { it.position == "P" }
                if (pCount > 0) {
                    validationError = "Error in $teamName Lineup: Batting order cannot contain a Pitcher (P) when DH is enabled. Pitcher is designated separately."
                    return null
                }
            }

            for (idx in 1..4) {
                benchPlayers.add(
                    Player(
                        id = baseId + 10L + idx,
                        teamId = tId,
                        name = "Sub $idx ($teamName)",
                        position = if (idx == 1) "P" else "OF",
                        jerseyNumber = (80 + idx) % 100,
                        battingHand = "R",
                        throwingHand = "R"
                    )
                )
            }

            return Pair(lineupPlayers, benchPlayers)
        }

        val awayRes = validateTeam(isHome = false, awayLineupInputs, awayPitcherNameInput, awayPitcherNumberInput) ?: return false
        val homeRes = validateTeam(isHome = true, homeLineupInputs, homePitcherNameInput, homePitcherNumberInput) ?: return false

        val awayActivePId = if (useDh) awayRes.second.first().id!! else awayRes.first.find { it.position == "P" }!!.id!!
        val homeActivePId = if (useDh) homeRes.second.first().id!! else homeRes.first.find { it.position == "P" }!!.id!!

        startNewGame(
            homeTeam = homeTeam,
            awayTeam = awayTeam,
            homeLineup = homeRes.first,
            awayLineup = awayRes.first,
            homeBench = homeRes.second,
            awayBench = awayRes.second,
            homeActivePitcherId = homeActivePId,
            awayActivePitcherId = awayActivePId,
            useDh = useDh
        )

        return true
    }
}

data class PlayerInputs(
    val name: String,
    val jerseyNumber: String,
    val position: String
)

package com.baseball.ui.components

import com.baseball.UiConstants
import com.baseball.BaseballConstants
import com.baseball.models.Player
import com.baseball.models.Team
import com.baseball.game.startNewGame
import com.baseball.ui.DomBuilder
import com.baseball.ui.renderCurrentTab
import com.baseball.ui.AppViewManager
import com.baseball.seed.SeedData
import org.w3c.dom.*
import kotlinx.browser.document
import kotlin.random.Random

var isLineupDialogOpen = false

class LineupSetupOverlay(private val container: HTMLElement) : DomBuilder {

    private var useDh = true
    private var homeTeam = SeedData.teamCubs
    private var awayTeam = SeedData.teamCardinals

    // Player inputs: 9 slots for away, 9 slots for home
    // Each slot is a Triple of Name, JerseyNumber, and Position
    private val awayLineupInputs = MutableList(9) { index ->
        val pos = if (index == 0) "DH" else getDefaultPosition(index)
        PlayerInputs("", "", pos)
    }

    private val homeLineupInputs = MutableList(9) { index ->
        val pos = if (index == 0) "DH" else getDefaultPosition(index)
        PlayerInputs("", "", pos)
    }

    // Starting pitcher inputs (if DH is used, we need a separate field for the pitcher who doesn't hit)
    private var awayPitcherNameInput = ""
    private var awayPitcherNumberInput = ""
    private var homePitcherNameInput = ""
    private var homePitcherNumberInput = ""

    private var validationError: String? = null

    init {
        // Default seeding
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
            // Fill with SeedData
            val awayRoster = SeedData.cardinalsRoster
            val homeRoster = SeedData.cubsRoster

            val awayP = awayRoster.find { it.position == BaseballConstants.Positions.P }
            awayPitcherNameInput = awayP?.name ?: "Sonny Gray"
            awayPitcherNumberInput = awayP?.jerseyNumber?.toString() ?: "54"

            val homeP = homeRoster.find { it.position == BaseballConstants.Positions.P }
            homePitcherNameInput = homeP?.name ?: "Justin Steele"
            homePitcherNumberInput = homeP?.jerseyNumber?.toString() ?: "35"

            if (useDh) {
                // DH is active: 9 slots are non-pitchers
                val awayBatters = awayRoster.filter { it.position != BaseballConstants.Positions.P }.take(9)
                awayBatters.forEachIndexed { i, p ->
                    awayLineupInputs[i] = PlayerInputs(p.name, p.jerseyNumber.toString(), p.position)
                }
                val homeBatters = homeRoster.filter { it.position != BaseballConstants.Positions.P }.take(9)
                homeBatters.forEachIndexed { i, p ->
                    homeLineupInputs[i] = PlayerInputs(p.name, p.jerseyNumber.toString(), p.position)
                }
            } else {
                // Pitcher hits: Slot 9 is Pitcher, others are fielders
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
            // Randomize with fun names
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

            // Separate Pitchers
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

        // Full-screen glassmorphism overlay background
        val overlay = container.appendElement(UiConstants.Html.DIV) {
            className = "lineup-overlay"
            style.setProperty(UiConstants.Css.POSITION, "fixed")
            style.setProperty(UiConstants.Css.TOP, "0")
            style.setProperty(UiConstants.Css.LEFT, "0")
            style.setProperty(UiConstants.Css.WIDTH, "100vw")
            style.setProperty(UiConstants.Css.HEIGHT, "100vh")
            style.setProperty(UiConstants.Css.BACKGROUND, "rgba(10, 15, 30, 0.8)")
            style.setProperty(UiConstants.Css.BACKDROP_FILTER, "blur(12px)")
            style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
            style.setProperty(UiConstants.Css.ALIGN_ITEMS, "flex-start")
            style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.CENTER)
            style.setProperty(UiConstants.Css.Z_INDEX, "10000")
            style.setProperty(UiConstants.Css.OVERFLOW_Y, UiConstants.CssValues.AUTO)
            style.setProperty(UiConstants.Css.PADDING, "2rem 1rem")
        }

        // Inner Modal Content Box
        val modal = overlay.appendElement(UiConstants.Html.DIV) {
            className = "lineup-modal-content card"
            style.setProperty(UiConstants.Css.WIDTH, "100%")
            style.setProperty(UiConstants.Css.MAX_WIDTH, "1000px")
            style.setProperty(UiConstants.Css.PADDING, "2rem")
            style.setProperty(UiConstants.Css.BOX_SHADOW, "0 10px 40px rgba(0,0,0,0.5)")
        }

        // Header Title
        modal.appendElement(UiConstants.Html.H1) {
            textContent = "Game Roster & Lineup Setup"
            style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER)
            style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1.5rem")
        }

        // Error message banner if validation fails
        if (validationError != null) {
            modal.appendElement(UiConstants.Html.DIV) {
                className = "server-error-banner"
                textContent = validationError!!
                style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
            }
        }

        // Toolbar for DH and Randomization Actions
        val toolbar = modal.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
            style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.SPACE_BETWEEN)
            style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
            style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1.5rem")
            style.setProperty(UiConstants.Css.BACKGROUND, "rgba(255, 255, 255, 0.03)")
            style.setProperty(UiConstants.Css.PADDING, "1rem")
            style.setProperty(UiConstants.Css.BORDER_RADIUS, "8px")
        }

        // DH Toggle Checkbox
        val dhContainer = toolbar.appendElement(UiConstants.Html.LABEL) {
            style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
            style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
            style.setProperty(UiConstants.Css.GAP, "0.5rem")
            style.setProperty(UiConstants.Css.CURSOR, UiConstants.CssValues.POINTER)
        }
        val dhCheckbox = dhContainer.appendElement(UiConstants.Html.INPUT) as HTMLInputElement
        dhCheckbox.type = "checkbox"
        dhCheckbox.checked = useDh
        dhCheckbox.addEventListener("change", { event ->
            useDh = (event.target as HTMLInputElement).checked
            validationError = null
            // Toggle positions in inputs
            adjustLineupPositions()
            render()
        })

        dhContainer.appendElement(UiConstants.Html.SPAN) {
            textContent = "Enable Designated Hitter (DH)"
            style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
        }

        // Example data / Seeding buttons
        val actionGroup = toolbar.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
            style.setProperty(UiConstants.Css.GAP, "0.75rem")
        }
        actionGroup.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
            textContent = "Load Default Roster"
            onClick {
                validationError = null
                populateWithRosters(useSeedRosters = true)
                render()
            }
        }
        actionGroup.appendElement(UiConstants.Html.BUTTON, "btn btn-action") {
            textContent = "Populate Random Example Data"
            style.setProperty(UiConstants.Css.BACKGROUND, "linear-gradient(135deg, #3b82f6, #8b5cf6)")
            onClick {
                validationError = null
                populateWithRosters(useSeedRosters = false)
                render()
            }
        }

        // Team lineup cards grid
        val lineupGrid = modal.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.DISPLAY, "grid")
            style.setProperty("grid-template-columns", "1fr 1fr")
            style.setProperty(UiConstants.Css.GAP, "2rem")
            style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "2rem")
        }

        // AWAY TEAM COLUMN
        renderTeamColumn(lineupGrid, isHome = false)

        // HOME TEAM COLUMN
        renderTeamColumn(lineupGrid, isHome = true)

        // Bottom Navigation Buttons
        val btnRow = modal.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
            style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.SPACE_BETWEEN)
            style.setProperty(UiConstants.Css.MARGIN_TOP, "1.5rem")
        }
        btnRow.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
            textContent = "← Go Back to Welcome"
            onClick {
                isLineupDialogOpen = false
                AppViewManager.goBackToWelcome()
            }
        }
        btnRow.appendElement(UiConstants.Html.BUTTON, "btn btn-primary") {
            textContent = "⚾ Start & Save Game"
            onClick {
                if (validateAndSave()) {
                    isLineupDialogOpen = false
                    renderCurrentTab()
                }
            }
        }
    }

    private fun adjustLineupPositions() {
        // Adjust away/home position configurations based on DH active/inactive
        if (useDh) {
            // Away
            if (awayLineupInputs[8].position == "P") {
                awayLineupInputs[8] = PlayerInputs(awayLineupInputs[8].name, awayLineupInputs[8].jerseyNumber, "RF")
            }
            if (awayLineupInputs[0].position != "DH") {
                awayLineupInputs[0] = PlayerInputs(awayLineupInputs[0].name, awayLineupInputs[0].jerseyNumber, "DH")
            }
            // Home
            if (homeLineupInputs[8].position == "P") {
                homeLineupInputs[8] = PlayerInputs(homeLineupInputs[8].name, homeLineupInputs[8].jerseyNumber, "RF")
            }
            if (homeLineupInputs[0].position != "DH") {
                homeLineupInputs[0] = PlayerInputs(homeLineupInputs[0].name, homeLineupInputs[0].jerseyNumber, "DH")
            }
        } else {
            // Away
            if (awayLineupInputs[0].position == "DH") {
                awayLineupInputs[0] = PlayerInputs(awayLineupInputs[0].name, awayLineupInputs[0].jerseyNumber, "LF")
            }
            awayLineupInputs[8] = PlayerInputs(awayPitcherNameInput, awayPitcherNumberInput, "P")
            // Home
            if (homeLineupInputs[0].position == "DH") {
                homeLineupInputs[0] = PlayerInputs(homeLineupInputs[0].name, homeLineupInputs[0].jerseyNumber, "LF")
            }
            homeLineupInputs[8] = PlayerInputs(homePitcherNameInput, homePitcherNumberInput, "P")
        }
    }

    private fun renderTeamColumn(container: HTMLElement, isHome: Boolean) {
        val col = container.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.BACKGROUND, "rgba(255, 255, 255, 0.02)")
            style.setProperty(UiConstants.Css.PADDING, "1.5rem")
            style.setProperty(UiConstants.Css.BORDER_RADIUS, "12px")
            style.setProperty(UiConstants.Css.BORDER, "1px solid rgba(255,255,255,0.05)")
        }

        col.appendElement(UiConstants.Html.H2) {
            textContent = if (isHome) "Home Team: ${homeTeam.name}" else "Away Team: ${awayTeam.name}"
            style.setProperty(UiConstants.Css.COLOR, if (isHome) "var(--accent-yellow)" else "var(--accent-blue)")
            style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1rem")
        }

        // Render Pitcher selector (if DH is enabled, starting pitcher must be configured separately since they aren't in the batting lineup)
        if (useDh) {
            val pitcherSection = col.appendElement(UiConstants.Html.DIV) {
                style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                style.setProperty(UiConstants.Css.GAP, "0.5rem")
                style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1.25rem")
                style.setProperty(UiConstants.Css.PADDING_BOTTOM, "1rem")
                style.setProperty(UiConstants.Css.BORDER_BOTTOM, "1px dashed rgba(255,255,255,0.1)")
                style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
            }
            pitcherSection.appendElement(UiConstants.Html.SPAN) {
                textContent = "Starting Pitcher:"
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                style.setProperty(UiConstants.Css.WIDTH, "100px")
            }
            val pNameInput = pitcherSection.appendElement(UiConstants.Html.INPUT, "form-control") as HTMLInputElement
            pNameInput.type = "text"
            pNameInput.placeholder = "Pitcher Name"
            pNameInput.value = if (isHome) homePitcherNameInput else awayPitcherNameInput
            pNameInput.style.setProperty(UiConstants.Css.FLEX, "1")
            pNameInput.addEventListener("input", { event ->
                val txt = (event.target as HTMLInputElement).value
                if (isHome) homePitcherNameInput = txt else awayPitcherNameInput = txt
            })

            val pNumInput = pitcherSection.appendElement(UiConstants.Html.INPUT, "form-control") as HTMLInputElement
            pNumInput.type = "number"
            pNumInput.placeholder = "No."
            pNumInput.value = if (isHome) homePitcherNumberInput else awayPitcherNumberInput
            pNumInput.style.setProperty(UiConstants.Css.WIDTH, "60px")
            pNumInput.addEventListener("input", { event ->
                val txt = (event.target as HTMLInputElement).value
                if (isHome) homePitcherNumberInput = txt else awayPitcherNumberInput = txt
            })
        }

        // Render Table Headers
        val headerRow = col.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.DISPLAY, "grid")
            style.setProperty("grid-template-columns", "40px 1fr 60px 80px")
            style.setProperty(UiConstants.Css.GAP, "0.5rem")
            style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.5rem")
            style.setProperty(UiConstants.Css.PADDING, "0 0.5rem")
            style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
            style.setProperty(UiConstants.Css.COLOR, "rgba(255,255,255,0.6)")
        }
        headerRow.appendElement(UiConstants.Html.DIV) { textContent = "Slot" }
        headerRow.appendElement(UiConstants.Html.DIV) { textContent = "Batter Name" }
        headerRow.appendElement(UiConstants.Html.DIV) { textContent = "No." }
        headerRow.appendElement(UiConstants.Html.DIV) { textContent = "Pos" }

        // Render 9 Lineup Input rows
        val list = if (isHome) homeLineupInputs else awayLineupInputs
        for (i in 0..8) {
            val item = list[i]
            val row = col.appendElement(UiConstants.Html.DIV) {
                style.setProperty(UiConstants.Css.DISPLAY, "grid")
                style.setProperty("grid-template-columns", "40px 1fr 60px 80px")
                style.setProperty(UiConstants.Css.GAP, "0.5rem")
                style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "0.5rem")
                style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
            }
            row.appendElement(UiConstants.Html.SPAN) {
                textContent = "${i + 1}"
                style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER)
                style.setProperty(UiConstants.Css.COLOR, "rgba(255,255,255,0.4)")
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
            }
            
            val nameInput = row.appendElement(UiConstants.Html.INPUT, "form-control") as HTMLInputElement
            nameInput.type = "text"
            nameInput.placeholder = "Enter Player Name"
            nameInput.value = item.name
            nameInput.addEventListener("input", { event ->
                val txt = (event.target as HTMLInputElement).value
                list[i] = list[i].copy(name = txt)
            })

            val numInput = row.appendElement(UiConstants.Html.INPUT, "form-control") as HTMLInputElement
            numInput.type = "number"
            numInput.placeholder = "#"
            numInput.value = item.jerseyNumber
            numInput.addEventListener("input", { event ->
                val txt = (event.target as HTMLInputElement).value
                list[i] = list[i].copy(jerseyNumber = txt)
            })
            
            // Positions dropdown
            val selectEl = row.appendElement(UiConstants.Html.SELECT, "form-control") as HTMLSelectElement
            val availablePositions = listOf("P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH")
            availablePositions.forEach { pos ->
                selectEl.appendElement(UiConstants.Html.OPTION) {
                    textContent = pos
                    val opt = this as HTMLOptionElement
                    opt.value = pos
                    opt.selected = (pos == item.position)
                }
            }
            selectEl.addEventListener("change", { event ->
                val selectVal = (event.target as HTMLSelectElement).value
                list[i] = list[i].copy(position = selectVal)
            })
        }
    }

    private fun validateAndSave(): Boolean {
        // Validation logic
        fun validateTeam(isHome: Boolean, list: List<PlayerInputs>, pName: String, pNum: String): Pair<List<Player>, List<Player>>? {
            val teamName = if (isHome) homeTeam.name else awayTeam.name
            
            // Check for empty names
            if (list.any { it.name.trim().isEmpty() }) {
                validationError = "Error in $teamName Lineup: All player names must be filled."
                return null
            }

            // Parse numbers and check validity
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

            // Check for duplicates
            val allNums = if (useDh) nums + pNum.toInt() else nums
            if (allNums.size != allNums.toSet().size) {
                validationError = "Error in $teamName Lineup: Duplicate jersey numbers are not allowed."
                return null
            }

            // Create players
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

            // Also check that there is exactly 1 pitcher in the batting order if no DH
            if (!useDh) {
                val pCount = list.count { it.position == "P" }
                if (pCount != 1) {
                    validationError = "Error in $teamName Lineup: Lineup must contain exactly one Pitcher (P) in the batting order when DH is disabled."
                    return null
                }
            } else {
                // If DH is active, make sure there are no Pitchers (P) in the batting order
                val pCount = list.count { it.position == "P" }
                if (pCount > 0) {
                    validationError = "Error in $teamName Lineup: Batting order cannot contain a Pitcher (P) when DH is enabled. Pitcher is designated separately."
                    return null
                }
            }

            // Create some random dummy players to fill the bench (total roster needs to be at least 12-13 players for subs)
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

        // Determine starting active pitchers
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

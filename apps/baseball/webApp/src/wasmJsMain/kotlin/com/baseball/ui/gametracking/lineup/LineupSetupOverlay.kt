package com.baseball.ui.gametracking.lineup

import com.baseball.api
import com.baseball.game.TeamLineupConfig
import com.baseball.game.localAwayActivePitcherId
import com.baseball.game.localAwayActivePitcherName
import com.baseball.game.localAwayBench
import com.baseball.game.localAwayLineup
import com.baseball.game.localGame
import com.baseball.game.localHomeActivePitcherId
import com.baseball.game.localHomeActivePitcherName
import com.baseball.game.localHomeBench
import com.baseball.game.localHomeLineup
import com.baseball.game.saveLocalState
import com.baseball.game.startNewGame
import com.baseball.models.GameStatus
import com.baseball.models.Player
import com.baseball.seed.SeedData
import com.baseball.ui.core.css
import com.baseball.ui.core.launch
import com.baseball.ui.state.AppViewManager
import com.baseball.ui.state.isSingleGameMode
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.selectedGameId
import com.baseball.ui.state.selectedGameStatus
import kotlinx.css.Align
import kotlinx.css.Border
import kotlinx.css.BorderStyle
import kotlinx.css.Color
import kotlinx.css.Cursor
import kotlinx.css.Display
import kotlinx.css.FontWeight
import kotlinx.css.JustifyContent
import kotlinx.css.LinearDimension
import kotlinx.css.Overflow
import kotlinx.css.Padding
import kotlinx.css.Position
import kotlinx.css.TextAlign
import kotlinx.css.alignItems
import kotlinx.css.background
import kotlinx.css.border
import kotlinx.css.borderBottom
import kotlinx.css.borderRadius
import kotlinx.css.color
import kotlinx.css.cursor
import kotlinx.css.display
import kotlinx.css.flexGrow
import kotlinx.css.fontWeight
import kotlinx.css.gap
import kotlinx.css.height
import kotlinx.css.justifyContent
import kotlinx.css.left
import kotlinx.css.marginBottom
import kotlinx.css.marginTop
import kotlinx.css.maxWidth
import kotlinx.css.overflowY
import kotlinx.css.padding
import kotlinx.css.paddingBottom
import kotlinx.css.pct
import kotlinx.css.position
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.css.textAlign
import kotlinx.css.top
import kotlinx.css.width
import kotlinx.css.zIndex
import kotlinx.html.DIV
import kotlinx.html.InputType
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h1
import kotlinx.html.h2
import kotlinx.html.input
import kotlinx.html.js.div
import kotlinx.html.js.onChangeFunction
import kotlinx.html.js.onClickFunction
import kotlinx.html.label
import kotlinx.html.option
import kotlinx.html.select
import kotlinx.html.span
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLInputElement
import org.w3c.dom.HTMLSelectElement

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

private fun DIV.renderNameInput(list: MutableList<PlayerInputs>, i: Int, item: PlayerInputs) {
    input(type = InputType.text, classes = "form-control") {
        placeholder = "Enter Player Name"
        value = item.name
        onChangeFunction = { event ->
            val txt = (event.target as HTMLInputElement).value
            list[i] = list[i].copy(name = txt)
        }
    }
}

private fun DIV.renderNumberInput(list: MutableList<PlayerInputs>, i: Int, item: PlayerInputs) {
    input(type = InputType.number, classes = "form-control") {
        placeholder = "#"
        value = item.jerseyNumber
        onChangeFunction = { event ->
            val txt = (event.target as HTMLInputElement).value
            list[i] = list[i].copy(jerseyNumber = txt)
        }
    }
}

private fun DIV.renderPositionSelect(list: MutableList<PlayerInputs>, i: Int, item: PlayerInputs) {
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

    init {
        if (homeTeamParam != null) homeTeam = homeTeamParam
        if (awayTeamParam != null) awayTeam = awayTeamParam
        populateWithRosters(homeRosterParam, awayRosterParam)
    }

    private fun populateWithRosters(homeRoster: List<Player>, awayRoster: List<Player>) {
        if (homeRoster.isEmpty() && awayRoster.isEmpty()) return

        val (awayName, awayNum) = findPitcherInputs(awayRoster)
        awayPitcherNameInput = awayName
        awayPitcherNumberInput = awayNum
        val (homeName, homeNum) = findPitcherInputs(homeRoster)
        homePitcherNameInput = homeName
        homePitcherNumberInput = homeNum

        if (useDh) {
            applyRosterToLineup(
                awayLineupInputs, RosterApplyConfig(awayRoster, 9, awayPitcherNameInput, awayPitcherNumberInput)
            )
            applyRosterToLineup(
                homeLineupInputs, RosterApplyConfig(homeRoster, 9, homePitcherNameInput, homePitcherNumberInput)
            )
        } else {
            applyRosterToLineup(
                awayLineupInputs,
                RosterApplyConfig(awayRoster, 8, awayPitcherNameInput, awayPitcherNumberInput, usePitcherSlot = true)
            )
            applyRosterToLineup(
                homeLineupInputs,
                RosterApplyConfig(homeRoster, 8, homePitcherNameInput, homePitcherNumberInput, usePitcherSlot = true)
            )
        }
    }


    private fun populateRostersWithRandom(
        useDh: Boolean,
        awayLineupInputs: MutableList<PlayerInputs>,
        homeLineupInputs: MutableList<PlayerInputs>,
        setAwayP: (String, String) -> Unit,
        setHomeP: (String, String) -> Unit,
    ) {
        val firstNames = listOf(
            "Babe", "Slider", "Fastball", "Windup", "HomeRun", "Bunt",
            "Knuckle", "Curve", "Spitball", "Slugger", "Rusty", "Ace", "Chippy", "Skip"
        )
        val lastNames = listOf(
            "Ruthless", "McGavin", "Freddie", "Willie", "Harry", "Master",
            "Jones", "Rodriguez", "O'Malley", "Swinger", "Slugson"
        )

        fun randomPlayer(pos: String): PlayerInputs {
            val name = "${firstNames.random()} ${lastNames.random()}"
            val num = kotlin.random.Random.nextInt(1, 100).toString()
            return PlayerInputs(name, num, pos)
        }

        val randomAwayP = randomPlayer("P")
        setAwayP(randomAwayP.name, randomAwayP.jerseyNumber)

        val randomHomeP = randomPlayer("P")
        setHomeP(randomHomeP.name, randomHomeP.jerseyNumber)

        val positions = listOf("C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH")
        val selectedAwayPositions = if (useDh) positions else positions.filter { it != "DH" } + "P"
        val selectedHomePositions = if (useDh) positions else positions.filter { it != "DH" } + "P"

        for (i in 0..8) {
            awayLineupInputs[i] = randomPlayer(selectedAwayPositions[i])
            homeLineupInputs[i] = randomPlayer(selectedHomePositions[i])
        }
    }

    fun render() {
        container.innerHTML = ""
        container.append {
            div {
                css {
                    position = Position.fixed
                    top = 0.px
                    left = 0.px
                    width = LinearDimension("100vw")
                    height = LinearDimension("100vh")
                    background = "rgba(10, 15, 30, 0.8)"
                    put("backdrop-filter", "blur(12px)")
                    display = Display.flex
                    alignItems = Align.flexStart
                    justifyContent = JustifyContent.center
                    zIndex = 10000
                    overflowY = Overflow.auto
                    padding = Padding(2.rem, 1.rem)
                }
                renderModalContent()
            }
        }
    }

    private fun DIV.renderModalContent() {
        div(classes = "lineup-modal-content card") {
            css {
                width = 100.pct
                maxWidth = 1000.px
                padding = Padding(2.rem)
                put("box-shadow", "0 10px 40px rgba(0,0,0,0.5)")
            }
            h1 {
                +"Game Roster & Lineup Setup"
                css {
                    textAlign = TextAlign.center
                    marginBottom = 1.5.rem
                }
            }
            renderValidationErrorBanner(this, validationError)
            val cubs = SeedData.cubsRoster;
            val cards = SeedData.cardinalsRoster
            val onDhToggle: (Boolean) -> Unit = { newVal ->
                useDh = newVal; validationError = null; adjustLineupPositions(
                LineupAdjustConfig(
                    useDh,
                    awayLineupInputs,
                    homeLineupInputs,
                    awayPitcherNameInput,
                    awayPitcherNumberInput,
                    homePitcherNameInput,
                    homePitcherNumberInput
                )
            ); render()
            }
            val onLoadDefault = { validationError = null; populateWithRosters(cubs, cards); render() }
            val onRandom = {
                validationError = null; populateRostersWithRandom(
                useDh,
                awayLineupInputs,
                homeLineupInputs,
                { n, num -> awayPitcherNameInput = n; awayPitcherNumberInput = num },
                { n, num -> homePitcherNameInput = n; homePitcherNumberInput = num }); render()
            }
            renderConfigurationBar(this, useDh, onDhToggle, onLoadDefault, onRandom)
            val lineupUiContext = LineupUiContext(
                useDh, awayTeam.name, homeTeam.name,
                awayLineupInputs, homeLineupInputs,
                awayPitcherNameInput, awayPitcherNumberInput,
                homePitcherNameInput, homePitcherNumberInput
            )
            val onAwayPitcherNameChange = { newName: String -> awayPitcherNameInput = newName }
            val onAwayPitcherNumberChange = { newNumber: String -> awayPitcherNumberInput = newNumber }
            val onHomePitcherNameChange = { newName: String -> homePitcherNameInput = newName }
            val onHomePitcherNumberChange = { newNumber: String -> homePitcherNumberInput = newNumber }
            renderTeamGrid(
                this,
                lineupUiContext,
                onAwayPitcherNameChange,
                onAwayPitcherNumberChange,
                onHomePitcherNameChange,
                onHomePitcherNumberChange
            )
            val onBack = { isLineupDialogOpen = false; AppViewManager.goBackToWelcome() }
            val onStartSave = {
                if (validateAndSave()) {
                    isLineupDialogOpen = false; renderCurrentTab()
                } else {
                    render()
                }
            }
            renderFooterButtons(this, onBack, onStartSave)
        }
    }

    private fun renderValidationErrorBanner(parent: DIV, errorMsg: String?) {
        errorMsg ?: return
        parent.div(classes = "server-error-banner") {
            +errorMsg
            css {
                marginBottom = 1.rem
            }
        }
    }

    private fun renderConfigurationBar(
        parent: DIV,
        useDh: Boolean,
        onDhToggle: (Boolean) -> Unit,
        onLoadDefault: () -> Unit,
        onRandom: () -> Unit
    ) {
        parent.div {
            css {
                display = Display.flex; justifyContent = JustifyContent.spaceBetween; alignItems = Align.center
                marginBottom = 1.5.rem; background = "rgba(255, 255, 255, 0.03)"
                padding = Padding(1.rem); borderRadius = 8.px
            }
            renderDhToggle(useDh, onDhToggle)
            renderConfigActionButtons(parent, onLoadDefault, onRandom)
        }
    }

    private fun DIV.renderDhToggle(useDh: Boolean, onToggle: (Boolean) -> Unit) {
        label {
            css {
                display = Display.flex
                alignItems = Align.center
                gap = 0.5.rem
                cursor = Cursor.pointer
            }
            input(type = InputType.checkBox) {
                checked = useDh
                onChangeFunction = { event ->
                    onToggle((event.target as HTMLInputElement).checked)
                }
            }
            span {
                +"Enable Designated Hitter (DH)"
                css {
                    fontWeight = FontWeight.bold
                }
            }
        }
    }

    private fun renderConfigActionButtons(parent: DIV, onLoadDefault: () -> Unit, onRandom: () -> Unit) {
        parent.div {
            css {
                display = Display.flex
                gap = 0.75.rem
            }
            button(classes = "btn btn-secondary") {
                +"Load Default Roster"
                onClickFunction = { onLoadDefault() }
            }
            button(classes = "btn btn-action") {
                +"Populate Random Example Data"
                css {
                    put("background", "linear-gradient(135deg, #3b82f6, #8b5cf6)")
                }
                onClickFunction = { onRandom() }
            }
        }
    }

    private fun renderTeamGrid(
        parent: DIV,
        lineupUiContext: LineupUiContext,
        onAwayPitcherNameChange: (String) -> Unit,
        onAwayPitcherNumberChange: (String) -> Unit,
        onHomePitcherNameChange: (String) -> Unit,
        onHomePitcherNumberChange: (String) -> Unit,
    ) {
        parent.div {
            css {
                display = Display.grid
                put("grid-template-columns", "1fr 1fr")
                gap = 2.rem
                marginBottom = 2.rem
            }
            renderTeamColumn(isHome = false, lineupUiContext, onAwayPitcherNameChange, onAwayPitcherNumberChange)
            renderTeamColumn(isHome = true, lineupUiContext, onHomePitcherNameChange, onHomePitcherNumberChange)
        }
    }

    private fun renderFooterButtons(parent: DIV, onBack: () -> Unit, onStartSave: () -> Unit) {
        parent.div {
            css {
                display = Display.flex
                justifyContent = JustifyContent.spaceBetween
                marginTop = 1.5.rem
            }
            button(classes = "btn btn-secondary") {
                +"← Go Back to Welcome"
                onClickFunction = { onBack() }
            }
            button(classes = "btn btn-primary") {
                +"⚾ Start & Save Game"
                onClickFunction = { onStartSave() }
            }
        }
    }

    private fun DIV.renderTeamColumn(
        isHome: Boolean,
        lineupUiContext: LineupUiContext,
        onPitcherNameChange: (String) -> Unit,
        onPitcherNumberChange: (String) -> Unit
    ) {
        div {
            css {
                background = "rgba(255, 255, 255, 0.02)"
                padding = Padding(1.5.rem)
                borderRadius = 12.px
                border = Border(1.px, BorderStyle.solid, Color("rgba(255,255,255,0.05)"))
            }
            h2 {
                +(if (isHome) "Home Team: ${lineupUiContext.homeTeamName}" else "Away Team: ${lineupUiContext.awayTeamName}")
                css {
                    color = Color(if (isHome) "var(--accent-yellow)" else "var(--accent-blue)")
                    marginBottom = 1.rem
                }
            }
            if (lineupUiContext.useDh) {
                val pitcherName = if (isHome) lineupUiContext.homePitcherName else lineupUiContext.awayPitcherName
                val pitcherNumber = if (isHome) lineupUiContext.homePitcherNumber else lineupUiContext.awayPitcherNumber
                renderPitcherInputRow(
                    this,
                    isHome,
                    pitcherName,
                    pitcherNumber,
                    onPitcherNameChange,
                    onPitcherNumberChange
                )
            }
            renderLineupHeader(this)
            val lineupInputs = if (isHome) lineupUiContext.homeLineupInputs else lineupUiContext.awayLineupInputs
            renderLineupRows(this, lineupInputs)
        }
    }

    private fun renderPitcherInputRow(
        parent: DIV,
        isHome: Boolean,
        pitcherName: String,
        pitcherNumber: String,
        onPitcherNameChange: (String) -> Unit,
        onPitcherNumberChange: (String) -> Unit,
    ) {
        parent.div {
            css {
                display = Display.flex
                gap = 0.5.rem
                marginBottom = 1.25.rem
                paddingBottom = 1.rem
                borderBottom = Border(1.px, BorderStyle.dashed, Color("rgba(255,255,255,0.1)"))
                alignItems = Align.center
            }
            span {
                +"Starting Pitcher:"
                css {
                    fontWeight = FontWeight.bold
                    width = 100.px
                }
            }
            renderPitcherNameInput(isHome, pitcherName, onPitcherNameChange)
            renderPitcherNumberInput(isHome, pitcherNumber, onPitcherNumberChange)
        }
    }

    private fun DIV.renderPitcherNameInput(
        isHome: Boolean,
        currentValue: String,
        onPitcherNameChange: (String) -> Unit
    ) {
        input(type = InputType.text, classes = "form-control") {
            placeholder = "Pitcher Name"
            value = currentValue
            css {
                flexGrow = 1.0
            }
            onChangeFunction = { event ->
                val txt = (event.target as HTMLInputElement).value
                onPitcherNameChange(txt)
            }
        }
    }

    private fun DIV.renderPitcherNumberInput(
        isHome: Boolean,
        currentValue: String,
        onPitcherNumberChange: (String) -> Unit
    ) {
        input(type = InputType.number, classes = "form-control") {
            placeholder = "No."
            value = currentValue
            css {
                width = 60.px
            }
            onChangeFunction = { event ->
                val txt = (event.target as HTMLInputElement).value
                onPitcherNumberChange(txt)
            }
        }
    }

    private fun renderLineupHeader(parent: DIV) {
        parent.div {
            css {
                display = Display.grid
                put("grid-template-columns", "40px 1fr 60px 80px")
                gap = 0.5.rem
                marginBottom = 0.5.rem
                padding = Padding(0.px, 0.5.rem)
                fontWeight = FontWeight.bold
                color = Color("rgba(255,255,255,0.6)")
            }
            div { +"Slot" }
            div { +"Batter Name" }
            div { +"No." }
            div { +"Pos" }
        }
    }

    private fun renderLineupRows(parent: DIV, list: MutableList<PlayerInputs>) {
        for (i in 0..8) {
            renderSingleLineupRow(parent, list, i)
        }
    }

    private fun renderSingleLineupRow(
        parent: DIV,
        list: MutableList<PlayerInputs>,
        i: Int,
    ) {
        val item = list[i]
        parent.div {
            css {
                display = Display.grid
                put("grid-template-columns", "40px 1fr 60px 80px")
                gap = 0.5.rem
                marginBottom = 0.5.rem
                alignItems = Align.center
            }
            span {
                +"${i + 1}"
                css {
                    textAlign = TextAlign.center
                    color = Color("rgba(255,255,255,0.4)")
                    fontWeight = FontWeight.bold
                }
            }
            renderNameInput(list, i, item)
            renderNumberInput(list, i, item)
            renderPositionSelect(list, i, item)
        }
    }


    private fun validateAndSave(): Boolean {
        val awayRes = validateTeam(
            homeTeam,
            awayTeam,
            useDh,
            isHome = false,
            awayLineupInputs,
            awayPitcherNameInput,
            awayPitcherNumberInput
        ) { validationError = it }
        val homeRes = validateTeam(
            homeTeam,
            awayTeam,
            useDh,
            isHome = true,
            homeLineupInputs,
            homePitcherNameInput,
            homePitcherNumberInput
        ) { validationError = it }

        if (awayRes == null || homeRes == null) return false

        if (isSingleGameMode) {
            saveLocalGameLineup(homeRes, awayRes)
        } else {
            saveServerGameLineup(homeRes, awayRes)
        }
        return true
    }

    private fun saveLocalGameLineup(
        homeRes: Pair<List<Player>, List<Player>>,
        awayRes: Pair<List<Player>, List<Player>>,
    ) {
        val awayActivePId = if (useDh) awayRes.second.first().id!! else awayRes.first.find { it.position == "P" }!!.id!!
        val homeActivePId = if (useDh) homeRes.second.first().id!! else homeRes.first.find { it.position == "P" }!!.id!!

        startNewGame(
            homeTeam = homeTeam,
            awayTeam = awayTeam,
            homeConfig = TeamLineupConfig(homeRes.first, homeRes.second, homeActivePId),
            awayConfig = TeamLineupConfig(awayRes.first, awayRes.second, awayActivePId),
            useDh = useDh,
        )

        localGame = localGame?.copy(status = GameStatus.IN_PROGRESS)
        saveLocalState()
        isLineupDialogOpen = false
        renderCurrentTab()
    }

    private fun saveServerGameLineup(
        homeRes: Pair<List<Player>, List<Player>>,
        awayRes: Pair<List<Player>, List<Player>>,
    ) {
        launch {
            try {
                val activeGame = api.getGame(selectedGameId!!)
                val serverHomeLineup = createServerPlayers(activeGame.homeTeam.id, homeRes.first)
                val serverHomeBench = createServerPlayers(activeGame.homeTeam.id, homeRes.second)
                val serverAwayLineup = createServerPlayers(activeGame.awayTeam.id, awayRes.first)
                val serverAwayBench = createServerPlayers(activeGame.awayTeam.id, awayRes.second)

                api.startGame(activeGame.id!!)
                selectedGameStatus = GameStatus.IN_PROGRESS

                updateClientState(serverHomeLineup, serverHomeBench, serverAwayLineup, serverAwayBench)
                isLineupDialogOpen = false
                AppViewManager.renderApp()
                renderCurrentTab()
            } catch (expected: Throwable) {
                println("Error starting online game: ${expected.message}")
            }
        }
    }

    private suspend fun createServerPlayers(teamId: Long?, players: List<Player>): List<Player> =
        players.map { p ->
            api.createPlayer(
                Player(
                    id = null,
                    teamId = teamId,
                    name = p.name,
                    position = p.position,
                    jerseyNumber = p.jerseyNumber,
                    battingHand = "R",
                    throwingHand = "R",
                ),
            )
        }

    private fun updateClientState(
        homeLineup: List<Player>,
        homeBench: List<Player>,
        awayLineup: List<Player>,
        awayBench: List<Player>,
    ) {
        localHomeLineup.clear()
        localHomeLineup.addAll(homeLineup)
        localHomeBench.clear()
        localHomeBench.addAll(homeBench)
        localAwayLineup.clear()
        localAwayLineup.addAll(awayLineup)
        localAwayBench.clear()
        localAwayBench.addAll(awayBench)

        val homeP = homeBench.find { it.position == "P" } ?: homeLineup.find { it.position == "P" }
        val awayP = awayBench.find { it.position == "P" } ?: awayLineup.find { it.position == "P" }
        localHomeActivePitcherId = homeP?.id ?: 110L
        localHomeActivePitcherName = homeP?.name ?: "Pitcher"
        localAwayActivePitcherId = awayP?.id ?: 210L
        localAwayActivePitcherName = awayP?.name ?: "Pitcher"
    }

    private fun validateTeam(
        homeTeam: com.baseball.models.Team,
        awayTeam: com.baseball.models.Team,
        useDh: Boolean,
        isHome: Boolean,
        lineupInputs: List<PlayerInputs>,
        pitcherName: String,
        pitcherNumber: String,
        onError: (String) -> Unit,
    ): Pair<List<Player>, List<Player>>? {
        val error = getTeamValidationError(
            TeamValidationRequest(
                homeTeam,
                awayTeam,
                useDh,
                isHome,
                lineupInputs,
                pitcherName,
                pitcherNumber
            )
        )
        if (error != null) {
            onError(error)
            return null
        }

        val teamName = if (isHome) homeTeam.name else awayTeam.name
        val baseId = if (isHome) 1000L else 2000L
        val teamId = if (isHome) homeTeam.id else awayTeam.id

        val lineupPlayers = buildLineupPlayers(lineupInputs, baseId, teamId)
        val config =
            BenchBuildConfig(useDh, pitcherName, pitcherNumber, lineupPlayers, lineupInputs, baseId, teamId, teamName)
        val (benchPlayers, _) = buildBenchAndPitcher(config)

        return Pair(lineupPlayers, benchPlayers)
    }
}



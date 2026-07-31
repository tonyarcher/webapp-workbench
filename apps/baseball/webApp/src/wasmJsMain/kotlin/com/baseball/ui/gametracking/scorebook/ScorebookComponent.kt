package com.baseball.ui.gametracking.scorebook

import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.HalfInning
import com.baseball.models.PlayEvent
import kotlinx.html.DIV
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h2
import kotlinx.html.id
import kotlinx.html.js.div
import kotlinx.html.js.onClickFunction
import org.w3c.dom.HTMLButtonElement
import org.w3c.dom.HTMLDivElement
import org.w3c.dom.HTMLElement

internal fun renderScorebookView(
    container: HTMLElement,
    game: Game,
    boxScore: BoxScore,
    events: List<PlayEvent>,
) {
    container.innerHTML = ""

    var activeHalf = HalfInning.TOP
    var btnAway: HTMLButtonElement? = null
    var btnHome: HTMLButtonElement? = null
    var sheetContainer: HTMLDivElement? = null

    fun redrawScorecard(half: HalfInning) {
        activeHalf = half
        val sheetEl = sheetContainer ?: return
        sheetEl.innerHTML = ""
        renderScorecardSheet(sheetEl, game, boxScore, events, activeHalf)
    }

    val wrapper =
        renderScorebookWrapper(container, game) { half ->
            redrawScorecard(half)
            btnAway?.classList?.toggle("btn-primary", half == HalfInning.TOP)
            btnAway?.classList?.toggle("btn-secondary", half == HalfInning.BOTTOM)
            btnHome?.classList?.toggle("btn-primary", half == HalfInning.BOTTOM)
            btnHome?.classList?.toggle("btn-secondary", half == HalfInning.TOP)
        }

    sheetContainer = wrapper.querySelector("#scorebook-sheet-container") as? HTMLDivElement
    btnAway = wrapper.querySelector("#btn-away-batting") as? HTMLButtonElement
    btnHome = wrapper.querySelector("#btn-home-batting") as? HTMLButtonElement

    redrawScorecard(HalfInning.TOP)
}

private fun renderScorebookWrapper(
    container: HTMLElement,
    game: Game,
    onToggle: (HalfInning) -> Unit,
): HTMLDivElement {
    container.append {
        div(classes = "scorebook-wrapper") {
            id = "scorebook-wrapper-element"
            renderScorebookHeader(game, onToggle)
            div {
                id = "scorebook-sheet-container"
            }
        }
    }
    return container.querySelector("#scorebook-wrapper-element") as HTMLDivElement
}

private fun DIV.renderScorebookHeader(
    game: Game,
    onToggle: (HalfInning) -> Unit,
) {
    div(classes = "scorebook-top-bar") {
        h2(classes = "scorebook-title") {
            +"SCOREBOOK"
        }
        renderToggleButtonGroup(game, onToggle)
    }
}

private fun DIV.renderToggleButtonGroup(
    game: Game,
    onToggle: (HalfInning) -> Unit,
) {
    div(classes = "flex-gap-sm") {
        id = "toggle-btn-group"
        button(classes = "btn btn-primary") {
            id = "btn-away-batting"
            +"${game.awayTeam.abbreviation} BATTING (TOP)"
            onClickFunction = { onToggle(HalfInning.TOP) }
        }
        button(classes = "btn btn-secondary") {
            id = "btn-home-batting"
            +"${game.homeTeam.abbreviation} BATTING (BOTTOM)"
            onClickFunction = { onToggle(HalfInning.BOTTOM) }
        }
    }
}

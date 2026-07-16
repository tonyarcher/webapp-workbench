package com.baseball.ui.components

import com.baseball.models.*
import com.baseball.ui.*
import org.w3c.dom.*
import kotlinx.html.*
import kotlinx.html.js.*
import kotlinx.css.*

internal fun renderScorebookView(container: HTMLElement, game: Game, boxScore: BoxScore, events: List<PlayEvent>) {
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

    val wrapper = renderScorebookWrapper(container, game) { half ->
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

private fun renderScorebookWrapper(container: HTMLElement, game: Game, onToggle: (HalfInning) -> Unit): HTMLDivElement {
    return container.div(classes = "scorebook-wrapper") {
        css {
            backgroundColor = Color("#fcfbfa")
            color = Color("#2b2a28")
            padding = Padding(2.rem)
            borderRadius = 12.px
            border = Border(2.px, BorderStyle.solid, Color("#d2cdc6"))
            put("box-shadow", "0 6px 20px rgba(0, 0, 0, 0.15)")
            fontFamily = "'Courier New', Courier, monospace"
        }
        renderScorebookHeader(this, game, onToggle)
        div {
            id = "scorebook-sheet-container"
        }
    }
}

private fun renderScorebookHeader(parent: DIV, game: Game, onToggle: (HalfInning) -> Unit) {
    parent.div {
        css {
            display = Display.flex
            justifyContent = JustifyContent.spaceBetween
            alignItems = Align.center
            borderBottom = Border(2.px, BorderStyle.solid, Color("#d2cdc6"))
            paddingBottom = 1.rem
            marginBottom = 1.5.rem
        }
        h2 {
            +"SCOREBOOK"
            css {
                margin = Margin(0.px)
                fontWeight = FontWeight.bold
                letterSpacing = 2.px
            }
        }
        renderToggleButtonGroup(this, game, onToggle)
    }
}

private fun renderToggleButtonGroup(parent: DIV, game: Game, onToggle: (HalfInning) -> Unit) {
    parent.div {
        id = "toggle-btn-group"
        css {
            display = Display.flex
            gap = 0.5.rem
        }
        button(classes = "btn btn-primary") {
            id = "btn-away-batting"
            +"${game.awayTeam.abbreviation} BATTING (TOP)"
            css {
                padding = Padding(0.5.rem, 1.rem)
            }
            onClickFunction = { onToggle(HalfInning.TOP) }
        }
        button(classes = "btn btn-secondary") {
            id = "btn-home-batting"
            +"${game.homeTeam.abbreviation} BATTING (BOTTOM)"
            css {
                padding = Padding(0.5.rem, 1.rem)
            }
            onClickFunction = { onToggle(HalfInning.BOTTOM) }
        }
    }
}

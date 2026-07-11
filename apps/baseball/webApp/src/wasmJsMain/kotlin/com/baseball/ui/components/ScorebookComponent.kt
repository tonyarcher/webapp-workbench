package com.baseball.ui.components

import com.baseball.UiConstants

import com.baseball.models.*
import com.baseball.Constants
import org.w3c.dom.*
import com.baseball.ui.appendElement
import com.baseball.ui.onClick
import kotlinx.browser.document

// High-level Visual Scorebook component controlling tabs and coordination
internal fun renderScorebookView(container: HTMLElement, game: Game, boxScore: BoxScore, events: List<PlayEvent>) {
    container.innerHTML = ""

    val scorebookWrapper = container.appendElement(UiConstants.Html.DIV, "scorebook-wrapper") {
        style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "#fcfbfa")
        style.setProperty(UiConstants.Css.COLOR, "#2b2a28")
        style.setProperty(UiConstants.Css.PADDING, "2rem")
        style.setProperty(UiConstants.Css.BORDER_RADIUS, "12px")
        style.setProperty(UiConstants.Css.BORDER, "2px solid #d2cdc6")
        style.setProperty(UiConstants.Css.BOX_SHADOW, "0 6px 20px rgba(0, 0, 0, 0.15)")
        style.setProperty("font-family", "'Courier New', Courier, monospace")
    }

    var activeHalf = HalfInning.TOP // TOP for Away Batting, BOTTOM for Home Batting
    
    val toggleRow = scorebookWrapper.appendElement(UiConstants.Html.DIV) {
        style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
        style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.SPACE_BETWEEN)
        style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
        style.setProperty(UiConstants.Css.BORDER_BOTTOM, "2px solid #d2cdc6")
        style.setProperty(UiConstants.Css.PADDING_BOTTOM, "1rem")
        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1.5rem")
    }

    toggleRow.appendElement(UiConstants.Html.H2) {
        textContent = "VISUAL SCOREBOOK"
        style.setProperty(UiConstants.Css.MARGIN, "0")
        style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
        style.setProperty("letter-spacing", "2px")
    }

    val toggleBtnGroup = toggleRow.appendElement(UiConstants.Html.DIV) {
        style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
        style.setProperty(UiConstants.Css.GAP, "0.5rem")
    }

    fun redrawScorecard(half: HalfInning) {
        activeHalf = half
        val sheetContainer = document.getElementById("scorebook-sheet-container") as? HTMLElement ?: return
        sheetContainer.innerHTML = ""
        renderScorecardSheet(sheetContainer, game, boxScore, events, activeHalf)
    }

    val btnAway = toggleBtnGroup.appendElement(UiConstants.Html.BUTTON, "btn") {
        textContent = "${game.awayTeam.abbreviation} BATTING (TOP)"
        style.setProperty(UiConstants.Css.PADDING, "0.5rem 1rem")
        onClick {
            redrawScorecard(HalfInning.TOP)
            classList.add("btn-primary")
            classList.remove("btn-secondary")
            val other = toggleBtnGroup.children.item(1) as? HTMLButtonElement
            other?.classList?.add("btn-secondary")
            other?.classList?.remove("btn-primary")
        }
    }
    btnAway.classList.add("btn-primary")

    val btnHome = toggleBtnGroup.appendElement(UiConstants.Html.BUTTON, "btn btn-secondary") {
        textContent = "${game.homeTeam.abbreviation} BATTING (BOTTOM)"
        style.setProperty(UiConstants.Css.PADDING, "0.5rem 1rem")
        onClick {
            redrawScorecard(HalfInning.BOTTOM)
            classList.add("btn-primary")
            classList.remove("btn-secondary")
            btnAway.classList.add("btn-secondary")
            btnAway.classList.remove("btn-primary")
        }
    }

    scorebookWrapper.appendElement(UiConstants.Html.DIV) {
        id = "scorebook-sheet-container"
    }

    redrawScorecard(HalfInning.TOP)
}

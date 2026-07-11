package com.baseball.ui.components

import com.baseball.models.*
import com.baseball.Constants
import org.w3c.dom.*
import com.baseball.ui.appendElement
import com.baseball.ui.onClick
import kotlinx.browser.document

// High-level Visual Scorebook component controlling tabs and coordination
internal fun renderScorebookView(container: HTMLElement, game: Game, boxScore: BoxScore, events: List<PlayEvent>) {
    container.innerHTML = ""

    val scorebookWrapper = container.appendElement(Constants.Html.DIV, "scorebook-wrapper") {
        style.setProperty(Constants.Css.BACKGROUND_COLOR, "#fcfbfa")
        style.setProperty(Constants.Css.COLOR, "#2b2a28")
        style.setProperty(Constants.Css.PADDING, "2rem")
        style.setProperty(Constants.Css.BORDER_RADIUS, "12px")
        style.setProperty(Constants.Css.BORDER, "2px solid #d2cdc6")
        style.setProperty(Constants.Css.BOX_SHADOW, "0 6px 20px rgba(0, 0, 0, 0.15)")
        style.setProperty("font-family", "'Courier New', Courier, monospace")
    }

    var activeHalf = HalfInning.TOP // TOP for Away Batting, BOTTOM for Home Batting
    
    val toggleRow = scorebookWrapper.appendElement(Constants.Html.DIV) {
        style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.FLEX)
        style.setProperty(Constants.Css.JUSTIFY_CONTENT, Constants.CssValues.SPACE_BETWEEN)
        style.setProperty(Constants.Css.ALIGN_ITEMS, Constants.CssValues.CENTER)
        style.setProperty(Constants.Css.BORDER_BOTTOM, "2px solid #d2cdc6")
        style.setProperty(Constants.Css.PADDING_BOTTOM, "1rem")
        style.setProperty(Constants.Css.MARGIN_BOTTOM, "1.5rem")
    }

    toggleRow.appendElement(Constants.Html.H2) {
        textContent = "VISUAL SCOREBOOK"
        style.setProperty(Constants.Css.MARGIN, "0")
        style.setProperty(Constants.Css.FONT_WEIGHT, Constants.CssValues.BOLD)
        style.setProperty("letter-spacing", "2px")
    }

    val toggleBtnGroup = toggleRow.appendElement(Constants.Html.DIV) {
        style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.FLEX)
        style.setProperty(Constants.Css.GAP, "0.5rem")
    }

    fun redrawScorecard(half: HalfInning) {
        activeHalf = half
        val sheetContainer = document.getElementById("scorebook-sheet-container") as? HTMLElement ?: return
        sheetContainer.innerHTML = ""
        renderScorecardSheet(sheetContainer, game, boxScore, events, activeHalf)
    }

    val btnAway = toggleBtnGroup.appendElement(Constants.Html.BUTTON, "btn") {
        textContent = "${game.awayTeam.abbreviation} BATTING (TOP)"
        style.setProperty(Constants.Css.PADDING, "0.5rem 1rem")
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

    val btnHome = toggleBtnGroup.appendElement(Constants.Html.BUTTON, "btn btn-secondary") {
        textContent = "${game.homeTeam.abbreviation} BATTING (BOTTOM)"
        style.setProperty(Constants.Css.PADDING, "0.5rem 1rem")
        onClick {
            redrawScorecard(HalfInning.BOTTOM)
            classList.add("btn-primary")
            classList.remove("btn-secondary")
            btnAway.classList.add("btn-secondary")
            btnAway.classList.remove("btn-primary")
        }
    }

    scorebookWrapper.appendElement(Constants.Html.DIV) {
        id = "scorebook-sheet-container"
    }

    redrawScorecard(HalfInning.TOP)
}

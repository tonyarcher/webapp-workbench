package com.baseball.ui.components

import com.baseball.models.*
import org.w3c.dom.*
import com.baseball.ui.appendElement
import com.baseball.ui.onClick
import kotlinx.browser.document

// High-level Visual Scorebook component controlling tabs and coordination
internal fun renderScorebookView(container: HTMLElement, game: Game, boxScore: BoxScore, events: List<PlayEvent>) {
    container.innerHTML = ""

    val scorebookWrapper = container.appendElement("div", "scorebook-wrapper") {
        style.setProperty("background-color", "#fcfbfa")
        style.setProperty("color", "#2b2a28")
        style.setProperty("padding", "2rem")
        style.setProperty("border-radius", "12px")
        style.setProperty("border", "2px solid #d2cdc6")
        style.setProperty("box-shadow", "0 6px 20px rgba(0, 0, 0, 0.15)")
        style.setProperty("font-family", "'Courier New', Courier, monospace")
    }

    var activeHalf = HalfInning.TOP // TOP for Away Batting, BOTTOM for Home Batting
    
    val toggleRow = scorebookWrapper.appendElement("div") {
        style.setProperty("display", "flex")
        style.setProperty("justify-content", "space-between")
        style.setProperty("align-items", "center")
        style.setProperty("border-bottom", "2px solid #d2cdc6")
        style.setProperty("padding-bottom", "1rem")
        style.setProperty("margin-bottom", "1.5rem")
    }

    toggleRow.appendElement("h2") {
        textContent = "VISUAL SCOREBOOK"
        style.setProperty("margin", "0")
        style.setProperty("font-weight", "bold")
        style.setProperty("letter-spacing", "2px")
    }

    val toggleBtnGroup = toggleRow.appendElement("div") {
        style.setProperty("display", "flex")
        style.setProperty("gap", "0.5rem")
    }

    fun redrawScorecard(half: HalfInning) {
        activeHalf = half
        val sheetContainer = document.getElementById("scorebook-sheet-container") as? HTMLElement ?: return
        sheetContainer.innerHTML = ""
        renderScorecardSheet(sheetContainer, game, boxScore, events, activeHalf)
    }

    val btnAway = toggleBtnGroup.appendElement("button", "btn") {
        textContent = "${game.awayTeam.abbreviation} BATTING (TOP)"
        style.setProperty("padding", "0.5rem 1rem")
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

    val btnHome = toggleBtnGroup.appendElement("button", "btn btn-secondary") {
        textContent = "${game.homeTeam.abbreviation} BATTING (BOTTOM)"
        style.setProperty("padding", "0.5rem 1rem")
        onClick {
            redrawScorecard(HalfInning.BOTTOM)
            classList.add("btn-primary")
            classList.remove("btn-secondary")
            btnAway.classList.add("btn-secondary")
            btnAway.classList.remove("btn-primary")
        }
    }

    scorebookWrapper.appendElement("div") {
        id = "scorebook-sheet-container"
    }

    redrawScorecard(HalfInning.TOP)
}

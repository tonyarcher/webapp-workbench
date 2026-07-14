package com.baseball.ui.components

import com.baseball.UiConstants
import com.baseball.models.*
import com.baseball.ui.*
import org.w3c.dom.*
import kotlinx.html.*
import kotlinx.html.js.*
import kotlinx.html.dom.*

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

    val wrapper = container.div(classes = "scorebook-wrapper") {
        style = "background-color: #fcfbfa; color: #2b2a28; padding: 2rem; border-radius: 12px; border: 2px solid #d2cdc6; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15); font-family: 'Courier New', Courier, monospace;"

        div {
            style = "display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #d2cdc6; padding-bottom: 1rem; margin-bottom: 1.5rem;"

            h2 {
                +"SCOREBOOK"
                style = "margin: 0; font-weight: bold; letter-spacing: 2px;"
            }

            div {
                id = "toggle-btn-group"
                style = "display: flex; gap: 0.5rem;"

                button(classes = "btn btn-primary") {
                    id = "btn-away-batting"
                    +"${game.awayTeam.abbreviation} BATTING (TOP)"
                    style = "padding: 0.5rem 1rem;"
                    onClickFunction = {
                        redrawScorecard(HalfInning.TOP)
                        btnAway?.classList?.add("btn-primary")
                        btnAway?.classList?.remove("btn-secondary")
                        btnHome?.classList?.add("btn-secondary")
                        btnHome?.classList?.remove("btn-primary")
                    }
                }

                button(classes = "btn btn-secondary") {
                    id = "btn-home-batting"
                    +"${game.homeTeam.abbreviation} BATTING (BOTTOM)"
                    style = "padding: 0.5rem 1rem;"
                    onClickFunction = {
                        redrawScorecard(HalfInning.BOTTOM)
                        btnHome?.classList?.add("btn-primary")
                        btnHome?.classList?.remove("btn-secondary")
                        btnAway?.classList?.add("btn-secondary")
                        btnAway?.classList?.remove("btn-primary")
                    }
                }
            }
        }

        div {
            id = "scorebook-sheet-container"
        }
    }

    sheetContainer = wrapper.querySelector("#scorebook-sheet-container") as? HTMLDivElement
    btnAway = wrapper.querySelector("#btn-away-batting") as? HTMLButtonElement
    btnHome = wrapper.querySelector("#btn-home-batting") as? HTMLButtonElement

    redrawScorecard(HalfInning.TOP)
}

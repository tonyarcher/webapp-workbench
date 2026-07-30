package com.baseball.ui.tabs.dashboard

import com.baseball.api
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.ui.core.UiConstants
import com.baseball.ui.core.css
import com.baseball.ui.core.launch
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.selectedSeasonId
import com.baseball.ui.state.teamsList
import kotlinx.browser.document
import kotlinx.css.Align
import kotlinx.css.Border
import kotlinx.css.BorderStyle
import kotlinx.css.Color
import kotlinx.css.Cursor
import kotlinx.css.Display
import kotlinx.css.FlexWrap
import kotlinx.css.JustifyContent
import kotlinx.css.Margin
import kotlinx.css.alignItems
import kotlinx.css.border
import kotlinx.css.cursor
import kotlinx.css.display
import kotlinx.css.flexWrap
import kotlinx.css.gap
import kotlinx.css.justifyContent
import kotlinx.css.margin
import kotlinx.css.marginBottom
import kotlinx.css.opacity
import kotlinx.css.px
import kotlinx.html.DIV
import kotlinx.html.InputType
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.h3
import kotlinx.html.h4
import kotlinx.html.hr
import kotlinx.html.id
import kotlinx.html.input
import kotlinx.html.js.onClickFunction
import kotlinx.html.label
import kotlinx.html.option
import kotlinx.html.select
import kotlinx.html.span
import org.w3c.dom.HTMLInputElement
import org.w3c.dom.HTMLSelectElement

internal fun DIV.renderScheduleManagerCard(games: List<Game>) {
    div(classes = "card") {
        css { marginBottom = UiConstants.CARD_GAP_LARGE }
        h3 { +"Schedule Manager" }
        renderRoundRobinSection(games.isNotEmpty())
        hr {
            css {
                border = Border(1.px, BorderStyle.solid, Color("rgba(255,255,255,0.05)"))
                margin = Margin(UiConstants.CARD_GAP, 0.px)
            }
        }
        h4 { +"Schedule a Single Game" }
        renderSingleGameScheduleForm()
    }
}

private fun DIV.renderRoundRobinSection(hasGames: Boolean) {
    div {
        css {
            display = Display.flex
            justifyContent = JustifyContent.spaceBetween
            alignItems = Align.center
            marginBottom = UiConstants.CARD_GAP
        }
        span { +"Generate a full round-robin season schedule automatically:" }
        button(classes = if (hasGames) "btn btn-secondary" else "btn") {
            +"Generate Round-Robin Schedule"
            if (hasGames) {
                disabled = true
                css {
                    opacity = 0.5
                    cursor = Cursor.notAllowed
                }
            } else {
                onClickFunction = {
                    launch {
                        api.generateSchedule(selectedSeasonId!!)
                        renderCurrentTab()
                    }
                }
            }
        }
    }
}

private fun DIV.renderSingleGameScheduleForm() {
    div {
        css {
            display = Display.flex
            flexWrap = FlexWrap.wrap
            gap = UiConstants.CARD_GAP
            alignItems = Align.flexEnd
        }
        renderTeamSelectGroup("Home Team", "sched-home-select", defaultIndex = 0)
        renderTeamSelectGroup("Away Team", "sched-away-select", defaultIndex = 1)
        renderDateInputGroup()
        button(classes = "btn") {
            +"Schedule"
            onClickFunction = { handleScheduleSingleGameSubmit() }
        }
    }
}

private fun DIV.renderTeamSelectGroup(labelText: String, selectId: String, defaultIndex: Int) {
    div(classes = "form-group") {
        css {
            marginBottom = 0.px
            put("flex", "1 1 200px")
        }
        label { +labelText }
        select(classes = "form-control") {
            id = selectId
            teamsList.forEachIndexed { index, t ->
                option {
                    value = t.id.toString()
                    selected = (index == defaultIndex) || (teamsList.size <= defaultIndex && index == 0)
                    +"${t.city} ${t.name}"
                }
            }
        }
    }
}

private fun DIV.renderDateInputGroup() {
    div(classes = "form-group") {
        css {
            marginBottom = 0.px
            put("flex", "1 1 150px")
        }
        label { +"Date" }
        input(type = InputType.text, classes = "form-control") {
            id = "sched-date-input"
            value = "2026-07-10"
        }
    }
}

private fun handleScheduleSingleGameSubmit() {
    val homeSel = document.getElementById("sched-home-select") as? HTMLSelectElement
    val awaySel = document.getElementById("sched-away-select") as? HTMLSelectElement
    val dateInp = document.getElementById("sched-date-input") as? HTMLInputElement
    val homeId = homeSel?.value?.toLongOrNull()
    val awayId = awaySel?.value?.toLongOrNull()
    val dateVal = dateInp?.value

    if (homeId != null && awayId != null && !dateVal.isNullOrEmpty()) {
        launch {
            val hTeam = teamsList.find { it.id == homeId }
            val aTeam = teamsList.find { it.id == awayId }
            if (hTeam != null && aTeam != null) {
                val newGame = Game(
                    id = null,
                    seasonId = selectedSeasonId!!,
                    homeTeam = hTeam,
                    awayTeam = aTeam,
                    date = dateVal,
                    status = GameStatus.SCHEDULED,
                )
                api.createGame(newGame)
                renderCurrentTab()
            }
        }
    }
}

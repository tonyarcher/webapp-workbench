package com.baseball.ui.tabs.dashboard

import com.baseball.api
import com.baseball.models.Game
import com.baseball.models.GameStatus
import com.baseball.ui.core.launch
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.selectedSeasonId
import com.baseball.ui.state.teamsList
import kotlinx.browser.document
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
    div(classes = "card margin-bottom-lg") {
        h3 { +"Schedule Manager" }
        renderRoundRobinSection(games.isNotEmpty())
        hr(classes = "margin-top-md margin-bottom-md")
        h4 { +"Schedule a Single Game" }
        renderSingleGameScheduleForm()
    }
}

private fun DIV.renderRoundRobinSection(hasGames: Boolean) {
    div(classes = "flex-between margin-bottom-md") {
        span { +"Generate a full round-robin season schedule automatically:" }
        button(classes = if (hasGames) "btn btn-secondary" else "btn") {
            +"Generate Round-Robin Schedule"
            if (hasGames) {
                disabled = true
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
    div(classes = "flex-between flex-gap-md") {
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
    div(classes = "form-group flex-grow") {
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
    div(classes = "form-group flex-grow") {
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

package com.baseball.ui

import com.baseball.api
import com.baseball.models.*
import com.baseball.Constants
import org.w3c.dom.*

// LEAGUES AND SEASONS TAB
internal fun renderLeaguesTab(container: HTMLElement) {
    container.appendElement(Constants.Html.H1) { textContent = "Leagues & Seasons" }
    
    val grid = container.appendElement(Constants.Html.DIV, "dashboard-grid")
    
    // Left side: leagues list
    val leftCol = grid.appendElement(Constants.Html.DIV, "card")
    leftCol.appendElement(Constants.Html.H2) { textContent = "Available Leagues" }
    
    val leaguesListDiv = leftCol.appendElement(Constants.Html.DIV)
    
    fun refreshLeaguesUI() {
        leaguesListDiv.innerHTML = ""
        if (leaguesList.isEmpty()) {
            leaguesListDiv.appendElement(Constants.Html.P) {
                textContent = "No leagues found. Create one to get started!"
                style.setProperty(Constants.Css.COLOR, "var(--text-secondary)")
            }
        } else {
            leaguesList.forEach { league ->
                val card = leaguesListDiv.appendElement(Constants.Html.DIV, "game-card") {
                    style.setProperty(Constants.Css.MARGIN_BOTTOM, "0.75rem")
                    style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.FLEX)
                    style.setProperty(Constants.Css.FLEX_DIRECTION, Constants.CssValues.COLUMN)
                    style.setProperty(Constants.Css.ALIGN_ITEMS, "flex-start")
                    
                    appendElement(Constants.Html.DIV) {
                        style.setProperty(Constants.Css.FONT_WEIGHT, Constants.CssValues.BOLD)
                        style.setProperty(Constants.Css.FONT_SIZE, "1.1rem")
                        textContent = league.name
                    }
                    
                    appendElement(Constants.Html.BUTTON, "btn btn-secondary") {
                        style.setProperty(Constants.Css.MARGIN_TOP, "0.5rem")
                        style.setProperty(Constants.Css.PADDING, "0.25rem 0.75rem")
                        style.setProperty(Constants.Css.FONT_SIZE, "0.85rem")
                        textContent = if (selectedLeagueId == league.id) "Active League" else "Select League"
                        if (selectedLeagueId == league.id) {
                            classList.add("active")
                        }
                        onClick {
                            selectedLeagueId = league.id
                            launch {
                                seasonsList = api.getSeasons(league.id!!)
                                selectedSeasonId = seasonsList.firstOrNull()?.id
                                refreshLeaguesUI()
                            }
                        }
                    }
                }
            }
        }
    }
    
    refreshLeaguesUI()

    // Right side: Create League Form & Seasons manager
    val rightCol = grid.appendElement(Constants.Html.DIV)
    
    // Form to create league
    val createLeagueCard = rightCol.appendElement(Constants.Html.DIV, "card") {
        style.setProperty(Constants.Css.MARGIN_BOTTOM, "2rem")
    }
    createLeagueCard.appendElement(Constants.Html.H2) { textContent = "Create New League" }
    
    val form = createLeagueCard.appendElement(Constants.Html.FORM)
    val fg = form.appendElement(Constants.Html.DIV, "form-group")
    fg.appendElement(Constants.Html.LABEL) { textContent = "League Name" }
    val inputName = fg.appendElement(Constants.Html.INPUT, "form-control") as HTMLInputElement
    inputName.placeholder = "e.g., National Baseball League"
    
    val submitBtn = form.appendElement(Constants.Html.BUTTON, "btn") as HTMLButtonElement
    submitBtn.type = "button"
    submitBtn.textContent = "Create League"
    submitBtn.onClick {
        val name = inputName.value.trim()
        if (name.isNotEmpty()) {
            launch {
                val newLeague = api.createLeague(League(name = name))
                leaguesList = api.getLeagues()
                selectedLeagueId = newLeague.id
                seasonsList = emptyList()
                selectedSeasonId = null
                inputName.value = ""
                refreshLeaguesUI()
                renderCurrentTab()
            }
        }
    }

    // Seasons panel if league is selected
    if (selectedLeagueId != null) {
        val seasonsCard = rightCol.appendElement(Constants.Html.DIV, "card")
        seasonsCard.appendElement(Constants.Html.H2) { textContent = "Seasons in Selected League" }
        
        val seasonsListDiv = seasonsCard.appendElement(Constants.Html.DIV) {
            style.setProperty(Constants.Css.MARGIN_BOTTOM, "1.5rem")
        }
        
        fun refreshSeasonsUI() {
            seasonsListDiv.innerHTML = ""
            if (seasonsList.isEmpty()) {
                seasonsListDiv.appendElement(Constants.Html.P) {
                    textContent = "No seasons in this league yet."
                    style.setProperty(Constants.Css.COLOR, "var(--text-secondary)")
                }
            } else {
                seasonsList.forEach { season ->
                    val seasonItem = seasonsListDiv.appendElement(Constants.Html.DIV, "game-card") {
                        style.setProperty(Constants.Css.MARGIN_BOTTOM, "0.5rem")
                        style.setProperty(Constants.Css.PADDING, "0.75rem")
                        style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.FLEX)
                        style.setProperty(Constants.Css.JUSTIFY_CONTENT, Constants.CssValues.SPACE_BETWEEN)
                        style.setProperty(Constants.Css.ALIGN_ITEMS, Constants.CssValues.CENTER)
                        
                        appendElement(Constants.Html.SPAN) {
                            textContent = "${season.name} (${season.year})"
                            style.setProperty(Constants.Css.FONT_WEIGHT, "600")
                        }
                        
                        appendElement(Constants.Html.BUTTON, "btn btn-secondary") {
                            style.setProperty(Constants.Css.PADDING, "0.25rem 0.5rem")
                            style.setProperty(Constants.Css.FONT_SIZE, "0.8rem")
                            textContent = "Go to Dashboard"
                            onClick {
                                selectedSeasonId = season.id
                                currentTab = Constants.TAB_GAMES
                                updateActiveTabButtons()
                                renderCurrentTab()
                            }
                        }
                    }
                }
            }
        }
        
        refreshSeasonsUI()

        // Create Season Form
        seasonsCard.appendElement(Constants.Html.H3) { textContent = "Create New Season" }
        val sForm = seasonsCard.appendElement(Constants.Html.FORM)
        
        val sfg1 = sForm.appendElement(Constants.Html.DIV, "form-group")
        sfg1.appendElement(Constants.Html.LABEL) { textContent = "Season Name" }
        val inputSName = sfg1.appendElement(Constants.Html.INPUT, "form-control") as HTMLInputElement
        inputSName.placeholder = "e.g., 2026 Regular Season"
        
        val sfg2 = sForm.appendElement(Constants.Html.DIV, "form-group")
        sfg2.appendElement(Constants.Html.LABEL) { textContent = "Year" }
        val inputSYear = sfg2.appendElement(Constants.Html.INPUT, "form-control") as HTMLInputElement
        inputSYear.type = "number"
        inputSYear.value = "2026"
        
        val sSubmit = sForm.appendElement(Constants.Html.BUTTON, "btn") as HTMLButtonElement
        sSubmit.type = "button"
        sSubmit.textContent = "Create Season"
        sSubmit.onClick {
            val name = inputSName.value.trim()
            val yearStr = inputSYear.value.trim()
            if (name.isNotEmpty() && yearStr.isNotEmpty()) {
                launch {
                    api.createSeason(Season(leagueId = selectedLeagueId!!, name = name, year = yearStr.toInt()))
                    seasonsList = api.getSeasons(selectedLeagueId!!)
                    inputSName.value = ""
                    refreshSeasonsUI()
                }
            }
        }
    }
}

package com.baseball

import com.baseball.models.*
import org.w3c.dom.*

// LEAGUES AND SEASONS TAB
internal fun renderLeaguesTab(container: HTMLElement) {
    container.appendElement("h1") { textContent = "Leagues & Seasons" }
    
    val grid = container.appendElement("div", "dashboard-grid")
    
    // Left side: leagues list
    val leftCol = grid.appendElement("div", "card")
    leftCol.appendElement("h2") { textContent = "Available Leagues" }
    
    val leaguesListDiv = leftCol.appendElement("div")
    
    fun refreshLeaguesUI() {
        leaguesListDiv.innerHTML = ""
        if (leaguesList.isEmpty()) {
            leaguesListDiv.appendElement("p") {
                textContent = "No leagues found. Create one to get started!"
                style.color = "var(--text-secondary)"
            }
        } else {
            leaguesList.forEach { league ->
                val card = leaguesListDiv.appendElement("div", "game-card") {
                    style.marginBottom = "0.75rem"
                    style.display = "flex"
                    style.flexDirection = "column"
                    style.alignItems = "flex-start"
                    
                    val titleRow = appendElement("div") {
                        style.fontWeight = "700"
                        style.fontSize = "1.1rem"
                        textContent = league.name
                    }
                    
                    val selectBtn = appendElement("button", "btn btn-secondary") {
                        style.marginTop = "0.5rem"
                        style.padding = "0.25rem 0.75rem"
                        style.fontSize = "0.85rem"
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
    val rightCol = grid.appendElement("div")
    
    // Form to create league
    val createLeagueCard = rightCol.appendElement("div", "card") {
        style.marginBottom = "2rem"
    }
    createLeagueCard.appendElement("h2") { textContent = "Create New League" }
    
    val form = createLeagueCard.appendElement("form")
    val fg = form.appendElement("div", "form-group")
    fg.appendElement("label") { textContent = "League Name" }
    val inputName = fg.appendElement("input", "form-control") as HTMLInputElement
    inputName.placeholder = "e.g., National Baseball League"
    
    val submitBtn = form.appendElement("button", "btn") as HTMLButtonElement
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
        val seasonsCard = rightCol.appendElement("div", "card")
        seasonsCard.appendElement("h2") { textContent = "Seasons in Selected League" }
        
        val seasonsListDiv = seasonsCard.appendElement("div") {
            style.marginBottom = "1.5rem"
        }
        
        fun refreshSeasonsUI() {
            seasonsListDiv.innerHTML = ""
            if (seasonsList.isEmpty()) {
                seasonsListDiv.appendElement("p") {
                    textContent = "No seasons in this league yet."
                    style.color = "var(--text-secondary)"
                }
            } else {
                seasonsList.forEach { season ->
                    val seasonItem = seasonsListDiv.appendElement("div", "game-card") {
                        style.marginBottom = "0.5rem"
                        style.padding = "0.75rem"
                        style.display = "flex"
                        style.justifyContent = "space-between"
                        style.alignItems = "center"
                        
                        appendElement("span") {
                            textContent = "${season.name} (${season.year})"
                            style.fontWeight = "600"
                        }
                        
                        appendElement("button", "btn btn-secondary") {
                            style.padding = "0.25rem 0.5rem"
                            style.fontSize = "0.8rem"
                            textContent = "Go to Dashboard"
                            onClick {
                                selectedSeasonId = season.id
                                currentTab = "games"
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
        seasonsCard.appendElement("h3") { textContent = "Create New Season" }
        val sForm = seasonsCard.appendElement("form")
        
        val sfg1 = sForm.appendElement("div", "form-group")
        sfg1.appendElement("label") { textContent = "Season Name" }
        val inputSName = sfg1.appendElement("input", "form-control") as HTMLInputElement
        inputSName.placeholder = "e.g., 2026 Regular Season"
        
        val sfg2 = sForm.appendElement("div", "form-group")
        sfg2.appendElement("label") { textContent = "Year" }
        val inputSYear = sfg2.appendElement("input", "form-control") as HTMLInputElement
        inputSYear.type = "number"
        inputSYear.value = "2026"
        
        val sSubmit = sForm.appendElement("button", "btn") as HTMLButtonElement
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

package com.baseball.ui.tabs

import com.baseball.api
import com.baseball.models.*
import com.baseball.ui.*

import kotlinx.css.*
import kotlinx.html.*
import kotlinx.html.dom.append
import kotlinx.html.js.onChangeFunction
import kotlinx.html.js.onClickFunction
import kotlinx.html.js.option
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLSelectElement

private var selectedStatsSubTab = "batting" // batting, pitching, fielding
private var statsSelectedTeamId: Long? = null // null means All Teams

internal fun renderStatsTab(container: HTMLElement) {
    container.h1 { +"Season Player Statistics" }

    var selectS: HTMLSelectElement? = null
    var selectT: HTMLSelectElement? = null

    fun populateSeasonsDropdown() {
        val selectEl = selectS ?: return
        selectEl.innerHTML = ""
        seasonsList.forEach { season ->
            selectEl.append.option {
                value = season.id.toString()
                +"${season.name} (${season.year})"
                selected = (selectedSeasonId == season.id)
            }
        }
    }

    val filterCard =
        container.div(classes = "card") {
            css {
                marginBottom = 2.rem
                display = Display.flex
                gap = 1.5.rem
                alignItems = Align.flexEnd
            }

            div(classes = "form-group") {
                css {
                    marginBottom = 0.px
                    flexGrow = 1.0
                }
                label { +"Select Season" }
                select(classes = "form-control") {
                    id = "stats-season-dropdown"
                }
            }

            div(classes = "form-group") {
                css {
                    marginBottom = 0.px
                    flexGrow = 1.0
                }
                label { +"Filter by Team" }
                select(classes = "form-control") {
                    id = "stats-team-dropdown"
                    option {
                        value = ""
                        +"All Teams"
                        selected = (statsSelectedTeamId == null)
                    }
                    teamsList.forEach { team ->
                        option {
                            value = team.id.toString()
                            +"${team.city} ${team.name}"
                            selected = (statsSelectedTeamId == team.id)
                        }
                    }
                    onChangeFunction = { event ->
                        val tid = (event.target as? HTMLSelectElement)?.value?.toLongOrNull()
                        statsSelectedTeamId = tid
                        renderCurrentTab()
                    }
                }
            }

            button(classes = "btn") {
                id = "load-stats-btn"
                +"Load Statistics"
                onClickFunction = {
                    selectedSeasonId = selectS?.value?.toLongOrNull()
                    renderCurrentTab()
                }
            }
        }

    selectS = filterCard.querySelector("#stats-season-dropdown") as? HTMLSelectElement
    selectT = filterCard.querySelector("#stats-team-dropdown") as? HTMLSelectElement

    populateSeasonsDropdown()

    if (selectedSeasonId == null) {
        container.div(classes = "card") {
            css {
                textAlign = TextAlign.center
                padding = Padding(3.rem)
            }
            p {
                +"Please select a season, then click Load Statistics."
                css { color = Color("var(--text-secondary)") }
            }
        }
        return
    }

    // Toggle Sub Tabs (Batting / Pitching / Fielding)
    container.div {
        css {
            display = Display.flex
            gap = 1.rem
            marginBottom = 1.5.rem
        }

        button(classes = "btn${if (selectedStatsSubTab == "batting") "" else " btn-secondary"}") {
            +"Batting"
            onClickFunction = {
                selectedStatsSubTab = "batting"
                renderCurrentTab()
            }
        }

        button(classes = "btn${if (selectedStatsSubTab == "pitching") "" else " btn-secondary"}") {
            +"Pitching"
            onClickFunction = {
                selectedStatsSubTab = "pitching"
                renderCurrentTab()
            }
        }

        button(classes = "btn${if (selectedStatsSubTab == "fielding") "" else " btn-secondary"}") {
            +"Fielding"
            onClickFunction = {
                selectedStatsSubTab = "fielding"
                renderCurrentTab()
            }
        }
    }

    launch {
        val stats = api.getSeasonStats(selectedSeasonId!!)
        val playersList = api.getPlayers()

        container.div(classes = "card") {
            h2 {
                +"${selectedStatsSubTab.replaceFirstChar { it.uppercaseChar() }} Statistics"
            }

            div(classes = "table-container") {
                table {
                    when (selectedStatsSubTab) {
                        "batting" -> {
                            thead {
                                tr {
                                    th { +"Player" }
                                    th { +"Team" }
                                    th { +"AB" }
                                    th { +"H" }
                                    th { +"R" }
                                    th { +"RBI" }
                                    th { +"2B" }
                                    th { +"3B" }
                                    th { +"HR" }
                                    th { +"BB" }
                                    th { +"SO" }
                                    th { +"AVG" }
                                    th { +"OBP" }
                                    th { +"SLG" }
                                    th { +"OPS" }
                                }
                            }
                            tbody {
                                val finalFiltered =
                                    stats.battingStats.filter { row ->
                                        val playerRecord = playersList.find { it.id == row.playerId }
                                        statsSelectedTeamId == null || playerRecord?.teamId == statsSelectedTeamId
                                    }

                                if (finalFiltered.isEmpty()) {
                                    tr {
                                        td {
                                            attributes["colspan"] = "15"
                                            +"No batting statistics recorded for this selection."
                                            css {
                                                textAlign = TextAlign.center
                                                color = Color("var(--text-secondary)")
                                            }
                                        }
                                    }
                                } else {
                                    finalFiltered.forEach { row ->
                                        val playerRecord = playersList.find { it.id == row.playerId }
                                        val teamName = teamsList.find { it.id == playerRecord?.teamId }?.name ?: "Free Agent"
                                        val avg = if (row.atBats > 0) row.hits.toDouble() / row.atBats else 0.0
                                        val obp =
                                            if (row.atBats + row.walks + row.hitByPitch > 0) {
                                                (row.hits + row.walks + row.hitByPitch).toDouble() /
                                                    (row.atBats + row.walks + row.hitByPitch)
                                            } else {
                                                0.0
                                            }
                                        val singles = row.hits - row.doubles - row.triples - row.homeRuns
                                        val slg =
                                            if (row.atBats > 0) {
                                                (singles + 2 * row.doubles + 3 * row.triples + 4 * row.homeRuns).toDouble() / row.atBats
                                            } else {
                                                0.0
                                            }
                                        val ops = obp + slg

                                        tr {
                                            td {
                                                +"${row.playerName} (#${row.jerseyNumber})"
                                                css { fontWeight = FontWeight.bold }
                                            }
                                            td { +teamName }
                                            td { +row.atBats.toString() }
                                            td { +row.hits.toString() }
                                            td { +row.runs.toString() }
                                            td { +row.rbi.toString() }
                                            td { +row.doubles.toString() }
                                            td { +row.triples.toString() }
                                            td { +row.homeRuns.toString() }
                                            td { +row.walks.toString() }
                                            td { +row.strikeOuts.toString() }
                                            td { +formatDecimal(avg) }
                                            td { +formatDecimal(obp) }
                                            td { +formatDecimal(slg) }
                                            td { +formatDecimal(ops) }
                                        }
                                    }
                                }
                            }
                        }
                        "pitching" -> {
                            thead {
                                tr {
                                    th { +"Player" }
                                    th { +"Team" }
                                    th { +"IP" }
                                    th { +"H" }
                                    th { +"R" }
                                    th { +"ER" }
                                    th { +"BB" }
                                    th { +"SO" }
                                    th { +"HR" }
                                    th { +"ERA" }
                                    th { +"WHIP" }
                                }
                            }
                            tbody {
                                val finalFiltered =
                                    stats.pitchingStats.filter { row ->
                                        val playerRecord = playersList.find { it.id == row.playerId }
                                        statsSelectedTeamId == null || playerRecord?.teamId == statsSelectedTeamId
                                    }

                                if (finalFiltered.isEmpty()) {
                                    tr {
                                        td {
                                            attributes["colspan"] = "11"
                                            +"No pitching statistics recorded for this selection."
                                            css {
                                                textAlign = TextAlign.center
                                                color = Color("var(--text-secondary)")
                                            }
                                        }
                                    }
                                } else {
                                    finalFiltered.forEach { row ->
                                        val playerRecord = playersList.find { it.id == row.playerId }
                                        val teamName = teamsList.find { it.id == playerRecord?.teamId }?.name ?: "Free Agent"
                                        val ip = formatIP(row.inningsPitchedThirds)
                                        val ipDouble = row.inningsPitchedThirds / 3.0
                                        val era = if (ipDouble > 0) (row.earnedRuns * 9.0) / ipDouble else 0.0
                                        val whip = if (ipDouble > 0) (row.walksAllowed + row.hitsAllowed).toDouble() / ipDouble else 0.0

                                        tr {
                                            td {
                                                +"${row.playerName} (#${row.jerseyNumber})"
                                                css { fontWeight = FontWeight.bold }
                                            }
                                            td { +teamName }
                                            td { +ip }
                                            td { +row.hitsAllowed.toString() }
                                            td { +row.runsAllowed.toString() }
                                            td { +row.earnedRuns.toString() }
                                            td { +row.walksAllowed.toString() }
                                            td { +row.strikeoutsRecorded.toString() }
                                            td { +row.homeRunsAllowed.toString() }
                                            td { +if (ipDouble > 0) formatDecimal2(era) else "-.--" }
                                            td { +if (ipDouble > 0) formatDecimal2(whip) else "-.--" }
                                        }
                                    }
                                }
                            }
                        }
                        "fielding" -> {
                            thead {
                                tr {
                                    th { +"Player" }
                                    th { +"Team" }
                                    th { +"Putouts (PO)" }
                                    th { +"Assists (A)" }
                                    th { +"Errors (E)" }
                                    th { +"FPCT" }
                                }
                            }
                            tbody {
                                val finalFiltered =
                                    stats.fieldingStats.filter { row ->
                                        val playerRecord = playersList.find { it.id == row.playerId }
                                        statsSelectedTeamId == null || playerRecord?.teamId == statsSelectedTeamId
                                    }

                                if (finalFiltered.isEmpty()) {
                                    tr {
                                        td {
                                            attributes["colspan"] = "6"
                                            +"No fielding statistics recorded for this selection."
                                            css {
                                                textAlign = TextAlign.center
                                                color = Color("var(--text-secondary)")
                                            }
                                        }
                                    }
                                } else {
                                    finalFiltered.forEach { row ->
                                        val playerRecord = playersList.find { it.id == row.playerId }
                                        val teamName = teamsList.find { it.id == playerRecord?.teamId }?.name ?: "Free Agent"

                                        tr {
                                            td {
                                                +"${row.playerName} (#${row.jerseyNumber})"
                                                css { fontWeight = FontWeight.bold }
                                            }
                                            td { +teamName }
                                            td { +row.putouts.toString() }
                                            td { +row.assists.toString() }
                                            td { +row.errors.toString() }
                                            td { +formatDecimal(row.fieldingPercentage) }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun formatDecimal(value: Double): String {
    val rounded = (value * 1000).toInt()
    val str = rounded.toString()
    return when {
        rounded == 0 -> ".000"
        rounded >= 1000 -> {
            val s = (value).toString()
            if (s.length >= 5) s.substring(0, 5) else s
        }
        str.length == 1 -> ".00$str"
        str.length == 2 -> ".0$str"
        else -> ".$str"
    }
}

private fun formatDecimal2(value: Double): String {
    val rounded = (value * 100).toInt()
    val whole = rounded / 100
    val frac = rounded % 100
    val fracStr = if (frac < 10) "0$frac" else frac.toString()
    return "$whole.$fracStr"
}

private fun formatIP(thirds: Int): String {
    val whole = thirds / 3
    val rem = thirds % 3
    return "$whole.$rem"
}

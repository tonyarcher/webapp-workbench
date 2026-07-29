package com.baseball.ui.tabs

import com.baseball.api
import com.baseball.models.Player
import com.baseball.models.PlayerBattingStats
import com.baseball.models.PlayerFieldingStats
import com.baseball.models.PlayerPitchingStats
import com.baseball.models.SeasonStats
import com.baseball.ui.UiConstants
import com.baseball.ui.css
import com.baseball.ui.launch
import com.baseball.ui.renderCurrentTab
import com.baseball.ui.seasonsList
import com.baseball.ui.selectedSeasonId
import com.baseball.ui.teamsList
import kotlinx.css.Align
import kotlinx.css.Color
import kotlinx.css.Display
import kotlinx.css.TextAlign
import kotlinx.css.alignItems
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.flexGrow
import kotlinx.css.gap
import kotlinx.css.marginBottom
import kotlinx.css.padding
import kotlinx.css.px
import kotlinx.css.textAlign
import kotlinx.html.TABLE
import kotlinx.html.TBODY
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h2
import kotlinx.html.id
import kotlinx.html.js.onChangeFunction
import kotlinx.html.js.onClickFunction
import kotlinx.html.js.option
import kotlinx.html.label
import kotlinx.html.option
import kotlinx.html.p
import kotlinx.html.select
import kotlinx.html.table
import kotlinx.html.tbody
import kotlinx.html.td
import kotlinx.html.th
import kotlinx.html.thead
import kotlinx.html.tr
import org.w3c.dom.HTMLDivElement
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLSelectElement
import org.w3c.dom.events.Event

internal fun renderStatsFilterCard(container: HTMLElement): Pair<HTMLSelectElement?, HTMLSelectElement?> {
    container.append {
        div(classes = "dashboard-grid") {
            css {
                marginBottom = UiConstants.CARD_MARGIN_BOTTOM
                display = Display.flex
                gap = UiConstants.CARD_GAP_LARGE
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
                onClickFunction = { _: Event ->
                    val selectS = container.querySelector("#stats-season-dropdown") as? HTMLSelectElement
                    selectedSeasonId = selectS?.value?.toLongOrNull()
                    renderCurrentTab()
                }
            }
        }
    }

    val filterCard = container.querySelector(".dashboard-grid") as? HTMLDivElement
    val selectS = filterCard?.querySelector("#stats-season-dropdown") as? HTMLSelectElement
    val selectT = filterCard?.querySelector("#stats-team-dropdown") as? HTMLSelectElement
    return Pair(selectS, selectT)
}

internal fun populateStatsSeasonsDropdown(selectEl: HTMLSelectElement?) {
    if (selectEl == null) return
    selectEl.innerHTML = ""
    seasonsList.forEach { season ->
        selectEl.append.option {
            value = season.id.toString()
            +"${season.name} (${season.year})"
            selected = (selectedSeasonId == season.id)
        }
    }
}

internal fun renderNoSeasonSelectedCard(container: HTMLElement) {
    container.append {
        div(classes = "card") {
            css {
                textAlign = TextAlign.center
                padding = UiConstants.CARD_PADDING_LARGE
            }
            p {
                +"Please select a season, then click Load Statistics."
                css { color = Color("var(--text-secondary)") }
            }
        }
    }
}

internal fun renderStatsSubTabToggle(container: HTMLElement) {
    container.append {
        div {
            css {
                display = Display.flex
                gap = UiConstants.CARD_GAP
                marginBottom = UiConstants.CARD_GAP_LARGE
            }

            button(classes = "btn${if (selectedStatsSubTab == "batting") "" else " btn-secondary"}") {
                +"Batting"
                onClickFunction = { _: Event ->
                    selectedStatsSubTab = "batting"
                    renderCurrentTab()
                }
            }

            button(classes = "btn${if (selectedStatsSubTab == "pitching") "" else " btn-secondary"}") {
                +"Pitching"
                onClickFunction = { _: Event ->
                    selectedStatsSubTab = "pitching"
                    renderCurrentTab()
                }
            }

            button(classes = "btn${if (selectedStatsSubTab == "fielding") "" else " btn-secondary"}") {
                +"Fielding"
                onClickFunction = { _: Event ->
                    selectedStatsSubTab = "fielding"
                    renderCurrentTab()
                }
            }
        }
    }
}

internal fun renderStatsTableSection(container: HTMLElement) {
    launch {
        val stats = api.getSeasonStats(selectedSeasonId!!)
        val playersList = api.getPlayers()

        container.append {
            div(classes = "card") {
                h2 {
                    +"${selectedStatsSubTab.replaceFirstChar { it.uppercaseChar() }} Statistics"
                }

                div(classes = "table-container") {
                    table {
                        when (selectedStatsSubTab) {
                            "batting" -> renderBattingTable(this, stats, playersList)
                            "pitching" -> renderPitchingTable(this, stats, playersList)
                            "fielding" -> renderFieldingTable(this, stats, playersList)
                        }
                    }
                }
            }
        }
    }
}

private fun renderBattingTable(table: TABLE, stats: SeasonStats, playersList: List<Player>) {
    table.thead {
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
    table.tbody {
        val finalFiltered = stats.battingStats.filter { row ->
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
                renderBattingRow(this, row, playerRecord)
            }
        }
    }
}

private fun renderBattingRow(tbody: TBODY, row: PlayerBattingStats, playerRecord: Player?) {
    val teamName = teamsList.find { it.id == playerRecord?.teamId }?.name ?: "Free Agent"
    val avg = if (row.atBats > 0) row.hits.toDouble() / row.atBats else 0.0
    val obp = if (row.atBats + row.walks + row.hitByPitch > 0) {
        (row.hits + row.walks + row.hitByPitch).toDouble() / (row.atBats + row.walks + row.hitByPitch)
    } else 0.0
    val singles = row.hits - row.doubles - row.triples - row.homeRuns
    val slg = if (row.atBats > 0) {
        (singles + 2 * row.doubles + 3 * row.triples + 4 * row.homeRuns).toDouble() / row.atBats
    } else 0.0
    val ops = obp + slg

    tbody.tr {
        td { +row.playerName }
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

private fun renderPitchingTable(table: TABLE, stats: SeasonStats, playersList: List<Player>) {
    table.thead {
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
        }
    }
    table.tbody {
        val finalFiltered = stats.pitchingStats.filter { row ->
            val playerRecord = playersList.find { it.id == row.playerId }
            statsSelectedTeamId == null || playerRecord?.teamId == statsSelectedTeamId
        }

        if (finalFiltered.isEmpty()) {
            tr {
                td {
                    attributes["colspan"] = "10"
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
                renderPitchingRow(this, row, playerRecord)
            }
        }
    }
}

private fun renderPitchingRow(tbody: TBODY, row: PlayerPitchingStats, playerRecord: Player?) {
    val teamName = teamsList.find { it.id == playerRecord?.teamId }?.name ?: "Free Agent"
    val fullInnings = row.inningsPitchedThirds / 3
    val partialThirds = row.inningsPitchedThirds % 3
    val ipStr = "$fullInnings.$partialThirds"
    val ipNum = row.inningsPitchedThirds / 3.0
    val era = if (ipNum > 0) (row.earnedRuns * 9.0) / ipNum else 0.0

    tbody.tr {
        td { +row.playerName }
        td { +teamName }
        td { +ipStr }
        td { +row.hitsAllowed.toString() }
        td { +row.runsAllowed.toString() }
        td { +row.earnedRuns.toString() }
        td { +row.walksAllowed.toString() }
        td { +row.strikeoutsRecorded.toString() }
        td { +row.homeRunsAllowed.toString() }
        td { +if (ipNum > 0) formatDecimal2(era) else "-.--" }
    }
}

private fun renderFieldingTable(table: TABLE, stats: SeasonStats, playersList: List<Player>) {
    table.thead {
        tr {
            th { +"Player" }
            th { +"Team" }
            th { +"POS" }
            th { +"PO" }
            th { +"A" }
            th { +"E" }
            th { +"FLD%" }
        }
    }
    table.tbody {
        val finalFiltered = stats.fieldingStats.filter { row ->
            val playerRecord = playersList.find { it.id == row.playerId }
            statsSelectedTeamId == null || playerRecord?.teamId == statsSelectedTeamId
        }

        if (finalFiltered.isEmpty()) {
            tr {
                td {
                    attributes["colspan"] = "7"
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
                renderFieldingRow(this, row, playerRecord)
            }
        }
    }
}

private fun renderFieldingRow(tbody: TBODY, row: PlayerFieldingStats, playerRecord: Player?) {
    val teamName = teamsList.find { it.id == playerRecord?.teamId }?.name ?: "Free Agent"
    tbody.tr {
        td { +row.playerName }
        td { +teamName }
        td { +row.position }
        td { +row.putouts.toString() }
        td { +row.assists.toString() }
        td { +row.errors.toString() }
        td { +formatDecimal(row.fieldingPercentage) }
    }
}

private fun formatDecimal(value: Double): String {
    val rounded = (value * 1000).toInt()
    val str = rounded.toString()
    return when {
        rounded == 0 -> ".000"
        rounded >= 1000 -> {
            val s = value.toString()
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

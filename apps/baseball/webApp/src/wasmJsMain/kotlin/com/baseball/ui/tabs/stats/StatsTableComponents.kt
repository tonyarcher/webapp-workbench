package com.baseball.ui.tabs.stats

import com.baseball.models.Player
import com.baseball.models.PlayerBattingStats
import com.baseball.models.PlayerFieldingStats
import com.baseball.models.PlayerPitchingStats
import com.baseball.models.SeasonStats
import com.baseball.ui.state.teamsList
import kotlinx.html.TABLE
import kotlinx.html.TBODY
import kotlinx.html.tbody
import kotlinx.html.td
import kotlinx.html.th
import kotlinx.html.thead
import kotlinx.html.tr

internal fun renderBattingTable(table: TABLE, stats: SeasonStats, playersList: List<Player>) {
    table.thead {
        tr {
            th { +"Player" }; th { +"Team" }; th { +"AB" }; th { +"H" }; th { +"R" }; th { +"RBI" }
            th { +"2B" }; th { +"3B" }; th { +"HR" }; th { +"BB" }; th { +"SO" }; th { +"AVG" }
            th { +"OBP" }; th { +"SLG" }; th { +"OPS" }
        }
    }
    table.tbody {
        val finalFiltered = stats.battingStats.filter { row ->
            val playerRecord = playersList.find { it.id == row.playerId }
            statsSelectedTeamId == null || playerRecord?.teamId == statsSelectedTeamId
        }

        if (finalFiltered.isEmpty()) {
            tr {
                td(classes = "text-center text-muted") {
                    attributes["colspan"] = "15"
                    +"No batting statistics recorded for this selection."
                }
            }
        } else {
            finalFiltered.forEach { row ->
                val playerRecord = playersList.find { it.id == row.playerId }
                renderBattingRow(this@tbody, row, playerRecord)
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
        td { +row.playerName }; td { +teamName }; td { +row.atBats.toString() }
        td { +row.hits.toString() }; td { +row.runs.toString() }; td { +row.rbi.toString() }
        td { +row.doubles.toString() }; td { +row.triples.toString() }; td { +row.homeRuns.toString() }
        td { +row.walks.toString() }; td { +row.strikeOuts.toString() }; td { +formatDecimal(avg) }
        td { +formatDecimal(obp) }; td { +formatDecimal(slg) }; td { +formatDecimal(ops) }
    }
}

internal fun renderPitchingTable(table: TABLE, stats: SeasonStats, playersList: List<Player>) {
    table.thead {
        tr {
            th { +"Player" }; th { +"Team" }; th { +"IP" }; th { +"H" }; th { +"R" }
            th { +"ER" }; th { +"BB" }; th { +"SO" }; th { +"HR" }; th { +"ERA" }
        }
    }
    table.tbody {
        val finalFiltered = stats.pitchingStats.filter { row ->
            val playerRecord = playersList.find { it.id == row.playerId }
            statsSelectedTeamId == null || playerRecord?.teamId == statsSelectedTeamId
        }

        if (finalFiltered.isEmpty()) {
            tr {
                td(classes = "text-center text-muted") {
                    attributes["colspan"] = "10"
                    +"No pitching statistics recorded for this selection."
                }
            }
        } else {
            finalFiltered.forEach { row ->
                val playerRecord = playersList.find { it.id == row.playerId }
                renderPitchingRow(this@tbody, row, playerRecord)
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
        td { +row.playerName }; td { +teamName }; td { +ipStr }; td { +row.hitsAllowed.toString() }
        td { +row.runsAllowed.toString() }; td { +row.earnedRuns.toString() }; td { +row.walksAllowed.toString() }
        td { +row.strikeoutsRecorded.toString() }; td { +row.homeRunsAllowed.toString() }
        td { +if (ipNum > 0) formatDecimal2(era) else "-.--" }
    }
}

internal fun renderFieldingTable(table: TABLE, stats: SeasonStats, playersList: List<Player>) {
    table.thead {
        tr {
            th { +"Player" }; th { +"Team" }; th { +"POS" }; th { +"PO" }; th { +"A" }; th { +"E" }; th { +"FLD%" }
        }
    }
    table.tbody {
        val finalFiltered = stats.fieldingStats.filter { row ->
            val playerRecord = playersList.find { it.id == row.playerId }
            statsSelectedTeamId == null || playerRecord?.teamId == statsSelectedTeamId
        }

        if (finalFiltered.isEmpty()) {
            tr {
                td(classes = "text-center text-muted") {
                    attributes["colspan"] = "7"
                    +"No fielding statistics recorded for this selection."
                }
            }
        } else {
            finalFiltered.forEach { row ->
                val playerRecord = playersList.find { it.id == row.playerId }
                renderFieldingRow(this@tbody, row, playerRecord)
            }
        }
    }
}

private fun renderFieldingRow(tbody: TBODY, row: PlayerFieldingStats, playerRecord: Player?) {
    val teamName = teamsList.find { it.id == playerRecord?.teamId }?.name ?: "Free Agent"
    tbody.tr {
        td { +row.playerName }; td { +teamName }; td { +row.position }; td { +row.putouts.toString() }
        td { +row.assists.toString() }; td { +row.errors.toString() }; td { +formatDecimal(row.fieldingPercentage) }
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

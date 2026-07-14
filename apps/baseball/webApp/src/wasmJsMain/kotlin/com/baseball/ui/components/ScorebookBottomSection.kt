package com.baseball.ui.components

import com.baseball.UiConstants
import com.baseball.BaseballConstants
import com.baseball.models.*
import com.baseball.game.*
import com.baseball.ui.*
import org.w3c.dom.*
import kotlinx.html.*
import kotlinx.html.js.*
import kotlinx.html.dom.*

fun renderScorebookBottomSection(
    container: HTMLElement,
    game: Game,
    boxScore: BoxScore,
    isHomeBatting: Boolean,
    maxInning: Int,
    localAwayRoster: List<Player>,
    localHomeRoster: List<Player>,
    localAwayActivePitcherId: Long,
    localHomeActivePitcherId: Long,
    localAwayActivePitcherName: String,
    localHomeActivePitcherName: String
) {
    val bottomGrid = container.div {
        style = "display: flex; flex-wrap: wrap; gap: 1.5rem; margin-top: 1.5rem;"
    }

    // A. HOME DEFENSE FIELD DIAGRAM (Bottom Left)
    val cardEl = bottomGrid.div(classes = "card") {
        style = "background-color: #f9f7f2; border: 2px solid #5a544a; padding: 1rem; color: #2b2a28; flex: 1 1 300px;"

        h3 {
            +"HOME DEFENSE FIELD"
            style = "text-align: center; margin: 0 0 1rem 0; font-size: 1rem; font-weight: bold; border-bottom: 1px solid #c2bcae; padding-bottom: 0.25rem;"
        }
    }

    val fieldWrapper = cardEl.div {
        style = "position: relative; width: 100%; height: 260px; background-color: #edf2eb; border: 1px solid #c2bcae; border-radius: 8px; overflow: hidden;"

        // Infield dirt circle centered around the pitcher's mound
        div {
            style = "position: absolute; bottom: 10px; left: calc(50% - 90px); width: 180px; height: 180px; border-radius: 50%; background-color: #e5ccb3; z-index: 1;"
        }

        // Basepaths diamond (rotated square) centered on dirt circle
        div {
            style = "position: absolute; bottom: 50px; left: calc(50% - 50px); width: 100px; height: 100px; background-color: #cbe1c7; border: 2px solid white; transform: rotate(45deg); z-index: 2;"
        }
    }

    val defPlayers = if (isHomeBatting) localAwayRoster else localHomeRoster
    val activePitcherId = if (isHomeBatting) localAwayActivePitcherId else localHomeActivePitcherId

    val positionsMap = mapOf(
        BaseballConstants.Positions.P to (defPlayers.find { it.id == activePitcherId }?.name ?: "Pitcher"),
        BaseballConstants.Positions.C to (defPlayers.find { it.position == BaseballConstants.Positions.C }?.name ?: "Catcher"),
        BaseballConstants.Positions.FIRST_BASE to (defPlayers.find { it.position == BaseballConstants.Positions.FIRST_BASE }?.name ?: "First Base"),
        BaseballConstants.Positions.SECOND_BASE to (defPlayers.find { it.position == BaseballConstants.Positions.SECOND_BASE }?.name ?: "Second Base"),
        BaseballConstants.Positions.THIRD_BASE to (defPlayers.find { it.position == BaseballConstants.Positions.THIRD_BASE }?.name ?: "Third Base"),
        BaseballConstants.Positions.SS to (defPlayers.find { it.position == BaseballConstants.Positions.SS }?.name ?: "Shortstop"),
        BaseballConstants.Positions.LF to (defPlayers.find { it.position == BaseballConstants.Positions.LF }?.name ?: "Left Field"),
        BaseballConstants.Positions.CF to (defPlayers.find { it.position == BaseballConstants.Positions.CF }?.name ?: "Center Field"),
        BaseballConstants.Positions.RF to (defPlayers.find { it.position == BaseballConstants.Positions.RF }?.name ?: "Right Field")
    )

    val coords = mapOf(
        BaseballConstants.Positions.CF to Pair("10px", "calc(50% - 40px)"),
        BaseballConstants.Positions.LF to Pair("40px", "15px"),
        BaseballConstants.Positions.RF to Pair("40px", "calc(100% - 95px)"),
        BaseballConstants.Positions.SS to Pair("55px", "calc(50% - 75px)"),
        BaseballConstants.Positions.SECOND_BASE to Pair("65px", "calc(50% - 5px)"),
        BaseballConstants.Positions.THIRD_BASE to Pair("130px", "calc(50% - 115px)"),
        BaseballConstants.Positions.FIRST_BASE to Pair("130px", "calc(50% + 35px)"),
        BaseballConstants.Positions.P to Pair("135px", "calc(50% - 40px)"),
        BaseballConstants.Positions.C to Pair("210px", "calc(50% - 40px)")
    )

    coords.forEach { (pos, coord) ->
        val name = positionsMap[pos] ?: "Def"
        fieldWrapper.div {
            style = "position: absolute; top: ${coord.first}; left: ${coord.second}; width: 80px; display: flex; flex-direction: column; align-items: center; z-index: 10;"

            span {
                +pos
                style = "font-size: 0.75rem; font-weight: bold; background-color: #ff2a3b; color: white; border-radius: 50%; width: 18px; height: 18px; display: flex; justify-content: center; align-items: center; border: 1px solid white;"
            }

            span {
                +name.substringBefore(" ").take(8)
                style = "font-size: 0.65rem; font-weight: bold; color: #111; background-color: rgba(255, 255, 255, 0.8); padding: 1px 4px; border-radius: 3px; margin-top: 2px; text-align: center;"
            }
        }
    }

    // B. PITCHERS BOX SCORE TABLE (Bottom Middle)
    bottomGrid.div(classes = "card") {
        style = "background-color: #f9f7f2; border: 2px solid #5a544a; padding: 1rem; color: #2b2a28; flex: 1 1 320px;"

        h3 {
            +"OPPOSING PITCHING STATS"
            style = "text-align: center; margin: 0 0 1rem 0; font-size: 1rem; font-weight: bold; border-bottom: 1px solid #c2bcae; padding-bottom: 0.25rem;"
        }

        val pStatsList = if (isHomeBatting) boxScore.awayPitching else boxScore.homePitching

        div {
            style = "overflow-y: auto; height: 260px;"

            table {
                style = "width: 100%; border-collapse: collapse; font-size: 0.8rem;"

                thead {
                    style = "background-color: #eae5dc;"
                    tr {
                        style = "border-bottom: 1px solid #5a544a;"
                        listOf("PITCHER", "R/L", "IP", "BF", "H", "R", "ER", "BB", "K").forEach { h ->
                            th {
                                +h
                                style = "padding: 4px; text-align: ${if (h == "PITCHER") "left" else "center"};"
                            }
                        }
                    }
                }

                tbody {
                    pStatsList.forEach { p ->
                        tr {
                            style = "border-bottom: 1px solid #c2bcae;"
                            td {
                                +p.playerName
                                style = "font-weight: bold; padding: 6px 4px;"
                            }
                            td {
                                +"R"
                                style = "text-align: center;"
                            }

                            val whole = p.inningsPitchedThirds / 3
                            val rem = p.inningsPitchedThirds % 3
                            td {
                                +"$whole.$rem"
                                style = "text-align: center;"
                            }

                            val bf = p.inningsPitchedThirds + p.runsAllowed + p.hitsAllowed + p.walksAllowed
                            td {
                                +bf.toString()
                                style = "text-align: center;"
                            }

                            td {
                                +p.hitsAllowed.toString()
                                style = "text-align: center;"
                            }
                            td {
                                +p.runsAllowed.toString()
                                style = "text-align: center;"
                            }
                            td {
                                +p.earnedRuns.toString()
                                style = "text-align: center;"
                            }
                            td {
                                +p.walksAllowed.toString()
                                style = "text-align: center;"
                            }
                            td {
                                +p.strikeoutsRecorded.toString()
                                style = "text-align: center;"
                            }
                        }
                    }
                }
            }
        }
    }

    // C. SCOREBOARD & GAME TOTALS (Bottom Right)
    bottomGrid.div(classes = "card") {
        style = "background-color: #eae5dc; border: 2px solid #5a544a; padding: 1rem; color: #2b2a28; flex: 1 1 280px;"

        h3 {
            +"SCOREBOARD SUMMARY"
            style = "text-align: center; margin: 0 0 1rem 0; font-size: 1rem; font-weight: bold; border-bottom: 1px solid #5a544a; padding-bottom: 0.25rem;"
        }

        table {
            style = "width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.85rem;"

            thead {
                tr {
                    style = "border-bottom: 1px solid #5a544a;"
                    th {
                        +"TEAM"
                        style = "text-align: left;"
                    }
                    for (i in 1..maxInning) {
                        th {
                            +i.toString()
                            style = "text-align: center;"
                        }
                    }
                    th {
                        +"R"
                        style = "text-align: center; font-weight: bold;"
                    }
                    th {
                        +"H"
                        style = "text-align: center;"
                    }
                    th {
                        +"E"
                        style = "text-align: center;"
                    }
                }
            }

            tbody {
                tr {
                    style = "border-bottom: 1px solid #c2bcae;"
                    td {
                        +game.awayTeam.abbreviation
                        style = "font-weight: bold;"
                    }
                    for (i in 1..maxInning) {
                        val r = boxScore.lineScore.awayInningRuns.getOrNull(i - 1)
                        val text = when {
                            r != null -> r.toString()
                            i <= game.gameState.inning -> "0"
                            else -> "-"
                        }
                        td {
                            +text
                            style = "text-align: center;"
                        }
                    }
                    td {
                        +boxScore.lineScore.awayRuns.toString()
                        style = "text-align: center; font-weight: bold;"
                    }
                    td {
                        +boxScore.lineScore.awayHits.toString()
                        style = "text-align: center;"
                    }
                    td {
                        +boxScore.lineScore.awayErrors.toString()
                        style = "text-align: center;"
                    }
                }

                tr {
                    style = "border-bottom: 1px solid #c2bcae;"
                    td {
                        +game.homeTeam.abbreviation
                        style = "font-weight: bold;"
                    }
                    for (i in 1..maxInning) {
                        val r = boxScore.lineScore.homeInningRuns.getOrNull(i - 1)
                        val text = when {
                            r != null -> r.toString()
                            i <= game.gameState.inning -> "0"
                            else -> "-"
                        }
                        td {
                            +text
                            style = "text-align: center;"
                        }
                    }
                    td {
                        +boxScore.lineScore.homeRuns.toString()
                        style = "text-align: center; font-weight: bold;"
                    }
                    td {
                        +boxScore.lineScore.homeHits.toString()
                        style = "text-align: center;"
                    }
                    td {
                        +boxScore.lineScore.homeErrors.toString()
                        style = "text-align: center;"
                    }
                }
            }
        }

        val isCompleted = game.status == GameStatus.COMPLETED

        val wpLabel: String
        val lpLabel: String
        val svLabel: String

        val wpName: String
        val lpName: String
        val svName: String

        if (isCompleted) {
            wpLabel = "WP"
            lpLabel = "LP"
            svLabel = "SV"
            wpName = if (game.homeScore > game.awayScore)
                (localHomeRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Justin Steele")
            else
                (localAwayRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Sonny Gray")
            lpName = if (game.homeScore < game.awayScore)
                (localHomeRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Justin Steele")
            else
                (localAwayRoster.find { it.position == BaseballConstants.Positions.P }?.name ?: "Sonny Gray")
            svName = if (game.homeScore > game.awayScore) "HADER (12)" else "NONE"
        } else {
            wpLabel = "Potential WP (Hook)"
            lpLabel = "Potential LP (Hook)"
            svLabel = "SV"
            when {
                game.homeScore > game.awayScore -> {
                    wpName = localHomeActivePitcherName
                    lpName = localAwayActivePitcherName
                    svName = "-"
                }
                game.awayScore > game.homeScore -> {
                    wpName = localAwayActivePitcherName
                    lpName = localHomeActivePitcherName
                    svName = "-"
                }
                else -> {
                    wpName = "-"
                    lpName = "-"
                    svName = "-"
                }
            }
        }

        div {
            style = "display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid #5a544a; padding-top: 0.75rem; font-size: 0.8rem;"

            div {
                +"$wpLabel: "
                span {
                    style = "font-weight: bold;"
                    +wpName
                }
            }
            div {
                +"$lpLabel: "
                span {
                    style = "font-weight: bold;"
                    +lpName
                }
            }
            div {
                +"$svLabel: "
                span {
                    style = "font-weight: bold;"
                    +svName
                }
            }
        }
    }
}

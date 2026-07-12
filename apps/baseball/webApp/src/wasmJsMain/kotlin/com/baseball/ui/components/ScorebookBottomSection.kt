package com.baseball.ui.components

import com.baseball.UiConstants
import com.baseball.BaseballConstants

import com.baseball.models.*
import com.baseball.game.*
import com.baseball.ui.appendElement
import com.baseball.ui.onClick
import org.w3c.dom.*

// Renders the bottom area of the scorecard (Defense field, Pitcher tables, Line score scoreboard)
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
    val bottomGrid = container.appendElement(UiConstants.Html.DIV) {
        style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
        style.setProperty("flex-wrap", "wrap")
        style.setProperty(UiConstants.Css.GAP, "1.5rem")
        style.setProperty(UiConstants.Css.MARGIN_TOP, "1.5rem")
    }

    // A. HOME DEFENSE FIELD DIAGRAM (Bottom Left)
    val defenseCard = bottomGrid.appendElement(UiConstants.Html.DIV, "card") {
        style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "#f9f7f2")
        style.setProperty(UiConstants.Css.BORDER, "2px solid #5a544a")
        style.setProperty(UiConstants.Css.PADDING, "1rem")
        style.setProperty(UiConstants.Css.COLOR, "#2b2a28")
        style.setProperty(UiConstants.Css.FLEX, "1 1 300px")
    }

    defenseCard.appendElement(UiConstants.Html.H3) {
        textContent = "HOME DEFENSE FIELD"
        style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER)
        style.setProperty(UiConstants.Css.MARGIN, "0 0 1rem 0")
        style.setProperty(UiConstants.Css.FONT_SIZE, "1rem")
        style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
        style.setProperty(UiConstants.Css.BORDER_BOTTOM, "1px solid #c2bcae")
        style.setProperty(UiConstants.Css.PADDING_BOTTOM, "0.25rem")
    }

    val fieldWrapper = defenseCard.appendElement(UiConstants.Html.DIV) {
        style.setProperty(UiConstants.Css.POSITION, UiConstants.CssValues.RELATIVE)
        style.setProperty(UiConstants.Css.WIDTH, "100%")
        style.setProperty(UiConstants.Css.HEIGHT, "260px")
        style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "#edf2eb")
        style.setProperty(UiConstants.Css.BORDER, "1px solid #c2bcae")
        style.setProperty(UiConstants.Css.BORDER_RADIUS, "8px")
        style.setProperty(UiConstants.Css.OVERFLOW, UiConstants.CssValues.HIDDEN)
    }

    // Infield dirt circle centered around the pitcher's mound
    fieldWrapper.appendElement(UiConstants.Html.DIV) {
        style.setProperty(UiConstants.Css.POSITION, UiConstants.CssValues.ABSOLUTE)
        style.setProperty(UiConstants.Css.BOTTOM, "10px")
        style.setProperty(UiConstants.Css.LEFT, "calc(50% - 90px)")
        style.setProperty(UiConstants.Css.WIDTH, "180px")
        style.setProperty(UiConstants.Css.HEIGHT, "180px")
        style.setProperty(UiConstants.Css.BORDER_RADIUS, "50%")
        style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "#e5ccb3")
        style.setProperty(UiConstants.Css.Z_INDEX, "1")
    }

    // Basepaths diamond (rotated square) centered on dirt circle
    fieldWrapper.appendElement(UiConstants.Html.DIV) {
        style.setProperty(UiConstants.Css.POSITION, UiConstants.CssValues.ABSOLUTE)
        style.setProperty(UiConstants.Css.BOTTOM, "50px")
        style.setProperty(UiConstants.Css.LEFT, "calc(50% - 50px)")
        style.setProperty(UiConstants.Css.WIDTH, "100px")
        style.setProperty(UiConstants.Css.HEIGHT, "100px")
        style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "#cbe1c7")
        style.setProperty(UiConstants.Css.BORDER, "2px solid white")
        style.setProperty(UiConstants.Css.TRANSFORM, "rotate(45deg)")
        style.setProperty(UiConstants.Css.Z_INDEX, "2")
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

    // Mathematically aligned coordinates to lay out players correctly relative to the diamond
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
        fieldWrapper.appendElement(UiConstants.Html.DIV) {
            style.setProperty(UiConstants.Css.POSITION, UiConstants.CssValues.ABSOLUTE)
            style.setProperty(UiConstants.Css.TOP, coord.first)
            style.setProperty(UiConstants.Css.LEFT, coord.second)
            style.setProperty(UiConstants.Css.WIDTH, "80px")
            style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
            style.setProperty(UiConstants.Css.FLEX_DIRECTION, UiConstants.CssValues.COLUMN)
            style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
            style.setProperty(UiConstants.Css.Z_INDEX, "10")

            appendElement(UiConstants.Html.SPAN) {
                textContent = pos
                style.setProperty(UiConstants.Css.FONT_SIZE, "0.75rem")
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "#ff2a3b")
                style.setProperty(UiConstants.Css.COLOR, "white")
                style.setProperty(UiConstants.Css.BORDER_RADIUS, "50%")
                style.setProperty(UiConstants.Css.WIDTH, "18px")
                style.setProperty(UiConstants.Css.HEIGHT, "18px")
                style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
                style.setProperty(UiConstants.Css.JUSTIFY_CONTENT, UiConstants.CssValues.CENTER)
                style.setProperty(UiConstants.Css.ALIGN_ITEMS, UiConstants.CssValues.CENTER)
                style.setProperty(UiConstants.Css.BORDER, "1px solid white")
            }

            appendElement(UiConstants.Html.SPAN) {
                textContent = name.substringBefore(" ").take(8)
                style.setProperty(UiConstants.Css.FONT_SIZE, "0.65rem")
                style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
                style.setProperty(UiConstants.Css.COLOR, "#111")
                style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "rgba(255, 255, 255, 0.8)")
                style.setProperty(UiConstants.Css.PADDING, "1px 4px")
                style.setProperty(UiConstants.Css.BORDER_RADIUS, "3px")
                style.setProperty(UiConstants.Css.MARGIN_TOP, "2px")
                style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER)
            }
        }
    }

    // B. PITCHERS BOX SCORE TABLE (Bottom Middle)
    val pitcherCard = bottomGrid.appendElement(UiConstants.Html.DIV, "card") {
        style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "#f9f7f2")
        style.setProperty(UiConstants.Css.BORDER, "2px solid #5a544a")
        style.setProperty(UiConstants.Css.PADDING, "1rem")
        style.setProperty(UiConstants.Css.COLOR, "#2b2a28")
        style.setProperty(UiConstants.Css.FLEX, "1 1 320px")
    }

    pitcherCard.appendElement(UiConstants.Html.H3) {
        textContent = "OPPOSING PITCHING STATS"
        style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER)
        style.setProperty(UiConstants.Css.MARGIN, "0 0 1rem 0")
        style.setProperty(UiConstants.Css.FONT_SIZE, "1rem")
        style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
        style.setProperty(UiConstants.Css.BORDER_BOTTOM, "1px solid #c2bcae")
        style.setProperty(UiConstants.Css.PADDING_BOTTOM, "0.25rem")
    }

    val pStatsList = if (isHomeBatting) boxScore.awayPitching else boxScore.homePitching

    val pitcherTableContainer = pitcherCard.appendElement(UiConstants.Html.DIV) {
        style.setProperty(UiConstants.Css.OVERFLOW_Y, UiConstants.CssValues.AUTO)
        style.setProperty(UiConstants.Css.HEIGHT, "260px")
    }
    
    val pTable = pitcherTableContainer.appendElement(UiConstants.Html.TABLE) {
        style.setProperty(UiConstants.Css.WIDTH, "100%")
        style.setProperty(UiConstants.Css.BORDER_COLLAPSE, UiConstants.CssValues.COLLAPSE)
        style.setProperty(UiConstants.Css.FONT_SIZE, "0.8rem")
    }

    val pThead = pTable.appendElement(UiConstants.Html.THEAD) {
        style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "#eae5dc")
    }
    val ptrh = pThead.appendElement(UiConstants.Html.TR) {
        style.setProperty(UiConstants.Css.BORDER_BOTTOM, "1px solid #5a544a")
    }
    listOf("PITCHER", "R/L", "IP", "BF", "H", "R", "ER", "BB", "K").forEach { h ->
        ptrh.appendElement(UiConstants.Html.TH) {
            textContent = h
            style.setProperty(UiConstants.Css.PADDING, "4px")
            style.setProperty(UiConstants.Css.TEXT_ALIGN, if (h == BaseballConstants.METRIC_PITCHER) "left" else "center")
        }
    }

    val pTbody = pTable.appendElement(UiConstants.Html.TBODY)
    pStatsList.forEach { p ->
        val ptrd = pTbody.appendElement(UiConstants.Html.TR) {
            style.setProperty(UiConstants.Css.BORDER_BOTTOM, "1px solid #c2bcae")
        }
        ptrd.appendElement(UiConstants.Html.TD) { textContent = p.playerName; style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD); style.setProperty(UiConstants.Css.PADDING, "6px 4px") }
        ptrd.appendElement(UiConstants.Html.TD) { textContent = "R"; style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER) }
        
        val whole = p.inningsPitchedThirds / 3
        val rem = p.inningsPitchedThirds % 3
        ptrd.appendElement(UiConstants.Html.TD) { textContent = "$whole.$rem"; style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER) }
        
        val bf = p.inningsPitchedThirds + p.runsAllowed + p.hitsAllowed + p.walksAllowed
        ptrd.appendElement(UiConstants.Html.TD) { textContent = bf.toString(); style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER) }
        
        ptrd.appendElement(UiConstants.Html.TD) { textContent = p.hitsAllowed.toString(); style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER) }
        ptrd.appendElement(UiConstants.Html.TD) { textContent = p.runsAllowed.toString(); style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER) }
        ptrd.appendElement(UiConstants.Html.TD) { textContent = p.earnedRuns.toString(); style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER) }
        ptrd.appendElement(UiConstants.Html.TD) { textContent = p.walksAllowed.toString(); style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER) }
        ptrd.appendElement(UiConstants.Html.TD) { textContent = p.strikeoutsRecorded.toString(); style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER) }
    }

    // C. SCOREBOARD & GAME TOTALS (Bottom Right)
    val scoreboardCard = bottomGrid.appendElement(UiConstants.Html.DIV, "card") {
        style.setProperty(UiConstants.Css.BACKGROUND_COLOR, "#eae5dc")
        style.setProperty(UiConstants.Css.BORDER, "2px solid #5a544a")
        style.setProperty(UiConstants.Css.PADDING, "1rem")
        style.setProperty(UiConstants.Css.COLOR, "#2b2a28")
        style.setProperty(UiConstants.Css.FLEX, "1 1 280px")
    }

    scoreboardCard.appendElement(UiConstants.Html.H3) {
        textContent = "SCOREBOARD SUMMARY"
        style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER)
        style.setProperty(UiConstants.Css.MARGIN, "0 0 1rem 0")
        style.setProperty(UiConstants.Css.FONT_SIZE, "1rem")
        style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD)
        style.setProperty(UiConstants.Css.BORDER_BOTTOM, "1px solid #5a544a")
        style.setProperty(UiConstants.Css.PADDING_BOTTOM, "0.25rem")
    }

    val sTable = scoreboardCard.appendElement(UiConstants.Html.TABLE) {
        style.setProperty(UiConstants.Css.WIDTH, "100%")
        style.setProperty(UiConstants.Css.BORDER_COLLAPSE, UiConstants.CssValues.COLLAPSE)
        style.setProperty(UiConstants.Css.MARGIN_BOTTOM, "1.5rem")
        style.setProperty(UiConstants.Css.FONT_SIZE, "0.85rem")
    }

    val sThead = sTable.appendElement(UiConstants.Html.THEAD)
    val strh = sThead.appendElement(UiConstants.Html.TR) {
        style.setProperty(UiConstants.Css.BORDER_BOTTOM, "1px solid #5a544a")
    }
    strh.appendElement(UiConstants.Html.TH) { textContent = "TEAM"; style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.LEFT) }
    for (i in 1..maxInning) {
        strh.appendElement(UiConstants.Html.TH) { textContent = i.toString(); style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER) }
    }
    strh.appendElement(UiConstants.Html.TH) { textContent = "R"; style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER); style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD) }
    strh.appendElement(UiConstants.Html.TH) { textContent = "H"; style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER) }
    strh.appendElement(UiConstants.Html.TH) { textContent = "E"; style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER) }

    val sTbody = sTable.appendElement(UiConstants.Html.TBODY)
    
    val stra = sTbody.appendElement(UiConstants.Html.TR) { style.setProperty(UiConstants.Css.BORDER_BOTTOM, "1px solid #c2bcae") }
    stra.appendElement(UiConstants.Html.TD) { textContent = game.awayTeam.abbreviation; style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD) }
    for (i in 1..maxInning) {
        val r = boxScore.lineScore.awayInningRuns.getOrNull(i - 1)
        val text = when {
            r != null -> r.toString()
            i <= game.gameState.inning -> "0"
            else -> "-"
        }
        stra.appendElement(UiConstants.Html.TD) { textContent = text; style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER) }
    }
    stra.appendElement(UiConstants.Html.TD) { textContent = boxScore.lineScore.awayRuns.toString(); style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER); style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD) }
    stra.appendElement(UiConstants.Html.TD) { textContent = boxScore.lineScore.awayHits.toString(); style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER) }
    stra.appendElement(UiConstants.Html.TD) { textContent = boxScore.lineScore.awayErrors.toString(); style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER) }

    val strhRow = sTbody.appendElement(UiConstants.Html.TR) { style.setProperty(UiConstants.Css.BORDER_BOTTOM, "1px solid #c2bcae") }
    strhRow.appendElement(UiConstants.Html.TD) { textContent = game.homeTeam.abbreviation; style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD) }
    for (i in 1..maxInning) {
        val r = boxScore.lineScore.homeInningRuns.getOrNull(i - 1)
        val text = when {
            r != null -> r.toString()
            i <= game.gameState.inning -> "0"
            else -> "-"
        }
        strhRow.appendElement(UiConstants.Html.TD) { textContent = text; style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER) }
    }
    strhRow.appendElement(UiConstants.Html.TD) { textContent = boxScore.lineScore.homeRuns.toString(); style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER); style.setProperty(UiConstants.Css.FONT_WEIGHT, UiConstants.CssValues.BOLD) }
    strhRow.appendElement(UiConstants.Html.TD) { textContent = boxScore.lineScore.homeHits.toString(); style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER) }
    strhRow.appendElement(UiConstants.Html.TD) { textContent = boxScore.lineScore.homeErrors.toString(); style.setProperty(UiConstants.Css.TEXT_ALIGN, UiConstants.CssValues.CENTER) }

    val decisionBlock = scoreboardCard.appendElement(UiConstants.Html.DIV) {
        style.setProperty(UiConstants.Css.DISPLAY, UiConstants.CssValues.FLEX)
        style.setProperty(UiConstants.Css.FLEX_DIRECTION, UiConstants.CssValues.COLUMN)
        style.setProperty(UiConstants.Css.GAP, "0.5rem")
        style.setProperty("border-top", "1px solid #5a544a")
        style.setProperty("padding-top", "0.75rem")
        style.setProperty(UiConstants.Css.FONT_SIZE, "0.8rem")
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

    decisionBlock.appendElement(UiConstants.Html.DIV) { 
        innerHTML = "$wpLabel: <span style='font-weight: bold;'>$wpName</span>" 
    }
    decisionBlock.appendElement(UiConstants.Html.DIV) { 
        innerHTML = "$lpLabel: <span style='font-weight: bold;'>$lpName</span>" 
    }
    decisionBlock.appendElement(UiConstants.Html.DIV) { 
        innerHTML = "$svLabel: <span style='font-weight: bold;'>$svName</span>" 
    }
}

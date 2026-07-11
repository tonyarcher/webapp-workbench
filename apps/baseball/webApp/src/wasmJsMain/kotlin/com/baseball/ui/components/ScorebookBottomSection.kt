package com.baseball.ui.components

import com.baseball.models.*
import com.baseball.game.*
import com.baseball.Constants
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
    val bottomGrid = container.appendElement(Constants.Html.DIV) {
        style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.FLEX)
        style.setProperty("flex-wrap", "wrap")
        style.setProperty(Constants.Css.GAP, "1.5rem")
        style.setProperty(Constants.Css.MARGIN_TOP, "1.5rem")
    }

    // A. HOME DEFENSE FIELD DIAGRAM (Bottom Left)
    val defenseCard = bottomGrid.appendElement(Constants.Html.DIV, "card") {
        style.setProperty(Constants.Css.BACKGROUND_COLOR, "#f9f7f2")
        style.setProperty(Constants.Css.BORDER, "2px solid #5a544a")
        style.setProperty(Constants.Css.PADDING, "1rem")
        style.setProperty(Constants.Css.COLOR, "#2b2a28")
        style.setProperty(Constants.Css.FLEX, "1 1 300px")
    }

    defenseCard.appendElement(Constants.Html.H3) {
        textContent = "HOME DEFENSE FIELD"
        style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER)
        style.setProperty(Constants.Css.MARGIN, "0 0 1rem 0")
        style.setProperty(Constants.Css.FONT_SIZE, "1rem")
        style.setProperty(Constants.Css.FONT_WEIGHT, Constants.CssValues.BOLD)
        style.setProperty(Constants.Css.BORDER_BOTTOM, "1px solid #c2bcae")
        style.setProperty(Constants.Css.PADDING_BOTTOM, "0.25rem")
    }

    val fieldWrapper = defenseCard.appendElement(Constants.Html.DIV) {
        style.setProperty(Constants.Css.POSITION, Constants.CssValues.RELATIVE)
        style.setProperty(Constants.Css.WIDTH, "100%")
        style.setProperty(Constants.Css.HEIGHT, "260px")
        style.setProperty(Constants.Css.BACKGROUND_COLOR, "#edf2eb")
        style.setProperty(Constants.Css.BORDER, "1px solid #c2bcae")
        style.setProperty(Constants.Css.BORDER_RADIUS, "8px")
        style.setProperty(Constants.Css.OVERFLOW, Constants.CssValues.HIDDEN)
    }

    fieldWrapper.appendElement(Constants.Html.DIV) {
        style.setProperty(Constants.Css.POSITION, Constants.CssValues.RELATIVE)
        style.setProperty(Constants.Css.BOTTOM, "-30px")
        style.setProperty(Constants.Css.LEFT, "50%")
        style.setProperty(Constants.Css.TRANSFORM, "translateX(-50%)")
        style.setProperty(Constants.Css.WIDTH, "200px")
        style.setProperty(Constants.Css.HEIGHT, "200px")
        style.setProperty(Constants.Css.BORDER_RADIUS, "50%")
        style.setProperty(Constants.Css.BACKGROUND_COLOR, "#e5ccb3")
        style.setProperty(Constants.Css.Z_INDEX, "1")
    }

    fieldWrapper.appendElement(Constants.Html.DIV) {
        style.setProperty(Constants.Css.POSITION, Constants.CssValues.RELATIVE)
        style.setProperty(Constants.Css.BOTTOM, "20px")
        style.setProperty(Constants.Css.LEFT, "50%")
        style.setProperty(Constants.Css.TRANSFORM, "translateX(-50%) rotate(45deg)")
        style.setProperty(Constants.Css.WIDTH, "100px")
        style.setProperty(Constants.Css.HEIGHT, "100px")
        style.setProperty(Constants.Css.BACKGROUND_COLOR, "#cbe1c7")
        style.setProperty(Constants.Css.BORDER, "2px solid white")
        style.setProperty(Constants.Css.Z_INDEX, "2")
    }

    val defPlayers = if (isHomeBatting) localAwayRoster else localHomeRoster
    val activePitcherId = if (isHomeBatting) localAwayActivePitcherId else localHomeActivePitcherId
    
    val positionsMap = mapOf(
        Constants.Positions.P to (defPlayers.find { it.id == activePitcherId }?.name ?: "Pitcher"),
        Constants.Positions.C to (defPlayers.find { it.position == Constants.Positions.C }?.name ?: "Catcher"),
        Constants.Positions.FIRST_BASE to (defPlayers.find { it.position == Constants.Positions.FIRST_BASE }?.name ?: "First Base"),
        Constants.Positions.SECOND_BASE to (defPlayers.find { it.position == Constants.Positions.SECOND_BASE }?.name ?: "Second Base"),
        Constants.Positions.THIRD_BASE to (defPlayers.find { it.position == Constants.Positions.THIRD_BASE }?.name ?: "Third Base"),
        Constants.Positions.SS to (defPlayers.find { it.position == Constants.Positions.SS }?.name ?: "Shortstop"),
        Constants.Positions.LF to (defPlayers.find { it.position == Constants.Positions.LF }?.name ?: "Left Field"),
        Constants.Positions.CF to (defPlayers.find { it.position == Constants.Positions.CF }?.name ?: "Center Field"),
        Constants.Positions.RF to (defPlayers.find { it.position == Constants.Positions.RF }?.name ?: "Right Field")
    )

    val coords = mapOf(
        Constants.Positions.CF to Pair("15px", "calc(50% - 40px)"),
        Constants.Positions.LF to Pair("60px", "20px"),
        Constants.Positions.RF to Pair("60px", "calc(100% - 100px)"),
        Constants.Positions.SS to Pair("105px", "30%"),
        Constants.Positions.SECOND_BASE to Pair("105px", "60%"),
        Constants.Positions.THIRD_BASE to Pair("165px", "15%"),
        Constants.Positions.FIRST_BASE to Pair("165px", "calc(85% - 80px)"),
        Constants.Positions.P to Pair("175px", "calc(50% - 40px)"),
        Constants.Positions.C to Pair("225px", "calc(50% - 40px)")
    )

    coords.forEach { (pos, coord) ->
        val name = positionsMap[pos] ?: "Def"
        fieldWrapper.appendElement(Constants.Html.DIV) {
            style.setProperty(Constants.Css.POSITION, Constants.CssValues.RELATIVE)
            style.setProperty(Constants.Css.TOP, coord.first)
            style.setProperty(Constants.Css.LEFT, coord.second)
            style.setProperty(Constants.Css.WIDTH, "80px")
            style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.FLEX)
            style.setProperty(Constants.Css.FLEX_DIRECTION, Constants.CssValues.COLUMN)
            style.setProperty(Constants.Css.ALIGN_ITEMS, Constants.CssValues.CENTER)
            style.setProperty(Constants.Css.Z_INDEX, "10")

            appendElement(Constants.Html.SPAN) {
                textContent = pos
                style.setProperty(Constants.Css.FONT_SIZE, "0.75rem")
                style.setProperty(Constants.Css.FONT_WEIGHT, Constants.CssValues.BOLD)
                style.setProperty(Constants.Css.BACKGROUND_COLOR, "#ff2a3b")
                style.setProperty(Constants.Css.COLOR, "white")
                style.setProperty(Constants.Css.BORDER_RADIUS, "50%")
                style.setProperty(Constants.Css.WIDTH, "18px")
                style.setProperty(Constants.Css.HEIGHT, "18px")
                style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.FLEX)
                style.setProperty(Constants.Css.JUSTIFY_CONTENT, Constants.CssValues.CENTER)
                style.setProperty(Constants.Css.ALIGN_ITEMS, Constants.CssValues.CENTER)
                style.setProperty(Constants.Css.BORDER, "1px solid white")
            }

            appendElement(Constants.Html.SPAN) {
                textContent = name.substringBefore(" ").take(8)
                style.setProperty(Constants.Css.FONT_SIZE, "0.65rem")
                style.setProperty(Constants.Css.FONT_WEIGHT, Constants.CssValues.BOLD)
                style.setProperty(Constants.Css.COLOR, "#111")
                style.setProperty(Constants.Css.BACKGROUND_COLOR, "rgba(255, 255, 255, 0.8)")
                style.setProperty(Constants.Css.PADDING, "1px 4px")
                style.setProperty(Constants.Css.BORDER_RADIUS, "3px")
                style.setProperty(Constants.Css.MARGIN_TOP, "2px")
                style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER)
            }
        }
    }

    // B. PITCHERS BOX SCORE TABLE (Bottom Middle)
    val pitcherCard = bottomGrid.appendElement(Constants.Html.DIV, "card") {
        style.setProperty(Constants.Css.BACKGROUND_COLOR, "#f9f7f2")
        style.setProperty(Constants.Css.BORDER, "2px solid #5a544a")
        style.setProperty(Constants.Css.PADDING, "1rem")
        style.setProperty(Constants.Css.COLOR, "#2b2a28")
        style.setProperty(Constants.Css.FLEX, "1 1 320px")
    }

    pitcherCard.appendElement(Constants.Html.H3) {
        textContent = "OPPOSING PITCHING STATS"
        style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER)
        style.setProperty(Constants.Css.MARGIN, "0 0 1rem 0")
        style.setProperty(Constants.Css.FONT_SIZE, "1rem")
        style.setProperty(Constants.Css.FONT_WEIGHT, Constants.CssValues.BOLD)
        style.setProperty(Constants.Css.BORDER_BOTTOM, "1px solid #c2bcae")
        style.setProperty(Constants.Css.PADDING_BOTTOM, "0.25rem")
    }

    val pStatsList = if (isHomeBatting) boxScore.awayPitching else boxScore.homePitching

    val pitcherTableContainer = pitcherCard.appendElement(Constants.Html.DIV) {
        style.setProperty(Constants.Css.OVERFLOW_Y, Constants.CssValues.AUTO)
        style.setProperty(Constants.Css.HEIGHT, "260px")
    }
    
    val pTable = pitcherTableContainer.appendElement(Constants.Html.TABLE) {
        style.setProperty(Constants.Css.WIDTH, "100%")
        style.setProperty(Constants.Css.BORDER_COLLAPSE, Constants.CssValues.COLLAPSE)
        style.setProperty(Constants.Css.FONT_SIZE, "0.8rem")
    }

    val pThead = pTable.appendElement(Constants.Html.THEAD) {
        style.setProperty(Constants.Css.BACKGROUND_COLOR, "#eae5dc")
    }
    val ptrh = pThead.appendElement(Constants.Html.TR) {
        style.setProperty(Constants.Css.BORDER_BOTTOM, "1px solid #5a544a")
    }
    listOf("PITCHER", "R/L", "IP", "BF", "H", "R", "ER", "BB", "K").forEach { h ->
        ptrh.appendElement(Constants.Html.TH) {
            textContent = h
            style.setProperty(Constants.Css.PADDING, "4px")
            style.setProperty(Constants.Css.TEXT_ALIGN, if (h == Constants.METRIC_PITCHER) "left" else "center")
        }
    }

    val pTbody = pTable.appendElement(Constants.Html.TBODY)
    pStatsList.forEach { p ->
        val ptrd = pTbody.appendElement(Constants.Html.TR) {
            style.setProperty(Constants.Css.BORDER_BOTTOM, "1px solid #c2bcae")
        }
        ptrd.appendElement(Constants.Html.TD) { textContent = p.playerName; style.setProperty(Constants.Css.FONT_WEIGHT, Constants.CssValues.BOLD); style.setProperty(Constants.Css.PADDING, "6px 4px") }
        ptrd.appendElement(Constants.Html.TD) { textContent = "R"; style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER) }
        
        val whole = p.inningsPitchedThirds / 3
        val rem = p.inningsPitchedThirds % 3
        ptrd.appendElement(Constants.Html.TD) { textContent = "$whole.$rem"; style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER) }
        
        val bf = p.inningsPitchedThirds + p.runsAllowed + p.hitsAllowed + p.walksAllowed
        ptrd.appendElement(Constants.Html.TD) { textContent = bf.toString(); style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER) }
        
        ptrd.appendElement(Constants.Html.TD) { textContent = p.hitsAllowed.toString(); style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER) }
        ptrd.appendElement(Constants.Html.TD) { textContent = p.runsAllowed.toString(); style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER) }
        ptrd.appendElement(Constants.Html.TD) { textContent = p.earnedRuns.toString(); style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER) }
        ptrd.appendElement(Constants.Html.TD) { textContent = p.walksAllowed.toString(); style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER) }
        ptrd.appendElement(Constants.Html.TD) { textContent = p.strikeoutsRecorded.toString(); style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER) }
    }

    // C. SCOREBOARD & GAME TOTALS (Bottom Right)
    val scoreboardCard = bottomGrid.appendElement(Constants.Html.DIV, "card") {
        style.setProperty(Constants.Css.BACKGROUND_COLOR, "#eae5dc")
        style.setProperty(Constants.Css.BORDER, "2px solid #5a544a")
        style.setProperty(Constants.Css.PADDING, "1rem")
        style.setProperty(Constants.Css.COLOR, "#2b2a28")
        style.setProperty(Constants.Css.FLEX, "1 1 280px")
    }

    scoreboardCard.appendElement(Constants.Html.H3) {
        textContent = "SCOREBOARD SUMMARY"
        style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER)
        style.setProperty(Constants.Css.MARGIN, "0 0 1rem 0")
        style.setProperty(Constants.Css.FONT_SIZE, "1rem")
        style.setProperty(Constants.Css.FONT_WEIGHT, Constants.CssValues.BOLD)
        style.setProperty(Constants.Css.BORDER_BOTTOM, "1px solid #5a544a")
        style.setProperty(Constants.Css.PADDING_BOTTOM, "0.25rem")
    }

    val sTable = scoreboardCard.appendElement(Constants.Html.TABLE) {
        style.setProperty(Constants.Css.WIDTH, "100%")
        style.setProperty(Constants.Css.BORDER_COLLAPSE, Constants.CssValues.COLLAPSE)
        style.setProperty(Constants.Css.MARGIN_BOTTOM, "1.5rem")
        style.setProperty(Constants.Css.FONT_SIZE, "0.85rem")
    }

    val sThead = sTable.appendElement(Constants.Html.THEAD)
    val strh = sThead.appendElement(Constants.Html.TR) {
        style.setProperty(Constants.Css.BORDER_BOTTOM, "1px solid #5a544a")
    }
    strh.appendElement(Constants.Html.TH) { textContent = "TEAM"; style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.LEFT) }
    for (i in 1..maxInning) {
        strh.appendElement(Constants.Html.TH) { textContent = i.toString(); style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER) }
    }
    strh.appendElement(Constants.Html.TH) { textContent = "R"; style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER); style.setProperty(Constants.Css.FONT_WEIGHT, Constants.CssValues.BOLD) }
    strh.appendElement(Constants.Html.TH) { textContent = "H"; style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER) }
    strh.appendElement(Constants.Html.TH) { textContent = "E"; style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER) }

    val sTbody = sTable.appendElement(Constants.Html.TBODY)
    
    val stra = sTbody.appendElement(Constants.Html.TR) { style.setProperty(Constants.Css.BORDER_BOTTOM, "1px solid #c2bcae") }
    stra.appendElement(Constants.Html.TD) { textContent = game.awayTeam.abbreviation; style.setProperty(Constants.Css.FONT_WEIGHT, Constants.CssValues.BOLD) }
    boxScore.lineScore.awayInningRuns.forEach { r ->
        stra.appendElement(Constants.Html.TD) { textContent = r?.toString() ?: "0"; style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER) }
    }
    stra.appendElement(Constants.Html.TD) { textContent = boxScore.lineScore.awayRuns.toString(); style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER); style.setProperty(Constants.Css.FONT_WEIGHT, Constants.CssValues.BOLD) }
    stra.appendElement(Constants.Html.TD) { textContent = boxScore.lineScore.awayHits.toString(); style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER) }
    stra.appendElement(Constants.Html.TD) { textContent = boxScore.lineScore.awayErrors.toString(); style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER) }

    val strhRow = sTbody.appendElement(Constants.Html.TR) { style.setProperty(Constants.Css.BORDER_BOTTOM, "1px solid #c2bcae") }
    strhRow.appendElement(Constants.Html.TD) { textContent = game.homeTeam.abbreviation; style.setProperty(Constants.Css.FONT_WEIGHT, Constants.CssValues.BOLD) }
    boxScore.lineScore.homeInningRuns.forEach { r ->
        strhRow.appendElement(Constants.Html.TD) { textContent = r?.toString() ?: "0"; style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER) }
    }
    strhRow.appendElement(Constants.Html.TD) { textContent = boxScore.lineScore.homeRuns.toString(); style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER); style.setProperty(Constants.Css.FONT_WEIGHT, Constants.CssValues.BOLD) }
    strhRow.appendElement(Constants.Html.TD) { textContent = boxScore.lineScore.homeHits.toString(); style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER) }
    strhRow.appendElement(Constants.Html.TD) { textContent = boxScore.lineScore.homeErrors.toString(); style.setProperty(Constants.Css.TEXT_ALIGN, Constants.CssValues.CENTER) }

    val decisionBlock = scoreboardCard.appendElement(Constants.Html.DIV) {
        style.setProperty(Constants.Css.DISPLAY, Constants.CssValues.FLEX)
        style.setProperty(Constants.Css.FLEX_DIRECTION, Constants.CssValues.COLUMN)
        style.setProperty(Constants.Css.GAP, "0.5rem")
        style.setProperty("border-top", "1px solid #5a544a")
        style.setProperty("padding-top", "0.75rem")
        style.setProperty(Constants.Css.FONT_SIZE, "0.8rem")
    }

    val wp = if (game.homeScore > game.awayScore) 
                positionsMap["P"] ?: "Justin Steele" 
             else 
                (if (isHomeBatting) localHomeActivePitcherName else localAwayActivePitcherName)
    val lp = if (game.homeScore < game.awayScore) 
                positionsMap["P"] ?: "Justin Steele" 
             else 
                (if (isHomeBatting) localHomeActivePitcherName else localAwayActivePitcherName)

    decisionBlock.appendElement(Constants.Html.DIV) { 
        innerHTML = "WP: <span style='font-weight: bold;'>$wp</span>" 
    }
    decisionBlock.appendElement(Constants.Html.DIV) { 
        innerHTML = "LP: <span style='font-weight: bold;'>$lp</span>" 
    }
    decisionBlock.appendElement(Constants.Html.DIV) { 
        innerHTML = "SV: <span style='font-weight: bold;'>${if (game.homeScore > game.awayScore) "HADER (12)" else "NONE"}</span>" 
    }
}

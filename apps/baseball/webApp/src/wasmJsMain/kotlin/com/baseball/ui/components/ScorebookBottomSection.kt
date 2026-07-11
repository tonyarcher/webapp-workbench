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
    val bottomGrid = container.appendElement("div") {
        style.setProperty("display", "flex")
        style.setProperty("flex-wrap", "wrap")
        style.setProperty("gap", "1.5rem")
        style.setProperty("margin-top", "1.5rem")
    }

    // A. HOME DEFENSE FIELD DIAGRAM (Bottom Left)
    val defenseCard = bottomGrid.appendElement("div", "card") {
        style.setProperty("background-color", "#f9f7f2")
        style.setProperty("border", "2px solid #5a544a")
        style.setProperty("padding", "1rem")
        style.setProperty("color", "#2b2a28")
        style.setProperty("flex", "1 1 300px")
    }

    defenseCard.appendElement("h3") {
        textContent = "HOME DEFENSE FIELD"
        style.setProperty("text-align", "center")
        style.setProperty("margin", "0 0 1rem 0")
        style.setProperty("font-size", "1rem")
        style.setProperty("font-weight", "bold")
        style.setProperty("border-bottom", "1px solid #c2bcae")
        style.setProperty("padding-bottom", "0.25rem")
    }

    val fieldWrapper = defenseCard.appendElement("div") {
        style.setProperty("position", "relative")
        style.setProperty("width", "100%")
        style.setProperty("height", "260px")
        style.setProperty("background-color", "#edf2eb")
        style.setProperty("border", "1px solid #c2bcae")
        style.setProperty("border-radius", "8px")
        style.setProperty("overflow", "hidden")
    }

    fieldWrapper.appendElement("div") {
        style.setProperty("position", "absolute")
        style.setProperty("bottom", "-30px")
        style.setProperty("left", "50%")
        style.setProperty("transform", "translateX(-50%)")
        style.setProperty("width", "200px")
        style.setProperty("height", "200px")
        style.setProperty("border-radius", "50%")
        style.setProperty("background-color", "#e5ccb3")
        style.setProperty("z-index", "1")
    }

    fieldWrapper.appendElement("div") {
        style.setProperty("position", "absolute")
        style.setProperty("bottom", "20px")
        style.setProperty("left", "50%")
        style.setProperty("transform", "translateX(-50%) rotate(45deg)")
        style.setProperty("width", "100px")
        style.setProperty("height", "100px")
        style.setProperty("background-color", "#cbe1c7")
        style.setProperty("border", "2px solid white")
        style.setProperty("z-index", "2")
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
        fieldWrapper.appendElement("div") {
            style.setProperty("position", "absolute")
            style.setProperty("top", coord.first)
            style.setProperty("left", coord.second)
            style.setProperty("width", "80px")
            style.setProperty("display", "flex")
            style.setProperty("flex-direction", "column")
            style.setProperty("align-items", "center")
            style.setProperty("z-index", "10")

            appendElement("span") {
                textContent = pos
                style.setProperty("font-size", "0.75rem")
                style.setProperty("font-weight", "bold")
                style.setProperty("background-color", "#ff2a3b")
                style.setProperty("color", "white")
                style.setProperty("border-radius", "50%")
                style.setProperty("width", "18px")
                style.setProperty("height", "18px")
                style.setProperty("display", "flex")
                style.setProperty("justify-content", "center")
                style.setProperty("align-items", "center")
                style.setProperty("border", "1px solid white")
            }

            appendElement("span") {
                textContent = name.substringBefore(" ").take(8)
                style.setProperty("font-size", "0.65rem")
                style.setProperty("font-weight", "bold")
                style.setProperty("color", "#111")
                style.setProperty("background-color", "rgba(255, 255, 255, 0.8)")
                style.setProperty("padding", "1px 4px")
                style.setProperty("border-radius", "3px")
                style.setProperty("margin-top", "2px")
                style.setProperty("text-align", "center")
            }
        }
    }

    // B. PITCHERS BOX SCORE TABLE (Bottom Middle)
    val pitcherCard = bottomGrid.appendElement("div", "card") {
        style.setProperty("background-color", "#f9f7f2")
        style.setProperty("border", "2px solid #5a544a")
        style.setProperty("padding", "1rem")
        style.setProperty("color", "#2b2a28")
        style.setProperty("flex", "1 1 320px")
    }

    pitcherCard.appendElement("h3") {
        textContent = "OPPOSING PITCHING STATS"
        style.setProperty("text-align", "center")
        style.setProperty("margin", "0 0 1rem 0")
        style.setProperty("font-size", "1rem")
        style.setProperty("font-weight", "bold")
        style.setProperty("border-bottom", "1px solid #c2bcae")
        style.setProperty("padding-bottom", "0.25rem")
    }

    val pStatsList = if (isHomeBatting) boxScore.awayPitching else boxScore.homePitching

    val pitcherTableContainer = pitcherCard.appendElement("div") {
        style.setProperty("overflow-y", "auto")
        style.setProperty("height", "260px")
    }
    
    val pTable = pitcherTableContainer.appendElement("table") {
        style.setProperty("width", "100%")
        style.setProperty("border-collapse", "collapse")
        style.setProperty("font-size", "0.8rem")
    }

    val pThead = pTable.appendElement("thead") {
        style.setProperty("background-color", "#eae5dc")
    }
    val ptrh = pThead.appendElement("tr") {
        style.setProperty("border-bottom", "1px solid #5a544a")
    }
    listOf("PITCHER", "R/L", "IP", "BF", "H", "R", "ER", "BB", "K").forEach { h ->
        ptrh.appendElement("th") {
            textContent = h
            style.setProperty("padding", "4px")
            style.setProperty("text-align", if (h == "PITCHER") "left" else "center")
        }
    }

    val pTbody = pTable.appendElement("tbody")
    pStatsList.forEach { p ->
        val ptrd = pTbody.appendElement("tr") {
            style.setProperty("border-bottom", "1px solid #c2bcae")
        }
        ptrd.appendElement("td") { textContent = p.playerName; style.setProperty("font-weight", "bold"); style.setProperty("padding", "6px 4px") }
        ptrd.appendElement("td") { textContent = "R"; style.setProperty("text-align", "center") }
        
        val whole = p.inningsPitchedThirds / 3
        val rem = p.inningsPitchedThirds % 3
        ptrd.appendElement("td") { textContent = "$whole.$rem"; style.setProperty("text-align", "center") }
        
        val bf = p.inningsPitchedThirds + p.runsAllowed + p.hitsAllowed + p.walksAllowed
        ptrd.appendElement("td") { textContent = bf.toString(); style.setProperty("text-align", "center") }
        
        ptrd.appendElement("td") { textContent = p.hitsAllowed.toString(); style.setProperty("text-align", "center") }
        ptrd.appendElement("td") { textContent = p.runsAllowed.toString(); style.setProperty("text-align", "center") }
        ptrd.appendElement("td") { textContent = p.earnedRuns.toString(); style.setProperty("text-align", "center") }
        ptrd.appendElement("td") { textContent = p.walksAllowed.toString(); style.setProperty("text-align", "center") }
        ptrd.appendElement("td") { textContent = p.strikeoutsRecorded.toString(); style.setProperty("text-align", "center") }
    }

    // C. SCOREBOARD & GAME TOTALS (Bottom Right)
    val scoreboardCard = bottomGrid.appendElement("div", "card") {
        style.setProperty("background-color", "#eae5dc")
        style.setProperty("border", "2px solid #5a544a")
        style.setProperty("padding", "1rem")
        style.setProperty("color", "#2b2a28")
        style.setProperty("flex", "1 1 280px")
    }

    scoreboardCard.appendElement("h3") {
        textContent = "SCOREBOARD SUMMARY"
        style.setProperty("text-align", "center")
        style.setProperty("margin", "0 0 1rem 0")
        style.setProperty("font-size", "1rem")
        style.setProperty("font-weight", "bold")
        style.setProperty("border-bottom", "1px solid #5a544a")
        style.setProperty("padding-bottom", "0.25rem")
    }

    val sTable = scoreboardCard.appendElement("table") {
        style.setProperty("width", "100%")
        style.setProperty("border-collapse", "collapse")
        style.setProperty("margin-bottom", "1.5rem")
        style.setProperty("font-size", "0.85rem")
    }

    val sThead = sTable.appendElement("thead")
    val strh = sThead.appendElement("tr") {
        style.setProperty("border-bottom", "1px solid #5a544a")
    }
    strh.appendElement("th") { textContent = "TEAM"; style.setProperty("text-align", "left") }
    for (i in 1..maxInning) {
        strh.appendElement("th") { textContent = i.toString(); style.setProperty("text-align", "center") }
    }
    strh.appendElement("th") { textContent = "R"; style.setProperty("text-align", "center"); style.setProperty("font-weight", "bold") }
    strh.appendElement("th") { textContent = "H"; style.setProperty("text-align", "center") }
    strh.appendElement("th") { textContent = "E"; style.setProperty("text-align", "center") }

    val sTbody = sTable.appendElement("tbody")
    
    val stra = sTbody.appendElement("tr") { style.setProperty("border-bottom", "1px solid #c2bcae") }
    stra.appendElement("td") { textContent = game.awayTeam.abbreviation; style.setProperty("font-weight", "bold") }
    boxScore.lineScore.awayInningRuns.forEach { r ->
        stra.appendElement("td") { textContent = r?.toString() ?: "0"; style.setProperty("text-align", "center") }
    }
    stra.appendElement("td") { textContent = boxScore.lineScore.awayRuns.toString(); style.setProperty("text-align", "center"); style.setProperty("font-weight", "bold") }
    stra.appendElement("td") { textContent = boxScore.lineScore.awayHits.toString(); style.setProperty("text-align", "center") }
    stra.appendElement("td") { textContent = boxScore.lineScore.awayErrors.toString(); style.setProperty("text-align", "center") }

    val strhRow = sTbody.appendElement("tr") { style.setProperty("border-bottom", "1px solid #c2bcae") }
    strhRow.appendElement("td") { textContent = game.homeTeam.abbreviation; style.setProperty("font-weight", "bold") }
    boxScore.lineScore.homeInningRuns.forEach { r ->
        strhRow.appendElement("td") { textContent = r?.toString() ?: "0"; style.setProperty("text-align", "center") }
    }
    strhRow.appendElement("td") { textContent = boxScore.lineScore.homeRuns.toString(); style.setProperty("text-align", "center"); style.setProperty("font-weight", "bold") }
    strhRow.appendElement("td") { textContent = boxScore.lineScore.homeHits.toString(); style.setProperty("text-align", "center") }
    strhRow.appendElement("td") { textContent = boxScore.lineScore.homeErrors.toString(); style.setProperty("text-align", "center") }

    val decisionBlock = scoreboardCard.appendElement("div") {
        style.setProperty("display", "flex")
        style.setProperty("flex-direction", "column")
        style.setProperty("gap", "0.5rem")
        style.setProperty("border-top", "1px solid #5a544a")
        style.setProperty("padding-top", "0.75rem")
        style.setProperty("font-size", "0.8rem")
    }

    val wp = if (game.homeScore > game.awayScore) 
                positionsMap["P"] ?: "Justin Steele" 
             else 
                (if (isHomeBatting) localHomeActivePitcherName else localAwayActivePitcherName)
    val lp = if (game.homeScore < game.awayScore) 
                positionsMap["P"] ?: "Justin Steele" 
             else 
                (if (isHomeBatting) localHomeActivePitcherName else localAwayActivePitcherName)

    decisionBlock.appendElement("div") { 
        innerHTML = "WP: <span style='font-weight: bold;'>$wp</span>" 
    }
    decisionBlock.appendElement("div") { 
        innerHTML = "LP: <span style='font-weight: bold;'>$lp</span>" 
    }
    decisionBlock.appendElement("div") { 
        innerHTML = "SV: <span style='font-weight: bold;'>${if (game.homeScore > game.awayScore) "HADER (12)" else "NONE"}</span>" 
    }
}

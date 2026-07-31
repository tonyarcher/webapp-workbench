package com.baseball.ui.gametracking.scoring

import com.baseball.models.Game
import com.baseball.models.Player
import kotlinx.html.DIV
import kotlinx.html.div

internal fun renderPlateMatchupCard(parent: DIV, game: Game, homeRoster: List<Player>, awayRoster: List<Player>) {
    parent.div(classes = "matchup-container card") {
        div(classes = "flex-between text-center") {
            renderMatchupBatterInfo(game, homeRoster, awayRoster)
            div(classes = "text-accent-yellow font-bold margin-left-right-md") {
                +"VS"
            }
            renderMatchupPitcherInfo(game, homeRoster, awayRoster)
        }
    }
}

private fun DIV.renderMatchupBatterInfo(game: Game, homeRoster: List<Player>, awayRoster: List<Player>) {
    val currBatter = (awayRoster + homeRoster).find { it.id == game.gameState.currentBatterId }
    div(classes = "flex-grow") {
        div(classes = "text-accent-green") { +"CURRENT BATTER" }
        div(classes = "matchup-player-name") {
            +(game.gameState.currentBatterName ?: "None")
        }
        div(classes = "matchup-player-stats") {
            +(currBatter?.let { "${it.position} | #${it.jerseyNumber} | Bat: ${it.battingHand}" } ?: "")
        }
    }
}

private fun DIV.renderMatchupPitcherInfo(game: Game, homeRoster: List<Player>, awayRoster: List<Player>) {
    val currPitcher = (awayRoster + homeRoster).find { it.id == game.gameState.currentPitcherId }
    div(classes = "flex-grow") {
        div(classes = "text-accent-green") { +"CURRENT PITCHER" }
        div(classes = "matchup-player-name") {
            +(game.gameState.currentPitcherName ?: "None")
        }
        div(classes = "matchup-player-stats") {
            +(currPitcher?.let { "${it.position} | #${it.jerseyNumber} | Throw: ${it.throwingHand}" } ?: "")
        }
    }
}

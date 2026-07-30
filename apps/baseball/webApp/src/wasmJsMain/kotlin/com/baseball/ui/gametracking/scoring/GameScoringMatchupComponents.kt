package com.baseball.ui.gametracking.scoring

import com.baseball.models.Game
import com.baseball.models.Player
import com.baseball.ui.core.css
import kotlinx.css.Align
import kotlinx.css.Border
import kotlinx.css.BorderStyle
import kotlinx.css.Color
import kotlinx.css.Display
import kotlinx.css.FontWeight
import kotlinx.css.JustifyContent
import kotlinx.css.Margin
import kotlinx.css.Padding
import kotlinx.css.TextAlign
import kotlinx.css.alignItems
import kotlinx.css.border
import kotlinx.css.borderRadius
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.flexGrow
import kotlinx.css.fontSize
import kotlinx.css.fontWeight
import kotlinx.css.justifyContent
import kotlinx.css.margin
import kotlinx.css.marginBottom
import kotlinx.css.padding
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.css.textAlign
import kotlinx.html.DIV
import kotlinx.html.div

internal fun renderPlateMatchupCard(parent: DIV, game: Game, homeRoster: List<Player>, awayRoster: List<Player>) {
    parent.div {
        css { applyPlateMatchupCardStyle() }
        div {
            css {
                display = Display.flex
                justifyContent = JustifyContent.spaceBetween
                alignItems = Align.center
                textAlign = TextAlign.center
            }
            renderMatchupBatterInfo(game, homeRoster, awayRoster)
            div {
                +"VS"
                css {
                    fontSize = 1.3.rem
                    fontWeight = FontWeight("900")
                    margin = Margin(0.px, 1.5.rem)
                    color = Color("rgba(74, 222, 128, 0.4)")
                }
            }
            renderMatchupPitcherInfo(game, homeRoster, awayRoster)
        }
    }
}

private fun DIV.renderMatchupBatterInfo(game: Game, homeRoster: List<Player>, awayRoster: List<Player>) {
    val currBatter = (awayRoster + homeRoster).find { it.id == game.gameState.currentBatterId }
    div {
        css { flexGrow = 1.0 }
        div { +"CURRENT BATTER"; css { fontSize = 0.75.rem; color = Color("var(--accent-green)") } }
        div {
            +(game.gameState.currentBatterName ?: "None")
            css { fontSize = 1.2.rem; fontWeight = FontWeight("800"); color = Color("var(--text-primary)") }
        }
        div {
            +(currBatter?.let { "${it.position} | #${it.jerseyNumber} | Bat: ${it.battingHand}" } ?: "")
            css { fontSize = 0.85.rem; color = Color("var(--text-secondary)") }
        }
    }
}

private fun DIV.renderMatchupPitcherInfo(game: Game, homeRoster: List<Player>, awayRoster: List<Player>) {
    val currPitcher = (awayRoster + homeRoster).find { it.id == game.gameState.currentPitcherId }
    div {
        css { flexGrow = 1.0 }
        div { +"CURRENT PITCHER"; css { fontSize = 0.75.rem; color = Color("var(--accent-green)") } }
        div {
            +(game.gameState.currentPitcherName ?: "None")
            css { fontSize = 1.2.rem; fontWeight = FontWeight("800"); color = Color("var(--text-primary)") }
        }
        div {
            +(currPitcher?.let { "${it.position} | #${it.jerseyNumber} | Throw: ${it.throwingHand}" } ?: "")
            css { fontSize = 0.85.rem; color = Color("var(--text-secondary)") }
        }
    }
}

private fun kotlinx.css.CssBuilder.applyPlateMatchupCardStyle() {
    marginBottom = 1.5.rem
    put("background", "linear-gradient(135deg, rgba(27, 53, 36, 0.9) 0%, rgba(13, 26, 18, 0.95) 100%)")
    border = Border(1.px, BorderStyle.solid, Color("rgba(74, 222, 128, 0.2)"))
    padding = Padding(1.25.rem)
    borderRadius = 12.px
}

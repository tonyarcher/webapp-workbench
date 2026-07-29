package com.baseball.ui.tabs.scorer

import com.baseball.models.Game
import com.baseball.ui.UiConstants
import com.baseball.ui.gametracking.lineup.isLineupDialogOpen
import com.baseball.ui.css
import com.baseball.ui.renderCurrentTab
import kotlinx.css.Color
import kotlinx.css.Display
import kotlinx.css.JustifyContent
import kotlinx.css.LinearDimension
import kotlinx.css.Margin
import kotlinx.css.Padding
import kotlinx.css.TextAlign
import kotlinx.css.background
import kotlinx.css.borderRadius
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.flexGrow
import kotlinx.css.fontSize
import kotlinx.css.gap
import kotlinx.css.justifyContent
import kotlinx.css.margin
import kotlinx.css.marginBottom
import kotlinx.css.marginTop
import kotlinx.css.maxWidth
import kotlinx.css.padding
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.css.textAlign
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h2
import kotlinx.html.h3
import kotlinx.html.js.onClickFunction
import kotlinx.html.p
import org.w3c.dom.HTMLElement
import org.w3c.dom.events.Event

internal fun renderStartGameCard(container: HTMLElement, game: Game) {
    container.append {
        div(classes = "card") {
            css {
                textAlign = TextAlign.center; padding = UiConstants.CARD_PADDING_LARGE
                maxWidth = 600.px; margin = Margin(2.rem, LinearDimension.auto)
            }
            h2 { +"Ready to Play!" }
            renderStartGameMatchupText(game)
            renderTeamMatchupPreview(game)
            renderStartGameButton()
        }
    }
}

private fun kotlinx.html.DIV.renderStartGameMatchupText(game: Game) {
    p {
        css {
            fontSize = UiConstants.FONT_SIZE_LARGE; color = Color("var(--text-secondary)")
            marginTop = 1.rem; marginBottom = UiConstants.CARD_GAP_XL
        }
        +"Matchup: ${game.awayTeam.city} ${game.awayTeam.name} @ ${game.homeTeam.city} ${game.homeTeam.name}"
    }
}

private fun kotlinx.html.DIV.renderStartGameButton() {
    button(classes = "btn btn-primary") {
        +"START GAME"
        css { fontSize = 1.3.rem; padding = Padding(0.75.rem, 2.5.rem); borderRadius = 30.px }
        onClickFunction = { _: Event ->
            isLineupDialogOpen = true
            renderCurrentTab()
        }
    }
}

private fun kotlinx.html.DIV.renderTeamMatchupPreview(game: Game) {
    div {
        css {
            display = Display.flex
            justifyContent = JustifyContent.center
            gap = UiConstants.CARD_GAP_LARGE
            marginBottom = UiConstants.CARD_GAP_XL
        }
        renderTeamAbbrevBox("Away", game.awayTeam.abbreviation)
        renderTeamAbbrevBox("Home", game.homeTeam.abbreviation)
    }
}

private fun kotlinx.html.DIV.renderTeamAbbrevBox(label: String, abbrev: String) {
    div {
        css {
            background = "rgba(255,255,255,0.05)"
            padding = Padding(UiConstants.CARD_GAP_LARGE)
            borderRadius = UiConstants.CARD_BORDER_RADIUS
            flexGrow = 1.0
        }
        div { +label }
        h3 { +abbrev }
    }
}

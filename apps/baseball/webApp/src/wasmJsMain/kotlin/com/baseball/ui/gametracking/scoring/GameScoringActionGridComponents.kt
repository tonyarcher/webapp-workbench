package com.baseball.ui.gametracking.scoring

import com.baseball.models.ScoringEventType
import com.baseball.ui.core.css
import kotlinx.css.Border
import kotlinx.css.BorderStyle
import kotlinx.css.Color
import kotlinx.css.Display
import kotlinx.css.FlexWrap
import kotlinx.css.FontWeight
import kotlinx.css.Padding
import kotlinx.css.borderTop
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.flexGrow
import kotlinx.css.flexWrap
import kotlinx.css.fontSize
import kotlinx.css.fontWeight
import kotlinx.css.gap
import kotlinx.css.marginBottom
import kotlinx.css.marginTop
import kotlinx.css.padding
import kotlinx.css.paddingTop
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.html.DIV
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.js.onClickFunction

internal fun DIV.renderPitchTypes(
    currentPitchType: String?,
    onPitchTypeSelected: (String?) -> Unit,
) {
    div {
        css {
            display = Display.flex
            gap = 0.5.rem
            marginBottom = 1.rem
            flexWrap = FlexWrap.wrap
        }
        val pitchTypes = listOf("Fastball", "Breaking Ball", "Offspeed")
        pitchTypes.forEach { pType ->
            val isSelected = pType == currentPitchType
            button(classes = if (isSelected) "btn btn-primary" else "btn btn-secondary") {
                +pType
                css {
                    flexGrow = 1.0
                    fontSize = 0.85.rem
                    padding = Padding(0.4.rem)
                }
                onClickFunction = {
                    onPitchTypeSelected(if (isSelected) null else pType)
                }
            }
        }
    }
}

internal fun DIV.renderPitchResultsSection(
    onTriggerEvent: (ScoringEventType) -> Unit,
) {
    div {
        css {
            fontSize = 0.8.rem
            fontWeight = FontWeight.bold
            color = Color("var(--accent-green)")
            marginBottom = 0.5.rem
        }
        +"PITCH RESULTS"
    }
    div(classes = "action-grid") {
        css {
            put("grid-template-columns", "repeat(3, 1fr)")
            gap = 0.5.rem
            marginBottom = 1.25.rem
        }
        listOf(
            ScoringEventType.BALL to "Ball (B+1)",
            ScoringEventType.STRIKE to "Strike (S+1)",
            ScoringEventType.FOUL to "Foul",
        ).forEach { (type, label) ->
            button(classes = "btn btn-secondary btn-action") {
                +label
                css { padding = Padding(0.6.rem) }
                onClickFunction = { onTriggerEvent(type) }
            }
        }
    }
}

internal fun DIV.renderBaseRunningEventsSection(
    onRenderStep2: (ScoringEventType, String) -> Unit,
) {
    div {
        css { applyBaseRunningHeaderStyle() }
        +"BASE RUNNING EVENTS"
    }
    div(classes = "action-grid") {
        css {
            put("grid-template-columns", "repeat(2, 1fr)")
            gap = 0.5.rem
        }
        listOf(
            ScoringEventType.STOLEN_BASE to "Stolen Base",
            ScoringEventType.CAUGHT_STEALING to "Caught Stealing",
            ScoringEventType.PICKED_OFF to "Picked Off",
            ScoringEventType.WILD_PITCH to "WP / PB / Balk",
        ).forEach { (type, label) ->
            button(classes = "btn btn-secondary btn-action") {
                +label
                css { padding = Padding(0.5.rem) }
                onClickFunction = { onRenderStep2(type, label) }
            }
        }
    }
}

private fun kotlinx.css.CssBuilder.applyBaseRunningHeaderStyle() {
    fontSize = 0.8.rem
    fontWeight = FontWeight.bold
    color = Color("var(--accent-green)")
    marginTop = 1.5.rem
    marginBottom = 0.5.rem
    borderTop = Border(1.px, BorderStyle.solid, Color("rgba(255, 255, 255, 0.08)"))
    paddingTop = 1.25.rem
}

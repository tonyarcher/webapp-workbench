package com.baseball.ui.gametracking.scoring

import com.baseball.models.ScoringEventType
import kotlinx.html.DIV
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.js.onClickFunction

internal fun DIV.renderPitchTypes(
    currentPitchType: String?,
    onPitchTypeSelected: (String?) -> Unit,
) {
    div(classes = "flex-gap-sm margin-bottom-md") {
        val pitchTypes = listOf("Fastball", "Breaking Ball", "Offspeed")
        pitchTypes.forEach { pType ->
            val isSelected = pType == currentPitchType
            button(classes = if (isSelected) "btn btn-primary flex-grow" else "btn btn-secondary flex-grow") {
                +pType
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
    div(classes = "text-accent-green font-bold margin-bottom-sm") {
        +"PITCH RESULTS"
    }
    div(classes = "action-grid-3col") {
        listOf(
            ScoringEventType.BALL to "Ball (B+1)",
            ScoringEventType.STRIKE to "Strike (S+1)",
            ScoringEventType.FOUL to "Foul",
        ).forEach { (type, label) ->
            button(classes = "btn btn-secondary btn-action") {
                +label
                onClickFunction = { onTriggerEvent(type) }
            }
        }
    }
}

internal fun DIV.renderBaseRunningEventsSection(
    onRenderStep2: (ScoringEventType, String) -> Unit,
) {
    div(classes = "text-accent-green font-bold margin-top-md margin-bottom-sm") {
        +"BASE RUNNING EVENTS"
    }
    div(classes = "action-grid-2col") {
        listOf(
            ScoringEventType.STOLEN_BASE to "Stolen Base",
            ScoringEventType.CAUGHT_STEALING to "Caught Stealing",
            ScoringEventType.PICKED_OFF to "Picked Off",
            ScoringEventType.WILD_PITCH to "WP / PB / Balk",
        ).forEach { (type, label) ->
            button(classes = "btn btn-secondary btn-action") {
                +label
                onClickFunction = { onRenderStep2(type, label) }
            }
        }
    }
}

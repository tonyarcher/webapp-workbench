package com.baseball.ui.gametracking.scoring

import com.baseball.models.ScoringEventType
import kotlinx.browser.document
import org.w3c.dom.Element
import org.w3c.dom.HTMLElement

internal fun renderActionGridComponent(
    parent: HTMLElement,
    currentPitchType: String?,
    onPitchTypeSelected: (String?) -> Unit,
    onTriggerEvent: (ScoringEventType) -> Unit,
    onRenderStep2: (ScoringEventType, String) -> Unit,
) {
    parent.innerHTML = ""
    val grid = document.createElement("baseball-action-grid")
    currentPitchType?.let { grid.setAttribute("current-pitch-type", it) }

    bindActionGridEvents(grid, onPitchTypeSelected, onTriggerEvent, onRenderStep2)
    parent.appendChild(grid)
}

private fun bindActionGridEvents(
    grid: Element,
    onPitchTypeSelected: (String?) -> Unit,
    onTriggerEvent: (ScoringEventType) -> Unit,
    onRenderStep2: (ScoringEventType, String) -> Unit,
) {
    grid.addEventListener("pitch-type-selected", { event ->
        val target = event.target as? Element
        val pitchType = target?.getAttribute("selected-pitch-type")
        onPitchTypeSelected(if (isNullOrBlankString(pitchType)) null else pitchType)
    })
    grid.addEventListener("action-triggered", { event ->
        val target = event.target as? Element
        val eventTypeStr = target?.getAttribute("triggered-event-type") ?: ""
        runCatching { ScoringEventType.valueOf(eventTypeStr) }.getOrNull()?.let(onTriggerEvent)
    })
    grid.addEventListener("step2-requested", { event ->
        val target = event.target as? Element
        val eventTypeStr = target?.getAttribute("step2-event-type") ?: ""
        val label = target?.getAttribute("step2-label") ?: ""
        runCatching { ScoringEventType.valueOf(eventTypeStr) }.getOrNull()?.let { type ->
            onRenderStep2(type, label)
        }
    })
}

private fun isNullOrBlankString(value: String?): Boolean = value == null || value.isBlank()

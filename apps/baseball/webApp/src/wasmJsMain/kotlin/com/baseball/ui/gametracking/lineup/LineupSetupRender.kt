package com.baseball.ui.gametracking.lineup

import kotlinx.html.DIV
import kotlinx.html.InputType
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h1
import kotlinx.html.input
import kotlinx.html.js.div
import kotlinx.html.js.onChangeFunction
import kotlinx.html.js.onClickFunction
import kotlinx.html.label
import kotlinx.html.span
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLInputElement

internal fun renderLineupModalHeader(parent: DIV, validationError: String?) {
    parent.h1 {
        +"Game Roster & Lineup Setup"
    }
    renderValidationErrorBanner(parent, validationError)
}

internal fun renderOverlayContainer(parent: HTMLElement, content: DIV.() -> Unit) {
    parent.append {
        div(classes = "modal-overlay") {
            content()
        }
    }
}

internal fun DIV.renderModalContent(
    useDh: Boolean,
    validationError: String?,
    lineupUiContext: LineupUiContext,
    handlers: LineupPitcherChangeHandlers,
    callbacks: LineupCallbacks,
) {
    div(classes = "lineup-modal-content card") {
        renderLineupModalHeader(this, validationError)
        renderConfigurationBar(this, useDh, callbacks.onDhToggle, callbacks.onLoadDefault, callbacks.onRandom)
        renderTeamGrid(this, lineupUiContext, handlers)
        renderFooterButtons(this, callbacks.onBack, callbacks.onStartSave)
    }
}

internal fun renderValidationErrorBanner(parent: DIV, errorMsg: String?) {
    errorMsg ?: return
    parent.div(classes = "server-error-banner") {
        +errorMsg
    }
}

internal fun renderConfigurationBar(
    parent: DIV,
    useDh: Boolean,
    onDhToggle: (Boolean) -> Unit,
    onLoadDefault: () -> Unit,
    onRandom: () -> Unit
) {
    parent.div(classes = "config-bar") {
        renderDhToggle(useDh, onDhToggle)
        renderConfigActionButtons(parent, onLoadDefault, onRandom)
    }
}

internal fun DIV.renderDhToggle(useDh: Boolean, onToggle: (Boolean) -> Unit) {
    label(classes = "flex-gap-sm") {
        input(type = InputType.checkBox) {
            checked = useDh
            onChangeFunction = { event ->
                onToggle((event.target as HTMLInputElement).checked)
            }
        }
        span {
            +"Enable Designated Hitter (DH)"
        }
    }
}

internal fun renderConfigActionButtons(parent: DIV, onLoadDefault: () -> Unit, onRandom: () -> Unit) {
    parent.div(classes = "flex-gap-sm") {
        button(classes = "btn btn-secondary") {
            +"Load Default Roster"
            onClickFunction = { onLoadDefault() }
        }
        button(classes = "btn btn-gradient") {
            +"Populate Random Example Data"
            onClickFunction = { onRandom() }
        }
    }
}

internal fun renderFooterButtons(parent: DIV, onBack: () -> Unit, onStartSave: () -> Unit) {
    parent.div(classes = "flex-between") {
        button(classes = "btn btn-secondary") {
            +"← Go Back to Welcome"
            onClickFunction = { onBack() }
        }
        button(classes = "btn btn-primary") {
            +"⚾ Start & Save Game"
            onClickFunction = { onStartSave() }
        }
    }
}

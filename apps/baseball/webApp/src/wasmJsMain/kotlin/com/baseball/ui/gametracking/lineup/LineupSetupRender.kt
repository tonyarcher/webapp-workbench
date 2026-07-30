package com.baseball.ui.gametracking.lineup

import com.baseball.ui.core.css
import kotlinx.css.Align
import kotlinx.css.Cursor
import kotlinx.css.Display
import kotlinx.css.FontWeight
import kotlinx.css.JustifyContent
import kotlinx.css.LinearDimension
import kotlinx.css.Overflow
import kotlinx.css.Padding
import kotlinx.css.Position
import kotlinx.css.TextAlign
import kotlinx.css.alignItems
import kotlinx.css.background
import kotlinx.css.borderRadius
import kotlinx.css.cursor
import kotlinx.css.display
import kotlinx.css.fontWeight
import kotlinx.css.gap
import kotlinx.css.height
import kotlinx.css.justifyContent
import kotlinx.css.left
import kotlinx.css.marginBottom
import kotlinx.css.marginTop
import kotlinx.css.maxWidth
import kotlinx.css.overflowY
import kotlinx.css.padding
import kotlinx.css.pct
import kotlinx.css.position
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.css.textAlign
import kotlinx.css.top
import kotlinx.css.width
import kotlinx.css.zIndex
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
        css {
            textAlign = TextAlign.center
            marginBottom = 1.5.rem
        }
    }
    renderValidationErrorBanner(parent, validationError)
}

internal fun renderOverlayContainer(parent: HTMLElement, content: DIV.() -> Unit) {
    parent.append {
        div {
            css {
                position = Position.fixed
                top = 0.px
                left = 0.px
                width = LinearDimension("100vw")
                height = LinearDimension("100vh")
                background = "rgba(10, 15, 30, 0.8)"
                put("backdrop-filter", "blur(12px)")
                display = Display.flex
                alignItems = Align.flexStart
                justifyContent = JustifyContent.center
                zIndex = 10000
                overflowY = Overflow.auto
                padding = Padding(2.rem, 1.rem)
            }
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
        css {
            width = 100.pct
            maxWidth = 1000.px
            padding = Padding(2.rem)
            put("box-shadow", "0 10px 40px rgba(0,0,0,0.5)")
        }
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
        css {
            marginBottom = 1.rem
        }
    }
}

internal fun renderConfigurationBar(
    parent: DIV,
    useDh: Boolean,
    onDhToggle: (Boolean) -> Unit,
    onLoadDefault: () -> Unit,
    onRandom: () -> Unit
) {
    parent.div {
        css {
            display = Display.flex; justifyContent = JustifyContent.spaceBetween; alignItems = Align.center
            marginBottom = 1.5.rem; background = "rgba(255, 255, 255, 0.03)"
            padding = Padding(1.rem); borderRadius = 8.px
        }
        renderDhToggle(useDh, onDhToggle)
        renderConfigActionButtons(parent, onLoadDefault, onRandom)
    }
}

internal fun DIV.renderDhToggle(useDh: Boolean, onToggle: (Boolean) -> Unit) {
    label {
        css {
            display = Display.flex
            alignItems = Align.center
            gap = 0.5.rem
            cursor = Cursor.pointer
        }
        input(type = InputType.checkBox) {
            checked = useDh
            onChangeFunction = { event ->
                onToggle((event.target as HTMLInputElement).checked)
            }
        }
        span {
            +"Enable Designated Hitter (DH)"
            css {
                fontWeight = FontWeight.bold
            }
        }
    }
}

internal fun renderConfigActionButtons(parent: DIV, onLoadDefault: () -> Unit, onRandom: () -> Unit) {
    parent.div {
        css {
            display = Display.flex
            gap = 0.75.rem
        }
        button(classes = "btn btn-secondary") {
            +"Load Default Roster"
            onClickFunction = { onLoadDefault() }
        }
        button(classes = "btn btn-action") {
            +"Populate Random Example Data"
            css {
                put("background", "linear-gradient(135deg, #3b82f6, #8b5cf6)")
            }
            onClickFunction = { onRandom() }
        }
    }
}

internal fun renderFooterButtons(parent: DIV, onBack: () -> Unit, onStartSave: () -> Unit) {
    parent.div {
        css {
            display = Display.flex
            justifyContent = JustifyContent.spaceBetween
            marginTop = 1.5.rem
        }
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

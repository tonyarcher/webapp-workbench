package com.baseball.ui.tabs.boxscore

import com.baseball.models.PlayEvent
import com.baseball.ui.core.UiConstants
import com.baseball.ui.core.css
import kotlinx.css.marginBottom
import kotlinx.css.maxHeight
import kotlinx.css.padding
import kotlinx.css.px
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h3
import kotlinx.html.span
import org.w3c.dom.HTMLDivElement

internal fun renderGameLogCard(contentEl: HTMLDivElement, events: List<PlayEvent>) {
    contentEl.append {
        div(classes = "card") {
            css {
                padding = UiConstants.CARD_PADDING
                marginBottom = UiConstants.CARD_GAP
            }
            h3 { +"Game Log History" }
            div(classes = "event-log") {
                css {
                    maxHeight = UiConstants.EVENT_LOG_MAX_HEIGHT_PX.px
                }
                events.forEach { ev ->
                    div(classes = "log-item") {
                        span(classes = "log-desc") { +ev.description }
                        span(classes = "log-inning") { +"${ev.half.name.substring(0, 3)} ${ev.inning}" }
                    }
                }
            }
        }
    }
}

package com.baseball.ui.tabs.boxscore

import com.baseball.models.PlayEvent
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h3
import kotlinx.html.span
import org.w3c.dom.HTMLDivElement

internal fun renderGameLogCard(contentEl: HTMLDivElement, events: List<PlayEvent>) {
    contentEl.append {
        div(classes = "card margin-bottom-md") {
            h3 { +"Game Log History" }
            div(classes = "event-log") {
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

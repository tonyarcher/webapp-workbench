// Refactored DashboardTabHelpers for Kotlin/JS
package com.baseball.ui.tabs.dashboard

import com.baseball.ui.UiConstants
import com.baseball.ui.renderCurrentTab
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h2
import kotlinx.html.js.onClickFunction
import kotlinx.html.p
import kotlinx.html.style
import org.w3c.dom.HTMLElement

internal fun formatWinPercentage(pct: Double): String {
    val str = pct.toString()
    return when {
        str.startsWith("0.") -> str.substring(1)
        pct == 1.0 -> "1.000"
        else -> ".000"
    }
}

internal fun showDashboardLoading(container: HTMLElement) {
    container.innerHTML = ""
    container.append {
        div(classes = "card") {
            style = "text-align: center; padding: ${UiConstants.CARD_PADDING_LARGE};"
            p { +"Loading season dashboard..." }
        }
    }
}

internal fun showNoSeasonSelectedMessage(container: HTMLElement) {
    container.append {
        div(classes = "card") {
            style = "text-align: center; padding: 3rem;"
            p {
                +"Please select a league and season above, then click Load Season."
                style = "color: var(--text-secondary);"
            }
        }
    }
}

internal fun renderDashboardError(container: HTMLElement, e: Throwable) {
    container.innerHTML = ""
    container.append {
        div(classes = "card") {
            style = "text-align: center; padding: ${UiConstants.CARD_PADDING_LARGE};"
            h2 { +"Failed to load Dashboard" }
            p {
                style = "color: var(--text-secondary);"
                +"Error: ${e.message}"
            }
            button(classes = "btn btn-primary") {
                +"Retry"
                style = "margin-top: ${UiConstants.CARD_GAP};"
                onClickFunction = { renderCurrentTab() }
            }
        }
    }
}

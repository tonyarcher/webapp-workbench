package com.baseball.ui.tabs.dashboard

import com.baseball.ui.state.renderCurrentTab
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h2
import kotlinx.html.js.onClickFunction
import kotlinx.html.p
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
        div(classes = "card text-center padding-lg") {
            p { +"Loading season dashboard..." }
        }
    }
}

internal fun showNoSeasonSelectedMessage(container: HTMLElement) {
    container.append {
        div(classes = "card text-center padding-lg") {
            p(classes = "text-muted") {
                +"Please select a league and season above, then click Load Season."
            }
        }
    }
}

internal fun renderDashboardError(container: HTMLElement, e: Throwable) {
    container.innerHTML = ""
    container.append {
        div(classes = "card text-center padding-lg") {
            h2 { +"Failed to load Dashboard" }
            p(classes = "text-muted") {
                +"Error: ${e.message}"
            }
            button(classes = "btn btn-primary margin-top-md") {
                +"Retry"
                onClickFunction = { renderCurrentTab() }
            }
        }
    }
}

package com.baseball.ui.tabs.scorer

import com.baseball.BaseballConstants
import com.baseball.models.HalfInning
import com.baseball.models.PlayEvent
import com.baseball.models.Player
import com.baseball.models.ScoringEventType
import com.baseball.ui.UiConstants
import com.baseball.ui.gametracking.scorebook.getScorebookNotation
import com.baseball.ui.gametracking.scorebook.renderScorebookView
import com.baseball.ui.css
import kotlinx.css.Align
import kotlinx.css.Border
import kotlinx.css.BorderStyle
import kotlinx.css.Color
import kotlinx.css.Display
import kotlinx.css.FlexDirection
import kotlinx.css.FontWeight
import kotlinx.css.JustifyContent
import kotlinx.css.Padding
import kotlinx.css.alignItems
import kotlinx.css.background
import kotlinx.css.borderBottom
import kotlinx.css.borderLeft
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.flexDirection
import kotlinx.css.fontSize
import kotlinx.css.fontWeight
import kotlinx.css.gap
import kotlinx.css.justifyContent
import kotlinx.css.Margin
import kotlinx.css.alignItems
import kotlinx.css.background
import kotlinx.css.borderBottom
import kotlinx.css.borderLeft
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.flexDirection
import kotlinx.css.fontSize
import kotlinx.css.fontWeight
import kotlinx.css.gap
import kotlinx.css.justifyContent
import kotlinx.css.margin
import kotlinx.css.marginBottom
import kotlinx.css.marginTop
import kotlinx.css.padding
import kotlinx.css.paddingBottom
import kotlinx.css.pct
import kotlinx.css.px
import kotlinx.css.rem
import kotlinx.css.width
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h2
import kotlinx.html.id
import kotlinx.html.js.onClickFunction
import kotlinx.html.span
import kotlinx.html.unsafe
import org.w3c.dom.HTMLButtonElement
import org.w3c.dom.HTMLDivElement
import org.w3c.dom.HTMLElement
import org.w3c.dom.events.Event

internal fun renderPlayMonitoringSection(
    container: HTMLElement,
    data: ScorerData,
) {
    var btnLog: HTMLButtonElement? = null
    var btnScorecard: HTMLButtonElement? = null
    var monitorContent: HTMLDivElement? = null

    fun showLog() {
        val monitorEl = monitorContent ?: return
        renderEventLogContent(monitorEl, data.events, data.homeRoster, data.awayRoster)
    }

    fun showScorecard() {
        val monitorEl = monitorContent ?: return
        monitorEl.innerHTML = ""
        renderScorebookView(monitorEl, data.game, data.boxScore, data.events)
    }

    container.append {
        div(classes = "card") {
            id = "play-monitoring-card"
            css { marginTop = UiConstants.CARD_GAP_XL }
            renderMonitoringHeader(
                onLogClick = {
                    showLog()
                    btnLog?.classList?.add("btn-primary"); btnLog?.classList?.remove("btn-secondary")
                    btnScorecard?.classList?.add("btn-secondary"); btnScorecard?.classList?.remove("btn-primary")
                },
                onScorecardClick = {
                    showScorecard()
                    btnScorecard?.classList?.add("btn-primary"); btnScorecard?.classList?.remove("btn-secondary")
                    btnLog?.classList?.add("btn-secondary"); btnLog?.classList?.remove("btn-primary")
                }
            )
        }
    }
    val monitorCard = container.querySelector("#play-monitoring-card") as? HTMLDivElement
    btnLog = monitorCard?.querySelector("#scorer-btn-log") as? HTMLButtonElement
    btnScorecard = monitorCard?.querySelector("#scorer-btn-scorecard") as? HTMLButtonElement
    monitorCard?.append { div { id = "monitor-content-container" } }
    monitorContent = monitorCard?.querySelector("#monitor-content-container") as? HTMLDivElement
    showScorecard()
}

private fun kotlinx.html.DIV.renderMonitoringHeader(
    onLogClick: () -> Unit,
    onScorecardClick: () -> Unit,
) {
    div {
        css {
            display = Display.flex; justifyContent = JustifyContent.spaceBetween; alignItems = Align.center
            borderBottom = Border(1.px, BorderStyle.solid, Color("rgba(255, 255, 255, 0.1)"))
            paddingBottom = 0.5.rem; marginBottom = 1.rem
        }
        h2 { +"Live Game Monitoring"; css { margin = Margin(0.px) } }
        div {
            css { display = Display.flex; gap = 0.5.rem }
            button(classes = "btn btn-secondary") {
                id = "scorer-btn-log"
                +"Play-By-Play Log"
                onClickFunction = { _: Event -> onLogClick() }
            }
            button(classes = "btn btn-primary") {
                id = "scorer-btn-scorecard"
                +"Scorebook"
                onClickFunction = { _: Event -> onScorecardClick() }
            }
        }
    }
}

internal fun renderEventLogContent(
    monitorEl: HTMLDivElement,
    events: List<PlayEvent>,
    homeRoster: List<Player>,
    awayRoster: List<Player>,
) {
    monitorEl.innerHTML = ""
    monitorEl.append {
        div(classes = "event-log") {
            if (events.isEmpty()) {
                div { +"No events logged for this game yet." }
            } else {
                val allPlayers = homeRoster + awayRoster
                events.forEachIndexed { index, ev ->
                    renderSingleEventLogItem(ev, events.getOrNull(index + 1), allPlayers)
                }
            }
        }
    }
}

private fun kotlinx.html.DIV.renderSingleEventLogItem(
    ev: PlayEvent,
    nextEv: PlayEvent?,
    allPlayers: List<Player>,
) {
    val player = allPlayers.find { it.name == ev.batterName }
    val position = player?.position ?: "DH"
    val endedInning = isPlayEventInningEnded(ev, nextEv)
    val endedStr = getPlayEventEndingStr(ev)
    val notation = getScorebookNotation(ev)

    div(classes = "log-item") {
        css {
            display = Display.flex; flexDirection = FlexDirection.column; padding = Padding(0.75.rem)
            borderBottom = Border(1.px, BorderStyle.solid, Color("rgba(255, 255, 255, 0.05)"))
            if (endedInning) {
                background = "rgba(255, 42, 59, 0.05)"
                borderLeft = Border(4.px, BorderStyle.solid, Color("var(--accent-red)"))
            }
        }
        renderLogItemContent(ev, position, notation, endedInning, endedStr)
    }
}

private fun kotlinx.html.DIV.renderLogItemContent(
    ev: PlayEvent,
    position: String,
    notation: String,
    endedInning: Boolean,
    endedStr: String,
) {
    div {
        css {
            display = Display.flex
            justifyContent = JustifyContent.spaceBetween
            alignItems = Align.center
            width = 100.pct
        }
        span(classes = "log-desc") {
            val eventHtml = buildEventLogHtml(ev, position, notation, endedInning, endedStr)
            unsafe { raw(eventHtml) }
        }
        if (endedInning) {
            span {
                +" ─── / (Side Retired)"
                css {
                    color = Color("var(--accent-red)")
                    fontWeight = FontWeight.bold
                    fontSize = 0.9.rem
                }
            }
        }
    }
}

private fun buildEventLogHtml(
    ev: PlayEvent,
    position: String,
    notation: String,
    endedInning: Boolean,
    endedStr: String,
): String {
    val inningHalf = if (ev.half == HalfInning.TOP) "Top" else "Bottom"
    val header = "${ev.batterName} ($position) - Inning ${ev.inning} ($inningHalf)"
    val notStr = if (notation.isNotEmpty()) " [$notation]" else ""
    val endingDetail = if (
        endedInning && endedStr != BaseballConstants.PLAY_RESULT_RUN_SCORED &&
        endedStr != BaseballConstants.PLAY_RESULT_OUT
    ) {
        BaseballConstants.PLAY_RESULT_LOB
    } else {
        endedStr
    }
    val cleanedDesc = ev.description.substringBefore(" | Adv:")
    return "<span style='color: var(--accent-yellow); font-weight: 700;'>$header</span>" +
            "$notStr - $cleanedDesc " +
            "<span style='color: var(--text-secondary); font-size: 0.8rem;'>" +
            "[Ended: $endingDetail]</span>"
}

private fun isPlayEventInningEnded(ev: PlayEvent, nextEv: PlayEvent?): Boolean {
    if (nextEv != null) return nextEv.half != ev.half || nextEv.inning != ev.inning
    val isDp = ev.description.contains(BaseballConstants.DESC_DOUBLE_PLAY) ||
            ev.description.contains(BaseballConstants.DESC_DP)
    val outsOnPlay = when {
        isDp -> 2
        ev.eventType in listOf(
            ScoringEventType.STRIKEOUT,
            ScoringEventType.GROUNDOUT,
            ScoringEventType.FLYOUT,
            ScoringEventType.LINE_OUT,
            ScoringEventType.POP_OUT,
            ScoringEventType.SACRIFICE_FLY,
            ScoringEventType.FIELDER_CHOICE,
        ) -> 1
        else -> 0
    }
    return ev.outsBefore + outsOnPlay >= 3
}

private fun getPlayEventEndingStr(ev: PlayEvent): String = when (ev.eventType) {
    ScoringEventType.SINGLE,
    ScoringEventType.WALK,
    ScoringEventType.HIT_BY_PITCH,
    ScoringEventType.ERROR -> BaseballConstants.PLAY_RESULT_1B
    ScoringEventType.DOUBLE -> BaseballConstants.PLAY_RESULT_2B
    ScoringEventType.TRIPLE -> BaseballConstants.PLAY_RESULT_3B
    ScoringEventType.HOME_RUN -> BaseballConstants.PLAY_RESULT_RUN_SCORED
    else -> BaseballConstants.PLAY_RESULT_OUT
}

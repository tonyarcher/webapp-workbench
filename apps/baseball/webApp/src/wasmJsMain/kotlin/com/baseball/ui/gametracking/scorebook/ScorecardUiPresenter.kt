package com.baseball.ui.gametracking.scorebook

import com.baseball.game.BaseballConstants
import com.baseball.game.localAwayBench
import com.baseball.game.localAwayLineup
import com.baseball.game.localHomeBench
import com.baseball.game.localHomeLineup
import com.baseball.game.localPlayersSubbedOut
import com.baseball.models.PlayEvent
import com.baseball.ui.core.DomUiConstants
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.substituteBatter
import kotlinx.browser.document
import kotlinx.browser.window
import org.w3c.dom.HTMLElement
import org.w3c.dom.HTMLOptionElement
import org.w3c.dom.HTMLSelectElement

interface ScorecardUiPresenter {
    fun buildSlotPlayers(
        isHomeBatting: Boolean,
        slots: Array<MutableList<PlayEvent>>,
    ): Array<MutableList<String>> =
        Array(9) { slotIdx ->
            val playersInSlot = mutableListOf<String>()
            slots[slotIdx].forEach { ev ->
                if (!playersInSlot.contains(ev.batterName)) {
                    playersInSlot.add(ev.batterName)
                }
            }
            if (playersInSlot.isEmpty()) {
                val roster = if (isHomeBatting) localHomeLineup else localAwayLineup
                if (roster.size > slotIdx) {
                    playersInSlot.add(roster[slotIdx].name)
                } else {
                    playersInSlot.add("Batter ${slotIdx + 1}")
                }
            }
            playersInSlot
        }

    fun openSubSelector(
        container: HTMLElement,
        idx: Int,
        isHomeBatting: Boolean,
    ) {
        val bench = if (isHomeBatting) localHomeBench else localAwayBench
        val subOptions = bench.filter {
            it.position != BaseballConstants.Positions.P && !localPlayersSubbedOut.contains(it.id)
        }
        if (subOptions.isEmpty()) {
            window.alert("No bench batters available!")
            return
        }

        val selectOverlay = buildSelectOverlay(subOptions, isHomeBatting, idx)

        container.innerHTML = ""
        container.appendChild(selectOverlay)
        selectOverlay.focus()
    }

    private fun buildSelectOverlay(
        subOptions: List<com.baseball.models.Player>,
        isHomeBatting: Boolean,
        idx: Int
    ): HTMLSelectElement {
        val selectOverlay = document.createElement(DomUiConstants.Html.SELECT) as HTMLSelectElement
        selectOverlay.className = "form-control"
        selectOverlay.style.setProperty(DomUiConstants.Css.FONT_SIZE, "0.75rem")
        selectOverlay.style.setProperty(DomUiConstants.Css.PADDING, "2px")

        val defOpt = document.createElement(DomUiConstants.Html.OPTION) as HTMLOptionElement
        defOpt.textContent = "Select pinch hitter..."
        selectOverlay.appendChild(defOpt)

        subOptions.forEach { optPlayer ->
            val opt = document.createElement(DomUiConstants.Html.OPTION) as HTMLOptionElement
            opt.value = optPlayer.id.toString()
            opt.textContent = "${optPlayer.name} (#${optPlayer.jerseyNumber} - ${optPlayer.position})"
            selectOverlay.appendChild(opt)
        }

        selectOverlay.addEventListener("change", {
            val valId = selectOverlay.value.toLongOrNull()
            if (valId != null) {
                substituteBatter(isHomeBatting, idx, valId)
            }
            renderCurrentTab()
        })
        selectOverlay.addEventListener("blur", { renderCurrentTab() })
        return selectOverlay
    }
}

package com.baseball.ui.tabs.boxscore


import com.baseball.api
import com.baseball.game.localBoxScore
import com.baseball.game.localEvents
import com.baseball.game.localGame
import com.baseball.models.BoxScore
import com.baseball.models.Game
import com.baseball.models.PlayEvent
import com.baseball.models.PlayerBattingStats
import com.baseball.models.PlayerPitchingStats
import com.baseball.ui.core.UiConstants
import com.baseball.ui.core.css
import com.baseball.ui.core.launch
import com.baseball.ui.gametracking.scorebook.renderScorebookView
import com.baseball.ui.state.NavTabs
import com.baseball.ui.state.currentTab
import com.baseball.ui.state.isSingleGameMode
import com.baseball.ui.state.renderCurrentTab
import com.baseball.ui.state.selectedGameId
import com.baseball.ui.state.updateActiveTabButtons
import kotlinx.css.Color
import kotlinx.css.Display
import kotlinx.css.TextAlign
import kotlinx.css.color
import kotlinx.css.display
import kotlinx.css.gap
import kotlinx.css.marginBottom
import kotlinx.css.marginTop
import kotlinx.css.padding
import kotlinx.css.rem
import kotlinx.css.textAlign
import kotlinx.html.button
import kotlinx.html.div
import kotlinx.html.dom.append
import kotlinx.html.h2
import kotlinx.html.h3
import kotlinx.html.id
import kotlinx.html.js.h1
import kotlinx.html.js.onClickFunction
import kotlinx.html.p
import org.w3c.dom.HTMLButtonElement
import org.w3c.dom.HTMLDivElement
import org.w3c.dom.HTMLElement

internal fun renderBoxScoreTab(container: HTMLElement) {
    if (!isSingleGameMode && selectedGameId == null) {
        renderNoGameSelected(container)
        return
    }
    launch { setupRenderBoxScoreTab(container) }
}

// Helper (protected for testing)
internal suspend fun setupRenderBoxScoreTab(container: HTMLElement) {
    val (game, boxScore, events) = loadBoxScoreData()
    container.append {
        h1 { +"Game Details - Box Score" }
    }
    renderBoxScoreHeaderCard(container, game)
    renderBoxScoreContent(container, game, boxScore, events)
}

private fun renderBoxScoreContent(
    container: HTMLElement,
    game: Game,
    boxScore: BoxScore,
    events: List<PlayEvent>,
) {
    var btnScorebook: HTMLButtonElement? = null
    var btnTraditional: HTMLButtonElement? = null
    var contentContainer: HTMLDivElement? = null

    val buttonBar = renderBoxScoreToggleButtons(
        container = container,
        onScorebookClick = {
            contentContainer?.innerHTML = ""
            renderScorebookView(contentContainer!!, game, boxScore, events)
            btnScorebook?.classList?.add("btn-primary")
            btnScorebook?.classList?.remove("btn-secondary")
            btnTraditional?.classList?.add("btn-secondary")
            btnTraditional?.classList?.remove("btn-primary")
        },
        onTraditionalClick = {
            contentContainer?.innerHTML = ""
            renderTraditionalBoxScoreView(contentContainer!!, game, boxScore, events)
            btnTraditional?.classList?.add("btn-primary")
            btnTraditional?.classList?.remove("btn-secondary")
            btnScorebook?.classList?.add("btn-secondary")
            btnScorebook?.classList?.remove("btn-primary")
        },
    )

    btnScorebook = buttonBar.querySelector("#boxscore-btn-scorebook") as? HTMLButtonElement
    btnTraditional = buttonBar.querySelector("#boxscore-btn-traditional") as? HTMLButtonElement

    contentContainer = createBoxScoreContentContainer(container)
    contentContainer?.let { renderScorebookView(it, game, boxScore, events) }
}

private fun createBoxScoreContentContainer(container: HTMLElement): HTMLDivElement? {
    container.append {
        div { id = "boxscore-content-view" }
    }
    return container.querySelector("#boxscore-content-view") as? HTMLDivElement
}

private fun renderNoGameSelected(container: HTMLElement) {
    container.append {
        div(classes = "card") {
            css {
                textAlign = TextAlign.center
                padding = UiConstants.CARD_PADDING_LARGE
            }
            p { +"No game selected." }
        }
    }
}

private suspend fun loadBoxScoreData(): Triple<Game, BoxScore, List<PlayEvent>> {
    return if (isSingleGameMode) {
        Triple(localGame!!, localBoxScore!!, localEvents)
    } else {
        val g = api.getGame(selectedGameId!!)
        val b = api.getGameBoxScore(selectedGameId!!)
        val e = api.getGameEvents(selectedGameId!!)
        Triple(g, b, e)
    }
}

private fun renderBoxScoreHeaderCard(container: HTMLElement, game: Game) {
    container.append {
        div(classes = "card") {
            val awayStr = "${game.awayTeam.city} ${game.awayTeam.name} (${game.awayScore})"
            val homeStr = "${game.homeTeam.city} ${game.homeTeam.name} (${game.homeScore})"
            val header = "$awayStr vs $homeStr"
            h2 { +header }
            p {
                +"Status: ${game.status.name} | Date: ${game.date}"
                css {
                    color = Color("var(--text-secondary)")
                    marginBottom = UiConstants.CARD_GAP_XL
                }
            }
            button(classes = "btn btn-secondary") {
                +(if (isSingleGameMode) "Back to Live Scorer" else "Back to Season Dashboard")
                onClickFunction = {
                    currentTab = if (isSingleGameMode) NavTabs.TAB_LIVE_SCORER
                    else NavTabs.TAB_GAMES
                    updateActiveTabButtons()
                    renderCurrentTab()
                }
            }
        }
    }
}

private fun renderBoxScoreToggleButtons(
    container: HTMLElement,
    onScorebookClick: () -> Unit,
    onTraditionalClick: () -> Unit
): HTMLDivElement {
    container.append {
        div {
            id = "boxscore-toggle-container"
            css {
                display = Display.flex
                gap = UiConstants.CARD_GAP
                marginTop = UiConstants.CARD_GAP_XL
                marginBottom = UiConstants.CARD_GAP
            }

            button(classes = "btn btn-primary") {
                id = "boxscore-btn-scorebook"
                +"Scorebook"
                onClickFunction = { onScorebookClick() }
            }

            button(classes = "btn btn-secondary") {
                id = "boxscore-btn-traditional"
                +"Traditional Stats"
                onClickFunction = { onTraditionalClick() }
            }
        }
    }
    return container.querySelector("#boxscore-toggle-container") as HTMLDivElement
}

private fun renderTraditionalBoxScoreView(
    contentEl: HTMLDivElement,
    game: Game,
    boxScore: BoxScore,
    events: List<PlayEvent>
) {
    contentEl.append {
        div(classes = "card") {
            id = "linescore-card"
            h3 { +"Line Score" }
        }
    }
    val lineScoreCard = contentEl.querySelector("#linescore-card") as HTMLDivElement
    renderLineScoreTable(lineScoreCard, boxScore.lineScore, game)

    contentEl.append {
        div(classes = "dashboard-grid") {
            id = "traditional-stats-grid"
            css {
                marginTop = 1.5.rem
            }
        }
    }
    val grid = contentEl.querySelector("#traditional-stats-grid") as HTMLDivElement

    renderTeamTraditionalStats(grid, game.awayTeam.name, boxScore.awayBatting, boxScore.awayPitching)
    renderTeamTraditionalStats(grid, game.homeTeam.name, boxScore.homeBatting, boxScore.homePitching)

    renderGameLogCard(contentEl, events)
}

private fun renderTeamTraditionalStats(
    parent: HTMLDivElement,
    teamName: String,
    batting: List<PlayerBattingStats>,
    pitching: List<PlayerPitchingStats>
) {
    parent.append {
        div(classes = "card") {
            id = "team-stats-card-${teamName.replace(" ", "-")}"
            h3 { +"$teamName Batting" }
        }
    }
    val card = parent.querySelector("#team-stats-card-${teamName.replace(" ", "-")}") as HTMLDivElement
    renderBattingTable(card, batting)

    card.append {
        h3 {
            +"$teamName Pitching"
            css {
                marginTop = UiConstants.CARD_GAP_XL
            }
        }
    }
    renderPitchingTable(card, pitching)
}





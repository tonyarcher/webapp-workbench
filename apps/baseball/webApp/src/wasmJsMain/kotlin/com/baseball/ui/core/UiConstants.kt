package com.baseball.ui.core

import kotlinx.css.Padding
import kotlinx.css.px
import kotlinx.css.rem

/**
 * Centralized UI constants to replace magic numbers and repeated values.
 */
object UiConstants {
    // Padding / margins
    val CARD_PADDING = Padding(0.75.rem)
    val CARD_PADDING_LARGE = Padding(3.rem)
    val CARD_MARGIN_BOTTOM = 2.rem
    val CARD_GAP = 1.rem
    val CARD_GAP_LARGE = 1.5.rem
    val CARD_GAP_XL = 2.rem
    val CARD_BORDER_RADIUS = 8.px
    val CARD_GAP_SMALL = 0.5.rem

    const val MODAL_MAX_WIDTH_PX = 450
    const val EVENT_LOG_MAX_HEIGHT_PX = 350
    const val MODAL_WIDTH_PCT = 90

    // Font sizes
    val FONT_SIZE_SMALL = 0.75.rem
    val FONT_SIZE_MEDIUM = 1.rem
    val FONT_SIZE_LARGE = 1.1.rem

}

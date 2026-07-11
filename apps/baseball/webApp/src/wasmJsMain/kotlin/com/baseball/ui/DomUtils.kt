package com.baseball.ui

import org.w3c.dom.*
import org.w3c.dom.events.Event
import kotlinx.browser.document
import kotlinx.coroutines.*
import org.w3c.dom.css.CSSStyleDeclaration

// DOM Helper functions
internal fun createElement(tag: String, classes: String = "", init: HTMLElement.() -> Unit = {}): HTMLElement {
    val el = document.createElement(tag) as HTMLElement
    if (classes.isNotEmpty()) {
        el.className = classes
    }
    el.init()
    return el
}

internal fun HTMLElement.appendElement(tag: String, classes: String = "", init: HTMLElement.() -> Unit = {}): HTMLElement {
    val el = createElement(tag, classes, init)
    this.appendChild(el)
    return el
}

internal fun HTMLElement.onClick(handler: (Event) -> Unit) {
    this.addEventListener("click", { event ->
        handler(event)
    })
}

// Global Coroutine Scope Helper
internal fun launch(block: suspend () -> Unit) {
    @OptIn(DelicateCoroutinesApi::class)
    GlobalScope.launch(Dispatchers.Main) {
        try {
            block()
        } catch (e: Throwable) {
            println("Coroutine exception: ${e.message}")
            e.printStackTrace()
        }
    }
}

// CSS Property Name Constants
internal object CSSProperties {
    const val DISPLAY = "display"
    const val PADDING = "padding"
    const val MARGIN_TOP = "margin-top"
    const val MARGIN_BOTTOM = "margin-bottom"
    const val FONT_SIZE = "font-size"
    const val FONT_WEIGHT = "font-weight"
    const val POSITION = "position"
    const val BACKGROUND_COLOR = "background-color"
    const val BORDER_BOTTOM = "border-bottom"
    const val BORDER_RIGHT = "border-right"
    const val BORDER_LEFT = "border-left"
    const val BORDER_TOP = "border-top"
    const val Z_INDEX = "z-index"
    const val COLOR = "color"
    const val WIDTH = "width"
    const val HEIGHT = "height"
    const val GAP = "gap"
    const val TEXT_ALIGN = "text-align"
    const val JUSTIFY_CONTENT = "justify-content"
    const val ALIGN_ITEMS = "align-items"
    const val FLEX_DIRECTION = "flex-direction"
    const val FLEX = "flex"
    const val FLEX_WRAP = "flex-wrap"
    const val BORDER_RADIUS = "border-radius"
    const val BOX_SIZING = "box-sizing"
}

// Type-safe CSS property setters
internal fun CSSStyleDeclaration.display(value: String) = setProperty(CSSProperties.DISPLAY, value)
internal fun CSSStyleDeclaration.padding(value: String) = setProperty(CSSProperties.PADDING, value)
internal fun CSSStyleDeclaration.marginTop(value: String) = setProperty(CSSProperties.MARGIN_TOP, value)
internal fun CSSStyleDeclaration.marginBottom(value: String) = setProperty(CSSProperties.MARGIN_BOTTOM, value)
internal fun CSSStyleDeclaration.fontSize(value: String) = setProperty(CSSProperties.FONT_SIZE, value)
internal fun CSSStyleDeclaration.fontWeight(value: String) = setProperty(CSSProperties.FONT_WEIGHT, value)
internal fun CSSStyleDeclaration.position(value: String) = setProperty(CSSProperties.POSITION, value)
internal fun CSSStyleDeclaration.backgroundColor(value: String) = setProperty(CSSProperties.BACKGROUND_COLOR, value)
internal fun CSSStyleDeclaration.borderBottom(value: String) = setProperty(CSSProperties.BORDER_BOTTOM, value)
internal fun CSSStyleDeclaration.borderRight(value: String) = setProperty(CSSProperties.BORDER_RIGHT, value)
internal fun CSSStyleDeclaration.borderLeft(value: String) = setProperty(CSSProperties.BORDER_LEFT, value)
internal fun CSSStyleDeclaration.borderTop(value: String) = setProperty(CSSProperties.BORDER_TOP, value)
internal fun CSSStyleDeclaration.zIndex(value: String) = setProperty(CSSProperties.Z_INDEX, value)
internal fun CSSStyleDeclaration.color(value: String) = setProperty(CSSProperties.COLOR, value)
internal fun CSSStyleDeclaration.width(value: String) = setProperty(CSSProperties.WIDTH, value)
internal fun CSSStyleDeclaration.height(value: String) = setProperty(CSSProperties.HEIGHT, value)
internal fun CSSStyleDeclaration.gap(value: String) = setProperty(CSSProperties.GAP, value)
internal fun CSSStyleDeclaration.textAlign(value: String) = setProperty(CSSProperties.TEXT_ALIGN, value)
internal fun CSSStyleDeclaration.justifyContent(value: String) = setProperty(CSSProperties.JUSTIFY_CONTENT, value)
internal fun CSSStyleDeclaration.alignItems(value: String) = setProperty(CSSProperties.ALIGN_ITEMS, value)
internal fun CSSStyleDeclaration.flexDirection(value: String) = setProperty(CSSProperties.FLEX_DIRECTION, value)
internal fun CSSStyleDeclaration.flex(value: String) = setProperty(CSSProperties.FLEX, value)
internal fun CSSStyleDeclaration.flexWrap(value: String) = setProperty(CSSProperties.FLEX_WRAP, value)
internal fun CSSStyleDeclaration.borderRadius(value: String) = setProperty(CSSProperties.BORDER_RADIUS, value)
internal fun CSSStyleDeclaration.boxSizing(value: String) = setProperty(CSSProperties.BOX_SIZING, value)

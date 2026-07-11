package com.baseball.ui

import org.w3c.dom.*
import org.w3c.dom.events.Event
import kotlinx.browser.document
import kotlinx.coroutines.*
import org.w3c.dom.css.CSSStyleDeclaration
import com.baseball.Constants

// Interface with default methods to be implemented by views/presenters/builders
interface DomBuilder {
    fun createElement(tag: String, classes: String = "", init: HTMLElement.() -> Unit = {}): HTMLElement {
        val el = document.createElement(tag) as HTMLElement
        if (classes.isNotEmpty()) {
            el.className = classes
        }
        el.init()
        return el
    }

    fun HTMLElement.appendElement(tag: String, classes: String = "", init: HTMLElement.() -> Unit = {}): HTMLElement {
        val el = createElement(tag, classes, init)
        this.appendChild(el)
        return el
    }

    fun HTMLElement.onClick(handler: (Event) -> Unit) {
        this.addEventListener("click", { event ->
            handler(event)
        })
    }

    fun launch(block: suspend () -> Unit) {
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

    // Member extension functions for type-safe CSS styling within DomBuilder scope
    fun CSSStyleDeclaration.display(value: String) = setProperty(Constants.Css.DISPLAY, value)
    fun CSSStyleDeclaration.padding(value: String) = setProperty(Constants.Css.PADDING, value)
    fun CSSStyleDeclaration.marginTop(value: String) = setProperty(Constants.Css.MARGIN_TOP, value)
    fun CSSStyleDeclaration.marginBottom(value: String) = setProperty(Constants.Css.MARGIN_BOTTOM, value)
    fun CSSStyleDeclaration.fontSize(value: String) = setProperty(Constants.Css.FONT_SIZE, value)
    fun CSSStyleDeclaration.fontWeight(value: String) = setProperty(Constants.Css.FONT_WEIGHT, value)
    fun CSSStyleDeclaration.position(value: String) = setProperty(Constants.Css.POSITION, value)
    fun CSSStyleDeclaration.backgroundColor(value: String) = setProperty(Constants.Css.BACKGROUND_COLOR, value)
    fun CSSStyleDeclaration.borderBottom(value: String) = setProperty(Constants.Css.BORDER_BOTTOM, value)
    fun CSSStyleDeclaration.borderRight(value: String) = setProperty(Constants.Css.BORDER_RIGHT, value)
    fun CSSStyleDeclaration.borderLeft(value: String) = setProperty(Constants.Css.BORDER_LEFT, value)
    fun CSSStyleDeclaration.borderTop(value: String) = setProperty(Constants.Css.BORDER_TOP, value)
    fun CSSStyleDeclaration.zIndex(value: String) = setProperty(Constants.Css.Z_INDEX, value)
    fun CSSStyleDeclaration.color(value: String) = setProperty(Constants.Css.COLOR, value)
    fun CSSStyleDeclaration.width(value: String) = setProperty(Constants.Css.WIDTH, value)
    fun CSSStyleDeclaration.height(value: String) = setProperty(Constants.Css.HEIGHT, value)
    fun CSSStyleDeclaration.gap(value: String) = setProperty(Constants.Css.GAP, value)
    fun CSSStyleDeclaration.textAlign(value: String) = setProperty(Constants.Css.TEXT_ALIGN, value)
    fun CSSStyleDeclaration.justifyContent(value: String) = setProperty(Constants.Css.JUSTIFY_CONTENT, value)
    fun CSSStyleDeclaration.alignItems(value: String) = setProperty(Constants.Css.ALIGN_ITEMS, value)
    fun CSSStyleDeclaration.flexDirection(value: String) = setProperty(Constants.Css.FLEX_DIRECTION, value)
    fun CSSStyleDeclaration.flex(value: String) = setProperty(Constants.Css.FLEX, value)
    fun CSSStyleDeclaration.borderRadius(value: String) = setProperty(Constants.Css.BORDER_RADIUS, value)
    fun CSSStyleDeclaration.boxSizing(value: String) = setProperty(Constants.Css.BOX_SIZING, value)
}

// Package-level instance for backward compatibility and direct import access
private object DefaultDomBuilder : DomBuilder

internal fun createElement(tag: String, classes: String = "", init: HTMLElement.() -> Unit = {}): HTMLElement =
    DefaultDomBuilder.createElement(tag, classes, init)

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

internal fun launch(block: suspend () -> Unit) = DefaultDomBuilder.launch(block)

// Top-level extensions to ensure style properties remain accessible globally
internal fun CSSStyleDeclaration.display(value: String) = setProperty(Constants.Css.DISPLAY, value)
internal fun CSSStyleDeclaration.padding(value: String) = setProperty(Constants.Css.PADDING, value)
internal fun CSSStyleDeclaration.marginTop(value: String) = setProperty(Constants.Css.MARGIN_TOP, value)
internal fun CSSStyleDeclaration.marginBottom(value: String) = setProperty(Constants.Css.MARGIN_BOTTOM, value)
internal fun CSSStyleDeclaration.fontSize(value: String) = setProperty(Constants.Css.FONT_SIZE, value)
internal fun CSSStyleDeclaration.fontWeight(value: String) = setProperty(Constants.Css.FONT_WEIGHT, value)
internal fun CSSStyleDeclaration.position(value: String) = setProperty(Constants.Css.POSITION, value)
internal fun CSSStyleDeclaration.backgroundColor(value: String) = setProperty(Constants.Css.BACKGROUND_COLOR, value)
internal fun CSSStyleDeclaration.borderBottom(value: String) = setProperty(Constants.Css.BORDER_BOTTOM, value)
internal fun CSSStyleDeclaration.borderRight(value: String) = setProperty(Constants.Css.BORDER_RIGHT, value)
internal fun CSSStyleDeclaration.borderLeft(value: String) = setProperty(Constants.Css.BORDER_LEFT, value)
internal fun CSSStyleDeclaration.borderTop(value: String) = setProperty(Constants.Css.BORDER_TOP, value)
internal fun CSSStyleDeclaration.zIndex(value: String) = setProperty(Constants.Css.Z_INDEX, value)
internal fun CSSStyleDeclaration.color(value: String) = setProperty(Constants.Css.COLOR, value)
internal fun CSSStyleDeclaration.width(value: String) = setProperty(Constants.Css.WIDTH, value)
internal fun CSSStyleDeclaration.height(value: String) = setProperty(Constants.Css.HEIGHT, value)
internal fun CSSStyleDeclaration.gap(value: String) = setProperty(Constants.Css.GAP, value)
internal fun CSSStyleDeclaration.textAlign(value: String) = setProperty(Constants.Css.TEXT_ALIGN, value)
internal fun CSSStyleDeclaration.justifyContent(value: String) = setProperty(Constants.Css.JUSTIFY_CONTENT, value)
internal fun CSSStyleDeclaration.alignItems(value: String) = setProperty(Constants.Css.ALIGN_ITEMS, value)
internal fun CSSStyleDeclaration.flexDirection(value: String) = setProperty(Constants.Css.FLEX_DIRECTION, value)
internal fun CSSStyleDeclaration.flex(value: String) = setProperty(Constants.Css.FLEX, value)
internal fun CSSStyleDeclaration.borderRadius(value: String) = setProperty(Constants.Css.BORDER_RADIUS, value)
internal fun CSSStyleDeclaration.boxSizing(value: String) = setProperty(Constants.Css.BOX_SIZING, value)

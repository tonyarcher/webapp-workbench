package com.baseball.ui

import com.baseball.UiConstants

import org.w3c.dom.*
import org.w3c.dom.events.Event
import kotlinx.browser.document
import kotlinx.coroutines.*
import org.w3c.dom.css.CSSStyleDeclaration
import kotlinx.html.*
import kotlinx.html.dom.*

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
    fun CSSStyleDeclaration.display(value: String) = setProperty(UiConstants.Css.DISPLAY, value)
    fun CSSStyleDeclaration.padding(value: String) = setProperty(UiConstants.Css.PADDING, value)
    fun CSSStyleDeclaration.marginTop(value: String) = setProperty(UiConstants.Css.MARGIN_TOP, value)
    fun CSSStyleDeclaration.marginBottom(value: String) = setProperty(UiConstants.Css.MARGIN_BOTTOM, value)
    fun CSSStyleDeclaration.fontSize(value: String) = setProperty(UiConstants.Css.FONT_SIZE, value)
    fun CSSStyleDeclaration.fontWeight(value: String) = setProperty(UiConstants.Css.FONT_WEIGHT, value)
    fun CSSStyleDeclaration.position(value: String) = setProperty(UiConstants.Css.POSITION, value)
    fun CSSStyleDeclaration.backgroundColor(value: String) = setProperty(UiConstants.Css.BACKGROUND_COLOR, value)
    fun CSSStyleDeclaration.borderBottom(value: String) = setProperty(UiConstants.Css.BORDER_BOTTOM, value)
    fun CSSStyleDeclaration.borderRight(value: String) = setProperty(UiConstants.Css.BORDER_RIGHT, value)
    fun CSSStyleDeclaration.borderLeft(value: String) = setProperty(UiConstants.Css.BORDER_LEFT, value)
    fun CSSStyleDeclaration.borderTop(value: String) = setProperty(UiConstants.Css.BORDER_TOP, value)
    fun CSSStyleDeclaration.zIndex(value: String) = setProperty(UiConstants.Css.Z_INDEX, value)
    fun CSSStyleDeclaration.color(value: String) = setProperty(UiConstants.Css.COLOR, value)
    fun CSSStyleDeclaration.width(value: String) = setProperty(UiConstants.Css.WIDTH, value)
    fun CSSStyleDeclaration.height(value: String) = setProperty(UiConstants.Css.HEIGHT, value)
    fun CSSStyleDeclaration.gap(value: String) = setProperty(UiConstants.Css.GAP, value)
    fun CSSStyleDeclaration.textAlign(value: String) = setProperty(UiConstants.Css.TEXT_ALIGN, value)
    fun CSSStyleDeclaration.justifyContent(value: String) = setProperty(UiConstants.Css.JUSTIFY_CONTENT, value)
    fun CSSStyleDeclaration.alignItems(value: String) = setProperty(UiConstants.Css.ALIGN_ITEMS, value)
    fun CSSStyleDeclaration.flexDirection(value: String) = setProperty(UiConstants.Css.FLEX_DIRECTION, value)
    fun CSSStyleDeclaration.flex(value: String) = setProperty(UiConstants.Css.FLEX, value)
    fun CSSStyleDeclaration.borderRadius(value: String) = setProperty(UiConstants.Css.BORDER_RADIUS, value)
    fun CSSStyleDeclaration.boxSizing(value: String) = setProperty(UiConstants.Css.BOX_SIZING, value)
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
internal fun CSSStyleDeclaration.display(value: String) = setProperty(UiConstants.Css.DISPLAY, value)
internal fun CSSStyleDeclaration.padding(value: String) = setProperty(UiConstants.Css.PADDING, value)
internal fun CSSStyleDeclaration.marginTop(value: String) = setProperty(UiConstants.Css.MARGIN_TOP, value)
internal fun CSSStyleDeclaration.marginBottom(value: String) = setProperty(UiConstants.Css.MARGIN_BOTTOM, value)
internal fun CSSStyleDeclaration.fontSize(value: String) = setProperty(UiConstants.Css.FONT_SIZE, value)
internal fun CSSStyleDeclaration.fontWeight(value: String) = setProperty(UiConstants.Css.FONT_WEIGHT, value)
internal fun CSSStyleDeclaration.position(value: String) = setProperty(UiConstants.Css.POSITION, value)
internal fun CSSStyleDeclaration.backgroundColor(value: String) = setProperty(UiConstants.Css.BACKGROUND_COLOR, value)
internal fun CSSStyleDeclaration.borderBottom(value: String) = setProperty(UiConstants.Css.BORDER_BOTTOM, value)
internal fun CSSStyleDeclaration.borderRight(value: String) = setProperty(UiConstants.Css.BORDER_RIGHT, value)
internal fun CSSStyleDeclaration.borderLeft(value: String) = setProperty(UiConstants.Css.BORDER_LEFT, value)
internal fun CSSStyleDeclaration.borderTop(value: String) = setProperty(UiConstants.Css.BORDER_TOP, value)
internal fun CSSStyleDeclaration.zIndex(value: String) = setProperty(UiConstants.Css.Z_INDEX, value)
internal fun CSSStyleDeclaration.color(value: String) = setProperty(UiConstants.Css.COLOR, value)
internal fun CSSStyleDeclaration.width(value: String) = setProperty(UiConstants.Css.WIDTH, value)
internal fun CSSStyleDeclaration.height(value: String) = setProperty(UiConstants.Css.HEIGHT, value)
internal fun CSSStyleDeclaration.gap(value: String) = setProperty(UiConstants.Css.GAP, value)
internal fun CSSStyleDeclaration.textAlign(value: String) = setProperty(UiConstants.Css.TEXT_ALIGN, value)
internal fun CSSStyleDeclaration.justifyContent(value: String) = setProperty(UiConstants.Css.JUSTIFY_CONTENT, value)
internal fun CSSStyleDeclaration.alignItems(value: String) = setProperty(UiConstants.Css.ALIGN_ITEMS, value)
internal fun CSSStyleDeclaration.flexDirection(value: String) = setProperty(UiConstants.Css.FLEX_DIRECTION, value)
internal fun CSSStyleDeclaration.flex(value: String) = setProperty(UiConstants.Css.FLEX, value)
internal fun CSSStyleDeclaration.borderRadius(value: String) = setProperty(UiConstants.Css.BORDER_RADIUS, value)
internal fun CSSStyleDeclaration.boxSizing(value: String) = setProperty(UiConstants.Css.BOX_SIZING, value)

fun HTMLElement.div(classes: String? = null, block: DIV.() -> Unit = {}): HTMLDivElement = this.append.div(classes = classes, block = block) as HTMLDivElement
fun HTMLElement.span(classes: String? = null, block: SPAN.() -> Unit = {}): HTMLSpanElement = this.append.span(classes = classes, block = block) as HTMLSpanElement
fun HTMLElement.button(classes: String? = null, block: BUTTON.() -> Unit = {}): HTMLButtonElement = this.append.button(classes = classes, block = block) as HTMLButtonElement
fun HTMLElement.a(classes: String? = null, block: A.() -> Unit = {}): HTMLAnchorElement = this.append.a(classes = classes, block = block) as HTMLAnchorElement
fun HTMLElement.p(classes: String? = null, block: P.() -> Unit = {}): HTMLParagraphElement = this.append.p(classes = classes, block = block) as HTMLParagraphElement
fun HTMLElement.h1(classes: String? = null, block: H1.() -> Unit = {}): HTMLHeadingElement = this.append.h1(classes = classes, block = block) as HTMLHeadingElement
fun HTMLElement.h2(classes: String? = null, block: H2.() -> Unit = {}): HTMLHeadingElement = this.append.h2(classes = classes, block = block) as HTMLHeadingElement
fun HTMLElement.h3(classes: String? = null, block: H3.() -> Unit = {}): HTMLHeadingElement = this.append.h3(classes = classes, block = block) as HTMLHeadingElement
fun HTMLElement.h4(classes: String? = null, block: H4.() -> Unit = {}): HTMLHeadingElement = this.append.h4(classes = classes, block = block) as HTMLHeadingElement
fun HTMLElement.table(classes: String? = null, block: TABLE.() -> Unit = {}): HTMLTableElement = this.append.table(classes = classes, block = block) as HTMLTableElement
fun HTMLElement.thead(classes: String? = null, block: THEAD.() -> Unit = {}): HTMLTableSectionElement = this.append.thead(classes = classes, block = block) as HTMLTableSectionElement
fun HTMLElement.tbody(classes: String? = null, block: TBODY.() -> Unit = {}): HTMLTableSectionElement = this.append.tbody(classes = classes, block = block) as HTMLTableSectionElement
fun HTMLElement.tr(classes: String? = null, block: TR.() -> Unit = {}): HTMLTableRowElement = this.append.tr(classes = classes, block = block) as HTMLTableRowElement
fun HTMLElement.th(classes: String? = null, block: TH.() -> Unit = {}): HTMLTableCellElement = this.append.th(classes = classes, block = block) as HTMLTableCellElement
fun HTMLElement.td(classes: String? = null, block: TD.() -> Unit = {}): HTMLTableCellElement = this.append.td(classes = classes, block = block) as HTMLTableCellElement
fun HTMLElement.select(classes: String? = null, block: SELECT.() -> Unit = {}): HTMLSelectElement = this.append.select(classes = classes, block = block) as HTMLSelectElement
fun HTMLElement.option(classes: String? = null, block: OPTION.() -> Unit = {}): HTMLOptionElement = this.append.option(classes = classes, block = block) as HTMLOptionElement
fun HTMLElement.input(type: InputType? = null, classes: String? = null, block: INPUT.() -> Unit = {}): HTMLInputElement = this.append.input(type = type, classes = classes, block = block) as HTMLInputElement
fun HTMLElement.label(classes: String? = null, block: LABEL.() -> Unit = {}): HTMLLabelElement = this.append.label(classes = classes, block = block) as HTMLLabelElement
fun HTMLElement.header(classes: String? = null, block: HEADER.() -> Unit = {}): HTMLElement = this.append.header(classes = classes, block = block) as HTMLElement
fun HTMLElement.nav(classes: String? = null, block: NAV.() -> Unit = {}): HTMLElement = this.append.nav(classes = classes, block = block) as HTMLElement
fun HTMLElement.main(classes: String? = null, block: MAIN.() -> Unit = {}): HTMLElement = this.append.main(classes = classes, block = block) as HTMLElement
fun HTMLElement.form(classes: String? = null, block: FORM.() -> Unit = {}): HTMLFormElement = this.append.form(classes = classes, block = block) as HTMLFormElement
fun HTMLElement.strong(classes: String? = null, block: STRONG.() -> Unit = {}): HTMLElement = this.append.strong(classes = classes, block = block) as HTMLElement
fun HTMLElement.hr(classes: String? = null, block: HR.() -> Unit = {}): HTMLHRElement = this.append.hr(classes = classes, block = block) as HTMLHRElement
fun HTMLElement.textarea(classes: String? = null, block: TEXTAREA.() -> Unit = {}): HTMLTextAreaElement = this.append.textArea(classes = classes, block = block) as HTMLTextAreaElement


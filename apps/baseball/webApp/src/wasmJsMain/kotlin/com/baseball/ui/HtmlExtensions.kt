package com.baseball.ui

import kotlinx.html.*
import kotlinx.html.dom.append
import org.w3c.dom.*

fun HTMLElement.div(classes: String? = null, block: DIV.() -> Unit = {}): HTMLDivElement = this.append.div(classes = classes, block = block) as HTMLDivElement
fun HTMLElement.span(classes: String? = null, block: SPAN.() -> Unit = {}): HTMLSpanElement = this.append.span(classes = classes, block = block) as HTMLSpanElement
fun HTMLElement.button(classes: String? = null, block: BUTTON.() -> Unit = {}): HTMLButtonElement = this.append.button(classes = classes, block = block) as HTMLButtonElement
fun HTMLElement.p(classes: String? = null, block: P.() -> Unit = {}): HTMLParagraphElement = this.append.p(classes = classes, block = block) as HTMLParagraphElement
fun HTMLElement.h1(classes: String? = null, block: H1.() -> Unit = {}): HTMLHeadingElement = this.append.h1(classes = classes, block = block) as HTMLHeadingElement
fun HTMLElement.h2(classes: String? = null, block: H2.() -> Unit = {}): HTMLHeadingElement = this.append.h2(classes = classes, block = block) as HTMLHeadingElement
fun HTMLElement.h3(classes: String? = null, block: H3.() -> Unit = {}): HTMLHeadingElement = this.append.h3(classes = classes, block = block) as HTMLHeadingElement
fun HTMLElement.table(classes: String? = null, block: TABLE.() -> Unit = {}): HTMLTableElement = this.append.table(classes = classes, block = block) as HTMLTableElement
fun HTMLElement.thead(classes: String? = null, block: THEAD.() -> Unit = {}): HTMLTableSectionElement = this.append.thead(classes = classes, block = block) as HTMLTableSectionElement
fun HTMLElement.tbody(classes: String? = null, block: TBODY.() -> Unit = {}): HTMLTableSectionElement = this.append.tbody(classes = classes, block = block) as HTMLTableSectionElement
fun HTMLElement.tr(classes: String? = null, block: TR.() -> Unit = {}): HTMLTableRowElement = this.append.tr(classes = classes, block = block) as HTMLTableRowElement
fun HTMLElement.th(classes: String? = null, block: TH.() -> Unit = {}): HTMLTableCellElement = this.append.th(classes = classes, block = block) as HTMLTableCellElement
fun HTMLElement.td(classes: String? = null, block: TD.() -> Unit = {}): HTMLTableCellElement = this.append.td(classes = classes, block = block) as HTMLTableCellElement
fun HTMLElement.select(classes: String? = null, block: SELECT.() -> Unit = {}): HTMLSelectElement = this.append.select(classes = classes, block = block) as HTMLSelectElement
fun HTMLElement.label(classes: String? = null, block: LABEL.() -> Unit = {}): HTMLLabelElement = this.append.label(classes = classes, block = block) as HTMLLabelElement
fun HTMLElement.header(classes: String? = null, block: HEADER.() -> Unit = {}): HTMLElement = this.append.header(classes = classes, block = block) as HTMLElement
fun HTMLElement.main(classes: String? = null, block: MAIN.() -> Unit = {}): HTMLElement = this.append.main(classes = classes, block = block) as HTMLElement

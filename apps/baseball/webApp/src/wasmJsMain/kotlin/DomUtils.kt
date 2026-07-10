package com.baseball

import org.w3c.dom.*
import org.w3c.dom.events.Event
import kotlinx.browser.document
import kotlinx.coroutines.*

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

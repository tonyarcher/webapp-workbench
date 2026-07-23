

package com.baseball.ui

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

val uiScope = CoroutineScope(Dispatchers.Main)

internal fun launch(block: suspend () -> Unit) {
    uiScope.launch {
        block()
    }
}

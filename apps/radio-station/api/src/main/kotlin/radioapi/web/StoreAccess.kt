package radioapi.web

import org.springframework.beans.factory.ObjectProvider
import org.springframework.http.HttpStatus
import radioapi.service.PlaylistWriter

fun ObjectProvider<PlaylistWriter>.orOffline(): PlaylistWriter =
    ifAvailable ?: throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "database offline")

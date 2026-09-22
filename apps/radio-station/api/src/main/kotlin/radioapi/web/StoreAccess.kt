package radioapi.web

import org.springframework.beans.factory.ObjectProvider
import radioapi.service.PlaylistWriter

fun ObjectProvider<PlaylistWriter>.orOffline(): PlaylistWriter =
    ifAvailable ?: throw ApiException(503, "database offline")

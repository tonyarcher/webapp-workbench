package radioapi.web

import org.springframework.beans.factory.ObjectProvider
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import radioapi.service.PlaylistWriter
import radioapi.service.StationRow

@RestController
class StationController(private val writers: ObjectProvider<PlaylistWriter>) {
    @GetMapping("/stations", headers = ["X-Api-Version=1"])
    fun stations(): List<StationRow> = writers.orOffline().stations()
}

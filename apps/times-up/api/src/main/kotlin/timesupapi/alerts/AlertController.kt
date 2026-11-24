package timesupapi.alerts

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import timesupapi.platform.IdentityUser

data class AlertListJson(val alerts: List<AlertGroup>)

/** Keyword alerts: saved searches promoted by the reader, matched on metadata. */
@RestController
class AlertController(private val user: IdentityUser, private val service: AlertService) {
    @GetMapping("/alerts", headers = ["X-Api-Version=1"])
    fun list(): AlertListJson = AlertListJson(service.forUser(user.id))
}

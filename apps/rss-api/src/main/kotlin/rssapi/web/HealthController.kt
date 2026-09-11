package rssapi.web

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

data class HealthBody(val ok: Boolean)

@RestController
class HealthController {
    @GetMapping("/healthz")
    fun healthz(): HealthBody = HealthBody(ok = true)

    @GetMapping("/readyz")
    fun readyz(): HealthBody = HealthBody(ok = true)
}

package timesupapi.interests

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import timesupapi.platform.IdentityUser

data class InterestExportJson(val version: Int = 1, val interests: List<InterestJson>)

@RestController
class InterestExportController(private val user: IdentityUser, private val service: InterestService) {
    @GetMapping("/interests/export", headers = ["X-Api-Version=1"])
    fun export(): InterestExportJson = InterestExportJson(
        interests = service.list(user.id).map {
            InterestJson(it.id.toString(), it.kind, it.label, it.key, it.weight, it.origin, it.enabled)
        },
    )
}

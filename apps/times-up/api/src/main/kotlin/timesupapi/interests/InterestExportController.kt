package timesupapi.interests

import org.springframework.http.MediaType
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

    @GetMapping("/interests/export.txt", headers = ["X-Api-Version=1"], produces = [MediaType.TEXT_PLAIN_VALUE])
    fun exportText(): String =
        service.list(user.id).joinToString("\n") { "${it.kind}\t${it.label}\t${it.key}\t${it.weight}" }
}

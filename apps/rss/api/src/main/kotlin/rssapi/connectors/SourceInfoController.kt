package rssapi.connectors
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController
import rssapi.platform.IdentityUser

@RestController
class SourceInfoController(private val user: IdentityUser, private val sourceInfo: SourceInfoService) {
    @GetMapping("/feeds/{feedId}/source", headers = ["X-Api-Version=1"])
    fun source(@PathVariable feedId: String): SourceInfo = sourceInfo.info(user.id, feedId)
}

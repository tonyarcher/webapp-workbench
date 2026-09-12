package rssapi.web

import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

@RestController
class MigrateController(
    private val user: IdentityUser,
    private val migrate: MigrateService,
) {
    @PostMapping("/migrate/library")
    fun migrate(@RequestBody(required = false) body: MigrateBody?): MigrateResult {
        if (body == null) throw ApiException(400, "Request body is required")
        return migrate.run(user.id, body)
    }
}

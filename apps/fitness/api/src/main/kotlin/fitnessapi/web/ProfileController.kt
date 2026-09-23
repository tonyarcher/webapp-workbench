package fitnessapi.web

import fitnessapi.LOCAL_USER_ID
import fitnessapi.domain.parseProfile
import fitnessapi.store.ProfileStore
import org.springframework.beans.factory.ObjectProvider
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import tools.jackson.databind.JsonNode

@RestController
class ProfileController(private val profiles: ObjectProvider<ProfileStore>) {
    @GetMapping("/profile", headers = ["X-Api-Version=1"])
    fun get(): ProfileJson = profiles.orOffline().getProfile(LOCAL_USER_ID).toJson()

    @PutMapping("/profile", headers = ["X-Api-Version=1"])
    fun put(@RequestBody(required = false) body: JsonNode?): ProfileJson {
        if (body == null || body.isNull ||
            body.isMissingNode
        ) {
            throw ApiException(HttpStatus.BAD_REQUEST, "missing body")
        }
        val tm = body.get("tm")
        val profile = parseProfile(
            sex = body.string("sex"),
            birthYear = body.jsonNumber("birthYear"),
            heightM = body.jsonNumber("heightM"),
            displayUnit = body.string("displayUnit"),
            squat = tm?.jsonNumber("squat"),
            bench = tm?.jsonNumber("bench"),
            deadlift = tm?.jsonNumber("deadlift"),
            press = tm?.jsonNumber("press"),
        )
        return profiles.orOffline().putProfile(LOCAL_USER_ID, profile).toJson()
    }
}

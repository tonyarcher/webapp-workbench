package fitnessapi.web

import com.fasterxml.jackson.databind.JsonNode
import org.springframework.beans.factory.ObjectProvider
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import fitnessapi.LOCAL_USER_ID
import fitnessapi.domain.parseProfile
import fitnessapi.store.ProfileStore

@RestController
class ProfileController(private val profiles: ObjectProvider<ProfileStore>) {
    @GetMapping("/profile")
    fun get(): ProfileJson = profiles.orOffline().getProfile(LOCAL_USER_ID).toJson()

    @PutMapping("/profile")
    fun put(@RequestBody(required = false) body: JsonNode?): ProfileJson {
        if (body == null || body.isNull || body.isMissingNode) throw ApiException(400, "missing body")
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

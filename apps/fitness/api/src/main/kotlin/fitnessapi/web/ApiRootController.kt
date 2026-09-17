package fitnessapi.web

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.hateoas.Link
import org.springframework.hateoas.MediaTypes
import org.springframework.hateoas.RepresentationModel
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

class RootLinks : RepresentationModel<RootLinks>()

@Tag(name = "discovery", description = "HAL discovery root")
@RestController
class ApiRootController {
    @Operation(summary = "Discover fitness-api resources (HAL)")
    @GetMapping("/", produces = [MediaTypes.HAL_JSON_VALUE, MediaType.APPLICATION_JSON_VALUE])
    fun root(): RootLinks {
        val model = RootLinks()
        model.add(Link.of("/", "self"))
        model.add(Link.of("/healthz", "health"))
        model.add(Link.of("/readyz", "ready"))
        model.add(Link.of("/profile", "profile"))
        model.add(Link.of("/stats", "stats"))
        model.add(Link.of("/samples", "samples"))
        model.add(Link.of("/samples/latest", "samples-latest"))
        model.add(Link.of("/series", "series"))
        model.add(Link.of("/rollups", "rollups"))
        model.add(Link.of("/v3/api-docs", "api-docs"))
        model.add(Link.of("/swagger-ui.html", "swagger-ui"))
        return model
    }
}

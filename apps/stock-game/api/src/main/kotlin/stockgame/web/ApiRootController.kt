package stockgame.web

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
    @Operation(summary = "Discover stock-game-api resources (HAL)")
    @GetMapping("/", produces = [MediaTypes.HAL_JSON_VALUE, MediaType.APPLICATION_JSON_VALUE])
    fun root(): RootLinks {
        val model = RootLinks()
        model.add(Link.of("/", "self"))
        model.add(Link.of("/healthz", "health"))
        model.add(Link.of("/readyz", "ready"))
        model.add(Link.of("/config", "config"))
        model.add(Link.of("/trades", "trades"))
        model.add(Link.of("/orders", "orders"))
        model.add(Link.of("/holdings", "holdings"))
        model.add(Link.of("/cash", "cash"))
        model.add(Link.of("/portfolio", "portfolio"))
        model.add(Link.of("/quote", "quote"))
        model.add(Link.of("/bars", "bars"))
        model.add(Link.of("/search", "search"))
        model.add(Link.of("/v3/api-docs", "api-docs"))
        model.add(Link.of("/swagger-ui.html", "swagger-ui"))
        return model
    }
}

package stockgame.provider

import com.fasterxml.jackson.databind.JsonNode
import stockgame.domain.ProviderError
import stockgame.domain.SymbolHit

fun parseYahooSearch(json: JsonNode): List<SymbolHit> {
    val quotes = json.path("quotes")
    if (!quotes.isArray) throw ProviderError("Yahoo search returned an unexpected shape")
    return quotes.mapNotNull { hitFrom(it) }
}

private fun hitFrom(q: JsonNode): SymbolHit? {
    val symbol = q.path("symbol").asText("")
    if (symbol.isEmpty()) return null
    return SymbolHit(
        symbol = symbol,
        name = textOr(q, "shortname") ?: textOr(q, "longname") ?: symbol,
        exchange = q.path("exchange").asText(""),
        type = q.path("quoteType").asText("EQUITY"),
    )
}

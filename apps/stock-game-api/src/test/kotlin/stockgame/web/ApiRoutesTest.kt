package stockgame.web

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put

@WebMvcTest
@Import(TestApiConfig::class, RequestIdFilter::class)
class ApiRoutesTest {
    @Autowired
    lateinit var mvc: MockMvc

    @Test
    fun configRoundTrip() {
        val put = mvc.put("/config") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"startingCashCents":1000000,"startDate":1704067200000}"""
        }.andReturn()
        assertEquals(200, put.response.status)
        assertTrue(put.response.contentAsString.contains("1000000"))
        val got = mvc.get("/config").andReturn()
        assertEquals(200, got.response.status)
        assertTrue(got.response.contentAsString.contains("1000000"))
    }

    @Test
    fun tradesRejectInvalid() {
        val res = mvc.post("/trades") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"symbol":"","side":"buy","qty":0,"at":1704067200000}"""
        }.andReturn()
        assertEquals(400, res.response.status)
    }

    @Test
    fun ordersListAndCancel() {
        val placed = mvc.post("/orders") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"symbol":"AAPL","side":"buy","qty":1,"executeAt":4102444800000}"""
        }.andReturn()
        assertEquals(200, placed.response.status)
        val list = mvc.get("/orders").andReturn()
        assertEquals(200, list.response.status)
        assertTrue(list.response.contentAsString.contains("AAPL"))
    }

    @Test
    fun quoteRequiresSymbol() {
        val res = mvc.get("/quote?symbol=").andReturn()
        assertEquals(400, res.response.status)
    }

    @Test
    fun searchRequiresQuery() {
        val res = mvc.get("/search?q=").andReturn()
        assertEquals(400, res.response.status)
    }

    @Test
    fun unknownPath404() {
        val res = mvc.get("/nope").andReturn()
        assertEquals(404, res.response.status)
        assertEquals("""{"error":"not found"}""", res.response.contentAsString)
    }

    @Test
    fun invalidSideIs400() {
        val res = mvc.post("/trades") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"symbol":"AAPL","side":"BUY","qty":1,"at":1704067200000}"""
        }.andReturn()
        assertEquals(400, res.response.status)
    }

    @Test
    fun limitOrderNeedsPrice() {
        val res = mvc.post("/orders") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"symbol":"AAPL","side":"buy","qty":1,"executeAt":4102444800000,"orderType":"limit"}"""
        }.andReturn()
        assertEquals(400, res.response.status)
        assertTrue(res.response.contentAsString.contains("limitPrice"))
    }

    @Test
    fun badQueryParamIs400() {
        val res = mvc.get("/bars?symbol=AAPL&interval=1d&from=abc&to=9").andReturn()
        assertEquals(400, res.response.status)
    }
}

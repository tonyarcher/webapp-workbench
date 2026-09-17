package fitnessapi.web

import com.fasterxml.jackson.databind.ObjectMapper
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class JsonNodeReadsBranchTest {
    private val mapper = ObjectMapper()
    private fun node(json: String) = mapper.readTree(json)

    @Test
    fun stringBranches() {
        assertNull(node("""{}""").string("x"))
        assertEquals("a", node("""{"x":"a"}""").string("x"))
        assertNull(node("""{"x":1}""").string("x"))
    }

    @Test
    fun numberLikeBranches() {
        assertNull(node("""{}""").numberLike("x"))
        assertEquals(1.5, node("""{"x":1.5}""").numberLike("x"))
        assertEquals(2.0, node("""{"x":"2"}""").numberLike("x"))
        assertNull(node("""{"x":"abc"}""").numberLike("x"))
        assertNull(node("""{"x":true}""").numberLike("x"))
    }

    @Test
    fun jsonNumberBranches() {
        assertNull(node("""{}""").jsonNumber("x"))
        assertNull(node("""{"x":"1"}""").jsonNumber("x"))
        assertEquals(3.0, node("""{"x":3}""").jsonNumber("x"))
    }

    @Test
    fun boolBranches() {
        assertNull(node("""{}""").bool("x"))
        assertEquals(true, node("""{"x":true}""").bool("x"))
        assertNull(node("""{"x":"yes"}""").bool("x"))
    }
}

package userapi.http

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.Cookie
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import userapi.web.CSRF_COOKIE
import userapi.web.CSRF_HEADER

const val API_VERSION_HEADER: String = "X-Api-Version"
const val API_VERSION: String = "1"

class TestCookies {
    private val jar = mutableMapOf<String, String>()

    fun capture(result: MvcResult) {
        for (cookie in result.response.cookies) {
            if (cookie.maxAge == 0) jar.remove(cookie.name)
            else jar[cookie.name] = cookie.value
        }
    }

    fun apply(builder: MockHttpServletRequestBuilder): MockHttpServletRequestBuilder {
        if (jar.isNotEmpty()) builder.cookie(*jar.map { Cookie(it.key, it.value) }.toTypedArray())
        return builder
    }

    fun csrf(): String = jar[CSRF_COOKIE] ?: error("missing csrf cookie")

    fun put(name: String, value: String) {
        jar[name] = value
    }
}

fun MockMvc.getWithCookies(cookies: TestCookies, path: String, vararg headers: Pair<String, String>): MvcResult {
    val builder = cookies.apply(get(path))
    builder.header(API_VERSION_HEADER, API_VERSION)
    headers.forEach { (name, value) -> builder.header(name, value) }
    return perform(builder).andReturn().also { cookies.capture(it) }
}

fun MockMvc.postJson(
    cookies: TestCookies,
    path: String,
    csrf: Boolean,
    json: String?,
    vararg headers: Pair<String, String>,
): MvcResult {
    val builder = cookies.apply(post(path))
    builder.header(API_VERSION_HEADER, API_VERSION)
    if (csrf) builder.header(CSRF_HEADER, cookies.csrf())
    builder.contentType(MediaType.APPLICATION_JSON)
    headers.forEach { (name, value) -> builder.header(name, value) }
    if (json != null) builder.content(json)
    return perform(builder).andReturn().also { cookies.capture(it) }
}

fun MockMvc.postForm(
    cookies: TestCookies,
    path: String,
    csrf: Boolean,
    params: Map<String, String>,
): MvcResult {
    val builder = cookies.apply(post(path))
    builder.header(API_VERSION_HEADER, API_VERSION)
    if (csrf) builder.header(CSRF_HEADER, cookies.csrf())
    builder.contentType(MediaType.APPLICATION_FORM_URLENCODED)
    params.forEach { (name, value) -> builder.param(name, value) }
    return perform(builder).andReturn().also { cookies.capture(it) }
}

fun MvcResult.expectStatus(value: Int): MvcResult {
    if (response.status != value) {
        throw AssertionError("expected status $value but was ${response.status}: ${response.contentAsString}")
    }
    return this
}

fun MvcResult.statusIs(value: Int): Boolean = response.status == value

fun MvcResult.bodyText(): String = response.contentAsString

fun MvcResult.csrfToken(mapper: ObjectMapper): String =
    mapper.readTree(bodyText())["csrf"].asText()

fun MvcResult.location(): String = response.getHeader(HttpHeaders.LOCATION).orEmpty()

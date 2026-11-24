package timesupapi.platform

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletRequestWrapper
import java.io.BufferedReader
import java.io.InputStreamReader

internal class BoundedRequestWrapper(private val request: HttpServletRequest, private val maxBytes: Long) :
    HttpServletRequestWrapper(request) {
    override fun getInputStream(): jakarta.servlet.ServletInputStream =
        LimitedServletInputStream(request.inputStream, maxBytes)

    override fun getReader(): BufferedReader =
        BufferedReader(InputStreamReader(inputStream, request.characterEncoding ?: Charsets.UTF_8.name()))
}

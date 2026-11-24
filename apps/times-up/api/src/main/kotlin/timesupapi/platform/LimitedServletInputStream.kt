package timesupapi.platform

import jakarta.servlet.ReadListener
import jakarta.servlet.ServletInputStream

internal class LimitedServletInputStream(private val delegate: ServletInputStream, private val maxBytes: Long) :
    ServletInputStream() {
    private var total = 0L

    override fun read(): Int {
        if (total >= maxBytes) {
            val extra = delegate.read()
            if (extra < 0) return -1
            throw RequestBodyTooLargeException()
        }
        val value = delegate.read()
        if (value >= 0) total++
        return value
    }

    override fun read(b: ByteArray, off: Int, len: Int): Int {
        if (len == 0) return 0
        if (total >= maxBytes) {
            val extra = delegate.read()
            if (extra < 0) return -1
            throw RequestBodyTooLargeException()
        }
        val allowed = minOf(len.toLong(), maxBytes - total).toInt()
        val count = delegate.read(b, off, allowed)
        if (count > 0) total += count
        return count
    }

    override fun skip(n: Long): Long {
        if (n <= 0) return 0
        if (total >= maxBytes) {
            val extra = delegate.read()
            if (extra < 0) return 0
            throw RequestBodyTooLargeException()
        }
        val skipped = delegate.skip(minOf(n, maxBytes - total))
        total += skipped
        return skipped
    }

    override fun available(): Int = delegate.available()

    override fun isFinished(): Boolean = total >= maxBytes && delegate.isFinished()

    override fun isReady(): Boolean = delegate.isReady()

    override fun setReadListener(listener: ReadListener?) = delegate.setReadListener(listener)
}

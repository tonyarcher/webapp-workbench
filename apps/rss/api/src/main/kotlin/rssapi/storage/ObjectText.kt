package rssapi.storage
import java.io.ByteArrayOutputStream
import java.security.MessageDigest
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream

private const val GZIP_MAGIC_0 = 0x1f.toByte()
private const val GZIP_MAGIC_1 = 0x8b.toByte()

/**
 * gzip helpers for object payloads.
 *
 * Objects are stored compressed and served compressed. The browser inflates
 * streamed text itself, so the API only inflates where it must hand JSON to a
 * caller. Encoding is detected from the payload rather than from a column or a
 * key suffix, so objects written before compression existed keep working.
 */
object ObjectText {
    fun isGzip(bytes: ByteArray): Boolean = bytes.size >= 2 && bytes[0] == GZIP_MAGIC_0 && bytes[1] == GZIP_MAGIC_1

    fun gzip(bytes: ByteArray): ByteArray {
        val out = ByteArrayOutputStream(bytes.size / 2 + 64)
        GZIPOutputStream(out).use { it.write(bytes) }
        return out.toByteArray()
    }

    fun gunzip(bytes: ByteArray): ByteArray = if (!isGzip(bytes)) {
        bytes
    } else {
        GZIPInputStream(bytes.inputStream()).use { it.readBytes() }
    }

    fun encode(text: String): ByteArray = gzip(text.toByteArray(Charsets.UTF_8))

    /** Inflates and decodes, or null when the payload is not readable text. */
    fun decode(bytes: ByteArray): String? = runCatching { gunzip(bytes).toString(Charsets.UTF_8) }.getOrNull()

    /** The content-addressed part of an object key, also usable as a fingerprint. */
    fun digestHex(text: String): String = MessageDigest.getInstance("SHA-256")
        .digest(text.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
}

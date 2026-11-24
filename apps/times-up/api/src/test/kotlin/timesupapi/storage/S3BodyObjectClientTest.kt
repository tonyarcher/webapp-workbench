package timesupapi.storage
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import software.amazon.awssdk.core.ResponseInputStream
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.http.AbortableInputStream
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest
import software.amazon.awssdk.services.s3.model.GetObjectRequest
import software.amazon.awssdk.services.s3.model.GetObjectResponse
import software.amazon.awssdk.services.s3.model.NoSuchKeyException
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import software.amazon.awssdk.services.s3.model.S3Exception
import java.io.ByteArrayInputStream

class S3BodyObjectClientTest {
    private val s3: S3Client = mock()
    private val client = S3BodyObjectClient(s3, "bucket")

    @Test
    fun putWritesObject() {
        client.put("k", "hi".toByteArray())

        verify(s3).putObject(any<PutObjectRequest>(), any<RequestBody>())
    }

    @Test
    fun getReturnsBytes() {
        val bytes = "hello".toByteArray()
        val response = ResponseInputStream(
            GetObjectResponse.builder().build(),
            AbortableInputStream.create(ByteArrayInputStream(bytes)),
        )
        whenever(s3.getObject(any<GetObjectRequest>())).thenReturn(response)

        assertArrayEquals(bytes, client.get("k"))
    }

    @Test
    fun getMissingKeyReturnsNull() {
        whenever(s3.getObject(any<GetObjectRequest>())).thenThrow(NoSuchKeyException.builder().build())

        assertNull(client.get("k"))
    }

    @Test
    fun get404S3ExceptionReturnsNull() {
        whenever(s3.getObject(any<GetObjectRequest>())).thenThrow(
            S3Exception.builder().statusCode(404).message("no").build(),
        )

        assertNull(client.get("k"))
    }

    @Test
    fun deleteIgnoresFailure() {
        whenever(s3.deleteObject(any<DeleteObjectRequest>())).thenThrow(RuntimeException("boom"))

        client.delete("k")
    }

    @Test
    fun getNon404S3ExceptionThrows() {
        whenever(s3.getObject(any<GetObjectRequest>())).thenThrow(
            S3Exception.builder().statusCode(500).message("boom").build(),
        )

        org.junit.jupiter.api.Assertions.assertThrows(S3Exception::class.java) { client.get("k") }
    }

    @Test
    fun buildS3ClientCreatesClient() {
        val client = buildS3Client(
            BodyObjectStoreConfig(
                endpoint = "http://localhost:9000",
                region = "us-east-1",
                bucket = "b",
                accessKey = "a",
                secretKey = "s",
            ),
        )
        client.close()
    }

    @Test
    fun buildS3ClientWithDefaults() {
        val client = buildS3Client(BodyObjectStoreConfig(bucket = "b", region = "", endpoint = ""))
        client.close()
    }
}

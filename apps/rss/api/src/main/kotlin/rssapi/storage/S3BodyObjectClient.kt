package rssapi.storage
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest
import software.amazon.awssdk.services.s3.model.GetObjectRequest
import software.amazon.awssdk.services.s3.model.NoSuchKeyException
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import software.amazon.awssdk.services.s3.model.S3Exception
import java.net.URI

private const val NOT_FOUND = 404

class S3BodyObjectClient(private val s3: S3Client, private val bucket: String) : BodyObjectClient {
    override fun put(key: String, bytes: ByteArray) {
        s3.putObject(
            PutObjectRequest.builder().bucket(bucket).key(key).contentType("text/html; charset=utf-8").build(),
            RequestBody.fromBytes(bytes),
        )
    }

    override fun get(key: String): ByteArray? = try {
        s3.getObject(GetObjectRequest.builder().bucket(bucket).key(key).build()).use { it.readAllBytes() }
    } catch (_: NoSuchKeyException) {
        null
    } catch (err: S3Exception) {
        if (err.statusCode() == NOT_FOUND) null else throw err
    }

    override fun delete(key: String) {
        runCatching {
            s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build())
        }
    }
}

fun buildS3Client(config: BodyObjectStoreConfig): S3Client {
    val builder = S3Client.builder()
        .region(Region.of(config.region.ifBlank { "us-east-1" }))
        .forcePathStyle(true)
    if (config.endpoint.isNotBlank()) {
        builder.endpointOverride(URI.create(config.endpoint))
    }
    if (config.accessKey.isNotBlank() || config.secretKey.isNotBlank()) {
        builder.credentialsProvider(
            StaticCredentialsProvider.create(AwsBasicCredentials.create(config.accessKey, config.secretKey)),
        )
    }
    return builder.build()
}

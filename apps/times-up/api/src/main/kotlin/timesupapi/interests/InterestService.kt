package timesupapi.interests

import org.springframework.stereotype.Service
import java.security.MessageDigest
import java.util.UUID

@Service
class InterestService {
    fun import(topics: String, sources: String): ImportResponse {
        val (topicReport, _) = FollowImportParser.parse(topics)
        val (sourceReport, _) = FollowImportParser.parse(sources)
        val fingerprint = sha256(topics + "\n---\n" + sources)
        return ImportResponse(fingerprint, topicReport, sourceReport)
    }

    private fun sha256(s: String): String {
        val md = MessageDigest.getInstance("SHA-256")
        return md.digest(s.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    }
}

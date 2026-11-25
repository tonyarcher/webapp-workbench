package timesupapi.interests

import org.springframework.stereotype.Service

data class InterestHighlight(val articleId: String, val why: String)

@Service
class InterestHighlightService {
    fun why(articleId: String, interest: String): InterestHighlight =
        InterestHighlight(articleId, "Matches interest: $interest")
}

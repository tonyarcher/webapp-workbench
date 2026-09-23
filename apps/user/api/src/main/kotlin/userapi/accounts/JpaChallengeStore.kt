package userapi.accounts

import org.springframework.transaction.annotation.Transactional
import userapi.persist.WebauthnChallengeEntity
import userapi.persist.WebauthnChallengeRepo
import java.time.Instant

open class JpaChallengeStore(private val challenges: WebauthnChallengeRepo) : WebauthnChallengeStore {
    override fun putChallenge(row: WebauthnChallenge, expiresAt: Instant) {
        challenges.save(
            WebauthnChallengeEntity(
                id = row.id,
                kind = row.kind,
                userId = row.userId,
                payload = row.payload,
                expiresAt = expiresAt,
            ),
        )
    }

    @Transactional
    override fun takeChallenge(id: String, now: Instant): WebauthnChallenge? =
        challenges.takeChallenge(id, now)?.toStored()
}

private fun WebauthnChallengeEntity.toStored(): WebauthnChallenge? = WebauthnChallenge(
    id = id,
    kind = kind,
    userId = userId,
    payload = payload,
)

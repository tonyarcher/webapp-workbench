package fitnessapi.http

import fitnessapi.domain.ProfileData
import fitnessapi.domain.emptyProfile
import fitnessapi.store.ProfileStore
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class FakeProfileStore : ProfileStore {
    private val rows = ConcurrentHashMap<UUID, ProfileData>()

    override fun getProfile(userId: UUID): ProfileData = rows[userId] ?: emptyProfile()

    override fun putProfile(userId: UUID, profile: ProfileData): ProfileData {
        rows[userId] = profile
        return profile
    }

    fun clear() {
        rows.clear()
    }
}

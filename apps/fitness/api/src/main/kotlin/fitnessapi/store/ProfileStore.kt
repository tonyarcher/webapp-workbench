package fitnessapi.store

import fitnessapi.domain.ProfileData
import java.util.UUID

interface ProfileStore {
    fun getProfile(userId: UUID): ProfileData
    fun putProfile(userId: UUID, profile: ProfileData): ProfileData
}

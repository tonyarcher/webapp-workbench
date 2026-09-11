package fitnessapi.store

import java.util.UUID
import fitnessapi.domain.ProfileData

interface ProfileStore {
    fun getProfile(userId: UUID): ProfileData
    fun putProfile(userId: UUID, profile: ProfileData): ProfileData
}

package fitnessapi.store

import java.time.Instant
import java.util.UUID
import javax.sql.DataSource
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import fitnessapi.domain.ProfileData
import fitnessapi.domain.emptyProfile
import fitnessapi.persist.ProfileEntity
import fitnessapi.persist.ProfileRepo

@Service
@ConditionalOnBean(DataSource::class)
class JpaProfileStore(private val profiles: ProfileRepo) : ProfileStore {
    override fun getProfile(userId: UUID): ProfileData =
        profiles.findById(userId).orElse(null)?.toData() ?: emptyProfile()

    @Transactional
    override fun putProfile(userId: UUID, profile: ProfileData): ProfileData {
        val row = profiles.findById(userId).orElse(ProfileEntity(userId = userId))
        row.sex = profile.sex
        row.birthYear = profile.birthYear
        row.heightM = profile.heightM?.toFloat()
        row.displayUnit = profile.displayUnit
        row.tmSquatKg = profile.tmSquat?.toFloat()
        row.tmBenchKg = profile.tmBench?.toFloat()
        row.tmDeadliftKg = profile.tmDeadlift?.toFloat()
        row.tmPressKg = profile.tmPress?.toFloat()
        row.updatedAt = Instant.now()
        profiles.save(row)
        return profile
    }
}

private fun ProfileEntity.toData(): ProfileData = ProfileData(
    sex = sex,
    birthYear = birthYear,
    heightM = heightM?.toDouble(),
    displayUnit = if (displayUnit == "lb") "lb" else "kg",
    tmSquat = tmSquatKg?.toDouble(),
    tmBench = tmBenchKg?.toDouble(),
    tmDeadlift = tmDeadliftKg?.toDouble(),
    tmPress = tmPressKg?.toDouble(),
)

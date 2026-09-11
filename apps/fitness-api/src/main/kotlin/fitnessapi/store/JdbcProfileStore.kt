package fitnessapi.store

import java.util.UUID
import javax.sql.DataSource
import fitnessapi.domain.ProfileData
import fitnessapi.domain.emptyProfile

class JdbcProfileStore(private val dataSource: DataSource) : ProfileStore {
    override fun getProfile(userId: UUID): ProfileData = dataSource.withConn { conn ->
        conn.prepareStatement(GET_PROFILE_SQL).use { ps ->
            ps.setObject(1, userId)
            ps.executeQuery().use { rs -> if (rs.next()) readProfile(rs) else emptyProfile() }
        }
    }

    override fun putProfile(userId: UUID, profile: ProfileData): ProfileData {
        dataSource.withConn { conn ->
            conn.prepareStatement(PUT_PROFILE_SQL).use { ps ->
                bindProfile(ps, userId, profile)
                ps.executeUpdate()
            }
        }
        return profile
    }
}

private fun bindProfile(ps: java.sql.PreparedStatement, userId: UUID, profile: ProfileData) {
    ps.setObject(1, userId)
    ps.setString(2, profile.sex)
    ps.setObject(3, profile.birthYear)
    ps.setObject(4, profile.heightM)
    ps.setString(5, profile.displayUnit)
    ps.setObject(6, profile.tmSquat)
    ps.setObject(7, profile.tmBench)
    ps.setObject(8, profile.tmDeadlift)
    ps.setObject(9, profile.tmPress)
}

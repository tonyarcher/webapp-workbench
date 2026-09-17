package fitnessapi.persist

import java.time.Instant
import java.util.UUID
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "profile")
class ProfileEntity(
    @Id
    @Column(name = "user_id")
    var userId: UUID = UUID(0, 0),
    var sex: String? = null,
    @Column(name = "birth_year")
    var birthYear: Int? = null,
    @Column(name = "height_m")
    var heightM: Float? = null,
    @Column(name = "display_unit", nullable = false)
    var displayUnit: String = "kg",
    @Column(name = "tm_squat_kg")
    var tmSquatKg: Float? = null,
    @Column(name = "tm_bench_kg")
    var tmBenchKg: Float? = null,
    @Column(name = "tm_deadlift_kg")
    var tmDeadliftKg: Float? = null,
    @Column(name = "tm_press_kg")
    var tmPressKg: Float? = null,
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now(),
)

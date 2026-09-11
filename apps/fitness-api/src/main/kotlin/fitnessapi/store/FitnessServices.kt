package fitnessapi.store

import java.time.Clock
import javax.sql.DataSource

data class FitnessServices(
    val clock: Clock,
    val profiles: ProfileStore? = null,
    val samples: SampleStore? = null,
)

fun productionFitness(
    dataSource: DataSource?,
    clock: Clock = Clock.systemUTC(),
): FitnessServices {
    if (dataSource == null) return FitnessServices(clock)
    return FitnessServices(
        clock = clock,
        profiles = JdbcProfileStore(dataSource),
        samples = JdbcSampleStore(dataSource),
    )
}

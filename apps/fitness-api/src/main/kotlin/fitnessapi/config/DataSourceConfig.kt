package fitnessapi.config

import javax.sql.DataSource
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Conditional
import org.springframework.context.annotation.Configuration
import fitnessapi.db.dataSource as hikariDataSource
import fitnessapi.db.ensureDatabase

@Configuration
class DataSourceConfig {
    @Bean
    @Conditional(OnDatabaseUrl::class)
    fun dataSource(): DataSource {
        val url = System.getenv("DATABASE_URL").orEmpty()
        ensureDatabase(url)
        return hikariDataSource(url)
    }
}

package stockgame.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Conditional
import org.springframework.context.annotation.Configuration
import stockgame.db.ensureDatabase
import javax.sql.DataSource
import stockgame.db.dataSource as hikariDataSource

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

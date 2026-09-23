package radioapi.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Conditional
import org.springframework.context.annotation.Configuration
import radioapi.db.dataSource
import radioapi.db.ensureDatabase
import javax.sql.DataSource

@Configuration
class DataSourceConfig {
    @Bean
    @Conditional(OnDatabaseUrl::class)
    fun dataSource(): DataSource {
        val url = System.getenv("DATABASE_URL").orEmpty()
        ensureDatabase(url)
        return dataSource(url)
    }
}

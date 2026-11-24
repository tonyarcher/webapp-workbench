package timesupapi.platform
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import timesupapi.platform.db.dataSource
import timesupapi.platform.db.ensureDatabase
import javax.sql.DataSource

@Configuration
class DataSourceConfig {
    @Bean
    fun dataSource(): DataSource {
        val url = System.getenv("DATABASE_URL").orEmpty()
        require(url.isNotBlank()) { "DATABASE_URL required" }
        ensureDatabase(url)
        return dataSource(url)
    }
}

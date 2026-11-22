package rssapi.platform
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import rssapi.platform.db.dataSource
import rssapi.platform.db.ensureDatabase
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

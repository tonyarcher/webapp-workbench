package rssapi.config

import javax.sql.DataSource
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import rssapi.db.dataSource
import rssapi.db.ensureDatabase

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

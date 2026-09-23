package radioapi.config

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import radioapi.service.PlaylistRecords
import radioapi.service.PlaylistWriter
import javax.sql.DataSource

@Configuration
class PlaylistConfig {
    @Bean
    @ConditionalOnBean(DataSource::class)
    fun playlistWriter(records: PlaylistRecords): PlaylistWriter = PlaylistWriter(records)
}

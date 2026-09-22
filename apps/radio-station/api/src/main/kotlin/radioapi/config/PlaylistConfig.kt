package radioapi.config

import javax.sql.DataSource
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import radioapi.service.PlaylistRecords
import radioapi.service.PlaylistWriter

@Configuration
class PlaylistConfig {
    @Bean
    @ConditionalOnBean(DataSource::class)
    fun playlistWriter(records: PlaylistRecords): PlaylistWriter = PlaylistWriter(records)
}

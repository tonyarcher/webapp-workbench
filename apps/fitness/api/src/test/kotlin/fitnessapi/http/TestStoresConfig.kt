package fitnessapi.http

import java.time.Clock
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary

@TestConfiguration
class TestStoresConfig {
    @Bean
    @Primary
    fun clock(): Clock = TEST_CLOCK

    @Bean
    @Primary
    fun profiles(): FakeProfileStore = FakeProfileStore()

    @Bean
    @Primary
    fun samples(): FakeSampleStore = FakeSampleStore()
}

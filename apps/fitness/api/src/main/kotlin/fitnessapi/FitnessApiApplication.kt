package fitnessapi

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration
import org.springframework.boot.runApplication

@SpringBootApplication(exclude = [DataSourceAutoConfiguration::class])
class FitnessApiApplication

fun main(args: Array<String>) {
    runApplication<FitnessApiApplication>(*args)
}

package timesupapi
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@EnableScheduling
class TimesUpApiApplication

fun main(args: Array<String>) {
    runApplication<TimesUpApiApplication>(*args)
}

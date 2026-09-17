package rssapi

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@EnableScheduling
class RssApiApplication

fun main(args: Array<String>) {
    runApplication<RssApiApplication>(*args)
}

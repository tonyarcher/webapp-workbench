package calsync

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class CalendarSyncApplication

fun main(args: Array<String>) {
    runApplication<CalendarSyncApplication>(*args)
}

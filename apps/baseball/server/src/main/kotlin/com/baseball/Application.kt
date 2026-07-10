package com.baseball

import com.baseball.entities.*
import com.baseball.repositories.*
import org.springframework.boot.CommandLineRunner
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.context.annotation.Bean

@SpringBootApplication
class Application {

    @Bean
    fun initData(
        leagueRepository: LeagueRepository,
        seasonRepository: SeasonRepository,
        teamRepository: TeamRepository,
        playerRepository: PlayerRepository
    ) = CommandLineRunner {
        if (leagueRepository.count() == 0L) {
            println("Seeding database with sample baseball league, season, teams, and rosters...")
            
            val league = leagueRepository.save(LeagueEntity(name = "American Baseball League"))
            val season = seasonRepository.save(SeasonEntity(leagueId = league.id!!, name = "2026 Season", year = 2026))
            
            val cubs = teamRepository.save(TeamEntity(name = "Cubs", abbreviation = "CHC", city = "Chicago"))
            val cardinals = teamRepository.save(TeamEntity(name = "Cardinals", abbreviation = "STL", city = "St. Louis"))
            val yankees = teamRepository.save(TeamEntity(name = "Yankees", abbreviation = "NYY", city = "New York"))
            val redsox = teamRepository.save(TeamEntity(name = "Red Sox", abbreviation = "BOS", city = "Boston"))

            // Seed Cubs Roster
            val cubsPlayers = listOf(
                PlayerEntity(teamId = cubs.id, name = "Nico Hoerner", position = "2B", jerseyNumber = 2, battingHand = "R", throwingHand = "R"),
                PlayerEntity(teamId = cubs.id, name = "Dansby Swanson", position = "SS", jerseyNumber = 7, battingHand = "R", throwingHand = "R"),
                PlayerEntity(teamId = cubs.id, name = "Ian Happ", position = "LF", jerseyNumber = 8, battingHand = "L", throwingHand = "R"),
                PlayerEntity(teamId = cubs.id, name = "Cody Bellinger", position = "CF", jerseyNumber = 24, battingHand = "L", throwingHand = "L"),
                PlayerEntity(teamId = cubs.id, name = "Seiya Suzuki", position = "RF", jerseyNumber = 27, battingHand = "R", throwingHand = "R"),
                PlayerEntity(teamId = cubs.id, name = "Michael Busch", position = "1B", jerseyNumber = 29, battingHand = "L", throwingHand = "R"),
                PlayerEntity(teamId = cubs.id, name = "Christopher Morel", position = "3B", jerseyNumber = 19, battingHand = "R", throwingHand = "R"),
                PlayerEntity(teamId = cubs.id, name = "Yan Gomes", position = "C", jerseyNumber = 15, battingHand = "R", throwingHand = "R"),
                PlayerEntity(teamId = cubs.id, name = "Shota Imanaga", position = "P", jerseyNumber = 18, battingHand = "L", throwingHand = "L")
            )
            playerRepository.saveAll(cubsPlayers)

            // Seed Cardinals Roster
            val cardinalsPlayers = listOf(
                PlayerEntity(teamId = cardinals.id, name = "Brendan Donovan", position = "LF", jerseyNumber = 33, battingHand = "L", throwingHand = "R"),
                PlayerEntity(teamId = cardinals.id, name = "Paul Goldschmidt", position = "1B", jerseyNumber = 46, battingHand = "R", throwingHand = "R"),
                PlayerEntity(teamId = cardinals.id, name = "Nolan Arenado", position = "3B", jerseyNumber = 28, battingHand = "R", throwingHand = "R"),
                PlayerEntity(teamId = cardinals.id, name = "Willson Contreras", position = "C", jerseyNumber = 40, battingHand = "R", throwingHand = "R"),
                PlayerEntity(teamId = cardinals.id, name = "Lars Nootbaar", position = "RF", jerseyNumber = 21, battingHand = "L", throwingHand = "R"),
                PlayerEntity(teamId = cardinals.id, name = "Nolan Gorman", position = "2B", jerseyNumber = 24, battingHand = "L", throwingHand = "R"),
                PlayerEntity(teamId = cardinals.id, name = "Masyn Winn", position = "SS", jerseyNumber = 0, battingHand = "R", throwingHand = "R"),
                PlayerEntity(teamId = cardinals.id, name = "Victor Scott II", position = "CF", jerseyNumber = 11, battingHand = "L", throwingHand = "R"),
                PlayerEntity(teamId = cardinals.id, name = "Sonny Gray", position = "P", jerseyNumber = 54, battingHand = "R", throwingHand = "R")
            )
            playerRepository.saveAll(cardinalsPlayers)
            
            println("Seeding completed successfully.")
        }
    }
}

fun main(args: Array<String>) {
    runApplication<Application>(*args)
}

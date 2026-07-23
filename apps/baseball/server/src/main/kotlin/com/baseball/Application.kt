@file:Suppress(
    "LongMethod", "TooGenericExceptionCaught", "SpreadOperator",
    "UnusedPrivateProperty", "MagicNumber", "TooManyFunctions", "MaxLineLength",
)

package com.baseball

import com.baseball.entities.LeagueEntity
import com.baseball.entities.PlayerEntity
import com.baseball.entities.SeasonEntity
import com.baseball.entities.TeamEntity
import com.baseball.repositories.LeagueRepository
import com.baseball.repositories.PlayerRepository
import com.baseball.repositories.SeasonRepository
import com.baseball.repositories.TeamRepository
import com.baseball.seed.SeedData
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
        playerRepository: PlayerRepository,
        jdbcTemplate: org.springframework.jdbc.core.JdbcTemplate,
    ) = CommandLineRunner {
        try {
            jdbcTemplate.execute("ALTER TABLE players ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE")
        } catch (e: Exception) {
            println("Info: Could not run ALTER TABLE statement: ${e.message}")
        }

        if (leagueRepository.count() == 0L) {
            println("Seeding database with sample baseball league, season, teams, and rosters...")

            val league = leagueRepository.save(LeagueEntity(name = SeedData.league.name))
            val season =
                seasonRepository.save(
                    SeasonEntity(leagueId = league.id!!, name = SeedData.season.name, year = SeedData.season.year),
                )

            val cubs =
                teamRepository.save(
                    TeamEntity(
                        name = SeedData.teamCubs.name,
                        abbreviation = SeedData.teamCubs.abbreviation,
                        city = SeedData.teamCubs.city,
                    ),
                )
            val cardinals =
                teamRepository.save(
                    TeamEntity(
                        name = SeedData.teamCardinals.name,
                        abbreviation = SeedData.teamCardinals.abbreviation,
                        city = SeedData.teamCardinals.city,
                    ),
                )
            val yankees =
                teamRepository.save(
                    TeamEntity(
                        name = SeedData.teamYankees.name,
                        abbreviation = SeedData.teamYankees.abbreviation,
                        city = SeedData.teamYankees.city,
                    ),
                )
            val redsox =
                teamRepository.save(
                    TeamEntity(
                        name = SeedData.teamRedSox.name,
                        abbreviation = SeedData.teamRedSox.abbreviation,
                        city = SeedData.teamRedSox.city,
                    ),
                )

            // Seed Cubs Roster
            val cubsPlayers =
                SeedData.cubsRoster.map {
                    PlayerEntity(
                        teamId = cubs.id,
                        name = it.name,
                        position = it.position,
                        jerseyNumber = it.jerseyNumber,
                        battingHand = it.battingHand,
                        throwingHand = it.throwingHand,
                    )
                }
            playerRepository.saveAll(cubsPlayers)

            // Seed Cardinals Roster
            val cardinalsPlayers =
                SeedData.cardinalsRoster.map {
                    PlayerEntity(
                        teamId = cardinals.id,
                        name = it.name,
                        position = it.position,
                        jerseyNumber = it.jerseyNumber,
                        battingHand = it.battingHand,
                        throwingHand = it.throwingHand,
                    )
                }
            playerRepository.saveAll(cardinalsPlayers)

            println("Seeding completed successfully.")
        }
    }
}

fun main(args: Array<String>) {
    runApplication<Application>(*args)
}

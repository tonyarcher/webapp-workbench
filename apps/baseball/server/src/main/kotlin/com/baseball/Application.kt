package com.baseball

import com.baseball.entities.LeagueEntity
import com.baseball.entities.PlayerEntity
import com.baseball.entities.SeasonEntity
import com.baseball.entities.TeamEntity
import com.baseball.models.Player
import com.baseball.models.Team
import com.baseball.repositories.LeagueRepository
import com.baseball.repositories.PlayerRepository
import com.baseball.repositories.SeasonRepository
import com.baseball.repositories.TeamRepository
import com.baseball.seed.SeedData
import org.springframework.boot.CommandLineRunner
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.context.annotation.Bean
import org.springframework.jdbc.core.JdbcTemplate
import java.sql.SQLException

data class SeedingRepositories(
    val leagueRepo: LeagueRepository,
    val seasonRepo: SeasonRepository,
    val teamRepo: TeamRepository,
    val playerRepo: PlayerRepository,
)

@SpringBootApplication
class Application {
    @Bean
    fun initData(
        leagueRepository: LeagueRepository,
        seasonRepository: SeasonRepository,
        teamRepository: TeamRepository,
        playerRepository: PlayerRepository,
        jdbcTemplate: JdbcTemplate,
    ) = CommandLineRunner {
        ensureSchema(jdbcTemplate)
        val repos = SeedingRepositories(
            leagueRepository, seasonRepository, teamRepository, playerRepository
        )
        if (leagueRepository.count() == 0L) {
            seedDatabase(repos)
        }
    }

    private fun ensureSchema(jdbcTemplate: JdbcTemplate) {
        try {
            jdbcTemplate.execute("ALTER TABLE players ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE")
        } catch (e: SQLException) {
            println("Info: Could not run ALTER TABLE statement: ${e.message}")
        }
    }

    private fun seedDatabase(repos: SeedingRepositories) {
        println("Seeding database with sample baseball league, season, teams, and rosters...")
        val league = repos.leagueRepo.save(LeagueEntity(name = SeedData.league.name))
        repos.seasonRepo.save(
            SeasonEntity(
                leagueId = league.id!!, name = SeedData.season.name, year = SeedData.season.year
            )
        )

        val cubs = saveTeam(repos.teamRepo, SeedData.teamCubs)
        val cardinals = saveTeam(repos.teamRepo, SeedData.teamCardinals)
        saveTeam(repos.teamRepo, SeedData.teamYankees)
        saveTeam(repos.teamRepo, SeedData.teamRedSox)

        seedRoster(repos.playerRepo, cubs.id, SeedData.cubsRoster)
        seedRoster(repos.playerRepo, cardinals.id, SeedData.cardinalsRoster)
        println("Seeding completed successfully.")
    }

    private fun saveTeam(repository: TeamRepository, team: Team): TeamEntity {
        return repository.save(
            TeamEntity(name = team.name, abbreviation = team.abbreviation, city = team.city)
        )
    }

    private fun seedRoster(repository: PlayerRepository, teamId: Long?, roster: List<Player>) {
        val entities = roster.map { p ->
            PlayerEntity(
                name = p.name, position = p.position, teamId = teamId,
                jerseyNumber = p.jerseyNumber, battingHand = p.battingHand
            ).apply { throwingHand = p.throwingHand }
        }
        repository.saveAll(entities)
    }
}

fun main(args: Array<String>) {
    if (args.isEmpty()) {
        runApplication<Application>()
    } else {
        runApplication<Application>(args[0])
    }
}

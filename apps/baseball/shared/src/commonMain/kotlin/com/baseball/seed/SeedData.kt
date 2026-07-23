@file:Suppress("MagicNumber", "TooManyFunctions")

package com.baseball.seed

import com.baseball.models.League
import com.baseball.models.Player
import com.baseball.models.Season
import com.baseball.models.Team

object SeedData {
    val league = League(1L, "American Baseball League")
    val season = Season(1L, 1L, "2026 Season", 2026)

    val teamCubs = Team(1L, "Cubs", "CHC", "Chicago")
    val teamCardinals = Team(2L, "Cardinals", "STL", "St. Louis")
    val teamYankees = Team(3L, "Yankees", "NYY", "New York")
    val teamRedSox = Team(4L, "Red Sox", "BOS", "Boston")

    val cubsRoster =
        listOf(
            Player(101L, 1L, "Nico Hoerner", "2B", 2, "R", "R"),
            Player(102L, 1L, "Dansby Swanson", "SS", 7, "R", "R"),
            Player(103L, 1L, "Seiya Suzuki", "RF", 27, "R", "R"),
            Player(104L, 1L, "Cody Bellinger", "CF", 24, "L", "L"),
            Player(105L, 1L, "Christopher Morel", "DH", 19, "R", "R"),
            Player(106L, 1L, "Ian Happ", "LF", 94, "S", "R"),
            Player(107L, 1L, "Michael Busch", "1B", 29, "L", "R"),
            Player(108L, 1L, "Nick Madrigal", "3B", 20, "R", "R"),
            Player(109L, 1L, "Yan Gomes", "C", 18, "R", "R"),
            Player(110L, 1L, "Justin Steele", "P", 35, "L", "L"),
            Player(111L, 1L, "Patrick Wisdom", "3B", 39, "R", "R"),
            Player(112L, 1L, "Miguel Amaya", "C", 7, "R", "R"),
            Player(113L, 1L, "Shota Imanaga", "P", 18, "L", "L"),
        )

    val cardinalsRoster =
        listOf(
            Player(201L, 2L, "Brendan Donovan", "LF", 33, "L", "R"),
            Player(202L, 2L, "Paul Goldschmidt", "1B", 46, "R", "R"),
            Player(203L, 2L, "Nolan Arenado", "3B", 28, "R", "R"),
            Player(204L, 2L, "Willson Contreras", "C", 40, "R", "R"),
            Player(205L, 2L, "Nolan Gorman", "2B", 24, "L", "R"),
            Player(206L, 2L, "Lars Nootbaar", "RF", 21, "L", "R"),
            Player(207L, 2L, "Jordan Walker", "DH", 22, "R", "R"),
            Player(208L, 2L, "Masyn Winn", "SS", 0, "R", "R"),
            Player(209L, 2L, "Victor Scott II", "CF", 11, "L", "R"),
            Player(210L, 2L, "Sonny Gray", "P", 54, "R", "R"),
            Player(211L, 2L, "Alec Burleson", "1B", 41, "L", "R"),
            Player(212L, 2L, "Ivan Herrera", "C", 47, "R", "R"),
            Player(213L, 2L, "Ryan Helsley", "P", 56, "R", "R"),
        )
}

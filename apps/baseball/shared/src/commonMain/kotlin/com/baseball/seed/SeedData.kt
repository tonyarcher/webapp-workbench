package com.baseball.seed

import com.baseball.models.League
import com.baseball.models.Player
import com.baseball.models.Season
import com.baseball.models.Team

private const val LEAGUE_ID = 1L
private const val SEASON_ID = 1L
private const val SEASON_YEAR = 2026

private const val CUBS_ID = 1L
private const val CARDS_ID = 2L
private const val YANKS_ID = 3L
private const val SOX_ID = 4L

// Cubs Player IDs
private const val P101 = 101L
private const val P102 = 102L
private const val P103 = 103L
private const val P104 = 104L
private const val P105 = 105L
private const val P106 = 106L
private const val P107 = 107L
private const val P108 = 108L
private const val P109 = 109L
private const val P110 = 110L
private const val P111 = 111L
private const val P112 = 112L
private const val P113 = 113L

// Cards Player IDs
private const val P201 = 201L
private const val P202 = 202L
private const val P203 = 203L
private const val P204 = 204L
private const val P205 = 205L
private const val P206 = 206L
private const val P207 = 207L
private const val P208 = 208L
private const val P209 = 209L
private const val P210 = 210L
private const val P211 = 211L
private const val P212 = 212L
private const val P213 = 213L

// Jersey Numbers
private const val J2 = 2
private const val J7 = 7
private const val J11 = 11
private const val J18 = 18
private const val J19 = 19
private const val J20 = 20
private const val J21 = 21
private const val J22 = 22
private const val J24 = 24
private const val J27 = 27
private const val J28 = 28
private const val J29 = 29
private const val J33 = 33
private const val J35 = 35
private const val J39 = 39
private const val J40 = 40
private const val J41 = 41
private const val J46 = 46
private const val J47 = 47
private const val J54 = 54
private const val J56 = 56
private const val J94 = 94

private data class PData(
    val id: Long,
    val teamId: Long,
    val name: String,
    val position: String,
    val jerseyNumber: Int,
) {
    fun toPlayer(b: String = "R", t: String = "R"): Player =
        Player(id, teamId, name, position, jerseyNumber, b, t)
}

object SeedData {
    val league = League(LEAGUE_ID, "American Baseball League")
    val season = Season(SEASON_ID, LEAGUE_ID, "2026 Season", SEASON_YEAR)

    val teamCubs = Team(CUBS_ID, "Cubs", "CHC", "Chicago")
    val teamCardinals = Team(CARDS_ID, "Cardinals", "STL", "St. Louis")
    val teamYankees = Team(YANKS_ID, "Yankees", "NYY", "New York")
    val teamRedSox = Team(SOX_ID, "Red Sox", "BOS", "Boston")

    val cubsRoster = listOf(
        PData(P101, CUBS_ID, "Nico Hoerner", "2B", J2).toPlayer(),
        PData(P102, CUBS_ID, "Dansby Swanson", "SS", J7).toPlayer(),
        PData(P103, CUBS_ID, "Seiya Suzuki", "RF", J27).toPlayer(),
        PData(P104, CUBS_ID, "Cody Bellinger", "CF", J24).toPlayer("L", "L"),
        PData(P105, CUBS_ID, "Christopher Morel", "DH", J19).toPlayer(),
        PData(P106, CUBS_ID, "Ian Happ", "LF", J94).toPlayer("S"),
        PData(P107, CUBS_ID, "Michael Busch", "1B", J29).toPlayer("L"),
        PData(P108, CUBS_ID, "Nick Madrigal", "3B", J20).toPlayer(),
        PData(P109, CUBS_ID, "Yan Gomes", "C", J18).toPlayer(),
        PData(P110, CUBS_ID, "Justin Steele", "P", J35).toPlayer("L", "L"),
        PData(P111, CUBS_ID, "Patrick Wisdom", "3B", J39).toPlayer(),
        PData(P112, CUBS_ID, "Miguel Amaya", "C", J7).toPlayer(),
        PData(P113, CUBS_ID, "Shota Imanaga", "P", J18).toPlayer("L", "L"),
    )

    val cardinalsRoster = listOf(
        PData(P201, CARDS_ID, "Brendan Donovan", "LF", J33).toPlayer("L"),
        PData(P202, CARDS_ID, "Paul Goldschmidt", "1B", J46).toPlayer(),
        PData(P203, CARDS_ID, "Nolan Arenado", "3B", J28).toPlayer(),
        PData(P204, CARDS_ID, "Willson Contreras", "C", J40).toPlayer(),
        PData(P205, CARDS_ID, "Nolan Gorman", "2B", J24).toPlayer("L"),
        PData(P206, CARDS_ID, "Lars Nootbaar", "RF", J21).toPlayer("L"),
        PData(P207, CARDS_ID, "Jordan Walker", "DH", J22).toPlayer(),
        PData(P208, CARDS_ID, "Masyn Winn", "SS", 0).toPlayer(),
        PData(P209, CARDS_ID, "Victor Scott II", "CF", J11).toPlayer("L"),
        PData(P210, CARDS_ID, "Sonny Gray", "P", J54).toPlayer(),
        PData(P211, CARDS_ID, "Alec Burleson", "1B", J41).toPlayer("L"),
        PData(P212, CARDS_ID, "Ivan Herrera", "C", J47).toPlayer(),
        PData(P213, CARDS_ID, "Ryan Helsley", "P", J56).toPlayer(),
    )
}

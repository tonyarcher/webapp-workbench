package com.baseball.ui.gametracking.lineup

import com.baseball.models.Team

data class TeamValidationRequest(
    val homeTeam: Team,
    val awayTeam: Team,
    val useDh: Boolean,
    val isHome: Boolean,
    val lineupInputs: List<PlayerInputs>,
    val pitcherName: String,
    val pitcherNumber: String,
)

internal fun getTeamValidationError(request: TeamValidationRequest): String? {
    val teamName = if (request.isHome) request.homeTeam.name else request.awayTeam.name
    val nums = request.lineupInputs.map { it.jerseyNumber.toIntOrNull() }
    val allNums = if (request.useDh) nums + request.pitcherNumber.toIntOrNull() else nums

    return checkEmptyNames(request, teamName)
        ?: checkJerseyNumbers(nums, teamName)
        ?: checkPitcherWhenDh(request, teamName)
        ?: checkDuplicates(allNums, teamName)
        ?: checkPitcherRequirements(request, teamName)
}

internal fun checkEmptyNames(request: TeamValidationRequest, teamName: String): String? =
    if (request.lineupInputs.any { it.name.trim().isEmpty() })
        "Error in $teamName Lineup: All player names must be filled."
    else null

internal fun checkJerseyNumbers(nums: List<Int?>, teamName: String): String? =
    if (nums.any { it == null || it < 0 || it > 99 })
        "Error in $teamName Lineup: Jersey numbers must be integers between 0 and 99."
    else null

internal fun checkPitcherWhenDh(request: TeamValidationRequest, teamName: String): String? =
    if (request.useDh && (request.pitcherName.trim().isEmpty() || request.pitcherNumber.toIntOrNull() == null))
        "Error in $teamName Lineup: Starting Pitcher name and number must be filled when DH is enabled."
    else null

internal fun checkDuplicates(allNums: List<Int?>, teamName: String): String? =
    if (allNums.filterNotNull().size != allNums.toSet().filterNotNull().size)
        "Error in $teamName Lineup: Duplicate jersey numbers are not allowed."
    else null

internal fun checkPitcherRequirements(request: TeamValidationRequest, teamName: String): String? {
    val pCount = request.lineupInputs.count { it.position == "P" }
    return when {
        !request.useDh && request.lineupInputs.indexOfFirst { it.position == "P" } == -1 ->
            "Error in $teamName Lineup: Pitcher (P) must be included in the batting lineup when DH is disabled."

        !request.useDh && pCount != 1 ->
            "Error in $teamName Lineup: Lineup must contain exactly one Pitcher (P) " +
                    "in the batting order when DH is disabled."

        request.useDh && pCount > 0 ->
            "Error in $teamName Lineup: Batting order cannot contain a Pitcher (P) when DH is enabled."

        else -> null
    }
}

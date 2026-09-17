package fitnessapi.domain

data class ProfileData(
    val sex: String?,
    val birthYear: Int?,
    val heightM: Double?,
    val displayUnit: String,
    val tmSquat: Double?,
    val tmBench: Double?,
    val tmDeadlift: Double?,
    val tmPress: Double?,
)

fun emptyProfile(): ProfileData = ProfileData(
    sex = null,
    birthYear = null,
    heightM = null,
    displayUnit = "kg",
    tmSquat = null,
    tmBench = null,
    tmDeadlift = null,
    tmPress = null,
)

fun parseProfile(
    sex: String?,
    birthYear: Double?,
    heightM: Double?,
    displayUnit: String?,
    squat: Double?,
    bench: Double?,
    deadlift: Double?,
    press: Double?,
): ProfileData = ProfileData(
    sex = if (sex == "male" || sex == "female") sex else null,
    birthYear = birthYear?.toInt(),
    heightM = heightM,
    displayUnit = if (displayUnit == "lb") "lb" else "kg",
    tmSquat = squat,
    tmBench = bench,
    tmDeadlift = deadlift,
    tmPress = press,
)

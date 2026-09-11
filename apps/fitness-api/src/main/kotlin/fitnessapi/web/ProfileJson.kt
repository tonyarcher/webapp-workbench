package fitnessapi.web

import fitnessapi.domain.ProfileData

data class ProfileJson(
    val sex: String? = null,
    val birthYear: Int? = null,
    val heightM: Double? = null,
    val displayUnit: String,
    val tm: TmJson,
)

data class TmJson(
    val squat: Double? = null,
    val bench: Double? = null,
    val deadlift: Double? = null,
    val press: Double? = null,
)

fun ProfileData.toJson(): ProfileJson = ProfileJson(
    sex = sex,
    birthYear = birthYear,
    heightM = heightM,
    displayUnit = displayUnit,
    tm = TmJson(tmSquat, tmBench, tmDeadlift, tmPress),
)

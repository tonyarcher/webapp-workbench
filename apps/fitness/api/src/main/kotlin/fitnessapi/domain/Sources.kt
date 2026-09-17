package fitnessapi.domain

private val ALLOWED = setOf(
    "health-connect",
    "health-connect-db",
    "manual",
    "five31",
    "csv",
    "override",
)

fun sampleSource(raw: String?): String =
    if (raw != null && raw in ALLOWED) raw else "csv"

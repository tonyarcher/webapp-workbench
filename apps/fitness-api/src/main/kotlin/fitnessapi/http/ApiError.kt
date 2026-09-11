package fitnessapi.http

class ApiError(val status: Int, message: String) : RuntimeException(message)

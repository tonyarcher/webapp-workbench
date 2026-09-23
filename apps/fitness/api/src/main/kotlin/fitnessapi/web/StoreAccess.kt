package fitnessapi.web

import fitnessapi.store.ProfileStore
import fitnessapi.store.SampleStore
import org.springframework.beans.factory.ObjectProvider
import org.springframework.http.HttpStatus

fun ObjectProvider<SampleStore>.orOffline(): SampleStore =
    ifAvailable ?: throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "database offline")

fun ObjectProvider<ProfileStore>.orOffline(): ProfileStore =
    ifAvailable ?: throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "database offline")

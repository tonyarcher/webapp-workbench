package fitnessapi.web

import org.springframework.beans.factory.ObjectProvider
import fitnessapi.store.ProfileStore
import fitnessapi.store.SampleStore

fun ObjectProvider<SampleStore>.orOffline(): SampleStore =
    ifAvailable ?: throw ApiException(503, "database offline")

fun ObjectProvider<ProfileStore>.orOffline(): ProfileStore =
    ifAvailable ?: throw ApiException(503, "database offline")

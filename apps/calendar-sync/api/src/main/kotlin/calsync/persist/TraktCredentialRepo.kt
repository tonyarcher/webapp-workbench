package calsync.persist

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TraktCredentialRepo : JpaRepository<TraktCredentialEntity, UUID>

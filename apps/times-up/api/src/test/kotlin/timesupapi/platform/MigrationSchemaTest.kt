package timesupapi.platform

import kotlin.test.Test
import kotlin.test.assertTrue

class MigrationSchemaTest {
    @Test
    fun supportingIndexesAreDeclared() {
        val sql = checkNotNull(javaClass.getResourceAsStream("/db/migration/V28__supporting_indexes.sql"))
            .bufferedReader().use { it.readText() }
        assertTrue(sql.contains("idx_subscriptions_feed_id"))
        assertTrue(sql.contains("idx_feed_sync_due"))
        assertTrue(sql.contains("idx_article_state_article_id"))
    }
}

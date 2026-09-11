package fitnessapi.persist

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes

class ImportEntityTest {
    @Test
    fun errorsColumnBindsAsJson() {
        val field = ImportEntity::class.java.getDeclaredField("errors")
        val code = field.getAnnotation(JdbcTypeCode::class.java)
        assertNotNull(code)
        assertEquals(SqlTypes.JSON, code.value)
    }
}

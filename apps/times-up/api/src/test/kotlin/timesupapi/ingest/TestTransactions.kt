package timesupapi.ingest

import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.support.AbstractPlatformTransactionManager
import org.springframework.transaction.support.DefaultTransactionStatus
import org.springframework.transaction.support.SimpleTransactionStatus
import org.springframework.transaction.support.TransactionTemplate

/** Repository unit tests do not open a real database transaction. */
internal fun testTransactionTemplate(): TransactionTemplate = TransactionTemplate(
    object : AbstractPlatformTransactionManager() {
        override fun doGetTransaction(): Any = SimpleTransactionStatus()

        override fun doBegin(transaction: Any, definition: TransactionDefinition) = Unit

        override fun doCommit(status: DefaultTransactionStatus) = Unit

        override fun doRollback(status: DefaultTransactionStatus) = Unit
    },
)

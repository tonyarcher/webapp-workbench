package userapi.accounts

import com.yubico.webauthn.data.ByteArray
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PasskeyCredentialRepositoryTest {
    private val userId = UUID.randomUUID()
    private fun row(): StoredPasskey = StoredPasskey(
        credentialId = byteArrayOf(1, 2),
        userId = userId,
        userHandle = byteArrayOf(3, 4),
        publicKey = byteArrayOf(5, 6),
        signCount = 7,
    )

    @Test
    fun delegatesAllLookups() {
        val store = mock<PasskeyStore>()
        whenever(store.passkeysForUsername("alice")).thenReturn(listOf(row()))
        whenever(store.handleForUsername("alice")).thenReturn(byteArrayOf(3, 4))
        whenever(store.usernameForHandle(byteArrayOf(3, 4))).thenReturn("alice")
        whenever(store.lookup(byteArrayOf(1, 2), byteArrayOf(3, 4))).thenReturn(row())
        whenever(store.lookupAll(byteArrayOf(1, 2))).thenReturn(listOf(row()))
        val repo = PasskeyCredentialRepository(store)
        assertEquals(1, repo.getCredentialIdsForUsername("alice").size)
        assertTrue(repo.getUserHandleForUsername("alice").isPresent)
        assertEquals("alice", repo.getUsernameForUserHandle(ByteArray(byteArrayOf(3, 4))).orElse(null))
        assertTrue(repo.lookup(ByteArray(byteArrayOf(1, 2)), ByteArray(byteArrayOf(3, 4))).isPresent)
        assertEquals(1, repo.lookupAll(ByteArray(byteArrayOf(1, 2))).size)
    }

    @Test
    fun missingIsEmpty() {
        val store = mock<PasskeyStore>()
        whenever(store.handleForUsername("ghost")).thenReturn(null)
        whenever(store.usernameForHandle(byteArrayOf(9))).thenReturn(null)
        whenever(store.lookup(byteArrayOf(9), byteArrayOf(9))).thenReturn(null)
        whenever(store.lookupAll(byteArrayOf(9))).thenReturn(emptyList())
        whenever(store.passkeysForUsername("ghost")).thenReturn(emptyList())
        val repo = PasskeyCredentialRepository(store)
        assertTrue(repo.getUserHandleForUsername("ghost").isEmpty)
        assertTrue(repo.getUsernameForUserHandle(ByteArray(byteArrayOf(9))).isEmpty)
        assertTrue(repo.lookup(ByteArray(byteArrayOf(9)), ByteArray(byteArrayOf(9))).isEmpty)
        assertTrue(repo.lookupAll(ByteArray(byteArrayOf(9))).isEmpty())
        assertTrue(repo.getCredentialIdsForUsername("ghost").isEmpty())
    }
}

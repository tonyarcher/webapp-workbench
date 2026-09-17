package rssapi.web

import java.util.UUID
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import rssapi.persist.FolderEntity
import rssapi.persist.FolderRepo
import rssapi.persist.UserEntity
import rssapi.persist.UserRepo

private fun libJwt(sub: String): Jwt = Jwt.withTokenValue("tok")
    .header("alg", "RS256")
    .claim("sub", sub)
    .claim("preferred_username", "alice")
    .claim("aud", listOf("rss-reader"))
    .build()

@WebMvcTest(LibraryController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class LibraryControllerTest {
    @Autowired
    lateinit var mvc: MockMvc

    @MockitoBean
    lateinit var decoder: JwtDecoder

    @MockitoBean
    lateinit var users: UserRepo

    @MockitoBean
    lateinit var folders: FolderRepo

    @MockitoBean
    lateinit var service: LibraryService

    private fun stubAuth(uid: UUID) {
        whenever(decoder.decode(any())).thenReturn(libJwt("u1"))
        whenever(users.findBySubject("u1")).thenReturn(
            UserEntity(id = uid, label = "identity", subject = "u1", username = "alice"),
        )
    }

    private fun folderJson(id: UUID) = FolderJson(id.toString(), "Tech", 0L, 0)

    private fun feedJson(id: UUID, url: String) = FeedJson(id.toString(), "T", url, emptyList(), 0, 0L)

    @Test
    fun missingVersionHeaderIsNotRouted() {
        stubAuth(UUID.randomUUID())
        mvc.get("/library") {
            header("Authorization", "Bearer good")
        }.andExpect {
            status { isNotFound() }
        }
    }

    @Test
    fun libraryReturnsServiceSnapshot() {
        val uid = UUID.randomUUID()
        val feedA = UUID.randomUUID()
        stubAuth(uid)
        whenever(service.library(uid)).thenReturn(
            LibraryJson(listOf(folderJson(UUID.randomUUID())), listOf(feedJson(feedA, "https://a.example/rss"))),
        )

        mvc.get("/library") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }.andExpect {
            status { isOk() }
            jsonPath("$.feeds.length()") { value(1) }
        }
    }

    @Test
    fun foldersEndpointReturnsFoldersAlone() {
        val uid = UUID.randomUUID()
        stubAuth(uid)
        whenever(service.folders(uid)).thenReturn(listOf(folderJson(UUID.randomUUID())))

        mvc.get("/library/folders") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }.andExpect {
            status { isOk() }
            jsonPath("$.folders.length()") { value(1) }
        }
    }

    @Test
    fun feedsEndpointReturnsNamesAlone() {
        val uid = UUID.randomUUID()
        stubAuth(uid)
        whenever(service.feeds(uid)).thenReturn(listOf(feedJson(UUID.randomUUID(), "https://a.example/rss")))

        mvc.get("/library/feeds") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }.andExpect {
            status { isOk() }
            jsonPath("$.feeds.length()") { value(1) }
            jsonPath("$.feeds[0].unread") { value(0) }
        }
    }

    @Test
    fun countsEndpointReturnsBadges() {
        val uid = UUID.randomUUID()
        val feedA = UUID.randomUUID()
        stubAuth(uid)
        whenever(service.counts(uid)).thenReturn(mapOf(feedA.toString() to 7))

        mvc.get("/library/counts") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }.andExpect {
            status { isOk() }
            jsonPath("$.counts['$feedA']") { value(7) }
        }
    }

    @Test
    fun reorderSavesBulkOrder() {
        val uid = UUID.randomUUID()
        val folderA = UUID.randomUUID()
        val folderB = UUID.randomUUID()
        stubAuth(uid)
        val rows = listOf(
            FolderEntity(id = folderA, userId = uid, title = "A", sortOrder = 0),
            FolderEntity(id = folderB, userId = uid, title = "B", sortOrder = 1),
        )
        whenever(folders.findAllById(any<List<UUID>>())).thenReturn(rows)

        mvc.post("/folders/reorder") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"ids":["$folderB","$folderA","not-a-uuid","${UUID.randomUUID()}"]}"""
        }.andExpect {
            status { isOk() }
        }
        verify(folders).saveAll(org.mockito.kotlin.check<List<FolderEntity>> {
            assert(it.first { e -> e.id == folderB }.sortOrder == 0)
            assert(it.first { e -> e.id == folderA }.sortOrder == 1)
        })
    }

    @Test
    fun createFolderValidates() {
        stubAuth(UUID.randomUUID())
        mvc.post("/folders") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{}"""
        }.andExpect {
            status { isBadRequest() }
        }
        mvc.post("/folders") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"title":"   "}"""
        }.andExpect {
            status { isBadRequest() }
        }
    }

    @Test
    fun createFolderReusesExisting() {
        val uid = UUID.randomUUID()
        val folderId = UUID.randomUUID()
        stubAuth(uid)
        whenever(folders.findByUserIdAndTitle(uid, "Tech")).thenReturn(
            FolderEntity(id = folderId, userId = uid, title = "Tech"),
        )
        mvc.post("/folders") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"title":"  Tech  "}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.id") { value(folderId.toString()) }
        }
        verify(folders, org.mockito.kotlin.never()).save(any())
    }

    @Test
    fun deleteFolderValidates() {
        stubAuth(UUID.randomUUID())
        mvc.delete("/folders/nope") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }.andExpect {
            status { isBadRequest() }
        }
    }

    @Test
    fun deleteFolderRemovesOwned() {
        val uid = UUID.randomUUID()
        val folderId = UUID.randomUUID()
        stubAuth(uid)
        whenever(folders.findById(folderId)).thenReturn(
            java.util.Optional.of(FolderEntity(id = folderId, userId = uid, title = "Tech")),
        )
        mvc.delete("/folders/$folderId") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
        }.andExpect {
            status { isOk() }
        }
        verify(folders).delete(any())
    }

    @Test
    fun reorderEmptyIds() {
        stubAuth(UUID.randomUUID())
        mvc.post("/folders/reorder") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{"ids":[]}"""
        }.andExpect {
            status { isOk() }
        }
    }

    @Test
    fun reorderMissingIds() {
        stubAuth(UUID.randomUUID())
        mvc.post("/folders/reorder") {
            header("X-Api-Version", "1")
            header("Authorization", "Bearer good")
            contentType = MediaType.APPLICATION_JSON
            content = """{}"""
        }.andExpect {
            status { isBadRequest() }
        }
    }
}

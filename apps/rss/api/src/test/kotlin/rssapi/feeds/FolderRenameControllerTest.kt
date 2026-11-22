package rssapi.feeds
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.put
import rssapi.platform.IdentityUser
import rssapi.platform.RequestIdFilter
import rssapi.platform.SecurityConfig
import java.util.UUID

/** Folder rename is a write on an owned row: validate, scope, then save. */
@WebMvcTest(LibraryController::class)
@Import(SecurityConfig::class, RequestIdFilter::class, IdentityUser::class)
class FolderRenameControllerTest {
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

    private val uid = UUID.randomUUID()

    private fun stubAuth() {
        whenever(decoder.decode(any())).thenReturn(
            Jwt.withTokenValue("tok")
                .header("alg", "RS256")
                .claim("sub", "u1")
                .claim("aud", listOf("rss-reader"))
                .build(),
        )
        whenever(users.findBySubject("u1")).thenReturn(
            UserEntity(id = uid, label = "identity", subject = "u1", username = "alice"),
        )
    }

    private fun rename(id: String, title: String) = mvc.put("/folders/$id") {
        header("X-Api-Version", "1")
        header("Authorization", "Bearer good")
        contentType = MediaType.APPLICATION_JSON
        content = """{"title":"$title"}"""
    }

    private fun owned(id: UUID) = FolderEntity(id = id, userId = uid, title = "Old")

    @Test
    fun renamesOwnedFolder() {
        val id = UUID.randomUUID()
        stubAuth()
        whenever(folders.findById(id)).thenReturn(java.util.Optional.of(owned(id)))
        whenever(folders.save(any<FolderEntity>())).thenAnswer { it.arguments[0] }

        rename(id.toString(), "  Tech  ").andExpect {
            status { isOk() }
            jsonPath("$.title") { value("Tech") }
        }
    }

    @Test
    fun rejectsBlankTitle() {
        stubAuth()
        rename(UUID.randomUUID().toString(), "  ").andExpect { status { isBadRequest() } }
    }

    @Test
    fun rejectsInvalidId() {
        stubAuth()
        rename("nope", "Tech").andExpect { status { isBadRequest() } }
    }

    @Test
    fun rejectsAnotherUsersFolder() {
        val id = UUID.randomUUID()
        stubAuth()
        whenever(folders.findById(id)).thenReturn(
            java.util.Optional.of(FolderEntity(id = id, userId = UUID.randomUUID(), title = "Other")),
        )
        rename(id.toString(), "Tech").andExpect { status { isNotFound() } }
    }

    @Test
    fun rejectsDuplicateTitle() {
        val id = UUID.randomUUID()
        stubAuth()
        whenever(folders.findById(id)).thenReturn(java.util.Optional.of(owned(id)))
        whenever(folders.findByUserIdAndTitle(uid, "Taken")).thenReturn(
            FolderEntity(id = UUID.randomUUID(), userId = uid, title = "Taken"),
        )
        rename(id.toString(), "Taken").andExpect { status { isConflict() } }
    }
}

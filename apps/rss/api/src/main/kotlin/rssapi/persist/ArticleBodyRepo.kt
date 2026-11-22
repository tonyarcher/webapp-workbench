package rssapi.persist

import org.springframework.data.jpa.repository.JpaRepository

interface ArticleBodyRepo : JpaRepository<ArticleBodyEntity, String>

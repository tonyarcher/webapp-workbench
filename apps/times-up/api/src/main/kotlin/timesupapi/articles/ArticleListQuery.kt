package timesupapi.articles
import jakarta.persistence.EntityManager
import jakarta.persistence.Tuple
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.CriteriaQuery
import jakarta.persistence.criteria.Order
import jakarta.persistence.criteria.Root
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.jpa.domain.Specification
import org.springframework.stereotype.Repository

@Repository
class ArticleListQuery(private val em: EntityManager) {
    fun findAll(spec: Specification<ArticleEntity>, pageable: Pageable): List<ArticleListRow> {
        val cb = em.criteriaBuilder
        val cq = cb.createQuery(ArticleListRow::class.java)
        val root = cq.from(ArticleEntity::class.java)
        cq.select(select(cb, root))
        spec.toPredicate(root, cq, cb)?.let { cq.where(it) }
        cq.orderBy(orders(cb, root, pageable.sort))
        val query = em.createQuery(cq)
        query.firstResult = pageable.offset.toInt()
        query.maxResults = pageable.pageSize
        return query.resultList
    }

    /** Excerpt, or stored summary as fallback, for cited article ids only. */
    fun findExcerpts(ids: Collection<String>): Map<String, String> {
        if (ids.isEmpty()) return emptyMap()
        val cb = em.criteriaBuilder
        val cq = cb.createQuery(Tuple::class.java)
        val root = cq.from(ArticleEntity::class.java)
        val text = cb.coalesce(root.get<String>("excerpt"), root.get<String>("summary"))
        cq.select(cb.tuple(root.get<String>("id"), text))
        cq.where(root.get<String>("id").`in`(ids))
        return em.createQuery(cq).resultList.mapNotNull { row ->
            val id = row.get(0, String::class.java) ?: return@mapNotNull null
            val text = row.get(1, String::class.java) ?: return@mapNotNull null
            id to text
        }.toMap()
    }

    private fun select(
        cb: CriteriaBuilder,
        root: Root<ArticleEntity>,
    ): jakarta.persistence.criteria.CompoundSelection<ArticleListRow> = cb.construct(
        ArticleListRow::class.java,
        root.get<String>("id"),
        root.get<java.util.UUID>("feedId"),
        root.get<String>("guid"),
        root.get<String>("title"),
        root.get<String>("link"),
        root.get<String>("normLink"),
        root.get<String>("domain"),
        root.get<String>("author"),
        root.get<String>("summary"),
        root.get<String>("excerpt"),
        root.get<String>("image"),
        root.get<Int>("comments"),
        root.get<java.time.Instant>("publishedAt"),
        root.get<java.time.Instant>("fetchedAt"),
        root.get<Float>("popularity"),
        root.get<Float>("engagement"),
        root.get<Float>("hot"),
    )

    private fun orders(cb: CriteriaBuilder, root: Root<ArticleEntity>, sort: Sort): List<Order> = sort.map { o ->
        if (o.isAscending) cb.asc(root.get<Any>(o.property)) else cb.desc(root.get<Any>(o.property))
    }.toList()
}

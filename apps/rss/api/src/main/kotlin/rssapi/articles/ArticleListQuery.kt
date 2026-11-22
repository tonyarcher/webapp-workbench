package rssapi.articles
import jakarta.persistence.EntityManager
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

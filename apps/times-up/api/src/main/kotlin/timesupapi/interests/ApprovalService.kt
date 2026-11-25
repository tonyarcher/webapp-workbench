package timesupapi.interests

import org.springframework.stereotype.Service
import timesupapi.feeds.OpmlImportResult
import timesupapi.feeds.OpmlImportService
import java.util.UUID

@Service
class ApprovalService(private val opmlImport: OpmlImportService) {
    fun approve(userId: UUID, candidates: List<CandidateFeed>, folder: String): OpmlImportResult {
        val xml = buildOpml(candidates, folder)
        return opmlImport.run(userId, xml)
    }

    private fun buildOpml(candidates: List<CandidateFeed>, folder: String): String {
        val items = candidates.joinToString("\n") { c ->
            """<outline type="rss" text="${escape(c.title)}" title="${escape(c.title)}" xmlUrl="${escape(c.url)}"/>"""
        }
        return """<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head><title>Times Up import</title></head>
  <body>
    <outline text="$folder" title="$folder">
      $items
    </outline>
  </body>
</opml>"""
    }

    private fun escape(s: String): String =
        s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
}

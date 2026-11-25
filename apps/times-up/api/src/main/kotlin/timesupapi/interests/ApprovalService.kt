package timesupapi.interests

import org.springframework.stereotype.Service
import timesupapi.feeds.OpmlImportResult
import timesupapi.feeds.OpmlImportService
import java.util.UUID

data class DryRunReport(val wouldCreate: Int, val feeds: List<String>, val folder: String, val requiresConfirm: String)

@Service
class ApprovalService(private val opmlImport: OpmlImportService) {
    private val confirmToken = "approve"

    fun dryRun(candidates: List<CandidateFeed>, folder: String): DryRunReport = DryRunReport(
        wouldCreate = candidates.size,
        feeds = candidates.map { it.url },
        folder = folder,
        requiresConfirm = confirmToken,
    )

    fun approve(userId: UUID, candidates: List<CandidateFeed>, folder: String, confirm: String): OpmlImportResult {
        if (confirm != confirmToken) throw IllegalArgumentException("confirm must equal $confirmToken")
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

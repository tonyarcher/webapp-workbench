package timesupapi.poller

import timesupapi.platform.RequestIds
import timesupapi.platform.log.log

/** Poller error logging, kept separate so the scheduler stays small. */
class PollerLog {
    fun feedFailure(feedId: java.util.UUID, err: Throwable, trace: RequestIds?) {
        log(
            "times-up-api",
            "error",
            "poller feed",
            buildMap {
                put("feed_id", feedId.toString())
                put("request_id", trace?.requestId)
                put("trace_id", trace?.traceId)
                put("span_id", trace?.spanId)
                put("err", mapOf("type" to (err::class.simpleName ?: "Error"), "message" to (err.message ?: "")))
            },
        )
    }
}

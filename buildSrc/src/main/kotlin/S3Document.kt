package workbench

/*
 * Document rendering for the S3 publish: the runtime `#app-config` block and
 * the upload commands that place the rendered document over Vite's raw
 * `index.html`. Kept separate from S3Support.kt only to hold the file under the
 * max-lines lint floor; every function here is pure so it is unit-testable.
 */

/** The id of the runtime-config script block the publish renders. */
const val APP_CONFIG_ID: String = "app-config"

/** The rendered runtime config JSON for an API origin; empty means same origin. */
fun appConfigJson(apiBase: String, identityBase: String): String =
    """{"apiBase":"${escapeJson(apiBase)}","identityBase":"${escapeJson(identityBase)}"}"""

private fun escapeJson(value: String): String = value
    .replace("\\", "\\\\")
    .replace("\"", "\\\"")
    .replace("\n", "\\n")
    .replace("\r", "\\r")
    .replace("\t", "\\t")

/**
 * Replace the `#app-config` block's JSON with the rendered config. Vite ships
 * the block as `{"apiBase":""}` (the same-origin default); the publish swaps in
 * the app's API origin so the document names the right origin per environment
 * without rebuilding. Returns the input unchanged when the block is absent.
 */
fun renderAppConfig(indexHtml: String, apiBase: String, identityBase: String): String {
    val marker = """id="$APP_CONFIG_ID""""
    val start = indexHtml.indexOf(marker)
    if (start < 0) return indexHtml
    val open = indexHtml.indexOf('>', start)
    if (open < 0) return indexHtml
    val close = indexHtml.indexOf("</script>", open, ignoreCase = true)
    if (close < 0) return indexHtml
    return indexHtml.substring(0, open + 1) + appConfigJson(apiBase, identityBase) + indexHtml.substring(close)
}

/** `aws s3 cp` that uploads the rendered document over the store's index.html. */
fun s3CopyCommand(bucket: String, key: String, srcFile: String, endpoint: String = ""): List<String> {
    val command = mutableListOf("aws", "s3", "cp", srcFile, "s3://${bucket.trimEnd('/')}/$key/index.html")
    if (endpoint.isNotBlank()) {
        command.add("--endpoint-url")
        command.add(endpoint.trim())
    }
    return command
}

/** `mc cp` that uploads the rendered document over the store's index.html. */
fun mcCopyCommand(alias: String, bucket: String, key: String, srcFile: String): List<String> =
    listOf("mc", "cp", srcFile, "$alias/${bucket.trimEnd('/')}/$key/index.html")

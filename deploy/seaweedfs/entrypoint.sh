#!/bin/sh
# Render the S3 identity file, then hand off to the image's own entrypoint so
# its FIPS mode, /data permission fix, and privilege drop still apply. The
# identity must exist or the S3 gateway rejects every signed request
# ("Available keys: 0"). Credentials come from env at container start -- the
# config shape is baked into the image, the secret never is.
set -eu

# The identity values below are interpolated straight into a JSON string literal
# by an unquoted heredoc, so a double quote, a backslash, or a newline would
# produce invalid JSON: the gateway would then load zero identities and reject
# every signed request ("Available keys: 0"). Reject those here rather than fail
# mysteriously at request time. Real S3 credentials are URL-safe (AWS secrets are
# base64), so this refuses nothing an operator would actually use.
require_json_safe() {
    case "$2" in
    *[!A-Za-z0-9._~+/=-]*)
        echo "error: $1 must be URL-safe (letters, digits, and ._~+/=- only)" >&2
        exit 1
        ;;
    esac
}

if [ -z "${S3_ACCESS_KEY:-}" ] || [ -z "${S3_SECRET_KEY:-}" ]; then
    echo "error: S3_ACCESS_KEY and S3_SECRET_KEY must both be set" >&2
    exit 1
fi

require_json_safe S3_ACCESS_KEY "$S3_ACCESS_KEY"
require_json_safe S3_SECRET_KEY "$S3_SECRET_KEY"

mkdir -p /etc/seaweedfs

cat >/etc/seaweedfs/s3.json <<JSON
{
  "identities": [
    {
      "name": "anonymous",
      "actions": ["Read"]
    },
    {
      "name": "workbench",
      "credentials": [
        {
          "accessKey": "${S3_ACCESS_KEY}",
          "secretKey": "${S3_SECRET_KEY}"
        }
      ],
      "actions": ["Admin", "Read", "Write", "List", "Tagging"]
    }
  ]
}
JSON

exec /entrypoint.sh server -s3 -s3.config=/etc/seaweedfs/s3.json

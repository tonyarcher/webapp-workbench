# SeaweedFS S3 object store, replacing MinIO (whose images no longer pull).
# Built from the deploy/ context (like the gateway and postgres) because the
# remote daemon cannot see host bind mounts: the entrypoint is COPYed into the
# image rather than mounted. The entrypoint renders the s3.json identity from
# env at start, so the secret never lands in an image layer.
FROM chrislusf/seaweedfs:4.48
COPY seaweedfs/entrypoint.sh /usr/local/bin/seaweedfs-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/seaweedfs-entrypoint.sh"]

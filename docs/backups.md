# Backups and snapshots

The segment snapshot manager stages a copy of the index manifest, immutable segment files, and configuration metadata. Every file receives a SHA-256 checksum. Creation uses a temporary directory followed by an atomic rename; restore verifies all checksums into a staging area before replacing live data and rolls back if replacement fails. Never edit a snapshot in place.

Snapshots do not replace PostgreSQL backups: PostgreSQL contains projects, API-key records, jobs, analytics, and interactions. Back up PostgreSQL and the index/snapshot volumes at a consistent application maintenance point. A restore drill should recreate the database, validate a snapshot, restore it, restart Seekr, and compare known search results.

Use `POST /v1/indexes/:indexId/snapshots`, `GET /v1/indexes/:indexId/snapshots`, `POST /v1/indexes/:indexId/snapshots/:snapshotId/restore`, and the corresponding DELETE route. Creation materializes the index's current schema and source documents into an immutable segment before checksumming. Restore validates and stages the files, then replaces that index's schema/documents and rebuilds its live engine. This is a single-node operation; pause writes to the target index while restoring.

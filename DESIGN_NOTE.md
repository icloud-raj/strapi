# Design Note — Audit Log Plugin

### Overview
I built this plugin to give Strapi a proper audit trail — something that records every create, update, and delete across all content types without having to touch business code.

The challenge was building something that works reliably today but can scale tomorrow. I needed it to handle a small blog with 10 posts per day and eventually a content platform with thousands of operations per minute, all without rewriting the core logic.

---

### How It Works
Every time a model changes, Strapi fires a lifecycle event. The plugin subscribes to those hooks, captures what changed, and routes it through a backend system that adapts based on your deployment needs.

```
[Content Operation] → [Lifecycle Hook] → [Audit Logger] → [Storage Backend]
       │                    │                │               │
   User creates         afterCreate      Build diff      Write metadata
   an article          event fires      + metadata       + compressed blob
```

The flow splits into two modes:

```
┌─────────────────┐    ┌─────────────────┐
│   Sync Mode     │    │   Async Mode    │
│                 │    │                 │
│ Hook → Logger   │    │ Hook → Queue    │
│   ↓             │    │   ↓             │
│ Write Now       │    │ Worker Process  │
│   ↓             │    │   ↓             │
│ Return          │    │ Write Later     │
└─────────────────┘    └─────────────────┘
```

Sync mode writes immediately — the audit record exists before the API response goes back. Async mode pushes to a Redis queue so a background worker can handle the heavy lifting without blocking the main request.

---

### How Data Gets Stored
I split each audit entry into two pieces because they have different access patterns:

**Metadata (PostgreSQL):**
```
{
  "eventId": "uuid-here",
  "action": "update", 
  "contentType": "api::article.article",
  "recordId": "123",
  "userId": "456",
  "timestamp": "2024-10-25T10:30:00Z",
  "changedKeys": ["title", "publishedAt"],
  "blobPath": "/data/audit_blobs/2024-10-25-uuid.json.gz"
}
```

**Diff Blob (File/S3):**
```json
{
  "title": {
    "before": "Draft Article",
    "after": "Published Article"
  },
  "publishedAt": {
    "before": null,
    "after": "2024-10-25T10:30:00Z"
  }
}
```

The metadata lives in PostgreSQL because that's what you query — "show me all updates to articles by user X in the last week." Fast indexes, efficient filtering, proper pagination.

The blob goes to cheaper storage because you only fetch it when someone wants to see exactly what changed. Gzipped JSON compresses really well (often 80%+ reduction) and costs almost nothing in object storage.

---

### Why I Made These Choices

**Lifecycle Hooks Over Middleware**
I could have intercepted HTTP requests, but that misses direct database operations, imports, or anything that bypasses the API layer. Lifecycle hooks catch everything that touches the data, regardless of how it got there.

**Hybrid Storage Over Pure Database**
Storing everything in PostgreSQL would work until you hit scale. A busy content site generates massive audit logs — imagine storing every draft save, every publish, every tag change. That bloats your main database and makes backups expensive.

Pure object storage would be cheap but terrible for queries. "Find all changes by this user" becomes a nightmare of listing and downloading thousands of files.

The hybrid approach gives you fast queries on metadata and cheap storage for details. You can even set different retention policies — keep metadata for 2 years but only store full diffs for 6 months.

**Pluggable Backends Over Hard-Coded Storage**
I've seen too many projects painted into corners by storage decisions. What works for a local development setup doesn't work in production. What works in a single-region deployment doesn't work when you go global.

The backend interface lets you start simple:
```javascript
// Development
backend: 'db-file'  // Store blobs on local disk

// Production  
backend: 'db-s3'    // Store blobs in S3/MinIO

// Future
backend: 'db-gcs'   // Store blobs in Google Cloud
```

Same plugin code, different storage. No migration headaches.

**Sync Mode as Default, Async as Option**
Sync mode guarantees the audit record exists immediately. If something goes wrong with the main operation, you still have a record of what was attempted. That's crucial for compliance scenarios.

But sync mode adds latency — every content operation waits for the audit write to complete. For high-traffic sites, that's a problem.

Async mode trades immediate consistency for performance. The audit record will exist, just not instantly. For most use cases, that's fine. The queue handles retries, so you don't lose data even if S3 is having a bad day.

**Smart Diff Algorithm**
I don't store the entire record for every change. For updates, I only capture what actually changed:

```javascript
// Instead of storing 50KB of article data
// Just store what changed:
{
  "title": { "before": "Old", "after": "New" },
  "updatedAt": { "before": "...", "after": "..." }
}
```

For creates, you get the full record (there's no "before"). For deletes, you get the full record (there's no "after"). For updates, you get just the diff.

This keeps storage costs reasonable and makes it easier to see what actually happened.

---

### Real-World Considerations

**Performance Impact**
In sync mode, each content operation adds ~10-50ms for the audit write (depending on your storage backend). That's usually acceptable, but it adds up under load.

In async mode, the performance impact is essentially zero — just the time to push a message to Redis, which is microseconds.

**Storage Costs**
A typical audit entry might be:
- Metadata: ~200 bytes in PostgreSQL
- Blob: ~1-5KB compressed (varies by content size)

At 1000 operations per day, that's about 2GB per year in blob storage. In S3, that costs maybe $0.50 per year. The PostgreSQL storage is negligible.

**Operational Complexity**
Sync mode is dead simple — no moving parts beyond your existing database.

Async mode requires Redis and a worker process. More infrastructure, but it scales much better. The worker can run on the same server for small deployments or on separate instances for larger ones.

**Compliance and Retention**
The plugin supports automatic cleanup of old records. You can configure different retention periods for metadata vs blobs:

```javascript
retention: {
  metadata: 730,  // Keep metadata for 2 years
  blobs: 180      // Keep full diffs for 6 months
}
```

This helps with GDPR compliance and keeps storage costs under control.

---

### What I'd Do Differently Next Time

**Event Sourcing Integration**
If I were building this for a system that already used event sourcing, I'd probably hook into that stream instead of lifecycle events. But for typical Strapi deployments, lifecycle hooks are simpler and more reliable.

**Batch Processing**
The current async implementation processes one audit record at a time. For very high-volume scenarios, batching multiple records into single S3 writes would be more efficient. But that adds complexity for a use case most people won't hit.

**Schema Evolution**
I didn't build in versioning for the audit record format. If we need to change the structure later, migration will be manual. For a v2, I'd add a schema version field from day one.

---

### Final Thoughts
The main goal was making audit logging automatic and complete. Every content change gets captured without manual intervention — just a reliable record of who changed what and when.

Lifecycle hooks ensure nothing gets missed. The hybrid storage keeps queries fast while keeping costs reasonable. The pluggable backends mean you can adapt to different deployment needs without rewriting anything.

It's built to handle the questions that come up: "What happened to this content?" or "Who made these changes?" The system provides clear, queryable answers that scale with your needs.

# Audit Log Plugin

This plugin automatically tracks every content change in your Strapi app — who created what, who updated what, who deleted what. No manual logging needed.

## What It Does

Every time someone creates, updates, or deletes content through Strapi (admin panel or API), this plugin captures:
- What content type and record
- What action (create/update/delete)
- Who did it (user ID)
- When it happened
- What fields changed (with before/after values)

Everything gets stored in a dedicated `audit_logs` table, and you can query it through a REST API with filtering, pagination, and sorting.

## Setup

### 1. Enable the Plugin

Create or edit `config/plugins.js`:

```javascript
module.exports = {
  'audit-log': {
    enabled: true,
    config: {
      enabled: true,
      mode: 'sync',              // or 'async' if you have Redis
      backend: 'db-file',        // or 'db' to store diffs in database
      excludeContentTypes: [
        'plugin::upload.file'    // Exclude noisy content types
      ]
    }
  }
};
```

### 2. Prevent File Watcher Restarts

In `config/admin.js`, add:

```javascript
module.exports = {
  watchIgnoreFiles: [
    '**/data/**',  // Ignore audit log files
  ],
  // ... rest of config
};
```

### 3. Grant Permissions

Go to **Settings → Roles** in admin panel, pick a role, and enable the "Read audit logs" permission under Plugins → Audit Log.

That's it. Restart Strapi and it'll start logging.

## Using the API

### Get Recent Changes

```bash
curl "http://localhost:1337/audit-logs?_limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Filter by Content Type

```bash
curl "http://localhost:1337/audit-logs?contentType=api::article.article" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Filter by Action

```bash
curl "http://localhost:1337/audit-logs?action=update" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Filter by User

```bash
curl "http://localhost:1337/audit-logs?userId=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Filter by Date Range

```bash
curl "http://localhost:1337/audit-logs?startDate=2025-10-01&endDate=2025-10-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Full Details for One Entry

```bash
curl "http://localhost:1337/audit-logs/42/blob" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

This returns the complete before/after diff for that specific change.

## Query Parameters

| Parameter | What It Does | Example |
|-----------|-------------|---------|
| `_limit` | Page size (default: 10) | `_limit=25` |
| `_page` | Page number (default: 1) | `_page=2` |
| `_sort` | Sort order | `_sort=timestamp:asc` |
| `contentType` | Filter by content type | `contentType=api::article.article` |
| `action` | Filter by action | `action=update` |
| `userId` | Filter by user | `userId=1` |
| `startDate` | From date | `startDate=2025-01-01` |
| `endDate` | To date | `endDate=2025-12-31` |

## Configuration Options

### `mode: 'sync'` vs `'async'`

**Sync mode** (default) writes logs immediately. Simple, no extra infrastructure needed, but adds a few milliseconds to each write operation.

**Async mode** queues logs in Redis and processes them in the background. Requires Redis and BullMQ, but faster for the main request.

```javascript
config: {
  mode: 'async',
  queue: {
    redis: 'redis://localhost:6379'
  }
}
```

### `backend: 'db-file'` vs `'db'`

**db-file** (default) stores metadata in PostgreSQL and diffs in compressed files. Keeps your database smaller.

**db** stores everything in PostgreSQL. Simpler if you don't want to deal with files.

When you use `db-file`, the list API returns `diff: null` — you need to call the `/blob` endpoint to get the full diff. With `db`, the diff is right there in the list response.

### `excludeContentTypes`

Skip logging for certain content types:

```javascript
config: {
  excludeContentTypes: [
    'plugin::upload.file',     // Files change constantly
    'admin::user',             // Sensitive data
    'plugin::audit-log.audit-log'  // Already excluded by default
  ]
}
```

## How It Works

The plugin hooks into Strapi's database lifecycle events (`afterCreate`, `afterUpdate`, `afterDelete`). When content changes, it:

1. Grabs the authenticated user from the request context
2. Figures out what changed (smart diff that only stores changed fields)
3. Writes metadata to `audit_logs` table
4. Writes the full diff to a compressed file (or database, depending on backend)

The `audit_logs` table has indexes on `content_type`, `user_id`, `action`, and `timestamp`, so queries stay fast even with lots of logs.

## Security

Only users with the `plugin::audit-log.read` permission can access the audit logs API. Everyone else gets a 403.

The audit logs themselves are never audited (prevents infinite loops). And they're read-only through the API — no way to modify or delete them.

## Troubleshooting

**Logs not appearing?**
- Check if plugin is enabled in `config/plugins.js`
- Make sure the content type isn't in `excludeContentTypes`
- Look at server logs for errors
- Verify Strapi is fully loaded (logs only record after `strapi.isLoaded` is true)

**Permission denied?**
- Check the user has the "Read audit logs" permission in Settings → Roles
- Verify the JWT token is valid and not expired
- Make sure you're using an admin user token (not a regular user)

**userId is null?**
- This is normal for operations that happen without an authenticated user (like cron jobs, startup scripts, or direct database operations)
- Check if the user is properly authenticated when making the request

**User filtering not working?**
- Use `userId=1` not `user=1` in your query parameters
- userId must match the admin user's ID in the database

**All fields showing as changed for updates?**
- This was fixed in v1.0.1 - the plugin now fetches the before state automatically
- If you're seeing this, make sure you're running the latest version

**App keeps restarting in development?**
- Add `'**/data/**'` to `watchIgnoreFiles` in `config/admin.js`
- This prevents audit log files from triggering hot reload

**Invalid date error?**
- Use ISO 8601 format for dates: `2025-10-26` or `2025-10-26T12:00:00Z`
- Dates are validated and will return 400 Bad Request if malformed

## Testing

There's a Postman collection (`Audit_Log_API_Tests.postman_collection.json`) in the repo root you can import and use for testing all the endpoints.

## Database Schema

The `audit_logs` table has these columns:

- `id` - Primary key
- `action` - 'create', 'update', or 'delete'
- `contentType` - Content type UID (like `api::article.article`)
- `recordId` - ID of the affected record
- `userId` - Who did it (null if system operation)
- `timestamp` - When it happened
- `changedKeys` - Array of field names that changed
- `diff` - Full diff (if using `db` backend)
- `blobPath` - Path to diff file (if using `db-file` backend)
- `eventId` - Unique event UUID

Plus indexes on the commonly filtered fields for fast queries.

## Performance

- **Sync mode**: Adds 10-50ms per write operation
- **Async mode**: Adds <5ms (just queuing time)
- **Queries**: Usually under 100ms with proper indexes
- **Update diffs**: Adds one extra database query to fetch before state (~5-10ms)

For high-traffic sites, use async mode and the db-file backend.

### Input Limits

To prevent abuse, the API enforces these limits:
- Max page size (`_limit`): 100 records
- Min page size: 1 record
- Min page number: 1
- Invalid dates return 400 Bad Request
- Invalid IDs return 400 Bad Request

## Changelog

### Version 1.0.1 (2025-10-26)

Bug fixes and improvements:
- Fixed userId filter (was using 'user' instead of 'userId')
- Improved diff accuracy for updates by fetching before state
- Added input validation for pagination, dates, and IDs
- Added config validation with helpful warnings
- Better error handling and logging
- Security: Max page size limit to prevent DOS

### Version 1.0.0 (2025-10-26)

Initial release with:
- Automatic audit logging for create/update/delete operations
- REST API for querying and filtering logs
- Role-based access control
- Database indexes for performance
- Support for both sync and async modes
- Support for both db and db-file storage backends

## License

See the [LICENSE](../../LICENSE) file in the repo root.

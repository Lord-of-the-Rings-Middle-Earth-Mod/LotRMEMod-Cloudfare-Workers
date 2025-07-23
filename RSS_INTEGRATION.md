# RSS-Feed to Discord Integration

This module implements automatic RSS feed monitoring and Discord webhook integration for the Fabric MC blog posts.

## Features

- **Automatic RSS Polling**: Runs daily via cron job (0 0 * * *)
- **Duplicate Prevention**: Uses KV storage to track processed entries
- **Discord Integration**: Sends formatted messages with embeds, buttons, and threads
- **Manual Triggering**: POST endpoint for testing and manual execution

## Configuration

- **RSS Feed**: `https://fabricmc.net/feed.xml`
- **Discord Webhook**: Configured in `config.js` as `WEBHOOKS.fabricblog`
- **Role Ping**: `<@&1371820347543916554>` for fabric updates
- **KV Storage**: Uses `FABRIC_KV` namespace for entry tracking

## Endpoints

### Automatic Execution
- **Cron Schedule**: `0 0 * * *` (daily at midnight)
- **Handler**: `scheduled()` function in `index.js`

### Manual Trigger
- **Endpoint**: `POST /rss`
- **Usage**: For testing or manual execution
- **Response**: Status of processing (number of new entries)

## Message Format

Each RSS entry is formatted as a Discord message with:

```json
{
  "content": "<@&1371820347543916554>",
  "embeds": [{
    "footer": { "text": "The original Post was made on the Fabric RSS-Feed" },
    "title": "Entry Title",
    "url": "Entry Link",
    "description": "Cleaned HTML Content",
    "timestamp": "ISO Date"
  }],
  "components": [{
    "type": 1,
    "components": [{
      "type": 2,
      "style": 5,
      "label": "Original Post",
      "url": "Entry Link"
    }]
  }],
  "username": "Fabric RSS Bot",
  "thread_name": "Entry Title",
  "avatar_url": "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256"
}
```

## Error Handling

- Network failures are logged but don't stop processing other entries
- XML parsing errors are caught and reported
- KV storage failures are handled gracefully
- Discord webhook failures are retried (by Discord's built-in retry logic)

## Testing

To test the RSS integration:

1. **Manual Trigger**: `curl -X POST https://your-worker.workers.dev/rss`
2. **Check Logs**: Monitor Cloudflare Worker logs for processing status
3. **Verify Discord**: Check the configured Discord channel for new messages
4. **KV Storage**: Verify entries are being tracked in FABRIC_KV

## Files Modified

- `src/index.js`: Added RSS route and cron handling
- `src/rss.js`: New RSS handler module (main implementation)
- `src/config.js`: Fixed ping format for fabric updates

## Dependencies

- Native Cloudflare Worker APIs (fetch, DOMParser)
- KV storage for persistence
- Discord webhook for message delivery
- No external libraries required
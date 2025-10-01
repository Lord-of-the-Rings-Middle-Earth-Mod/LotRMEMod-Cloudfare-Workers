# RSS-Feed to Discord Integration

This module implements automatic RSS feed monitoring and Discord webhook integration for the Fabric MC blog posts.

## Features

- **Automatic RSS Polling**: Runs daily via cron job (0 0 * * *)
- **Duplicate Prevention**: Uses KV storage to track processed entries
- **Multi-Message Support**: Automatically splits long RSS posts across multiple messages
- **Forum Thread Integration**: Creates dedicated forum threads for each RSS post
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

### Forum Thread Creation

Each RSS entry creates a new forum thread with the first message containing full metadata:

```json
{
  "content": "<@&1371820347543916554>\n\nFirst chunk of cleaned HTML content",
  "embeds": [{
    "footer": { "text": "The original Post was made on the Fabric RSS-Feed" },
    "title": "Entry Title",
    "url": "Entry Link",
    "timestamp": "ISO Date"
  }],
  "components": [{
    "type": 1,
    "components": [{
      "type": 2,
      "style": 5,
      "label": "Original Post",
      "url": "Entry Link"
    }, {
      "type": 2,
      "style": 5,
      "url": "https://fabricmc.net/blog/",
      "label": "Fabric Feed"
    }]
  }],
  "username": "Fabric RSS Bot",
  "thread_name": "Entry Title",
  "avatar_url": "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256"
}
```

### Follow-up Messages

For RSS posts longer than ~1950 characters, additional content is sent as follow-up messages within the same thread:

```json
{
  "content": "Additional content chunk",
  "username": "Fabric RSS Bot",
  "avatar_url": "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256"
}
```

### Content Splitting Algorithm

The system intelligently splits long content to preserve readability:

1. **Paragraph boundaries**: Splits at double newlines (`\n\n`) first
2. **Sentence boundaries**: Splits at sentence endings (`.`, `!`, `?`) if paragraphs are too long
3. **Word boundaries**: Splits at spaces if sentences are too long
4. **Character limits**: Force-splits extremely long words if necessary

Each chunk respects Discord's 2000 character limit while accounting for role pings and formatting.

## Error Handling

- Network failures are logged but don't stop processing other entries
- XML parsing errors are caught and reported
- KV storage failures are handled gracefully
- Discord webhook failures are retried (by Discord's built-in retry logic)
- Thread creation failures are handled gracefully with fallback to single message
- Follow-up message failures don't prevent processing of other content chunks

## Testing

To test the RSS integration:

1. **Manual Trigger**: `curl -X POST https://your-worker.workers.dev/rss`
2. **Check Logs**: Monitor Cloudflare Worker logs for processing status
3. **Verify Discord**: Check the configured Discord channel for new messages
4. **KV Storage**: Verify entries are being tracked in FABRIC_KV

## Files Modified

- `src/index.js`: Added RSS route and cron handling
- `src/rss.js`: New RSS handler module with multi-message support and intelligent content splitting
- `src/discord.js`: Enhanced to return Discord API responses for thread ID extraction
- `src/config.js`: Fixed ping format for fabric updates

## Dependencies

- Native Cloudflare Worker APIs (fetch only - uses regex-based XML parsing)
- [KV Storage](KV_STORAGE.md) for entry tracking and persistence
- [Discord Integration](DISCORD_INTEGRATION.md) for webhook message delivery
- Configuration from `config.js` for webhooks and role pings
- No external libraries required

## Related Documentation

- [Discord Integration](DISCORD_INTEGRATION.md) - Shared Discord posting functionality
- [KV Storage](KV_STORAGE.md) - Persistent storage utilities used for tracking
- [Configuration](README.md#configuration) - Webhook and role configuration details
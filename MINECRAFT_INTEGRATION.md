# Minecraft News to Discord Integration

This module implements automatic Minecraft article monitoring and Discord webhook integration for Minecraft.net articles.

## Features

- **Automatic Article Polling**: Runs daily via cron job (0 0 * * *)
- **Duplicate Prevention**: Uses KV storage to track processed articles
- **HTML Parsing**: Edge-compatible regex-based HTML parsing for article extraction
- **Forum Thread Integration**: Creates dedicated forum threads for each article
- **Discord Integration**: Sends formatted messages with embeds and buttons
- **Manual Triggering**: POST endpoint for testing and manual execution
- **Rate Limiting**: Processes maximum 5 articles per run to avoid flooding

## Configuration

### Discord Webhook

Configure in `src/config.js`:

```javascript
export const WEBHOOKS = {
  minecraftnews: "https://discord.com/api/webhooks/PLACEHOLDER_MINECRAFT_NEWS_WEBHOOK_ID/PLACEHOLDER_MINECRAFT_NEWS_WEBHOOK_TOKEN"
};
```

**⚠️ Important:** Replace `PLACEHOLDER_MINECRAFT_NEWS_WEBHOOK_ID` and `PLACEHOLDER_MINECRAFT_NEWS_WEBHOOK_TOKEN` with your actual Discord webhook values from your Discord server settings.

### Role Ping

Configure in `src/config.js`:

```javascript
export const PINGS = {
  minecraftnews: "<@&PLACEHOLDER_MINECRAFT_NEWS_ROLE_ID>"
};
```

**⚠️ Important:** Replace `PLACEHOLDER_MINECRAFT_NEWS_ROLE_ID` with your actual Discord role ID for Minecraft news notifications.

### KV Storage

Uses the existing `FABRIC_KV` namespace for article tracking:

```toml
[[kv_namespaces]]
binding = "FABRIC_KV"
id = "c762173a2f01465faee2d33d4631e9c8"
```

## Endpoints

### Automatic Execution
- **Cron Schedule**: `0 0 * * *` (daily at midnight UTC)
- **Handler**: `scheduled()` function in `index.js`

### Manual Trigger
- **Endpoint**: `POST /minecraft`
- **Usage**: For testing or manual execution
- **Response**: Status of processing (number of new articles)

## Article Source

- **URL**: `https://www.minecraft.net/en-us/articles`
- **Parsing Method**: Regex-based HTML parsing (Edge-compatible)
- **Extracted Data**:
  - Title (required)
  - URL (required)
  - Date (optional)
  - Teaser/description (optional)

## Message Format

### Forum Thread Creation

Each article creates a new forum thread with the first message containing:

```json
{
  "content": "<@&PLACEHOLDER_MINECRAFT_NEWS_ROLE_ID>\n\n[Teaser text if available]\n\n*[Read the full article on Minecraft.net]*",
  "thread_name": "Article Title",
  "embeds": [{
    "footer": { "text": "The original article was published on Minecraft.net" },
    "title": "Article Title",
    "url": "Article URL",
    "timestamp": "ISO Date"
  }],
  "components": [{
    "type": 1,
    "components": [{
      "type": 2,
      "style": 5,
      "label": "Read Article",
      "url": "Article URL"
    }, {
      "type": 2,
      "style": 5,
      "url": "https://www.minecraft.net/en-us/articles",
      "label": "All Articles"
    }]
  }],
  "username": "Minecraft News Bot",
  "avatar_url": "https://www.minecraft.net/etc.clientlibs/minecraft/clientlibs/main/resources/img/minecraft-creeper-icon.jpg"
}
```

## Article Parsing

The system uses regex-based parsing to extract articles from the HTML page:

1. **Article Detection**: Looks for `<article>` tags or div elements with "card" class
2. **Link Extraction**: Finds `href` attributes containing "/article"
3. **Title Extraction**: Extracts text from `<h2>`, `<h3>`, or `<h4>` heading tags
4. **Date Extraction**: Searches for `<time>` elements or date patterns
5. **Teaser Extraction**: Looks for description paragraphs or teaser text

### Supported HTML Patterns

```html
<!-- Pattern 1: Article with link and heading -->
<article class="article-card">
  <a href="/en-us/article/minecraft-snapshot-24w01a">
    <h2>Minecraft Snapshot 24w01a</h2>
    <p class="description">This week's snapshot brings exciting new features!</p>
  </a>
</article>

<!-- Pattern 2: Card-style div -->
<div class="card">
  <a href="/en-us/article/minecraft-update">
    <h3>Minecraft Update</h3>
    <time datetime="2024-01-01">2 days ago</time>
  </a>
</div>
```

## Error Handling

- Network failures are logged but don't stop processing other articles
- HTML parsing errors are caught and handled gracefully
- KV storage failures are handled with fallback behavior
- Discord webhook failures are retried (by Discord's built-in retry logic)
- Invalid URLs or missing required fields skip the article
- Maximum 5 articles per run to prevent rate limiting

## Duplicate Prevention

The system tracks processed articles using KV storage:

- **Key**: `minecraft_processed_articles`
- **Storage**: Article URLs are stored in an array
- **Limit**: Only last 100 articles are kept to prevent unbounded growth
- **Comparison**: New articles are filtered by comparing URLs

## Testing

To test the Minecraft integration:

1. **Manual Trigger**: `curl -X POST https://your-worker.workers.dev/minecraft`
2. **Check Logs**: Monitor Cloudflare Worker logs for processing status
3. **Verify Discord**: Check the configured Discord channel for new messages
4. **KV Storage**: Verify articles are being tracked in FABRIC_KV

## Rate Limiting

The system includes built-in rate limiting:

- **Maximum Articles**: 5 articles per run
- **Processing Order**: Oldest articles first
- **Cron Schedule**: Once daily to avoid excessive requests

To modify rate limits, edit `src/minecraft.js`:

```javascript
// Process new articles (limit to 5 to avoid flooding)
const articlesToProcess = newArticles.slice(0, 5);
```

## Files Modified

- `src/index.js`: Added `/minecraft` route and cron handling
- `src/minecraft.js`: New module for Minecraft article handling
- `src/config.js`: Added webhook and ping configuration
- `tests/minecraft.test.js`: Comprehensive test suite with 18 tests
- `tests/config.test.js`: Updated to support placeholder validation

## Dependencies

- Native Cloudflare Worker APIs (fetch only)
- [KV Storage](KV_STORAGE.md) for article tracking
- [Discord Integration](DISCORD_INTEGRATION.md) for webhook message delivery
- Configuration from `config.js` for webhooks and role pings
- No external libraries required

## Related Documentation

- [Discord Integration](DISCORD_INTEGRATION.md) - Shared Discord posting functionality
- [KV Storage](KV_STORAGE.md) - Persistent storage utilities
- [RSS Integration](RSS_INTEGRATION.md) - Similar pattern for Fabric blog
- [Configuration](README.md#configuration) - Webhook and role configuration details

## Optional Enhancements

Future improvements that could be added:

- **Category Filtering**: Filter articles by type (Snapshots, Updates, News)
- **Image Extraction**: Include article images in Discord embeds
- **Enhanced Date Parsing**: Better handling of relative dates ("X days ago")
- **Content Preview**: Include more content in the Discord message
- **Language Support**: Support for multiple language versions of the site

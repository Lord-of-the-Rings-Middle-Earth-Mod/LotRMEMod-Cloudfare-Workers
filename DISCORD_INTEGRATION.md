# Discord Integration

This module provides shared Discord webhook functionality used by all other integrations in the worker. It handles the actual posting of messages to Discord channels via webhooks.

## Features

- **Webhook Posting**: Sends HTTP POST requests to Discord webhook URLs
- **Error Handling**: Provides consistent error responses across all integrations
- **JSON Formatting**: Handles JSON serialization of Discord payloads
- **Status Reporting**: Returns appropriate HTTP status codes

## Core Function

### `postToDiscord(webhookUrl, payload)`

The main function that handles all Discord communications:

```javascript
export async function postToDiscord(webhookUrl, payload)
```

**Parameters:**
- `webhookUrl` (string): The Discord webhook URL to post to
- `payload` (object): The Discord message payload object

**Returns:**
- `Response`: HTTP response with status 200 (success) or 500 (error)

## Discord Payload Format

The function accepts standard Discord webhook payload objects. Common structure:

```json
{
  "username": "Bot Name",
  "avatar_url": "https://example.com/avatar.jpg",
  "content": "Message content",
  "embeds": [{
    "title": "Embed Title",
    "description": "Embed Description", 
    "url": "https://example.com",
    "color": 1190012,
    "timestamp": "2024-01-01T00:00:00.000Z",
    "footer": {
      "text": "Footer text"
    },
    "fields": [{
      "name": "Field Name",
      "value": "Field Value",
      "inline": true
    }]
  }],
  "components": [{
    "type": 1,
    "components": [{
      "type": 2,
      "style": 5,
      "label": "Button Label",
      "url": "https://example.com"
    }]
  }],
  "thread_name": "Thread Name" // Creates thread if specified
}
```

## Usage by Other Modules

### GitHub Integration
```javascript
import { postToDiscord } from './discord.js';
import { WEBHOOKS } from './config.js';

// Post announcement to news channel
await postToDiscord(WEBHOOKS.news, newsPayload);
```

### RSS Integration  
```javascript
import { postToDiscord } from './discord.js';
import { WEBHOOKS } from './config.js';

// Post RSS entry to fabric blog channel
await postToDiscord(WEBHOOKS.fabricblog, rssPayload);
```

### Mail Integration
```javascript
import { postToDiscord } from './discord.js';
import { WEBHOOKS } from './config.js';

// Forward email to mails channel
await postToDiscord(WEBHOOKS.mails, mailPayload);
```

## Error Handling

The function provides consistent error handling across all integrations:

- **Success Response**: `200 OK` with "Success" message
- **Discord API Error**: `500 Internal Server Error` with Discord error details
- **Network Failures**: Propagated as 500 errors with descriptive messages

### Error Response Format
```json
{
  "status": 500,
  "body": "Discord Webhook Error: {Discord API error message}"
}
```

## Configuration Integration

Works seamlessly with the configuration system:

```javascript
// From config.js
export const WEBHOOKS = {
  news: "https://discord.com/api/webhooks/...",
  changelog: "https://discord.com/api/webhooks/...", 
  suggestions: "https://discord.com/api/webhooks/...",
  fabricblog: "https://discord.com/api/webhooks/...",
  mails: "https://discord.com/api/webhooks/..."
};

export const AVATAR_URL = "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256";
export const FOOTER_TEXT = "This post originates from GitHub.";
```

## Discord Webhook Features

Supports all Discord webhook features:

- **Usernames and Avatars**: Custom bot appearance per message
- **Embeds**: Rich formatted content with colors, fields, footers
- **Components**: Buttons and other interactive elements
- **Threads**: Automatic thread creation for organized discussions
- **Role Mentions**: Ping specific roles in messages
- **File Attachments**: Can be included in payload (not currently used)

## Testing

To test Discord integration functionality:

1. **Direct Testing**: Call function with test payload
```javascript
const testPayload = {
  username: "Test Bot",
  content: "Test message"
};
await postToDiscord(WEBHOOKS.news, testPayload);
```

2. **Integration Testing**: Test via other module endpoints
3. **Discord Verification**: Check Discord channels for posted messages
4. **Error Testing**: Test with invalid webhook URLs

## Rate Limiting

- **Discord Limits**: Discord webhook rate limits are handled by Discord's API
- **Retry Logic**: Discord automatically retries failed requests
- **Worker Limits**: No specific rate limiting implemented in worker

## Security

- **Webhook URLs**: Stored in configuration, not exposed in responses
- **Content Validation**: No input sanitization (relies on Discord's handling)
- **Authentication**: Uses Discord webhook tokens for authentication

## Files

- `src/discord.js`: Main Discord integration implementation
- `src/config.js`: Webhook URLs and common settings

## Dependencies

- Native Cloudflare Worker `fetch()` API
- JSON serialization/deserialization
- No external libraries required

## Related Documentation

- [GitHub Integration](GITHUB_INTEGRATION.md) - Uses Discord integration for posting
- [RSS Integration](RSS_INTEGRATION.md) - Uses Discord integration for RSS posts  
- [Mail Integration](MAIL_INTEGRATION.md) - Uses Discord integration for email forwarding
- [Configuration](README.md#configuration) - Webhook and settings configuration
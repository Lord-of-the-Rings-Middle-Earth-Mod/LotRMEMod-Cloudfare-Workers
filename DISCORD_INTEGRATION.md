# Discord Integration

This module provides shared Discord webhook functionality used by all other integrations in the worker. It handles the actual posting of messages to Discord channels via webhooks.

## Features

- **Webhook Posting**: Sends HTTP POST requests to Discord webhook URLs
- **Error Handling**: Provides consistent error responses across all integrations
- **JSON Formatting**: Handles JSON serialization of Discord payloads
- **Status Reporting**: Returns appropriate HTTP status codes

## Core Function

### `postToDiscord(webhookUrl, payload, maxRetries = 3)`

The main function that handles all Discord communications with built-in rate limiting and retry logic:

```javascript
export async function postToDiscord(webhookUrl, payload, maxRetries = 3)
```

**Parameters:**
- `webhookUrl` (string): The Discord webhook URL to post to
- `payload` (object): The Discord message payload object
- `maxRetries` (number, optional): Maximum retry attempts for rate limiting and errors (default: 3)

**Returns:**
- `Response`: HTTP response with status 200 (success), 429 (rate limit exceeded), or 500 (error)
- **Success Response**: JSON object with Discord API response data including thread information

**Rate Limiting Features:**
- Automatically retries on HTTP 429 "Too Many Requests" responses
- Respects Discord's `Retry-After` header for optimal retry timing
- Falls back to exponential backoff if no `Retry-After` header is provided
- Also retries on network errors and 5xx server errors
- Configurable maximum retry attempts to prevent infinite loops

**Enhanced Response Format:**
```json
{
  "success": true,
  "discordResponse": {
    "id": "message_id",
    "channel_id": "thread_id_if_thread_created",
    "guild_id": "guild_id",
    "timestamp": "2024-01-01T00:00:00.000000+00:00",
    // ... other Discord API response fields
  }
}
```

The `channel_id` field contains the thread ID when a new forum thread is created, enabling follow-up messages to be sent to the same thread using the `?thread_id=` parameter.

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

## Multi-Message Thread Support

The Discord integration now supports coordinated multi-message posting within forum threads:

### Thread Creation

When a payload includes `thread_name`, Discord creates a new forum thread and returns the thread ID in the response:

```javascript
const response = await postToDiscord(webhookUrl, {
  content: "First message content",
  thread_name: "Thread Title",
  // ... other payload properties
});

const responseData = await response.json();
const threadId = responseData.discordResponse?.channel_id;
```

### Follow-up Messages

Additional messages can be sent to the same thread using the `?thread_id=` parameter:

```javascript
const threadWebhookUrl = `${webhookUrl}?thread_id=${threadId}`;
await postToDiscord(threadWebhookUrl, {
  content: "Follow-up message content",
  username: "Bot Name",
  avatar_url: "https://example.com/avatar.jpg"
});
```

### Usage Pattern

This enables sending complete long-form content across multiple messages while maintaining organization:

1. Send first message with full metadata (embed, buttons, role ping) to create thread
2. Extract thread ID from Discord API response
3. Send additional content chunks to the same thread
4. Each message maintains consistent bot identity (username, avatar)

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

// Post RSS entry first message to create thread
const firstResponse = await postToDiscord(WEBHOOKS.fabricblog, firstPayload);
const responseData = await firstResponse.json();
const threadId = responseData.discordResponse?.channel_id;

// Send follow-up messages to the same thread
const threadWebhookUrl = `${WEBHOOKS.fabricblog}?thread_id=${threadId}`;
await postToDiscord(threadWebhookUrl, followUpPayload);
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
- **Thread Follow-ups**: Send additional messages to existing threads using `?thread_id=` parameter
- **Role Mentions**: Ping specific roles in messages
- **Multi-Message Support**: Coordinate multiple messages within the same thread
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

- **Discord Limits**: Discord webhook rate limits (HTTP 429) are now handled with automatic retry logic
- **Retry Logic**: Implements exponential backoff with respect for Discord's `Retry-After` header
- **Max Retries**: Configurable maximum retry attempts (default: 3) to prevent infinite loops
- **Backoff Strategy**: Uses Discord's `Retry-After` header when available, falls back to exponential backoff (2s, 4s, 8s)
- **Error Recovery**: Also retries on network errors and 5xx server errors with exponential backoff

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
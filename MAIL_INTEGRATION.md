# Mail to Discord Integration

This module implements email forwarding functionality that receives emails and forwards them to a Discord channel via webhook.

## Features

- **Email Reception**: Processes incoming emails via HTTP POST requests
- **Discord Forwarding**: Automatically forwards email content to Discord
- **Content Parsing**: Handles both plain text and HTML email content
- **Sender Information**: Includes sender details and subject in Discord message
- **Content Truncation**: Limits message length to prevent Discord API limits

## Configuration

- **Discord Webhook**: Uses `WEBHOOKS.mails` from `config.js`
- **Avatar**: Uses `AVATAR_URL` from config for consistent branding
- **Footer Text**: Uses `FOOTER_TEXT` from config

## Endpoints

### Email Handler
- **Endpoint**: `POST /mails`
- **Handler**: `handleMails()` function in `mails.js`
- **Content-Type**: `application/json`
- **Purpose**: Receives email data and forwards to Discord

## Email Data Format

The endpoint expects JSON data with the following structure:

```json
{
  "headers": {
    "subject": "Email Subject"
  },
  "envelope": {
    "from": "sender@example.com"
  },
  "plain": "Plain text content",
  "html": "HTML content (fallback if no plain text)"
}
```

## Message Format

Discord messages are formatted as follows:

```json
{
  "username": "LotR ME Mail Bot",
  "avatar_url": "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256",
  "content": "📧 New E-Mail from \"{sender}\":\n# \"{subject}\"\n\n\"{body}\"",
  "embeds": [],
  "thread_name": "\"{subject}\"",
  "applied_tags": ["1398967786860183724"]
}
```

### Content Processing

- **Sender**: Extracted from `envelope.from` or defaults to "Unknown sender"
- **Subject**: Extracted from `headers.subject` or defaults to "No Subject"  
- **Body**: Uses `plain` content first, falls back to `html`, or "No content"
- **Formatting**: Email indicator emoji (📧) and markdown header formatting for subject
- **Threading**: Creates forum thread with email subject as thread name
- **Tagging**: Automatically applies "Unread" tag (ID: 1398967786860183724) to all mail posts

## Error Handling

- **JSON Parsing Errors**: Returns 500 status with error message
- **Missing Fields**: Gracefully handles missing headers, envelope, or content
- **Discord Failures**: Inherits error handling from [Discord Integration](DISCORD_INTEGRATION.md)
- **Network Issues**: Caught and returned as 500 status responses

## Use Cases

- **Contact Form**: Website contact forms can POST to this endpoint
- **Email Forwarding**: Email servers can forward specific emails
- **Notification System**: Applications can send email-like notifications
- **Support Integration**: Customer support emails can be automatically posted

## Testing

To test the mail integration:

1. **Manual Test**: Send POST request with email data structure
```bash
curl -X POST https://your-worker.workers.dev/mails \
  -H "Content-Type: application/json" \
  -d '{
    "headers": {"subject": "Test Email"},
    "envelope": {"from": "test@example.com"},
    "plain": "This is a test email content."
  }'
```

2. **Email Server Integration**: Configure email server to POST to endpoint
3. **Check Logs**: Monitor Cloudflare Worker logs for processing status
4. **Verify Discord**: Check the mails Discord channel for new messages

## Security Considerations

- **No Authentication**: Endpoint is currently open - consider adding authentication
- **Content Filtering**: No content filtering applied - raw email content forwarded
- **Rate Limiting**: No built-in rate limiting - consider Cloudflare rate limiting
- **Spam Protection**: Consider implementing spam detection for production use

## Files Modified

- `src/index.js`: Added mails route handling
- `src/mails.js`: Main email processing implementation
- `src/config.js`: Mail webhook URL configuration
- `src/discord.js`: Shared Discord posting functionality

## Dependencies

- [Discord Integration](DISCORD_INTEGRATION.md) for message posting
- Configuration from `config.js` for webhook URL
- Native JSON parsing and HTTP handling
- No external libraries required

## Related Documentation

- [Discord Integration](DISCORD_INTEGRATION.md) - Shared Discord posting functionality
- [Configuration](README.md#configuration) - Webhook configuration details
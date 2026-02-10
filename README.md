# LotRMEMod-Cloudflare-Workers

This repository contains a Cloudflare Worker that provides multiple Discord integrations for the Lord of the Rings Middle Earth Mod community. The worker handles automated posting of content from various sources to Discord channels via webhooks.

Test Coverage
[![codecov](https://codecov.io/gh/Lord-of-the-Rings-Middle-Earth-Mod/LotRMEMod-Cloudfare-Workers/graph/badge.svg?token=H4VWZ2MSHC)](https://codecov.io/gh/Lord-of-the-Rings-Middle-Earth-Mod/LotRMEMod-Cloudfare-Workers)

## Features Overview

The worker provides the following major functionalities:

- **[GitHub Integration](GITHUB_INTEGRATION.md)** - Automatically posts GitHub events (forks, wiki changes, discussions, releases, issues, pull requests, workflow runs) to Discord with optional artifact attachments
- **[RSS Integration](RSS_INTEGRATION.md)** - Monitors Fabric MC blog RSS feed and posts complete content to Discord using multi-message threads  
- **[Mail Integration](MAIL_INTEGRATION.md)** - Forwards emails to Discord channels
- **[Discord Integration](DISCORD_INTEGRATION.md)** - Shared Discord posting functionality with multi-message thread support and file attachment capabilities used by all modules
- **[KV Storage](KV_STORAGE.md)** - Utilities for persistent data storage

## Architecture

The worker is built using Cloudflare Workers with a modular architecture:

```
src/
├── index.js          # Main entry point and routing
├── github.js         # GitHub webhook handling
├── rss.js           # RSS feed monitoring
├── mails.js         # Email forwarding  
├── discord.js       # Shared Discord posting
├── kvutils.js       # KV storage utilities
└── config.js        # Configuration and constants
```

## Endpoints

The worker exposes the following HTTP endpoints:

- `POST /github` - GitHub webhook receiver for repository events (forks, wiki changes, discussions, releases, issues, pull requests)
- `POST /mails` - Email forwarding endpoint  
- `POST /rss` - Manual RSS feed processing trigger

## Scheduled Tasks

- **Daily RSS Check**: Runs at midnight UTC (`0 0 * * *`) to check for new Fabric MC blog posts

## Configuration

### Discord Webhooks

Webhook URLs are configured in `src/config.js`:

```javascript
export const WEBHOOKS = {
  news: "https://discord.com/api/webhooks/...",        // GitHub announcements & releases
  changelog: "https://discord.com/api/webhooks/...",   // Release changelog details  
  suggestions: "https://discord.com/api/webhooks/...", // GitHub suggestions
  fabricblog: "https://discord.com/api/webhooks/...",  // Fabric RSS updates
  mails: "https://discord.com/api/webhooks/...",       // Email forwarding
  issues: "https://discord.com/api/webhooks/...",      // GitHub issues
  prs: "https://discord.com/api/webhooks/...",         // GitHub pull requests
  contributions: "https://discord.com/api/webhooks/..." // Asset-related issues (forum)
};
```

**⚠️ Important:** All webhook URLs must be replaced with actual Discord webhook URLs from your Discord server settings. URLs containing "PLACEHOLDER" will cause API errors.

### Role Pings

Discord role pings are configured for different content types:

```javascript
export const PINGS = {
  news: "<@&1297538431001432135>",           // News announcements
  monthly: "<@&1346200306911940639>",        // Monthly updates
  release: "<@&1297543002222493761>",        // Release notifications  
  fabricupdates: "<@&1371820347543916554>"   // Fabric blog updates
};
```

### KV Storage

Cloudflare KV is used for persistent storage:

```toml
[[kv_namespaces]]
binding = "FABRIC_KV"
id = "c762173a2f01465faee2d33d4631e9c8"
```

### GitHub Token (Optional)

For the workflow artifact attachment feature, configure a GitHub Personal Access Token as a Cloudflare Worker secret:

```bash
# Set GitHub token as a secret
wrangler secret put GITHUB_TOKEN
```

**Required Token Scopes:**
- `actions:read` - To read workflow run information and artifacts
- `repo` - To access repository data

**Note:** If not configured, GitHub workflow notifications will work normally but without artifact attachments.

## Deployment

The worker is deployed using Wrangler:

```bash
# Deploy to Cloudflare
wrangler deploy

# View logs
wrangler tail

# Local development
wrangler dev
```

## Dependencies

The worker uses only native Cloudflare Worker APIs:

- **Fetch API** - HTTP requests and webhook posting
- **KV Storage** - Persistent data storage
- **DOMParser** - XML/RSS feed parsing
- **Scheduled Events** - Cron job execution

No external libraries or npm packages are required.

## Error Handling

Each module implements comprehensive error handling:

- **Network Failures** - Logged and gracefully handled
- **API Errors** - Appropriate HTTP status codes returned
- **Data Validation** - Missing or invalid data handled safely
- **Discord Limits** - Automatic retries handled by Discord's API

## Testing

Each integration can be tested individually:

- **GitHub**: Configure webhook in repository settings
- **RSS**: Use `POST /rss` endpoint for manual testing
- **Mail**: Send POST request with email data structure
- **Discord**: Monitor Discord channels for posted messages

## Documentation

Detailed documentation is available for each module:

- **[GitHub Integration](GITHUB_INTEGRATION.md)** - GitHub webhook processing and Discord posting
- **[RSS Integration](RSS_INTEGRATION.md)** - Fabric MC blog monitoring with multi-message posting
- **[Mail Integration](MAIL_INTEGRATION.md)** - Email forwarding to Discord
- **[Discord Integration](DISCORD_INTEGRATION.md)** - Shared Discord posting with thread support  
- **[KV Storage](KV_STORAGE.md)** - Persistent storage utilities

## Contributing

When adding new features:

1. Follow the existing modular architecture
2. Use the shared [Discord Integration](DISCORD_INTEGRATION.md) for posting
3. Add configuration to `config.js` for webhooks and pings
4. Use [KV Storage](KV_STORAGE.md) utilities for persistence
5. Document the new functionality following existing patterns

## License

This project is licensed under the terms specified in the LICENSE file.

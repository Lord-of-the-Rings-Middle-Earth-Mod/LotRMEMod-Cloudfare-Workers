# GitHub to Discord Integration

This module implements automatic GitHub webhook processing and Discord integration for repository events like discussions and releases.

## Features

- **Webhook Processing**: Handles GitHub webhooks for discussions and releases
- **Discussion Routing**: Routes announcements and suggestions to appropriate Discord channels
- **Release Management**: Automatically posts release announcements to news and changelog channels
- **Role Pinging**: Automatically pings relevant roles based on content and labels
- **Thread Support**: Creates threads for suggestions to organize discussions
- **Interactive Buttons**: Adds clickable buttons to messages for quick navigation to GitHub and Discord channels

## Configuration

### Discord Webhooks Setup

Before the integration can work, you must configure valid Discord webhook URLs in `src/config.js`:

- **WEBHOOKS.news** for announcements and releases
- **WEBHOOKS.suggestions** for ideas and suggestions  
- **WEBHOOKS.changelog** for detailed release notes
- **WEBHOOKS.issues** for new GitHub issues
- **WEBHOOKS.prs** for pull request notifications ⚠️ **REQUIRED**

**Important:** Replace placeholder URLs with actual Discord webhook URLs from your server settings. URLs containing "PLACEHOLDER" will cause 405 Method Not Allowed errors.

### GitHub Webhook Setup

- **GitHub Webhooks**: Configure webhook in your repository settings to point to the `/github` endpoint
- **Events**: Enable webhook for discussions, releases, issues, and pull requests
- **Content Type**: Set to `application/json`

### Additional Configuration

- **Role Pings**: Configured in `config.js` as `PINGS` object
- **Avatar**: Uses `AVATAR_URL` from config for consistent branding

## Endpoints

### GitHub Webhook Handler
- **Endpoint**: `POST /github`
- **Handler**: `handleGitHubWebhook()` function in `github.js`
- **Supported Events**: 
  - Discussion created (announcements, suggestions)
  - Release published
  - Issue opened
  - Pull request events (opened, ready_for_review, review_requested, reopened, synchronize)

## Supported GitHub Events

### Pull Requests
- **Pull Request Events**:
  - Routes to PRs channel with contributor role ping
  - Username: "Lotr ME Mod PRs"  
  - Includes "PR on GitHub" button linking to the specific PR
  - **Supported Actions**:
    - `opened` (if not draft)
    - `ready_for_review` 
    - `review_requested`
    - `reopened` (if not draft)
    - `synchronize` (if not draft)
  - **Draft Filtering**: Draft PRs are ignored for opened/reopened/synchronize actions
  - **Message Formats**: Different templates for general PR events vs review requests

### Issues
- **New Issues**:
  - Routes to issues channel with issue details
  - Username: "LotR ME Mod Issues"
  - Includes issue title, author, description, and labels
  - Includes "Issue on GitHub" button linking to the original issue
  - Handles issues with or without labels and descriptions
  - Only processes "opened" action events

### Discussions
- **Announcements Category**: 
  - Routes to news channel with news role ping
  - Special handling for "Monthly Updates" label (uses monthly role ping)
  - Username: "GitHub Announcements"
  - Title prefix: "GitHub Announcement"
  - Includes "View on GitHub" button linking to the original discussion

- **Ideas and Suggestions Category**:
  - Routes to suggestions channel
  - Creates Discord thread for organization
  - Username: "GitHub Suggestions" 
  - Title prefix: "GitHub Suggestion"
  - Includes "View on GitHub" button linking to the original discussion

### Releases
- **Dual Channel Posting**:
  - **News Channel**: Announcement with download links and changelog reference
  - **Changelog Channel**: Full release notes and detailed information
- **Role Ping**: Uses release role ping for notifications
- **Links**: Provides both GitHub release and changelog links
- **Interactive Buttons**: News channel includes buttons for quick access to changelog Discord channel and GitHub release

## Message Format

### Pull Request Messages

**Standard PR Events (opened, ready_for_review, reopened, synchronize):**
```json
{
  "components": [
    {
      "type": 1,
      "components": [
        {
          "type": 2,
          "style": 5,
          "label": "PR on GitHub",
          "url": "{pull_request.html_url}"
        }
      ]
    }
  ],
  "avatar_url": "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256",
  "username": "Lotr ME Mod PRs",
  "embeds": [
    {
      "title": "PR {number} {action}",
      "description": "<@&1301093445951164498>\nThe PR {number} from {user} is ready for review.\n",
      "timestamp": "ISO Date",
      "footer": {
        "text": "The PR was {action} on "
      }
    }
  ]
}
```

**Review Request Events:**
```json
{
  "components": [
    {
      "type": 1,
      "components": [
        {
          "type": 2,
          "style": 5,
          "label": "PR on GitHub",
          "url": "{pull_request.html_url}"
        }
      ]
    }
  ],
  "avatar_url": "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256",
  "username": "Lotr ME Mod PRs",
  "embeds": [
    {
      "title": "PR {number} review requested",
      "description": "<@&1301093445951164498>\n{user} has requested {requested} to review his PR {number}.\n",
      "timestamp": "ISO Date",
      "footer": {
        "text": "The PR was review requested on "
      }
    }
  ]
}
```

### Issue Messages
```json
{
  "username": "LotR ME Mod Issues",
  "avatar_url": "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256",
  "embeds": [{
    "title": "{issue.title}",
    "author": {
      "name": "{issue.user.login}"
    },
    "description": "{issue.body}",
    "fields": [{
      "name": "Labels",
      "value": "{comma-separated labels or 'None'}"
    }],
    "timestamp": "ISO Date",
    "footer": { "text": "This issue was created on GitHub" }
  }],
  "components": [{
    "type": 1,
    "components": [{
      "type": 2,
      "style": 5,
      "label": "Issue on GitHub",
      "url": "{issue.html_url}"
    }]
  }]
}
```

### Discussion Messages
```json
{
  "username": "GitHub Announcements|GitHub Suggestions",
  "avatar_url": "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256",
  "embeds": [{
    "title": "GitHub Announcement|Suggestion: {title}",
    "description": "{ping} {body}",
    "url": "{discussion.html_url}",
    "color": 1190012,
    "timestamp": "ISO Date",
    "footer": { "text": "This post originates from GitHub." }
  }],
  "components": [{
    "type": 1,
    "components": [{
      "type": 2,
      "style": 5,
      "label": "View on GitHub",
      "url": "{discussion.html_url}"
    }]
  }],
  "thread_name": "{title}" // Only for suggestions
}
```

### Release Messages

**News Channel:**
```json
{
  "username": "Releases",
  "avatar_url": "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256", 
  "embeds": [{
    "title": "{release.name}",
    "url": "{release.html_url}",
    "description": "{release_ping} A new Release has dropped.",
    "color": 1190012,
    "timestamp": "ISO Date",
    "fields": [
      { "name": "GitHub", "value": "[Download]({release.html_url})", "inline": true },
      { "name": "Changelog", "value": "[Details](https://github.com/Lord-of-the-Rings-Middle-Earth-Mod/Lord-of-the-Rings-Middle-Earth-Mod/blob/master/CHANGELOG.md)", "inline": true }
    ],
    "footer": { "text": "This post originates from GitHub." }
  }],
  "components": [{
    "type": 1,
    "components": [
      {
        "type": 2,
        "style": 5,
        "label": "Changelog Channel",
        "url": "https://discord.com/channels/1237739289689985138/1241277621766197268"
      },
      {
        "type": 2,
        "style": 5,
        "label": "GitHub Release",
        "url": "{release.html_url}"
      }
    ]
  }]
}
```

**Changelog Channel:**
```json
{
  "username": "Changelog",
  "avatar_url": "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256",
  "embeds": [{
    "title": "{release.name}",
    "url": "https://github.com/Lord-of-the-Rings-Middle-Earth-Mod/Lord-of-the-Rings-Middle-Earth-Mod/blob/master/CHANGELOG.md",
    "description": "{release.body}",
    "color": 1190012,
    "timestamp": "ISO Date"
  }]
}
```

## Error Handling

- Ignores unsupported actions (anything other than 'created' or 'published')
- Ignores unsupported discussion categories
- Uses shared [Discord Integration](DISCORD_INTEGRATION.md) error handling
- Graceful handling of missing data fields

## Testing

To test the GitHub integration:

1. **GitHub Webhook**: Configure webhook in repository settings to point to `/github` endpoint
2. **Issue Test**: Create a new issue in the repository
3. **Discussion Test**: Create a new discussion in Announcements or Ideas categories
4. **Release Test**: Publish a new release in the repository
5. **Pull Request Tests**: 
   - Open a new PR (non-draft) - should post notification
   - Open a draft PR - should be ignored
   - Convert draft to ready for review - should post notification
   - Request review from someone - should post notification
   - Push new commits to existing PR - should post notification (if non-draft)
6. **Check Logs**: Monitor Cloudflare Worker logs for processing status
7. **Verify Discord**: Check the configured Discord channels for new messages

## Files Modified

- `src/index.js`: Added GitHub route handling
- `src/github.js`: Main GitHub webhook implementation
- `src/config.js`: Webhook URLs and role ping configurations
- `src/discord.js`: Shared Discord posting functionality

## Dependencies

- [Discord Integration](DISCORD_INTEGRATION.md) for message posting
- Configuration from `config.js` for webhooks and pings
- Native Cloudflare Worker fetch API
- No external libraries required

## Related Documentation

- [Discord Integration](DISCORD_INTEGRATION.md) - Shared Discord posting functionality
- [Configuration](README.md#configuration) - Webhook and role configuration details
# GitHub to Discord Integration

This module implements automatic GitHub webhook processing and Discord integration for repository events like discussions and releases.

## Features

- **Webhook Processing**: Handles GitHub webhooks for discussions, releases, issues, pull requests, and wiki changes
- **Discussion Routing**: Routes announcements and suggestions to appropriate Discord channels
- **Release Management**: Automatically posts release announcements to news and changelog channels
- **Wiki Change Notifications**: Sends formatted summaries of wiki page edits, creations, and deletions to Discord
- **Role Pinging**: Automatically pings relevant roles based on content and labels
- **Thread Support**: Creates threads for suggestions to organize discussions
- **Interactive Buttons**: Adds clickable buttons to messages for quick navigation to GitHub and Discord channels

## Configuration

### Discord Webhooks Setup

Before the integration can work, you must configure valid Discord webhook URLs in `src/config.js`:

- **WEBHOOKS.news** for announcements and releases
- **WEBHOOKS.suggestions** for ideas and suggestions  
- **WEBHOOKS.changelog** for detailed release notes
- **WEBHOOKS.issues** for new GitHub issues and fork notifications
- **WEBHOOKS.prs** for pull request notifications
- **WEBHOOKS.wiki** for wiki change notifications
- **WEBHOOKS.workflows** for GitHub Actions workflow run notifications

**Important:** Replace placeholder URLs with actual Discord webhook URLs from your server settings. URLs containing "PLACEHOLDER" will cause 405 Method Not Allowed errors.

### GitHub Webhook Setup

- **GitHub Webhooks**: Configure webhook in your repository settings to point to the `/github` endpoint
- **Events**: Enable webhook for discussions, releases, issues, pull requests, and wiki
- **Content Type**: Set to `application/json`

### Additional Configuration

- **Role Pings**: Configured in `config.js` as `PINGS` object
  - `PINGS.maintainers`: Role to ping for PRs from forks (first-time contributors)
  - `PINGS.contributors`: Role to ping for PRs from branches (existing team members)
  - `PINGS.news`: Role to ping for announcements
  - `PINGS.monthly`: Role to ping for monthly update announcements
  - `PINGS.release`: Role to ping for new releases
- **Avatar**: Uses `AVATAR_URL` from config for consistent branding
- **GitHub Token** (Optional): For workflow artifact attachment feature
  - Set via Cloudflare Workers secret: `wrangler secret put GITHUB_TOKEN`
  - Requires a GitHub Personal Access Token with `actions:read` and `repo` scopes
  - Used to fetch and download workflow run artifacts from GitHub API
  - If not configured, workflow notifications work normally but without artifact attachments
  - Repository information is configured in `config.js` as `GITHUB_REPO` object

## Endpoints

### GitHub Webhook Handler
- **Endpoint**: `POST /github`
- **Handler**: `handleGitHubWebhook()` function in `github.js`
- **Supported Events**: 
  - Repository fork
  - Wiki page changes (created, edited, deleted)
  - Discussion created (announcements, suggestions)
  - Release published
  - Issue opened
  - Pull request events (opened, ready_for_review, review_requested, reopened, synchronize)
  - Workflow run completed (success, failure, cancelled)

## Supported GitHub Events

### Fork Events
- **Repository Fork Events**:
  - Routes to issues channel with fork notification
  - Username: "LotR ME Mod GitHub"
  - Displays fork creator's username and repository details
  - Includes "Fork on GitHub" button linking to the new fork
  - Only processes `fork` action events

### Wiki Changes
- **Wiki Page Events**:
  - Routes to wiki channel with formatted summary of all changes
  - Username: "GitHub Wiki"
  - Displays list of all page changes with their actions (created, edited, deleted)
  - **Supported Actions**:
    - `created` - New wiki pages
    - `edited` - Modified wiki pages  
    - `deleted` - Removed wiki pages
  - **Interactive Buttons**:
    - "Home" button linking to wiki home page
    - Individual buttons for each edited or created page (up to 4 additional buttons)
    - Maximum of 5 buttons total per message (Discord limitation)
  - **Button Labels**: Automatically truncated to 80 characters (77 + "...") for long page titles
  - **Multiple Changes**: Single message includes all page changes from a single wiki update event

### Pull Requests
- **Pull Request Events**:
  - Routes to PRs channel with appropriate role ping based on PR source
  - **Fork Detection**: Automatically detects if PR is from a fork or a branch
    - PRs from **forks** ping maintainers (for first-time contributors who need proper onboarding)
    - PRs from **branches** ping contributors (for existing team members)
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

### Workflow Runs
- **GitHub Actions Workflow Events**:
  - Routes to workflows channel with status-based notifications
  - Username: "GitHub Actions"
  - Only processes "completed" workflow runs
  - **Supported Conclusions**:
    - `success` - Green color (3066993), no role ping
    - `failure` - Red color (15158332), pings maintainers role
    - `cancelled` - Gray color (10197915), no role ping
    - `skipped` - Ignored, no notification sent
  - **Message Format**:
    - Title includes emoji and workflow name with status
    - Description provides context and action guidance
    - Author field shows the workflow triggering user
    - Timestamp uses workflow completion time
    - Includes "View Workflow Run" button linking to the workflow
  - **Artifact Attachment** (requires GITHUB_TOKEN):
    - Successful workflows automatically fetch and attach build artifacts
    - Artifacts are downloaded from GitHub API and attached to Discord message
    - Supports .jar files and .zip files (artifacts are always zipped by GitHub)
    - Updates message description to indicate attached artifact
    - Falls back gracefully if no artifacts are found or if fetch fails
  - **Maintainer Notifications**: Failed workflows automatically ping maintainers for quick response
  - **Filtering**: Only completed workflows are notified; in-progress and queued workflows are ignored

## Message Format

### Fork Messages
```json
{
  "username": "LotR ME Mod GitHub",
  "avatar_url": "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256",
  "embeds": [{
    "author": {
      "name": "LotR ME Mod GitHub"
    },
    "title": "New Fork",
    "description": "**{username}** created a new fork for the **{repository}**.",
    "color": 1190012,
    "timestamp": "ISO Date",
    "footer": { "text": "This post originates from GitHub." }
  }],
  "components": [{
    "type": 1,
    "components": [{
      "type": 2,
      "style": 5,
      "label": "Fork on GitHub",
      "url": "{forkee.html_url}"
    }]
  }]
}
```

### Wiki Change Messages
```json
{
  "username": "GitHub Wiki",
  "avatar_url": "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256",
  "embeds": [{
    "title": "New Project-Wiki Changes",
    "description": "**{author}** has made the following changes to the Wiki:\n- {page_title} has been {action}\n- {page_title_2} has been {action_2}\n...",
    "color": 1190012,
    "timestamp": "ISO Date",
    "footer": { "text": "This post originates from GitHub." }
  }],
  "components": [{
    "type": 1,
    "components": [
      {
        "type": 2,
        "style": 5,
        "label": "Home",
        "url": "https://github.com/Lord-of-the-Rings-Middle-Earth-Mod/Lord-of-the-Rings-Middle-Earth-Mod/wiki"
      },
      {
        "type": 2,
        "style": 5,
        "label": "{page_title}",
        "url": "{page.html_url}"
      }
      // Additional buttons for edited/created pages (max 4 more)
    ]
  }]
}
```

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

### Workflow Run Messages

**Successful Workflow:**
```json
{
  "username": "GitHub Actions",
  "avatar_url": "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256",
  "embeds": [{
    "author": {
      "name": "{triggering_user}"
    },
    "title": "✅ {workflow_name} ran successfully",
    "description": "The workflow **{workflow_name}** completed successfully.\nYou can check out the results on GitHub.",
    "color": 3066993,
    "timestamp": "ISO Date",
    "footer": { "text": "This post originates from GitHub." }
  }],
  "components": [{
    "type": 1,
    "components": [{
      "type": 2,
      "style": 5,
      "label": "View Workflow Run",
      "url": "{workflow_run.html_url}"
    }]
  }]
}
```

**Failed Workflow:**
```json
{
  "username": "GitHub Actions",
  "avatar_url": "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256",
  "embeds": [{
    "author": {
      "name": "{triggering_user}"
    },
    "title": "❌ {workflow_name} failed",
    "description": "<@&1237743577656983665> The workflow **{workflow_name}** has failed.\nPlease check the workflow run and address any issues.",
    "color": 15158332,
    "timestamp": "ISO Date",
    "footer": { "text": "This post originates from GitHub." }
  }],
  "components": [{
    "type": 1,
    "components": [{
      "type": 2,
      "style": 5,
      "label": "View Workflow Run",
      "url": "{workflow_run.html_url}"
    }]
  }]
}
```

**Cancelled Workflow:**
```json
{
  "username": "GitHub Actions",
  "avatar_url": "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256",
  "embeds": [{
    "author": {
      "name": "{triggering_user}"
    },
    "title": "🚫 {workflow_name} was cancelled",
    "description": "The workflow **{workflow_name}** was cancelled.\nYou can check out the details on GitHub.",
    "color": 10197915,
    "timestamp": "ISO Date",
    "footer": { "text": "This post originates from GitHub." }
  }],
  "components": [{
    "type": 1,
    "components": [{
      "type": 2,
      "style": 5,
      "label": "View Workflow Run",
      "url": "{workflow_run.html_url}"
    }]
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
2. **Fork Test**: Fork the repository - should post notification to issues channel
3. **Wiki Test**: 
   - Create, edit, or delete a wiki page - should post notification with list of changes
   - Create multiple wiki pages in one session - should show all changes in one message
   - Verify buttons are created for edited and created pages
3. **Issue Test**: Create a new issue in the repository
4. **Discussion Test**: Create a new discussion in Announcements or Ideas categories
5. **Release Test**: Publish a new release in the repository
6. **Pull Request Tests**: 
   - Open a new PR (non-draft) - should post notification
   - Open a draft PR - should be ignored
   - Convert draft to ready for review - should post notification
   - Request review from someone - should post notification
   - Push new commits to existing PR - should post notification (if non-draft)
7. **Workflow Run Tests**:
   - Trigger a workflow that completes successfully - should post green notification
   - Trigger a workflow that fails - should post red notification with maintainer ping
   - Cancel a running workflow - should post gray notification
   - Verify workflow name, status, and link are correct in notifications
8. **Check Logs**: Monitor Cloudflare Worker logs for processing status
8. **Verify Discord**: Check the configured Discord channels for new messages

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

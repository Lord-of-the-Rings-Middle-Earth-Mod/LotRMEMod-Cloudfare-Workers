# Setup Guide for Workflow Artifact Attachment

This guide will help you configure the workflow artifact attachment feature.

## Prerequisites

- Cloudflare Workers account with Wrangler CLI installed
- GitHub Personal Access Token (you'll create this below)
- Your repository already deployed as a Cloudflare Worker

## Configuration Steps

### 1. GitHub Token Configuration

The worker needs a GitHub Personal Access Token to fetch workflow artifacts.

#### Create the Token:
1. Go to https://github.com/settings/tokens/new
2. Set token name: `LotRMEMod-Cloudflare-Worker-Artifacts`
3. Select these scopes:
   - ✅ `actions:read` - Read workflow run artifacts
   - ✅ `repo` - Access repository data
4. Click "Generate token" and **copy the token immediately** (you won't see it again)

#### Set the Token as a Secret:
```bash
# Navigate to your worker directory
cd /path/to/LotRMEMod-Cloudfare-Workers

# Set the token as an encrypted secret (do NOT put it in code!)
wrangler secret put GITHUB_TOKEN
# When prompted, paste your token and press Enter
```

**Important:** 
- ⚠️ Never commit tokens to code or config files
- ⚠️ Never post tokens in comments or pull requests
- ✅ Always use `wrangler secret put` to set sensitive values

### 2. Verify Configuration

Your configuration is already set up in `src/config.js`:

```javascript
// GitHub repository configuration (ALREADY CONFIGURED ✅)
export const GITHUB_REPO = {
  owner: "Lord-of-the-Rings-Middle-Earth-Mod",
  repo: "Lord-of-the-Rings-Middle-Earth-Mod"
};

// Discord webhooks (ALREADY CONFIGURED ✅)
export const WEBHOOKS = {
  workflows: "https://discord.com/api/webhooks/..." // Your actual webhook
  // ... other webhooks
};
```

**You don't need to change anything in `src/config.js`** - it's already configured!

### 3. Deploy the Worker

```bash
# Deploy to Cloudflare
wrangler deploy
```

### 4. Test the Feature

1. Trigger a workflow in your GitHub repository that produces artifacts
2. Wait for the workflow to complete successfully
3. Check your Discord `workflows` channel - the artifact should be attached to the notification

## Troubleshooting

### Artifacts not attaching?

Check these:

1. **Is GITHUB_TOKEN set?**
   ```bash
   # List secrets (won't show values, just names)
   wrangler secret list
   # You should see GITHUB_TOKEN in the list
   ```

2. **Does the workflow produce artifacts?**
   - Check the workflow run on GitHub
   - Look for the "Artifacts" section in the workflow summary
   - Ensure the artifact is successfully uploaded

3. **Check worker logs:**
   ```bash
   wrangler tail
   ```
   Look for messages like:
   - `Fetching artifacts for successful workflow run...`
   - `Found artifact: [name] ([size] bytes)`
   - `Successfully downloaded artifact...`

### Still having issues?

Check the [GitHub Integration documentation](GITHUB_INTEGRATION.md) for more details.

## What Happens Under the Hood

When a workflow completes successfully:

1. Worker receives GitHub webhook for workflow completion
2. If `GITHUB_TOKEN` is configured, worker calls GitHub API to list artifacts
3. Worker downloads the first artifact (usually the build output)
4. Worker attaches the file to Discord message using multipart/form-data
5. Discord notification appears with the downloadable artifact

If `GITHUB_TOKEN` is not configured, the notification still works but without the artifact attachment.

## Security Best Practices

✅ **DO:**
- Store tokens as Cloudflare Worker secrets
- Use tokens with minimal required scopes
- Rotate tokens periodically
- Revoke tokens immediately if exposed

❌ **DON'T:**
- Commit tokens to git
- Post tokens in issues/PRs/comments
- Share tokens in plain text
- Give tokens excessive permissions

---

**Need help?** Check the [README.md](README.md) or [GitHub Integration docs](GITHUB_INTEGRATION.md).

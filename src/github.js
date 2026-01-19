import { postToDiscord } from './discord.js'; // For sending messages to Discord
import { WEBHOOKS, PINGS, TAGS, AVATAR_URL, FOOTER_TEXT, GITHUB_REPO } from './config.js'; // The Webhook URLs, Pings, Tags, Avatar, and Footer Text

export async function handleGitHubWebhook(request, env) {
    const data = await request.json();

    // If it's a wiki event, handle it
    if (data.pages && Array.isArray(data.pages)) {
        return handleWiki(data.pages, data.sender);
    }
    // If it's a discussion, handle it
    if (data.discussion) {
        // We only handle 'created' action for discussions
        if (data.action !== "created") {
            return new Response("Ignored", { status: 200 });
        }
        return handleDiscussion(data.discussion);
    }
    // If it's a workflow run, handle it
    else if (data.workflow_run && data.action === "completed") {
        return handleWorkflowRun(data.workflow_run, env);
    }
    // If it's a release, handle it
    else if (data.release && data.action == "published") {
        return handleRelease(data.release);
    }
    // If it's an issue, handle it
    else if (data.issue && data.action == "opened") {
        return handleIssue(data.issue);
    }
    // If it's a pull request, handle it
    else if (data.pull_request) {
        // We handle specific PR actions: opened, ready_for_review, review_requested, reopened, synchronize
        if (["opened", "ready_for_review", "review_requested", "reopened", "synchronize"].includes(data.action)) {
            return handlePullRequest(data.pull_request, data.action, data.requested_reviewer);
        }
        return new Response("Ignored", { status: 200 });
    }
    // If it's a fork event, handle it
    else if (data.forkee && data.repository) {
        return handleFork(data.forkee, data.sender, data.repository);
    }

    return new Response("Ignored", { status: 200 });
}

// Function to handle GitHub Wiki events
async function handleWiki(pages, sender) {
    if (!pages || pages.length === 0) {
        console.error('handleWiki called with no pages');
        return new Response("Invalid wiki data", { status: 400 });
    }

    const author = sender?.login || 'Unknown User';
    console.log(`Processing GitHub wiki update by ${author} with ${pages.length} page(s) changed`);

    // Build description with list of all changes
    let description = `**${author}** has made the following changes to the Wiki:\n`;
    
    pages.forEach(page => {
        const pageTitle = page.title || page.page_name;
        const action = page.action;
        description += `- ${pageTitle} has been ${action}\n`;
    });

    // Build components with buttons for edited and created pages
    const buttonComponents = [];
    
    // Add Home button (link to wiki home)
    buttonComponents.push({
        type: 2, // Button
        style: 5, // Link style
        label: "Home",
        url: "https://github.com/Lord-of-the-Rings-Middle-Earth-Mod/Lord-of-the-Rings-Middle-Earth-Mod/wiki"
    });

    // Add buttons for edited and created pages (max 5 buttons per action row in Discord)
    pages.forEach(page => {
        if ((page.action === 'edited' || page.action === 'created') && buttonComponents.length < 5) {
            const pageTitle = page.title || page.page_name;
            buttonComponents.push({
                type: 2, // Button
                style: 5, // Link style
                label: pageTitle.length > 80 ? pageTitle.substring(0, 77) + '...' : pageTitle,
                url: page.html_url
            });
        }
    });

    // Create the Discord payload
    const payload = {
        username: "GitHub Wiki",
        avatar_url: AVATAR_URL,
        embeds: [
            {
                title: "New Project-Wiki Changes",
                description: description,
                color: 1190012,
                timestamp: new Date().toISOString(),
                footer: { text: FOOTER_TEXT }
            }
        ],
        components: [
            {
                type: 1, // Action Row
                components: buttonComponents
            }
        ]
    };

    return postToDiscord(WEBHOOKS.wiki, payload);
}

// Function to handle GitHub Discussions (Announcements, Suggestions, etc.)
async function handleDiscussion(discussion) {
    const category = discussion.category.name;
    let webhookUrl, username, titlePrefix;
    let useThread = false;

    let embedDescription = discussion.body;

    // Determine the webhook and title based on the category
    if (category === "Announcements") {
        webhookUrl = WEBHOOKS.news;
        username = "GitHub Announcements";
        titlePrefix = "GitHub Announcement";

        // Check if the label "Monthly Updates" is set, and ping accordingly
        const hasMonthlyUpdatesLabel = discussion.labels.some(label => label.name === "Monthly Updates");
        const rolePing = hasMonthlyUpdatesLabel ? PINGS.monthly : PINGS.news; 

        embedDescription = `${rolePing} ${discussion.body}`;
    } else if (category === "Ideas and suggestions") {
        webhookUrl = WEBHOOKS.suggestions;
        username = "GitHub Suggestions";
        titlePrefix = "GitHub Suggestion";
        useThread = true;
    } else {
        return new Response("Ignored", { status: 200 });
    }

    // Create the Discord payload with the discussion details
    const payload = {
        username: username,
        avatar_url: AVATAR_URL,  // Using avatar URL from config.js
        embeds: [
            {
                title: `${titlePrefix}: ${discussion.title}`,
                description: embedDescription,
                url: discussion.html_url,
                color: 1190012,
                timestamp: new Date().toISOString(),
                footer: { text: FOOTER_TEXT }  // Using footer text from config.js
            }
        ],
        components: [
            {
                type: 1, // Action Row
                components: [
                    {
                        type: 2, // Button
                        style: 5, // Link style
                        label: "View on GitHub",
                        url: discussion.html_url
                    }
                ]
            }
        ]
    };

    // If it's a thread, set the thread name and apply tags
    if (useThread) {
        payload.thread_name = `${titlePrefix}: ${discussion.title}`;
        payload.applied_tags = [TAGS.suggestions];
    }

    return postToDiscord(webhookUrl, payload);
}

// Function to handle GitHub Releases (News & Changelog)
async function handleRelease(release) {
    const commonEmbed = {
        title: release.name,
        color: 1190012,
        timestamp: new Date().toISOString()
    };

    // Message for the News channel
    const newsMessage = {
        username: "Releases",
        avatar_url: AVATAR_URL,  // Using avatar URL from config.js
        embeds: [
            {
                ...commonEmbed,
                url: release.html_url,
                description: `${PINGS.release} A new Release has dropped.`,
                fields: [
                    { name: "GitHub", value: `[Download](${release.html_url})`, inline: true },
                    { name: "Changelog", value: `[Details](https://github.com/Lord-of-the-Rings-Middle-Earth-Mod/Lord-of-the-Rings-Middle-Earth-Mod/blob/master/CHANGELOG.md)`, inline: true }
                ],
                footer: { text: FOOTER_TEXT }  // Using footer text from config.js
            }
        ],
        components: [
            {
                type: 1, // Action Row
                components: [
                    {
                        type: 2, // Button
                        style: 5, // Link style
                        label: "Changelog Channel",
                        url: "https://discord.com/channels/1237739289689985138/1241277621766197268"
                    },
                    {
                        type: 2, // Button
                        style: 5, // Link style
                        label: "GitHub Release",
                        url: release.html_url
                    }
                ]
            }
        ]
    };

    // Message for the Changelog channel
    const changelogMessage = {
        username: "Changelog",
        avatar_url: AVATAR_URL,  // Using avatar URL from config.js
        embeds: [
            {
                ...commonEmbed,
                url: "https://github.com/Lord-of-the-Rings-Middle-Earth-Mod/Lord-of-the-Rings-Middle-Earth-Mod/blob/master/CHANGELOG.md",
                description: release.body,
            }
        ]
    };

    // Send the messages to Discord
    const newsResponse = await postToDiscord(WEBHOOKS.news, newsMessage);
    const changelogResponse = await postToDiscord(WEBHOOKS.changelog, changelogMessage);

    // Check if both messages were sent successfully
    if (newsResponse.status === 200 && changelogResponse.status === 200) {
        return new Response("Success", { status: 200 });
    } else {
        console.error(`Failed to send release messages. News: ${newsResponse.status}, Changelog: ${changelogResponse.status}`);
        return new Response("Partial failure", { status: 500 });
    }
}

// Function to handle GitHub Issues
async function handleIssue(issue) {
    if (!issue) {
        console.error('handleIssue called with null or undefined issue');
        return new Response("Invalid issue data", { status: 400 });
    }
    
    // Validate timestamp
    const issueDate = new Date(issue.created_at);
    const now = new Date();
    if (issueDate > now) {
        console.warn(`Warning: Issue timestamp is in the future! Issue: ${issue.created_at}, Now: ${now.toISOString()}`);
    }
    if (isNaN(issueDate.getTime())) {
        console.error(`Error: Invalid timestamp format: ${issue.created_at}`);
        // Fallback to current time if timestamp is invalid
        issue.created_at = now.toISOString();
        console.log(`Using current time as fallback: ${issue.created_at}`);
    }
    
    // Format labels - convert array to string
    let labelsText = "None";
    if (issue.labels && issue.labels.length > 0) {
        labelsText = issue.labels.map(label => label.name).join(", ");
    }
    
    // Single consolidated log with essential information
    console.log(`Processing GitHub issue "${issue.title}" by ${issue.user?.login || 'unknown user'} - ${issue.html_url}`);

    // Create the Discord payload with the issue details
    // Ensure values don't exceed Discord limits
    const title = issue.title.length > 256 ? issue.title.substring(0, 253) + '...' : issue.title;
    const description = issue.body ? 
        (issue.body.length > 4096 ? issue.body.substring(0, 4093) + '...' : issue.body) : 
        "No description provided";
    
    const payload = {
        username: "LotR ME Mod Issues",
        avatar_url: AVATAR_URL,
        embeds: [
            {
                title: title,
                author: {
                    name: issue.user?.login || 'Unknown User'
                },
                description: description,
                fields: [
                    {
                        name: "Labels",
                        value: labelsText
                    }
                ],
                timestamp: issue.created_at,
                footer: {
                    text: "This issue was created on GitHub"
                }
            }
        ],
        components: [
            {
                type: 1, // Action Row
                components: [
                    {
                        type: 2, // Button
                        style: 5, // Link style
                        label: "Issue on GitHub",
                        url: issue.html_url
                    }
                ]
            }
        ]
    };

    return postToDiscord(WEBHOOKS.issues, payload);
}

// Function to handle GitHub Pull Requests
async function handlePullRequest(pullRequest, action, requestedReviewer) {
    if (!pullRequest) {
        console.error('handlePullRequest called with null or undefined pull request');
        return new Response("Invalid pull request data", { status: 400 });
    }
    
    // Filter based on draft status and action
    // We only notify for: opened (non-draft), ready_for_review, review_requested, reopened (non-draft), synchronize (non-draft)
    const isDraft = pullRequest.draft;
    
    if ((action === "opened" || action === "reopened" || action === "synchronize") && isDraft) {
        console.log(`Ignoring ${action} action for draft PR #${pullRequest.number}`);
        return new Response("Ignored - draft PR", { status: 200 });
    }

    // Determine if PR is from a fork or a branch within the repo
    // A PR from a fork will have different repo IDs between head and base
    const isFromFork = pullRequest.head?.repo?.id !== pullRequest.base?.repo?.id;
    const rolePing = isFromFork ? PINGS.maintainers : PINGS.contributors;
    
    console.log(`Processing GitHub PR #${pullRequest.number} action: ${action}, draft: ${isDraft}, from ${isFromFork ? 'fork' : 'branch'}, by ${pullRequest.user?.login || 'unknown user'}`);

    // Determine message content based on action
    let title, description, footerText;
    const prNumber = pullRequest.number;
    const author = pullRequest.user?.login || 'Unknown User';
    const prTitle = pullRequest.title || 'Untitled PR';
    
    switch (action) {
        case "opened":
            title = `PR ${prNumber} opened: ${prTitle}`;
            description = `${rolePing}\n**${author}** has opened a new pull request that is ready for review.`;
            footerText = "This PR was opened";
            break;
            
        case "ready_for_review":
            title = `PR ${prNumber} ready for review: ${prTitle}`;
            description = `${rolePing}\n**${author}** has marked their pull request as ready for review.`;
            footerText = "This PR was marked ready for review";
            break;
            
        case "reopened":
            title = `PR ${prNumber} reopened: ${prTitle}`;
            description = `${rolePing}\n**${author}** has reopened their pull request for review.`;
            footerText = "This PR was reopened";
            break;
            
        case "synchronize":
            title = `PR ${prNumber} synchronized: ${prTitle}`;
            description = `${rolePing}\n**${author}** has updated their pull request with new changes.`;
            footerText = "This PR was updated with new changes";
            break;
            
        case "review_requested":
            // For review_requested, we need the requested reviewer info
            // Log the requested reviewer data for debugging
            console.log(`Requested reviewer data:`, JSON.stringify(requestedReviewer));
            
            let reviewerName = 'someone';
            if (requestedReviewer && requestedReviewer.login) {
                reviewerName = requestedReviewer.login;
            } else {
                console.warn(`Missing or invalid requested reviewer data for PR ${prNumber}`);
            }
            
            title = `PR ${prNumber} review requested: ${prTitle}`;
            description = `${rolePing}\n**${author}** has requested **${reviewerName}** to review their pull request.`;
            footerText = "This PR review was requested";
            break;
            
        default:
            return new Response("Unsupported action", { status: 400 });
    }

    // Create the Discord payload
    const prUrl = pullRequest.html_url || `https://github.com/Lord-of-the-Rings-Middle-Earth-Mod/Lord-of-the-Rings-Middle-Earth-Mod/pull/${prNumber}`;
    
    // Prepare embed fields
    const embedFields = [];
    
    // Add PR description if available and not too long
    if (pullRequest.body && pullRequest.body.trim()) {
        const trimmedBody = pullRequest.body.length > 300 
            ? pullRequest.body.substring(0, 297) + '...' 
            : pullRequest.body;
        embedFields.push({
            name: "Description",
            value: trimmedBody,
            inline: false
        });
    }
    
    // Add branch information
    if (pullRequest.head && pullRequest.base) {
        embedFields.push({
            name: "Changes",
            value: `\`${pullRequest.head.ref}\` → \`${pullRequest.base.ref}\``,
            inline: true
        });
    }
    
    const payload = {
        components: [
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: 5,
                        label: "View PR on GitHub",
                        url: prUrl
                    }
                ]
            }
        ],
        avatar_url: AVATAR_URL,
        username: "LotR ME Mod PRs",
        embeds: [
            {
                title: title,
                description: description,
                url: prUrl,
                color: 1190012,
                fields: embedFields,
                timestamp: new Date().toISOString(),
                footer: {
                    text: footerText
                }
            }
        ]
    };

    return postToDiscord(WEBHOOKS.prs, payload);
}

// Function to handle GitHub Fork events
async function handleFork(forkee, sender, repository) {
    if (!forkee || !repository) {
        console.error('handleFork called with invalid data');
        return new Response("Invalid fork data", { status: 400 });
    }
    
    const username = sender?.login || 'Unknown User';
    const repoName = repository.full_name || repository.name || 'the repository';
    const forkUrl = forkee.html_url;
    
    console.log(`Processing GitHub fork by ${username} - ${forkUrl}`);
    
    // Create the Discord payload
    const payload = {
        username: "LotR ME Mod GitHub",
        avatar_url: AVATAR_URL,
        embeds: [
            {
                author: {
                    name: "LotR ME Mod GitHub"
                },
                title: "New Fork",
                description: `**${username}** created a new fork for the **${repoName}**.`,
                color: 1190012,
                timestamp: new Date().toISOString(),
                footer: {
                    text: FOOTER_TEXT
                }
            }
        ],
        components: [
            {
                type: 1, // Action Row
                components: [
                    {
                        type: 2, // Button
                        style: 5, // Link style
                        label: "Fork on GitHub",
                        url: forkUrl
                    }
                ]
            }
        ]
    };
    
    return postToDiscord(WEBHOOKS.issues, payload);
}

// Function to handle GitHub Actions Workflow Run events
async function handleWorkflowRun(workflowRun, env) {
    if (!workflowRun) {
        console.error('handleWorkflowRun called with null or undefined workflow run');
        return new Response("Invalid workflow run data", { status: 400 });
    }
    
    // Only handle completed workflows (success or failure)
    if (workflowRun.status !== 'completed') {
        console.log(`Ignoring workflow run with status: ${workflowRun.status}`);
        return new Response("Ignored - workflow not completed", { status: 200 });
    }
    
    const workflowName = workflowRun.name || 'Unknown Workflow';
    const conclusion = workflowRun.conclusion; // success, failure, cancelled, skipped, etc.
    const workflowUrl = workflowRun.html_url;
    const author = workflowRun.actor?.login || workflowRun.triggering_actor?.login || 'Unknown User';
    
    console.log(`Processing GitHub workflow run: ${workflowName} - ${conclusion} by ${author}`);
    
    // Determine title and description based on conclusion
    let title, description, color;
    
    switch (conclusion) {
        case 'success':
            title = `✅ ${workflowName} ran successfully`;
            description = `The workflow **${workflowName}** completed successfully.\nYou can check out the results on GitHub.`;
            color = 3066993; // Green
            break;
            
        case 'failure':
            title = `❌ ${workflowName} failed`;
            description = `${PINGS.maintainers} The workflow **${workflowName}** has failed.\nPlease check the workflow run and address any issues.`;
            color = 15158332; // Red
            break;
            
        case 'cancelled':
            title = `🚫 ${workflowName} was cancelled`;
            description = `The workflow **${workflowName}** was cancelled.\nYou can check out the details on GitHub.`;
            color = 10197915; // Gray
            break;
            
        case 'skipped':
            // Don't notify for skipped workflows
            console.log(`Ignoring skipped workflow: ${workflowName}`);
            return new Response("Ignored - workflow skipped", { status: 200 });
            
        default:
            title = `⚠️ ${workflowName} completed with status: ${conclusion}`;
            description = `The workflow **${workflowName}** completed with an unusual status.\nYou can check out the results on GitHub.`;
            color = 16776960; // Yellow
            break;
    }
    
    // Create the Discord payload
    const payload = {
        username: "GitHub Actions",
        avatar_url: AVATAR_URL,
        embeds: [
            {
                author: {
                    name: author
                },
                title: title,
                description: description,
                color: color,
                timestamp: workflowRun.updated_at || new Date().toISOString(),
                footer: {
                    text: FOOTER_TEXT
                }
            }
        ],
        components: [
            {
                type: 1, // Action Row
                components: [
                    {
                        type: 2, // Button
                        style: 5, // Link style
                        label: "View Workflow Run",
                        url: workflowUrl
                    }
                ]
            }
        ]
    };
    
    // For successful workflows, try to attach artifacts
    let artifactFile = null;
    let artifactFilename = null;
    let successDescription = description; // Store the original description
    
    if (conclusion === 'success' && env?.GITHUB_TOKEN) {
        try {
            console.log(`Fetching artifacts for successful workflow run ${workflowRun.id}`);
            const artifacts = await fetchWorkflowArtifacts(workflowRun.id, env.GITHUB_TOKEN);
            
            if (artifacts && artifacts.length > 0) {
                // Use the first artifact (usually there's only one for build workflows)
                const artifact = artifacts[0];
                console.log(`Found artifact: ${artifact.name} (${artifact.size_in_bytes} bytes)`);
                
                // Download the artifact
                const blob = await downloadArtifact(artifact.id, env.GITHUB_TOKEN);
                
                if (blob) {
                    artifactFile = blob;
                    // Artifacts are always downloaded as .zip from GitHub API
                    // Use the artifact name with .zip extension
                    artifactFilename = artifact.name.endsWith('.zip') ? artifact.name : `${artifact.name}.zip`;
                    
                    // Update the description to mention the attached file
                    successDescription = `The workflow **${workflowName}** completed successfully.\nThe build artifact **${artifact.name}** is attached to this message.`;
                }
            } else {
                console.log(`No artifacts found for workflow run ${workflowRun.id}`);
            }
        } catch (error) {
            console.error('Error fetching/downloading artifacts:', error);
            // Continue with sending the message without artifacts
        }
    }
    
    // Update payload with final description
    payload.embeds[0].description = successDescription;
    
    return postToDiscord(WEBHOOKS.workflows, payload, artifactFile, artifactFilename);
}

// Helper function to fetch workflow run artifacts from GitHub API
async function fetchWorkflowArtifacts(workflowRunId, githubToken) {
    if (!githubToken) {
        console.log('No GitHub token provided, skipping artifact fetch');
        return [];
    }
    
    try {
        const apiUrl = `https://api.github.com/repos/${GITHUB_REPO.owner}/${GITHUB_REPO.repo}/actions/runs/${workflowRunId}/artifacts`;
        
        console.log(`Fetching artifacts from: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'LotRMEMod-Cloudflare-Worker'
            }
        });
        
        if (!response.ok) {
            console.error(`Failed to fetch artifacts: ${response.status} ${response.statusText}`);
            return [];
        }
        
        const data = await response.json();
        console.log(`Found ${data.artifacts?.length || 0} artifacts for workflow run ${workflowRunId}`);
        
        return data.artifacts || [];
    } catch (error) {
        console.error(`Error fetching workflow artifacts:`, error);
        return [];
    }
}

// Helper function to download a single artifact from GitHub
async function downloadArtifact(artifactId, githubToken) {
    if (!githubToken) {
        console.log('No GitHub token provided, skipping artifact download');
        return null;
    }
    
    try {
        const apiUrl = `https://api.github.com/repos/${GITHUB_REPO.owner}/${GITHUB_REPO.repo}/actions/artifacts/${artifactId}/zip`;
        
        console.log(`Downloading artifact ${artifactId} from: ${apiUrl}`);
        
        // First request: Get the redirect URL (GitHub returns 302 with Location header)
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'LotRMEMod-Cloudflare-Worker'
            },
            redirect: 'manual'  // Don't follow redirects automatically
        });
        
        // GitHub API returns 301 or 302 with Location header pointing to the actual download URL
        if (response.status !== 301 && response.status !== 302) {
            console.error(`Failed to get artifact download URL: ${response.status} ${response.statusText}`);
            return null;
        }
        
        // Extract the redirect URL from the Location header
        const downloadUrl = response.headers.get('Location');
        if (!downloadUrl) {
            console.error('No Location header in redirect response');
            return null;
        }
        
        console.log(`Got redirect URL for artifact ${artifactId}, downloading from storage...`);
        
        // Second request: Download the actual artifact from the redirect URL
        // Note: The redirect URL contains embedded SAS authentication
        // We must NOT include Authorization headers as they conflict with Azure's SAS token
        // Explicitly configure the request with empty headers for Cloudflare Workers
        const downloadResponse = await fetch(downloadUrl, {
            method: 'GET',
            headers: {}  // Empty headers - do NOT add Authorization header
        });
        
        if (!downloadResponse.ok) {
            console.error(`Failed to download artifact from storage: ${downloadResponse.status} ${downloadResponse.statusText}`);
            return null;
        }
        
        // Get the artifact as a blob
        const blob = await downloadResponse.blob();
        console.log(`Successfully downloaded artifact ${artifactId}, size: ${blob.size} bytes`);
        
        return blob;
    } catch (error) {
        console.error(`Error downloading artifact ${artifactId}:`, error);
        return null;
    }
}

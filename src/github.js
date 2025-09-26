import { postToDiscord } from './discord.js'; // For sending messages to Discord
import { WEBHOOKS, PINGS, TAGS, AVATAR_URL, FOOTER_TEXT } from './config.js'; // The Webhook URLs, Pings, Tags, Avatar, and Footer Text

export async function handleGitHubWebhook(request) {
    const data = await request.json();

    // If it's a discussion, handle it
    if (data.discussion) {
        // We only handle 'created' action for discussions
        if (data.action !== "created") {
            return new Response("Ignored", { status: 200 });
        }
        return handleDiscussion(data.discussion);
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

    return new Response("Ignored", { status: 200 });
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

    console.log(`Processing GitHub PR #${pullRequest.number} action: ${action}, draft: ${isDraft}, by ${pullRequest.user?.login || 'unknown user'}`);

    // Determine message content based on action
    let title, description, footerText;
    const prNumber = pullRequest.number;
    const author = pullRequest.user?.login || 'Unknown User';
    
    switch (action) {
        case "opened":
            title = `PR ${prNumber} opened`;
            description = `<@&1301093445951164498>\nThe PR ${prNumber} from ${author} is ready for review.\n`;
            footerText = "The PR was opened on ";
            break;
            
        case "ready_for_review":
            title = `PR ${prNumber} ready for review`;
            description = `<@&1301093445951164498>\nThe PR ${prNumber} from ${author} is ready for review.\n`;
            footerText = "The PR was marked ready for review on ";
            break;
            
        case "reopened":
            title = `PR ${prNumber} reopened`;
            description = `<@&1301093445951164498>\nThe PR ${prNumber} from ${author} is ready for review.\n`;
            footerText = "The PR was reopened on ";
            break;
            
        case "synchronize":
            title = `PR ${prNumber} synchronized`;
            description = `<@&1301093445951164498>\nThe PR ${prNumber} from ${author} is ready for review.\n`;
            footerText = "The PR was synchronized on ";
            break;
            
        case "review_requested":
            // For review_requested, we need the requested reviewer info
            const reviewerName = requestedReviewer?.login || 'someone';
            title = `PR ${prNumber} review requested`;
            description = `<@&1301093445951164498>\n${author} has requested ${reviewerName} to review his PR ${prNumber}.\n`;
            footerText = "The PR was review requested on ";
            break;
            
        default:
            return new Response("Unsupported action", { status: 400 });
    }

    // Create the Discord payload
    const payload = {
        components: [
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: 5,
                        label: "PR on GitHub",
                        url: "https://github.com/Lord-of-the-Rings-Middle-Earth-Mod/Lord-of-the-Rings-Middle-Earth-Mod/pulls"
                    }
                ]
            }
        ],
        avatar_url: AVATAR_URL,
        username: "Lotr ME Mod PRs",
        embeds: [
            {
                title: title,
                description: description,
                timestamp: new Date().toISOString(),
                footer: {
                    text: footerText
                }
            }
        ]
    };

    return postToDiscord(WEBHOOKS.prs, payload);
}

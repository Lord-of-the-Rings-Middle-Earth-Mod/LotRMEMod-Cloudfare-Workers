import { postToDiscord } from './discord.js'; // For sending messages to Discord
import { WEBHOOKS, PINGS, AVATAR_URL, FOOTER_TEXT } from './config.js'; // The Webhook URLs, Pings, Avatar, and Footer Text

export async function handleGitHubWebhook(request) {
    const data = await request.json();

    // We ignore actions that are neither 'created' nor 'published'.
    if (data.action !== "created" && data.action !== "published") {
        return new Response("Ignored", { status: 200 });
    }

    // If it's a discussion, handle it
    if (data.discussion) {
        return handleDiscussion(data.discussion);
    }
    // If it's a release, handle it
    else if (data.release && data.action == "published") {
        return handleRelease(data.release);
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

    // If it's a thread, set the thread name
    if (useThread) {
        payload.thread_name = `${titlePrefix}: ${discussion.title}`;
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

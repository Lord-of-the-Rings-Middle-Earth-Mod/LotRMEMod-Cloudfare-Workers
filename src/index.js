export default {
    async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/github") {
            return handleGitHubWebhook(request);
        }
        return new Response("Not found", { status: 404 });
    }
};

async function handleGitHubWebhook(request) {
    const data = await request.json();

    if (data.action !== "created" && data.action !== "published") {
        return new Response("Ignored", { status: 200 });
    }

    if (data.discussion) {
        return handleDiscussion(data.discussion);
    } else if (data.release && data.action == "published") {
        return handleRelease(data.release);
    }

    return new Response("Ignored", { status: 200 });
}

// GitHub Discussions (Announcements, FAQ, Suggestions)
async function handleDiscussion(discussion) {
    const category = discussion.category.name;
    let webhookUrl, username, titlePrefix;
    let useThread = false;

    if (category === "Announcements") {
        webhookUrl = NEWS_WEBHOOK;
        username = "GitHub Announcements";
        titlePrefix = "GitHub Announcement";
    } else if (category === "Ideas and Suggestions") {
        webhookUrl = SUGGESTIONS_WEBHOOK;
        username = "GitHub Suggestions";
        titlePrefix = "GitHub Suggestion";
        useThread = true;
    } else {
        return new Response("Ignored", { status: 200 });
    }

    const payload = {
        username: username,
        avatar_url: "https://drive.google.com/uc?id=1qSD9k5acGXM2T7XdH_yjJdEZjF8VLUIi",
        embeds: [
            {
                title: `${titlePrefix}: ${discussion.title}`,
                description: discussion.body,
                url: discussion.html_url,
                color: 1190012,
                timestamp: new Date().toISOString()
            }
        ]
    };

    if (useThread) {
        payload.thread_name = `${titlePrefix}: ${discussion.title}`;
    }

    return postToDiscord(webhookUrl, payload);
}

// GitHub Releases (News & Changelog)
async function handleRelease(release) {
    
    const commonEmbed = {
        title: release.name,
        color: 1190012,
        timestamp: new Date().toISOString()
    };

    // Message for the News channel
    const newsMessage = {
        username: "Releases",
        avatar_url: "https://drive.google.com/uc?id=1qSD9k5acGXM2T7XdH_yjJdEZjF8VLUIi",
        embeds: [
            {
                ...commonEmbed,
                url: release.html_url,
                description: "A new Release has dropped.",
                fields: [
                    { name: "GitHub", value: `[Download](${release.html_url})`, inline: true },
                    { name: "Changelog", value: `[Details](https://github.com/Lord-of-the-Rings-Middle-Earth-Mod/Lord-of-the-Rings-Middle-Earth-Mod/blob/master/CHANGELOG.md)`, inline: true }
                ],
                footer: { text: "You can see the changelog in <#1241277621766197268>"}
            }
        ]
    };

    // Message for the changelog channel
    const changelogMessage = {
        username: "Changelog",
        avatar_url: "https://drive.google.com/uc?id=1qSD9k5acGXM2T7XdH_yjJdEZjF8VLUIi",
        embeds: [
            {
                ...commonEmbed,
                url: "https://github.com/Lord-of-the-Rings-Middle-Earth-Mod/Lord-of-the-Rings-Middle-Earth-Mod/blob/master/CHANGELOG.md",
                description: release.body
            }
        ]
    };

    await postToDiscord(NEWS_WEBHOOK, newsMessage);
    await postToDiscord(CHANGELOG_WEBHOOK, changelogMessage);

    return new Response("Success", { status: 200 });
}

// Funktion to sent the messages to discord
async function postToDiscord(webhookUrl, payload) {
    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        return new Response(`Discord Webhook Error: ${response.statusText}`, { status: 500 });
    }
    return new Response("Success", { status: 200 });
}

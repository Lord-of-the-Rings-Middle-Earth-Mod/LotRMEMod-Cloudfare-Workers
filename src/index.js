import { handleGitHubWebhook } from './github.js';
import { processRssFeed } from './rss-feed.js';
import { handleMails } from './mails.js';
import { WEBHOOKS } from './config.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/github") {
      return handleGitHubWebhook(request, env);
    }

    if (url.pathname === "/mails" && request.method === "POST") {
      return handleMails(request, env);
    }

    // Optionaler Testendpunkt für manuelles Auslösen des RSS-Feeds
    if (url.pathname === "/rss") {
      const feedUrl = "https://fabricmc.net/feed.xml"; // Beispiel
      return await processRssFeed(env, feedUrl, WEBHOOKS.fabricupdates, env.FABRIC_KV);
    }

    return new Response("Not found", { status: 404 });
  }
};

async scheduled(event, env, ctx) {
  const feedUrl = "https://fabricmc.net/feed.xml"; 
  await processRssFeed(env, feedUrl, WEBHOOKS.fabricupdates, env.FABRIC_KV);
}

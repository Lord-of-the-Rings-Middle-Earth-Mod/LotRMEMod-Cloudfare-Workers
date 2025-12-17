import { handleGitHubWebhook } from './github.js';
import { handleMails } from './mails.js';
import { handleRSS } from './rss.js';
import { handleMinecraftNews } from './minecraft.js';
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

    if (url.pathname === "/rss" && request.method === "POST") {
      return handleRSS(request, env);
    }

    if (url.pathname === "/minecraft" && request.method === "POST") {
      return handleMinecraftNews(request, env);
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    // Handle scheduled cron events - check RSS feed and Minecraft news for new entries
    ctx.waitUntil(Promise.all([
      handleRSS(null, env),
      handleMinecraftNews(null, env)
    ]));
  }
};

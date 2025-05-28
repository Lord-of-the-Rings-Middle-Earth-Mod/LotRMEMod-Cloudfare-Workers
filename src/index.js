import { handleGitHubWebhook } from './github.js';
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

    return new Response("Not found", { status: 404 });
  }
};

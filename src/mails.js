import { postToDiscord } from './discord.js';
import { WEBHOOKS, PINGS, AVATAR_URL } from './config.js';

export async function handleMails(request, env) {
  try {
    const emailData = await request.json();

    const subject = emailData.headers?.subject || "No Subject";
    const from = emailData.envelope?.from || "Unknown sender";
    const body = emailData.plain || emailData.html || "No content";

    const payload = {
        username: "LotR ME Mail Bot",
        avatar_url: AVATAR_URL,
        content: `📧 New E-Mail from *${from}*:\n# ${subject}\n\n${body}`,
        embeds: [],
        thread_name: `${subject}`,
        applied_tags: ["1398967786860183724"]
      };

    return postToDiscord(WEBHOOKS.mails, payload);
  } catch (err) {
    return new Response("An error occured while forwarding to discord.", { status: 500 });
  }
}

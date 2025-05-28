import { postToDiscord } from './discord.js';
import { WEBHOOKS, PINGS, AVATAR_URL, FOOTER_TEXT } from './config.js';

export async function handleMails(request, env) {
  try {
    const emailData = await request.json();

    const subject = emailData.headers?.subject || "No Subject";
    const from = emailData.envelope?.from || "Unknown sender";
    const body = emailData.plain || emailData.html || "No content";

    const payload = {
        username: "Mail Bot",
        avatar_url: "https://drive.google.com/file/d/1qSD9k5acGXM2T7XdH_yjJdEZjF8VLUIi/view?usp=sharing",
        content: `📧 New E-Mail from **${from}**:\n**${subject}**\n\n${body.substring(0, 1000)}`,
        footer: {
          text: FOOTER_TEXT
        }
      };

    return postToDiscord(WEBHOOKS.mails, payload);
  } catch (err) {
    return new Response("An error occured while forwarding to discord.", { status: 500 });
  }
}

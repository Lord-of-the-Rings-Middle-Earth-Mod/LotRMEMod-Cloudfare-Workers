import { readFromKV, saveToKV } from './kvUtils.js';
import { WEBHOOKS, PINGS, AVATAR_URL, FOOTER_TEXT } from './config.js';
import { postToDiscord } from './discord.js';
import RSSParser from 'rss-parser';

// Die Feed-URL und der Webhook-URL kommen aus der config oder werden dynamisch übergeben
const POSTED_IDS_KEY = "posted_ids"; // Der Schlüssel für die geposteten IDs im KV

// Verarbeitet den RSS-Feed und sendet neue Posts an Discord
export const processRssFeed = async (env, feedUrl, webhookUrl, kvID) => {
  const feedRes = await fetch(feedUrl);
  const feedText = await feedRes.text();

  const parser = new RSSParser();
  const feed = await parser.parseString(feedText);

  // Liest bereits gepostete IDs aus dem KV
  const postedIds = await readFromKV(env, kvID, POSTED_IDS_KEY) || [];

  // Iteriert über alle neuen Feed-Items
  feed.items.forEach(async (item) => {
    const id = item.id;
    const title = item.title;
    const link = item.link;
    const content = item.content;
    
    // Wenn der Post bereits gepostet wurde, überspringen
    if (postedIds.includes(id)) {
      return;
    }

    // Bereinigt den HTML-Inhalt
    const cleanedContent = cleanHtml(content);
    const discordMarkdown = toDiscordMarkdown(cleanedContent, link);

    const payload = {
      username: "Fabric RSS Bot",
      avatar_url: AVATAR_URL,
      content: `${PINGS.news}\n\n${discordMarkdown}`,
      footer: {
        text: FOOTER_TEXT
      }
    };

    // Posten an Discord
    await postToDiscord(webhookUrl, payload);

    // ID speichern, um Duplikate zu vermeiden
    postedIds.push(id);
    await saveToKV(env, kvID, POSTED_IDS_KEY, postedIds);
  });

  console.log('Neue Posts verarbeitet und gepostet.');
};

// Hilfsfunktionen für das Bereinigen und Formatieren von HTML-Inhalten
function cleanHtml(html) {
  return html
    .replace(/<h2[^>]*>/gi, "\n## ")
    .replace(/<h3[^>]*>/gi, "\n### ")
    .replace(/<\/h2>|<\/h3>/gi, "")
    .replace(/<p[^>]*>/gi, "\n")
    .replace(/<\/p>/gi, "")
    .replace(/<ul[^>]*>/gi, "\n")
    .replace(/<\/ul>/gi, "")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "")
    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`")
    .replace(/<a href="(.*?)".*?>(.*?)<\/a>/gi, "[$2]($1)")
    .replace(/<\/?[^>]+(>|$)/g, "") // Entferne alles andere
    .trim();
}

function toDiscordMarkdown(text, link) {
  const disclaimer = `> [📖 Zur Originalmeldung](${link})`;
  return `${disclaimer}\n\n${text}`;
}

import { postToDiscord } from './discord.js';
import { WEBHOOKS, PINGS, AVATAR_URL } from './config.js';
import { readFromKV, saveToKV } from './kvutils.js';

// RSS feed URL for Fabric MC
const RSS_FEED_URL = 'https://fabricmc.net/feed.xml';

// KV storage key for tracking processed entries
const PROCESSED_ENTRIES_KEY = 'fabric_rss_processed_entries';

/**
 * Handles RSS feed processing - can be called from cron or manual trigger
 * @param {Request} request - The incoming request (optional for cron)
 * @param {Object} env - Environment variables including KV storage
 * @returns {Response} - Response indicating success or failure
 */
export async function handleRSS(request, env) {
  try {
    console.log('Starting RSS feed processing...');
    
    // Fetch the RSS feed
    const rssResponse = await fetch(RSS_FEED_URL);
    if (!rssResponse.ok) {
      throw new Error(`Failed to fetch RSS feed: ${rssResponse.statusText}`);
    }
    
    const rssText = await rssResponse.text();
    console.log('RSS feed fetched successfully');
    
    // Parse the RSS feed
    const entries = await parseRSSFeed(rssText);
    console.log(`Found ${entries.length} entries in RSS feed`);
    
    // Get previously processed entries from KV storage
    const processedEntries = await readFromKV(env, 'FABRIC_KV', PROCESSED_ENTRIES_KEY) || [];
    console.log(`Previously processed entries: ${processedEntries.length}`);
    
    // Filter out already processed entries
    const newEntries = entries.filter(entry => !processedEntries.includes(entry.id));
    console.log(`New entries to process: ${newEntries.length}`);
    
    if (newEntries.length === 0) {
      return new Response('No new entries to process', { status: 200 });
    }
    
    // Process new entries (oldest first to maintain chronological order)
    const sortedNewEntries = newEntries.sort((a, b) => new Date(a.published) - new Date(b.published));
    
    for (const entry of sortedNewEntries) {
      try {
        await sendEntryToDiscord(entry);
        processedEntries.push(entry.id);
        console.log(`Successfully processed entry: ${entry.title}`);
      } catch (error) {
        console.error(`Failed to process entry ${entry.title}:`, error);
        // Continue processing other entries even if one fails
      }
    }
    
    // Update KV storage with processed entries (keep only last 100 to prevent unbounded growth)
    const updatedProcessedEntries = processedEntries.slice(-100);
    await saveToKV(env, 'FABRIC_KV', PROCESSED_ENTRIES_KEY, updatedProcessedEntries);
    
    return new Response(`Successfully processed ${sortedNewEntries.length} new entries`, { status: 200 });
    
  } catch (error) {
    console.error('Error processing RSS feed:', error);
    return new Response(`Error processing RSS feed: ${error.message}`, { status: 500 });
  }
}

/**
 * Parses RSS feed XML and extracts entry information
 * @param {string} rssText - The RSS feed XML text
 * @returns {Array} - Array of entry objects with title, id, content, published
 */
async function parseRSSFeed(rssText) {
  // Parse XML using DOMParser (available in Cloudflare Workers)
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(rssText, 'text/xml');
  
  // Check for parsing errors
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Failed to parse RSS XML');
  }
  
  // Extract entries from the feed
  const entries = [];
  const entryElements = xmlDoc.querySelectorAll('entry');
  
  for (const entryElement of entryElements) {
    try {
      const entry = {
        title: getTextContent(entryElement, 'title'),
        id: getTextContent(entryElement, 'id'),
        content: getTextContent(entryElement, 'content'),
        published: getTextContent(entryElement, 'published'),
        link: getLinkHref(entryElement)
      };
      
      // Validate required fields
      if (entry.title && entry.id && entry.published) {
        entries.push(entry);
      }
    } catch (error) {
      console.error('Error parsing entry:', error);
      // Continue with other entries
    }
  }
  
  return entries;
}

/**
 * Helper function to safely get text content from XML element
 * @param {Element} parent - Parent XML element
 * @param {string} tagName - Tag name to search for
 * @returns {string} - Text content or empty string
 */
function getTextContent(parent, tagName) {
  const element = parent.querySelector(tagName);
  return element ? element.textContent.trim() : '';
}

/**
 * Helper function to get href attribute from link element
 * @param {Element} parent - Parent XML element
 * @returns {string} - Link href or empty string
 */
function getLinkHref(parent) {
  const linkElement = parent.querySelector('link[rel="alternate"]');
  return linkElement ? linkElement.getAttribute('href') || '' : '';
}

/**
 * Sends an RSS entry to Discord using the specified format
 * @param {Object} entry - RSS entry object
 */
async function sendEntryToDiscord(entry) {
  // Clean up HTML content for description
  const cleanContent = stripHtml(entry.content).substring(0, 2000); // Limit length
  
  // Format the Discord payload according to specification
  const payload = {
    content: "<@&1371820347543916554>", // Role ping as specified
    embeds: [
      {
        footer: {
          text: "The original Post was made on the Fabric RSS-Feed"
        },
        title: entry.title,
        url: entry.link || entry.id,
        description: cleanContent,
        timestamp: entry.published
      }
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "Original Post",
            url: entry.link || entry.id,
            custom_id: `p_${Date.now()}`
          }
        ]
      }
    ],
    username: "Fabric RSS Bot",
    thread_name: entry.title,
    avatar_url: "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256"
  };
  
  return postToDiscord(WEBHOOKS.fabricblog, payload);
}

/**
 * Strips HTML tags from content for use in Discord
 * @param {string} html - HTML content
 * @returns {string} - Plain text content
 */
function stripHtml(html) {
  if (!html) return '';
  
  // Simple HTML tag removal - replace with plain text equivalents
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
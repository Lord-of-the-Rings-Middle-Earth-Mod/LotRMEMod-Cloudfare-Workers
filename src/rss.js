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
        console.log(`Processing entry: ${entry.title}`);
        const discordResponse = await sendEntryToDiscord(entry);
        
        if (discordResponse.status === 200) {
          processedEntries.push(entry.id);
          console.log(`Successfully processed entry: ${entry.title}`);
        } else {
          console.error(`Failed to send entry to Discord: ${entry.title}, Response: ${discordResponse.status}`);
          // Still mark as processed to avoid retrying, but log the failure
          processedEntries.push(entry.id);
        }
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
  // Use regex-based parsing since DOMParser is not available in Cloudflare Workers
  const entries = [];
  
  // Extract all <entry> blocks
  const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  let entryMatch;
  
  while ((entryMatch = entryRegex.exec(rssText)) !== null) {
    const entryContent = entryMatch[1];
    
    try {
      // Extract individual fields from the entry
      const entry = {
        title: extractXMLContent(entryContent, 'title'),
        id: extractXMLContent(entryContent, 'id'),
        content: extractXMLContent(entryContent, 'content'),
        published: extractXMLContent(entryContent, 'published'),
        link: extractLinkHref(entryContent)
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
 * Helper function to extract text content from XML using regex
 * @param {string} xmlContent - XML content string
 * @param {string} tagName - Tag name to search for
 * @returns {string} - Text content or empty string
 */
function extractXMLContent(xmlContent, tagName) {
  // Create regex to match the tag and extract content
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xmlContent.match(regex);
  
  if (match && match[1]) {
    // Decode HTML entities and trim whitespace
    return decodeHTMLEntities(match[1].trim());
  }
  
  return '';
}

/**
 * Helper function to extract href from link element using regex
 * @param {string} xmlContent - XML content string
 * @returns {string} - Link href or empty string
 */
function extractLinkHref(xmlContent) {
  // Look for link with rel="alternate" attribute - check both attribute orders
  const alternateRegex1 = /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*>/i;
  const alternateRegex2 = /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["'][^>]*>/i;
  
  let match = xmlContent.match(alternateRegex1);
  if (match && match[1]) {
    return match[1];
  }
  
  match = xmlContent.match(alternateRegex2);
  if (match && match[1]) {
    return match[1];
  }
  
  // Fallback: look for any link with href
  const anyLinkRegex = /<link[^>]*href=["']([^"']+)["'][^>]*>/i;
  match = xmlContent.match(anyLinkRegex);
  
  return match && match[1] ? match[1] : '';
}

/**
 * Helper function to decode common HTML entities
 * @param {string} text - Text with HTML entities
 * @returns {string} - Decoded text
 */
function decodeHTMLEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Sends an RSS entry to Discord using the specified format
 * @param {Object} entry - RSS entry object
 */
async function sendEntryToDiscord(entry) {
  // Clean up HTML content for message content
  // Discord message content limit is 2000 chars, accounting for role ping and newlines
  const cleanContent = stripHtml(entry.content).substring(0, 1950); // Limit length for role ping + newlines
  
  // Ensure we have a valid URL for the entry
  const entryUrl = entry.link || entry.id;
  if (!entryUrl || (!entryUrl.startsWith('http://') && !entryUrl.startsWith('https://'))) {
    console.warn(`Entry "${entry.title}" has invalid URL: ${entryUrl}`);
  }
  
  // Format the Discord payload according to specification
  const payload = {
    content: `<@&1371820347543916554>\n\n${cleanContent}`, // Role ping followed by content
    embeds: [
      {
        footer: {
          text: "The original Post was made on the Fabric RSS-Feed"
        },
        title: entry.title,
        url: entryUrl,
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
            url: entryUrl
          },
          {
            type: 2,
            style: 5,
            url: "https://fabricmc.net/blog/",
            label: "Fabric Feed"
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
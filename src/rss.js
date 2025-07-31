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
 * Splits content into chunks that fit within Discord's message limits
 * @param {string} content - Content to split
 * @param {number} maxLength - Maximum length per chunk (default: 1950 to account for role ping)
 * @returns {Array<string>} - Array of content chunks
 */
function splitContentIntoChunks(content, maxLength = 1950) {
  if (!content || content.length <= maxLength) {
    return [content || ''];
  }
  
  const chunks = [];
  let currentChunk = '';
  
  // Split by paragraphs first (double newlines)
  const paragraphs = content.split('\n\n');
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the limit
    if (currentChunk.length + paragraph.length + 2 > maxLength) {
      // If current chunk has content, add it to chunks
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // If the paragraph itself is too long, split it by sentences
      if (paragraph.length > maxLength) {
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 1 > maxLength) {
            if (currentChunk.trim()) {
              chunks.push(currentChunk.trim());
              currentChunk = '';
            }
            
            // If even a sentence is too long, split by words
            if (sentence.length > maxLength) {
              const words = sentence.split(' ');
              for (const word of words) {
                if (currentChunk.length + word.length + 1 > maxLength) {
                  if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                    currentChunk = word;
                  } else {
                    // Word itself is too long, forcibly split it
                    if (word.length > maxLength) {
                      for (let i = 0; i < word.length; i += maxLength) {
                        chunks.push(word.slice(i, i + maxLength));
                      }
                    } else {
                      currentChunk = word;
                    }
                  }
                } else {
                  currentChunk += (currentChunk ? ' ' : '') + word;
                }
              }
            } else {
              currentChunk = sentence;
            }
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          }
        }
      } else {
        currentChunk = paragraph;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  // Add any remaining content
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.length > 0 ? chunks : [''];
}

/**
 * Sends an RSS entry to Discord using the specified format, handling multi-message posts
 * @param {Object} entry - RSS entry object
 */
async function sendEntryToDiscord(entry) {
  // Convert HTML content to Markdown for message content
  const fullContent = htmlToMarkdown(entry.content);
  
  // Ensure we have a valid URL for the entry
  const entryUrl = entry.link || entry.id;
  if (!entryUrl || (!entryUrl.startsWith('http://') && !entryUrl.startsWith('https://'))) {
    console.warn(`Entry "${entry.title}" has invalid URL: ${entryUrl}`);
  }
  
  // Calculate actual overhead: role ping (25) + newlines (2) = 27 chars
  // Discord limit is 2000, so we can use up to 1973 chars for content
  // Use 1970 to be safe
  const rolePin = `<@&1371820347543916554>\n\n`;
  const maxContentLength = 2000 - rolePin.length - 10; // 10 chars buffer for safety
  
  // Try to fit content in a single message to preserve forum thread functionality
  if (fullContent.length <= maxContentLength) {
    console.log(`Entry "${entry.title}" fits in single message (${fullContent.length} chars)`);
    
    // Send as single message with forum thread creation
    const singlePayload = {
      content: `${rolePin}${fullContent}`,
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
    
    return await postToDiscord(WEBHOOKS.fabricblog, singlePayload);
  }
  
  // If content is too long, we have a limitation with Discord forum webhooks
  // Forum webhooks with thread_name return 204 No Content, making it impossible
  // to get the thread_id for follow-up messages
  console.warn(`Entry "${entry.title}" is too long for single message (${fullContent.length} chars)`);
  console.warn("Discord forum webhooks don't support multi-message threads properly.");
  console.warn("Consider using a regular channel webhook or truncating content.");
  
  // For now, send a truncated version with a note about the limitation
  const truncatedContent = fullContent.substring(0, maxContentLength - 50) + "...";
  const truncatedPayload = {
    content: `${rolePin}${truncatedContent}\n\n*[Content truncated due to Discord forum webhook limitations]*`,
    embeds: [
      {
        footer: {
          text: "The original Post was made on the Fabric RSS-Feed"
        },
        title: entry.title,
        url: entryUrl,
        timestamp: entry.published,
        description: "**Full content available at the original post link**"
      }
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "Read Full Post",
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
  
  return await postToDiscord(WEBHOOKS.fabricblog, truncatedPayload);
}

/**
 * Alternative implementation for regular channel webhooks (not forum channels)
 * This supports full multi-message posts but doesn't create forum threads
 * Uncomment and use this function if switching to a regular channel webhook
 */
/*
async function sendEntryToDiscordRegularChannel(entry) {
  // Convert HTML content to Markdown for message content
  const fullContent = htmlToMarkdown(entry.content);
  
  // Split content into chunks that fit within Discord's limits
  const contentChunks = splitContentIntoChunks(fullContent, 1900); // 1900 to account for role ping + title + padding
  
  // Ensure we have a valid URL for the entry
  const entryUrl = entry.link || entry.id;
  if (!entryUrl || (!entryUrl.startsWith('http://') && !entryUrl.startsWith('https://'))) {
    console.warn(`Entry "${entry.title}" has invalid URL: ${entryUrl}`);
  }
  
  console.log(`Entry "${entry.title}" content split into ${contentChunks.length} chunks`);
  
  // Send the first message with full metadata (no thread_name for regular channels)
  const firstPayload = {
    content: `<@&1371820347543916554>\n\n**${entry.title}**\n\n${contentChunks[0]}`,
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
    avatar_url: "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256"
  };
  
  const firstResponse = await postToDiscord(WEBHOOKS.fabricblog, firstPayload);
  
  if (firstResponse.status !== 200) {
    console.error(`Failed to send first message for entry: ${entry.title}`);
    return firstResponse;
  }
  
  // Send follow-up messages for multi-chunk content
  for (let i = 1; i < contentChunks.length; i++) {
    try {
      const followUpPayload = {
        content: `**${entry.title} (continued ${i}/${contentChunks.length - 1})**\n\n${contentChunks[i]}`,
        username: "Fabric RSS Bot",
        avatar_url: "https://gravatar.com/userimage/252885236/50dd5bda073144e4f2505039bf8bb6a0.jpeg?size=256"
      };
      
      const followUpResponse = await postToDiscord(WEBHOOKS.fabricblog, followUpPayload);
      
      if (followUpResponse.status !== 200) {
        console.error(`Failed to send follow-up message ${i} for entry: ${entry.title}`);
      } else {
        console.log(`Successfully sent follow-up message ${i}/${contentChunks.length - 1} for entry: ${entry.title}`);
      }
      
      // Add delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`Error sending follow-up message ${i} for entry ${entry.title}:`, error);
    }
  }
  
  return firstResponse;
}
*/
}

/**
 * Converts HTML content to Markdown format for Discord
 * @param {string} html - HTML content
 * @returns {string} - Markdown formatted content
 */
function htmlToMarkdown(html) {
  if (!html) return '';
  
  let markdown = html;
  
  // Convert headings to markdown headers
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n\n');
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n\n');
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n\n');
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n\n');
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n##### $1\n\n');
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n###### $1\n\n');
  
  // Convert strong/bold tags to markdown bold
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  
  // Convert code tags to markdown code
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  
  // Convert blockquotes to markdown blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, (match, content) => {
    // Clean the content first by removing HTML tags, then format as blockquote
    const cleanContent = content.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1').replace(/<[^>]*>/g, '').trim();
    return '\n> ' + cleanContent.split('\n').map(line => line.trim()).filter(line => line).join('\n> ') + '\n\n';
  });
  
  // Convert unordered lists to markdown lists
  markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gi, (match, listContent) => {
    // Extract list items and convert to markdown
    const listItems = listContent.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
    const markdownItems = listItems.map(item => {
      // First process any nested HTML in the list item content
      let content = item.replace(/<li[^>]*>(.*?)<\/li>/gi, '$1');
      // Convert strong/bold in list items
      content = content.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
      content = content.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
      // Convert code in list items
      content = content.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
      // Remove any remaining HTML tags
      content = content.replace(/<[^>]*>/g, '').trim();
      return `- ${content}`;
    });
    return '\n' + markdownItems.join('\n') + '\n\n';
  });
  
  // Convert ordered lists to markdown lists
  markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gi, (match, listContent) => {
    // Extract list items and convert to markdown
    const listItems = listContent.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
    const markdownItems = listItems.map((item, index) => {
      // First process any nested HTML in the list item content
      let content = item.replace(/<li[^>]*>(.*?)<\/li>/gi, '$1');
      // Convert strong/bold in list items
      content = content.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
      content = content.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
      // Convert code in list items
      content = content.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
      // Remove any remaining HTML tags
      content = content.replace(/<[^>]*>/g, '').trim();
      return `${index + 1}. ${content}`;
    });
    return '\n' + markdownItems.join('\n') + '\n\n';
  });
  
  // Convert paragraphs - add line breaks
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n\n');
  
  // Convert line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
  
  // Convert div endings to line breaks
  markdown = markdown.replace(/<\/div>/gi, '\n');
  
  // Remove any remaining HTML tags
  markdown = markdown.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  markdown = markdown
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  
  // Clean up excessive whitespace and line breaks
  markdown = markdown
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace multiple line breaks with double line breaks
    .replace(/^\s+|\s+$/g, '') // Trim start and end
    .replace(/[ \t]+/g, ' '); // Replace multiple spaces with single space
  
  return markdown;
}
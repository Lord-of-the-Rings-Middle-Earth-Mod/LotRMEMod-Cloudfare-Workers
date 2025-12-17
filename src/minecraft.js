import { postToDiscord } from './discord.js';
import { WEBHOOKS, PINGS, AVATAR_URL } from './config.js';
import { readFromKV, saveToKV } from './kvutils.js';

// Minecraft articles URL
const MINECRAFT_ARTICLES_URL = 'https://www.minecraft.net/en-us/articles';

// KV storage key for tracking processed articles
const PROCESSED_ARTICLES_KEY = 'minecraft_processed_articles';

/**
 * Handles Minecraft news processing - can be called from cron or manual trigger
 * @param {Request} request - The incoming request (optional for cron)
 * @param {Object} env - Environment variables including KV storage
 * @returns {Response} - Response indicating success or failure
 */
export async function handleMinecraftNews(request, env) {
  try {
    console.log('Starting Minecraft news processing...');
    
    // Fetch the Minecraft articles page
    const articlesResponse = await fetch(MINECRAFT_ARTICLES_URL);
    if (!articlesResponse.ok) {
      throw new Error(`Failed to fetch Minecraft articles: ${articlesResponse.statusText}`);
    }
    
    const htmlText = await articlesResponse.text();
    console.log('Minecraft articles page fetched successfully');
    
    // Parse the HTML and extract article data
    const articles = await parseMinecraftArticles(htmlText);
    console.log(`Found ${articles.length} articles on page`);
    
    // Get previously processed articles from KV storage
    const processedArticles = await readFromKV(env, 'FABRIC_KV', PROCESSED_ARTICLES_KEY) || [];
    console.log(`Previously processed articles: ${processedArticles.length}`);
    
    // Filter out already processed articles
    const newArticles = articles.filter(article => !processedArticles.includes(article.url));
    console.log(`New articles to process: ${newArticles.length}`);
    
    if (newArticles.length === 0) {
      return new Response('No new articles to process', { status: 200 });
    }
    
    // Process new articles (limit to 5 to avoid flooding)
    const articlesToProcess = newArticles.slice(0, 5);
    
    for (const article of articlesToProcess) {
      try {
        console.log(`Processing article: ${article.title}`);
        const discordResponse = await sendArticleToDiscord(article);
        
        if (discordResponse.status === 200) {
          processedArticles.push(article.url);
          console.log(`Successfully processed article: ${article.title}`);
        } else {
          console.error(`Failed to send article to Discord: ${article.title}, Response: ${discordResponse.status}`);
          // Still mark as processed to avoid retrying, but log the failure
          processedArticles.push(article.url);
        }
      } catch (error) {
        console.error(`Failed to process article ${article.title}:`, error);
        // Continue processing other articles even if one fails
      }
    }
    
    // Update KV storage with processed articles (keep only last 100 to prevent unbounded growth)
    const updatedProcessedArticles = processedArticles.slice(-100);
    await saveToKV(env, 'FABRIC_KV', PROCESSED_ARTICLES_KEY, updatedProcessedArticles);
    
    return new Response(`Successfully processed ${articlesToProcess.length} new articles`, { status: 200 });
    
  } catch (error) {
    console.error('Error processing Minecraft news:', error);
    return new Response(`Error processing Minecraft news: ${error.message}`, { status: 500 });
  }
}

/**
 * Parses Minecraft articles HTML and extracts article information
 * Uses HTMLRewriter for Edge-compatible parsing
 * @param {string} htmlText - The HTML page text
 * @returns {Array} - Array of article objects with title, url, date, teaser
 */
async function parseMinecraftArticles(htmlText) {
  const articles = [];
  
  // Use regex-based parsing as a fallback since HTMLRewriter may not be available in all contexts
  // Looking for article cards with common patterns
  
  // Pattern 1: Look for article elements with links
  const articlePatterns = [
    // Match article tags with href links
    /<article[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<h[2-4][^>]*>(.*?)<\/h[2-4]>[\s\S]*?<\/article>/gi,
    // Match card-style divs with links and headings
    /<div[^>]*class=["'][^"']*card[^"']*["'][^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<h[2-4][^>]*>(.*?)<\/h[2-4]>[\s\S]*?<\/div>/gi,
    // Match any link with heading inside
    /<a[^>]*href=["'](\/[^"']*\/article[^"']+)["'][^>]*>[\s\S]*?<h[2-4][^>]*>(.*?)<\/h[2-4]>[\s\S]*?<\/a>/gi
  ];
  
  // Try each pattern
  for (const pattern of articlePatterns) {
    let match;
    while ((match = pattern.exec(htmlText)) !== null) {
      const url = match[1];
      const title = cleanHTML(match[2]);
      
      // Build full URL if relative
      const fullUrl = url.startsWith('http') ? url : `https://www.minecraft.net${url}`;
      
      // Validate the URL looks like an article
      if (fullUrl.includes('/article') && title.length > 0) {
        // Try to extract additional info from the matched HTML block
        const blockHtml = match[0];
        const date = extractDate(blockHtml);
        const teaser = extractTeaser(blockHtml);
        
        // Check if we already have this article
        const isDuplicate = articles.some(a => a.url === fullUrl);
        if (!isDuplicate) {
          articles.push({
            title,
            url: fullUrl,
            date,
            teaser
          });
        }
      }
    }
    
    // If we found articles with this pattern, stop trying other patterns
    if (articles.length > 0) break;
  }
  
  return articles;
}

/**
 * Extracts date from HTML block
 * @param {string} html - HTML content
 * @returns {string} - Date string or empty string
 */
function extractDate(html) {
  // Look for common date patterns
  const datePatterns = [
    /<time[^>]*datetime=["']([^"']+)["'][^>]*>/i,
    /<span[^>]*class=["'][^"']*date[^"']*["'][^>]*>([^<]+)<\/span>/i,
    /(\d{1,2})\s+(days?|hours?|weeks?|months?)\s+ago/i,
    /\d{4}-\d{2}-\d{2}/
  ];
  
  for (const pattern of datePatterns) {
    const match = html.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  
  return '';
}

/**
 * Extracts teaser/description from HTML block
 * @param {string} html - HTML content
 * @returns {string} - Teaser text or empty string
 */
function extractTeaser(html) {
  // Look for paragraph or description elements
  const teaserPatterns = [
    /<p[^>]*class=["'][^"']*description[^"']*["'][^>]*>([^<]+)<\/p>/i,
    /<p[^>]*class=["'][^"']*teaser[^"']*["'][^>]*>([^<]+)<\/p>/i,
    /<div[^>]*class=["'][^"']*description[^"']*["'][^>]*>([^<]+)<\/div>/i
  ];
  
  for (const pattern of teaserPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return cleanHTML(match[1]).substring(0, 200);
    }
  }
  
  return '';
}

/**
 * Cleans HTML tags and entities from text
 * @param {string} text - Text with HTML
 * @returns {string} - Clean text
 */
function cleanHTML(text) {
  if (!text) return '';
  
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Sends a Minecraft article to Discord as a forum thread
 * @param {Object} article - Article object with title, url, date, teaser
 */
async function sendArticleToDiscord(article) {
  // Build the message content with role ping and teaser
  let messageContent = `${PINGS.minecraftnews}\n\n`;
  
  if (article.teaser) {
    messageContent += `${article.teaser}\n\n`;
  }
  
  messageContent += '*[Read the full article on Minecraft.net]*';
  
  // Format date for Discord if available
  let timestamp = null;
  if (article.date) {
    // Try to parse various date formats
    try {
      // If it's an ISO date
      if (article.date.match(/^\d{4}-\d{2}-\d{2}/)) {
        timestamp = new Date(article.date).toISOString();
      } else if (article.date.includes('ago')) {
        // For "X days ago" format, use current time
        timestamp = new Date().toISOString();
      }
    } catch (e) {
      console.warn(`Failed to parse date: ${article.date}`, e);
    }
  }
  
  // If no timestamp could be parsed, use current time
  if (!timestamp) {
    timestamp = new Date().toISOString();
  }
  
  console.log(`Article "${article.title}" will be posted as forum thread`);
  
  // Create the forum thread payload
  const forumPayload = {
    content: messageContent,
    thread_name: article.title,
    embeds: [
      {
        footer: {
          text: "The original article was published on Minecraft.net"
        },
        title: article.title,
        url: article.url,
        timestamp: timestamp
      }
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "Read Article",
            url: article.url
          },
          {
            type: 2,
            style: 5,
            url: "https://www.minecraft.net/en-us/articles",
            label: "All Articles"
          }
        ]
      }
    ],
    username: "Minecraft News Bot",
    avatar_url: "https://www.minecraft.net/etc.clientlibs/minecraft/clientlibs/main/resources/img/minecraft-creeper-icon.jpg"
  };
  
  const response = await postToDiscord(WEBHOOKS.minecraftnews, forumPayload);
  
  if (response.status !== 200) {
    console.error(`Failed to create forum thread for article: ${article.title}`);
  } else {
    console.log(`Successfully created forum thread for article: ${article.title}`);
  }
  
  return response;
}

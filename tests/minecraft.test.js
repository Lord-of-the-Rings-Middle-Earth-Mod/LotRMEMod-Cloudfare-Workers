import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMinecraftNews } from '../src/minecraft.js';

// Mock the dependencies
vi.mock('../src/discord.js', () => ({
  postToDiscord: vi.fn()
}));

vi.mock('../src/kvutils.js', () => ({
  readFromKV: vi.fn(),
  saveToKV: vi.fn()
}));

vi.mock('../src/config.js', () => ({
  WEBHOOKS: {
    minecraftnews: 'https://discord.com/api/webhooks/123/minecraftnews'
  },
  PINGS: {
    minecraftnews: '<@&PLACEHOLDER_MINECRAFT_NEWS_ROLE_ID>'
  },
  AVATAR_URL: 'https://gravatar.com/test.jpeg'
}));

// Mock fetch globally
global.fetch = vi.fn();

// Mock console to suppress output during tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
};

import { postToDiscord } from '../src/discord.js';
import { readFromKV, saveToKV } from '../src/kvutils.js';

describe('Minecraft News Module', () => {
  const mockEnv = { FABRIC_KV: {} };
  
  const sampleMinecraftHTML = `
    <!DOCTYPE html>
    <html>
    <body>
      <article class="article-card">
        <a href="/en-us/article/minecraft-snapshot-24w01a">
          <h2>Minecraft Snapshot 24w01a</h2>
          <p class="description">This week's snapshot brings exciting new features!</p>
          <time datetime="2024-01-03">3 days ago</time>
        </a>
      </article>
      <article class="article-card">
        <a href="/en-us/article/minecraft-1-20-5-released">
          <h2>Minecraft 1.20.5 Released</h2>
          <p class="description">The latest update is now available for all players.</p>
          <time datetime="2024-01-01">5 days ago</time>
        </a>
      </article>
      <article class="article-card">
        <a href="/en-us/article/bedrock-update">
          <h2>Bedrock Edition Update</h2>
          <p class="description">New features for Bedrock players.</p>
        </a>
      </article>
    </body>
    </html>
  `;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default successful responses
    global.fetch.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(sampleMinecraftHTML)
    });
    
    postToDiscord.mockResolvedValue({ status: 200 });
    readFromKV.mockResolvedValue([]);
    saveToKV.mockResolvedValue();
  });

  describe('handleMinecraftNews', () => {
    it('should successfully process Minecraft articles with new entries', async () => {
      const result = await handleMinecraftNews(null, mockEnv);

      expect(global.fetch).toHaveBeenCalledWith('https://www.minecraft.net/en-us/articles');
      expect(readFromKV).toHaveBeenCalledWith(mockEnv, 'FABRIC_KV', 'minecraft_processed_articles');
      expect(postToDiscord).toHaveBeenCalledTimes(3);
      expect(saveToKV).toHaveBeenCalledWith(
        mockEnv,
        'FABRIC_KV',
        'minecraft_processed_articles',
        expect.arrayContaining([
          'https://www.minecraft.net/en-us/article/minecraft-snapshot-24w01a',
          'https://www.minecraft.net/en-us/article/minecraft-1-20-5-released',
          'https://www.minecraft.net/en-us/article/bedrock-update'
        ])
      );
      expect(result.status).toBe(200);
      expect(await result.text()).toBe('Successfully processed 3 new articles');
    });

    it('should skip already processed articles', async () => {
      readFromKV.mockResolvedValue([
        'https://www.minecraft.net/en-us/article/minecraft-snapshot-24w01a'
      ]);

      const result = await handleMinecraftNews(null, mockEnv);

      expect(postToDiscord).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(200);
      expect(await result.text()).toBe('Successfully processed 2 new articles');
    });

    it('should return success when no new articles found', async () => {
      readFromKV.mockResolvedValue([
        'https://www.minecraft.net/en-us/article/minecraft-snapshot-24w01a',
        'https://www.minecraft.net/en-us/article/minecraft-1-20-5-released',
        'https://www.minecraft.net/en-us/article/bedrock-update'
      ]);

      const result = await handleMinecraftNews(null, mockEnv);

      expect(postToDiscord).not.toHaveBeenCalled();
      expect(result.status).toBe(200);
      expect(await result.text()).toBe('No new articles to process');
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        statusText: 'Service Unavailable'
      });

      const result = await handleMinecraftNews(null, mockEnv);
      const resultText = await result.text();

      expect(result.status).toBe(500);
      expect(resultText).toContain('Error processing Minecraft news');
      expect(resultText).toContain('Failed to fetch Minecraft articles');
    });

    it('should handle empty HTML content', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('<html><body></body></html>')
      });

      const result = await handleMinecraftNews(null, mockEnv);

      expect(result.status).toBe(200);
      expect(await result.text()).toBe('No new articles to process');
    });

    it('should limit processing to 5 articles to avoid flooding', async () => {
      const manyArticlesHTML = `
        <html><body>
          ${Array.from({ length: 10 }, (_, i) => `
            <article>
              <a href="/en-us/article/test-article-${i}">
                <h2>Test Article ${i}</h2>
              </a>
            </article>
          `).join('')}
        </body></html>
      `;
      
      global.fetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(manyArticlesHTML)
      });

      const result = await handleMinecraftNews(null, mockEnv);

      // Should only process 5 articles
      expect(postToDiscord).toHaveBeenCalledTimes(5);
      expect(result.status).toBe(200);
      expect(await result.text()).toBe('Successfully processed 5 new articles');
    });

    it('should continue processing other articles if one fails', async () => {
      postToDiscord
        .mockResolvedValueOnce({ status: 500 }) // First article fails
        .mockResolvedValueOnce({ status: 200 }) // Second succeeds
        .mockResolvedValueOnce({ status: 200 }); // Third succeeds

      const result = await handleMinecraftNews(null, mockEnv);

      expect(postToDiscord).toHaveBeenCalledTimes(3);
      expect(saveToKV).toHaveBeenCalled();
      expect(result.status).toBe(200);
    });

    it('should keep only last 100 processed articles in KV', async () => {
      const largeProcessedList = Array.from({ length: 105 }, (_, i) => 
        `https://www.minecraft.net/en-us/article/old-article-${i}`
      );
      
      readFromKV.mockResolvedValue(largeProcessedList);

      await handleMinecraftNews(null, mockEnv);

      expect(saveToKV).toHaveBeenCalledWith(
        mockEnv,
        'FABRIC_KV',
        'minecraft_processed_articles',
        expect.any(Array)
      );
      
      const savedArray = saveToKV.mock.calls[0][3];
      expect(savedArray.length).toBeLessThanOrEqual(100);
    });

    it('should handle KV read errors gracefully', async () => {
      readFromKV.mockRejectedValue(new Error('KV read failed'));

      const result = await handleMinecraftNews(null, mockEnv);

      expect(result.status).toBe(500);
      expect(await result.text()).toContain('Error processing Minecraft news');
    });

    it('should post articles with correct Discord payload format', async () => {
      await handleMinecraftNews(null, mockEnv);

      expect(postToDiscord).toHaveBeenCalled();
      
      const firstCall = postToDiscord.mock.calls[0];
      const payload = firstCall[1];
      
      // Verify payload structure
      expect(payload).toHaveProperty('content');
      expect(payload.content).toContain('<@&PLACEHOLDER_MINECRAFT_NEWS_ROLE_ID>');
      expect(payload).toHaveProperty('thread_name');
      expect(payload).toHaveProperty('embeds');
      expect(payload.embeds).toHaveLength(1);
      expect(payload.embeds[0]).toHaveProperty('title');
      expect(payload.embeds[0]).toHaveProperty('url');
      expect(payload.embeds[0]).toHaveProperty('timestamp');
      expect(payload).toHaveProperty('components');
      expect(payload.components[0].components).toHaveLength(2); // Two buttons
      expect(payload).toHaveProperty('username', 'Minecraft News Bot');
    });

    it('should parse articles with various HTML structures', async () => {
      const variousHTML = `
        <html><body>
          <div class="card-container">
            <a href="/en-us/article/test-1">
              <h3>Test Article 1</h3>
            </a>
          </div>
          <article>
            <a href="/en-us/article/test-2">
              <h2>Test Article 2</h2>
              <p class="teaser">This is a teaser</p>
            </a>
          </article>
        </body></html>
      `;
      
      global.fetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(variousHTML)
      });

      const result = await handleMinecraftNews(null, mockEnv);

      expect(postToDiscord).toHaveBeenCalled();
      expect(result.status).toBe(200);
    });

    it('should handle articles with absolute URLs', async () => {
      const absoluteUrlHTML = `
        <html><body>
          <article>
            <a href="https://www.minecraft.net/en-us/article/external-article">
              <h2>External Article</h2>
            </a>
          </article>
        </body></html>
      `;
      
      global.fetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(absoluteUrlHTML)
      });

      const result = await handleMinecraftNews(null, mockEnv);

      expect(postToDiscord).toHaveBeenCalled();
      expect(saveToKV).toHaveBeenCalledWith(
        mockEnv,
        'FABRIC_KV',
        'minecraft_processed_articles',
        expect.arrayContaining([
          'https://www.minecraft.net/en-us/article/external-article'
        ])
      );
    });

    it('should extract and include teaser text in Discord message', async () => {
      const htmlWithTeaser = `
        <html><body>
          <article>
            <a href="/en-us/article/test">
              <h2>Test Article</h2>
              <p class="description">This is an exciting update with new features!</p>
            </a>
          </article>
        </body></html>
      `;
      
      global.fetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(htmlWithTeaser)
      });

      await handleMinecraftNews(null, mockEnv);

      const firstCall = postToDiscord.mock.calls[0];
      const payload = firstCall[1];
      
      expect(payload.content).toContain('This is an exciting update with new features!');
    });

    it('should handle invalid HTML gracefully', async () => {
      const invalidHTML = 'This is not HTML at all!';
      
      global.fetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(invalidHTML)
      });

      const result = await handleMinecraftNews(null, mockEnv);

      // Should not crash, just report no articles
      expect(result.status).toBe(200);
      expect(await result.text()).toBe('No new articles to process');
    });
  });
});

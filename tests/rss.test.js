import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRSS } from '../src/rss.js';

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
    fabricblog: 'https://discord.com/api/webhooks/123/fabricblog'
  },
  PINGS: {
    fabricupdates: '<@&1371820347543916554>'
  },
  AVATAR_URL: 'https://gravatar.com/test.jpeg'
}));

// Mock fetch globally
global.fetch = vi.fn();

import { postToDiscord } from '../src/discord.js';
import { readFromKV, saveToKV } from '../src/kvutils.js';

describe('RSS Module', () => {
  const mockEnv = { FABRIC_KV: {} };
  
  const sampleRSSXML = `
    <?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>Test Entry 1</title>
        <id>https://fabricmc.net/2023/01/01/test-entry-1</id>
        <published>2023-01-01T10:00:00Z</published>
        <link rel="alternate" href="https://fabricmc.net/blog/test-entry-1"/>
        <content>This is test content for entry 1</content>
      </entry>
      <entry>
        <title>Test Entry 2</title>
        <id>https://fabricmc.net/2023/01/02/test-entry-2</id>
        <published>2023-01-02T10:00:00Z</published>
        <link rel="alternate" href="https://fabricmc.net/blog/test-entry-2"/>
        <content>This is test content for entry 2</content>
      </entry>
    </feed>
  `;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default successful responses
    global.fetch.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(sampleRSSXML)
    });
    
    postToDiscord.mockResolvedValue({ status: 200 });
    readFromKV.mockResolvedValue([]);
    saveToKV.mockResolvedValue();
  });

  describe('handleRSS', () => {
    it('should successfully process RSS feed with new entries', async () => {
      const result = await handleRSS(null, mockEnv);

      expect(global.fetch).toHaveBeenCalledWith('https://fabricmc.net/feed.xml');
      expect(readFromKV).toHaveBeenCalledWith(mockEnv, 'FABRIC_KV', 'fabric_rss_processed_entries');
      expect(postToDiscord).toHaveBeenCalledTimes(2);
      expect(saveToKV).toHaveBeenCalledWith(
        mockEnv,
        'FABRIC_KV',
        'fabric_rss_processed_entries',
        expect.arrayContaining([
          'https://fabricmc.net/2023/01/01/test-entry-1',
          'https://fabricmc.net/2023/01/02/test-entry-2'
        ])
      );
      expect(result.status).toBe(200);
      expect(await result.text()).toBe('Successfully processed 2 new entries');
    });

    it('should skip already processed entries', async () => {
      readFromKV.mockResolvedValue(['https://fabricmc.net/2023/01/01/test-entry-1']);

      const result = await handleRSS(null, mockEnv);

      expect(postToDiscord).toHaveBeenCalledTimes(1);
      expect(saveToKV).toHaveBeenCalledWith(
        mockEnv,
        'FABRIC_KV',
        'fabric_rss_processed_entries',
        expect.arrayContaining([
          'https://fabricmc.net/2023/01/01/test-entry-1',
          'https://fabricmc.net/2023/01/02/test-entry-2'
        ])
      );
      expect(result.status).toBe(200);
      expect(await result.text()).toBe('Successfully processed 1 new entries');
    });

    it('should return early when no new entries found', async () => {
      readFromKV.mockResolvedValue([
        'https://fabricmc.net/2023/01/01/test-entry-1',
        'https://fabricmc.net/2023/01/02/test-entry-2'
      ]);

      const result = await handleRSS(null, mockEnv);

      expect(postToDiscord).not.toHaveBeenCalled();
      expect(saveToKV).not.toHaveBeenCalled();
      expect(result.status).toBe(200);
      expect(await result.text()).toBe('No new entries to process');
    });

    it('should handle RSS feed fetch error', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      });

      const result = await handleRSS(null, mockEnv);

      expect(result.status).toBe(500);
      expect(await result.text()).toContain('Error processing RSS feed: Failed to fetch RSS feed: Not Found');
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await handleRSS(null, mockEnv);

      expect(result.status).toBe(500);
      expect(await result.text()).toContain('Error processing RSS feed: Network error');
    });

    it('should process entries in chronological order', async () => {
      const unorderedRSSXML = `
        <?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <title>Later Entry</title>
            <id>https://fabricmc.net/2023/01/02/later-entry</id>
            <published>2023-01-02T10:00:00Z</published>
            <link rel="alternate" href="https://fabricmc.net/blog/later-entry"/>
            <content>Later content</content>
          </entry>
          <entry>
            <title>Earlier Entry</title>
            <id>https://fabricmc.net/2023/01/01/earlier-entry</id>
            <published>2023-01-01T10:00:00Z</published>
            <link rel="alternate" href="https://fabricmc.net/blog/earlier-entry"/>
            <content>Earlier content</content>
          </entry>
        </feed>
      `;

      global.fetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(unorderedRSSXML)
      });

      const result = await handleRSS(null, mockEnv);

      expect(postToDiscord).toHaveBeenCalledTimes(2);
      
      // Check that earlier entry was processed first
      const firstCall = postToDiscord.mock.calls[0][1];
      const secondCall = postToDiscord.mock.calls[1][1];
      
      expect(firstCall.thread_name).toBe('Earlier Entry');
      expect(secondCall.thread_name).toBe('Later Entry');
    });

    it('should handle Discord posting failures gracefully', async () => {
      postToDiscord.mockResolvedValue({ status: 500 });

      const result = await handleRSS(null, mockEnv);

      expect(postToDiscord).toHaveBeenCalledTimes(2);
      expect(saveToKV).toHaveBeenCalledWith(
        mockEnv,
        'FABRIC_KV',
        'fabric_rss_processed_entries',
        expect.arrayContaining([
          'https://fabricmc.net/2023/01/01/test-entry-1',
          'https://fabricmc.net/2023/01/02/test-entry-2'
        ])
      );
      expect(result.status).toBe(200);
    });

    it('should limit stored processed entries to 100', async () => {
      const existingEntries = Array.from({ length: 99 }, (_, i) => `existing-entry-${i}`);
      readFromKV.mockResolvedValue(existingEntries);

      const result = await handleRSS(null, mockEnv);

      expect(saveToKV).toHaveBeenCalledWith(
        mockEnv,
        'FABRIC_KV',
        'fabric_rss_processed_entries',
        expect.arrayContaining([
          ...existingEntries.slice(-98), // Should trim to keep only last 98 + 2 new = 100
          'https://fabricmc.net/2023/01/01/test-entry-1',
          'https://fabricmc.net/2023/01/02/test-entry-2'
        ])
      );
    });

    it('should create proper Discord forum thread payload', async () => {
      const result = await handleRSS(null, mockEnv);

      expect(postToDiscord).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/fabricblog',
        expect.objectContaining({
          content: expect.stringContaining('<@&1371820347543916554>'),
          thread_name: 'Test Entry 1',
          username: 'Fabric RSS Bot',
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: 'Test Entry 1',
              url: 'https://fabricmc.net/blog/test-entry-1',
              timestamp: '2023-01-01T10:00:00Z'
            })
          ]),
          components: expect.arrayContaining([
            expect.objectContaining({
              components: expect.arrayContaining([
                expect.objectContaining({
                  label: 'Original Post',
                  url: 'https://fabricmc.net/blog/test-entry-1'
                })
              ])
            })
          ])
        })
      );
    });

    it('should handle HTML content conversion to Markdown', async () => {
      const htmlRSSXML = `
        <?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <title>HTML Entry</title>
            <id>https://fabricmc.net/2023/01/01/html-entry</id>
            <published>2023-01-01T10:00:00Z</published>
            <link rel="alternate" href="https://fabricmc.net/blog/html-entry"/>
            <content>&lt;h2&gt;Title&lt;/h2&gt;&lt;p&gt;This is &lt;strong&gt;bold&lt;/strong&gt; text.&lt;/p&gt;</content>
          </entry>
        </feed>
      `;

      global.fetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(htmlRSSXML)
      });

      const result = await handleRSS(null, mockEnv);

      expect(postToDiscord).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/fabricblog',
        expect.objectContaining({
          content: expect.stringContaining('## Title\n\nThis is **bold** text.')
        })
      );
    });

    it('should truncate long content', async () => {
      const longContent = 'A'.repeat(1000);
      const longRSSXML = `
        <?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <title>Long Entry</title>
            <id>https://fabricmc.net/2023/01/01/long-entry</id>
            <published>2023-01-01T10:00:00Z</published>
            <link rel="alternate" href="https://fabricmc.net/blog/long-entry"/>
            <content>${longContent}</content>
          </entry>
        </feed>
      `;

      global.fetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(longRSSXML)
      });

      const result = await handleRSS(null, mockEnv);

      expect(postToDiscord).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/fabricblog',
        expect.objectContaining({
          content: expect.stringMatching(/.*\[Read the full post on the Fabric blog for complete details\].*/)
        })
      );
    });

    it('should handle malformed XML gracefully', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('<invalid xml>')
      });

      const result = await handleRSS(null, mockEnv);

      expect(result.status).toBe(200);
      expect(await result.text()).toBe('No new entries to process');
    });

    it('should handle entries with missing required fields', async () => {
      const incompleteRSSXML = `
        <?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <title>Complete Entry</title>
            <id>https://fabricmc.net/2023/01/01/complete</id>
            <published>2023-01-01T10:00:00Z</published>
            <content>Complete content</content>
          </entry>
          <entry>
            <title>Incomplete Entry</title>
            <!-- Missing id and published -->
            <content>Incomplete content</content>
          </entry>
        </feed>
      `;

      global.fetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(incompleteRSSXML)
      });

      const result = await handleRSS(null, mockEnv);

      expect(postToDiscord).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(200);
    });
  });
});
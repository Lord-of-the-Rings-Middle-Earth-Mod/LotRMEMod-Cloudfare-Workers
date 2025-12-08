import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { postToDiscord } from '../src/discord.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('Discord Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('postToDiscord', () => {
    const validWebhookUrl = 'https://discord.com/api/webhooks/123456789/abcdefg';
    const testPayload = {
      username: 'Test Bot',
      content: 'Test message'
    };

    it('should successfully post message to Discord', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
        statusText: 'No Content',
        json: vi.fn().mockResolvedValue({}),
        text: vi.fn().mockResolvedValue(''),
        headers: new Map()
      };
      global.fetch.mockResolvedValue(mockResponse);

      const result = await postToDiscord(validWebhookUrl, testPayload);

      expect(global.fetch).toHaveBeenCalledWith(validWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });
      expect(result.status).toBe(200);
    });

    it('should successfully post message with JSON response', async () => {
      const mockDiscordResponse = { id: '1234567890', channel_id: '0987654321' };
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValue(mockDiscordResponse),
        text: vi.fn().mockResolvedValue(''),
        headers: new Map()
      };
      global.fetch.mockResolvedValue(mockResponse);

      const result = await postToDiscord(validWebhookUrl, testPayload);
      const resultData = await result.json();

      expect(result.status).toBe(200);
      expect(resultData.success).toBe(true);
      expect(resultData.discordResponse).toEqual(mockDiscordResponse);
    });

    it('should reject invalid webhook URLs', async () => {
      const invalidUrls = [
        '',
        'https://example.com/webhook',
        'https://discord.com/api/webhooks/PLACEHOLDER/token',
        'not-a-url'
      ];

      for (const url of invalidUrls) {
        const result = await postToDiscord(url, testPayload);
        expect(result.status).toBe(400);
        
        const responseText = await result.text();
        expect(responseText).toContain('Invalid Discord webhook URL');
      }

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle rate limiting with retry', async () => {
      const rateLimitResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([['retry-after', '2']]),
        json: vi.fn(),
        text: vi.fn()
      };
      
      const successResponse = {
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: new Map(),
        json: vi.fn(),
        text: vi.fn()
      };

      global.fetch
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(successResponse);

      const resultPromise = postToDiscord(validWebhookUrl, testPayload);
      
      // Fast-forward past the retry delay
      await vi.advanceTimersByTimeAsync(2000);
      
      const result = await resultPromise;

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(200);
    });

    it('should handle rate limiting with exponential backoff when no retry-after header', async () => {
      const rateLimitResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map(),
        json: vi.fn(),
        text: vi.fn()
      };
      
      const successResponse = {
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: new Map(),
        json: vi.fn(),
        text: vi.fn()
      };

      global.fetch
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(successResponse);

      const resultPromise = postToDiscord(validWebhookUrl, testPayload);
      
      // Fast-forward past the exponential backoff delay (2^1 * 1000 = 2000ms)
      await vi.advanceTimersByTimeAsync(2000);
      
      const result = await resultPromise;

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(200);
    });

    it('should fail after maximum rate limit retries', async () => {
      const rateLimitResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([['retry-after', '1']]),
        json: vi.fn(),
        text: vi.fn()
      };

      global.fetch.mockResolvedValue(rateLimitResponse);

      const resultPromise = postToDiscord(validWebhookUrl, testPayload, null, null, 2);  // maxRetries = 2
      
      // Fast-forward through all retry attempts
      await vi.advanceTimersByTimeAsync(10000);
      
      const result = await resultPromise;

      expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(result.status).toBe(429);
      
      const responseText = await result.text();
      expect(responseText).toContain('Maximum retries reached');
    });

    it('should handle server errors with retry', async () => {
      const serverErrorResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map(),
        json: vi.fn(),
        text: vi.fn().mockResolvedValue('Server error details')
      };
      
      const successResponse = {
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: new Map(),
        json: vi.fn(),
        text: vi.fn()
      };

      global.fetch
        .mockResolvedValueOnce(serverErrorResponse)
        .mockResolvedValueOnce(successResponse);

      const resultPromise = postToDiscord(validWebhookUrl, testPayload);
      
      // Fast-forward past retry delay
      await vi.advanceTimersByTimeAsync(2000);
      
      const result = await resultPromise;

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(200);
    });

    it('should handle client errors without retry', async () => {
      const clientErrorResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Map(),
        json: vi.fn(),
        text: vi.fn().mockResolvedValue('Bad request details')
      };

      global.fetch.mockResolvedValue(clientErrorResponse);

      const result = await postToDiscord(validWebhookUrl, testPayload);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(500);
      
      const responseText = await result.text();
      expect(responseText).toContain('Discord Webhook Error: 400 Bad Request');
    });

    it('should handle network errors with retry', async () => {
      const networkError = new Error('Network error');
      
      const successResponse = {
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: new Map(),
        json: vi.fn(),
        text: vi.fn()
      };

      global.fetch
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(successResponse);

      const resultPromise = postToDiscord(validWebhookUrl, testPayload);
      
      // Fast-forward past retry delay
      await vi.advanceTimersByTimeAsync(2000);
      
      const result = await resultPromise;

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(200);
    });

    it('should fail after maximum network error retries', async () => {
      const networkError = new Error('Network error');
      global.fetch.mockRejectedValue(networkError);

      const resultPromise = postToDiscord(validWebhookUrl, testPayload, null, null, 1);  // maxRetries = 1
      
      // Fast-forward through all retry attempts
      await vi.advanceTimersByTimeAsync(5000);
      
      const result = await resultPromise;

      expect(global.fetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
      expect(result.status).toBe(500);
      
      const responseText = await result.text();
      expect(responseText).toContain('Discord posting failed: Network error');
    });

    it('should handle JSON parsing errors in response', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockRejectedValue(new Error('JSON parse error')),
        text: vi.fn().mockResolvedValue(''),
        headers: new Map()
      };
      global.fetch.mockResolvedValue(mockResponse);

      const result = await postToDiscord(validWebhookUrl, testPayload);

      expect(result.status).toBe(200);
      const resultData = await result.json();
      expect(resultData.success).toBe(true);
      expect(resultData.discordResponse).toBeNull();
    });
  });
});
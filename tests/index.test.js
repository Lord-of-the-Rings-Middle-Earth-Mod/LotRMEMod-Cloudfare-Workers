import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all the handler modules
vi.mock('../src/github.js', () => ({
  handleGitHubWebhook: vi.fn()
}));

vi.mock('../src/mails.js', () => ({
  handleMails: vi.fn()
}));

vi.mock('../src/rss.js', () => ({
  handleRSS: vi.fn()
}));

import { handleGitHubWebhook } from '../src/github.js';
import { handleMails } from '../src/mails.js';
import { handleRSS } from '../src/rss.js';

describe('Worker Integration Tests', () => {
  const mockEnv = {
    FABRIC_KV: {
      get: vi.fn(),
      put: vi.fn()
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default successful responses
    handleGitHubWebhook.mockResolvedValue(new Response('GitHub handled', { status: 200 }));
    handleMails.mockResolvedValue(new Response('Mail handled', { status: 200 }));
    handleRSS.mockResolvedValue(new Response('RSS handled', { status: 200 }));
  });

  describe('fetch handler', () => {
    it('should route GitHub webhooks to /github endpoint', async () => {
      const request = new Request('https://example.com/github', {
        method: 'POST',
        body: JSON.stringify({ action: 'opened', issue: { title: 'test' } }),
        headers: { 'Content-Type': 'application/json' }
      });

      // Test the worker directly 
      const worker = await import('../src/index.js');
      const response = await worker.default.fetch(request, mockEnv);

      expect(handleGitHubWebhook).toHaveBeenCalledWith(request, mockEnv);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('GitHub handled');
    });

    it('should route mail requests to /mails endpoint', async () => {
      const request = new Request('https://example.com/mails', {
        method: 'POST',
        body: JSON.stringify({
          headers: { subject: 'Test' },
          envelope: { from: 'test@example.com' },
          plain: 'Test content'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const worker = await import('../src/index.js');
      const response = await worker.default.fetch(request, mockEnv);

      expect(handleMails).toHaveBeenCalledWith(request, mockEnv);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('Mail handled');
    });

    it('should route RSS requests to /rss endpoint', async () => {
      const request = new Request('https://example.com/rss', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      });

      const worker = await import('../src/index.js');
      const response = await worker.default.fetch(request, mockEnv);

      expect(handleRSS).toHaveBeenCalledWith(request, mockEnv);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('RSS handled');
    });

    it('should reject non-POST requests to /mails', async () => {
      const request = new Request('https://example.com/mails', {
        method: 'GET'
      });

      const worker = await import("../src/index.js");
      const response = await worker.default.fetch(request, mockEnv);

      expect(handleMails).not.toHaveBeenCalled();
      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Not found');
    });

    it('should reject non-POST requests to /rss', async () => {
      const request = new Request('https://example.com/rss', {
        method: 'GET'
      });

      const worker = await import("../src/index.js");
      const response = await worker.default.fetch(request, mockEnv);

      expect(handleRSS).not.toHaveBeenCalled();
      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Not found');
    });

    it('should return 404 for unknown endpoints', async () => {
      const request = new Request('https://example.com/unknown', {
        method: 'POST'
      });

      const worker = await import("../src/index.js");
      const response = await worker.default.fetch(request, mockEnv);

      expect(handleGitHubWebhook).not.toHaveBeenCalled();
      expect(handleMails).not.toHaveBeenCalled();
      expect(handleRSS).not.toHaveBeenCalled();
      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Not found');
    });

    it('should handle root path requests', async () => {
      const request = new Request('https://example.com/', {
        method: 'GET'
      });

      const worker = await import("../src/index.js");
      const response = await worker.default.fetch(request, mockEnv);

      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Not found');
    });

    it('should handle requests with query parameters', async () => {
      const request = new Request('https://example.com/github?param=value', {
        method: 'POST',
        body: JSON.stringify({ action: 'opened' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const worker = await import("../src/index.js");
      const response = await worker.default.fetch(request, mockEnv);

      expect(handleGitHubWebhook).toHaveBeenCalledWith(request, mockEnv);
      expect(response.status).toBe(200);
    });

    it('should handle GitHub webhook with different HTTP methods', async () => {
      const getRequest = new Request('https://example.com/github', {
        method: 'GET'
      });

      const worker1 = await import('../src/index.js');
      const getResponse = await worker1.default.fetch(getRequest, mockEnv);
      expect(handleGitHubWebhook).toHaveBeenCalledWith(getRequest, mockEnv);

      const putRequest = new Request('https://example.com/github', {
        method: 'PUT',
        body: JSON.stringify({ data: 'test' })
      });

      const worker2 = await import('../src/index.js');
      const putResponse = await worker2.default.fetch(putRequest, mockEnv);
      expect(handleGitHubWebhook).toHaveBeenCalledWith(putRequest, mockEnv);
    });

    it('should propagate handler errors', async () => {
      handleGitHubWebhook.mockResolvedValue(new Response('Handler error', { status: 500 }));

      const request = new Request('https://example.com/github', {
        method: 'POST',
        body: JSON.stringify({ action: 'opened' })
      });

      const worker = await import("../src/index.js");
      const response = await worker.default.fetch(request, mockEnv);

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('Handler error');
    });

    it('should handle handler exceptions', async () => {
      handleMails.mockRejectedValue(new Error('Handler exception'));

      const request = new Request('https://example.com/mails', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' })
      });

      // Since we're not catching exceptions in the main handler,
      // the error should propagate
      const worker = await import('../src/index.js');
      await expect(worker.default.fetch(request, mockEnv)).rejects.toThrow('Handler exception');
    });

    it('should handle requests with different content types', async () => {
      const request = new Request('https://example.com/github', {
        method: 'POST',
        body: 'text body',
        headers: { 'Content-Type': 'text/plain' }
      });

      const worker = await import("../src/index.js");
      const response = await worker.default.fetch(request, mockEnv);

      expect(handleGitHubWebhook).toHaveBeenCalledWith(request, mockEnv);
      expect(response.status).toBe(200);
    });

    it('should handle requests without body', async () => {
      const request = new Request('https://example.com/github', {
        method: 'POST'
      });

      const worker = await import("../src/index.js");
      const response = await worker.default.fetch(request, mockEnv);

      expect(handleGitHubWebhook).toHaveBeenCalledWith(request, mockEnv);
      expect(response.status).toBe(200);
    });
  });

  describe('scheduled handler', () => {
    it('should call handleRSS for scheduled events', async () => {
      const mockEvent = {
        type: 'scheduled',
        scheduledTime: Date.now(),
        cron: '0 0 * * *'
      };

      const mockContext = {
        waitUntil: vi.fn()
      };

      // Import the worker to access the scheduled handler
      const worker = await import('../src/index.js');
      
      await worker.default.scheduled(mockEvent, mockEnv, mockContext);

      expect(mockContext.waitUntil).toHaveBeenCalled();
      expect(handleRSS).toHaveBeenCalledWith(null, mockEnv);
    });

    it('should handle RSS processing errors in scheduled events', async () => {
      handleRSS.mockResolvedValue(new Response('RSS error', { status: 500 }));

      const mockEvent = {
        type: 'scheduled',
        scheduledTime: Date.now(),
        cron: '0 0 * * *'
      };

      const mockContext = {
        waitUntil: vi.fn()
      };

      const worker = await import('../src/index.js');
      
      // Should not throw even if RSS handling fails
      await expect(worker.default.scheduled(mockEvent, mockEnv, mockContext)).resolves.toBeUndefined();
      expect(mockContext.waitUntil).toHaveBeenCalled();
    });

    it('should handle scheduled events with different cron expressions', async () => {
      const mockEvent = {
        type: 'scheduled',
        scheduledTime: Date.now(),
        cron: '0 12 * * *' // Different cron
      };

      const mockContext = {
        waitUntil: vi.fn()
      };

      const worker = await import('../src/index.js');
      
      await worker.default.scheduled(mockEvent, mockEnv, mockContext);

      expect(mockContext.waitUntil).toHaveBeenCalled();
      expect(handleRSS).toHaveBeenCalledWith(null, mockEnv);
    });
  });

  describe('Error handling', () => {
    it('should handle malformed URLs gracefully', async () => {
      // This test ensures the URL parsing doesn't throw
      const request = new Request('https://example.com//double//slash//github', {
        method: 'POST'
      });

      const worker = await import("../src/index.js");
      const response = await worker.default.fetch(request, mockEnv);

      // Should still handle this as a GitHub request since pathname normalization occurs
      expect(response.status).toBe(404); // Since pathname would be different
    });

    it('should handle requests with empty path', async () => {
      const request = new Request('https://example.com', {
        method: 'POST'
      });

      const worker = await import("../src/index.js");
      const response = await worker.default.fetch(request, mockEnv);

      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Not found');
    });

    it('should handle case-sensitive paths', async () => {
      const request = new Request('https://example.com/GITHUB', {
        method: 'POST'
      });

      const worker = await import("../src/index.js");
      const response = await worker.default.fetch(request, mockEnv);

      expect(handleGitHubWebhook).not.toHaveBeenCalled();
      expect(response.status).toBe(404);
    });
  });
});
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMails } from '../src/mails.js';

// Mock the dependencies
vi.mock('../src/discord.js', () => ({
  postToDiscord: vi.fn()
}));

vi.mock('../src/config.js', () => ({
  WEBHOOKS: {
    mails: 'https://discord.com/api/webhooks/123/mails'
  },
  PINGS: {
    fabricupdates: '<@&1371820347543916554>'
  },
  AVATAR_URL: 'https://gravatar.com/test.jpeg'
}));

import { postToDiscord } from '../src/discord.js';

describe('Mails Module', () => {
  const mockEnv = {};

  beforeEach(() => {
    vi.clearAllMocks();
    postToDiscord.mockResolvedValue({ status: 200 });
  });

  describe('handleMails', () => {
    it('should successfully process email with all fields', async () => {
      const emailData = {
        headers: {
          subject: 'Test Email Subject'
        },
        envelope: {
          from: 'test@example.com'
        },
        plain: 'This is the plain text content of the email.',
        html: '<p>This is the HTML content.</p>'
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(emailData)
      };

      const result = await handleMails(mockRequest, mockEnv);

      expect(mockRequest.json).toHaveBeenCalled();
      expect(postToDiscord).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/mails',
        expect.objectContaining({
          username: 'LotR ME Mail Bot',
          avatar_url: 'https://gravatar.com/test.jpeg',
          content: '📧 New E-Mail from *test@example.com*:\n# Test Email Subject\n\nThis is the plain text content of the email.',
          embeds: [],
          thread_name: 'Test Email Subject',
          applied_tags: ['1398967786860183724']
        })
      );
      expect(result).toEqual({ status: 200 });
    });

    it('should handle email with missing subject', async () => {
      const emailData = {
        envelope: {
          from: 'test@example.com'
        },
        plain: 'This is the plain text content.'
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(emailData)
      };

      const result = await handleMails(mockRequest, mockEnv);

      expect(postToDiscord).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/mails',
        expect.objectContaining({
          content: '📧 New E-Mail from *test@example.com*:\n# No Subject\n\nThis is the plain text content.',
          thread_name: 'No Subject'
        })
      );
      expect(result).toEqual({ status: 200 });
    });

    it('should handle email with missing sender', async () => {
      const emailData = {
        headers: {
          subject: 'Test Subject'
        },
        plain: 'This is the plain text content.'
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(emailData)
      };

      const result = await handleMails(mockRequest, mockEnv);

      expect(postToDiscord).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/mails',
        expect.objectContaining({
          content: '📧 New E-Mail from *Unknown sender*:\n# Test Subject\n\nThis is the plain text content.',
        })
      );
      expect(result).toEqual({ status: 200 });
    });

    it('should prefer plain text over HTML content', async () => {
      const emailData = {
        headers: {
          subject: 'Test Subject'
        },
        envelope: {
          from: 'test@example.com'
        },
        plain: 'Plain text content',
        html: '<p>HTML content</p>'
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(emailData)
      };

      const result = await handleMails(mockRequest, mockEnv);

      expect(postToDiscord).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/mails',
        expect.objectContaining({
          content: expect.stringContaining('Plain text content')
        })
      );
      expect(result).toEqual({ status: 200 });
    });

    it('should fall back to HTML content when plain text is not available', async () => {
      const emailData = {
        headers: {
          subject: 'Test Subject'
        },
        envelope: {
          from: 'test@example.com'
        },
        html: '<p>HTML content</p>'
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(emailData)
      };

      const result = await handleMails(mockRequest, mockEnv);

      expect(postToDiscord).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/mails',
        expect.objectContaining({
          content: expect.stringContaining('<p>HTML content</p>')
        })
      );
      expect(result).toEqual({ status: 200 });
    });

    it('should handle email with no content', async () => {
      const emailData = {
        headers: {
          subject: 'Test Subject'
        },
        envelope: {
          from: 'test@example.com'
        }
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(emailData)
      };

      const result = await handleMails(mockRequest, mockEnv);

      expect(postToDiscord).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/mails',
        expect.objectContaining({
          content: '📧 New E-Mail from *test@example.com*:\n# Test Subject\n\nNo content'
        })
      );
      expect(result).toEqual({ status: 200 });
    });

    it('should handle empty email data', async () => {
      const emailData = {};

      const mockRequest = {
        json: vi.fn().mockResolvedValue(emailData)
      };

      const result = await handleMails(mockRequest, mockEnv);

      expect(postToDiscord).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/mails',
        expect.objectContaining({
          content: '📧 New E-Mail from *Unknown sender*:\n# No Subject\n\nNo content',
          thread_name: 'No Subject'
        })
      );
      expect(result).toEqual({ status: 200 });
    });

    it('should handle nested properties gracefully', async () => {
      const emailData = {
        headers: null,
        envelope: null,
        plain: 'Some content'
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(emailData)
      };

      const result = await handleMails(mockRequest, mockEnv);

      expect(postToDiscord).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/mails',
        expect.objectContaining({
          content: '📧 New E-Mail from *Unknown sender*:\n# No Subject\n\nSome content'
        })
      );
      expect(result).toEqual({ status: 200 });
    });

    it('should handle JSON parsing errors', async () => {
      const mockRequest = {
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      };

      const result = await handleMails(mockRequest, mockEnv);

      expect(postToDiscord).not.toHaveBeenCalled();
      expect(result.status).toBe(500);
      expect(await result.text()).toBe('An error occured while forwarding to discord.');
    });

    it('should handle Discord posting errors', async () => {
      postToDiscord.mockRejectedValue(new Error('Discord error'));

      const emailData = {
        headers: { subject: 'Test' },
        envelope: { from: 'test@example.com' },
        plain: 'Content'
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(emailData)
      };

      await expect(handleMails(mockRequest, mockEnv)).rejects.toThrow('Discord error');
    });

    it('should handle complex email structure', async () => {
      const emailData = {
        headers: {
          subject: 'Complex Email',
          from: 'sender@domain.com',
          to: 'recipient@domain.com',
          date: '2023-01-01T10:00:00Z'
        },
        envelope: {
          from: 'envelope-sender@domain.com',
          to: ['recipient1@domain.com', 'recipient2@domain.com']
        },
        plain: 'This is a complex email with multiple recipients.',
        html: '<div><p>This is a complex email with <strong>multiple</strong> recipients.</p></div>',
        attachments: [
          { filename: 'document.pdf', contentType: 'application/pdf' }
        ]
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(emailData)
      };

      const result = await handleMails(mockRequest, mockEnv);

      expect(postToDiscord).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/mails',
        expect.objectContaining({
          content: '📧 New E-Mail from *envelope-sender@domain.com*:\n# Complex Email\n\nThis is a complex email with multiple recipients.',
          thread_name: 'Complex Email'
        })
      );
      expect(result).toEqual({ status: 200 });
    });

    it('should handle very long subject lines', async () => {
      const longSubject = 'A'.repeat(500);
      const emailData = {
        headers: {
          subject: longSubject
        },
        envelope: {
          from: 'test@example.com'
        },
        plain: 'Content'
      };

      const mockRequest = {
        json: vi.fn().mockResolvedValue(emailData)
      };

      const result = await handleMails(mockRequest, mockEnv);

      expect(postToDiscord).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/123/mails',
        expect.objectContaining({
          content: expect.stringContaining(`# ${longSubject}`),
          thread_name: longSubject
        })
      );
      expect(result).toEqual({ status: 200 });
    });
  });
});
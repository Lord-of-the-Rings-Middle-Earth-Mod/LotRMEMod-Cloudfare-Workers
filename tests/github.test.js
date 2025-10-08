import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleGitHubWebhook } from '../src/github.js';

// Mock the dependencies
vi.mock('../src/discord.js', () => ({
  postToDiscord: vi.fn()
}));

vi.mock('../src/config.js', () => ({
  WEBHOOKS: {
    news: 'https://discord.com/api/webhooks/123/news',
    changelog: 'https://discord.com/api/webhooks/123/changelog',
    suggestions: 'https://discord.com/api/webhooks/123/suggestions',
    issues: 'https://discord.com/api/webhooks/123/issues',
    prs: 'https://discord.com/api/webhooks/123/prs'
  },
  PINGS: {
    news: '<@&111>',
    monthly: '<@&222>',
    release: '<@&333>'
  },
  TAGS: {
    suggestions: '1283842398308532256'
  },
  AVATAR_URL: 'https://gravatar.com/test.jpeg',
  FOOTER_TEXT: 'This post originates from GitHub.'
}));

import { postToDiscord } from '../src/discord.js';

describe('GitHub Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postToDiscord.mockResolvedValue({ status: 200 });
  });

  describe('handleGitHubWebhook', () => {
    it('should ignore unsupported webhook payloads', async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          action: 'edited',
          repository: { name: 'test' }
        })
      };

      const result = await handleGitHubWebhook(mockRequest);

      expect(result.status).toBe(200);
      expect(await result.text()).toBe('Ignored');
      expect(postToDiscord).not.toHaveBeenCalled();
    });

    describe('Discussion handling', () => {
      const baseDiscussion = {
        title: 'Test Discussion',
        body: 'This is a test discussion',
        html_url: 'https://github.com/test/test/discussions/1',
        labels: [],
        category: { name: 'Announcements' }
      };

      it('should handle announcement discussions', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'created',
            discussion: baseDiscussion
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/news',
          expect.objectContaining({
            username: 'GitHub Announcements',
            embeds: expect.arrayContaining([
              expect.objectContaining({
                title: 'GitHub Announcement: Test Discussion',
                description: '<@&111> This is a test discussion'
              })
            ])
          })
        );
      });

      it('should handle announcement discussions with monthly updates label', async () => {
        const discussionWithLabel = {
          ...baseDiscussion,
          labels: [{ name: 'Monthly Updates' }]
        };

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'created',
            discussion: discussionWithLabel
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/news',
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                description: '<@&222> This is a test discussion'
              })
            ])
          })
        );
      });

      it('should handle suggestion discussions as threads', async () => {
        const suggestionDiscussion = {
          ...baseDiscussion,
          category: { name: 'Ideas and suggestions' }
        };

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'created',
            discussion: suggestionDiscussion
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/suggestions',
          expect.objectContaining({
            username: 'GitHub Suggestions',
            thread_name: 'GitHub Suggestion: Test Discussion',
            applied_tags: ['1283842398308532256']
          })
        );
      });

      it('should ignore non-created discussion actions', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'edited',
            discussion: baseDiscussion
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(await result.text()).toBe('Ignored');
        expect(postToDiscord).not.toHaveBeenCalled();
      });

      it('should ignore discussions from unsupported categories', async () => {
        const unsupportedDiscussion = {
          ...baseDiscussion,
          category: { name: 'General' }
        };

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'created',
            discussion: unsupportedDiscussion
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(await result.text()).toBe('Ignored');
        expect(postToDiscord).not.toHaveBeenCalled();
      });
    });

    describe('Release handling', () => {
      const baseRelease = {
        name: 'v1.0.0',
        body: 'Release notes here',
        html_url: 'https://github.com/test/test/releases/tag/v1.0.0'
      };

      it('should handle published releases', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'published',
            release: baseRelease
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(postToDiscord).toHaveBeenCalledTimes(2);
        
        // Check news message
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/news',
          expect.objectContaining({
            username: 'Releases',
            embeds: expect.arrayContaining([
              expect.objectContaining({
                title: 'v1.0.0',
                description: '<@&333> A new Release has dropped.'
              })
            ])
          })
        );

        // Check changelog message
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/changelog',
          expect.objectContaining({
            username: 'Changelog',
            embeds: expect.arrayContaining([
              expect.objectContaining({
                title: 'v1.0.0',
                description: 'Release notes here'
              })
            ])
          })
        );
      });

      it('should handle partial failure when one webhook fails', async () => {
        postToDiscord
          .mockResolvedValueOnce({ status: 200 })
          .mockResolvedValueOnce({ status: 500 });

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'published',
            release: baseRelease
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(500);
        expect(await result.text()).toBe('Partial failure');
      });
    });

    describe('Issue handling', () => {
      const baseIssue = {
        title: 'Test Issue',
        body: 'This is a test issue',
        html_url: 'https://github.com/test/test/issues/1',
        created_at: '2023-01-01T00:00:00Z',
        user: { login: 'testuser' },
        labels: [{ name: 'bug' }, { name: 'help wanted' }]
      };

      it('should handle opened issues', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'opened',
            issue: baseIssue
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/issues',
          expect.objectContaining({
            username: 'LotR ME Mod Issues',
            embeds: expect.arrayContaining([
              expect.objectContaining({
                title: 'Test Issue',
                description: 'This is a test issue',
                author: { name: 'testuser' },
                fields: expect.arrayContaining([
                  expect.objectContaining({
                    name: 'Labels',
                    value: 'bug, help wanted'
                  })
                ])
              })
            ])
          })
        );
      });

      it('should handle issues with no labels', async () => {
        const issueNoLabels = { ...baseIssue, labels: [] };
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'opened',
            issue: issueNoLabels
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/issues',
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                fields: expect.arrayContaining([
                  expect.objectContaining({
                    name: 'Labels',
                    value: 'None'
                  })
                ])
              })
            ])
          })
        );
      });

      it('should handle long titles and descriptions', async () => {
        const longIssue = {
          ...baseIssue,
          title: 'A'.repeat(300),
          body: 'B'.repeat(5000)
        };

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'opened',
            issue: longIssue
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/issues',
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                title: expect.stringMatching(/^A{253}\.\.\.$/),
                description: expect.stringMatching(/^B{4093}\.\.\.$/)
              })
            ])
          })
        );
      });

      it('should ignore invalid issue data', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'opened',
            issue: null
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(await result.text()).toBe('Ignored');
        expect(postToDiscord).not.toHaveBeenCalled();
      });
    });

    describe('Pull Request handling', () => {
      const basePR = {
        number: 123,
        title: 'Test PR',
        body: 'This is a test PR',
        html_url: 'https://github.com/test/test/pull/123',
        user: { login: 'testuser' },
        draft: false,
        head: { ref: 'feature-branch' },
        base: { ref: 'main' }
      };

      it('should handle opened non-draft PRs', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'opened',
            pull_request: basePR
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/prs',
          expect.objectContaining({
            username: 'LotR ME Mod PRs',
            embeds: expect.arrayContaining([
              expect.objectContaining({
                title: 'PR 123 opened: Test PR',
                description: expect.stringContaining('testuser** has opened a new pull request')
              })
            ])
          })
        );
      });

      it('should ignore draft PRs for opened action', async () => {
        const draftPR = { ...basePR, draft: true };
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'opened',
            pull_request: draftPR
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(await result.text()).toBe('Ignored - draft PR');
        expect(postToDiscord).not.toHaveBeenCalled();
      });

      it('should handle ready_for_review action', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'ready_for_review',
            pull_request: basePR
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/prs',
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                title: 'PR 123 ready for review: Test PR',
                description: expect.stringContaining('marked their pull request as ready for review')
              })
            ])
          })
        );
      });

      it('should handle review_requested action', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'review_requested',
            pull_request: basePR,
            requested_reviewer: { login: 'reviewer' }
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/prs',
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                title: 'PR 123 review requested: Test PR',
                description: expect.stringContaining('requested **reviewer** to review')
              })
            ])
          })
        );
      });

      it('should handle missing requested reviewer data', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'review_requested',
            pull_request: basePR,
            requested_reviewer: null
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/prs',
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                description: expect.stringContaining('requested **someone** to review')
              })
            ])
          })
        );
      });

      it('should handle unsupported PR actions', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'closed',
            pull_request: basePR
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(await result.text()).toBe('Ignored');
        expect(postToDiscord).not.toHaveBeenCalled();
      });

      it('should ignore invalid PR data', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'opened',
            pull_request: null
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(await result.text()).toBe('Ignored');
        expect(postToDiscord).not.toHaveBeenCalled();
      });
    });
  });
});
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
    prs: 'https://discord.com/api/webhooks/123/prs',
    wiki: 'https://discord.com/api/webhooks/123/wiki',
    workflows: 'https://discord.com/api/webhooks/123/workflows'
  },
  PINGS: {
    news: '<@&111>',
    monthly: '<@&222>',
    release: '<@&333>',
    maintainers: '<@&444>',
    contributors: '<@&555>'
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
      // PR from a branch within the same repo (contributor)
      const branchPR = {
        number: 123,
        title: 'Test PR',
        body: 'This is a test PR',
        html_url: 'https://github.com/test/test/pull/123',
        user: { login: 'testuser' },
        draft: false,
        head: { 
          ref: 'feature-branch',
          repo: { id: 456, fork: false }
        },
        base: { 
          ref: 'main',
          repo: { id: 456, fork: false }
        }
      };
      
      // PR from a fork (first-time contributor / maintainer review)
      const forkPR = {
        number: 124,
        title: 'Test Fork PR',
        body: 'This is a PR from a fork',
        html_url: 'https://github.com/test/test/pull/124',
        user: { login: 'forkuser' },
        draft: false,
        head: { 
          ref: 'feature-branch',
          repo: { id: 789, fork: true }
        },
        base: { 
          ref: 'main',
          repo: { id: 456, fork: false }
        }
      };

      it('should handle opened non-draft PRs from a branch with contributor ping', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'opened',
            pull_request: branchPR
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
                description: expect.stringContaining('<@&555>') // contributors ping
              })
            ])
          })
        );
      });

      it('should handle opened non-draft PRs from a fork with maintainer ping', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'opened',
            pull_request: forkPR
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
                title: 'PR 124 opened: Test Fork PR',
                description: expect.stringContaining('<@&444>') // maintainers ping
              })
            ])
          })
        );
      });

      it('should ignore draft PRs for opened action', async () => {
        const draftPR = { ...branchPR, draft: true };
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

      it('should handle ready_for_review action from branch', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'ready_for_review',
            pull_request: branchPR
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
                description: expect.stringContaining('<@&555>') // contributors ping
              })
            ])
          })
        );
      });

      it('should handle ready_for_review action from fork', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'ready_for_review',
            pull_request: forkPR
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/prs',
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                title: 'PR 124 ready for review: Test Fork PR',
                description: expect.stringContaining('<@&444>') // maintainers ping
              })
            ])
          })
        );
      });

      it('should handle review_requested action from branch', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'review_requested',
            pull_request: branchPR,
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
                description: expect.stringContaining('<@&555>') // contributors ping
              })
            ])
          })
        );
      });

      it('should handle review_requested action from fork', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'review_requested',
            pull_request: forkPR,
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
                title: 'PR 124 review requested: Test Fork PR',
                description: expect.stringContaining('<@&444>') // maintainers ping
              })
            ])
          })
        );
      });

      it('should handle missing requested reviewer data', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'review_requested',
            pull_request: branchPR,
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
            pull_request: branchPR
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

    describe('Wiki handling', () => {
      const baseSender = {
        login: 'wikiuser',
        id: 1
      };

      it('should handle wiki events with multiple page changes', async () => {
        const pages = [
          {
            page_name: 'Home',
            title: 'Home',
            action: 'edited',
            html_url: 'https://github.com/test/test/wiki/Home'
          },
          {
            page_name: 'Special',
            title: 'Special',
            action: 'deleted',
            html_url: 'https://github.com/test/test/wiki/Special'
          },
          {
            page_name: 'Special-2',
            title: 'Special 2',
            action: 'created',
            html_url: 'https://github.com/test/test/wiki/Special-2'
          }
        ];

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            pages: pages,
            sender: baseSender
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/wiki',
          expect.objectContaining({
            username: 'GitHub Wiki',
            embeds: expect.arrayContaining([
              expect.objectContaining({
                title: 'New Project-Wiki Changes',
                description: expect.stringContaining('wikiuser** has made the following changes to the Wiki:')
              })
            ])
          })
        );

        // Check that description includes all page changes
        const call = postToDiscord.mock.calls[0][1];
        const description = call.embeds[0].description;
        expect(description).toContain('Home has been edited');
        expect(description).toContain('Special has been deleted');
        expect(description).toContain('Special 2 has been created');
      });

      it('should include buttons for edited and created pages', async () => {
        const pages = [
          {
            page_name: 'Page1',
            title: 'Page 1',
            action: 'edited',
            html_url: 'https://github.com/test/test/wiki/Page1'
          },
          {
            page_name: 'Page2',
            title: 'Page 2',
            action: 'created',
            html_url: 'https://github.com/test/test/wiki/Page2'
          },
          {
            page_name: 'Page3',
            title: 'Page 3',
            action: 'deleted',
            html_url: 'https://github.com/test/test/wiki/Page3'
          }
        ];

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            pages: pages,
            sender: baseSender
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        
        const call = postToDiscord.mock.calls[0][1];
        const components = call.components[0].components;
        
        // Should have Home button plus 2 buttons for edited and created pages
        expect(components.length).toBe(3);
        expect(components[0].label).toBe('Home');
        expect(components[1].label).toBe('Page 1');
        expect(components[2].label).toBe('Page 2');
        
        // Deleted page should not have a button
        expect(components.find(c => c.label === 'Page 3')).toBeUndefined();
      });

      it('should handle single page wiki change', async () => {
        const pages = [
          {
            page_name: 'Documentation',
            title: 'Documentation',
            action: 'edited',
            html_url: 'https://github.com/test/test/wiki/Documentation'
          }
        ];

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            pages: pages,
            sender: baseSender
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/wiki',
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                description: expect.stringContaining('Documentation has been edited')
              })
            ])
          })
        );
      });

      it('should limit buttons to 5 maximum', async () => {
        const pages = Array.from({ length: 10 }, (_, i) => ({
          page_name: `Page${i}`,
          title: `Page ${i}`,
          action: 'edited',
          html_url: `https://github.com/test/test/wiki/Page${i}`
        }));

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            pages: pages,
            sender: baseSender
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        
        const call = postToDiscord.mock.calls[0][1];
        const components = call.components[0].components;
        
        // Should be limited to 5 buttons (Home + 4 page buttons)
        expect(components.length).toBe(5);
      });

      it('should truncate long page titles in buttons', async () => {
        const longTitle = 'A'.repeat(100);
        const pages = [
          {
            page_name: 'LongTitlePage',
            title: longTitle,
            action: 'created',
            html_url: 'https://github.com/test/test/wiki/LongTitlePage'
          }
        ];

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            pages: pages,
            sender: baseSender
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        
        const call = postToDiscord.mock.calls[0][1];
        const components = call.components[0].components;
        
        // Check that long title is truncated in button
        const pageButton = components.find(c => c.label.startsWith('A'));
        expect(pageButton.label.length).toBeLessThanOrEqual(80);
        expect(pageButton.label).toMatch(/\.\.\.$/);
      });

      it('should handle missing sender gracefully', async () => {
        const pages = [
          {
            page_name: 'Home',
            title: 'Home',
            action: 'edited',
            html_url: 'https://github.com/test/test/wiki/Home'
          }
        ];

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            pages: pages,
            sender: null
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        
        const call = postToDiscord.mock.calls[0][1];
        const description = call.embeds[0].description;
        expect(description).toContain('Unknown User');
      });

      it('should handle empty pages array', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            pages: [],
            sender: baseSender
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(400);
        expect(await result.text()).toBe('Invalid wiki data');
        expect(postToDiscord).not.toHaveBeenCalled();
      });

      it('should handle missing pages field gracefully', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            pages: null,
            sender: baseSender
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(await result.text()).toBe('Ignored');
        expect(postToDiscord).not.toHaveBeenCalled();
      });
    });

    describe('Fork handling', () => {
      const baseFork = {
        html_url: 'https://github.com/forker/test-fork',
        full_name: 'forker/test-fork',
        name: 'test-fork'
      };

      const baseRepository = {
        full_name: 'Lord-of-the-Rings-Middle-Earth-Mod/Lord-of-the-Rings-Middle-Earth-Mod',
        name: 'Lord-of-the-Rings-Middle-Earth-Mod'
      };

      const baseSender = {
        login: 'forker',
        id: 1
      };

      it('should handle fork events', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            forkee: baseFork,
            sender: baseSender,
            repository: baseRepository
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/issues',
          expect.objectContaining({
            username: 'LotR ME Mod GitHub',
            embeds: expect.arrayContaining([
              expect.objectContaining({
                author: { name: 'LotR ME Mod GitHub' },
                title: 'New Fork',
                description: '**forker** created a new fork for the **Lord-of-the-Rings-Middle-Earth-Mod/Lord-of-the-Rings-Middle-Earth-Mod**.'
              })
            ]),
            components: expect.arrayContaining([
              expect.objectContaining({
                type: 1,
                components: expect.arrayContaining([
                  expect.objectContaining({
                    type: 2,
                    style: 5,
                    label: 'Fork on GitHub',
                    url: 'https://github.com/forker/test-fork'
                  })
                ])
              })
            ])
          })
        );
      });

      it('should handle fork events with missing sender gracefully', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            forkee: baseFork,
            sender: null,
            repository: baseRepository
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        
        const call = postToDiscord.mock.calls[0][1];
        const description = call.embeds[0].description;
        expect(description).toContain('Unknown User');
      });

      it('should ignore invalid fork data', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            forkee: null,
            sender: baseSender,
            repository: baseRepository
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(await result.text()).toBe('Ignored');
        expect(postToDiscord).not.toHaveBeenCalled();
      });

      it('should ignore missing repository data', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            forkee: baseFork,
            sender: baseSender,
            repository: null
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(await result.text()).toBe('Ignored');
        expect(postToDiscord).not.toHaveBeenCalled();
      });

      it('should include footer text and timestamp', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            forkee: baseFork,
            sender: baseSender,
            repository: baseRepository
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        
        const call = postToDiscord.mock.calls[0][1];
        expect(call.embeds[0].footer.text).toBe('This post originates from GitHub.');
        expect(call.embeds[0].timestamp).toBeDefined();
      });

      it('should use AVATAR_URL from config', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            forkee: baseFork,
            sender: baseSender,
            repository: baseRepository
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        
        const call = postToDiscord.mock.calls[0][1];
        expect(call.avatar_url).toBe('https://gravatar.com/test.jpeg');
      });
    });

    describe('Workflow run handling', () => {
      const baseWorkflowRun = {
        name: 'Test Suite',
        status: 'completed',
        conclusion: 'success',
        html_url: 'https://github.com/test/test/actions/runs/123',
        updated_at: '2024-01-01T00:00:00Z',
        actor: {
          login: 'testuser'
        }
      };

      it('should handle successful workflow runs', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'completed',
            workflow_run: baseWorkflowRun
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/workflows',
          expect.objectContaining({
            username: 'GitHub Actions',
            embeds: expect.arrayContaining([
              expect.objectContaining({
                title: '✅ Test Suite ran successfully',
                description: expect.stringContaining('completed successfully'),
                color: 3066993,
                author: { name: 'testuser' }
              })
            ]),
            components: expect.arrayContaining([
              expect.objectContaining({
                type: 1,
                components: expect.arrayContaining([
                  expect.objectContaining({
                    type: 2,
                    style: 5,
                    label: 'View Workflow Run',
                    url: 'https://github.com/test/test/actions/runs/123'
                  })
                ])
              })
            ])
          })
        );
      });

      it('should handle failed workflow runs with maintainer ping', async () => {
        const failedWorkflowRun = {
          ...baseWorkflowRun,
          conclusion: 'failure'
        };

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'completed',
            workflow_run: failedWorkflowRun
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/workflows',
          expect.objectContaining({
            username: 'GitHub Actions',
            embeds: expect.arrayContaining([
              expect.objectContaining({
                title: '❌ Test Suite failed',
                description: expect.stringContaining('<@&444>'),
                description: expect.stringContaining('has failed'),
                color: 15158332
              })
            ])
          })
        );
      });

      it('should handle cancelled workflow runs', async () => {
        const cancelledWorkflowRun = {
          ...baseWorkflowRun,
          conclusion: 'cancelled'
        };

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'completed',
            workflow_run: cancelledWorkflowRun
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(postToDiscord).toHaveBeenCalledWith(
          'https://discord.com/api/webhooks/123/workflows',
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                title: '🚫 Test Suite was cancelled',
                color: 10197915
              })
            ])
          })
        );
      });

      it('should ignore skipped workflow runs', async () => {
        const skippedWorkflowRun = {
          ...baseWorkflowRun,
          conclusion: 'skipped'
        };

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'completed',
            workflow_run: skippedWorkflowRun
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(await result.text()).toBe('Ignored - workflow skipped');
        expect(postToDiscord).not.toHaveBeenCalled();
      });

      it('should ignore non-completed workflow runs', async () => {
        const inProgressWorkflowRun = {
          ...baseWorkflowRun,
          status: 'in_progress',
          conclusion: null
        };

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'completed',
            workflow_run: inProgressWorkflowRun
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(await result.text()).toBe('Ignored - workflow not completed');
        expect(postToDiscord).not.toHaveBeenCalled();
      });

      it('should handle workflow runs without actor', async () => {
        const workflowRunNoActor = {
          ...baseWorkflowRun,
          actor: undefined,
          triggering_actor: undefined
        };

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'completed',
            workflow_run: workflowRunNoActor
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        const call = postToDiscord.mock.calls[0][1];
        expect(call.embeds[0].author.name).toBe('Unknown User');
      });

      it('should ignore payload with null workflow run', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'completed',
            workflow_run: null
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        expect(await result.text()).toBe('Ignored');
        expect(postToDiscord).not.toHaveBeenCalled();
      });

      it('should include footer and timestamp', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'completed',
            workflow_run: baseWorkflowRun
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        
        const call = postToDiscord.mock.calls[0][1];
        expect(call.embeds[0].footer.text).toBe('This post originates from GitHub.');
        expect(call.embeds[0].timestamp).toBe('2024-01-01T00:00:00Z');
      });

      it('should use AVATAR_URL from config', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            action: 'completed',
            workflow_run: baseWorkflowRun
          })
        };

        const result = await handleGitHubWebhook(mockRequest);

        expect(result.status).toBe(200);
        
        const call = postToDiscord.mock.calls[0][1];
        expect(call.avatar_url).toBe('https://gravatar.com/test.jpeg');
      });
    });
  });
});
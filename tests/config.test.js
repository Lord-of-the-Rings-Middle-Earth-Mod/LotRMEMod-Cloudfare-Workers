import { describe, it, expect } from 'vitest';
import { WEBHOOKS, PINGS, TAGS, AVATAR_URL, FOOTER_TEXT, KV_NAMESPACE } from '../src/config.js';

describe('Config Module', () => {
  describe('WEBHOOKS', () => {
    it('should have all required webhook URLs', () => {
      expect(WEBHOOKS).toBeDefined();
      expect(WEBHOOKS.news).toBeDefined();
      expect(WEBHOOKS.changelog).toBeDefined();
      expect(WEBHOOKS.suggestions).toBeDefined();
      expect(WEBHOOKS.fabricblog).toBeDefined();
      expect(WEBHOOKS.mails).toBeDefined();
      expect(WEBHOOKS.issues).toBeDefined();
      expect(WEBHOOKS.prs).toBeDefined();
      expect(WEBHOOKS.workflows).toBeDefined();
      expect(WEBHOOKS.contributions).toBeDefined();
    });

    it('should have valid Discord webhook URLs', () => {
      Object.values(WEBHOOKS).forEach((webhook) => {
        expect(webhook).toMatch(/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/);
      });
    });

    it('should use same webhook for issues and PRs', () => {
      expect(WEBHOOKS.issues).toBe(WEBHOOKS.prs);
    });
  });

  describe('PINGS', () => {
    it('should have all required ping roles', () => {
      expect(PINGS).toBeDefined();
      expect(PINGS.news).toBeDefined();
      expect(PINGS.monthly).toBeDefined();
      expect(PINGS.release).toBeDefined();
      expect(PINGS.fabricupdates).toBeDefined();
    });

    it('should have valid Discord role ping format', () => {
      Object.values(PINGS).forEach((ping) => {
        expect(ping).toMatch(/^<@&\d+>$/);
      });
    });
  });

  describe('TAGS', () => {
    it('should have suggestions tag defined', () => {
      expect(TAGS).toBeDefined();
      expect(TAGS.suggestions).toBeDefined();
      expect(TAGS.suggestions).toMatch(/^\d+$/);
    });

    it('should have asset-related tags defined', () => {
      expect(TAGS.textureAndModel).toBeDefined();
      expect(TAGS.textureAndModel).toMatch(/^\d+$/);
      expect(TAGS.animations).toBeDefined();
      expect(TAGS.animations).toMatch(/^\d+$/);
      expect(TAGS.sounds).toBeDefined();
      expect(TAGS.sounds).toMatch(/^\d+$/);
    });
  });

  describe('AVATAR_URL', () => {
    it('should be a valid Gravatar URL', () => {
      expect(AVATAR_URL).toBeDefined();
      expect(AVATAR_URL).toMatch(/^https:\/\/gravatar\.com\/userimage\/\d+\/[\w]+\.jpeg\?size=\d+$/);
    });
  });

  describe('FOOTER_TEXT', () => {
    it('should have default footer text', () => {
      expect(FOOTER_TEXT).toBeDefined();
      expect(FOOTER_TEXT).toBe("This post originates from GitHub.");
    });
  });

  describe('KV_NAMESPACE', () => {
    it('should have KV namespace defined', () => {
      expect(KV_NAMESPACE).toBeDefined();
      expect(KV_NAMESPACE).toBe("FABRIC_KV");
    });
  });
});
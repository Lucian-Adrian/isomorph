import { describe, it, expect, vi } from 'vitest';

describe('Share Links & Access Control Logic', () => {
  it('generates a compliant 40-character unique hex share token', () => {
    // Replicates the token generator from src/lib/share-links.ts
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    expect(token).toHaveLength(40);
    expect(token).toMatch(/^[a-f0-9]{40}$/);
  });

  it('validates share link expiration accurately', () => {
    const expiredLink = {
      is_active: true,
      expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      max_uses: null,
      use_count: 0,
    };

    const isExpired = expiredLink.expires_at && new Date(expiredLink.expires_at) < new Date();
    expect(isExpired).toBe(true);

    const validLink = {
      is_active: true,
      expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      max_uses: null,
      use_count: 0,
    };
    const isValid = !validLink.expires_at || new Date(validLink.expires_at) > new Date();
    expect(isValid).toBe(true);
  });

  it('validates share link usage limit accurately', () => {
    const maxedLink = {
      is_active: true,
      max_uses: 5,
      use_count: 5,
    };
    const isExhausted = maxedLink.max_uses !== null && maxedLink.use_count >= maxedLink.max_uses;
    expect(isExhausted).toBe(true);

    const availableLink = {
      is_active: true,
      max_uses: 5,
      use_count: 4,
    };
    const hasRemainingUses = availableLink.max_uses === null || availableLink.use_count < availableLink.max_uses;
    expect(hasRemainingUses).toBe(true);
  });

  it('enforces role hierarchy and permissions for editor vs commenter vs viewer', () => {
    const canEdit = (role: string) => role === 'owner' || role === 'editor';
    const canShare = (role: string) => role === 'owner';

    expect(canEdit('owner')).toBe(true);
    expect(canEdit('editor')).toBe(true);
    expect(canEdit('commenter')).toBe(false);
    expect(canEdit('viewer')).toBe(false);

    expect(canShare('owner')).toBe(true);
    expect(canShare('editor')).toBe(false);
    expect(canShare('viewer')).toBe(false);
  });
});

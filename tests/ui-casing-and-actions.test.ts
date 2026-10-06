import { describe, it, expect } from 'vitest';
import { tText } from '../src/i18n.js';

describe('UI Casing & Actions Compliance', () => {
  it('enforces Sentence case for English UI labels', () => {
    // Assert key UI action labels follow Sentence case
    expect(tText('en', 'ui.shortcuts_title')).toBe('Keyboard shortcuts');
    expect(tText('en', 'share.share_project')).toBe('Share project');
    expect(tText('en', 'share.share_links')).toBe('Share links');
    expect(tText('en', 'share.direct_access')).toBe('Direct access');
    expect(tText('en', 'share.create_link')).toBe('Create link');
    expect(tText('en', 'ui.collab_settings')).toBe('Collaboration settings');
    expect(tText('en', 'ui.app_settings')).toBe('App settings');
    expect(tText('en', 'ui.reset_password')).toBe('Reset password');
    expect(tText('en', 'ui.profile_photo')).toBe('Profile photo');
    expect(tText('en', 'ui.enable_animations')).toBe('Enable animations');
    expect(tText('en', 'ui.export_speed')).toBe('Animation speed');
    expect(tText('en', 'diagram_type.class')).toBe('Class diagram');
    expect(tText('en', 'diagram_type.sequence')).toBe('Sequence diagram');
    expect(tText('en', 'ctx.add_note')).toBe('Add note');
    expect(tText('en', 'share.error_create_link')).toBe('Failed to create share link. Please verify project ownership.');
    expect(tText('en', 'share.no_share_links_active')).toBe('No active share links. Generate one above.');
    expect(tText('en', 'ui.save_to_cloud')).toBe('Save to cloud');
  });

  it('correctly interpolates dynamic variables into Sentence case templates', () => {
    const text = tText('en', 'status.error_many', { count: 3 });
    expect(text).toBe('3 errors');

    const createdMsg = tText('en', 'share.success_link_created', { role: 'editor' });
    expect(createdMsg).toBe('Share link for editor created successfully!');
  });

  it('determines appropriate collaborator initials for avatar badges', () => {
    const getInitials = (name: string) => {
      const clean = name.trim();
      if (!clean) return '?';
      const parts = clean.split(/\s+/);
      if (parts.length > 1) {
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
      }
      return clean.slice(0, 2).toUpperCase();
    };

    expect(getInitials('John Doe')).toBe('JD');
    expect(getInitials('Alice')).toBe('AL');
    expect(getInitials('   Bob  Smith   ')).toBe('BS');
    expect(getInitials('')).toBe('?');
  });
});

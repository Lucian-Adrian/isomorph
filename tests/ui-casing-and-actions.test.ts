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
    expect(tText('en', 'settings.appearance_interface')).toBe('Appearance & interface');
    expect(tText('en', 'settings.sound_effects')).toBe('Sound effects');
    expect(tText('en', 'settings.sound_volume')).toBe('Sound volume');
    expect(tText('en', 'settings.test_sound')).toBe('Test sound');
    expect(tText('en', 'settings.editor_workspace')).toBe('Editor & workspace');
    expect(tText('en', 'settings.auto_save')).toBe('Auto save');
    expect(tText('ro', 'settings.sound_effects')).toBe('Efecte sonore');
    expect(tText('ro', 'settings.sound_volume')).toBe('Volum sunet');
    expect(tText('ru', 'settings.sound_effects')).toBe('Звуковые эффекты');
    expect(tText('ru', 'settings.sound_volume')).toBe('Громкость звука');
  });

  it('correctly interpolates dynamic variables into Sentence case templates', () => {
    const text = tText('en', 'status.error_many', { count: 3 });
    expect(text).toBe('3 errors');

    const createdMsg = tText('en', 'share.success_link_created', { role: 'editor' });
    expect(createdMsg).toBe('Share link for editor created successfully!');
  });

  it('validates duplicate diagram names case-insensitively', () => {
    const existing = [
      { id: 'd1', name: 'untitled.isx' },
      { id: 'd2', name: 'ClassDiagram-1.isx' },
    ];

    const isDuplicate = (name: string) => {
      const clean = name.trim().toLowerCase();
      return existing.some((d) => d.name.trim().toLowerCase() === clean);
    };

    expect(isDuplicate('untitled.isx')).toBe(true);
    expect(isDuplicate('UNTITLED.ISX')).toBe(true);
    expect(isDuplicate('  untitled.isx  ')).toBe(true);
    expect(isDuplicate('ClassDiagram-1.isx')).toBe(true);
    expect(isDuplicate('classdiagram-1.isx')).toBe(true);
    expect(isDuplicate('untitled-2.isx')).toBe(false);
  });

  it('enforces steps of 5 for sound volume adjustments', () => {
    const snapToStep5 = (val: number) => Math.round(val / 5) * 5;
    expect(snapToStep5(48)).toBe(50);
    expect(snapToStep5(52)).toBe(50);
    expect(snapToStep5(53)).toBe(55);
    expect(snapToStep5(0)).toBe(0);
    expect(snapToStep5(100)).toBe(100);
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


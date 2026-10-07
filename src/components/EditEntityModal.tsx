import React from 'react';
import type { DiagramKind } from '../types/index.js';
import { entitySupportsStereotype } from '../utils/source-manipulation.js';

export interface EditEntityModalProps {
  editingEntity: {
    id: string;
    name: string;
    origName?: string;
    kind: string;
    stereotype?: string;
    isAbstract?: boolean;
    bodyText?: string;
    elseBlocks?: Array<{ label?: string }>;
  } | null;
  setEditingEntity: (entity: any) => void;
  handleEntityEdit: (
    origName: string,
    updates: {
      name: string;
      stereotype?: string;
      isAbstract?: boolean;
      bodyText?: string;
      kind: string;
      elseBlocks?: Array<{ label?: string }>;
    },
  ) => void;
  t: (key: string, options?: any) => string;
  isMobileLayout: boolean;
  activeDiagram: { kind: DiagramKind } | null;
}

export const EditEntityModal: React.FC<EditEntityModalProps> = ({
  editingEntity,
  setEditingEntity,
  handleEntityEdit,
  t,
  isMobileLayout,
  activeDiagram,
}) => {
  if (!editingEntity) return null;

  return (
    <div className="iso-modal-overlay" onClick={() => setEditingEntity(null)}>
      <div className="iso-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="iso-modal-title" style={{ marginBottom: '16px' }}>{t('edit.entity_title')}</h2>
        <div className="iso-modal-field">
          <label>{t('edit.name')}</label>
          <input
            type="text"
            value={editingEntity.name}
            onChange={(e) => setEditingEntity({ ...editingEntity, name: e.target.value })}
            onBlur={() => setEditingEntity({ ...editingEntity, name: editingEntity.name.trim() })}
            autoFocus={!isMobileLayout && editingEntity.kind !== 'note'}
          />
        </div>

        {editingEntity.kind === 'note' ? (
          <div className="iso-modal-field" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
              <span>{t('edit.body')} (Markdown)</span>
              <div style={{ display: 'flex', gap: '4px', userSelect: 'none' }}>
                <button
                  type="button"
                  className="iso-btn"
                  title="Bold (Ctrl+B)"
                  onMouseDown={(e) => e.preventDefault()}
                  style={{ padding: '2px 8px', fontWeight: 'bold' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const target = document.getElementById('note-body-textarea') as HTMLTextAreaElement;
                    if (!target) return;
                    const start = target.selectionStart;
                    const end = target.selectionEnd;
                    const val = target.value;
                    const prefix = '**';
                    const suffix = '**';
                    let newVal = val,
                      newStart = start,
                      newEnd = end;
                    if (
                      start >= prefix.length &&
                      end <= val.length - suffix.length &&
                      val.substring(start - prefix.length, start) === prefix &&
                      val.substring(end, end + suffix.length) === suffix
                    ) {
                      newVal =
                        val.substring(0, start - prefix.length) +
                        val.substring(start, end) +
                        val.substring(end + suffix.length);
                      newStart = start - prefix.length;
                      newEnd = end - prefix.length;
                    } else {
                      newVal =
                        val.substring(0, start) + prefix + val.substring(start, end) + suffix + val.substring(end);
                      newStart = start + prefix.length;
                      newEnd = end + prefix.length;
                    }
                    setEditingEntity({ ...editingEntity, bodyText: newVal });
                    setTimeout(() => {
                      target.focus();
                      target.setSelectionRange(newStart, newEnd);
                    }, 0);
                  }}
                >
                  B
                </button>
                <button
                  type="button"
                  className="iso-btn"
                  title="Italic (Ctrl+I)"
                  onMouseDown={(e) => e.preventDefault()}
                  style={{ padding: '2px 8px', fontStyle: 'italic' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const target = document.getElementById('note-body-textarea') as HTMLTextAreaElement;
                    if (!target) return;
                    const start = target.selectionStart;
                    const end = target.selectionEnd;
                    const val = target.value;
                    const prefix = '*';
                    const suffix = '*';
                    let newVal = val,
                      newStart = start,
                      newEnd = end;
                    if (
                      start >= prefix.length &&
                      end <= val.length - suffix.length &&
                      val.substring(start - prefix.length, start) === prefix &&
                      val.substring(end, end + suffix.length) === suffix
                    ) {
                      newVal =
                        val.substring(0, start - prefix.length) +
                        val.substring(start, end) +
                        val.substring(end + suffix.length);
                      newStart = start - prefix.length;
                      newEnd = end - prefix.length;
                    } else {
                      newVal =
                        val.substring(0, start) + prefix + val.substring(start, end) + suffix + val.substring(end);
                      newStart = start + prefix.length;
                      newEnd = end + prefix.length;
                    }
                    setEditingEntity({ ...editingEntity, bodyText: newVal });
                    setTimeout(() => {
                      target.focus();
                      target.setSelectionRange(newStart, newEnd);
                    }, 0);
                  }}
                >
                  I
                </button>
                <button
                  type="button"
                  className="iso-btn"
                  title="Underline (Ctrl+U)"
                  onMouseDown={(e) => e.preventDefault()}
                  style={{ padding: '2px 8px', textDecoration: 'underline' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const target = document.getElementById('note-body-textarea') as HTMLTextAreaElement;
                    if (!target) return;
                    const start = target.selectionStart;
                    const end = target.selectionEnd;
                    const val = target.value;
                    const prefix = '__';
                    const suffix = '__';
                    let newVal = val,
                      newStart = start,
                      newEnd = end;
                    if (
                      start >= prefix.length &&
                      end <= val.length - suffix.length &&
                      val.substring(start - prefix.length, start) === prefix &&
                      val.substring(end, end + suffix.length) === suffix
                    ) {
                      newVal =
                        val.substring(0, start - prefix.length) +
                        val.substring(start, end) +
                        val.substring(end + suffix.length);
                      newStart = start - prefix.length;
                      newEnd = end - prefix.length;
                    } else {
                      newVal =
                        val.substring(0, start) + prefix + val.substring(start, end) + suffix + val.substring(end);
                      newStart = start + prefix.length;
                      newEnd = end + prefix.length;
                    }
                    setEditingEntity({ ...editingEntity, bodyText: newVal });
                    setTimeout(() => {
                      target.focus();
                      target.setSelectionRange(newStart, newEnd);
                    }, 0);
                  }}
                >
                  U
                </button>
                <button
                  type="button"
                  className="iso-btn"
                  title="Strikethrough"
                  onMouseDown={(e) => e.preventDefault()}
                  style={{ padding: '2px 8px', textDecoration: 'line-through' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const target = document.getElementById('note-body-textarea') as HTMLTextAreaElement;
                    if (!target) return;
                    const start = target.selectionStart;
                    const end = target.selectionEnd;
                    const val = target.value;
                    const prefix = '~~';
                    const suffix = '~~';
                    let newVal = val,
                      newStart = start,
                      newEnd = end;
                    if (
                      start >= prefix.length &&
                      end <= val.length - suffix.length &&
                      val.substring(start - prefix.length, start) === prefix &&
                      val.substring(end, end + suffix.length) === suffix
                    ) {
                      newVal =
                        val.substring(0, start - prefix.length) +
                        val.substring(start, end) +
                        val.substring(end + suffix.length);
                      newStart = start - prefix.length;
                      newEnd = end - prefix.length;
                    } else {
                      newVal =
                        val.substring(0, start) + prefix + val.substring(start, end) + suffix + val.substring(end);
                      newStart = start + prefix.length;
                      newEnd = end + prefix.length;
                    }
                    setEditingEntity({ ...editingEntity, bodyText: newVal });
                    setTimeout(() => {
                      target.focus();
                      target.setSelectionRange(newStart, newEnd);
                    }, 0);
                  }}
                >
                  S
                </button>
              </div>
            </label>
            <textarea
              id="note-body-textarea"
              value={editingEntity.bodyText ?? ''}
              onChange={(e) => setEditingEntity({ ...editingEntity, bodyText: e.target.value })}
              onKeyDown={(e) => {
                if (e.ctrlKey && !e.shiftKey) {
                  const target = e.target as HTMLTextAreaElement;
                  const start = target.selectionStart;
                  const end = target.selectionEnd;
                  const val = target.value;

                  const toggleFormat = (prefix: string, suffix: string) => {
                    let newVal = val,
                      newStart = start,
                      newEnd = end;
                    if (
                      start >= prefix.length &&
                      end <= val.length - suffix.length &&
                      val.substring(start - prefix.length, start) === prefix &&
                      val.substring(end, end + suffix.length) === suffix
                    ) {
                      newVal =
                        val.substring(0, start - prefix.length) +
                        val.substring(start, end) +
                        val.substring(end + suffix.length);
                      newStart = start - prefix.length;
                      newEnd = end - prefix.length;
                    } else {
                      newVal =
                        val.substring(0, start) + prefix + val.substring(start, end) + suffix + val.substring(end);
                      newStart = start + prefix.length;
                      newEnd = end + prefix.length;
                    }
                    setEditingEntity({ ...editingEntity, bodyText: newVal });
                    setTimeout(() => {
                      target.focus();
                      target.setSelectionRange(newStart, newEnd);
                    }, 0);
                  };

                  if (e.key === 'b') {
                    e.preventDefault();
                    toggleFormat('**', '**');
                  } else if (e.key === 'i') {
                    e.preventDefault();
                    toggleFormat('*', '*');
                  } else if (e.key === 'u') {
                    e.preventDefault();
                    toggleFormat('__', '__');
                  }
                }
              }}
              style={{
                width: '100%',
                minHeight: '200px',
                fontFamily: 'monospace',
                padding: '0.5rem',
                resize: 'vertical',
              }}
              autoFocus={!isMobileLayout}
            />
          </div>
        ) : (
          <>
            <div className="iso-modal-field">
              <label>{t('edit.kind')}</label>
              <span style={{ padding: '0.4rem', border: '1px solid transparent' }}>{editingEntity.kind}</span>
            </div>
            {entitySupportsStereotype(editingEntity.kind) && (
              <div className="iso-modal-field">
                <label>
                  {['alt', 'loop', 'opt', 'par', 'break', 'critical'].includes(editingEntity.kind)
                    ? 'Caption'
                    : t('edit.stereotype')}
                </label>
                <input
                  type="text"
                  value={editingEntity.stereotype}
                  onChange={(e) => setEditingEntity({ ...editingEntity, stereotype: e.target.value })}
                  onBlur={() => setEditingEntity({ ...editingEntity, stereotype: editingEntity.stereotype ? editingEntity.stereotype.trim() : '' })}
                  placeholder={
                    ['alt', 'loop', 'opt', 'par', 'break', 'critical'].includes(editingEntity.kind)
                      ? 'e.g. cond'
                      : t('edit.eg_device')
                  }
                />
              </div>
            )}
            {['alt', 'par'].includes(editingEntity.kind) && (
              <div
                className="iso-modal-field"
                style={{ flexDirection: 'column', alignItems: 'flex-start', paddingTop: '0.5rem' }}
              >
                <label style={{ marginBottom: '0.5rem' }}>Substates (Else Branches)</label>
                {(editingEntity.elseBlocks || []).map((b, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', width: '100%', marginBottom: '0.5rem' }}>
                    <input
                      type="text"
                      value={b.label || ''}
                      onChange={(e) => {
                        const newBlocks = [...(editingEntity.elseBlocks || [])];
                        newBlocks[i] = { ...newBlocks[i], label: e.target.value };
                        setEditingEntity({ ...editingEntity, elseBlocks: newBlocks });
                      }}
                      onBlur={() => {
                        const newBlocks = [...(editingEntity.elseBlocks || [])];
                        newBlocks[i] = { ...newBlocks[i], label: (b.label || '').trim() };
                        setEditingEntity({ ...editingEntity, elseBlocks: newBlocks });
                      }}
                      placeholder="Caption"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="iso-btn"
                      title="Remove Substate"
                      onClick={() => {
                        const newBlocks = (editingEntity.elseBlocks || []).filter((_, idx) => idx !== i);
                        setEditingEntity({ ...editingEntity, elseBlocks: newBlocks });
                      }}
                    >
                      -
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="iso-btn"
                  onClick={() => {
                    const newBlocks = [...(editingEntity.elseBlocks || []), { label: '' }];
                    setEditingEntity({ ...editingEntity, elseBlocks: newBlocks });
                  }}
                  style={{ width: '100%', marginTop: '0.2rem' }}
                >
                  + Add Substate
                </button>
              </div>
            )}
            {['class', 'interface'].includes(editingEntity.kind) && (
              <div className="iso-modal-field">
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={editingEntity.isAbstract}
                    onChange={(e) => setEditingEntity({ ...editingEntity, isAbstract: e.target.checked })}
                    style={{ margin: 0 }}
                  />
                  {t('edit.abstract')}
                </label>
              </div>
            )}
            {editingEntity.kind === 'interface' && ['component', 'deployment'].includes(activeDiagram?.kind || '') && (
              <div className="iso-modal-field">
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={editingEntity.stereotype === 'lollipop'}
                    onChange={(e) =>
                      setEditingEntity({ ...editingEntity, stereotype: e.target.checked ? 'lollipop' : '' })
                    }
                    style={{ margin: 0 }}
                  />
                  {t('edit.lollipop')}
                </label>
              </div>
            )}
            {[
              'class',
              'interface',
              'enum',
              'struct',
              'component',
              'node',
              'device',
              'environment',
              'state',
              'activity',
              'usecase',
              'actor',
              'multiobject',
              'active_object',
              'collaboration',
              'composite',
              'concurrent',
              'artifact',
            ].includes(editingEntity.kind) && (
              <div className="iso-modal-field" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                  <label>{t('edit.body')}</label>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {['enum'].includes(editingEntity.kind) && (
                      <button
                        type="button"
                        className="iso-btn"
                        style={{ fontSize: 10, padding: '2px 6px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEntity((prev: any) =>
                            prev
                              ? { ...prev, bodyText: (prev.bodyText ? prev.bodyText + '\n' : '') + 'NEW_VALUE' }
                              : null,
                          );
                        }}
                      >
                        {t('edit.enum_value')}
                      </button>
                    )}
                    {['usecase'].includes(editingEntity.kind) && (
                      <button
                        type="button"
                        className="iso-btn"
                        style={{ fontSize: 10, padding: '2px 6px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEntity((prev: any) =>
                            prev
                              ? { ...prev, bodyText: (prev.bodyText ? prev.bodyText + '\n' : '') + 'extensionPoint' }
                              : null,
                          );
                        }}
                      >
                        {t('edit.ext_pt')}
                      </button>
                    )}
                    {['class', 'interface'].includes(editingEntity.kind) && (
                      <>
                        <button
                          type="button"
                          className="iso-btn"
                          style={{ fontSize: 10, padding: '2px 6px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEntity((prev: any) =>
                              prev
                                ? {
                                    ...prev,
                                    bodyText: (prev.bodyText ? prev.bodyText + '\n' : '') + '+ newField : string',
                                  }
                                : null,
                            );
                          }}
                        >
                          {t('edit.pub_field')}
                        </button>
                        <button
                          type="button"
                          className="iso-btn"
                          style={{ fontSize: 10, padding: '2px 6px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEntity((prev: any) =>
                              prev
                                ? {
                                    ...prev,
                                    bodyText: (prev.bodyText ? prev.bodyText + '\n' : '') + '- newField : string',
                                  }
                                : null,
                            );
                          }}
                        >
                          {t('edit.priv_field')}
                        </button>
                        <button
                          type="button"
                          className="iso-btn"
                          style={{ fontSize: 10, padding: '2px 6px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEntity((prev: any) =>
                              prev
                                ? {
                                    ...prev,
                                    bodyText: (prev.bodyText ? prev.bodyText + '\n' : '') + '+ newMethod() : void',
                                  }
                                : null,
                            );
                          }}
                        >
                          {t('edit.pub_method')}
                        </button>
                      </>
                    )}
                    {['node', 'device', 'environment', 'component'].includes(editingEntity.kind) && (
                      <>
                        {activeDiagram?.kind !== 'component' && (
                          <>
                            <button
                              type="button"
                              className="iso-btn"
                              style={{ fontSize: 10, padding: '2px 6px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingEntity((prev: any) =>
                                  prev
                                    ? {
                                        ...prev,
                                        bodyText: (prev.bodyText ? prev.bodyText + '\n' : '') + 'node NewNode',
                                      }
                                    : null,
                                );
                              }}
                            >
                              {t('edit.node')}
                            </button>
                            <button
                              type="button"
                              className="iso-btn"
                              style={{ fontSize: 10, padding: '2px 6px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingEntity((prev: any) =>
                                  prev
                                    ? {
                                        ...prev,
                                        bodyText: (prev.bodyText ? prev.bodyText + '\n' : '') + 'artifact NewArtifact',
                                      }
                                    : null,
                                );
                              }}
                            >
                              {t('edit.artifact')}
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="iso-btn"
                          style={{ fontSize: 10, padding: '2px 6px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEntity((prev: any) =>
                              prev
                                ? {
                                    ...prev,
                                    bodyText: (prev.bodyText ? prev.bodyText + '\n' : '') + '+ port1 : provided',
                                  }
                                : null,
                            );
                          }}
                        >
                          {t('edit.port_prov')}
                        </button>
                        <button
                          type="button"
                          className="iso-btn"
                          style={{ fontSize: 10, padding: '2px 6px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEntity((prev: any) =>
                              prev
                                ? {
                                    ...prev,
                                    bodyText: (prev.bodyText ? prev.bodyText + '\n' : '') + '+ port2 : required',
                                  }
                                : null,
                            );
                          }}
                        >
                          {t('edit.port_req')}
                        </button>
                      </>
                    )}
                    {['state', 'composite', 'concurrent'].includes(editingEntity.kind) && (
                      <>
                        <button
                          type="button"
                          className="iso-btn"
                          style={{ fontSize: 10, padding: '2px 6px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEntity((prev: any) =>
                              prev
                                ? { ...prev, bodyText: (prev.bodyText ? prev.bodyText + '\n' : '') + 'entry() : void' }
                                : null,
                            );
                          }}
                        >
                          {t('edit.entry')}
                        </button>
                        <button
                          type="button"
                          className="iso-btn"
                          style={{ fontSize: 10, padding: '2px 6px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEntity((prev: any) =>
                              prev
                                ? { ...prev, bodyText: (prev.bodyText ? prev.bodyText + '\n' : '') + 'exit() : void' }
                                : null,
                            );
                          }}
                        >
                          {t('edit.exit')}
                        </button>
                        <button
                          type="button"
                          className="iso-btn"
                          style={{ fontSize: 10, padding: '2px 6px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEntity((prev: any) =>
                              prev
                                ? { ...prev, bodyText: (prev.bodyText ? prev.bodyText + '\n' : '') + 'do() : void' }
                                : null,
                            );
                          }}
                        >
                          {t('edit.do')}
                        </button>
                        <button
                          type="button"
                          className="iso-btn"
                          style={{ fontSize: 10, padding: '2px 6px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEntity((prev: any) =>
                              prev
                                ? { ...prev, bodyText: (prev.bodyText ? prev.bodyText + '\n' : '') + 'state SubState' }
                                : null,
                            );
                          }}
                        >
                          {t('edit.substate')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <textarea
                  value={editingEntity.bodyText ?? ''}
                  onChange={(e) => setEditingEntity({ ...editingEntity, bodyText: e.target.value })}
                  style={{
                    width: '100%',
                    minHeight: '120px',
                    fontFamily: 'monospace',
                    padding: '0.5rem',
                    resize: 'vertical',
                  }}
                />
              </div>
            )}
          </>
        )}
        <div className="iso-modal-actions">
          <button
            type="button"
            className="iso-btn"
            onClick={(e) => {
              e.stopPropagation();
              setEditingEntity(null);
            }}
          >
            {t('ui.cancel')}
          </button>
          <button
            type="button"
            className="iso-btn iso-btn--primary"
            onClick={(e) => {
              e.stopPropagation();
              const isNameOnlyBoundary =
                editingEntity.kind === 'partition' ||
                editingEntity.kind === 'system' ||
                editingEntity.kind === 'boundary';
              handleEntityEdit(editingEntity.origName || editingEntity.id, {
                name: editingEntity.name.trim(),
                stereotype: isNameOnlyBoundary ? undefined : (editingEntity.stereotype ? editingEntity.stereotype.trim() : undefined),
                isAbstract: editingEntity.isAbstract,
                bodyText: editingEntity.bodyText,
                kind: editingEntity.kind,
                elseBlocks: editingEntity.elseBlocks?.map((b) => ({ ...b, label: b.label ? b.label.trim() : '' })),
              });
            }}
          >
            {t('menu.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

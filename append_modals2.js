const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
const replacement = \<ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        {/* Modals */}
        {isNewModalOpen && (
          <div className=\\\
iso-modal-overlay\\\ onClick={() => setIsNewModalOpen(false)}>
            <div className=\\\iso-modal\\\ onClick={e => e.stopPropagation()}>
              <h2 className=\\\iso-modal-title\\\>Create New Diagram</h2>
              <p className=\\\iso-modal-desc\\\>Select the type of diagram you'd like to create.</p>
              <select className=\\\iso-modal-select\\\ value={newDiagramKind} onChange={e => setNewDiagramKind(e.target.value)}>
                {DIAGRAM_KINDS.filter(k => k !== 'all').map(k => (
                  <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)} Diagram</option>
                ))}
              </select>
              <div className=\\\iso-modal-actions\\\>
                <button className=\\\iso-modal-btn
cancel\\\ onClick={() => setIsNewModalOpen(false)}>Cancel</button>
                <button className=\\\iso-modal-btn
confirm\\\ onClick={() => executeNewDiagram(newDiagramKind)}>Create</button>
              </div>
            </div>
          </div>
        )}

        {tabToClose ; (
          <div className=\\\iso-modal-overlay\\\ onClick={() => setTabToClose(null)}>
            <div className=\\\iso-modal\\\ onClick={e => e.stopPropagation()}>
              <h2 className=\\\iso-modal-title\\\>Close Diagram?</h2>
              <p className=\\\iso-modal-desc\\\>Are you sure you want to close ;&quot;{tabs.find(t => t.id === tabToClose)?.name}&quot;? Unsaved changes may be lost.</p>
              <div className=\\\iso-modal-actions\\\>
                <button className=\\\iso-modal-btn
cancel\\\ onClick={() => setTabToClose(null)}>Cancel</button>
                <button className=\\\iso-modal-btn
danger\\\ onClick={() => {
                  setTabs(prev => {
                    const next = prev.filter(t => t.id !== tabToClose);
                    if (activeTabId === tabToClose) setActiveTabId(next[Math.max(0, next.length - 1)]?.id ?? '');
                    return next;
                  });
                  setTabToClose(null);
                }}>Close</button>
              </div>
            </div>
          </div>
        )}\;
code = code.replace(/<ShortcutsOverlay open=\{shortcutsOpen\} onClose=\{[(][)] => setShortcutsOpen[(]false[)][)\} \/>/, replacement);
fs.writeFileSync('src/App.tsx', code);

const fs = require('fs');

let html = fs.readFileSync('isomorph/website/index.html', 'utf8');

// The elements we want to translate:
const replacements = [
  // Heading Titles with data-i18n
  { search: '<h2 class="section-heading">The only invariant<br><em>that matters</em></h2>',
    replace: '<h2 class="section-heading" data-i18n="The only invariant that matters">The only invariant<br><em>that matters</em></h2>' },
  { search: '<h2 class="section-heading">One file for code,<br><em>layout, and round-trip edits</em></h2>',
    replace: '<h2 class="section-heading" data-i18n="One file for code, layout, and round-trip edits">One file for code,<br><em>layout, and round-trip edits</em></h2>' },
  { search: '<h2 class="section-heading">Handcrafted recursive descent.<br><em>No ANTLR, no Chevrotain.</em></h2>',
    replace: '<h2 class="section-heading" data-i18n="Handcrafted recursive descent. No ANTLR, no Chevrotain.">Handcrafted recursive descent.<br><em>No ANTLR, no Chevrotain.</em></h2>' },
  { search: '<h2 class="section-heading">Errors are values,<br><em>not surprises</em></h2>',
    replace: '<h2 class="section-heading" data-i18n="Errors are values, not surprises">Errors are values,<br><em>not surprises</em></h2>' },
  { search: '<h2 class="section-heading">A complete IDE,<br><em>deployed today</em></h2>',
    replace: '<h2 class="section-heading" data-i18n="A complete IDE, deployed today">A complete IDE,<br><em>deployed today</em></h2>' },


  // And the descriptions!
  // Desc 1: Multi-tab workspace...
  { search: '<p class="feature-body">Multi-tab workspace with syntax highlighting, keyboard shortcuts, and a built-in example gallery for real architecture work.</p>',
    replace: '<p class="feature-body" data-i18n="desc.multitab">Multi-tab workspace with syntax highlighting, keyboard shortcuts, and a built-in example gallery for real architecture work.</p>' },
  { search: '<p class="feature-body">Move any entity on the SVG canvas. Only its @Entity annotation changes. Every other byte in the file stays untouched.</p>',
    replace: '<p class="feature-body" data-i18n="desc.move">Move any entity on the SVG canvas. Only its @Entity annotation changes. Every other byte in the file stays untouched.</p>' },
  { search: '<p class="feature-body">SS-1 through SS-14 fire on every keystroke. Structured errors with rule ID and source location, never silent failure.</p>',
    replace: '<p class="feature-body" data-i18n="desc.ss1">SS-1 through SS-14 fire on every keystroke. Structured errors with rule ID and source location, never silent failure.</p>' },
  { search: '<p class="feature-body">Class, use-case, sequence, component, deployment, state, activity, collaboration, and flow — all producing SVG from one model.</p>',
    replace: '<p class="feature-body" data-i18n="desc.classusecase">Class, use-case, sequence, component, deployment, state, activity, collaboration, and flow — all producing SVG from one model.</p>' },
  { search: '<p class="feature-body">Entities without @annotations are automatically placed using the Eclipse Layout Kernel, stable across re-parses.</p>',
    replace: '<p class="feature-body" data-i18n="desc.elk">Entities without @annotations are automatically placed using the Eclipse Layout Kernel, stable across re-parses.</p>' },
  { search: '<p class="feature-body">One file stores the model and the layout. Visual edits remain deterministic text edits instead of hidden binary state.</p>',
    replace: '<p class="feature-body" data-i18n="desc.onefile">One file stores the model and the layout. Visual edits remain deterministic text edits instead of hidden binary state.</p>' },
    
  // Screen 2
  { search: '14 named static semantic rules validated at compile time, before any rendering occurs. Every violation carries a rule identifier, entity name, and exact source location — not a blank canvas.',
    replace: '<span data-i18n="desc.14rules">14 named static semantic rules validated at compile time, before any rendering occurs. Every violation carries a rule identifier, entity name, and exact source location — not a blank canvas.</span>' },

  // Screen 3
  { search: 'We chose a custom parser and analyzer stack so grammar control, source-mapped errors, round-trip serialization, and invariant preservation all remain under our control. The renderer and editor were built around that same architecture, not bolted on later.',
    replace: '<span data-i18n="desc.customparser">We chose a custom parser and analyzer stack so grammar control, source-mapped errors, round-trip serialization, and invariant preservation all remain under our control. The renderer and editor were built around that same architecture, not bolted on later.</span>' },
  { search: 'Recursive-descent parsing gave us exact control over the language, deterministic edits, and compiler-style diagnostics. That matters when the same source file must drive both text editing and visual geometry.',
    replace: '<span data-i18n="desc.recdescent">Recursive-descent parsing gave us exact control over the language, deterministic edits, and compiler-style diagnostics. That matters when the same source file must drive both text editing and visual geometry.</span>' },

  // Screen 4
  { search: 'An `.isx` file stores semantic structure and exact screen coordinates together. Dragging the canvas only rewrites the layout annotations, so visual editing stays deterministic and reviewable in version control.',
    replace: '<span data-i18n="desc.isxfile">An `.isx` file stores semantic structure and exact screen coordinates together. Dragging the canvas only rewrites the layout annotations, so visual editing stays deterministic and reviewable in version control.</span>' },

  // Screen 5
  { search: 'Longest-match-first scanning. Whitespace and comments discarded. 271 lines, zero dependencies.', 
    replace: '<span data-i18n="desc.lexertoks">Longest-match-first scanning. Whitespace and comments discarded. 271 lines, zero dependencies.</span>'},
  { search: '55 production rules. 22-node typed AST. Errors returned as values, never thrown. 541 lines.',
    replace: '<span data-i18n="desc.parserules">55 production rules. 22-node typed AST. Errors returned as values, never thrown. 541 lines.</span>'},
  { search: 'Two-pass analysis. Symbol table built first, constraints evaluated second. Catches cyclic inheritance, referential integrity, enum safety.',
    replace: '<span data-i18n="desc.analyzerrules">Two-pass analysis. Symbol table built first, constraints evaluated second. Catches cyclic inheritance, referential integrity, enum safety.</span>'},
  { search: '@Entity at (x,y) coordinates applied from source. ELK fallback for unplaced entities.',
    replace: '<span data-i18n="desc.svgrenderers">@Entity at (x,y) coordinates applied from source. ELK fallback for unplaced entities.</span>'},

  // Screen 6
  { search: 'Class, component, deployment, package, and module views describe what exists and how systems are organized. These are first-class constructs in the grammar, not ad-hoc templates.',
    replace: '<span data-i18n="desc.structviews">Class, component, deployment, package, and module views describe what exists and how systems are organized. These are first-class constructs in the grammar, not ad-hoc templates.</span>' },
  { search: 'Sequence, state, activity, collaboration, and flow diagrams capture what the system does over time. Structure and behavior live in one language and one canonical model.',
    replace: '<span data-i18n="desc.behavviews">Sequence, state, activity, collaboration, and flow diagrams capture what the system does over time. Structure and behavior live in one language and one canonical model.</span>' }
];

for (const r of replacements) {
    if (r.replace) {
        html = html.replace(r.search, r.replace);
    }
}
fs.writeFileSync('isomorph/website/index.html', html, 'utf8');

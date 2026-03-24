const fs = require('fs');

let html = fs.readFileSync('isomorph/website/index.html', 'utf8');

const itemsToTag = [
  // Titles
  { search: 'Diagrams that<br>\n      <em>remember themselves</em>', text: 'Diagrams that remember themselves' },
  { search: 'One tool makes you<br>\n      <em>choose a side</em>', text: 'One tool makes you choose a side' },
  { search: 'Reads like English.<br>\n      <em>Compiles like a type system.</em>', text: 'Reads like English. Compiles like a type system.' },

  // Paragraphs
  { search: '<p class="hero-sub" data-reveal data-reveal-delay="2">\n      A domain-specific language where layout is source data.\n      Edit text or drag the canvas — the model stays canonical.\n    </p>',
    replace: '<p class="hero-sub" data-reveal data-reveal-delay="2" data-i18n="hero.sub">\n      A domain-specific language where layout is source data.\n      Edit text or drag the canvas — the model stays canonical.\n    </p>' },
    
  { search: '<p class="section-body">\n        Textual tools like PlantUML give you Git diffs and version control, but any edit can scramble your carefully arranged diagram. Visual editors give you stable layouts, but their binary formats are unreadable in pull requests. No tool has ever satisfied both at once — until now.\n      </p>',
    replace: '<p class="section-body" data-i18n="desc.plantuml">\n        Textual tools like PlantUML give you Git diffs and version control, but any edit can scramble your carefully arranged diagram. Visual editors give you stable layouts, but their binary formats are unreadable in pull requests. No tool has ever satisfied both at once — until now.\n      </p>' },

  { search: '<p class="section-body">\n        Every entity keyword is a first-class UML citizen. Visibility modifiers, generics, stereotypes, inheritance — all native syntax. Layout annotations live inline with the semantic body, not in a sidecar file.\n      </p>',
    replace: '<p class="section-body" data-i18n="desc.entitykw">\n        Every entity keyword is a first-class UML citizen. Visibility modifiers, generics, stereotypes, inheritance — all native syntax. Layout annotations live inline with the semantic body, not in a sidecar file.\n      </p>' },
    
  // Diagram tags
  { search: '<div class="diagram-tag">class</div>', replace: '<div class="diagram-tag" data-i18n="diagram.class">class</div>' },
  { search: '<div class="diagram-tag">usecase</div>', replace: '<div class="diagram-tag" data-i18n="diagram.usecase">usecase</div>' },
  { search: '<div class="diagram-tag">sequence</div>', replace: '<div class="diagram-tag" data-i18n="diagram.sequence">sequence</div>' },
  { search: '<div class="diagram-tag">component</div>', replace: '<div class="diagram-tag" data-i18n="diagram.component">component</div>' },
  { search: '<div class="diagram-tag">deployment</div>', replace: '<div class="diagram-tag" data-i18n="diagram.deployment">deployment</div>' },
  { search: '<div class="diagram-tag">state</div>', replace: '<div class="diagram-tag" data-i18n="diagram.state">state</div>' },
  { search: '<div class="diagram-tag">activity</div>', replace: '<div class="diagram-tag" data-i18n="diagram.activity">activity</div>' },
  { search: '<div class="diagram-tag">collaboration</div>', replace: '<div class="diagram-tag" data-i18n="diagram.collaboration">collaboration</div>' },
  { search: '<div class="diagram-tag">flow</div>', replace: '<div class="diagram-tag" data-i18n="diagram.flow">flow</div>' },

  // Table items
  { search: '<td>Association</td>', replace: '<td data-i18n="rel.association">Association</td>' },
  { search: '<td>Generalization</td>', replace: '<td data-i18n="rel.generalization">Generalization</td>' },
  { search: '<td>Realization</td>', replace: '<td data-i18n="rel.realization">Realization</td>' },
  { search: '<td>Composition</td>', replace: '<td data-i18n="rel.composition">Composition</td>' },
  { search: '<td>Aggregation</td>', replace: '<td data-i18n="rel.aggregation">Aggregation</td>' },
  { search: '<td>Dependency</td>', replace: '<td data-i18n="rel.dependency">Dependency</td>' },
  { search: '<p class="operators-title">Relation operators</p>', replace: '<p class="operators-title" data-i18n="Relation operators">Relation operators</p>' },

  // Stats text
  { search: '<p class="stat-value">66 tokens</p>', replace: '<p class="stat-value" data-i18n="66 tokens">66 tokens</p>' },
  { search: '<p class="stat-step">02 &middot; Parse</p>', replace: '<p class="stat-step" data-i18n="02 · Parse">02 &middot; Parse</p>' },
  { search: '<p class="stat-value">LL(1) hand-written</p>', replace: '<p class="stat-value" data-i18n="LL(1) hand-written">LL(1) hand-written</p>' },
  { search: '<p class="stat-step">03 &middot; Analyse</p>', replace: '<p class="stat-step" data-i18n="03 · Analyse">03 &middot; Analyse</p>' },
  { search: '<p class="stat-value">14 static rules</p>', replace: '<p class="stat-value" data-i18n="14 static rules">14 static rules</p>' },
  { search: '<p class="stat-step">04 &middot; Render</p>', replace: '<p class="stat-step" data-i18n="04 · Render">04 &middot; Render</p>' },
  { search: '<p class="stat-value">9 SVG renderers</p>', replace: '<p class="stat-value" data-i18n="9 SVG renderers">9 SVG renderers</p>' },

  // Subtitles
  { search: '<h3 class="feature-title">CodeMirror 6 IDE</h3>', replace: '<h3 class="feature-title" data-i18n="CodeMirror 6 IDE">CodeMirror 6 IDE</h3>' },
  { search: '<h3 class="feature-title">Drag-and-drop canvas</h3>', replace: '<h3 class="feature-title" data-i18n="Drag-and-drop canvas">Drag-and-drop canvas</h3>' },
  { search: '<h3 class="feature-title">Real-time validation</h3>', replace: '<h3 class="feature-title" data-i18n="Real-time validation">Real-time validation</h3>' },
  { search: '<h3 class="feature-title">9 diagram renderers</h3>', replace: '<h3 class="feature-title" data-i18n="9 diagram renderers">9 diagram renderers</h3>' },
  { search: '<h3 class="feature-title">ELK auto-layout</h3>', replace: '<h3 class="feature-title" data-i18n="ELK auto-layout">ELK auto-layout</h3>' },
  { search: '<h3 class="feature-title">Canonical `.isx` source</h3>', replace: '<h3 class="feature-title" data-i18n="Canonical `.isx` source">Canonical `.isx` source</h3>' },
  
  // Section eyebrows
  { search: '<p class="section-eyebrow">The problem</p>', replace: '<p class="section-eyebrow" data-i18n="The problem">The problem</p>' },
  { search: '<p class="section-eyebrow">The language</p>', replace: '<p class="section-eyebrow" data-i18n="The language">The language</p>' },
  { search: '<p class="section-eyebrow">Structural breadth</p>', replace: '<p class="section-eyebrow" data-i18n="Structural breadth">Structural breadth</p>' },
  { search: '<p class="section-eyebrow">Behavioral breadth</p>', replace: '<p class="section-eyebrow" data-i18n="Behavioral breadth">Behavioral breadth</p>' },
  { search: '<p class="section-eyebrow">Bidirectional architecture</p>', replace: '<p class="section-eyebrow" data-i18n="Bidirectional architecture">Bidirectional architecture</p>' },
  { search: '<p class="section-eyebrow">ISX file</p>', replace: '<p class="section-eyebrow" data-i18n="ISX file">ISX file</p>' },
  { search: '<p class="section-eyebrow">Core tech stack</p>', replace: '<p class="section-eyebrow" data-i18n="Core tech stack">Core tech stack</p>' },
  { search: '<p class="section-eyebrow">Why custom</p>', replace: '<p class="section-eyebrow" data-i18n="Why custom">Why custom</p>' },
  { search: '<p class="section-eyebrow">Semantic safety</p>', replace: '<p class="section-eyebrow" data-i18n="Semantic safety">Semantic safety</p>' },
  { search: '<p class="section-eyebrow">What\'s shipped</p>', replace: '<p class="section-eyebrow" data-i18n="What\'s shipped">What\'s shipped</p>' },

  // List of rules under "Errors are values"
  { search: 'SS-1 Entity name uniqueness within diagram scope', replace: '<span data-i18n="SS-1 Entity name uniqueness within diagram scope">SS-1 Entity name uniqueness within diagram scope</span>' },
  { search: 'SS-2 Member name uniqueness within each entity', replace: '<span data-i18n="SS-2 Member name uniqueness within each entity">SS-2 Member name uniqueness within each entity</span>' },
  { search: 'SS-3 Referential integrity of relation endpoints', replace: '<span data-i18n="SS-3 Referential integrity of relation endpoints">SS-3 Referential integrity of relation endpoints</span>' },
  { search: 'SS-4 Enum non-emptiness — at least one value required', replace: '<span data-i18n="SS-4 Enum non-emptiness — at least one value required">SS-4 Enum non-emptiness — at least one value required</span>' },
  { search: 'SS-5 Interface fields carry no default values', replace: '<span data-i18n="SS-5 Interface fields carry no default values">SS-5 Interface fields carry no default values</span>' },
  { search: 'SS-6 Acyclic direct inheritance — no A extends B extends A', replace: '<span data-i18n="SS-6 Acyclic direct inheritance — no A extends B extends A">SS-6 Acyclic direct inheritance — no A extends B extends A</span>' },
  { search: 'SS-7 Style target references a declared entity', replace: '<span data-i18n="SS-7 Style target references a declared entity">SS-7 Style target references a declared entity</span>' },
  { search: 'SS-8 Enum value uniqueness within each enum body', replace: '<span data-i18n="SS-8 Enum value uniqueness within each enum body">SS-8 Enum value uniqueness within each enum body</span>' },
  { search: 'SS-9 Diagram kind compatibility — entity type matches context', replace: '<span data-i18n="SS-9 Diagram kind compatibility — entity type matches context">SS-9 Diagram kind compatibility — entity type matches context</span>' },
  { search: 'SS-10 Layout annotation references a declared entity', replace: '<span data-i18n="SS-10 Layout annotation references a declared entity">SS-10 Layout annotation references a declared entity</span>' },
  { search: 'SS-11 Abstract and final are mutually exclusive modifiers', replace: '<span data-i18n="SS-11 Abstract and final are mutually exclusive modifiers">SS-11 Abstract and final are mutually exclusive modifiers</span>' },
  { search: 'SS-12 Method parameter name uniqueness per signature', replace: '<span data-i18n="SS-12 Method parameter name uniqueness per signature">SS-12 Method parameter name uniqueness per signature</span>' },
  { search: 'SS-13 Extends target must reference a declared entity', replace: '<span data-i18n="SS-13 Extends target must reference a declared entity">SS-13 Extends target must reference a declared entity</span>' },
  { search: 'SS-14 Implements target must reference a declared entity', replace: '<span data-i18n="SS-14 Implements target must reference a declared entity">SS-14 Implements target must reference a declared entity</span>' },
];

for (const item of itemsToTag) {
    if (item.replace) {
        html = html.replace(item.search, item.replace);
    } else if (item.text) {
        // Tag headers securely using DOM parsing conceptually or regex for specific matches.
        // It's easier if I just find the element that wraps it, e.g. <h2 class="section-heading">Diagrams that<br>...</h2>
        const escapeRegex = (string) => string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const pattern = new RegExp("<(h[1-6])([^>]*)>\\s*" + escapeRegex(item.search) + "\\s*</\\1>", "gi");
        html = html.replace(pattern, '<$1$2 data-i18n="' + item.text + '">' + item.search + '</$1>');
    }
}
fs.writeFileSync('isomorph/website/index.html', html, 'utf8');

const fs = require('fs');
let html = fs.readFileSync('isomorph/website/index.html', 'utf8');

const mapping = [
    {
        find: /<p class="hero-sub"[^>]*>[\s\S]*?canonical\.[\s\S]*?<\/p>/m,
        replace: '<p class="hero-sub" data-reveal data-reveal-delay="2" data-i18n="hero.sub">\n      A domain-specific language where layout is source data.\n      Edit text or drag the canvas — the model stays canonical.\n    </p>'
    },
    {
        find: /<p class="section-body">\s*Textual tools like PlantUML[\s\S]*?until now\.\s*<\/p>/m,
        replace: '<p class="section-body" data-i18n="desc.plantuml">\n        Textual tools like PlantUML give you Git diffs and version control, but any edit can scramble your carefully arranged diagram. Visual editors give you stable layouts, but their binary formats are unreadable in pull requests. No tool has ever satisfied both at once — until now.\n      </p>'
    },
    {
        find: /<p class="section-body">\s*Every entity keyword is a first-class UML citizen[\s\S]*?sidecar file\.\s*<\/p>/m,
        replace: '<p class="section-body" data-i18n="desc.entitykw">\n        Every entity keyword is a first-class UML citizen. Visibility modifiers, generics, stereotypes, inheritance — all native syntax. Layout annotations live inline with the semantic body, not in a sidecar file.\n      </p>'
    },
    { find: /<div class="diagram-tag">class<\/div>/g, replace: '<div class="diagram-tag" data-i18n="diagram.class">class</div>' },
    { find: /<div class="diagram-tag">usecase<\/div>/g, replace: '<div class="diagram-tag" data-i18n="diagram.usecase">usecase</div>' },
    { find: /<div class="diagram-tag">sequence<\/div>/g, replace: '<div class="diagram-tag" data-i18n="diagram.sequence">sequence</div>' },
    { find: /<div class="diagram-tag">component<\/div>/g, replace: '<div class="diagram-tag" data-i18n="diagram.component">component</div>' },
    { find: /<div class="diagram-tag">deployment<\/div>/g, replace: '<div class="diagram-tag" data-i18n="diagram.deployment">deployment</div>' },
    { find: /<div class="diagram-tag">state<\/div>/g, replace: '<div class="diagram-tag" data-i18n="diagram.state">state</div>' },
    { find: /<div class="diagram-tag">activity<\/div>/g, replace: '<div class="diagram-tag" data-i18n="diagram.activity">activity</div>' },
    { find: /<div class="diagram-tag">collaboration<\/div>/g, replace: '<div class="diagram-tag" data-i18n="diagram.collaboration">collaboration</div>' },
    { find: /<div class="diagram-tag">flow<\/div>/g, replace: '<div class="diagram-tag" data-i18n="diagram.flow">flow</div>' },

    { find: /<td>Association<\/td>/g, replace: '<td data-i18n="rel.association">Association</td>' },
    { find: /<td>Generalizare<\/td>|<td>Generalization<\/td>/g, replace: '<td data-i18n="rel.generalization">Generalization</td>' },
    { find: /<td>Realization<\/td>/g, replace: '<td data-i18n="rel.realization">Realization</td>' },
    { find: /<td>Composition<\/td>/g, replace: '<td data-i18n="rel.composition">Composition</td>' },
    { find: /<td>Aggregation<\/td>/g, replace: '<td data-i18n="rel.aggregation">Aggregation</td>' },
    { find: /<td>Dependency<\/td>/g, replace: '<td data-i18n="rel.dependency">Dependency</td>' },
    { find: /<p class="operators-title">Relation operators<\/p>/g, replace: '<p class="operators-title" data-i18n="Relation operators">Relation operators</p>' },
    
    { find: /<p class="section-eyebrow">The problem<\/p>/g, replace: '<p class="section-eyebrow" data-i18n="The problem">The problem</p>' },
    { find: /<p class="section-eyebrow">The language<\/p>/g, replace: '<p class="section-eyebrow" data-i18n="The language">The language</p>' },
    { find: /<p class="section-eyebrow">Structural breadth<\/p>/g, replace: '<p class="section-eyebrow" data-i18n="Structural breadth">Structural breadth</p>' },
    { find: /<p class="section-eyebrow">Behavioral breadth<\/p>/g, replace: '<p class="section-eyebrow" data-i18n="Behavioral breadth">Behavioral breadth</p>' },
    { find: /<p class="section-eyebrow">Bidirectional architecture<\/p>/g, replace: '<p class="section-eyebrow" data-i18n="Bidirectional architecture">Bidirectional architecture</p>' },
    { find: /<p class="section-eyebrow">ISX file<\/p>/g, replace: '<p class="section-eyebrow" data-i18n="ISX file">ISX file</p>' },
    { find: /<p class="section-eyebrow">Core tech stack<\/p>/g, replace: '<p class="section-eyebrow" data-i18n="Core tech stack">Core tech stack</p>' },
    { find: /<p class="section-eyebrow">Why custom<\/p>/g, replace: '<p class="section-eyebrow" data-i18n="Why custom">Why custom</p>' },
    { find: /<p class="section-eyebrow">Semantic safety<\/p>/g, replace: '<p class="section-eyebrow" data-i18n="Semantic safety">Semantic safety</p>' },
    { find: /<p class="section-eyebrow">What's shipped<\/p>/g, replace: '<p class="section-eyebrow" data-i18n="What\'s shipped">What\'s shipped</p>' },

    { find: /<p class="stat-value">66 tokens<\/p>/g, replace: '<p class="stat-value" data-i18n="66 tokens">66 tokens</p>' },
    { find: /<p class="stat-step">02 &middot; Parse<\/p>|<p class="stat-step">02 · Parse<\/p>/g, replace: '<p class="stat-step" data-i18n="02 · Parse">02 &middot; Parse</p>' },
    { find: /<p class="stat-value">LL\(1\) hand-written<\/p>/g, replace: '<p class="stat-value" data-i18n="LL(1) hand-written">LL(1) hand-written</p>' },
    { find: /<p class="stat-step">03 &middot; Analyse<\/p>|<p class="stat-step">03 · Analyse<\/p>/g, replace: '<p class="stat-step" data-i18n="03 · Analyse">03 &middot; Analyse</p>' },
    { find: /<p class="stat-value">14 static rules<\/p>/g, replace: '<p class="stat-value" data-i18n="14 static rules">14 static rules</p>' },
    { find: /<p class="stat-step">04 &middot; Render<\/p>|<p class="stat-step">04 · Render<\/p>/g, replace: '<p class="stat-step" data-i18n="04 · Render">04 &middot; Render</p>' },
    { find: /<p class="stat-value">9 SVG renderers<\/p>/g, replace: '<p class="stat-value" data-i18n="9 SVG renderers">9 SVG renderers</p>' },

    { find: /<h3 class="feature-title">CodeMirror 6 IDE<\/h3>/g, replace: '<h3 class="feature-title" data-i18n="CodeMirror 6 IDE">CodeMirror 6 IDE</h3>' },
    { find: /<h3 class="feature-title">Drag-and-drop canvas<\/h3>/g, replace: '<h3 class="feature-title" data-i18n="Drag-and-drop canvas">Drag-and-drop canvas</h3>' },
    { find: /<h3 class="feature-title">Real-time validation<\/h3>/g, replace: '<h3 class="feature-title" data-i18n="Real-time validation">Real-time validation</h3>' },
    { find: /<h3 class="feature-title">9 diagram renderers<\/h3>/g, replace: '<h3 class="feature-title" data-i18n="9 diagram renderers">9 diagram renderers</h3>' },
    { find: /<h3 class="feature-title">ELK auto-layout<\/h3>/g, replace: '<h3 class="feature-title" data-i18n="ELK auto-layout">ELK auto-layout</h3>' },
    { find: /<h3 class="feature-title">Canonical `\.isx` source<\/h3>/g, replace: '<h3 class="feature-title" data-i18n="Canonical `.isx` source">Canonical `.isx` source</h3>' },

    { find: /SS-1 Entity name uniqueness within diagram scope/g, replace: '<span data-i18n="SS-1 Entity name uniqueness within diagram scope">SS-1 Entity name uniqueness within diagram scope</span>' },
    { find: /SS-2 Member name uniqueness within each entity/g, replace: '<span data-i18n="SS-2 Member name uniqueness within each entity">SS-2 Member name uniqueness within each entity</span>' },
    { find: /SS-3 Referential integrity of relation endpoints/g, replace: '<span data-i18n="SS-3 Referential integrity of relation endpoints">SS-3 Referential integrity of relation endpoints</span>' },
    { find: /SS-4 Enum non-emptiness — at least one value required/g, replace: '<span data-i18n="SS-4 Enum non-emptiness — at least one value required">SS-4 Enum non-emptiness — at least one value required</span>' },
    { find: /SS-5 Interface fields carry no default values/g, replace: '<span data-i18n="SS-5 Interface fields carry no default values">SS-5 Interface fields carry no default values</span>' },
    { find: /SS-6 Acyclic direct inheritance — no A extends B extends A/g, replace: '<span data-i18n="SS-6 Acyclic direct inheritance — no A extends B extends A">SS-6 Acyclic direct inheritance — no A extends B extends A</span>' },
    { find: /SS-7 Style target references a declared entity/g, replace: '<span data-i18n="SS-7 Style target references a declared entity">SS-7 Style target references a declared entity</span>' },
    { find: /SS-8 Enum value uniqueness within each enum body/g, replace: '<span data-i18n="SS-8 Enum value uniqueness within each enum body">SS-8 Enum value uniqueness within each enum body</span>' },
    { find: /SS-9 Diagram kind compatibility — entity type matches context/g, replace: '<span data-i18n="SS-9 Diagram kind compatibility — entity type matches context">SS-9 Diagram kind compatibility — entity type matches context</span>' },
    { find: /SS-10 Layout annotation references a declared entity/g, replace: '<span data-i18n="SS-10 Layout annotation references a declared entity">SS-10 Layout annotation references a declared entity</span>' },
    { find: /SS-11 Abstract and final are mutually exclusive modifiers/g, replace: '<span data-i18n="SS-11 Abstract and final are mutually exclusive modifiers">SS-11 Abstract and final are mutually exclusive modifiers</span>' },
    { find: /SS-12 Method parameter name uniqueness per signature/g, replace: '<span data-i18n="SS-12 Method parameter name uniqueness per signature">SS-12 Method parameter name uniqueness per signature</span>' },
    { find: /SS-13 Extends target must reference a declared entity/g, replace: '<span data-i18n="SS-13 Extends target must reference a declared entity">SS-13 Extends target must reference a declared entity</span>' },
    { find: /SS-14 Implements target must reference a declared entity/g, replace: '<span data-i18n="SS-14 Implements target must reference a declared entity">SS-14 Implements target must reference a declared entity</span>' }

];

for (const m of mapping) {
    html = html.replace(m.find, m.replace);
}

fs.writeFileSync('isomorph/website/index.html', html, 'utf8');

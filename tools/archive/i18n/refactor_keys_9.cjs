const fs = require('fs');
let html = fs.readFileSync('isomorph/website/index.html', 'utf8');

// Replace these EXACT texts inside html that didn't get caught by regex
html = html.replace('<div class="diagram-tag">class</div>', '<div class="diagram-tag" data-i18n="diagram.class">class</div>');
html = html.replace('<div class="diagram-tag">usecase</div>', '<div class="diagram-tag" data-i18n="diagram.usecase">usecase</div>');
html = html.replace('<div class="diagram-tag">sequence</div>', '<div class="diagram-tag" data-i18n="diagram.sequence">sequence</div>');
html = html.replace('<div class="diagram-tag">component</div>', '<div class="diagram-tag" data-i18n="diagram.component">component</div>');
html = html.replace('<div class="diagram-tag">deployment</div>', '<div class="diagram-tag" data-i18n="diagram.deployment">deployment</div>');
html = html.replace('<div class="diagram-tag">state</div>', '<div class="diagram-tag" data-i18n="diagram.state">state</div>');
html = html.replace('<div class="diagram-tag">activity</div>', '<div class="diagram-tag" data-i18n="diagram.activity">activity</div>');
html = html.replace('<div class="diagram-tag">collaboration</div>', '<div class="diagram-tag" data-i18n="diagram.collaboration">collaboration</div>');
html = html.replace('<div class="diagram-tag">flow</div>', '<div class="diagram-tag" data-i18n="diagram.flow">flow</div>');

html = html.replace('<td>Association</td>', '<td data-i18n="rel.association">Association</td>');
html = html.replace('<td>Generalizare</td>', '<td data-i18n="rel.generalization">Generalization</td>');
html = html.replace('<td>Generalization</td>', '<td data-i18n="rel.generalization">Generalization</td>');
html = html.replace('<td>Realization</td>', '<td data-i18n="rel.realization">Realization</td>');
html = html.replace('<td>Composition</td>', '<td data-i18n="rel.composition">Composition</td>');
html = html.replace('<td>Aggregation</td>', '<td data-i18n="rel.aggregation">Aggregation</td>');
html = html.replace('<td>Dependency</td>', '<td data-i18n="rel.dependency">Dependency</td>');

fs.writeFileSync('isomorph/website/index.html', html, 'utf8');

const fs = require('fs');
let html = fs.readFileSync('isomorph/website/index.html', 'utf8');

// Replace these EXACT texts inside html that didn't get caught by regex
html = html.replace('<span class="pill">class</span>', '<span class="pill" data-i18n="diagram.class">class</span>');
html = html.replace('<span class="pill">usecase</span>', '<span class="pill" data-i18n="diagram.usecase">usecase</span>');
html = html.replace('<span class="pill">sequence</span>', '<span class="pill" data-i18n="diagram.sequence">sequence</span>');
html = html.replace('<span class="pill">component</span>', '<span class="pill" data-i18n="diagram.component">component</span>');
html = html.replace('<span class="pill">deployment</span>', '<span class="pill" data-i18n="diagram.deployment">deployment</span>');
html = html.replace('<span class="pill">state</span>', '<span class="pill" data-i18n="diagram.state">state</span>');
html = html.replace('<span class="pill">activity</span>', '<span class="pill" data-i18n="diagram.activity">activity</span>');
html = html.replace('<span class="pill">collaboration</span>', '<span class="pill" data-i18n="diagram.collaboration">collaboration</span>');
html = html.replace('<span class="pill">flow</span>', '<span class="pill" data-i18n="diagram.flow">flow</span>');

fs.writeFileSync('isomorph/website/index.html', html, 'utf8');

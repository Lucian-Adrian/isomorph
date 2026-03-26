const fs = require('fs');

const mappings = {
  'Language': 'ui.language',
  'Toggle theme': 'ui.toggle_theme',
  'Dark mode': 'ui.dark_mode',
  'Light mode': 'ui.light_mode',
  'Strict UML': 'ui.strict_uml',
  'No diagram yet': 'diagram.none',
  'Write Isomorph code in the editor on the left, or load an example from the toolbar.': 'diagram.help_write',
  'Empty diagram': 'diagram.empty',
  'Drag and drop elements from the sidebar or type to add entities.': 'diagram.help_drag',
  'Empty diagram placeholder': 'diagram.empty_placeholder',
  'Diagram canvas': 'diagram.canvas_label',
  'Select / Move': 'tool.select_move',
  'Pan Canvas': 'tool.pan_canvas',
  'Draw Edge': 'tool.draw_edge',
  'Zoom controls': 'tool.zoom_controls',
  'Zoom out': 'tool.zoom_out',
  'Zoom in': 'tool.zoom_in',
  'Reset zoom (currently {zoom}%)': 'tool.reset_zoom',
  'Resize panels - use arrow keys': 'tool.resize_panels',
  'Keyboard shortcuts': 'ui.shortcuts',
  'Keyboard Shortcuts': 'ui.shortcuts_title',
  'Close': 'ui.close',
  'Press': 'ui.press',
  'to close': 'ui.to_close',
  'New diagram': 'menu.new_diagram',
  'Open .isx file': 'menu.open_isx',
  'Export SVG': 'menu.export_svg',
  'Export PNG': 'menu.export_png',
  'Undo / Redo': 'menu.undo_redo',
  'Toggle this panel': 'ui.toggle_panel',
  'Shapes': 'ui.shapes',
  'Source': 'ui.source',
  'OK': 'ui.ok',
  'Errors': 'ui.errors',
  'Canvas': 'ui.canvas',
  'drag to reposition': 'ui.drag_reposition',
  'Insert shapes': 'ui.insert_shapes',
  'Examples': 'ui.examples',
  'Load example diagram': 'ui.load_example',
  'Example diagrams': 'ui.example_diagrams',
  'Welcome to Isomorph': 'welcome.title',
  'Open an existing diagram or create a new one to get started.': 'welcome.description',
  'Diagram': 'welcome.diagram',
  'Create New Diagram': 'welcome.create_new',
  'Open Existing File...': 'welcome.open_existing',
  "Select the type of diagram you'd like to create.": 'welcome.select_type',
  'Cancel': 'ui.cancel',
  'Create': 'ui.create',
  'Diagrams': 'ui.diagrams',
  'Switch to {name} ({kind} diagram)': 'tabs.switch',
  'Open files': 'tabs.open_files',
  'Open {name}': 'tabs.open_name',
  'Close {name}': 'tabs.close_name',
  'New': 'menu.new',
  'Open': 'menu.open',
  'New (Ctrl+N)': 'menu.new_shortcut',
  'Open (Ctrl+O)': 'menu.open_shortcut',
  'Transform sequence diagram to collaboration in a new tab': 'menu.transform_seq_collab',
  'Transform to Collaboration': 'menu.transform_collab',
  'Transform': 'menu.transform',
  'Export source code (.isx)': 'menu.export_source',
  'Save ISX': 'menu.save_isx',
  'Save .isx': 'menu.save_isx_ext',
  'Export diagram as SVG (Ctrl+E)': 'menu.export_svg_shortcut',
  'Export SVG (Ctrl+E)': 'menu.export_svg_short',
  'Export diagram as PNG (Ctrl+Shift+E)': 'menu.export_png_shortcut',
  'Export PNG (Ctrl+Shift+E)': 'menu.export_png_short',
  'Shortcuts (Ctrl+/)': 'menu.shortcuts',
  'Save': 'menu.save',
  'Code': 'ui.code',
  'Valid': 'status.valid',
  'Ready': 'status.ready',
  '{count} error': 'status.error_one',
  '{count} errors': 'status.error_many',
  'Diagram valid': 'status.diagram_valid',
  '{count} parse error': 'status.parse_error_one',
  '{count} parse errors': 'status.parse_error_many',
  '{count} lines': 'status.lines',
  '{count} entities': 'status.entities',
  '{count} relations': 'status.relations',
  '+{count} more error': 'status.more_error_one',
  '+{count} more errors': 'status.more_error_many',
  'Edit Entity': 'edit.entity_title',
  'Name': 'edit.name',
  'Kind': 'edit.kind',
  'Stereotype': 'edit.stereotype',
  'e.g. device': 'edit.eg_device',
  'Abstract': 'edit.abstract',
  'Body': 'edit.body',
  '+ Enum Value': 'edit.enum_value',
  '+ Ext Pt': 'edit.ext_pt',
  '+ Pub Field': 'edit.pub_field',
  '+ Priv Field': 'edit.priv_field',
  '+ Pub Method': 'edit.pub_method',
  '+ Node': 'edit.node',
  '+ Artifact': 'edit.artifact',
  '+ Port (prov)': 'edit.port_prov',
  '+ Port (req)': 'edit.port_req',
  '+ Entry': 'edit.entry',
  '+ Exit': 'edit.exit',
  '+ Do': 'edit.do',
  '+ SubState': 'edit.substate',
  'Edit Relation': 'edit.relation_title',
  'Role / Label': 'edit.role_label',
  '+ Guard': 'edit.guard',
  'From Mult (e.g. 1)': 'edit.from_mult',
  'To Mult (e.g. 0..*)': 'edit.to_mult',
  'Direction': 'edit.direction',
  'Association': 'rel.association',
  'Directed Association': 'rel.directed_association',
  'Inheritance': 'rel.inheritance',
  'Realization': 'rel.realization',
  'Aggregation': 'rel.aggregation',
  'Composition': 'rel.composition',
  'Dependency': 'rel.dependency',
  'Restriction': 'rel.restriction',
  'Forward': 'edit.forward',
  'Reverse': 'edit.reverse',
  'Edit Diagram Name': 'edit.diagram_name',
  'Edit Package Name': 'edit.package_name',
  'Isomorph DSL': 'ui.isomorph_dsl',
  'Close Diagram?': 'dialog.close_title',
  'Are you sure you want to close "{name}"? Unsaved changes may be lost.': 'dialog.close_desc',
  'Isomorph home': 'ui.isomorph_home'
};

function getFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const fileList = fs.readdirSync(dir);
  for (const file of fileList) {
    const name = `${dir}/${file}`;
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files);
    } else if (name.endsWith('.tsx') || name.endsWith('.ts') || name.endsWith('.html')) {
      if (!name.includes('i18n.ts')) {
        files.push(name);
      }
    }
  }
  return files;
}

const filesToProcess = [...getFiles('src'), ...getFiles('website')];

filesToProcess.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const sortedKeys = Object.keys(mappings).sort((a,b) => b.length - a.length);

  for (const enStr of sortedKeys) {
    const rKey = mappings[enStr];
    
    const escapeRegex = (s) => s.replace(/[-/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&');
    
    // JS: t('English') -> t('ui.key') or t("English") -> t("ui.key")
    const regexStr1 = "t\\\\(['\\\"]" + escapeRegex(enStr) + "['\\\"]";
    const regex1 = new RegExp(regexStr1, 'g');
    if (regex1.test(content)) {
      content = content.replace(regex1, "t('" + rKey + "'");
      changed = true;
    }
    
    // HTML mapped directly: "English": "Russian" -> "ui.key": "Russian"
    const regexStr2 = "['\\\"]" + escapeRegex(enStr) + "['\\\"]\\\s*:";
    const regex2 = new RegExp(regexStr2, 'g');
    if (regex2.test(content)) {
      content = content.replace(regex2, "'" + rKey + "':");
      changed = true;
    }
    
    // HTML variable usage: dict["English"] -> dict["ui.key"]
    const regexStr3 = "\\\\[['\\\"]" + escapeRegex(enStr) + "['\\\"]\\\\]";
    const regex3 = new RegExp(regexStr3, 'g');
    if (regex3.test(content)) {
      content = content.replace(regex3, "['" + rKey + "']");
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
  }
});
console.log("Done refactoring strings inside source code!");

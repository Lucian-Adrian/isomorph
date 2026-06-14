const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove duplicate justifyContainer style
content = content.replace("justifyContainer: 'space-between',", "");

// 2. Fix the addToast error type at line 3425
content = content.replace("addToast('Failed to move diagram', 'error');", "addToast('Failed to move diagram', 'info');");

// 3. Find the duplicate modals block and replace it
// The block starts with `{isSettingsOpen && (` (second occurrence) and ends right before `{toasts.length > 0 && (`.
const settingsOpenStr = '{isSettingsOpen && (';
let firstIndex = content.indexOf(settingsOpenStr);
if (firstIndex === -1) {
  console.error("Error: could not find settingsOpenStr");
  process.exit(1);
}

// Find second occurrence
let secondIndex = content.indexOf(settingsOpenStr, firstIndex + settingsOpenStr.length);
if (secondIndex === -1) {
  console.error("Error: could not find second settingsOpenStr");
  process.exit(1);
}

const toastsStr = '{toasts.length > 0 && (';
const toastsIndex = content.indexOf(toastsStr);
if (toastsIndex === -1) {
  console.error("Error: could not find toastsStr");
  process.exit(1);
}

// Find the last '}' before toastsIndex (ignoring whitespace/newlines)
let endIndex = content.lastIndexOf('}', toastsIndex);
if (endIndex === -1 || endIndex < secondIndex) {
  console.error("Error: could not find endIndex");
  process.exit(1);
}
// We want to include the '}' in the replacement range
endIndex += 1;

console.log("Replacing from index", secondIndex, "to", endIndex);
console.log("Preview of block to remove:\n", content.slice(secondIndex, secondIndex + 100), "\n...\n", content.slice(endIndex - 100, endIndex));

const before = content.slice(0, secondIndex);
const after = content.slice(endIndex);

const newContent = before + '      {renderCommonModals()}\n' + after;
fs.writeFileSync(filePath, newContent, 'utf8');
console.log("App.tsx updated successfully!");

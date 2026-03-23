const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/GraphView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace dark: classes
content = content.replace(/\bdark:[a-zA-Z0-9/-]+\b/g, '');
// Clean up double spaces that might have been left
content = content.replace(/  +/g, ' ');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Removed dark mode classes');

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/GraphView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/.*const \[aiLoading, setAiLoading\].*\n/g, '');
content = content.replace(/.*const \[aiResponse, setAiResponse\].*\n/g, '');
content = content.replace(/.*const \[useThinking, setUseThinking\].*\n/g, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Removed AI states');

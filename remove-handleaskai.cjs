const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/GraphView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Remove handleAskAI
const handleAskAIStart = content.indexOf('const handleAskAI = async');
if (handleAskAIStart !== -1) {
  const handleAskAIEnd = content.indexOf('// Compute display data based on model');
  if (handleAskAIEnd !== -1) {
    content = content.substring(0, handleAskAIStart) + content.substring(handleAskAIEnd);
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Removed handleAskAI');

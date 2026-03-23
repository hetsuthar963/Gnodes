const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/GraphView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Remove AI states
content = content.replace(/  const \[aiLoading, setAiLoading\] = useState\(false\);\n/g, '');
content = content.replace(/  const \[aiResponse, setAiResponse\] = useState<string \| null>\(null\);\n/g, '');
content = content.replace(/  const \[useThinking, setUseThinking\] = useState\(false\);\n/g, '');

// Remove handleAskAI
content = content.replace(/  const handleAskAI = async \([^]*?  };\n\n/g, '');

// Remove Node Details Panel
const detailsStart = content.indexOf('{/* Right Side: Node Details Panel (Living Document) */}');
const detailsEnd = content.indexOf('{/* Mini Map (Temporarily Disabled)');

if (detailsStart !== -1 && detailsEnd !== -1) {
  content = content.substring(0, detailsStart) + content.substring(detailsEnd);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Removed Node Details and AI state');

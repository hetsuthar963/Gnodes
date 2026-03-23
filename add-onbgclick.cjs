const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/GraphView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /onNodeHover=\{\(node: any\) => \{/g,
  'onBackgroundClick={() => onNodeClick(null)}\n        onNodeHover={(node: any) => {'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Added onBackgroundClick');

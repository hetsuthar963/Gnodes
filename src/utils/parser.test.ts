import { describe, it, expect } from 'vitest';
import { buildGraphData } from './parser';

describe('parser', () => {
  it('should build graph data correctly from files', () => {
    const files = [
      {
        path: 'src/index.ts',
        content: 'import { helper } from "./utils/helper";\nconsole.log(helper());'
      },
      {
        path: 'src/utils/helper.ts',
        content: 'export const helper = () => "hello";'
      }
    ];

    const graphData = buildGraphData(files);

    expect(graphData.nodes).toHaveLength(2);
    expect(graphData.links).toHaveLength(1);

    const indexNode = graphData.nodes.find(n => n.id === 'src/index.ts');
    const helperNode = graphData.nodes.find(n => n.id === 'src/utils/helper.ts');

    expect(indexNode).toBeDefined();
    expect(helperNode).toBeDefined();

    expect(graphData.links[0].source).toBe('src/index.ts');
    expect(graphData.links[0].target).toBe('src/utils/helper.ts');
  });

  it('should handle empty files gracefully', () => {
    const files: any[] = [];
    const graphData = buildGraphData(files);
    expect(graphData.nodes).toHaveLength(0);
    expect(graphData.links).toHaveLength(0);
  });
});

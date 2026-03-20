import { describe, it, expect, vi, beforeEach } from 'vitest';
import { askAI } from './geminiService';

const { mockGenerateContent } = vi.hoisted(() => {
  return {
    mockGenerateContent: vi.fn().mockResolvedValue({
      text: 'Mocked AI response'
    })
  };
});

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: mockGenerateContent
      };
    },
    ThinkingLevel: { HIGH: 'HIGH' }
  };
});

describe('geminiService', () => {
  beforeEach(() => {
    mockGenerateContent.mockResolvedValue({
      text: 'Mocked AI response'
    });
  });

  it('calls generateContent with correct parameters', async () => {
    const response = await askAI('const a = 1;', 'What is this?', false);
    expect(response).toBe('Mocked AI response');
  });

  it('uses thinking config when requested', async () => {
    const response = await askAI('const a = 1;', 'What is this?', true);
    expect(response).toBe('Mocked AI response');
  });

  it('handles undefined response.text', async () => {
    mockGenerateContent.mockResolvedValue({});
    const response = await askAI('const a = 1;', 'What is this?', false);
    expect(response).toBe('');
  });
});

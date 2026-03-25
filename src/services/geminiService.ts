import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function askAI(
  code: string,
  question: string,
  useThinking: boolean = false
): Promise<string> {
  const prompt = `
You are an expert software developer.
Analyze the following code and answer the user's question.

Code:
${code}

Question:
${question}
`;

  const config: any = {
    systemInstruction: "You are an expert software developer. Provide clear, concise, and accurate answers.",
  };

  if (useThinking) {
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config,
  });

  return response.text || '';
}

export async function askGlobalAI(
  repoSummary: string,
  question: string
): Promise<string> {
  const prompt = `
You are an expert software architect.
Analyze the following repository summary and answer the user's question.
The summary includes file paths, dependencies, and key metrics.

Repository Summary:
${repoSummary}

Question:
${question}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      systemInstruction: "You are an expert software architect. Provide high-level structural analysis and clear answers.",
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
    },
  });

  return response.text || '';
}

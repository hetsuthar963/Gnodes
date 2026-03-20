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

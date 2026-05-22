import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";

export interface AIImagePart {
  mimeType: string;
  data: string; // base64 string
}

export async function generateSafetyReport(
  prompt: string,
  userNotes: string,
  images: AIImagePart[]
): Promise<string> {
  const provider = process.env.AI_PROVIDER || "gemini";

  if (provider === "claude") {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const imageBlocks = images.map((img) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: img.mimeType as any,
        data: img.data,
      },
    }));

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6", // Using Claude 4.6 Sonnet as requested
      max_tokens: 4000,
      system: prompt,
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            { type: "text" as const, text: `Observaciones del inspector: ${userNotes}` },
          ],
        },
      ],
    });

    return (response.content[0] as any).text;
  } else {
    // Default to Gemini 2.0 Flash
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const imageParts = images.map((img) => ({
      inlineData: {
        data: img.data,
        mimeType: img.mimeType,
      },
    }));

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            ...imageParts,
            { text: prompt + "\n\nObservaciones del inspector: " + userNotes },
          ],
        },
      ],
    });

    return response.text || "Error: No se pudo generar el análisis. Intente nuevamente.";
  }
}

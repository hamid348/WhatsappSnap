import { GoogleGenAI, Type } from "@google/genai";
import { ParsedNumber } from '../types';

// NOTE: In a real Chrome Extension, process.env isn't available at runtime. 
// This relies on a bundler to replace process.env.API_KEY or the user having a way to input it.
// Following system instructions to assume it is pre-configured.
const API_KEY = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const extractNumbersFromImage = async (base64Image: string): Promise<ParsedNumber[]> => {
  if (!API_KEY) {
    throw new Error("API Key is missing. Please configure your environment.");
  }

  // Remove data URL prefix if present to get raw base64
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64
            }
          },
          {
            text: `Identify all phone numbers in this image. 
            For each number found:
            1. Preserve the 'original' text as seen.
            2. specific 'normalized' version in international format (e.g., without spaces, dashes, parentheses). If country code is missing, do your best to infer from context or leave as is but stripped of symbols.
            3. Provide a short 'label' (e.g., "Contact", "Support", "Poster") if context suggests one.
            Return a JSON array.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              original: { type: Type.STRING },
              normalized: { type: Type.STRING },
              label: { type: Type.STRING }
            },
            required: ["original", "normalized"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];

    const data = JSON.parse(text) as ParsedNumber[];
    return data;

  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw new Error("Failed to analyze image. Please try again.");
  }
};

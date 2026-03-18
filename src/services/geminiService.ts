import { GoogleGenAI, Type } from "@google/genai";
import { HoleScore } from "../types";

export async function analyzeScorecard(base64Image: string): Promise<HoleScore[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set. AI analysis will not work.");
    return [];
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze this golf scorecard image. 
    Extract the scores for 9 holes. 
    Return a list of objects with these properties:
    - holeNumber (1-9)
    - par (number)
    - score (number)
    - putts (number)
    - fairwayHit (boolean)
    - gir (boolean)
    - eagle (boolean) - true if score is 2 or more under par
    - birdie (boolean) - true if score is 1 under par

    If you cannot find specific data like putts or fairways, provide your best estimate or default to 2 putts and false for fairways/GIR.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(',')[1] || base64Image,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              holeNumber: { type: Type.INTEGER },
              par: { type: Type.INTEGER },
              score: { type: Type.INTEGER },
              putts: { type: Type.INTEGER },
              fairwayHit: { type: Type.BOOLEAN },
              gir: { type: Type.BOOLEAN },
              eagle: { type: Type.BOOLEAN },
              birdie: { type: Type.BOOLEAN },
            },
            required: ["holeNumber", "par", "score", "putts", "fairwayHit", "gir"],
          },
        },
      },
    });

    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to analyze scorecard with Gemini:", error);
    return [];
  }
}


import { GoogleGenAI, Type } from "@google/genai";
import { Mission, MapTheme } from "../types";

let genAI: GoogleGenAI | null = null;

function getAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY || (process.env as any).API_KEY;
    if (!apiKey || apiKey === "undefined" || apiKey === "null") {
      console.warn("GEMINI_API_KEY is not defined. Using fallback values.");
      return null;
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

const GENERATED_OBSTACLES_COUNT = 12;

const generateRandomObstacles = (): [number, number, number][] => {
  const obstacles: [number, number, number][] = [];
  for (let i = 0; i < GENERATED_OBSTACLES_COUNT; i++) {
    // Generate obstacles in 100x100 area but not too close to center
    let x, z;
    do {
      x = (Math.random() - 0.5) * 160;
      z = (Math.random() - 0.5) * 160;
    } while (Math.sqrt(x*x + z*z) < 15);
    obstacles.push([x, 0, z]);
  }
  return obstacles;
};

const DEFAULT_MISSION = (forcedTheme?: MapTheme): Mission => ({
  title: "Operation: Dark Sky",
  objective: "Neutralize all hostiles in the urban sector.",
  location: "Neo-Tokyo Industrial Zone",
  difficulty: "Medium",
  threatLevel: 75,
  mapTheme: forcedTheme || MapTheme.CYBER,
  obstaclePositions: [
    [-20, 0, -20], [20, 0, -20], [-20, 0, 20], [20, 0, 20],
    [-10, 0, 0], [10, 0, 0], [0, 0, -15], [0, 0, 15]
  ]
});

export const generateMission = async (forcedTheme?: MapTheme): Promise<Mission> => {
  try {
    const ai = getAI();
    if (!ai) return DEFAULT_MISSION(forcedTheme);

    const prompt = forcedTheme 
      ? `Generate a realistic military FPS mission briefing in a near-future setting for a ${forcedTheme} environment.`
      : "Generate a realistic military FPS mission briefing in a near-future setting. Choose a distinct map theme.";

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            objective: { type: Type.STRING },
            location: { type: Type.STRING },
            difficulty: { 
              type: Type.STRING,
              description: "One of: Easy, Medium, Hard, Extreme"
            },
            threatLevel: { type: Type.NUMBER },
            mapTheme: { 
              type: Type.STRING,
              description: "One of: CYBER, INDUSTRIAL, ARCTIC, DESERT, VOLCANIC"
            }
          },
          required: ["title", "objective", "location", "difficulty", "threatLevel", "mapTheme"]
        }
      }
    });

    const data = JSON.parse(response.text.trim());
    return {
      ...data,
      mapTheme: forcedTheme || data.mapTheme,
      obstaclePositions: generateRandomObstacles()
    } as Mission;
  } catch (error) {
    console.error("Failed to generate mission:", error);
    return DEFAULT_MISSION(forcedTheme);
  }
};

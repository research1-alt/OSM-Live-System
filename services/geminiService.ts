
import { GoogleGenAI } from "@google/genai";
import { VEHICLE_CAN_PROTOCOL } from "../data/vehicleLogic";

// Use process.env.GEMINI_API_KEY as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const geminiService = {
  /**
   * Analyzes live CAN data using Gemini 3 Flash.
   * Incorporates the Vehicle CAN Protocol for expert-level interpretation.
   */
  async analyzeCanData(userPrompt: string, currentFrames: any[]) {
    // Using gemini-3-flash-preview for fast, intelligent responses
    const model = "gemini-3-flash-preview";
    
    const systemInstruction = `
      You are an expert Vehicle Systems Engineer at Omega Seiki Mobility (OSM).
      Your task is to help users analyze CAN bus data and understand vehicle behavior.
      
      VEHICLE PROTOCOL CONTEXT (Source of Truth):
      ${JSON.stringify(VEHICLE_CAN_PROTOCOL, null, 2)}
      
      CURRENT LIVE DATA (Last 20 active frames):
      ${JSON.stringify(currentFrames.slice(-20), null, 2)}
      
      Instructions:
      1. Use the provided protocol context to interpret CAN IDs and signals accurately.
      2. If the user asks about charging, reference the Charger & Battery handshake logic (IDs 12A0AA80-84 and 12A180AA-AB).
      3. If the user asks about vehicle modes, explain how the Battery mode (ID 14234040) affects MCU behavior (Forward, Boost, Gradient, etc.).
      4. Be technical, precise, and professional.
      5. If you see specific IDs like 10281050, mention the KSI status (0=OFF, 1=ON).
      6. If the data shows MCU IDs (18275040, etc.), confirm the MCU is powered ON.
      7. Format your response clearly using markdown if needed.
    `;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction
        }
      });
      
      return response.text || "I was able to process the request but returned no text. Please try rephrasing.";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "I encountered an error while analyzing the data. Please ensure your API key is configured correctly.";
    }
  }
};

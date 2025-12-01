import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, ComparisonResult } from '../models/types';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private readonly MODEL_NAME = 'gemini-2.5-flash';
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY environment variable not set");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  private async generateContentWithRetry(model: string, params: any, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.ai.models.generateContent({
          model,
          ...params
        });
      } catch (error: any) {
        const isOverloaded = error.status === 503 || error.code === 503 || error.message?.includes('503');
        const isRateLimited = error.status === 429 || error.code === 429 || error.message?.includes('429');
        const isInternalError = error.status === 500 || error.code === 500;

        if ((isOverloaded || isRateLimited || isInternalError) && i < retries - 1) {
          const delay = Math.pow(2, i) * 1000;
          console.warn(`Gemini model ${model} error (${error.status || error.code}). Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
  }

  async getDailyTopics(): Promise<string[]> {
    const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const prompt = `Generate 10 unique, engaging conversation topics for today, ${date}.
    Criteria:
    1. Topics must be about Current Events, Politics, Sports, Social Issues, or Philosophy.
    2. STRICTLY NO Technology, Coding, or AI topics.
    3. Topics should be open-ended and suitable for debate or discussion.
    4. Return ONLY a JSON array of strings.`;

    try {
        const response: any = await this.generateContentWithRetry(this.MODEL_NAME, {
             contents: prompt,
             config: {
                 responseMimeType: "application/json",
                 responseSchema: {
                     type: Type.ARRAY,
                     items: { type: Type.STRING }
                 }
             }
        });
        return JSON.parse(response?.text?.trim() || "[]");
    } catch (e) {
        console.error("Error fetching daily topics:", e);
        return [
            "The impact of globalization on local cultures",
            "Should voting be mandatory?",
            "The role of sports in modern society",
            "Universal Basic Income: Pros and Cons",
            "Climate change mitigation strategies",
            "The future of traditional education",
            "Mental health awareness in the workplace",
            "The ethics of space exploration",
            "Is true privacy possible anymore?",
            "The influence of pop culture on youth"
        ];
    }
  }

  async analyzeAudio(audioFile: File): Promise<AnalysisResult> {
    const [base64Audio, audioDuration] = await Promise.all([
      this.fileToBase64(audioFile),
      this.getAudioDuration(audioFile)
    ]);
    
    const analysisSchema = {
      type: Type.OBJECT,
      properties: {
        primarySpeakerLabel: { type: Type.STRING },
        dimensions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { name: { type: Type.STRING }, score: { type: Type.NUMBER } },
            required: ["name", "score"],
          },
        },
        fluencySpeechRatePercentage: { type: Type.NUMBER },
        feedback: { type: Type.ARRAY, items: { type: Type.STRING } },
        fillerWords: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { word: { type: Type.STRING }, count: { type: Type.INTEGER } },
            required: ["word", "count"],
          },
        },
        conversation: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              speaker: { type: Type.STRING },
              text: { type: Type.STRING },
              startTime: { type: Type.NUMBER },
              endTime: { type: Type.NUMBER },
              mistake: {
                type: Type.OBJECT,
                properties: { incorrectPhrase: { type: Type.STRING }, suggestion: { type: Type.STRING }, explanation: { type: Type.STRING } },
                required: ["incorrectPhrase", "suggestion", "explanation"],
              },
            },
            required: ["speaker", "text", "startTime", "endTime"],
          },
        },
        personalizedSuggestions: {
            type: Type.OBJECT,
            properties: {
                areaForFocus: { type: Type.STRING },
                suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["areaForFocus", "suggestions"],
        }
      },
      required: ["primarySpeakerLabel", "dimensions", "fluencySpeechRatePercentage", "feedback", "fillerWords", "conversation", "personalizedSuggestions"],
    };

    const singleAnalysisPrompt = `You are a world-class speech and communication coach. Analyze the speech from the provided audio file. 
    Instructions:
    1. Transcript & Timestamps: Provide a complete transcript. CRITICAL: For every turn, provide accurate 'startTime' and 'endTime' in seconds.
    2. Identify PRIMARY speaker (User) and SECONDARY speaker (AI).
    3. Mistake detection, Dimension scoring (0-5), Fluency (0-100), Filler count.
    4. Feedback & Coaching plan.
    Return result in JSON.`;

    try {
      const audioPart = { inlineData: { mimeType: audioFile.type, data: base64Audio } };
      const textPart = { text: singleAnalysisPrompt };

      const response: any = await this.generateContentWithRetry(this.MODEL_NAME, {
          contents: { parts: [textPart, audioPart] },
          config: { 
              responseMimeType: "application/json", 
              responseSchema: analysisSchema,
              temperature : 0.1
          }
      });
      
      const result = JSON.parse(response?.text?.trim() || "{}");

      // Post-processing
      const processedDimensions = result.dimensions || [];
      const processedFluency = result.fluencySpeechRatePercentage || 0;
      const conversation = result.conversation || [];
      let primarySeconds = 0;
      let otherSeconds = 0;
      const primaryLabel = result.primarySpeakerLabel;

      conversation.forEach((turn: any) => {
          const duration = Math.max(0, turn.endTime - turn.startTime);
          if (turn.speaker === primaryLabel) {
              primarySeconds += duration;
          } else {
              otherSeconds += duration;
          }
      });

      let totalSpoken = primarySeconds + otherSeconds;
      if (audioDuration > 0 && totalSpoken > audioDuration) {
          const scaleFactor = audioDuration / totalSpoken;
          primarySeconds *= scaleFactor;
          otherSeconds *= scaleFactor;
      }
      
      const basisDuration = audioDuration || 1; 

      const speakingTimeDistribution = {
          primarySpeaker: {
              seconds: primarySeconds,
              percentage: Math.min(100, Math.round((primarySeconds / basisDuration) * 100))
          },
          others: {
              seconds: otherSeconds,
              percentage: Math.min(100, Math.round((otherSeconds / basisDuration) * 100))
          }
      };

      const coreDimensionScores = processedDimensions
          .filter((d: any) => ['Clarity', 'Language Proficiency', 'Conciseness'].includes(d.name))
          .map((d: any) => d.score);
      
      let overallScore = 0;
      if (coreDimensionScores.length > 0) {
          const totalScore = coreDimensionScores.reduce((sum: number, score: number) => sum + score, 0);
          overallScore = parseFloat((totalScore / coreDimensionScores.length).toFixed(2));
      }

      return {
          ...result,
          dimensions: processedDimensions,
          fluencySpeechRatePercentage: processedFluency,
          overallScore,
          speakingTimeDistribution
      };

    } catch (error) {
      console.error("Error analyzing audio:", error);
      throw new Error("Failed to analyze audio. The AI model is currently experiencing high traffic. Please try again in a few moments.");
    }
  }

  async generateComparisonReport(oldAnalysis: AnalysisResult, newAnalysis: AnalysisResult): Promise<ComparisonResult> {
    const comparisonSchema = {
        type: Type.OBJECT,
        properties: {
            dimensionChanges: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: { name: { type: Type.STRING }, oldScore: { type: Type.NUMBER }, newScore: { type: Type.NUMBER } },
                    required: ["name", "oldScore", "newScore"],
                }
            },
            fluencyChange: {
                type: Type.OBJECT,
                properties: { oldPercentage: { type: Type.NUMBER }, newPercentage: { type: Type.NUMBER } },
                required: ["oldPercentage", "newPercentage"],
            },
            improvementSummary: { type: Type.ARRAY, items: { type: Type.STRING } },
            areasForNextFocus: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["dimensionChanges", "fluencyChange", "improvementSummary", "areasForNextFocus"],
    };

    const comparisonPrompt = `Compare two speech analyses (Old vs New). return JSON.`;

    try {
        const response: any = await this.generateContentWithRetry(this.MODEL_NAME, {
            contents: {
                parts: [
                    { text: comparisonPrompt },
                    { text: "\n--- OLDER ANALYSIS ---" },
                    { text: JSON.stringify(oldAnalysis) },
                    { text: "\n--- NEWER ANALYSIS ---" },
                    { text: JSON.stringify(newAnalysis) },
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: comparisonSchema,
            }
        });
        return JSON.parse(response?.text?.trim() || "{}");
    } catch (error) {
        console.error("Error comparing:", error);
        throw new Error("Failed to compare analyses. Please try again.");
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  }

  private getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const audio = document.createElement('audio');
      const objectUrl = URL.createObjectURL(file);
      audio.src = objectUrl;
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
        URL.revokeObjectURL(objectUrl);
      };
      audio.onerror = () => resolve(0); 
    });
  }
}

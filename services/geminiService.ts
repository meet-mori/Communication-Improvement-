
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, ComparisonResult, Dimension } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable not set");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper function to handle retries for overloaded models (503), rate limits (429), or internal errors (500)
const generateContentWithRetry = async (model: string, params: any, retries = 3) => {
  const ai = getAiClient();
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent({
        model,
        ...params
      });
    } catch (error: any) {
      // Check for 503 (Service Unavailable/Overloaded), 429 (Too Many Requests), or 500 (Internal Error)
      const isOverloaded = error.status === 503 || error.code === 503 || error.message?.includes('503');
      const isRateLimited = error.status === 429 || error.code === 429 || error.message?.includes('429');
      const isInternalError = error.status === 500 || error.code === 500;

      if ((isOverloaded || isRateLimited || isInternalError) && i < retries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, i) * 1000;
        console.warn(`Gemini model ${model} error (${error.status || error.code}). Retrying in ${delay}ms (Attempt ${i + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
};

// Switched to gemini-2.5-flash for better availability and speed
const MODEL_NAME = 'gemini-2.5-flash';

export const getPracticePrompt = async (): Promise<string> => {
    try {
        const response = await generateContentWithRetry(MODEL_NAME, {
            contents: 'Generate a short, engaging, and random prompt for a user to practice their public speaking and communication skills. The prompt should be a single sentence or question. For example: "Describe your dream vacation." or "Explain a complex topic you are passionate about in simple terms."',
            config: {
                temperature: 0.9,
                maxOutputTokens: 50,
            }
        });
        // Clean up the response, removing potential quotes or extra text
        return response?.text?.trim().replace(/^"|"$/g, '') || "Describe something you are passionate about.";
    } catch (error) {
        console.error("Error fetching practice prompt:", error);
        // Return a fallback prompt
        return "Describe something you are passionate about.";
    }
};

export const getDailyTopics = async (): Promise<string[]> => {
    const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const prompt = `Generate 10 unique, engaging conversation topics for today, ${date}.
    Criteria:
    1. Topics must be about Current Events, Politics, Sports, Social Issues, or Philosophy.
    2. STRICTLY NO Technology, Coding, or AI topics.
    3. Topics should be open-ended and suitable for debate or discussion.
    4. Return ONLY a JSON array of strings.`;

    try {
        const response = await generateContentWithRetry(MODEL_NAME, {
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
};

// Utility function to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
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
};

// Utility to get audio duration
const getAudioDuration = (file: File): Promise<number> => {
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
};

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    primarySpeakerLabel: {
        type: Type.STRING,
        description: "The label (e.g., 'Speaker A' or 'User') assigned to the primary speaker who was analyzed."
    },
    dimensions: {
      type: Type.ARRAY,
      description: "Scores for the three primary communication dimensions (Clarity, Language Proficiency, Conciseness) on a 0-5 scale.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          score: { type: Type.NUMBER },
        },
        required: ["name", "score"],
      },
    },
    fluencySpeechRatePercentage: { 
        type: Type.NUMBER, 
        description: "A score from 0 to 100 for fluency and speech rate." 
    },
    feedback: {
      type: Type.ARRAY,
      description: "Actionable feedback points.",
      items: { type: Type.STRING },
    },
    fillerWords: {
      type: Type.ARRAY,
      description: "List of filler words used and their counts.",
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          count: { type: Type.INTEGER },
        },
        required: ["word", "count"],
      },
    },
    conversation: {
      type: Type.ARRAY,
      description: "The full conversation transcript with timestamps for every turn.",
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: { type: Type.STRING },
          text: { type: Type.STRING },
          startTime: { type: Type.NUMBER, description: "Start time of the turn in seconds." },
          endTime: { type: Type.NUMBER, description: "End time of the turn in seconds." },
          mistake: {
            type: Type.OBJECT,
            properties: {
              incorrectPhrase: { type: Type.STRING },
              suggestion: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
            required: ["incorrectPhrase", "suggestion", "explanation"],
          },
        },
        required: ["speaker", "text", "startTime", "endTime"],
      },
    },
    personalizedSuggestions: {
        type: Type.OBJECT,
        description: "Personalized coaching plan focusing on the weakest area with actionable tips and resource links.",
        properties: {
            areaForFocus: {
                type: Type.STRING,
                description: "The single most critical area for improvement (e.g., 'Vocabulary', 'Grammar', 'Fluency')."
            },
            suggestions: {
                type: Type.ARRAY,
                description: "A list of actionable suggestions, including markdown links to external resources.",
                items: { type: Type.STRING },
            }
        },
        required: ["areaForFocus", "suggestions"],
    }
  },
  required: ["primarySpeakerLabel", "dimensions", "fluencySpeechRatePercentage", "feedback", "fillerWords", "conversation", "personalizedSuggestions"],
};

const singleAnalysisPrompt = `You are a world-class speech and communication coach. Analyze the speech from the provided audio file. 

Instructions:
1.  **Transcript & Timestamps**: Provide a complete, word-for-word transcript. **CRITICAL**: For every single turn, you MUST provide accurate 'startTime' and 'endTime' in seconds. The 'duration' (endTime - startTime) of a turn must include the entire time the speaker holds the floor, including all pauses, silence, "air", and filler sounds (like "um", "uh") within their turn. Do not trim silence inside a turn. Ensure the transcript covers the entire duration of the audio file. **Do not generate timestamps that exceed the audio file's duration.**
2.  **Speakers**: Identify the PRIMARY speaker (User/Student) and the SECONDARY speaker (Interviewer/AI). Label them consistently (e.g., 'Speaker A', 'Speaker B').
3.  **Primary Speaker**: Set 'primarySpeakerLabel' to the label of the User.
4.  **Mistakes**: Identify grammatical mistakes or awkward phrasing for the primary speaker.
5.  **Dimensions**: Rate the primary speaker on 'Clarity', 'Language Proficiency', and 'Conciseness' (0-5 scale).
6.  **Fluency**: Score 'Fluency / Speech Rate' (0-100%).
7.  **Fillers**: Count filler words for the primary speaker.
8.  **Feedback**: Provide 3-5 actionable feedback points.
9.  **Coaching**: Provide a 'personalizedSuggestions' object with a focus area and linked resources.

Return the result in the specified JSON format.`;


export const analyzeAudio = async (audioFile: File): Promise<AnalysisResult> => {
  const [base64Audio, audioDuration] = await Promise.all([
    fileToBase64(audioFile),
    getAudioDuration(audioFile)
  ]);
  
  try {
    const audioPart = { inlineData: { mimeType: audioFile.type, data: base64Audio } };
    const textPart = { text: singleAnalysisPrompt };

    // Using gemini-2.5-flash with retry logic for production stability
    const response = await generateContentWithRetry(MODEL_NAME, {
        contents: { parts: [textPart, audioPart] },
        config: { 
            responseMimeType: "application/json", 
            responseSchema: analysisSchema,
            temperature : 0.1
        }
    });
    
    // We are using single pass now, so result is just the parsed response
    const result = JSON.parse(response?.text?.trim() || "{}");

    // Standardize dimensions structure in case AI returns slightly different order
    const processedDimensions = result.dimensions || [];
    
    const processedFluency = result.fluencySpeechRatePercentage || 0;

    // --- MANUAL TIME CALCULATION FOR PRECISION ---
    // Instead of asking AI to sum it up (which it often gets wrong), we calculate it from the timestamps.
    const conversation = result.conversation || [];
    let primarySeconds = 0;
    let otherSeconds = 0;
    const primaryLabel = result.primarySpeakerLabel;

    conversation.forEach((turn: any) => {
        // Sanity check: ensure start < end
        const duration = Math.max(0, turn.endTime - turn.startTime);
        if (turn.speaker === primaryLabel) {
            primarySeconds += duration;
        } else {
            otherSeconds += duration;
        }
    });

    let totalSpoken = primarySeconds + otherSeconds;
    // Normalization Logic:
    // If the sum of speaking times exceeds the actual file duration (impossible physics due to AI hallucination or overlap),
    // we scale them down proportionally to fit the file duration exactly.
    if (audioDuration > 0 && totalSpoken > audioDuration) {
        const scaleFactor = audioDuration / totalSpoken;
        primarySeconds *= scaleFactor;
        otherSeconds *= scaleFactor;
        totalSpoken = audioDuration; // Conceptually clamped
    }
    
    // Recalculate percentages based on the possibly normalized values relative to total audio duration
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
    // ---------------------------------------------

    // Deterministically calculate the overallScore
    const coreDimensionScores = processedDimensions
        .filter((d: any) => ['Clarity', 'Language Proficiency', 'Conciseness'].includes(d.name))
        .map((d: any) => d.score);
    
    let overallScore = 0;
    if (coreDimensionScores.length > 0) {
        const totalScore = coreDimensionScores.reduce((sum: number, score: number) => sum + score, 0);
        overallScore = parseFloat((totalScore / coreDimensionScores.length).toFixed(2));
    }

    const finalResult: AnalysisResult = {
        ...result,
        dimensions: processedDimensions,
        fluencySpeechRatePercentage: processedFluency,
        overallScore,
        speakingTimeDistribution // Inject the calculated distribution
    };

    return finalResult;

  } catch (error) {
    console.error("Error analyzing audio with Gemini:", error);
    throw new Error("Failed to analyze audio. The AI model is currently experiencing high traffic. Please try again in a few moments.");
  }
};


const comparisonSchema = {
    type: Type.OBJECT,
    properties: {
        dimensionChanges: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    oldScore: { type: Type.NUMBER },
                    newScore: { type: Type.NUMBER },
                },
                required: ["name", "oldScore", "newScore"],
            }
        },
        fluencyChange: {
            type: Type.OBJECT,
            properties: {
                oldPercentage: { type: Type.NUMBER },
                newPercentage: { type: Type.NUMBER },
            },
            required: ["oldPercentage", "newPercentage"],
        },
        improvementSummary: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        },
        areasForNextFocus: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        },
    },
    required: ["dimensionChanges", "fluencyChange", "improvementSummary", "areasForNextFocus"],
};

const comparisonPrompt = `You are a world-class speech and communication coach. You will be given two JSON objects representing two different speech analyses for the same user: an 'older' analysis and a 'newer' analysis. Your task is to compare the user's performance between the two.

Instructions:
1.  Compare the scores for each dimension (rated 0-5) between the old and new analyses.
2.  Separately, compare the 'fluencySpeechRatePercentage' between the old and new analyses.
3.  Provide a bulleted 'improvementSummary' highlighting the key areas where the user has improved. Be specific and refer to the data, including the change in fluency. If performance worsened in some areas, state that genuinely.
4.  Provide a bulleted list of 'areasForNextFocus', suggesting what the user should work on next based on the comparison.
5.  Return the entire comparison in the specified JSON format. The 'dimensionChanges' should reflect the 'oldScore' and 'newScore' for the 0-5 rated dimensions. The 'fluencyChange' object should contain the 'oldPercentage' and 'newPercentage'.`;

export const generateComparisonReport = async (oldAnalysis: AnalysisResult, newAnalysis: AnalysisResult): Promise<ComparisonResult> => {
    try {
        const response = await generateContentWithRetry(MODEL_NAME, {
            contents: {
                parts: [
                    { text: comparisonPrompt },
                    { text: "\n--- OLDER ANALYSIS (JSON) ---" },
                    { text: JSON.stringify(oldAnalysis, null, 2) },
                    { text: "\n--- NEWER ANALYSIS (JSON) ---" },
                    { text: JSON.stringify(newAnalysis, null, 2) },
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: comparisonSchema,
            }
        });
        return JSON.parse(response?.text?.trim() || "{}");
    } catch (error) {
        console.error("Error generating comparison with Gemini:", error);
        throw new Error("Failed to compare analyses. Please try again.");
    }
};

import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, ComparisonResult, Dimension } from '../types';

export const getPracticePrompt = async (): Promise<string> => {
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Generate a short, engaging, and random prompt for a user to practice their public speaking and communication skills. The prompt should be a single sentence or question. For example: "Describe your dream vacation." or "Explain a complex topic you are passionate about in simple terms."',
            config: {
                temperature: 0.9,
                maxOutputTokens: 50,
            }
        });
        // Clean up the response, removing potential quotes or extra text
        return response.text.trim().replace(/^"|"$/g, '');
    } catch (error) {
        console.error("Error fetching practice prompt:", error);
        // Return a fallback prompt
        return "Describe something you are passionate about.";
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

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable not set");
  }
  return new GoogleGenAI({ apiKey });
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
1.  **Transcript & Timestamps**: Provide a complete, word-for-word transcript. **CRITICAL**: For every single turn, you MUST provide accurate 'startTime' and 'endTime' in seconds. The 'duration' (endTime - startTime) of a turn must include the entire time the speaker holds the floor, including all pauses, silence, "air", and filler sounds (like "um", "uh") within their turn. Do not trim silence inside a turn. Ensure the transcript covers the entire duration of the audio file.
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
    const ai = getAiClient();
    const audioPart = { inlineData: { mimeType: audioFile.type, data: base64Audio } };
    const textPart = { text: singleAnalysisPrompt };

    // 2 passes for accuracy
    const analysisPromises = Array(2).fill(null).map(() => 
      ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: { parts: [textPart, audioPart] },
          config: { 
              responseMimeType: "application/json", 
              responseSchema: analysisSchema,
              temperature : 0.1
          }
      })
    );
    
    const responses = await Promise.all(analysisPromises);
    const rawResults = responses.map(res => JSON.parse(res.text.trim()));

    // Averaging logic
    const dimensionSums: { [key: string]: number } = {};
    let fluencySum = 0;
    const dimensionCounts: { [key: string]: number } = {};

    for (const result of rawResults) {
        for (const dim of result.dimensions) {
            dimensionSums[dim.name] = (dimensionSums[dim.name] || 0) + dim.score;
            dimensionCounts[dim.name] = (dimensionCounts[dim.name] || 0) + 1;
        }
        fluencySum += result.fluencySpeechRatePercentage;
    }

    const averagedDimensions: Dimension[] = Object.keys(dimensionSums).map(name => ({
        name,
        score: parseFloat((dimensionSums[name] / (dimensionCounts[name] || 1)).toFixed(2)),
    }));

    const averagedFluency = Math.round(fluencySum / rawResults.length);
    
    // Take qualitative data from the first result
    const representativeResult = rawResults[0];

    // --- MANUAL TIME CALCULATION FOR PRECISION ---
    // Instead of asking AI to sum it up (which it often gets wrong), we calculate it from the timestamps.
    const conversation = representativeResult.conversation;
    let primarySeconds = 0;
    let otherSeconds = 0;
    const primaryLabel = representativeResult.primarySpeakerLabel;

    conversation.forEach((turn: any) => {
        const duration = Math.max(0, turn.endTime - turn.startTime);
        if (turn.speaker === primaryLabel) {
            primarySeconds += duration;
        } else {
            otherSeconds += duration;
        }
    });

    // Use the actual file duration for percentage calculation to represent "share of total time"
    // If the sum of spoken time is less than file duration, the remainder is dead air (or untranscribed).
    // If sum is greater (overlaps), we just use the raw sum.
    const totalSpoken = primarySeconds + otherSeconds;
    const basisDuration = Math.max(audioDuration, totalSpoken) || 1; // Prevent div by zero

    const speakingTimeDistribution = {
        primarySpeaker: {
            seconds: primarySeconds,
            percentage: Math.round((primarySeconds / basisDuration) * 100)
        },
        others: {
            seconds: otherSeconds,
            percentage: Math.round((otherSeconds / basisDuration) * 100)
        }
    };
    // ---------------------------------------------

    // Deterministically calculate the overallScore
    const coreDimensionScores = averagedDimensions
        .filter(d => ['Clarity', 'Language Proficiency', 'Conciseness'].includes(d.name))
        .map(d => d.score);
    
    let overallScore = 0;
    if (coreDimensionScores.length > 0) {
        const totalScore = coreDimensionScores.reduce((sum, score) => sum + score, 0);
        overallScore = parseFloat((totalScore / coreDimensionScores.length).toFixed(2));
    }

    const finalResult: AnalysisResult = {
        ...representativeResult,
        dimensions: averagedDimensions,
        fluencySpeechRatePercentage: averagedFluency,
        overallScore,
        speakingTimeDistribution // Inject the calculated distribution
    };

    return finalResult;

  } catch (error) {
    console.error("Error analyzing audio with Gemini:", error);
    throw new Error("Failed to analyze audio. The model may have had trouble with the file.");
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
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
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
        return JSON.parse(response.text.trim());
    } catch (error) {
        console.error("Error generating comparison with Gemini:", error);
        throw new Error("Failed to compare analyses. Please try again.");
    }
};
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
        description: "The label (e.g., 'Speaker A') assigned to the primary speaker who was analyzed."
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
      description: "The full conversation transcript with each speaker identified.",
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: { type: Type.STRING }, // Generic string to allow for 'Speaker A', 'Speaker B', etc.
          text: { type: Type.STRING },
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
        required: ["speaker", "text"],
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

const singleAnalysisPrompt = `You are a world-class speech and communication coach. Analyze the speech from the provided audio file. The audio may contain a conversation between two or more speakers.

Instructions:
1.  First, provide a complete, word-for-word transcript of the entire conversation. Identify each distinct speaker and label them consistently (e.g., 'Speaker A', 'Speaker B').
2.  Identify the primary speaker to analyze. This should be the person who speaks the most. If speaking time is equal, choose the first speaker.
3.  In the top-level of the JSON, include a 'primarySpeakerLabel' field containing the label you assigned to the speaker you analyzed (e.g., 'Speaker A').
4.  Perform a detailed analysis focusing ONLY on the primary speaker's speech.
5.  For the primary speaker, identify any grammatical mistakes or awkward phrasing. For each mistake, provide the incorrect phrase, a suggested correction, and a brief explanation. These mistakes should be linked to the relevant turn in the conversation transcript.
6.  Rate the primary speaker on the following three dimensions ONLY, on a scale of 0 to 5 (can be decimal): 'Clarity', 'Language Proficiency', and 'Conciseness'.
7.  Separately, evaluate the primary speaker's 'Fluency / Speech Rate' as a percentage from 0 to 100 and return it in the 'fluencySpeechRatePercentage' field. A higher percentage indicates better performance.
8.  Provide a list of the most frequently used filler words by the primary speaker and their counts.
9.  Offer a bulleted list of 3-5 clear, actionable 'feedback' points for the primary speaker's improvement. As part of the feedback, specifically mention their estimated speech rate in words-per-minute (WPM).
10. In the 'conversation' array of the JSON output, use the actual speaker labels you identified ('Speaker A', 'Speaker B', etc.) for the 'speaker' field for every turn.
11. After the main analysis, identify the single most critical area for improvement for the primary speaker from their dimension scores and fluency (e.g., 'Vocabulary', 'Grammar', 'Fluency', 'Clarity', 'Conciseness').
12. Based on this weakest area, provide a 'personalizedSuggestions' object. This object must contain an 'areaForFocus' string and a 'suggestions' array with 2-3 specific, actionable tips. For at least one tip, include a markdown link to a helpful external resource (e.g., a relevant YouTube video, an educational article, or a practice tool). Example markdown format: [Resource Title](https://example.com).
13. Return the entire analysis in the specified JSON format. Do NOT include an 'overallScore' field in your response.`;


export const analyzeAudio = async (audioFile: File): Promise<AnalysisResult> => {
  const base64Audio = await fileToBase64(audioFile);
  
  try {
    const ai = getAiClient();
    const audioPart = { inlineData: { mimeType: audioFile.type, data: base64Audio } };
    const textPart = { text: singleAnalysisPrompt };

    const analysisPromises = Array(3).fill(null).map(() => 
      ai.models.generateContent({
          model: 'gemini-2.5-pro',
          contents: { parts: [textPart, audioPart] },
          config: { 
              responseMimeType: "application/json", 
              responseSchema: analysisSchema,
              temperature : 0.1
          }
      })
    );
    
    const responses = await Promise.all(analysisPromises);
    const results: Omit<AnalysisResult, 'overallScore'>[] = responses.map(res => JSON.parse(res.text.trim()));

    // Averaging logic
    const dimensionSums: { [key: string]: number } = {};
    let fluencySum = 0;
    const dimensionCounts: { [key: string]: number } = {};

    for (const result of results) {
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

    const averagedFluency = Math.round(fluencySum / results.length);
    
    // Take qualitative data from the first result for consistency
    const representativeResult = results[0];

    // Deterministically calculate the overallScore from the *averaged* core dimensions
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
        overallScore
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
            model: 'gemini-2.5-pro',
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
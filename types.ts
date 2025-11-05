export interface Mistake {
  incorrectPhrase: string;
  suggestion: string;
  explanation: string;
}

export interface ConversationTurn {
  speaker: string; // Changed from 'User' | 'AI' to string to support 'Speaker A', etc.
  text: string;
  mistake?: Mistake;
}

export interface Dimension {
  name: string;
  score: number;
}

export interface FillerWord {
  word: string;
  count: number;
}

export interface AnalysisResult {
  overallScore: number;
  dimensions: Dimension[];
  feedback: string[];
  fillerWords: FillerWord[];
  conversation: ConversationTurn[];
  fluencySpeechRatePercentage: number;
  primarySpeakerLabel: string; // Added to identify the main speaker in the transcript
}

// Types for improvement tracking
export interface DimensionChange {
  name: string;
  oldScore: number;
  newScore: number;
}

export interface FluencyChange {
    oldPercentage: number;
    newPercentage: number;
}


export interface ComparisonResult {
  dimensionChanges: DimensionChange[];
  improvementSummary: string[];
  areasForNextFocus: string[];
  fluencyChange: FluencyChange;
}
export interface Mistake {
  incorrectPhrase: string;
  suggestion: string;
  explanation: string;
}

export interface ConversationTurn {
  speaker: string;
  text: string;
  mistake?: Mistake;
  startTime: number;
  endTime: number;
}

export interface Dimension {
  name: string;
  score: number;
}

export interface FillerWord {
  word: string;
  count: number;
}

export interface PersonalizedSuggestion {
  areaForFocus: string;
  suggestions: string[];
}

export interface SpeakingStats {
  seconds: number;
  percentage: number;
}

export interface SpeakingTimeDistribution {
  primarySpeaker: SpeakingStats;
  others: SpeakingStats;
}

export interface AnalysisResult {
  overallScore: number;
  dimensions: Dimension[];
  feedback: string[];
  fillerWords: FillerWord[];
  conversation: ConversationTurn[];
  fluencySpeechRatePercentage: number;
  primarySpeakerLabel: string;
  speakingTimeDistribution: SpeakingTimeDistribution;
  personalizedSuggestions: PersonalizedSuggestion;
}

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

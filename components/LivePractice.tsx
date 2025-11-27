import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAI_Blob } from '@google/genai';
import { MicrophoneIcon, StopCircleIcon, RobotIcon, UserIcon, DownloadIcon, RefreshCwIcon } from './icons';
import { getDailyTopics } from '../services/geminiService';

// --- Audio Utility Functions ---
// These are necessary for handling the raw audio data from the Gemini API.

// Decodes a base64 string into a Uint8Array.
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Encodes a Uint8Array into a base64 string.
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Decodes raw PCM audio data into an AudioBuffer for playback.
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Creates a Gemini API-compatible Blob from microphone audio data.
function createBlob(data: Float32Array): GenAI_Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}
// --- End Audio Utility Functions ---

type ConversationState = 'idle' | 'connecting' | 'connected' | 'error' | 'ended';
type TranscriptTurn = {
  speaker: 'User' | 'AI';
  text: string;
  isFinal: boolean;
};

export const LivePractice: React.FC = () => {
    const [conversationState, setConversationState] = useState<ConversationState>('idle');
    const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
    const [selectedLanguage, setSelectedLanguage] = useState('English');
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    // Daily Topics State
    const [dailyTopics, setDailyTopics] = useState<string[]>([]);
    const [loadingTopics, setLoadingTopics] = useState(false);

    // Refs for Web Audio API and Gemini session management
    const sessionPromiseRef = useRef<any>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    
    useEffect(() => {
        // Auto-scroll transcript
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript]);

    const fetchTopics = async () => {
        setLoadingTopics(true);
        const topics = await getDailyTopics();
        setDailyTopics(topics);
        setLoadingTopics(false);
    };

    useEffect(() => {
        fetchTopics();
    }, []);

    const handleMessage = useCallback(async (message: LiveServerMessage) => {
        setTranscript(prev => {
            let newTranscript = [...prev];
            if (message.serverContent?.inputTranscription) {
                const text = message.serverContent.inputTranscription.text;
                // 'isFinal' is not available on inputTranscription in the current SDK version.
                const lastTurn = newTranscript[newTranscript.length - 1];
                if (lastTurn?.speaker === 'User' && !lastTurn.isFinal) {
                    lastTurn.text += text; // Append text chunks
                } else {
                    newTranscript.push({ speaker: 'User', text, isFinal: false });
                }
            } else if (message.serverContent?.outputTranscription) {
                const text = message.serverContent.outputTranscription.text;
                const lastTurn = newTranscript[newTranscript.length - 1];
                if (lastTurn?.speaker === 'AI' && !lastTurn.isFinal) {
                    lastTurn.text += text; // Append text chunks
                } else {
                    newTranscript.push({ speaker: 'AI', text, isFinal: false });
                }
            }

            if (message.serverContent?.turnComplete) {
                const lastTurn = newTranscript[newTranscript.length - 1];
                if (lastTurn) {
                    lastTurn.isFinal = true;
                }
            }
            return newTranscript;
        });

        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64Audio) {
            const outputAudioContext = outputAudioContextRef.current!;
            nextStartTimeRef.current = Math.max(
                nextStartTimeRef.current,
                outputAudioContext.currentTime
            );
            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
            
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContext.destination);
            source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
            });
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            sourcesRef.current.add(source);
        }

        if (message.serverContent?.interrupted) {
            for (const source of sourcesRef.current.values()) {
                source.stop();
                sourcesRef.current.delete(source);
            }
            nextStartTimeRef.current = 0;
        }
    }, []);

    const endConversation = useCallback(() => {
        console.log("Ending conversation...");
        sessionPromiseRef.current?.then((session: any) => session.close());
        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        inputAudioContextRef.current?.close();
        outputAudioContextRef.current?.close();
        setConversationState('ended');
    }, []);

    const startConversation = async () => {
        setConversationState('connecting');
        setTranscript([]);
        nextStartTimeRef.current = 0;
        sourcesRef.current.clear();
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            // Fix: Cast window to `any` to access `webkitAudioContext` for cross-browser compatibility.
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            // Fix: Cast window to `any` to access `webkitAudioContext` for cross-browser compatibility.
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            const systemInstruction = `You are a friendly and encouraging speech coach. Your goal is to have a natural conversation with the user to help them practice their speaking skills in ${selectedLanguage}. Keep your responses concise and engaging to keep the conversation flowing. Start the conversation by asking them how their day is going in ${selectedLanguage}.`;

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: async () => {
                        console.log("Session opened.");
                        setConversationState('connected');
                        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
                        const source = inputAudioContextRef.current!.createMediaStreamSource(mediaStreamRef.current);
                        mediaStreamSourceRef.current = source;
                        
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current.then((session: any) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: handleMessage,
                    onerror: (e: ErrorEvent) => {
                        console.error('Session error:', e);
                        setConversationState('error');
                        endConversation();
                    },
                    onclose: (e: CloseEvent) => {
                        console.log('Session closed.');
                        // Don't call endConversation here to avoid state loops; onclose is the final state.
                        if (conversationState !== 'ended') {
                             setConversationState('ended');
                        }
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    systemInstruction: systemInstruction,
                },
            });
        } catch (error) {
            console.error("Failed to start conversation:", error);
            setConversationState('error');
        }
    };
    
    // Cleanup on unmount
    useEffect(() => () => endConversation(), [endConversation]);
    
    const handleDownloadTranscript = () => {
        if (transcript.length === 0) return;

        const formattedTranscript = transcript
            .map(turn => `${turn.speaker}: ${turn.text}`)
            .join('\n\n');

        const blob = new Blob([formattedTranscript], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `live-practice-transcript-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const getStatusText = () => {
        switch (conversationState) {
            case 'connecting': return 'Connecting...';
            case 'connected': return <span className="flex items-center justify-center gap-2 text-violet-300"><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>Listening...</span>;
            case 'ended': return 'Conversation Ended';
            case 'error': return 'Connection Error';
            default: return '';
        }
    };

    const renderActionButtons = () => {
        switch (conversationState) {
            case 'idle':
                return (
                    <button
                        onClick={startConversation}
                        className="flex items-center justify-center gap-3 w-56 h-16 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-full text-lg font-bold transition-all duration-300 shadow-lg shadow-violet-900/40 hover:shadow-violet-900/60 transform hover:-translate-y-1"
                    >
                        <MicrophoneIcon className="w-6 h-6" />
                        Start Speaking
                    </button>
                );
            case 'connecting':
                return (
                     <button
                        disabled
                        className="flex items-center justify-center gap-3 w-56 h-16 bg-slate-700/50 rounded-full text-lg font-bold cursor-not-allowed text-slate-400"
                    >
                        <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                        Connecting...
                    </button>
                );
            case 'connected':
                return (
                    <button
                        onClick={endConversation}
                        className="flex items-center justify-center gap-3 w-56 h-16 bg-red-600 hover:bg-red-500 rounded-full text-lg font-bold transition-all duration-200 shadow-lg shadow-red-900/40 hover:shadow-red-900/60"
                    >
                        <StopCircleIcon className="w-6 h-6" />
                        End Session
                    </button>
                );
            case 'ended':
            case 'error':
                 return (
                    <div className="flex items-center gap-4">
                        <button
                            onClick={startConversation}
                            className="flex items-center justify-center gap-3 px-8 h-14 bg-indigo-600 hover:bg-indigo-500 rounded-full text-lg font-bold transition-all duration-300 shadow-lg shadow-indigo-900/40"
                        >
                            <MicrophoneIcon className="w-5 h-5" />
                            Practice Again
                        </button>
                        {transcript.length > 0 && (
                             <button
                                onClick={handleDownloadTranscript}
                                className="flex items-center justify-center gap-3 px-6 h-14 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-lg font-medium text-slate-300 transition-colors"
                            >
                                <DownloadIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                 );
            default:
                return null;
        }
    }


    return (
        <div className="w-full max-w-3xl flex flex-col items-center space-y-6 animate-in zoom-in-95 duration-300">
            
            <div className="w-full flex justify-between items-center gap-4">
                {/* Topic Suggestions Header/Card */}
                 <div className="w-full">
                    <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-4 relative overflow-hidden group">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-bold text-violet-300 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                                Today's Discussion Topics
                            </h3>
                            <button onClick={fetchTopics} className="text-slate-400 hover:text-white transition-colors" title="Refresh Topics">
                                <RefreshCwIcon className={`w-4 h-4 ${loadingTopics ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                        {loadingTopics ? (
                            <div className="space-y-2">
                                <div className="h-4 bg-slate-800 rounded w-3/4 animate-pulse"></div>
                                <div className="h-4 bg-slate-800 rounded w-1/2 animate-pulse"></div>
                                <div className="h-4 bg-slate-800 rounded w-5/6 animate-pulse"></div>
                            </div>
                        ) : (
                            <div className="flex overflow-x-auto gap-3 pb-2 custom-scrollbar snap-x">
                                {dailyTopics.map((topic, i) => (
                                    <div key={i} className="snap-center flex-shrink-0 w-64 p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:bg-slate-700/50 transition-colors cursor-default">
                                        <p className="text-sm text-slate-300 font-medium leading-snug">"{topic}"</p>
                                    </div>
                                ))}
                            </div>
                        )}
                         <p className="text-[10px] text-slate-500 mt-2 text-right italic">Topics generated daily based on current events & non-technical subjects.</p>
                    </div>
                </div>
            </div>

            {/* Language Selector */}
            <div className="w-full flex justify-end">
                <div className="relative inline-block w-48">
                    <select
                        id="language-select"
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        disabled={conversationState !== 'idle' && conversationState !== 'ended' && conversationState !== 'error'}
                        className="w-full appearance-none bg-slate-800 border border-slate-700 hover:border-violet-500/50 rounded-xl px-4 py-2 pr-8 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        <option value="English">English</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Gujarati">Gujarati</option>
                        <option value="Spanish">Spanish</option>
                        <option value="French">French</option>
                        <option value="German">German</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
            </div>

            <div className="w-full h-[500px] bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-3xl p-6 flex flex-col relative shadow-2xl">
                <div className="flex-grow overflow-y-auto pr-3 space-y-6 custom-scrollbar">
                    {transcript.map((turn, i) => (
                        <div key={i} className={`flex items-start gap-4 ${turn.speaker === 'User' ? 'justify-end' : ''}`}>
                            {turn.speaker === 'AI' && (
                                <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center flex-shrink-0 border border-slate-600">
                                    <RobotIcon className="w-6 h-6 text-violet-400" />
                                </div>
                            )}
                             <div className={`
                                max-w-sm sm:max-w-md rounded-2xl px-5 py-3 shadow-md
                                ${turn.speaker === 'User' 
                                    ? 'bg-indigo-600 text-white rounded-br-none' 
                                    : 'bg-slate-800 text-slate-200 rounded-bl-none'}
                             `}>
                                <p className="leading-relaxed">{turn.text}</p>
                            </div>
                            {turn.speaker === 'User' && (
                                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 border border-indigo-500/30">
                                    <UserIcon className="w-6 h-6 text-indigo-300" />
                                </div>
                            )}
                        </div>
                    ))}
                     <div ref={transcriptEndRef} />
                </div>
                 {transcript.length === 0 && conversationState === 'idle' && (
                     <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center text-slate-500 w-full px-8">
                        <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700/50">
                             <MicrophoneIcon className="w-10 h-10 text-slate-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-300 mb-2">Start Practice Session</h3>
                        <p>Have a natural conversation with AI to improve your fluency.</p>
                    </div>
                )}
                <div className="h-10 pt-4 text-center text-sm font-medium text-slate-400 border-t border-slate-800 mt-2">{getStatusText()}</div>
            </div>

            <div className="flex flex-col items-center pt-2">
                {renderActionButtons()}
            </div>
        </div>
    );
};
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAI_Blob } from '@google/genai';
import { MicrophoneIcon, StopCircleIcon, RobotIcon, UserIcon, DownloadIcon } from './icons';

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

    const handleMessage = useCallback(async (message: LiveServerMessage) => {
        setTranscript(prev => {
            let newTranscript = [...prev];
            if (message.serverContent?.inputTranscription) {
                const text = message.serverContent.inputTranscription.text;
                const isFinal = message.serverContent.inputTranscription.isFinal;
                const lastTurn = newTranscript[newTranscript.length - 1];
                if (lastTurn?.speaker === 'User' && !lastTurn.isFinal) {
                    lastTurn.text = text;
                    lastTurn.isFinal = isFinal;
                } else {
                    newTranscript.push({ speaker: 'User', text, isFinal });
                }
            } else if (message.serverContent?.outputTranscription) {
                const text = message.serverContent.outputTranscription.text;
                const lastTurn = newTranscript[newTranscript.length - 1];
                if (lastTurn?.speaker === 'AI' && !lastTurn.isFinal) {
                    lastTurn.text = text;
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
            case 'connected': return <span className="flex items-center justify-center gap-2"><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>Listening...</span>;
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
                        className="flex items-center justify-center gap-3 w-56 h-16 bg-indigo-600 hover:bg-indigo-700 rounded-full text-lg font-bold transition-all duration-200 ease-in-out shadow-lg hover:shadow-indigo-500/50"
                    >
                        <MicrophoneIcon className="w-6 h-6" />
                        Start Conversation
                    </button>
                );
            case 'connecting':
                return (
                     <button
                        disabled
                        className="flex items-center justify-center gap-3 w-56 h-16 bg-gray-600 rounded-full text-lg font-bold cursor-not-allowed"
                    >
                        <MicrophoneIcon className="w-6 h-6" />
                        Connecting...
                    </button>
                );
            case 'connected':
                return (
                    <button
                        onClick={endConversation}
                        className="flex items-center justify-center gap-3 w-56 h-16 bg-red-600 hover:bg-red-700 rounded-full text-lg font-bold transition-all duration-200 ease-in-out shadow-lg hover:shadow-red-500/50"
                    >
                        <StopCircleIcon className="w-6 h-6" />
                        End Conversation
                    </button>
                );
            case 'ended':
            case 'error':
                 return (
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={startConversation}
                            className="flex items-center justify-center gap-3 px-6 h-14 bg-indigo-600 hover:bg-indigo-700 rounded-full text-lg font-bold transition-all duration-200 ease-in-out shadow-lg hover:shadow-indigo-500/50"
                        >
                            <MicrophoneIcon className="w-6 h-6" />
                            Practice Again
                        </button>
                        {transcript.length > 0 && (
                             <button
                                onClick={handleDownloadTranscript}
                                className="flex items-center justify-center gap-3 px-6 h-14 bg-gray-600 hover:bg-gray-700 rounded-full text-lg font-bold transition-colors duration-200 ease-in-out"
                            >
                                <DownloadIcon className="w-6 h-6" />
                                Download
                            </button>
                        )}
                    </div>
                 );
            default:
                return null;
        }
    }


    return (
        <div className="w-full max-w-2xl flex flex-col items-center space-y-4">
            <div className="w-full">
                <label htmlFor="language-select" className="block text-sm font-medium text-gray-400 mb-1">
                    Select Language
                </label>
                <select
                    id="language-select"
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    disabled={conversationState !== 'idle' && conversationState !== 'ended' && conversationState !== 'error'}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Gujarati">Gujarati</option>
                </select>
            </div>

            <div className="w-full h-96 bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col">
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    {transcript.map((turn, i) => (
                        <div key={i} className={`flex items-start gap-3 ${turn.speaker === 'User' ? 'justify-end' : ''}`}>
                            {turn.speaker === 'AI' && <RobotIcon className="w-8 h-8 flex-shrink-0 bg-gray-700 text-indigo-400 p-1.5 rounded-full" />}
                             <div className={`w-fit max-w-sm rounded-2xl px-4 py-2 ${turn.speaker === 'User' ? 'bg-indigo-600 rounded-br-none' : 'bg-gray-700 rounded-bl-none'}`}>
                                <p className="text-white leading-relaxed">{turn.text}</p>
                            </div>
                            {turn.speaker === 'User' && <UserIcon className="w-8 h-8 flex-shrink-0 bg-gray-700 text-gray-300 p-1.5 rounded-full" />}
                        </div>
                    ))}
                     <div ref={transcriptEndRef} />
                </div>
                 {transcript.length === 0 && conversationState === 'idle' && (
                     <div className="m-auto text-center text-gray-500">
                        <p className="text-lg">Ready to practice?</p>
                        <p>Click "Start Conversation" to begin.</p>
                    </div>
                )}
                <div className="h-8 pt-2 text-center text-gray-400">{getStatusText()}</div>
            </div>

            <div className="flex flex-col items-center space-y-4 h-16">
                {renderActionButtons()}
            </div>
        </div>
    );
};

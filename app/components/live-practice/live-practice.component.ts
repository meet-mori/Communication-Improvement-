import { Component, ElementRef, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoogleGenAI, Modality } from '@google/genai';
import { IconComponent } from '../icons.component';
import { GeminiService } from '../../services/gemini.service';

@Component({
  selector: 'app-live-practice',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="w-full max-w-3xl flex flex-col items-center space-y-6 animate-in zoom-in-95 duration-300">
        <!-- Topics -->
        <div class="w-full">
            <div class="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-4 relative overflow-hidden group">
                <div class="flex justify-between items-center mb-3">
                    <h3 class="text-sm font-bold text-violet-300 uppercase tracking-wider flex items-center gap-2">
                        <span class="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                        Today's Discussion Topics
                    </h3>
                    <button (click)="fetchTopics()" class="text-slate-400 hover:text-white transition-colors">
                        <app-icon name="refresh" [class]="loadingTopics ? 'animate-spin' : ''" size="16"></app-icon>
                    </button>
                </div>
                <div *ngIf="loadingTopics" class="space-y-2">
                    <div class="h-4 bg-slate-800 rounded w-3/4 animate-pulse"></div>
                    <div class="h-4 bg-slate-800 rounded w-1/2 animate-pulse"></div>
                </div>
                <div *ngIf="!loadingTopics" class="flex overflow-x-auto gap-3 pb-2 custom-scrollbar snap-x">
                    <div *ngFor="let topic of dailyTopics" class="snap-center flex-shrink-0 w-64 p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:bg-slate-700/50 transition-colors cursor-default">
                        <p class="text-sm text-slate-300 font-medium leading-snug">"{{ topic }}"</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Language Select -->
        <div class="w-full flex justify-end">
            <div class="relative inline-block w-48">
                <select
                    [(ngModel)]="selectedLanguage"
                    [disabled]="conversationState !== 'idle' && conversationState !== 'ended' && conversationState !== 'error'"
                    class="w-full appearance-none bg-slate-800 border border-slate-700 hover:border-violet-500/50 rounded-xl px-4 py-2 pr-8 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 transition-colors cursor-pointer"
                >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Gujarati">Gujarati</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                </select>
            </div>
        </div>

        <!-- Transcript -->
        <div class="w-full h-[500px] bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-3xl p-6 flex flex-col relative shadow-2xl">
            <div class="flex-grow overflow-y-auto pr-3 space-y-6 custom-scrollbar" #transcriptContainer>
                 <div *ngFor="let turn of transcript" class="flex items-start gap-4" [ngClass]="turn.speaker === 'User' ? 'justify-end' : ''">
                    <div *ngIf="turn.speaker === 'AI'" class="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center flex-shrink-0 border border-slate-600">
                        <app-icon name="robot" class="text-violet-400" size="24"></app-icon>
                    </div>
                    <div class="max-w-sm sm:max-w-md rounded-2xl px-5 py-3 shadow-md"
                        [ngClass]="turn.speaker === 'User' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none'">
                        <p class="leading-relaxed">{{ turn.text }}</p>
                    </div>
                    <div *ngIf="turn.speaker === 'User'" class="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 border border-indigo-500/30">
                        <app-icon name="user" class="text-indigo-300" size="24"></app-icon>
                    </div>
                 </div>
            </div>
             <div *ngIf="transcript.length === 0 && conversationState === 'idle'" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center text-slate-500 w-full px-8">
                <div class="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700/50">
                     <app-icon name="mic" class="text-slate-600" size="40"></app-icon>
                </div>
                <h3 class="text-xl font-semibold text-slate-300 mb-2">Start Practice Session</h3>
                <p>Have a natural conversation with AI to improve your fluency.</p>
            </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-col items-center pt-2">
            <button *ngIf="conversationState === 'idle'" (click)="startConversation()" class="flex items-center justify-center gap-3 w-56 h-16 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-full text-lg font-bold transition-all duration-300 shadow-lg shadow-violet-900/40 hover:shadow-violet-900/60">
                <app-icon name="mic" size="24"></app-icon> Start Speaking
            </button>

            <button *ngIf="conversationState === 'connecting'" disabled class="flex items-center justify-center gap-3 w-56 h-16 bg-slate-700/50 rounded-full text-lg font-bold cursor-not-allowed text-slate-400">
                Connecting...
            </button>

            <button *ngIf="conversationState === 'connected'" (click)="endConversation()" class="flex items-center justify-center gap-3 w-56 h-16 bg-red-600 hover:bg-red-500 rounded-full text-lg font-bold transition-all duration-200 shadow-lg shadow-red-900/40 hover:shadow-red-900/60">
                <app-icon name="stop" size="24"></app-icon> End Session
            </button>

            <div *ngIf="conversationState === 'ended' || conversationState === 'error'" class="flex items-center gap-4">
                <button (click)="startConversation()" class="flex items-center justify-center gap-3 px-8 h-14 bg-indigo-600 hover:bg-indigo-500 rounded-full text-lg font-bold transition-all duration-300 shadow-lg shadow-indigo-900/40">
                    <app-icon name="mic" size="20"></app-icon> Practice Again
                </button>
            </div>
        </div>
    </div>
  `
})
export class LivePracticeComponent implements OnInit, OnDestroy {
    conversationState: 'idle' | 'connecting' | 'connected' | 'error' | 'ended' = 'idle';
    transcript: { speaker: string, text: string, isFinal: boolean }[] = [];
    selectedLanguage = 'English';
    dailyTopics: string[] = [];
    loadingTopics = false;

    @ViewChild('transcriptContainer') transcriptContainer!: ElementRef;

    private sessionPromise: any = null;
    private inputAudioContext: AudioContext | null = null;
    private outputAudioContext: AudioContext | null = null;
    private nextStartTime = 0;
    private sources = new Set<AudioBufferSourceNode>();
    private mediaStream: MediaStream | null = null;

    constructor(private geminiService: GeminiService) {}

    ngOnInit() {
        this.fetchTopics();
    }

    ngOnDestroy() {
        this.endConversation();
    }

    async fetchTopics() {
        this.loadingTopics = true;
        this.dailyTopics = await this.geminiService.getDailyTopics();
        this.loadingTopics = false;
    }

    async startConversation() {
        this.conversationState = 'connecting';
        this.transcript = [];
        this.nextStartTime = 0;
        this.sources.clear();

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            this.sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: async () => {
                        this.conversationState = 'connected';
                        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        const source = this.inputAudioContext!.createMediaStreamSource(this.mediaStream);
                        const scriptProcessor = this.inputAudioContext!.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            this.sessionPromise.then((session: any) => {
                                session.sendRealtimeInput({ media: this.createBlob(inputData) });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(this.inputAudioContext!.destination);
                    },
                    onmessage: (msg) => this.handleMessage(msg),
                    onerror: () => { this.conversationState = 'error'; this.endConversation(); },
                    onclose: () => { if(this.conversationState !== 'ended') this.conversationState = 'ended'; }
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    systemInstruction: `You are a helpful speech coach. Speak in ${this.selectedLanguage}.`
                }
            });
        } catch (e) {
            this.conversationState = 'error';
        }
    }

    endConversation() {
        this.sessionPromise?.then((s: any) => s.close());
        this.inputAudioContext?.close();
        this.outputAudioContext?.close();
        this.mediaStream?.getTracks().forEach(t => t.stop());
        this.conversationState = 'ended';
    }

    private async handleMessage(message: any) {
        // Transcript handling
        if (message.serverContent?.inputTranscription) {
            this.updateTranscript('User', message.serverContent.inputTranscription.text);
        } else if (message.serverContent?.outputTranscription) {
            this.updateTranscript('AI', message.serverContent.outputTranscription.text);
        }

        // Audio Handling
        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64Audio && this.outputAudioContext) {
            this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
            const audioBuffer = await this.decodeAudioData(this.decode(base64Audio), this.outputAudioContext);
            const source = this.outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.outputAudioContext.destination);
            source.start(this.nextStartTime);
            this.nextStartTime += audioBuffer.duration;
            this.sources.add(source);
            source.onended = () => this.sources.delete(source);
        }
    }

    private updateTranscript(speaker: string, text: string) {
        // Simple append logic for demo
        const last = this.transcript[this.transcript.length - 1];
        if (last && last.speaker === speaker && !last.isFinal) {
            last.text += text;
        } else {
            this.transcript.push({ speaker, text, isFinal: false });
        }
        setTimeout(() => this.transcriptContainer.nativeElement.scrollTo({ top: 9999, behavior: 'smooth'}), 100);
    }

    // Helpers
    private createBlob(data: Float32Array) {
        const int16 = new Int16Array(data.length);
        for(let i=0; i<data.length; i++) int16[i] = data[i] * 32768;
        return { data: this.encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
    }
    private encode(bytes: Uint8Array) {
        let binary = '';
        for(let i=0; i<bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }
    private decode(base64: string) {
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for(let i=0; i<bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }
    private async decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
        const dataInt16 = new Int16Array(data.buffer);
        const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
        const channelData = buffer.getChannelData(0);
        for(let i=0; i<dataInt16.length; i++) channelData[i] = dataInt16[i]/32768.0;
        return buffer;
    }
}
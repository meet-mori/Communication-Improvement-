import { Component, Input, Pipe, PipeTransform } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AnalysisResult, ConversationTurn } from '../../models/types';
import { IconComponent } from '../icons.component';

@Pipe({ name: 'formatTime', standalone: true })
export class FormatTimePipe implements PipeTransform {
  transform(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

@Pipe({ name: 'linkify', standalone: true })
export class LinkifyPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}
  transform(text: string): SafeHtml {
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    const replaced = text.replace(linkRegex, '<a href="$2" target="_blank" class="text-violet-400 underline hover:text-violet-300 transition-colors">$1</a>');
    return this.sanitizer.bypassSecurityTrustHtml(replaced);
  }
}

@Component({
  selector: 'app-mistake-highlighter',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span>{{ parts[0] }}</span>
    <span *ngIf="turn.mistake" class="relative group bg-red-500/20 text-red-200 border-b border-red-500/50 cursor-pointer">
        {{ turn.mistake.incorrectPhrase }}
        <div class="absolute bottom-full left-1/2 -translate-x-1/2 w-72 mb-3 p-4 bg-slate-800 border border-slate-600 shadow-xl rounded-xl text-sm text-left opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            <p class="font-bold text-slate-200 text-xs uppercase tracking-wider mb-1">Suggestion</p>
            <p class="text-emerald-400 mb-3 font-medium text-base">"{{ turn.mistake.suggestion }}"</p>
            <p class="font-bold text-slate-200 text-xs uppercase tracking-wider mb-1">Why?</p>
            <p class="text-slate-300 leading-relaxed">{{ turn.mistake.explanation }}</p>
            <div class="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-slate-800"></div>
        </div>
    </span>
    <span>{{ parts[1] }}</span>
  `
})
export class MistakeHighlighterComponent {
    @Input() turn!: ConversationTurn;
    parts: string[] = [];

    ngOnChanges() {
        if (this.turn && this.turn.mistake) {
            this.parts = this.turn.text.split(this.turn.mistake.incorrectPhrase);
        } else if (this.turn) {
            this.parts = [this.turn.text, ''];
        }
    }
}


@Component({
  selector: 'app-results-card',
  standalone: true,
  imports: [CommonModule, IconComponent, FormatTimePipe, LinkifyPipe, MistakeHighlighterComponent],
  template: `
    <div class="w-full max-w-7xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 duration-700">
      
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h2 class="text-3xl font-bold text-white tracking-tight">{{ title }}</h2>
        <button (click)="handleExport()" class="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors text-sm font-medium text-slate-200 hover:text-white">
          <app-icon name="download" size="16"></app-icon>
          Export Report
        </button>
      </div>

       <!-- Speaking Time Distribution -->
      <div *ngIf="result.speakingTimeDistribution" class="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl shadow-xl">
            <h3 class="text-lg font-semibold text-slate-400 mb-6 uppercase tracking-wider text-xs">Speaking Time Analysis</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div class="flex flex-col gap-4">
                    <!-- User -->
                    <div class="group relative overflow-hidden flex justify-between items-center p-6 bg-slate-800/50 hover:bg-slate-800/80 rounded-2xl border border-slate-700/50 transition-all duration-300">
                        <div class="absolute inset-0 bg-gradient-to-r from-violet-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div class="flex items-center gap-4 relative z-10">
                             <div class="p-3 bg-violet-500/20 rounded-xl">
                                <app-icon name="user" class="text-violet-400" size="32"></app-icon>
                             </div>
                             <div>
                                 <p class="text-slate-400 text-xs font-bold uppercase tracking-wide">You Spoke</p>
                                 <p class="text-3xl font-bold text-white tabular-nums">{{ formatSeconds(result.speakingTimeDistribution.primarySpeaker.seconds) }}</p>
                             </div>
                        </div>
                        <div class="text-right relative z-10">
                             <span class="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-violet-400 to-indigo-400">{{ result.speakingTimeDistribution.primarySpeaker.percentage }}%</span>
                        </div>
                    </div>
                    <!-- AI -->
                    <div class="group relative overflow-hidden flex justify-between items-center p-6 bg-slate-800/50 hover:bg-slate-800/80 rounded-2xl border border-slate-700/50 transition-all duration-300">
                        <div class="flex items-center gap-4 relative z-10">
                             <div class="p-3 bg-slate-700/50 rounded-xl">
                                <app-icon name="robot" class="text-slate-400" size="32"></app-icon>
                             </div>
                             <div>
                                 <p class="text-slate-400 text-xs font-bold uppercase tracking-wide">AI / Other</p>
                                 <p class="text-3xl font-bold text-white tabular-nums">{{ formatSeconds(result.speakingTimeDistribution.others.seconds) }}</p>
                             </div>
                        </div>
                        <div class="text-right relative z-10">
                             <span class="text-4xl font-black text-slate-600">{{ result.speakingTimeDistribution.others.percentage }}%</span>
                        </div>
                    </div>
                </div>

                <!-- Bar -->
                <div class="flex flex-col justify-center h-full space-y-4">
                    <div class="flex justify-between text-sm text-slate-400 font-medium">
                        <span>Distribution</span>
                        <span>Total Audio</span>
                    </div>
                    <div class="w-full h-12 bg-slate-800 rounded-2xl overflow-hidden flex relative shadow-inner p-1.5">
                         <div 
                            class="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-xl shadow-lg flex items-center justify-center text-xs font-bold text-white transition-all duration-1000 ease-out" 
                            [style.width.%]="result.speakingTimeDistribution.primarySpeaker.percentage"
                        >
                            {{ result.speakingTimeDistribution.primarySpeaker.percentage > 15 ? 'YOU' : '' }}
                        </div>
                        <div 
                            class="h-full flex items-center justify-center text-xs font-bold text-slate-500 transition-all duration-1000 ease-out" 
                            [style.width.%]="result.speakingTimeDistribution.others.percentage"
                        >
                            {{ result.speakingTimeDistribution.others.percentage > 15 ? 'OTHER' : '' }}
                        </div>
                    </div>
                    <p class="text-xs text-slate-500 text-center">Calculated from timestamp data including pauses.</p>
                </div>
            </div>
      </div>

      <!-- Main Stats Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Dimensions -->
        <div class="bg-slate-900/40 backdrop-blur-md border border-white/5 p-6 rounded-3xl">
            <h3 class="text-lg font-semibold text-slate-400 mb-6 uppercase tracking-wider text-xs">Evaluation Metrics</h3>
            <div class="space-y-4">
                <div *ngFor="let dim of result.dimensions" class="group">
                    <div class="flex justify-between items-center mb-1">
                            <span class="text-slate-300 font-medium">{{ dim.name }}</span>
                            <span class="font-bold text-white">{{ dim.score.toFixed(1) }}/5</span>
                    </div>
                    <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            class="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-1000"
                            [style.width.%]="(dim.score / 5) * 100"
                        ></div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Scores -->
        <div class="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div class="bg-gradient-to-br from-violet-900/40 to-slate-900/40 backdrop-blur-md border border-violet-500/20 p-8 rounded-3xl flex flex-col items-center justify-center text-center relative overflow-hidden group">
                 <div class="absolute top-0 right-0 w-32 h-32 bg-violet-600/20 blur-[60px] rounded-full group-hover:bg-violet-600/30 transition-all"></div>
                <h3 class="text-lg font-semibold text-violet-200 mb-2">Overall Score</h3>
                <p class="text-7xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-violet-200">{{ result.overallScore.toFixed(2) }}</p>
                <div class="flex gap-1 mt-4">
                    <ng-container *ngFor="let star of [1,2,3,4,5]">
                        <app-icon name="star" [class]="star <= (result.overallScore | number:'1.0-0') ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700'" size="24"></app-icon>
                    </ng-container>
                </div>
            </div>
            <div class="bg-gradient-to-br from-emerald-900/40 to-slate-900/40 backdrop-blur-md border border-emerald-500/20 p-8 rounded-3xl flex flex-col items-center justify-center text-center relative overflow-hidden group">
                 <div class="absolute bottom-0 left-0 w-32 h-32 bg-emerald-600/20 blur-[60px] rounded-full group-hover:bg-emerald-600/30 transition-all"></div>
                <h3 class="text-lg font-semibold text-emerald-200 mb-2">Fluency Rate</h3>
                <p class="text-7xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-emerald-200">{{ result.fluencySpeechRatePercentage }}<span class="text-4xl align-top text-emerald-500/50">%</span></p>
                <p class="text-emerald-400/60 text-sm mt-2">Speech Smoothness</p>
            </div>
        </div>
      </div>

       <!-- Feedback -->
       <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl">
                <h3 class="text-lg font-semibold text-slate-400 mb-6 uppercase tracking-wider text-xs flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
                    Key Feedback
                </h3>
                <ul class="space-y-4">
                    <li *ngFor="let item of result.feedback; let i = index" class="flex gap-3 text-slate-300">
                             <span class="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold mt-0.5">{{ i + 1 }}</span>
                             <span class="leading-relaxed">{{ item }}</span>
                    </li>
                </ul>
            </div>
            
            <div class="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl">
                 <h3 class="text-lg font-semibold text-slate-400 mb-6 uppercase tracking-wider text-xs flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-pink-500"></span>
                    Filler Words
                </h3>
                <div class="flex flex-wrap gap-3">
                    <ng-container *ngIf="result.fillerWords.length > 0; else noFiller">
                        <div *ngFor="let fw of result.fillerWords" class="bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl flex items-center gap-2 text-sm">
                            <span class="text-slate-300">{{ fw.word }}</span>
                            <span class="bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded-md font-bold text-xs">{{ fw.count }}</span>
                        </div>
                    </ng-container>
                    <ng-template #noFiller>
                        <p class="text-slate-500 italic">Great job! No significant filler words detected.</p>
                    </ng-template>
                </div>
            </div>
       </div>

      <!-- Personalized Plan -->
      <div *ngIf="result.personalizedSuggestions" class="bg-gradient-to-r from-violet-900/20 to-indigo-900/20 border border-violet-500/20 p-8 rounded-3xl relative overflow-hidden">
            <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-3 relative z-10">
                <span class="bg-violet-600 text-white p-1.5 rounded-lg">
                    <app-icon name="check" size="20"></app-icon>
                </span>
                Recommended Focus Area
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
                <div class="md:col-span-1 bg-slate-900/60 backdrop-blur-sm p-6 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center">
                    <p class="text-xs font-bold text-violet-300 uppercase tracking-widest mb-2">Priority</p>
                    <p class="text-2xl font-black text-white">{{ result.personalizedSuggestions.areaForFocus }}</p>
                </div>
                <div class="md:col-span-3">
                    <ul class="space-y-4">
                        <li *ngFor="let suggestion of result.personalizedSuggestions.suggestions" class="flex gap-4 items-start text-slate-300">
                            <div class="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0"></div>
                            <span [innerHTML]="suggestion | linkify"></span>
                        </li>
                    </ul>
                </div>
            </div>
      </div>

      <!-- Transcript -->
      <div class="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl">
        <h3 class="text-lg font-semibold text-slate-400 mb-6 uppercase tracking-wider text-xs">Conversation Transcript</h3>
        <div class="max-h-[600px] overflow-y-auto pr-4 space-y-6 custom-scrollbar">
            <ng-container *ngFor="let turn of result.conversation">
                <div class="flex items-end gap-3" [ngClass]="turn.speaker === result.primarySpeakerLabel ? 'justify-end' : 'justify-start'">
                    <div *ngIf="turn.speaker !== result.primarySpeakerLabel" class="flex flex-col items-center gap-1">
                        <app-icon name="robot" class="w-8 h-8 flex-shrink-0 bg-slate-700 text-violet-300 p-1.5 rounded-full"></app-icon>
                    </div>
                    <div class="relative max-w-[85%] sm:max-w-xl rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm"
                        [ngClass]="turn.speaker === result.primarySpeakerLabel 
                                ? 'bg-indigo-600 text-white rounded-br-none' 
                                : 'bg-slate-800 text-slate-200 rounded-bl-none'">
                        <p><app-mistake-highlighter [turn]="turn"></app-mistake-highlighter></p>
                        <span class="text-[10px] font-mono mt-2 block opacity-60" [ngClass]="turn.speaker === result.primarySpeakerLabel ? 'text-indigo-200 text-right' : 'text-slate-400'">
                            {{ turn.startTime | formatTime }}
                        </span>
                    </div>
                    <div *ngIf="turn.speaker === result.primarySpeakerLabel" class="flex flex-col items-center gap-1">
                        <app-icon name="user" class="w-8 h-8 flex-shrink-0 bg-indigo-500/20 text-indigo-300 p-1.5 rounded-full"></app-icon>
                    </div>
                </div>
            </ng-container>
        </div>
      </div>
    </div>
  `
})
export class ResultsCardComponent {
  @Input() result!: AnalysisResult;
  @Input() title: string = "Analysis Report";

  formatSeconds(totalSeconds: number) {
    const total = Math.round(totalSeconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  }

  handleExport() {
      const blob = new Blob([JSON.stringify(this.result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'RateMySpeak-Report.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  }
}
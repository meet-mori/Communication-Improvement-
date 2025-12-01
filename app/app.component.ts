import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileUploadComponent } from './components/file-upload/file-upload.component';
import { ResultsCardComponent } from './components/results-card/results-card.component';
import { ComparisonResultsCardComponent } from './components/comparison-results-card/comparison-results-card.component';
import { LivePracticeComponent } from './components/live-practice/live-practice.component';
import { GeminiService } from './services/gemini.service';
import { AnalysisResult, ComparisonResult } from './models/types';
import { IconComponent } from './components/icons.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FileUploadComponent, ResultsCardComponent, ComparisonResultsCardComponent, LivePracticeComponent, IconComponent],
  template: `
    <div *ngIf="showSplash" class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 text-white animate-in fade-in duration-500">
        <div class="text-8xl mb-8 animate-bounce">🎙️</div>
        <h1 class="text-2xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-400 text-center px-4 leading-tight">
          Hello welcome to the RateMySpeak
        </h1>
    </div>

    <div class="min-h-screen bg-slate-950 relative overflow-hidden flex flex-col items-center">
      <div class="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div class="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-violet-900/20 rounded-full blur-[120px]"></div>
        <div class="absolute top-[20%] -right-[10%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[100px]"></div>
        <div class="absolute -bottom-[10%] left-[20%] w-[60%] h-[40%] bg-slate-900/40 rounded-full blur-[100px]"></div>
      </div>

      <div class="w-full max-w-7xl px-4 sm:px-8 py-8 sm:py-12 flex flex-col items-center z-10">
        <header class="text-center mb-12">
            <h1 class="text-5xl sm:text-6xl font-black mb-4 tracking-tight">
                <span class="text-white">Rate</span>
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">My</span>
                <span class="text-white">Speak</span>
            </h1>
            <p class="text-lg text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
            Your personal AI speech coach. Analyze recordings, practice live, and track your improvement with precision.
            </p>
        </header>
        
        <div class="mb-12 p-1.5 bg-slate-900/80 backdrop-blur-md rounded-full border border-white/5 inline-flex shadow-xl shadow-black/20">
            <button *ngFor="let tab of tabs"
                (click)="activeTab = tab.id; handleReset()"
                [disabled]="appState === 'loading'"
                class="relative px-6 sm:px-8 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                [ngClass]="activeTab === tab.id ? 'text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'"
            >
                <div *ngIf="activeTab === tab.id" class="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full -z-10 animate-in fade-in zoom-in-90 duration-200"></div>
                {{ tab.label }}
            </button>
        </div>

        <main class="w-full flex-grow flex flex-col items-center justify-center">
            
            <!-- LOADING STATE -->
            <div *ngIf="appState === 'loading'" class="flex flex-col items-center justify-center space-y-6 text-center animate-in fade-in duration-500">
                <div class="relative">
                    <div class="w-20 h-20 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
                    <div class="absolute top-0 left-0 w-20 h-20 border-4 border-transparent border-b-fuchsia-500/50 rounded-full animate-spin [animation-duration:1.5s]"></div>
                </div>
                <p class="text-lg text-slate-300 font-medium tracking-wide animate-pulse">{{ loadingMessage }}</p>
            </div>

            <!-- ERROR STATE -->
            <div *ngIf="appState === 'error'" class="w-full max-w-lg p-8 bg-red-950/40 border border-red-500/30 backdrop-blur-sm rounded-2xl text-center shadow-2xl">
                <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 mb-4">
                    <app-icon name="warn" class="text-red-400" size="24"></app-icon>
                </div>
                <p class="text-xl font-bold text-red-400 mb-2">Analysis Failed</p>
                <p class="text-red-200/80 mb-6">{{ errorMessage }}</p>
                <button (click)="handleReset()" class="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all duration-200 font-medium">Try Again</button>
            </div>

            <!-- CONTENT -->
            <ng-container *ngIf="appState !== 'loading' && appState !== 'error'">
                <!-- Live Practice -->
                <app-live-practice *ngIf="activeTab === 'live'"></app-live-practice>

                <!-- Analyze File -->
                <ng-container *ngIf="activeTab === 'analyze'">
                    <div *ngIf="appState === 'idle'" class="w-full flex flex-col items-center animate-in zoom-in-95 duration-300">
                        <div class="text-center mb-8">
                            <h2 class="text-2xl font-semibold text-white mb-2">Upload your recording</h2>
                            <p class="text-slate-400">Get instant feedback on clarity, fluency, and more.</p>
                        </div>
                        <app-file-upload (fileSelect)="handleSingleFile($event)"></app-file-upload>
                    </div>

                    <div *ngIf="appState === 'success' && analysisResult" class="flex flex-col items-center w-full animate-in slide-in-from-bottom-4 duration-500">
                        <app-results-card [result]="analysisResult"></app-results-card>
                        <button (click)="handleReset()" class="mt-12 px-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-full transition-all duration-300 font-medium hover:shadow-lg hover:shadow-violet-500/10 flex items-center gap-2 group">
                             Analyze Another File
                        </button>
                    </div>
                </ng-container>

                <!-- Comparison Mode -->
                <div *ngIf="activeTab === 'compare'" class="w-full">
                    <ng-container *ngIf="appState === 'idle'">
                        <div class="w-full max-w-5xl space-y-10 animate-in zoom-in-95 duration-300 mx-auto">
                            <div class="text-center">
                                <h2 class="text-2xl font-semibold text-white mb-2">Track Your Progress</h2>
                                <p class="text-slate-400">Upload two recordings to see how you've improved.</p>
                            </div>
                            <div class='grid grid-cols-1 md:grid-cols-2 gap-8'>
                                <div class="p-6 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm">
                                    <h3 class='text-center text-lg font-medium mb-4 text-violet-300'>Older Audio</h3>
                                    <app-file-upload (fileSelect)="oldFile = $event" [disabled]="false"></app-file-upload>
                                    <div *ngIf="oldFile" class="mt-4 p-3 bg-violet-500/10 rounded-lg text-center border border-violet-500/20">
                                        <p class='text-violet-300 truncate text-sm font-medium'>{{ oldFile.name }}</p>
                                    </div>
                                </div>
                                <div class="p-6 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm">
                                    <h3 class='text-center text-lg font-medium mb-4 text-fuchsia-300'>Newer Audio</h3>
                                    <app-file-upload (fileSelect)="newFile = $event" [disabled]="false"></app-file-upload>
                                    <div *ngIf="newFile" class="mt-4 p-3 bg-fuchsia-500/10 rounded-lg text-center border border-fuchsia-500/20">
                                        <p class='text-fuchsia-300 truncate text-sm font-medium'>{{ newFile.name }}</p>
                                    </div>
                                </div>
                            </div>
                            <div class='text-center'>
                                <button 
                                    (click)="handleComparisonFiles()" 
                                    [disabled]="!oldFile || !newFile"
                                    class="px-10 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-full text-white font-bold transition-all shadow-lg shadow-violet-900/40 hover:shadow-violet-900/60 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transform hover:-translate-y-0.5"
                                >
                                    Compare Performance
                                </button>
                            </div>
                        </div>
                    </ng-container>

                    <ng-container *ngIf="appState === 'success' && comparisonResult && oldAnalysisResult && newAnalysisResult">
                        <app-comparison-results-card 
                            [comparison]="comparisonResult"
                            [oldResult]="oldAnalysisResult"
                            [newResult]="newAnalysisResult"
                            (onReset)="handleReset()">
                        </app-comparison-results-card>
                    </ng-container>
                </div>
            </ng-container>

        </main>
      </div>

      <footer class="w-full py-6 text-center text-slate-600 text-sm">
        <p>&copy; {{ currentYear }} RateMySpeak. Created by Meet Mori.</p>
      </footer>
    </div>
  `
})
export class AppComponent implements OnInit {
  showSplash = true;
  activeTab = 'analyze';
  appState: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  loadingMessage = 'Analyzing...';
  errorMessage = '';
  currentYear = new Date().getFullYear();
  
  tabs = [
      { id: 'analyze', label: 'Analyze File' },
      { id: 'live', label: 'Live Practice' },
      { id: 'compare', label: 'Track Improvement' }
  ];

  // Analysis State
  analysisResult: AnalysisResult | null = null;

  // Comparison State
  oldFile: File | null = null;
  newFile: File | null = null;
  oldAnalysisResult: AnalysisResult | null = null;
  newAnalysisResult: AnalysisResult | null = null;
  comparisonResult: ComparisonResult | null = null;

  constructor(private geminiService: GeminiService) {}

  ngOnInit() {
    setTimeout(() => this.showSplash = false, 3000);
  }

  handleReset() {
      this.appState = 'idle';
      this.analysisResult = null;
      this.errorMessage = '';
      this.oldFile = null;
      this.newFile = null;
      this.oldAnalysisResult = null;
      this.newAnalysisResult = null;
      this.comparisonResult = null;
  }

  async handleSingleFile(file: File) {
      this.appState = 'loading';
      this.loadingMessage = 'Analyzing audio...';
      try {
          this.analysisResult = await this.geminiService.analyzeAudio(file);
          this.appState = 'success';
      } catch (e: any) {
          this.errorMessage = e.message || 'Unknown error';
          this.appState = 'error';
      }
  }

  async handleComparisonFiles() {
    if (!this.oldFile || !this.newFile) return;
    this.appState = 'loading';
    this.errorMessage = '';
    this.comparisonResult = null;
    this.oldAnalysisResult = null;
    this.newAnalysisResult = null;

    try {
        this.loadingMessage = 'Analyzing older audio...';
        this.oldAnalysisResult = await this.geminiService.analyzeAudio(this.oldFile);

        this.loadingMessage = 'Analyzing newer audio...';
        this.newAnalysisResult = await this.geminiService.analyzeAudio(this.newFile);

        this.loadingMessage = 'Comparing results...';
        this.comparisonResult = await this.geminiService.generateComparisonReport(this.oldAnalysisResult, this.newAnalysisResult);
        
        this.appState = 'success';
    } catch (err: any) {
        this.errorMessage = err.message || "An unknown error occurred.";
        this.appState = 'error';
    }
  }
}
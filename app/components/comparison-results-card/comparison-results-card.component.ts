import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalysisResult, ComparisonResult } from '../../models/types';
import { ResultsCardComponent } from '../results-card/results-card.component';
import { IconComponent } from '../icons.component';

@Component({
  selector: 'app-comparison-results-card',
  standalone: true,
  imports: [CommonModule, ResultsCardComponent, IconComponent],
  template: `
    <div class="w-full max-w-7xl mx-auto space-y-8 text-white animate-in slide-in-from-bottom-8 duration-700">
         <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 class="text-3xl font-bold text-white">Improvement Report</h2>
            <button (click)="onReset.emit()" class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors text-sm font-semibold">
                Analyze Again
            </button>
        </div>
        
        <!-- Overall Progress Highlight -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-center">
            <div class="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl">
                <h3 class="text-lg font-semibold text-slate-400 mb-6 uppercase tracking-wider text-xs">Overall Score Progress</h3>
                <div class="flex items-center justify-center gap-8">
                    <div class="flex flex-col items-center">
                        <span class="text-xs font-bold text-slate-500 mb-1">BEFORE</span>
                        <p class="text-4xl font-bold text-slate-400">{{ oldResult.overallScore.toFixed(2) }}</p>
                    </div>
                    <div class="w-12 h-0.5 bg-slate-700 rounded-full"></div>
                    <div class="flex flex-col items-center">
                        <span class="text-xs font-bold text-emerald-500 mb-1">AFTER</span>
                        <p class="text-6xl font-black text-white">{{ newResult.overallScore.toFixed(2) }}</p>
                    </div>
                </div>
                <div class="mt-4 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800" [ngClass]="getScoreChangeClass(oldResult.overallScore, newResult.overallScore)">
                    <span class="font-bold text-lg">{{ (newResult.overallScore - oldResult.overallScore) >= 0 ? '+' : '' }}{{ (newResult.overallScore - oldResult.overallScore).toFixed(2) }}</span>
                    <span class="text-xs">points</span>
                </div>
            </div>
            <div class="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl">
                <h3 class="text-lg font-semibold text-slate-400 mb-6 uppercase tracking-wider text-xs">Fluency Progress</h3>
                <div class="flex items-center justify-center gap-8">
                    <div class="flex flex-col items-center">
                        <span class="text-xs font-bold text-slate-500 mb-1">BEFORE</span>
                        <p class="text-4xl font-bold text-slate-400">{{ comparison.fluencyChange.oldPercentage }}%</p>
                    </div>
                    <div class="w-12 h-0.5 bg-slate-700 rounded-full"></div>
                    <div class="flex flex-col items-center">
                        <span class="text-xs font-bold text-emerald-500 mb-1">AFTER</span>
                        <p class="text-6xl font-black text-white">{{ comparison.fluencyChange.newPercentage }}%</p>
                    </div>
                </div>
                 <div class="mt-4 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800" [ngClass]="getScoreChangeClass(comparison.fluencyChange.oldPercentage, comparison.fluencyChange.newPercentage)">
                    <span class="font-bold text-lg">{{ (comparison.fluencyChange.newPercentage - comparison.fluencyChange.oldPercentage) >= 0 ? '+' : '' }}{{ (comparison.fluencyChange.newPercentage - comparison.fluencyChange.oldPercentage).toFixed(0) }}%</span>
                    <span class="text-xs">improvement</span>
                </div>
            </div>
        </div>

        <div class="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl">
            <h3 class="text-lg font-semibold text-slate-400 mb-6 uppercase tracking-wider text-xs">Detailed Dimension Comparison</h3>
            <div class="overflow-x-auto">
                <table class="w-full min-w-[500px] text-left">
                    <thead>
                        <tr class="border-b border-slate-700">
                            <th class="p-4 text-slate-400 font-medium text-sm">Dimension</th>
                            <th class="p-4 text-center text-slate-400 font-medium text-sm">Old Score</th>
                            <th class="p-4 text-center text-slate-400 font-medium text-sm">New Score</th>
                            <th class="p-4 text-center text-slate-400 font-medium text-sm">Change</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800">
                        <tr *ngFor="let change of comparison.dimensionChanges" class="hover:bg-slate-800/30 transition-colors">
                            <td class="p-4 font-semibold text-slate-200">{{ change.name }}</td>
                            <td class="p-4 text-center text-slate-400">{{ change.oldScore.toFixed(1) }}</td>
                            <td class="p-4 text-center font-bold text-white">{{ change.newScore.toFixed(1) }}</td>
                            <td class="p-4 text-center font-bold" [ngClass]="getScoreChangeClass(change.oldScore, change.newScore)">
                                {{ (change.newScore - change.oldScore).toFixed(1) }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl">
                <h3 class="text-lg font-semibold text-emerald-400 mb-6 uppercase tracking-wider text-xs flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    What Improved
                </h3>
                <ul class="space-y-3 text-slate-300">
                    <li *ngFor="let item of comparison.improvementSummary" class="flex gap-3">
                        <app-icon name="check" size="20" class="text-emerald-500 flex-shrink-0"></app-icon>
                        <span class="text-sm leading-relaxed">{{ item }}</span>
                    </li>
                </ul>
            </div>
            <div class="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl">
                <h3 class="text-lg font-semibold text-indigo-400 mb-6 uppercase tracking-wider text-xs flex items-center gap-2">
                     <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
                    Next Focus Areas
                </h3>
                <ul class="space-y-3 text-slate-300">
                    <li *ngFor="let item of comparison.areasForNextFocus" class="flex gap-3">
                        <app-icon name="warn" size="20" class="text-indigo-500 flex-shrink-0"></app-icon>
                        <span class="text-sm leading-relaxed">{{ item }}</span>
                    </li>
                </ul>
            </div>
        </div>

        <div class="mt-16 pt-12 border-t border-slate-800">
            <h2 class="text-3xl font-bold text-center text-slate-200 mb-12">Detailed Breakdown</h2>
            <div class="grid grid-cols-1 gap-16 items-start">
                <app-results-card [result]="oldResult" title="Earlier Recording"></app-results-card>
                <div class="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
                <app-results-card [result]="newResult" title="Later Recording"></app-results-card>
            </div>
        </div>
    </div>
  `
})
export class ComparisonResultsCardComponent {
    @Input() oldResult!: AnalysisResult;
    @Input() newResult!: AnalysisResult;
    @Input() comparison!: ComparisonResult;
    @Output() onReset = new EventEmitter<void>();

    getScoreChangeClass(oldScore: number, newScore: number): string {
        if (newScore > oldScore) return 'text-emerald-400';
        if (newScore < oldScore) return 'text-red-400';
        return 'text-slate-400';
    }
}
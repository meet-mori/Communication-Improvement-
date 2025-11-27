import React from 'react';
import { AnalysisResult, ComparisonResult, ConversationTurn } from '../types';
import { DownloadIcon, RobotIcon, UserIcon } from './icons';

// Helper to generate the HTML report for export
const generateHtmlReport = (result: AnalysisResult): string => {
  const { overallScore, dimensions, feedback, fluencySpeechRatePercentage } = result;
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>RateMySpeak Analysis Report</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-900 text-white font-sans p-8">
      <div class="max-w-4xl mx-auto">
        <header class="text-center mb-10">
          <h1 class="text-4xl font-bold text-violet-400">RateMySpeak</h1>
          <p class="text-xl text-gray-400">Analysis Report</p>
        </header>
        <main>
           <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div class="bg-slate-800 rounded-lg p-8 text-center">
                <h2 class="text-lg font-semibold text-gray-400 mb-2">Overall Score</h2>
                <p class="text-7xl font-bold text-white">${overallScore.toFixed(2)}<span class="text-3xl text-gray-500">/5</span></p>
              </div>
               <div class="bg-slate-800 rounded-lg p-8 text-center">
                <h2 class="text-lg font-semibold text-gray-400 mb-2">Fluency / Speech Rate</h2>
                <p class="text-7xl font-bold text-white">${fluencySpeechRatePercentage}<span class="text-3xl text-gray-500">%</span></p>
              </div>
           </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div class="bg-slate-800 rounded-lg p-6">
              <h3 class="text-xl font-bold text-violet-400 mb-4">Dimension Analysis</h3>
              <table class="w-full text-left">
                <tbody>
                  ${dimensions.map(d => `
                    <tr class="border-b border-gray-700">
                      <td class="py-2 text-gray-300">${d.name}</td>
                      <td class="py-2 text-right font-semibold text-white">${d.score.toFixed(1)}/5</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="bg-slate-800 rounded-lg p-6">
              <h3 class="text-xl font-bold text-violet-400 mb-4">Areas for Improvement</h3>
              <ul class="list-disc list-inside space-y-2 text-gray-300">
                ${feedback.map(f => `<li>${f}</li>`).join('')}
              </ul>
            </div>
          </div>
        </main>
      </div>
    </body>
    </html>
  `;
};


const MistakeHighlighter: React.FC<{ turn: ConversationTurn }> = ({ turn }) => {
    if (!turn.mistake) return <span>{turn.text}</span>;

    const { text, mistake } = turn;
    const { incorrectPhrase, suggestion, explanation } = mistake;
    const parts = text.split(incorrectPhrase);
    
    return (
        <span>
            {parts[0]}
            <span className="relative group bg-red-500/20 text-red-200 border-b border-red-500/50 cursor-pointer">
                {incorrectPhrase}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-72 mb-3 p-4 bg-slate-800 border border-slate-600 shadow-xl rounded-xl text-sm text-left opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    <p className="font-bold text-slate-200 text-xs uppercase tracking-wider mb-1">Suggestion</p>
                    <p className="text-emerald-400 mb-3 font-medium text-base">"{suggestion}"</p>
                    <p className="font-bold text-slate-200 text-xs uppercase tracking-wider mb-1">Why?</p>
                    <p className="text-slate-300 leading-relaxed">{explanation}</p>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-slate-800"></div>
                </div>
            </span>
            {parts[1]}
        </span>
    );
};

// A component to handle rendering text with markdown links as clickable anchors.
const RenderWithLinks: React.FC<{ text: string }> = ({ text }) => {
    // Regex to find markdown links: [text](url)
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
        // Push text before the link
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }
        // Push the link
        const [fullMatch, linkText, url] = match;
        parts.push(
            <a
                key={url + match.index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 underline hover:text-violet-300 transition-colors"
            >
                {linkText}
            </a>
        );
        lastIndex = match.index + fullMatch.length;
    }

    // Push remaining text after the last link
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return <>{parts.map((part, i) => <React.Fragment key={i}>{part}</React.Fragment>)}</>;
};

const formatSeconds = (totalSeconds: number) => {
    const total = Math.round(totalSeconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

// Simple time formatter for transcript timestamps (MM:SS)
const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const ResultsCard: React.FC<{ result: AnalysisResult, title?: string }> = ({ result, title = "Analysis Report" }) => {
  const handleExport = () => {
    const htmlContent = generateHtmlReport(result);
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'RateMySpeak-Report.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const { speakingTimeDistribution } = result;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 duration-700">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h2 className="text-3xl font-bold text-white tracking-tight">{title}</h2>
        <button onClick={handleExport} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors text-sm font-medium text-slate-200 hover:text-white">
          <DownloadIcon className="w-4 h-4" />
          Export Report
        </button>
      </div>

       {/* Speaking Time Distribution - Hero Section */}
      {speakingTimeDistribution && (
        <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl shadow-xl">
            <h3 className="text-lg font-semibold text-slate-400 mb-6 uppercase tracking-wider text-xs">Speaking Time Analysis</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                 {/* Visual Summary */}
                <div className="flex flex-col gap-4">
                     {/* User Stats */}
                    <div className="group relative overflow-hidden flex justify-between items-center p-6 bg-slate-800/50 hover:bg-slate-800/80 rounded-2xl border border-slate-700/50 transition-all duration-300">
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="flex items-center gap-4 relative z-10">
                             <div className="p-3 bg-violet-500/20 rounded-xl">
                                <UserIcon className="w-8 h-8 text-violet-400"/>
                             </div>
                             <div>
                                 <p className="text-slate-400 text-xs font-bold uppercase tracking-wide">You Spoke</p>
                                 <p className="text-3xl font-bold text-white tabular-nums">{formatSeconds(speakingTimeDistribution.primarySpeaker.seconds)}</p>
                             </div>
                        </div>
                        <div className="text-right relative z-10">
                             <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-violet-400 to-indigo-400">{speakingTimeDistribution.primarySpeaker.percentage}%</span>
                        </div>
                    </div>

                    {/* AI Stats */}
                    <div className="group relative overflow-hidden flex justify-between items-center p-6 bg-slate-800/50 hover:bg-slate-800/80 rounded-2xl border border-slate-700/50 transition-all duration-300">
                        <div className="flex items-center gap-4 relative z-10">
                             <div className="p-3 bg-slate-700/50 rounded-xl">
                                <RobotIcon className="w-8 h-8 text-slate-400"/>
                             </div>
                             <div>
                                 <p className="text-slate-400 text-xs font-bold uppercase tracking-wide">AI / Other</p>
                                 <p className="text-3xl font-bold text-white tabular-nums">{formatSeconds(speakingTimeDistribution.others.seconds)}</p>
                             </div>
                        </div>
                        <div className="text-right relative z-10">
                             <span className="text-4xl font-black text-slate-600">{speakingTimeDistribution.others.percentage}%</span>
                        </div>
                    </div>
                </div>

                {/* Bar Visualization */}
                <div className="flex flex-col justify-center h-full space-y-4">
                    <div className="flex justify-between text-sm text-slate-400 font-medium">
                        <span>Distribution</span>
                        <span>Total Audio</span>
                    </div>
                    <div className="w-full h-12 bg-slate-800 rounded-2xl overflow-hidden flex relative shadow-inner p-1.5">
                         <div 
                            className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-xl shadow-lg flex items-center justify-center text-xs font-bold text-white transition-all duration-1000 ease-out" 
                            style={{ width: `${speakingTimeDistribution.primarySpeaker.percentage}%` }}
                        >
                            {speakingTimeDistribution.primarySpeaker.percentage > 15 && 'YOU'}
                        </div>
                        <div 
                            className="h-full flex items-center justify-center text-xs font-bold text-slate-500 transition-all duration-1000 ease-out" 
                            style={{ width: `${speakingTimeDistribution.others.percentage}%` }}
                        >
                            {speakingTimeDistribution.others.percentage > 15 && 'OTHER'}
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 text-center">Calculated from timestamp data including pauses.</p>
                </div>
            </div>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dimensions */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-6 rounded-3xl">
            <h3 className="text-lg font-semibold text-slate-400 mb-6 uppercase tracking-wider text-xs">Evaluation Metrics</h3>
            <div className="space-y-4">
                {result.dimensions.map(dim => (
                    <div key={dim.name} className="group">
                        <div className="flex justify-between items-center mb-1">
                             <span className="text-slate-300 font-medium">{dim.name}</span>
                             <span className="font-bold text-white">{dim.score.toFixed(1)}/5</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-1000"
                                style={{ width: `${(dim.score / 5) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
        
        {/* Scores */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-violet-900/40 to-slate-900/40 backdrop-blur-md border border-violet-500/20 p-8 rounded-3xl flex flex-col items-center justify-center text-center relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/20 blur-[60px] rounded-full group-hover:bg-violet-600/30 transition-all"></div>
                <h3 className="text-lg font-semibold text-violet-200 mb-2">Overall Score</h3>
                <p className="text-7xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-violet-200">{result.overallScore.toFixed(2)}</p>
                <div className="flex gap-1 mt-4">
                    {[1,2,3,4,5].map(star => (
                        <svg key={star} className={`w-6 h-6 ${star <= Math.round(result.overallScore) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700'}`} viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    ))}
                </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-900/40 to-slate-900/40 backdrop-blur-md border border-emerald-500/20 p-8 rounded-3xl flex flex-col items-center justify-center text-center relative overflow-hidden group">
                 <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-600/20 blur-[60px] rounded-full group-hover:bg-emerald-600/30 transition-all"></div>
                <h3 className="text-lg font-semibold text-emerald-200 mb-2">Fluency Rate</h3>
                <p className="text-7xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-emerald-200">{result.fluencySpeechRatePercentage}<span className="text-4xl align-top text-emerald-500/50">%</span></p>
                <p className="text-emerald-400/60 text-sm mt-2">Speech Smoothness</p>
            </div>
        </div>
      </div>

       {/* Detailed Feedback Grid */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl">
                <h3 className="text-lg font-semibold text-slate-400 mb-6 uppercase tracking-wider text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    Key Feedback
                </h3>
                <ul className="space-y-4">
                    {result.feedback.map((item, i) => (
                        <li key={i} className="flex gap-3 text-slate-300">
                             <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold mt-0.5">{i + 1}</span>
                             <span className="leading-relaxed">{item}</span>
                        </li>
                    ))}
                </ul>
            </div>
            
            <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl">
                 <h3 className="text-lg font-semibold text-slate-400 mb-6 uppercase tracking-wider text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                    Filler Words
                </h3>
                <div className="flex flex-wrap gap-3">
                    {result.fillerWords.length > 0 ? result.fillerWords.map(fw => (
                        <div key={fw.word} className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl flex items-center gap-2 text-sm">
                            <span className="text-slate-300">{fw.word}</span>
                            <span className="bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded-md font-bold text-xs">{fw.count}</span>
                        </div>
                    )) : <p className="text-slate-500 italic">Great job! No significant filler words detected.</p>}
                </div>
            </div>
       </div>

      {/* Personalized Coaching Plan */}
      {result.personalizedSuggestions && (
        <div className="bg-gradient-to-r from-violet-900/20 to-indigo-900/20 border border-violet-500/20 p-8 rounded-3xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-3 opacity-10">
                 <svg className="w-64 h-64 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
             </div>
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3 relative z-10">
                <span className="bg-violet-600 text-white p-1.5 rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </span>
                Recommended Focus Area
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
                <div className="md:col-span-1 bg-slate-900/60 backdrop-blur-sm p-6 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-bold text-violet-300 uppercase tracking-widest mb-2">Priority</p>
                    <p className="text-2xl font-black text-white">{result.personalizedSuggestions.areaForFocus}</p>
                </div>
                <div className="md:col-span-3">
                    <ul className="space-y-4">
                        {result.personalizedSuggestions.suggestions.map((suggestion, i) => (
                            <li key={i} className="flex gap-4 items-start text-slate-300">
                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0"></div>
                                <span><RenderWithLinks text={suggestion} /></span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
       )}

      {/* Transcript */}
      <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl">
        <h3 className="text-lg font-semibold text-slate-400 mb-6 uppercase tracking-wider text-xs">Conversation Transcript</h3>
        <div className="max-h-[600px] overflow-y-auto pr-4 space-y-6 custom-scrollbar">
            {result.conversation.map((turn, i) => {
                const isPrimarySpeaker = turn.speaker === result.primarySpeakerLabel;
                return (
                    <div key={i} className={`flex items-end gap-3 ${isPrimarySpeaker ? 'justify-end' : 'justify-start'}`}>
                        {!isPrimarySpeaker && (
                            <div className="flex flex-col items-center gap-1">
                                <RobotIcon className="w-8 h-8 flex-shrink-0 bg-slate-700 text-violet-300 p-1.5 rounded-full"/>
                            </div>
                        )}
                        <div className={`
                            relative max-w-[85%] sm:max-w-xl rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm
                            ${isPrimarySpeaker 
                                ? 'bg-indigo-600 text-white rounded-br-none' 
                                : 'bg-slate-800 text-slate-200 rounded-bl-none'}
                        `}>
                            <p><MistakeHighlighter turn={turn} /></p>
                            <span className={`text-[10px] font-mono mt-2 block opacity-60 ${isPrimarySpeaker ? 'text-indigo-200 text-right' : 'text-slate-400'}`}>
                                {formatTimestamp(turn.startTime)}
                            </span>
                        </div>
                         {isPrimarySpeaker && (
                            <div className="flex flex-col items-center gap-1">
                                <UserIcon className="w-8 h-8 flex-shrink-0 bg-indigo-500/20 text-indigo-300 p-1.5 rounded-full"/>
                            </div>
                         )}
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};

interface ComparisonResultsCardProps {
    oldResult: AnalysisResult;
    newResult: AnalysisResult;
    comparison: ComparisonResult;
    onReset: () => void;
}

export const ComparisonResultsCard: React.FC<ComparisonResultsCardProps> = ({ oldResult, newResult, comparison, onReset }) => {
    const getScoreChangeClass = (oldScore: number, newScore: number) => {
        if (newScore > oldScore) return 'text-emerald-400';
        if (newScore < oldScore) return 'text-red-400';
        return 'text-slate-400';
    };

    const overallScoreChange = newResult.overallScore - oldResult.overallScore;
    const fluencyChangeValue = comparison.fluencyChange.newPercentage - comparison.fluencyChange.oldPercentage;

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 text-white animate-in slide-in-from-bottom-8 duration-700">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-3xl font-bold text-white">Improvement Report</h2>
                <button onClick={onReset} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors text-sm font-semibold">
                    Analyze Again
                </button>
            </div>
            
            {/* Overall Progress Highlight */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center">
                <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl">
                    <h3 className="text-lg font-semibold text-slate-400 mb-6 uppercase tracking-wider text-xs">Overall Score Progress</h3>
                    <div className="flex items-center justify-center gap-8">
                        <div className="flex flex-col items-center">
                            <span className="text-xs font-bold text-slate-500 mb-1">BEFORE</span>
                            <p className="text-4xl font-bold text-slate-400">{oldResult.overallScore.toFixed(2)}</p>
                        </div>
                        <div className="w-12 h-0.5 bg-slate-700 rounded-full"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs font-bold text-emerald-500 mb-1">AFTER</span>
                            <p className="text-6xl font-black text-white">{newResult.overallScore.toFixed(2)}</p>
                        </div>
                    </div>
                    <div className={`mt-4 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800 ${getScoreChangeClass(oldResult.overallScore, newResult.overallScore)}`}>
                        <span className="font-bold text-lg">{overallScoreChange >= 0 ? '+' : ''}{overallScoreChange.toFixed(2)}</span>
                        <span className="text-xs">points</span>
                    </div>
                </div>
                <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl">
                    <h3 className="text-lg font-semibold text-slate-400 mb-6 uppercase tracking-wider text-xs">Fluency Progress</h3>
                    <div className="flex items-center justify-center gap-8">
                        <div className="flex flex-col items-center">
                            <span className="text-xs font-bold text-slate-500 mb-1">BEFORE</span>
                            <p className="text-4xl font-bold text-slate-400">{comparison.fluencyChange.oldPercentage}%</p>
                        </div>
                        <div className="w-12 h-0.5 bg-slate-700 rounded-full"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs font-bold text-emerald-500 mb-1">AFTER</span>
                            <p className="text-6xl font-black text-white">{comparison.fluencyChange.newPercentage}%</p>
                        </div>
                    </div>
                     <div className={`mt-4 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800 ${getScoreChangeClass(comparison.fluencyChange.oldPercentage, comparison.fluencyChange.newPercentage)}`}>
                        <span className="font-bold text-lg">{fluencyChangeValue >= 0 ? '+' : ''}{fluencyChangeValue.toFixed(0)}%</span>
                        <span className="text-xs">improvement</span>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl">
                <h3 className="text-lg font-semibold text-slate-400 mb-6 uppercase tracking-wider text-xs">Detailed Dimension Comparison</h3>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] text-left">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="p-4 text-slate-400 font-medium text-sm">Dimension</th>
                                <th className="p-4 text-center text-slate-400 font-medium text-sm">Old Score</th>
                                <th className="p-4 text-center text-slate-400 font-medium text-sm">New Score</th>
                                <th className="p-4 text-center text-slate-400 font-medium text-sm">Change</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {comparison.dimensionChanges.map(change => (
                                <tr key={change.name} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="p-4 font-semibold text-slate-200">{change.name}</td>
                                    <td className="p-4 text-center text-slate-400">{change.oldScore.toFixed(1)}</td>
                                    <td className="p-4 text-center font-bold text-white">{change.newScore.toFixed(1)}</td>
                                    <td className={`p-4 text-center font-bold ${getScoreChangeClass(change.oldScore, change.newScore)}`}>
                                        {(change.newScore - change.oldScore).toFixed(1)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl">
                    <h3 className="text-lg font-semibold text-emerald-400 mb-6 uppercase tracking-wider text-xs flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        What Improved
                    </h3>
                    <ul className="space-y-3 text-slate-300">
                        {comparison.improvementSummary.map((item, i) => (
                            <li key={i} className="flex gap-3">
                                <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                <span className="text-sm leading-relaxed">{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-3xl">
                    <h3 className="text-lg font-semibold text-indigo-400 mb-6 uppercase tracking-wider text-xs flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        Next Focus Areas
                    </h3>
                    <ul className="space-y-3 text-slate-300">
                        {comparison.areasForNextFocus.map((item, i) => (
                            <li key={i} className="flex gap-3">
                                <svg className="w-5 h-5 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                <span className="text-sm leading-relaxed">{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="mt-16 pt-12 border-t border-slate-800">
                <h2 className="text-3xl font-bold text-center text-slate-200 mb-12">Detailed Breakdown</h2>
                <div className="grid grid-cols-1 gap-16 items-start">
                    <ResultsCard result={oldResult} title="Earlier Recording" />
                    <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
                    <ResultsCard result={newResult} title="Later Recording" />
                </div>
            </div>
        </div>
    );
};
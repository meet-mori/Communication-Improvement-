import React, { useState, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { ResultsCard, ComparisonResultsCard } from './components/ResultsCard';
import { LivePractice } from './components/LivePractice';
import { AnalysisResult, ComparisonResult } from './types';
import { analyzeAudio, generateComparisonReport } from './services/geminiService';

type AppState = 'idle' | 'loading' | 'success' | 'error';
type ActiveTab = 'analyze' | 'compare' | 'live';

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);

  // CHANGED: Default tab set to 'analyze'
  const [activeTab, setActiveTab] = useState<ActiveTab>('analyze');
  const [appState, setAppState] = useState<AppState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('Analyzing... This may take a few moments.');

  // State for single analysis
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  
  // State for comparison analysis
  const [oldFile, setOldFile] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [oldAnalysisResult, setOldAnalysisResult] = useState<AnalysisResult | null>(null);
  const [newAnalysisResult, setNewAnalysisResult] = useState<AnalysisResult | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleSingleFile = async (file: File) => {
    setAppState('loading');
    setError(null);
    setAnalysisResult(null);
    setLoadingMessage('Analyzing audio for accuracy... This may take a moment.');
    try {
      const result = await analyzeAudio(file);
      setAnalysisResult(result);
      setAppState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      setAppState('error');
    }
  };
  
  const handleComparisonFiles = async () => {
    if (!oldFile || !newFile) return;
    setAppState('loading');
    setError(null);
    setComparisonResult(null);
    setOldAnalysisResult(null);
    setNewAnalysisResult(null);

    try {
        setLoadingMessage('Analyzing older audio...');
        const oldResult = await analyzeAudio(oldFile);
        setOldAnalysisResult(oldResult);

        setLoadingMessage('Analyzing newer audio...');
        const newResult = await analyzeAudio(newFile);
        setNewAnalysisResult(newResult);

        setLoadingMessage('Comparing results...');
        const comparison = await generateComparisonReport(oldResult, newResult);
        setComparisonResult(comparison);
        
        setAppState('success');
    } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
        setAppState('error');
    }
  };

  const handleReset = () => {
    setAppState('idle');
    setError(null);
    setAnalysisResult(null);
    setComparisonResult(null);
    setOldFile(null);
    setNewFile(null);
    setOldAnalysisResult(null);
    setNewAnalysisResult(null);
  };

  const renderContent = () => {
    const isLoading = appState === 'loading';

    // The LivePractice component now manages its own state and is independent of the app's loading/error/success flow.
    if (activeTab === 'live') {
        return <LivePractice />;
    }

    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center space-y-6 text-center animate-in fade-in duration-500">
            <div className="relative">
                <div className="w-20 h-20 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
                <div className="absolute top-0 left-0 w-20 h-20 border-4 border-transparent border-b-fuchsia-500/50 rounded-full animate-spin [animation-duration:1.5s]"></div>
            </div>
            <p className="text-lg text-slate-300 font-medium tracking-wide animate-pulse">{loadingMessage}</p>
        </div>
      );
    }

    if (appState === 'error') {
      return (
        <div className="w-full max-w-lg p-8 bg-red-950/40 border border-red-500/30 backdrop-blur-sm rounded-2xl text-center shadow-2xl">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 mb-4">
             <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-xl font-bold text-red-400 mb-2">Analysis Failed</p>
          <p className="text-red-200/80 mb-6">{error}</p>
          <button 
            onClick={handleReset} 
            className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all duration-200 shadow-lg shadow-red-900/20 font-medium"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (appState === 'success') {
      if (activeTab === 'analyze' && analysisResult) {
        return <div className="flex flex-col items-center w-full animate-in slide-in-from-bottom-4 duration-500">
            <ResultsCard result={analysisResult} />
            <button 
                onClick={handleReset} 
                className="mt-12 px-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-full transition-all duration-300 font-medium hover:shadow-lg hover:shadow-violet-500/10 flex items-center gap-2 group"
            >
                <svg className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.058M20.942 9h.058v-5m0 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Analyze Another File
            </button>
        </div>;
      }
      if (activeTab === 'compare' && comparisonResult && oldAnalysisResult && newAnalysisResult) {
        return <ComparisonResultsCard 
            comparison={comparisonResult}
            oldResult={oldAnalysisResult}
            newResult={newAnalysisResult}
            onReset={handleReset} 
        />;
      }
    }
    
    // Idle state
    if (activeTab === 'analyze') {
      return (
        <div className="w-full flex flex-col items-center animate-in zoom-in-95 duration-300">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold text-white mb-2">Upload your recording</h2>
                <p className="text-slate-400">Get instant feedback on clarity, fluency, and more.</p>
            </div>
            <FileUpload onFileSelect={handleSingleFile} disabled={isLoading} />
        </div>
      );
    }
    
    if (activeTab === 'compare') {
      return (
        <div className='w-full max-w-5xl space-y-10 animate-in zoom-in-95 duration-300'>
            <div className="text-center">
                <h2 className="text-2xl font-semibold text-white mb-2">Track Your Progress</h2>
                <p className="text-slate-400">Upload two recordings to see how you've improved.</p>
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
                <div className="p-6 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm">
                    <h3 className='text-center text-lg font-medium mb-4 text-violet-300'>Older Audio</h3>
                    <FileUpload onFileSelect={setOldFile} disabled={isLoading} />
                    {oldFile && <div className="mt-4 p-3 bg-violet-500/10 rounded-lg text-center border border-violet-500/20">
                         <p className='text-violet-300 truncate text-sm font-medium'>{oldFile.name}</p>
                    </div>}
                </div>
                <div className="p-6 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm">
                    <h3 className='text-center text-lg font-medium mb-4 text-fuchsia-300'>Newer Audio</h3>
                    <FileUpload onFileSelect={setNewFile} disabled={isLoading} />
                    {newFile && <div className="mt-4 p-3 bg-fuchsia-500/10 rounded-lg text-center border border-fuchsia-500/20">
                        <p className='text-fuchsia-300 truncate text-sm font-medium'>{newFile.name}</p>
                    </div>}
                </div>
            </div>
            <div className='text-center'>
                 <button 
                    onClick={handleComparisonFiles} 
                    disabled={!oldFile || !newFile || isLoading}
                    className="px-10 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-full text-white font-bold transition-all shadow-lg shadow-violet-900/40 hover:shadow-violet-900/60 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transform hover:-translate-y-0.5"
                >
                    Compare Performance
                </button>
            </div>
        </div>
      );
    }
  };

  if (showSplash) {
      return (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 text-white animate-in fade-in duration-500">
              <div className="text-8xl mb-8 animate-bounce">🎙️</div>
              <h1 className="text-2xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-400 text-center px-4 leading-tight">
                Hello welcome to the RateMySpeak
              </h1>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex flex-col items-center">
      {/* Background Ambience */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-violet-900/20 rounded-full blur-[120px]"></div>
        <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[100px]"></div>
        <div className="absolute -bottom-[10%] left-[20%] w-[60%] h-[40%] bg-slate-900/40 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-7xl px-4 sm:px-8 py-8 sm:py-12 flex flex-col items-center z-10">
        <header className="text-center mb-12">
            <h1 className="text-5xl sm:text-6xl font-black mb-4 tracking-tight">
                <span className="text-white">Rate</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">My</span>
                <span className="text-white">Speak</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
            Your personal AI speech coach. Analyze recordings, practice live, and track your improvement with precision.
            </p>
        </header>
        
        {/* Navigation Tabs */}
        <div className="mb-12 p-1.5 bg-slate-900/80 backdrop-blur-md rounded-full border border-white/5 inline-flex shadow-xl shadow-black/20">
            {[
                { id: 'analyze', label: 'Analyze File' },
                { id: 'live', label: 'Live Practice' },
                { id: 'compare', label: 'Track Improvement' }
            ].map((tab) => (
                <button 
                    key={tab.id}
                    onClick={() => { handleReset(); setActiveTab(tab.id as ActiveTab); }} 
                    disabled={appState === 'loading'}
                    className={`
                        relative px-6 sm:px-8 py-2.5 rounded-full text-sm font-semibold transition-all duration-300
                        ${activeTab === tab.id 
                            ? 'text-white shadow-md' 
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                >
                    {activeTab === tab.id && (
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full -z-10 animate-in fade-in zoom-in-90 duration-200"></div>
                    )}
                    {tab.label}
                </button>
            ))}
        </div>

        <main className="w-full flex-grow flex flex-col items-center justify-center">
            {renderContent()}
        </main>
      </div>

      <footer className="w-full py-6 text-center text-slate-600 text-sm">
        <p>&copy; {new Date().getFullYear()} RateMySpeak. Created by Meet Mori.</p>
      </footer>
    </div>
  );
};

export default App;
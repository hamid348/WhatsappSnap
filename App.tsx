import React, { useState, useRef } from 'react';
import { extractNumbersFromImage } from './services/geminiService';
import { ParsedNumber } from './types';
import { Button } from './components/Button';
import { NumberCard } from './components/NumberCard';

const App: React.FC = () => {
  const [numbers, setNumbers] = useState<ParsedNumber[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'results'>('home');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activatePicker = async () => {
    // Standard Chrome Extension API check
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        // Send message to content script
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_PICKER' });
          window.close(); // Close popup so user can use the tool
        } catch (e) {
          setError("Could not activate picker. Refresh the page and try again.");
        }
      }
    } else {
      setError("This feature only works in the Chrome Extension environment.");
    }
  };

  const handleScanSuccess = async (imageData: string) => {
    setLoading(true);
    setError(null);
    try {
      const extracted = await extractNumbersFromImage(imageData);
      setNumbers(extracted);
      setView('results');
      
      if (extracted.length === 0) {
        setError("No phone numbers found in the image. Try a clearer image.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to scan image.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      handleScanSuccess(base64String);
    };
    reader.onerror = () => setError("Failed to read file.");
    reader.readAsDataURL(file);
  };

  const reset = () => {
    setNumbers([]);
    setError(null);
    setView('home');
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
              W
            </div>
            <h1 className="text-xl font-bold text-slate-800">WhatsSnap</h1>
          </div>
          {view === 'results' && (
            <button 
              onClick={reset}
              className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              Back
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 flex flex-col gap-6">
        
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-green-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Analyzing Image...</h2>
            <p className="text-slate-500 mt-2 text-sm">Our AI is extracting phone numbers</p>
          </div>
        ) : view === 'home' ? (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-center mb-2">
              <h2 className="text-lg font-bold text-blue-900 mb-1">Quick Tool</h2>
              <p className="text-sm text-blue-700 mb-4">Pick a number directly from the page.</p>
              <Button 
                onClick={activatePicker} 
                className="w-full shadow-md bg-blue-600 hover:bg-blue-700 border-none"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path>
                  </svg>
                }
              >
                Pick Number from Screen
              </Button>
            </div>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-50 px-2 text-slate-400">Or manually</span>
              </div>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept="image/*" 
              className="hidden" 
            />
            
            <Button 
              variant="outline" 
              onClick={triggerFileInput} 
              className="w-full bg-white"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                </svg>
              }
            >
              Upload Image
            </Button>

            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100 flex items-start gap-2">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                Found {numbers.length} Number{numbers.length !== 1 ? 's' : ''}
              </h2>
            </div>
            
            {numbers.length > 0 ? (
              <div className="flex flex-col gap-3">
                {numbers.map((num, idx) => (
                  <NumberCard key={idx} data={num} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-500">No numbers identified.</p>
                {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-4 border-t border-slate-200 text-center">
        <p className="text-xs text-slate-400">
          Powered by Gemini AI • Secure & Private
        </p>
      </footer>
    </div>
  );
};

export default App;

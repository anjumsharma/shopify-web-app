"use client";

import React, { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { UploadCloud, CheckCircle2, AlertCircle, Play, Square, Settings2, FileSpreadsheet } from 'lucide-react';

interface LogEntry {
  row: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function Home() {
  const [domain, setDomain] = useState('');
  const [token, setToken] = useState('');
  const [delay, setDelay] = useState('0.6');
  
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (message: string, type: 'success' | 'error' | 'info', row = 0) => {
    setLogs(prev => [...prev, { message, type, row }]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCsvFile(file);
    addLog(`Loaded file: ${file.name}`, 'info');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
        addLog(`Parsed ${results.data.length} rows from CSV.`, 'info');
      },
      error: (error) => {
        addLog(`Error parsing CSV: ${error.message}`, 'error');
      }
    });
  };

  const delayMs = (ms: number) => new Promise(res => setTimeout(res, ms));

  const startProcessing = async () => {
    if (!domain) return addLog('Please enter your Store Domain.', 'error');
    if (!token) return addLog('Please enter your Admin API Token.', 'error');
    if (csvData.length === 0) return addLog('Please upload a valid CSV file.', 'error');

    setIsProcessing(true);
    setIsCancelled(false);
    setLogs([]);
    setProgress({ current: 0, total: csvData.length });
    
    addLog('Starting bulk order processing...', 'info');

    const sleepTime = parseFloat(delay) * 1000 || 600;

    for (let i = 0; i < csvData.length; i++) {
      if (isCancelled) {
        addLog('Processing cancelled by user.', 'error');
        break;
      }

      const rowData = csvData[i];
      const rowNum = i + 2; // +2 because 0-index and header row

      try {
        setProgress(prev => ({ ...prev, current: i + 1 }));
        
        const response = await fetch('/api/process-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain: domain.replace(/^https?:\/\//, '').replace(/\/$/, ''), // clean domain
            token,
            rowData,
            rowNum
          })
        });

        const result = await response.json();

        if (result.success) {
          addLog(`Order ${result.orderId} created for ${rowData['Email'] || 'Unknown'}`, 'success', rowNum);
        } else {
          addLog(`Failed: ${JSON.stringify(result.error)}`, 'error', rowNum);
        }
      } catch (err: any) {
        addLog(`Connection error: ${err.message}`, 'error', rowNum);
      }

      // Respect the delay before next request to avoid rate limits
      if (i < csvData.length - 1 && !isCancelled) {
        await delayMs(sleepTime);
      }
    }

    setIsProcessing(false);
    addLog('Finished processing.', 'info');
  };

  return (
    <main className="max-w-5xl mx-auto p-6 md:p-12 space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-10">
        <div className="p-3 bg-primary/20 rounded-xl">
          <UploadCloud className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Shopify Bulk Invoicer</h1>
          <p className="text-textMuted">Securely upload CSVs to create B2B orders</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Form & Settings */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel p-6 rounded-2xl space-y-5">
            <h2 className="text-lg font-semibold text-white flex items-center">
              <Settings2 className="w-5 h-5 mr-2 text-primary" />
              Store Credentials
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textMuted mb-1">Store Domain</label>
                <input 
                  type="text" 
                  placeholder="e.g. mystore.myshopify.com"
                  className="w-full px-4 py-2 rounded-lg input-premium"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-textMuted mb-1">Admin API Token (shpat_...)</label>
                <input 
                  type="password" 
                  placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-2 rounded-lg input-premium"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-textMuted mb-1">Delay between orders (seconds)</label>
                <input 
                  type="number" 
                  step="0.1"
                  className="w-full px-4 py-2 rounded-lg input-premium"
                  value={delay}
                  onChange={(e) => setDelay(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
            </div>
          </div>

          {/* File Upload Area */}
          <div className="glass-panel p-6 rounded-2xl">
            <label className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl hover:border-primary/50 transition-colors cursor-pointer bg-surface/30">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <FileSpreadsheet className="w-8 h-8 mb-3 text-textMuted" />
                <p className="mb-2 text-sm text-textMuted">
                  <span className="font-semibold text-white">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-textMuted">CSV files only</p>
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept=".csv" 
                onChange={handleFileUpload}
                disabled={isProcessing}
              />
            </label>
            
            {csvFile && (
              <div className="mt-4 p-3 bg-surface/50 rounded-lg flex items-center justify-between">
                <span className="text-sm font-medium text-white truncate max-w-[200px]">{csvFile.name}</span>
                <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-md">{csvData.length} rows</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            {!isProcessing ? (
              <button 
                onClick={startProcessing}
                disabled={!csvData.length || !domain || !token}
                className="flex-1 btn-primary py-3 px-4 rounded-xl font-bold flex items-center justify-center disabled:opacity-50"
              >
                <Play className="w-5 h-5 mr-2" /> Start Processing
              </button>
            ) : (
              <button 
                onClick={() => setIsCancelled(true)}
                className="flex-1 bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30 py-3 px-4 rounded-xl font-bold flex items-center justify-center transition-colors"
              >
                <Square className="w-5 h-5 mr-2" /> Cancel Operation
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Live Logs */}
        <div className="lg:col-span-7 flex flex-col h-[600px] glass-panel rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border bg-surface/50 flex justify-between items-center">
            <h3 className="font-semibold text-white">Activity Log</h3>
            {progress.total > 0 && (
              <div className="text-sm text-textMuted">
                Progress: <span className="text-primary font-mono">{progress.current}</span> / {progress.total}
              </div>
            )}
          </div>
          
          {/* Progress Bar */}
          {progress.total > 0 && (
            <div className="h-1 bg-surface w-full">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          )}

          {/* Log Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm">
            {logs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-textMuted italic">
                Ready to process orders...
              </div>
            ) : (
              logs.map((log, i) => (
                <div 
                  key={i} 
                  className={`flex items-start p-2 rounded ${
                    log.type === 'error' ? 'bg-red-500/10 text-red-400' :
                    log.type === 'success' ? 'bg-green-500/10 text-green-400' :
                    'text-textMuted'
                  }`}
                >
                  {log.type === 'success' && <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />}
                  {log.type === 'error' && <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />}
                  {log.type === 'info' && <span className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-blue-400">ℹ️</span>}
                  
                  <span className="flex-1">
                    {log.row > 0 && <span className="opacity-50 mr-2">[Row {log.row}]</span>}
                    {log.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </main>
  );
}

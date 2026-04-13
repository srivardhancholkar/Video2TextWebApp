import React, { useState, useRef } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState('ready');
  const [progress, setProgress] = useState(0);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState('');
  const [fileInfo, setFileInfo] = useState(null);
  const [sourceDir, setSourceDir] = useState('');
  const fileInputRef = useRef(null);
  const dragAreaRef = useRef(null);

  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

  const handleFileSelect = (selectedFile) => {
    if (selectedFile && selectedFile.name.toLowerCase().endsWith('.mp4')) {
      setFile(selectedFile);
      setError('');
      setTranscription('');
      setStatus('ready');
    } else {
      setError('Please select a valid MP4 file');
      setFile(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    dragAreaRef.current?.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');
  };

  const handleDragLeave = () => {
    dragAreaRef.current?.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dragAreaRef.current?.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50');
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleSelectFolderClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadAndProcess = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    try {
      setStatus('uploading');
      setError('');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceDir', sourceDir);

      const uploadResponse = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const newJobId = uploadResponse.data.jobId;
      setJobId(newJobId);
      setStatus('processing');
      setProgress(10);

      await axios.post(`${API_BASE}/process/${newJobId}`);
      await pollForCompletion(newJobId, file);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Upload failed');
      setStatus('error');
    }
  };

  const pollForCompletion = async (jId, uploadedFile) => {
    const maxAttempts = 1800;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const statusResponse = await axios.get(`${API_BASE}/status/${jId}`);
        const jobStatus = statusResponse.data.status;
        setProgress(statusResponse.data.progress || progress);

        if (jobStatus === 'completed') {
          const resultResponse = await axios.get(`${API_BASE}/result/${jId}`);
          setTranscription(resultResponse.data.transcription);
          setStatus('completed');

          if (resultResponse.data.files) {
            setFileInfo({
              name: resultResponse.data.originalName,
              textFile: resultResponse.data.files.text,
              subtitleFile: resultResponse.data.files.subtitle
            });
          }
          return;
        }

        if (jobStatus === 'error') {
          setError(statusResponse.data.error || 'Processing failed');
          setStatus('error');
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      } catch (err) {
        console.error('Poll error:', err);
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    }

    setError('Processing timeout - job took too long');
    setStatus('error');
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(transcription).then(() => {
      alert('Transcription copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy to clipboard');
    });
  };

  const handleReset = () => {
    setFile(null);
    setJobId(null);
    setStatus('ready');
    setProgress(0);
    setTranscription('');
    setError('');
    setFileInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusColor = () => {
    switch(status) {
      case 'ready': return 'bg-blue-100 text-blue-800';
      case 'uploading': return 'bg-yellow-100 text-yellow-800 animate-pulse';
      case 'processing': return 'bg-yellow-100 text-yellow-800 animate-pulse';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-purple-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-16 sm:px-10">
          <div className="absolute top-0 right-0 w-72 h-72 bg-white opacity-5 rounded-full -mr-36 -mt-36"></div>
          <div className="relative z-10">
            <h1 className="text-4xl sm:text-5xl font-bold mb-3 tracking-tight">
              Video to Text
            </h1>
            <p className="text-lg text-blue-100">
              Convert MP4 videos to transcriptions and subtitles locally
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-8 py-12 sm:px-10 space-y-8">
          {/* Upload Section */}
          <div className="space-y-6">
            {/* Drag & Drop Area */}
            <div
              ref={dragAreaRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="relative border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 bg-gradient-to-br from-blue-50 to-purple-50 hover:border-blue-500 hover:bg-blue-50 hover:shadow-lg"
            >
              <div className="pointer-events-none">
                <div className="text-6xl mb-4 animate-bounce-slow">📁</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Drag & Drop Your MP4 File
                </h2>
                <p className="text-gray-600 mb-4">or</p>

                <button
                  onClick={handleSelectFolderClick}
                  type="button"
                  className="pointer-events-auto inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl hover:from-blue-700 hover:to-blue-800 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 active:translate-y-0"
                >
                  📂 Select Folder
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  webkitdirectory
                  mozdirectory
                  onChange={(e) => {
                    const mp4Files = Array.from(e.target.files).filter(f =>
                      f.name.toLowerCase().endsWith('.mp4')
                    );
                    if (mp4Files.length > 0) {
                      handleFileSelect(mp4Files[0]);
                      if (mp4Files[0].webkitRelativePath) {
                        const pathParts = mp4Files[0].webkitRelativePath.split('/');
                        const relativeDir = pathParts.slice(0, -1).join('/');
                        if (relativeDir) {
                          setSourceDir(relativeDir);
                        }
                      }
                    } else {
                      setError('No MP4 files found in selected directory');
                      setFile(null);
                    }
                  }}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {/* Output Directory Input */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-5 space-y-3">
              <label className="block text-sm font-bold text-gray-900">
                📁 Output Directory
              </label>
              <input
                type="text"
                placeholder="C:\temp\output"
                value={sourceDir}
                onChange={(e) => setSourceDir(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <p className="text-xs text-gray-600 italic">
                Leave empty to save in the uploads folder. Paste the full path to save in your video's directory.
              </p>
            </div>

            {/* File Preview */}
            {file && (
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-lg animate-in">
                <span className="text-2xl">🎬</span>
                <span className="font-semibold text-gray-800 break-all">{file.name}</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-500 rounded-lg">
                <span className="text-2xl">⚠️</span>
                <span className="text-red-800 font-medium">{error}</span>
              </div>
            )}
          </div>

          {/* Status Section */}
          {(status !== 'ready' || jobId) && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="font-bold text-gray-700">Status:</span>
                <span className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wide ${getStatusColor()}`}>
                  {status}
                </span>
              </div>

              {(status === 'uploading' || status === 'processing') && (
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 shadow-lg"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-bold text-gray-700 min-w-fit">{progress}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Output Section */}
          {transcription && (
            <div className="space-y-6 animate-in">
              <h2 className="text-2xl font-bold text-gray-900">
                ✨ Transcription Result
              </h2>

              {/* Files Created Info */}
              {fileInfo && (
                <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-blue-50 border border-blue-200 rounded-xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider">
                    📁 Generated Files
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center gap-4 p-4 bg-white rounded-lg border-l-4 border-blue-500 hover:shadow-md transition-shadow">
                      <span className="text-2xl">📄</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-blue-600 uppercase">Text File</p>
                        <p className="text-sm font-medium text-gray-800 break-all">
                          {fileInfo.name.replace(/\.mp4$/i, '.txt')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-white rounded-lg border-l-4 border-purple-500 hover:shadow-md transition-shadow">
                      <span className="text-2xl">🎬</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-purple-600 uppercase">Subtitle File</p>
                        <p className="text-sm font-medium text-gray-800 break-all">
                          {fileInfo.name.replace(/\.mp4$/i, '.srt')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 border-t border-blue-200 pt-3">
                    Both files have been saved to your specified directory
                  </p>
                </div>
              )}

              {/* Transcription Text */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700">Transcription Content:</label>
                <textarea
                  value={transcription}
                  readOnly
                  onClick={(e) => e.target.select()}
                  className="w-full h-64 p-4 border border-gray-300 rounded-lg font-mono text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleCopyToClipboard}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 border border-gray-300"
                >
                  📋 Copy Text
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 border border-gray-300"
                >
                  🔄 Start Over
                </button>
              </div>
            </div>
          )}

          {/* Process Button */}
          {!transcription && (
            <div className="flex justify-center">
              {file && status === 'ready' && (
                <button
                  onClick={handleUploadAndProcess}
                  disabled={status === 'uploading' || status === 'processing'}
                  className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-lg rounded-xl hover:from-blue-700 hover:to-blue-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0"
                >
                  🚀 Process Video
                </button>
              )}
              {jobId && (status === 'error' || status === 'completed') && (
                <button
                  onClick={handleReset}
                  className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold text-lg rounded-xl hover:from-blue-700 hover:to-blue-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 active:translate-y-0"
                >
                  📤 Upload Another File
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-8 py-6 text-center">
          <p className="text-sm text-gray-600 font-medium">
            🔒 Local processing • 🛡️ Privacy first • 🚫 No cloud uploads
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;

import React, { useState, useCallback, useRef } from 'react';
import { UploadCloudIcon } from './icons';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const uniqueId = useRef(`audio-upload-${Math.random().toString(36).substring(2, 9)}`).current;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [disabled, onFileSelect]);

  return (
    <div className="w-full max-w-xl">
      <label
        htmlFor={uniqueId}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
            group flex flex-col items-center justify-center w-full h-72 px-4 transition-all duration-300 
            bg-slate-900/40 backdrop-blur-sm border-2 border-dashed rounded-2xl appearance-none cursor-pointer 
            ${isDragging 
                ? 'border-violet-400 bg-violet-500/10 scale-[1.02]' 
                : 'border-slate-700 hover:border-violet-500/50 hover:bg-slate-800/60'}
            focus:outline-none
        `}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className={`
                p-4 rounded-full transition-all duration-300
                ${isDragging ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-800 text-slate-400 group-hover:bg-violet-500/20 group-hover:text-violet-300 group-hover:scale-110'}
          `}>
             <UploadCloudIcon className="w-10 h-10" />
          </div>
          <div className="text-center">
            <span className="block font-semibold text-lg text-slate-200 mb-1">
                Click to upload or drag & drop
            </span>
            <span className="block text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                Supports MP3, WAV, M4A
            </span>
          </div>
        </div>
        <input
          id={uniqueId}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />
      </label>
    </div>
  );
};
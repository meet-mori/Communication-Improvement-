import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icons.component';

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="w-full max-w-xl">
      <label
        [attr.for]="uniqueId"
        (dragenter)="onDragEnter($event)"
        (dragleave)="onDragLeave($event)"
        (dragover)="onDragOver($event)"
        (drop)="onDrop($event)"
        class="group flex flex-col items-center justify-center w-full h-72 px-4 transition-all duration-300 
            bg-slate-900/40 backdrop-blur-sm border-2 border-dashed rounded-2xl appearance-none cursor-pointer focus:outline-none"
        [ngClass]="{
            'border-violet-400 bg-violet-500/10 scale-[1.02]': isDragging,
            'border-slate-700 hover:border-violet-500/50 hover:bg-slate-800/60': !isDragging
        }"
      >
        <div class="flex flex-col items-center justify-center space-y-4">
          <div class="p-4 rounded-full transition-all duration-300"
               [ngClass]="{
                   'bg-violet-500/20 text-violet-400': isDragging,
                   'bg-slate-800 text-slate-400 group-hover:bg-violet-500/20 group-hover:text-violet-300 group-hover:scale-110': !isDragging
               }">
             <app-icon name="upload-cloud" size="40"></app-icon>
          </div>
          <div class="text-center">
            <span class="block font-semibold text-lg text-slate-200 mb-1">
                Click to upload or drag & drop
            </span>
            <span class="block text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                Supports MP3, WAV, M4A
            </span>
          </div>
        </div>
        <input
          [id]="uniqueId"
          type="file"
          accept="audio/*"
          class="hidden"
          (change)="handleFileChange($event)"
          [disabled]="disabled"
        />
      </label>
    </div>
  `
})
export class FileUploadComponent {
  @Input() disabled: boolean = false;
  @Output() fileSelect = new EventEmitter<File>();
  
  isDragging = false;
  uniqueId = `audio-upload-${Math.random().toString(36).substring(2, 9)}`;

  handleFileChange(event: any) {
    if (event.target.files && event.target.files[0]) {
      this.fileSelect.emit(event.target.files[0]);
    }
  }

  onDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!this.disabled) this.isDragging = true;
  }

  onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = false;
  }

  onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = false;
    if (this.disabled) return;
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
        this.fileSelect.emit(e.dataTransfer.files[0]);
    }
  }
}

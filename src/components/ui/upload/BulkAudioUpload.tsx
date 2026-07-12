"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FiUploadCloud, FiX, FiCheck, FiAlertCircle, FiFile } from "react-icons/fi";
import { apiClient } from "@/lib/api";

interface AudioFile {
  file: File;
  id: string;
  name: string;
  size: number;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
  itemId?: string; // letter, word, proverb, etc. ID
}

interface BulkAudioUploadProps {
  endpoint: string; // e.g., "/api/v1/admin/content/letters"
  items: Array<{ id: string; name: string }>; // Available items to match with files
  onComplete?: (results: { success: number; failed: number }) => void;
  acceptedFormats?: string[];
  maxFileSize?: number; // in MB
}

export const BulkAudioUpload: React.FC<BulkAudioUploadProps> = ({
  endpoint,
  items,
  onComplete,
  acceptedFormats = ["audio/mp3", "audio/mpeg", "audio/wav", "audio/ogg"],
  maxFileSize = 5,
}) => {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: AudioFile[] = acceptedFiles.map((file) => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      status: "pending",
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFormats.reduce((acc, format) => {
      acc[format] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxSize: maxFileSize * 1024 * 1024,
    multiple: true,
  });

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const matchFileToItem = (fileName: string): string | null => {
    // Try to match filename (without extension) to item name
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "").toLowerCase();
    
    const match = items.find((item) => {
      const itemName = item.name.toLowerCase();
      return itemName === nameWithoutExt || nameWithoutExt.includes(itemName);
    });

    return match?.id || null;
  };

  const uploadFiles = async () => {
    setIsUploading(true);
    let successCount = 0;
    let failedCount = 0;

    for (const audioFile of files) {
      if (audioFile.status !== "pending") continue;

      // Match file to item
      const itemId = matchFileToItem(audioFile.name);
      
      if (!itemId) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === audioFile.id
              ? { ...f, status: "error", error: "Could not match to item" }
              : f
          )
        );
        failedCount++;
        continue;
      }

      // Update status to uploading
      setFiles((prev) =>
        prev.map((f) =>
          f.id === audioFile.id
            ? { ...f, status: "uploading", itemId, progress: 0 }
            : f
        )
      );

      try {
        const formData = new FormData();
        formData.append("audio", audioFile.file);

        await apiClient.post(`${endpoint}/${itemId}/audio`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const progress = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            
            setFiles((prev) =>
              prev.map((f) =>
                f.id === audioFile.id ? { ...f, progress } : f
              )
            );
          },
        });

        setFiles((prev) =>
          prev.map((f) =>
            f.id === audioFile.id
              ? { ...f, status: "success", progress: 100 }
              : f
          )
        );
        successCount++;
      } catch (error: any) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === audioFile.id
              ? {
                  ...f,
                  status: "error",
                  error: error.response?.data?.detail || error.message,
                }
              : f
          )
        );
        failedCount++;
      }
    }

    setIsUploading(false);
    onComplete?.({ success: successCount, failed: failedCount });
  };

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== "success"));
  };

  const clearAll = () => {
    setFiles([]);
  };

  const statusCounts = files.reduce(
    (acc, file) => {
      acc[file.status]++;
      return acc;
    },
    { pending: 0, uploading: 0, success: 0, error: 0 }
  );

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${
            isDragActive
              ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
              : "border-gray-300 dark:border-gray-700 hover:border-brand-400"
          }
        `}
      >
        <input {...getInputProps()} />
        <FiUploadCloud className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {isDragActive
            ? "Drop files here..."
            : "Drag & drop audio files or click to browse"}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Supported formats: MP3, WAV, OGG • Max {maxFileSize}MB per file
        </p>
      </div>

      {/* Status Summary */}
      {files.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Total: {files.length}
            </span>
            {statusCounts.success > 0 && (
              <span className="text-green-600 dark:text-green-400">
                ✓ {statusCounts.success}
              </span>
            )}
            {statusCounts.error > 0 && (
              <span className="text-red-600 dark:text-red-400">
                ✗ {statusCounts.error}
              </span>
            )}
            {statusCounts.uploading > 0 && (
              <span className="text-blue-600 dark:text-blue-400">
                ↑ {statusCounts.uploading}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {statusCounts.success > 0 && (
              <button
                onClick={clearCompleted}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Clear Completed
              </button>
            )}
            <button
              onClick={clearAll}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              {/* Status Icon */}
              <div className="flex-shrink-0">
                {file.status === "pending" && (
                  <FiFile className="w-5 h-5 text-gray-400" />
                )}
                {file.status === "uploading" && (
                  <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                )}
                {file.status === "success" && (
                  <FiCheck className="w-5 h-5 text-green-500" />
                )}
                {file.status === "error" && (
                  <FiAlertCircle className="w-5 h-5 text-red-500" />
                )}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {file.name}
                  </p>
                  <span className="text-xs text-gray-500 ml-2">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>

                {/* Progress Bar */}
                {file.status === "uploading" && (
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 transition-all duration-300"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}

                {/* Matched Item */}
                {file.itemId && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Matched to: {items.find((i) => i.id === file.itemId)?.name}
                  </p>
                )}

                {/* Error Message */}
                {file.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {file.error}
                  </p>
                )}
              </div>

              {/* Remove Button */}
              {file.status === "pending" && (
                <button
                  onClick={() => removeFile(file.id)}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 transition-colors"
                  title="Remove file"
                  aria-label="Remove file"
                >
                  <FiX className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && statusCounts.pending > 0 && (
        <button
          onClick={uploadFiles}
          disabled={isUploading}
          className="w-full px-4 py-3 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isUploading
            ? `Uploading ${statusCounts.uploading} of ${files.length}...`
            : `Upload ${statusCounts.pending} File${statusCounts.pending > 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
};

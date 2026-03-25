"use client";

import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  FileJson,
  File,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  BookOpen,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface KnowledgeDoc {
  id: string;
  filename: string;
  file_type: string;
  chunks: number;
  uploaded_at: string;
}

const FILE_ICONS: Record<string, React.ReactNode> = {
  ".pdf": <FileText className="h-5 w-5 text-danger" />,
  ".csv": <FileSpreadsheet className="h-5 w-5 text-success" />,
  ".json": <FileJson className="h-5 w-5 text-accent" />,
  ".txt": <File className="h-5 w-5 text-primary" />,
  ".md": <FileText className="h-5 w-5 text-primary" />,
};

const FILE_LABELS: Record<string, string> = {
  ".pdf": "PDF",
  ".csv": "CSV",
  ".json": "JSON",
  ".txt": "Text",
  ".md": "Markdown",
};

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<"success" | "error" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    try {
      const res = await fetch("/api/ai/knowledge");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch {
      // backend not available
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadResult(null);

    let allSuccess = true;
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/ai/knowledge", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) allSuccess = false;
      } catch {
        allSuccess = false;
      }
    }

    setUploadResult(allSuccess ? "success" : "error");
    setUploading(false);
    await fetchDocuments();

    setTimeout(() => setUploadResult(null), 3000);
  };

  const handleDelete = async (docId: string) => {
    setDeletingId(docId);
    try {
      await fetch(`/api/ai/knowledge/${docId}`, { method: "DELETE" });
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch {
      // handled
    } finally {
      setDeletingId(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const totalChunks = documents.reduce((a, d) => a + d.chunks, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/ai">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground">
            Upload copywriting documents, frameworks, swipe files, and structured data.
            The AI will use them for personalized analysis and recommendations.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Documents</p>
              <p className="text-2xl font-bold">{documents.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accent/10 p-2.5">
              <FileText className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Indexed Chunks</p>
              <p className="text-2xl font-bold">{totalChunks}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-success/10 p-2.5">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Supported Formats</p>
              <p className="text-2xl font-bold">PDF, CSV, TXT, MD, JSON</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Upload area */}
      <div
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-all ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-primary/[0.02]"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {uploading ? (
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        ) : uploadResult === "success" ? (
          <CheckCircle className="h-10 w-10 text-success" />
        ) : uploadResult === "error" ? (
          <AlertCircle className="h-10 w-10 text-danger" />
        ) : (
          <Upload className="h-10 w-10 text-muted-foreground" />
        )}

        <p className="mt-4 font-medium">
          {uploading
            ? "Uploading and indexing..."
            : uploadResult === "success"
              ? "File uploaded and indexed!"
              : uploadResult === "error"
                ? "Error during upload"
                : "Drag files here or click to upload"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF, TXT, Markdown, CSV, JSON
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.csv,.json"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />

        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4" />
          Select File
        </Button>
      </div>

      {/* Document list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse-soft rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : documents.length > 0 ? (
        <Card>
          <h3 className="mb-4 font-semibold">Uploaded Documents</h3>
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-secondary/30"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  {FILE_ICONS[doc.file_type] || <File className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.filename}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Badge variant="info">
                      {FILE_LABELS[doc.file_type] || doc.file_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {doc.chunks} chunk &middot;{" "}
                      {new Date(doc.uploaded_at).toLocaleDateString("en-US", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                >
                  {deletingId === doc.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-danger" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="py-8 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No documents uploaded</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload copywriting frameworks, swipe files, or CSV data to enrich AI analysis.
          </p>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { apiClient } from "@/lib/api";

interface TemplateMeta {
  filename: string;
  label: string;
  description: string;
}

interface TemplateContent {
  filename: string;
  html: string;
  sample_data: Record<string, unknown>;
}

interface PreviewResult {
  rendered: string;
}

export function EmailTemplatesContent({ showHeader = true }: { showHeader?: boolean }) {
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<TemplateContent | null>(null);
  const [editedHtml, setEditedHtml] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const flash = (type: "ok" | "err", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  useEffect(() => {
    apiClient
      .get<TemplateMeta[]>("/api/v1/admin/email/templates")
      .then((res) => setTemplates(res.data))
      .catch(() => flash("err", "Failed to load templates"))
      .finally(() => setLoading(false));
  }, []);

  const loadTemplate = useCallback(async (filename: string) => {
    setSelected(filename);
    setShowPreview(false);
    setPreviewHtml("");
    try {
      const res = await apiClient.get<TemplateContent>("/api/v1/admin/email/templates/" + filename);
      setContent(res.data);
      setEditedHtml(res.data.html);
    } catch {
      flash("err", "Failed to load template");
    }
  }, []);

  const handlePreview = async () => {
    if (!content) return;
    setPreviewing(true);
    try {
      const res = await apiClient.post<PreviewResult>(
        "/api/v1/admin/email/templates/" + content.filename + "/preview",
        { html: editedHtml, data: content.sample_data }
      );
      setPreviewHtml(res.data.rendered);
      setShowPreview(true);
    } catch {
      flash("err", "Preview render failed");
    } finally {
      setPreviewing(false);
    }
  };

  const handleSave = async () => {
    if (!content) return;
    setSaving(true);
    try {
      await apiClient.put("/api/v1/admin/email/templates/" + content.filename, { html: editedHtml });
      setContent({ ...content, html: editedHtml });
      flash("ok", "Template saved successfully");
    } catch {
      flash("err", "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {showHeader && <PageBreadCrumb pageTitle="Email Templates" />}
      {message && (
        <div
          role={message.type === "ok" ? "status" : "alert"}
          className={
            "mb-4 rounded-lg border px-4 py-3 text-sm font-medium " +
            (message.type === "ok"
              ? "border-green-200 bg-green-500/10 text-green-700 dark:border-green-900/40 dark:text-green-300"
              : "border-destructive/20 bg-destructive/10 text-destructive")
          }
        >
          {message.text}
        </div>
      )}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4 xl:col-span-3">
          <div className="rounded-xl border border-border bg-card text-card-foreground shadow-xs">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-sm font-semibold text-foreground">Templates</h3>
            </div>
            {loading ? (
              <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">Loading...</div>
            ) : (
              <ul className="divide-y divide-border">
                {templates.map((t) => (
                  <li key={t.filename}>
                    <button
                      type="button"
                      onClick={() => loadTemplate(t.filename)}
                      aria-current={selected === t.filename ? "true" : undefined}
                      className={
                        "w-full border-l-2 px-5 py-3.5 text-left transition-colors hover:bg-accent " +
                        (selected === t.filename ? "border-foreground bg-muted" : "border-transparent")
                      }
                    >
                      <p className="text-sm font-medium text-foreground">{t.label}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="col-span-12 lg:col-span-8 xl:col-span-9">
          {!selected ? (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-card p-16 text-sm text-muted-foreground">
              Select a template from the list to edit
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-mono text-base font-semibold text-foreground">{content?.filename}</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={previewing}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3.5 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    {previewing ? "Rendering..." : showPreview ? "Re-render" : "Preview"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-xs">
                <div className="border-b border-border px-5 py-2.5">
                  <span id="email-html-label" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">HTML</span>
                </div>
                <textarea
                  value={editedHtml}
                  onChange={(e) => setEditedHtml(e.target.value)}
                  aria-labelledby="email-html-label"
                  className="block w-full resize-y rounded-b-xl border-0 bg-transparent p-5 font-mono text-sm leading-relaxed text-foreground outline-none focus:ring-0"
                  rows={22}
                  spellCheck={false}
                />
              </div>
              {showPreview && previewHtml && (
                <div className="rounded-xl border border-border bg-card shadow-xs">
                  <div className="flex items-center justify-between border-b border-border px-5 py-2.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</span>
                    <button
                      type="button"
                      onClick={() => setShowPreview(false)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Hide
                    </button>
                  </div>
                  <div className="p-5">
                    {/* The email renders on white, as most mail clients show it. */}
                    <iframe
                      srcDoc={previewHtml}
                      className="w-full rounded-lg border border-border bg-white"
                      style={{ height: "600px" }}
                      title="Email Preview"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

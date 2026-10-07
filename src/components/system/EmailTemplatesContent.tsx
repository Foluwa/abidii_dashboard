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
        <div className={"mb-4 rounded-lg px-4 py-3 text-sm font-medium " + (message.type === "ok" ? "border border-green-200 bg-green-50 text-green-700" : "border border-red-200 bg-red-50 text-red-700")}>
          {message.text}
        </div>
      )}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4 xl:col-span-3">
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-gray-800">Templates</h3>
            </div>
            {loading ? (
              <div className="flex items-center justify-center p-8 text-sm text-gray-400">Loading...</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {templates.map((t) => (
                  <li key={t.filename}>
                    <button onClick={() => loadTemplate(t.filename)}
                      className={"w-full px-5 py-3.5 text-left transition-colors hover:bg-gray-50 " + (selected === t.filename ? "border-l-2 border-[#FFC837] bg-amber-50/50" : "border-l-2 border-transparent")}>
                      <p className="text-sm font-medium text-gray-900">{t.label}</p>
                      <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{t.description}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="col-span-12 lg:col-span-8 xl:col-span-9">
          {!selected ? (
            <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-16 text-sm text-gray-400">
              Select a template from the list to edit
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-800">{content?.filename}</h2>
                <div className="flex items-center gap-2">
                  <button onClick={handlePreview} disabled={previewing}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50">
                    {previewing ? "Rendering..." : showPreview ? "Re-render" : "Preview"}
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#FFC837] px-4 py-2 text-sm font-semibold text-[#1E293B] transition-colors hover:bg-[#FBBF24] disabled:opacity-50">
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 px-5 py-2.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-400">HTML</span>
                </div>
                <textarea value={editedHtml}
                  onChange={(e) => setEditedHtml(e.target.value)}
                  className="block w-full resize-y rounded-b-xl border-0 bg-transparent p-5 font-mono text-sm text-gray-800 leading-relaxed outline-none focus:ring-0"
                  rows={22} spellCheck={false} />
              </div>
              {showPreview && previewHtml && (
                <div className="rounded-xl border border-gray-200 bg-white">
                  <div className="flex items-center justify-between border-b border-gray-100 px-5 py-2.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Preview</span>
                    <button onClick={() => setShowPreview(false)} className="text-xs text-gray-400 hover:text-gray-600">Hide</button>
                  </div>
                  <div className="p-5">
                    <iframe srcDoc={previewHtml} className="w-full rounded-lg border border-gray-100" style={{ height: "600px" }} title="Email Preview" />
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

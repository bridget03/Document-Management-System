import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadDocument } from "../services/documentApi";
import api from "../services/api";
import { useQuery } from "@tanstack/react-query";
import { UploadCloud, FileUp } from "lucide-react";
import { Card } from "../components/ui/Skeleton";
import Button from "../components/ui/Button";
import { TextInput, TextArea, Select, Field } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import { VISIBILITY_OPTIONS } from "../types/correspondence";

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState("ORGANIZATION");
  const [department, setDepartment] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const nav = useNavigate();
  const { toast } = useToast();
  const { data: cats } = useQuery({
    queryKey: ["cats"],
    queryFn: () => api.get("/categories").then((r) => r.data),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast("error", "Choose a file first.");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    if (name) form.append("name", name);
    if (description) form.append("description", description);
    if (categoryId) form.append("category_id", categoryId);
    if (tags) form.append("tags", tags);
    form.append("visibility", visibility);
    if (department.trim()) form.append("department", department.trim());
    try {
      setUploading(true);
      const doc = await uploadDocument(form, setProgress);
      toast("success", "Document uploaded successfully.");
      nav(`/documents/${doc.id}`);
    } catch {
      toast("error", "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Upload document</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Add a file to your workspace with metadata.
        </p>
      </div>
      <Card className="p-5">
        <form onSubmit={submit} className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) setFile(f);
            }}
            className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors duration-150 ${
              dragOver
                ? "border-brand-600 bg-brand-50"
                : "border-gray-300 bg-gray-50"
            }`}
          >
            <UploadCloud size={28} className="mx-auto text-gray-400" />
            {file ? (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-sm font-medium text-gray-900">
                <FileUp size={15} className="text-brand-700" /> {file.name}
                <span className="font-normal text-gray-500">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm font-medium text-gray-700">
                  Drag &amp; drop file here
                </p>
                <p className="mt-0.5 text-xs text-gray-500">or</p>
              </>
            )}
            <label className="mt-2 inline-block cursor-pointer rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Browse files
              <input
                type="file"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                aria-label="Choose file"
              />
            </label>
          </div>

          <Field label="Display name (optional)">
            <TextInput
              placeholder="Leave empty to use the file name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Category">
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Select category</option>
                {(cats || []).map((c: { id: string; name: string }) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tags (comma separated)">
              <TextInput
                placeholder="hop-dong, 2026"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Description">
            <TextArea
              rows={3}
              placeholder="What is this document about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Chia sẻ">
              <Select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
              >
                {VISIBILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            {visibility === "DEPARTMENT" && (
              <Field label="Phòng ban">
                <TextInput
                  placeholder="Kế toán"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </Field>
            )}
          </div>

          {progress > 0 && uploading && (
            <div
              className="h-2 overflow-hidden rounded-full bg-gray-200"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <div className="flex justify-center gap-2 border-t border-gray-100 pt-4">
            <Button type="button" onClick={() => nav(-1)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={uploading}
              disabled={!file}
            >
              Upload
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

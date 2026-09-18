import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getNumberSettings,
  saveNumberSettings,
} from "../services/correspondenceApi";
import { useAuthStore } from "../stores/authStore";
import { Card, Skeleton } from "../components/ui/Skeleton";
import Button from "../components/ui/Button";
import { TextInput, Field } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";

interface Cfg {
  direction: string;
  current_number: number;
  number_length: number;
  prefix?: string | null;
  suffix?: string | null;
}

function preview(c: {
  current_number: number;
  number_length: number;
  prefix?: string | null;
  suffix?: string | null;
}): string {
  const num = String(c.current_number + 1).padStart(
    Math.max(1, c.number_length),
    "0",
  );
  return `${c.prefix || ""}${num}${c.suffix || ""}`;
}

export default function CorrSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const role = useAuthStore((s) => s.user?.role);
  const { data, isLoading } = useQuery<Cfg[]>({
    queryKey: ["corr-settings"],
    queryFn: getNumberSettings,
  });
  const [form, setForm] = useState<Record<string, Cfg>>({});

  useEffect(() => {
    if (data)
      setForm(Object.fromEntries(data.map((c) => [c.direction, { ...c }])));
  }, [data]);

  const save = useMutation({
    mutationFn: (direction: string) => {
      const c = form[direction];
      return saveNumberSettings(direction, {
        current_number: Number(c.current_number),
        number_length: Number(c.number_length),
        prefix: c.prefix || "",
        suffix: c.suffix || "",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corr-settings"] });
      toast("success", "Đã lưu cấu hình.");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response
        ?.data?.detail;
      toast("error", typeof msg === "string" ? msg : "Không lưu được.");
    },
  });

  const set = (dir: string, k: keyof Cfg, v: string | number) =>
    setForm((f) => ({ ...f, [dir]: { ...f[dir], [k]: v } }));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Cấu hình văn bản</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Quy tắc sinh mã số văn bản gửi đi/đến.
        </p>
      </div>
      {isLoading ? (
        <Card className="space-y-3 p-5">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </Card>
      ) : (
        (["OUTGOING", "INCOMING", "INTERNAL"] as const).map((dir) => {
          const c = form[dir];
          if (!c) return null;
          const label = dir === "OUTGOING" ? "Văn bản đi" : dir === "INCOMING" ? "Văn bản đến" : "Văn bản nội bộ";
          return (
            <Card key={dir} className="p-5">
              <h2 className="text-sm font-semibold text-gray-900">
                {label}
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Số hiện tại">
                  <TextInput
                    type="number"
                    min={0}
                    value={c.current_number}
                    onChange={(e) =>
                      set(dir, "current_number", Number(e.target.value))
                    }
                    disabled={role !== "ADMIN"}
                  />
                </Field>
                <Field label="Độ dài số">
                  <TextInput
                    type="number"
                    min={1}
                    value={c.number_length}
                    onChange={(e) =>
                      set(dir, "number_length", Number(e.target.value))
                    }
                    disabled={role !== "ADMIN"}
                  />
                </Field>
                <Field label="Tiền tố">
                  <TextInput
                    value={c.prefix || ""}
                    onChange={(e) => set(dir, "prefix", e.target.value)}
                    placeholder="CV"
                    disabled={role !== "ADMIN"}
                  />
                </Field>
                <Field label="Hậu tố">
                  <TextInput
                    value={c.suffix || ""}
                    onChange={(e) => set(dir, "suffix", e.target.value)}
                    placeholder="/2026/VICENZA"
                    disabled={role !== "ADMIN"}
                  />
                </Field>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Số tiếp theo:{" "}
                <span className="font-mono font-semibold text-gray-900">
                  {preview(c)}
                </span>
              </p>
              {role === "ADMIN" ? (
                <Button
                  className="h-10 rounded-lg bg-slate-900 text-white font-medium shadow-sm transition-all
                      duration-200
                      hover:bg-slate-700
                      hover:shadow-md
                      active:scale-[0.99]
                      disabled:cursor-not-allowed
                      disabled:opacity-60
                      my-4
                    "
                  loading={save.isPending}
                  onClick={() => save.mutate(dir)}
                >
                  Lưu cấu hình
                </Button>
              ) : (
                <p className="mt-3 text-xs text-gray-400">
                  Chỉ Administrator mới được thay đổi cấu hình.
                </p>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}

import { forwardRef, useImperativeHandle, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { listDepartments } from "../../services/departmentApi";
import type { Department } from "../../types/department";
import { joinDeptList, splitDeptList } from "../../types/correspondence";

interface Props {
  /** Chuỗi phòng ban "A; B; C". */
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export interface DepartmentMultiInputRef {
  /** Gộp tag đang gõ dở (gọi khi submit mà user quên Enter). */
  flush: () => void;
  /** Text đang gõ dở (để form cha tự gộp đồng bộ khi submit). */
  pending: () => string;
}

/** Ô nhập nhiều phòng ban: chip tag + gợi ý + chọn nhanh từ danh mục. */
const DepartmentMultiInput = forwardRef<DepartmentMultiInputRef, Props>(
  function DepartmentMultiInput(
    {
      value,
      onChange,
      placeholder = "Nhập từng phòng ban rồi Enter — VD: Kế toán",
    }: Props,
    ref,
  ) {
  const [input, setInput] = useState("");
  const { data: deptOptions } = useQuery<Department[]>({
    queryKey: ["departments-active"],
    queryFn: () => listDepartments(true),
  });

  const list = splitDeptList(value);

  const add = (raw?: string) => {
    const src = raw !== undefined ? raw : input;
    const parts = src
      .split(/[;,\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const cur = splitDeptList(value);
    const seen = new Set(cur.map((s) => s.toLowerCase()));
    const next = [...cur];
    for (const t of parts) {
      if (!seen.has(t.toLowerCase())) {
        next.push(t);
        seen.add(t.toLowerCase());
      }
    }
    onChange(joinDeptList(next));
    setInput("");
  };

  const remove = (idx: number) => {
    const cur = splitDeptList(value);
    cur.splice(idx, 1);
    onChange(joinDeptList(cur));
  };

  const added = new Set(list.map((s) => s.toLowerCase()));
  const suggestions = (deptOptions || [])
    .map((d) => d.name)
    .filter((n) => !added.has(n.toLowerCase()));

  // Gộp tag đang gõ dở khi form submit mà quên Enter.
  useImperativeHandle(ref, () => ({
    flush: () => {
      if (input.trim()) add();
    },
    pending: () => input,
  }));

  return (
    <div>
      <div className="rounded-md border border-gray-300 px-2 py-1.5 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
        {list.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {list.map((d, i) => (
              <span
                key={`${d}-${i}`}
                className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-200"
              >
                <span className="max-w-[220px] truncate" title={d}>
                  {d}
                </span>
                <button
                  type="button"
                  aria-label={`Xóa phòng ban ${d}`}
                  className="rounded-full p-0.5 hover:bg-brand-100"
                  onClick={() => remove(i)}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ";" || e.key === ",") {
                e.preventDefault();
                add();
              } else if (e.key === "Backspace" && !input && list.length > 0) {
                remove(list.length - 1);
              }
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (/[;,\n]/.test(text)) {
                e.preventDefault();
                add(text);
              }
            }}
            placeholder={placeholder}
            list="dept-multi-suggestions"
            autoComplete="off"
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={() => add()}
            disabled={!input.trim()}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-40"
          >
            Thêm
          </button>
        </div>
        <datalist id="dept-multi-suggestions">
          {suggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {suggestions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-400">Chọn nhanh:</span>
            {suggestions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => add(name)}
                title={`Thêm ${name}`}
                className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
              >
                + {name}
              </button>
            ))}
          </div>
        )}
      </div>
      {list.length > 0 && (
        <p className="mt-1 text-xs text-gray-500">
          Đã chọn {list.length} phòng ban.
        </p>
      )}
    </div>
  );
  },
);

export default DepartmentMultiInput;

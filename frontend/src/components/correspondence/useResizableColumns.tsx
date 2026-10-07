import { useCallback, useEffect, useRef, useState } from "react";

const MIN_WIDTH = 70;

/** Co giãn cột bảng bằng cách kéo viền phải tiêu đề. Cỡ cột được nhớ
 *  trong localStorage theo storageKey. Nhấp đúp vào viền để về mặc định. */
export function useResizableColumns(
  storageKey: string,
  defaults: Record<string, number>,
) {
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return { ...defaults, ...JSON.parse(raw) };
    } catch {
      /* bỏ qua cache hỏng */
    }
    return { ...defaults };
  });
  const widthsRef = useRef(widths);
  useEffect(() => {
    widthsRef.current = widths;
  }, [widths]);

  const persist = useCallback(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(widthsRef.current));
    } catch {
      /* bộ nhớ đầy / chặn storage: bỏ qua */
    }
  }, [storageKey]);

  const resetColumn = useCallback(
    (key: string) => {
      setWidths((prev) => ({ ...prev, [key]: defaultsRef.current[key] }));
      // persist sau khi state flush
      setTimeout(persist, 0);
    },
    [persist],
  );

  const onResizeStart = useCallback(
    (key: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW =
        widthsRef.current[key] ?? defaultsRef.current[key] ?? 150;
      const move = (ev: MouseEvent) => {
        const w = Math.max(MIN_WIDTH, Math.round(startW + ev.clientX - startX));
        setWidths((prev) => (prev[key] === w ? prev : { ...prev, [key]: w }));
      };
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        persist();
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    },
    [persist],
  );

  return { widths, onResizeStart, resetColumn };
}

/** Tay kéo ở viền phải ô tiêu đề (đặt trong <th className="relative ...">). */
export function ResizeHandle({
  onResizeStart,
  onReset,
}: {
  onResizeStart: (e: React.MouseEvent) => void;
  onReset: () => void;
}) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label="Co giãn cột"
      title="Kéo để co giãn cột (nhấp đúp để về mặc định)"
      onMouseDown={onResizeStart}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onReset();
      }}
      onClick={(e) => e.stopPropagation()}
      className="group/handle absolute right-0 top-0 flex h-full w-3 cursor-col-resize touch-none select-none items-stretch justify-end"
    >
      <span className="w-px bg-gray-200 transition-colors group-hover/handle:bg-brand-500" />
    </span>
  );
}

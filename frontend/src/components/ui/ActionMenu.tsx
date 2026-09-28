import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface ActionMenuProps {
  /** Nút ⋯ đã bấm — dùng để neo vị trí menu. */
  anchor: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

/**
 * Dropdown menu render qua portal ra document.body với position:fixed.
 * Không còn bị khung `overflow-x-auto` / `overflow-hidden` của bảng cắt mất,
 * tự lật lên trên khi hàng nằm sát đáy viewport.
 */
export default function ActionMenu({
  anchor,
  onClose,
  children,
  width = 176,
}: ActionMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const GAP = 6;
    const r = anchor.getBoundingClientRect();
    const mh = ref.current.offsetHeight;
    let left = r.right - width;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    let top = r.bottom + GAP;
    if (top + mh > window.innerHeight - 8) top = r.top - mh - GAP;
    top = Math.max(8, top);
    setPos({ top, left });
  }, [anchor, width, children]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    // Đóng khi cuộn bất kỳ khung nào (bảng scroll ngang/dọc) để khỏi lệch vị trí.
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  if (!anchor) return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      <div
        ref={ref}
        role="menu"
        className="fixed z-[61] rounded-lg border border-gray-200 bg-white py-1 shadow-card"
        style={{
          width,
          ...(pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }),
          visibility: pos ? "visible" : "hidden",
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

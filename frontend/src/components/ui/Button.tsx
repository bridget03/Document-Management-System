import { ButtonHTMLAttributes, forwardRef } from "react";

/**
 * Bộ button duy nhất của app — mọi nút mới đều dùng các component trong file này:
 *
 * - `Button`       nút chính (primary/secondary/ghost/destructive, sm/md, loading)
 * - `IconButton`   nút icon-only trong bảng/dòng (vd Sửa/Xóa/Preview/Download)
 * - `MenuItem`     dòng trong dropdown menu (vd menu ⋯ ở bảng)
 * - `ToolButton`   nút nhỏ trong toolbar viewer (vd PDF prev/next/zoom)
 * - `LinkButton`   nút dạng chữ (vd "Xóa bộ lọc", "Xóa" mức độ)
 * - `SegmentButton` nút tab/radio trong nhóm (vd chế độ sync, sheet Excel)
 */

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-slate-900 text-white text-sm font-medium shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900/20 active:scale-[0.98]",
  secondary:
    "bg-white text-gray-800 border border-gray-400 hover:bg-gray-50 hover:border-gray-500 shadow-xs",
  ghost:
    "bg-transparent text-gray-600 hover:bg-gray-100 border border-transparent",
  destructive:
    "bg-white text-red-600 border border-gray-400 hover:bg-red-50 shadow-xs",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "secondary",
    size = "md",
    loading = false,
    disabled,
    className = "",
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading && (
        <span
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
});

export default Button;

/* ---------------- IconButton: nút icon-only (Sửa/Xóa/Preview/Download/menu ⋯) ---------------- */

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Bắt buộc: đọc bởi screen reader + tooltip. */
  label: string;
  tone?: "default" | "danger";
  iconSize?: "sm" | "md";
}

export function IconButton({
  label,
  title,
  tone = "default",
  iconSize = "md",
  className = "",
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      title={title || label}
      aria-label={label}
      className={`rounded text-gray-500 hover:bg-gray-100 ${
        iconSize === "sm" ? "p-1" : "p-1.5"
      } ${tone === "danger" ? "hover:bg-red-50 hover:text-red-600" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------- MenuItem: một dòng trong dropdown menu ---------------- */

interface MenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "default" | "danger";
}

export function MenuItem({
  tone = "default",
  className = "",
  children,
  ...rest
}: MenuItemProps) {
  return (
    <button
      className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${
        tone === "danger"
          ? "text-red-600 hover:bg-red-50"
          : "text-gray-700 hover:bg-gray-50"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------- ToolButton: nút toolbar viewer (PDF/ảnh/sheet) ---------------- */

interface ToolButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function ToolButton({
  active = false,
  className = "",
  children,
  ...rest
}: ToolButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-sm transition-colors disabled:opacity-40 ${
        active ? "border-blue-400 bg-blue-100" : "hover:bg-gray-50"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------- LinkButton: nút dạng chữ ---------------- */

interface LinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "brand" | "muted";
  underline?: boolean;
}

export function LinkButton({
  tone = "brand",
  underline = false,
  className = "",
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <button
      className={`font-medium ${
        tone === "brand"
          ? "text-sm text-brand-700 hover:text-brand-800"
          : "text-xs text-gray-500 hover:text-gray-700"
      } ${underline ? "underline" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------- SegmentButton: tab/radio trong nhóm (mode/sheet) ---------------- */

interface SegmentButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function SegmentButton({
  active = false,
  className = "",
  children,
  ...rest
}: SegmentButtonProps) {
  return (
    <button
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-brand-50 text-brand-700"
          : "text-gray-500 hover:bg-gray-100"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, X } from "lucide-react";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { corrImport, listDocTypes } from "../../services/correspondenceApi";
import {
  EXCEL_HEADERS,
  normalizeExcelRow,
  validateRowClient,
  DIRECTION_CONFIG,
  type Direction,
  type DocType,
} from "../../types/correspondence";

interface Props {
  open: boolean;
  onClose: () => void;
  direction: Direction;
  dirLabel: string;
  onImported: () => void;
}

interface ParsedRow {
  index: number;
  data: Record<string, unknown>;
  errors: string[];
}

const MAX_ROWS = 500;

function downloadTemplate(direction: Direction) {
  const cfg = DIRECTION_CONFIG[direction];
  // Template nội bộ dùng cột "Bộ phận/người nhận" thay cho "Nơi nhận".
  const headers = EXCEL_HEADERS.map((h) =>
    h.header === "Nơi nhận" && direction === "INTERNAL"
      ? "Bộ phận/người nhận"
      : h.header,
  );
  const sample: Record<string, unknown> = {
    "Số văn bản": "CV001/2026/VICENZA",
    "Nơi nhận": direction === "INCOMING" ? undefined : cfg.sampleParty,
    "Bộ phận/người nhận":
      direction === "INTERNAL" ? cfg.sampleParty : undefined,
    "Nơi gửi": direction === "INCOMING" ? cfg.sampleParty : undefined,
    "Số lượng văn bản": 1,
    "Người ký": "Nguyễn Văn A",
    "Mức độ bảo mật": "Trung bình",
    "Ngày ký": "17/09/2026",
    "Mức độ khẩn cấp": "Thấp",
    "Ngày hiệu lực": "17/09/2026",
    "Ngày hết hiệu lực": "",
    "Bộ phận phát hành": "Hành chính",
    "Ngày phát hành": "17/09/2026",
    "Loại văn bản": "CV01",
    "Tình trạng xử lý": "Dự thảo",
    "Ghi chú": "",
    "Liên kết tệp": "",
  };
  const ws = XLSX.utils.json_to_sheet([sample], { header: headers });
  ws["!cols"] = EXCEL_HEADERS.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "VanBan");
  XLSX.writeFile(wb, DIRECTION_CONFIG[direction].templateFile);
}

export default function ExcelImportModal({
  open,
  onClose,
  direction,
  dirLabel,
  onImported,
}: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [phase, setPhase] = useState<"pick" | "preview" | "result">("pick");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    total: number;
    success: number;
    failed: number;
    errors: { row: number; errors: string[] }[];
  } | null>(null);
  const { data: types } = useQuery<DocType[]>({
    queryKey: ["corr-types-active"],
    queryFn: () => listDocTypes(true),
    enabled: open,
  });

  const reset = () => {
    setRows([]);
    setFileName("");
    setPhase("pick");
    setResult(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const resolveType = (raw: unknown): string | undefined => {
    if (raw === undefined) return undefined;
    const s = String(raw).trim();
    if (!s) return undefined;
    const list = types || [];
    const byCode = list.find((t) => t.code.toLowerCase() === s.toLowerCase());
    if (byCode) return byCode.id;
    const byName = list.find((t) => t.name.toLowerCase() === s.toLowerCase());
    return byName?.id;
  };

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    if (!/\.(xlsx|xls)$/i.test(f.name)) {
      toast("error", "Chỉ hỗ trợ file .xlsx / .xls.");
      return;
    }
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: "",
      });
      if (json.length > MAX_ROWS) {
        toast("error", `File vượt quá ${MAX_ROWS} dòng.`);
        return;
      }
      const expected = EXCEL_HEADERS.map((h) => h.header);
      const actual = Object.keys(json[0] || {});
      const missing = expected.filter((h) => !actual.includes(h));
      if (missing.length > 0) {
        toast("error", `Thiếu cột: ${missing.join(", ")}`);
        return;
      }
      const parsed: ParsedRow[] = json.map((raw, i) => {
        const data = normalizeExcelRow(raw, direction);
        const typeId = resolveType(
          (data as Record<string, unknown>).document_type,
        );
        if (typeId) data.document_type_id = typeId;
        const errors = validateRowClient(data, direction);
        if ((data as Record<string, unknown>).document_type && !typeId)
          errors.push(
            `Loại văn bản '${String((data as Record<string, unknown>).document_type)}' không tồn tại.`,
          );
        return { index: i + 1, data, errors };
      });
      setRows(parsed);
      setFileName(f.name);
      setPhase("preview");
    } catch {
      toast("error", "Không đọc được file Excel.");
    }
  };

  const validCount = rows.filter((r) => r.errors.length === 0).length;

  const confirm = async () => {
    setImporting(true);
    try {
      const payload = rows.map((r) => {
        const d = { ...r.data } as Record<string, unknown>;
        delete d.document_type;
        return d;
      });
      const res = await corrImport(DIRECTION_CONFIG[direction].api, payload);
      setResult(res);
      setPhase("result");
      onImported();
      if (res.failed === 0)
        toast("success", `Import thành công ${res.success} văn bản.`);
      else
        toast(
          "error",
          `Import xong: ${res.success} thành công, ${res.failed} thất bại.`,
        );
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response
        ?.data?.detail;
      toast("error", typeof msg === "string" ? msg : "Import thất bại.");
    } finally {
      setImporting(false);
    }
  };

  const downloadErrors = () => {
    if (!result) return;
    const errMap = new Map(
      result.errors.map((e) => [e.row, e.errors.join("; ")]),
    );
    const ws = XLSX.utils.json_to_sheet(
      rows
        .filter((r) => errMap.has(r.index))
        .map((r) => ({
          Dòng: r.index,
          "Số văn bản": String(r.data.document_number || ""),
          Lỗi: errMap.get(r.index) || "",
        })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Loi");
    XLSX.writeFile(wb, "Bao_cao_loi_import.xlsx");
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={`Nhập văn bản ${dirLabel} từ Excel`}
      wide
      footer={
        phase === "preview" ? (
          <>
            <Button onClick={close}>Hủy</Button>
            <Button
              className="rounded-lg bg-slate-900 text-white font-medium shadow-sm transition-all
                      duration-200
                      hover:bg-slate-700
                      hover:shadow-md
                      active:scale-[0.99]
                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
              variant="primary"
              loading={importing}
              disabled={validCount === 0}
              onClick={confirm}
            >
              Import {validCount} dòng hợp lệ
            </Button>
          </>
        ) : phase === "result" ? (
          <>
            {result && result.failed > 0 && (
              <Button onClick={downloadErrors}>Download error report</Button>
            )}
            <Button variant="primary" onClick={close}>
              Đóng
            </Button>
          </>
        ) : undefined
      }
    >
      {phase === "pick" && (
        <div className="space-y-3">
          <label className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center hover:border-gray-400">
            <FileSpreadsheet size={28} className="mx-auto text-gray-400" />
            <p className="mt-2 text-sm font-medium text-gray-700">
              Kéo thả file Excel vào đây hoặc chọn file
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="sr-only"
              onChange={(e) => {
                void pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <Button onClick={() => downloadTemplate(direction)}>
            <Download size={14} /> Tải file mẫu Excel
          </Button>
        </div>
      )}

      {phase === "preview" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Đã đọc: <b>{rows.length}</b> dòng · Hợp lệ:{" "}
            <b className="text-green-700">{validCount}</b> · Lỗi:{" "}
            <b className="text-red-600">{rows.length - validCount}</b>{" "}
            <span className="text-gray-400">({fileName})</span>
          </p>
          <div className="max-h-80 overflow-auto rounded-md border border-gray-200">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-gray-100">
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-3 py-2 font-medium">Dòng</th>
                  <th className="px-3 py-2 font-medium">Số văn bản</th>
                  <th className="px-3 py-2 font-medium">
                    {DIRECTION_CONFIG[direction].partyLabel.replace(" *", "")}
                  </th>
                  <th className="px-3 py-2 font-medium">Người ký</th>
                  <th className="px-3 py-2 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr
                    key={r.index}
                    className={r.errors.length > 0 ? "bg-red-50" : ""}
                  >
                    <td className="px-3 py-1.5 text-gray-500">{r.index}</td>
                    <td className="px-3 py-1.5">
                      {String(r.data.document_number || "—")}
                    </td>
                    <td className="px-3 py-1.5">
                      {String(
                        (r.data as Record<string, unknown>)[
                          DIRECTION_CONFIG[direction].partyKey
                        ] || "—",
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {String(r.data.signer || "—")}
                    </td>
                    <td className="px-3 py-1.5 text-xs">
                      {r.errors.length === 0 ? (
                        <span className="font-medium text-green-700">
                          ✓ Hợp lệ
                        </span>
                      ) : (
                        <span className="text-red-600">
                          ✕ {r.errors.join("; ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={reset}
            className="flex items-center gap-1 text-xs text-gray-500 underline"
          >
            <X size={12} /> Chọn file khác
          </button>
        </div>
      )}

      {phase === "result" && result && (
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-gray-900">Import hoàn tất</p>
          <p className="text-gray-600">
            Tổng số: {result.total} · Thành công:{" "}
            <span className="font-medium text-green-700">{result.success}</span>{" "}
            · Thất bại:{" "}
            <span className="font-medium text-red-600">{result.failed}</span>
          </p>
          {result.errors.slice(0, 10).map((e) => (
            <p key={e.row} className="text-xs text-red-600">
              Dòng {e.row}: {e.errors.join("; ")}
            </p>
          ))}
          {result.errors.length > 10 && (
            <p className="text-xs text-gray-500">
              ... và {result.errors.length - 10} lỗi khác (xem error report).
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

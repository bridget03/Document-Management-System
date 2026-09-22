import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  createDocType,
  deleteDocType,
  listDocTypes,
  updateDocType,
} from "../services/correspondenceApi";
import { Card, TableSkeleton } from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { IconButton } from "../components/ui/Button";
import { TextInput, TextArea, Select, Field } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import type { DocType } from "../types/correspondence";

interface FormState {
  id?: string;
  code: string;
  name: string;
  description: string;
  status: string;
  default_signer: string;
}

export default function DocTypes() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useQuery<DocType[]>({
    queryKey: ["corr-types"],
    queryFn: () => listDocTypes(),
  });
  const [modal, setModal] = useState<FormState | null>(null);

  const save = useMutation({
    mutationFn: () => {
      if (!modal) throw new Error("no data");
      const payload = {
        code: modal.code.trim(),
        name: modal.name.trim(),
        description: modal.description.trim() || null,
        status: modal.status,
        default_signer: modal.default_signer.trim() || null,
      };
      return modal.id
        ? updateDocType(modal.id, payload)
        : createDocType(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corr-types"] });
      setModal(null);
      toast("success", "Đã lưu loại văn bản.");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response
        ?.data?.detail;
      toast("error", typeof msg === "string" ? msg : "Không lưu được.");
    },
  });

  const toggle = useMutation({
    mutationFn: (t: DocType) =>
      updateDocType(t.id, {
        code: t.code,
        name: t.name,
        description: t.description,
        status: t.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        default_signer: t.default_signer,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corr-types"] });
      toast("success", "Đã cập nhật trạng thái.");
    },
    onError: () => toast("error", "Không cập nhật được."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDocType(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corr-types"] });
      toast("success", "Đã xóa loại văn bản.");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response
        ?.data?.detail;
      toast("error", typeof msg === "string" ? msg : "Không xóa được.");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Loại văn bản</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Quản lý danh mục loại văn bản dùng trong hệ thống.
          </p>
        </div>
        <Button variant="primary"
          onClick={() =>
            setModal({
              code: "",
              name: "",
              description: "",
              status: "ACTIVE",
              default_signer: "",
            })
          }
        >
          <Plus size={15} /> Thêm loại văn bản
        </Button>
      </div>

      {isError ? (
        <Card className="px-6 py-10 text-center">
          <p className="font-semibold text-gray-900">
            Không tải được danh sách
          </p>
          <Button size="sm" className="mt-3" onClick={() => refetch()}>
            Thử lại
          </Button>
        </Card>
      ) : isLoading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : (data || []).length === 0 ? (
        <EmptyState
          title="Chưa có loại văn bản"
          description="Tạo loại đầu tiên như Công văn, Quyết định, Thông báo..."
          actionLabel="Thêm loại văn bản"
          onAction={() =>
            setModal({
              code: "",
              name: "",
              description: "",
              status: "ACTIVE",
              default_signer: "",
            })
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Mã</th>
                <th className="px-4 py-2.5 font-medium">Tên loại</th>
                <th className="px-4 py-2.5 font-medium">Người ký mặc định</th>
                <th className="px-4 py-2.5 font-medium">Trạng thái</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data || []).map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono font-medium text-gray-900">
                    {t.code}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-gray-900">{t.name}</span>
                    {t.description && (
                      <span className="block text-xs text-gray-500">
                        {t.description}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {t.default_signer || "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => toggle.mutate(t)}
                      title="Bật/tắt sử dụng"
                    >
                      <Badge
                        tone={t.status === "ACTIVE" ? "success" : "neutral"}
                        dot
                      >
                        {t.status === "ACTIVE"
                          ? "Đang sử dụng"
                          : "Ngừng sử dụng"}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="inline-flex gap-1">
                      <IconButton
                        label={`Chỉnh sửa ${t.name}`}
                        onClick={() =>
                          setModal({
                            id: t.id,
                            code: t.code,
                            name: t.name,
                            description: t.description || "",
                            status: t.status,
                            default_signer: t.default_signer || "",
                          })
                        }
                      >
                        <Pencil size={15} />
                      </IconButton>
                      <IconButton
                        label={`Xóa ${t.name} (chỉ khi chưa dùng)`}
                        tone="danger"
                        onClick={() => remove.mutate(t.id)}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.id ? "Sửa loại văn bản" : "Thêm loại văn bản"}
        footer={
          <>
            <Button onClick={() => setModal(null)}>Hủy</Button>
            <Button variant="primary"
              loading={save.isPending}
              disabled={!modal?.code.trim() || !modal?.name.trim()}
              onClick={() => save.mutate()}
            >
              Lưu
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Mã loại *">
              <TextInput
                value={modal?.code || ""}
                onChange={(e) =>
                  setModal((m) => (m ? { ...m, code: e.target.value } : m))
                }
                placeholder="CV01"
              />
            </Field>
            <Field label="Trạng thái">
              <Select
                value={modal?.status || "ACTIVE"}
                onChange={(e) =>
                  setModal((m) => (m ? { ...m, status: e.target.value } : m))
                }
              >
                <option value="ACTIVE">Đang sử dụng</option>
                <option value="INACTIVE">Ngừng sử dụng</option>
              </Select>
            </Field>
          </div>
          <Field label="Tên loại văn bản *">
            <TextInput
              value={modal?.name || ""}
              onChange={(e) =>
                setModal((m) => (m ? { ...m, name: e.target.value } : m))
              }
              placeholder="Công văn"
            />
          </Field>
          <Field label="Người ký mặc định">
            <TextInput
              value={modal?.default_signer || ""}
              onChange={(e) =>
                setModal((m) =>
                  m ? { ...m, default_signer: e.target.value } : m,
                )
              }
              placeholder="Nguyễn Văn A"
            />
          </Field>
          <Field label="Mô tả">
            <TextArea
              rows={2}
              value={modal?.description || ""}
              onChange={(e) =>
                setModal((m) => (m ? { ...m, description: e.target.value } : m))
              }
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

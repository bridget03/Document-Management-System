import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  updateDepartment,
} from "../services/departmentApi";
import { Card, TableSkeleton } from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { IconButton } from "../components/ui/Button";
import { TextInput, Select, Field } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import type { Department } from "../types/department";

interface FormState {
  id?: string;
  name: string;
  status: string;
}

export default function Departments() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: () => listDepartments(),
  });
  const [modal, setModal] = useState<FormState | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["departments"] });
    qc.invalidateQueries({ queryKey: ["departments-active"] });
  };

  const save = useMutation({
    mutationFn: () => {
      if (!modal) throw new Error("no data");
      const payload = { name: modal.name.trim(), status: modal.status };
      return modal.id
        ? updateDepartment(modal.id, payload)
        : createDepartment(payload);
    },
    onSuccess: () => {
      invalidate();
      setModal(null);
      toast("success", "Đã lưu phòng ban.");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response
        ?.data?.detail;
      toast("error", typeof msg === "string" ? msg : "Không lưu được.");
    },
  });

  const toggle = useMutation({
    mutationFn: (d: Department) =>
      updateDepartment(d.id, {
        name: d.name,
        status: d.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      }),
    onSuccess: () => {
      invalidate();
      toast("success", "Đã cập nhật trạng thái.");
    },
    onError: () => toast("error", "Không cập nhật được."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: () => {
      invalidate();
      toast("success", "Đã xóa phòng ban.");
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
          <h1 className="text-xl font-bold text-gray-900">Phòng ban</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Khai báo danh mục phòng ban để chọn nhanh khi chia sẻ công văn, tài
            liệu và gán phòng cho người dùng.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setModal({ name: "", status: "ACTIVE" })}
        >
          <Plus size={15} /> Thêm phòng ban
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
        <TableSkeleton rows={5} cols={3} />
      ) : (data || []).length === 0 ? (
        <EmptyState
          title="Chưa có phòng ban"
          description="Khai báo phòng ban đầu tiên như Hành chính, Kế toán, Nhân sự..."
          actionLabel="Thêm phòng ban"
          onAction={() => setModal({ name: "", status: "ACTIVE" })}
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Tên phòng ban</th>
                <th className="px-4 py-2.5 font-medium">Trạng thái</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data || []).map((d) => (
                <tr key={d.id} className="transition-colors hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {d.name}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => toggle.mutate(d)}
                      title="Bật/tắt sử dụng"
                    >
                      <Badge
                        tone={d.status === "ACTIVE" ? "success" : "neutral"}
                        dot
                      >
                        {d.status === "ACTIVE"
                          ? "Đang sử dụng"
                          : "Ngừng sử dụng"}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="inline-flex gap-1">
                      <IconButton
                        label={`Chỉnh sửa ${d.name}`}
                        onClick={() =>
                          setModal({
                            id: d.id,
                            name: d.name,
                            status: d.status,
                          })
                        }
                      >
                        <Pencil size={15} />
                      </IconButton>
                      <IconButton
                        label={`Xóa ${d.name}`}
                        tone="danger"
                        onClick={() => remove.mutate(d.id)}
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
        title={modal?.id ? "Sửa phòng ban" : "Thêm phòng ban"}
        footer={
          <>
            <Button onClick={() => setModal(null)}>Hủy</Button>
            <Button
              variant="primary"
              loading={save.isPending}
              disabled={!modal?.name.trim()}
              onClick={() => save.mutate()}
            >
              Lưu
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Tên phòng ban *">
            <TextInput
              value={modal?.name || ""}
              onChange={(e) =>
                setModal((m) => (m ? { ...m, name: e.target.value } : m))
              }
              placeholder="Kế toán"
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
      </Modal>
    </div>
  );
}

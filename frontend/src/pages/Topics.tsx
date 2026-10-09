import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  createTopic,
  deleteTopic,
  listTopics,
  updateTopic,
} from "../services/topicApi";
import { Card, TableSkeleton } from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { IconButton } from "../components/ui/Button";
import { TextInput, Select, Field } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import type { Topic } from "../types/topic";

interface FormState {
  id?: string;
  name: string;
  status: string;
}

export default function Topics() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useQuery<Topic[]>({
    queryKey: ["topics"],
    queryFn: () => listTopics(),
  });
  const [modal, setModal] = useState<FormState | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["topics"] });
    qc.invalidateQueries({ queryKey: ["topics-active"] });
  };

  const save = useMutation({
    mutationFn: () => {
      if (!modal) throw new Error("no data");
      const payload = { name: modal.name.trim(), status: modal.status };
      return modal.id
        ? updateTopic(modal.id, payload)
        : createTopic(payload);
    },
    onSuccess: () => {
      invalidate();
      setModal(null);
      toast("success", "Đã lưu vấn đề.");
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response
        ?.data?.detail;
      toast("error", typeof msg === "string" ? msg : "Không lưu được.");
    },
  });

  const toggle = useMutation({
    mutationFn: (d: Topic) =>
      updateTopic(d.id, {
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
    mutationFn: (id: string) => deleteTopic(id),
    onSuccess: () => {
      invalidate();
      toast("success", "Đã xóa vấn đề.");
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
          <h1 className="text-xl font-bold text-gray-900">Vấn đề công văn</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Khai báo danh mục vấn đề dùng cho dropdown "Vấn đề" của công văn nội bộ.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setModal({ name: "", status: "ACTIVE" })}
        >
          <Plus size={15} /> Thêm vấn đề
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
          title="Chưa có vấn đề"
          description="Khai báo vấn đề đầu tiên."
          actionLabel="Thêm vấn đề"
          onAction={() => setModal({ name: "", status: "ACTIVE" })}
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Tên vấn đề</th>
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
        title={modal?.id ? "Sửa vấn đề" : "Thêm vấn đề"}
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
          <Field label="Tên vấn đề *">
            <TextInput
              value={modal?.name || ""}
              onChange={(e) =>
                setModal((m) => (m ? { ...m, name: e.target.value } : m))
              }
              placeholder="VD: Vi phạm"
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

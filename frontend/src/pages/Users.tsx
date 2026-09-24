import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, KeyRound, Copy, Check } from "lucide-react";
import {
  listUsers,
  createUser,
  updateUser,
  resetUserPassword,
} from "../services/authApi";
import { useAuthStore } from "../stores/authStore";
import type { User } from "../types/document";
import { Card, TableSkeleton } from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";
import { IconButton } from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { TextInput, Select, Field } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";

function errMsg(e: unknown, fallback: string) {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response
    ?.data?.detail;
  if (typeof d === "string") return d;
  return fallback;
}

export default function Users() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const current = useAuthStore((s) => s.user);
  const { data, isLoading, isError, refetch } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: listUsers,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPass, setCPass] = useState("");
  const [cRole, setCRole] = useState("USER");
  const [cDept, setCDept] = useState("");

  const [edit, setEdit] = useState<User | null>(null);
  const [eName, setEName] = useState("");
  const [eRole, setERole] = useState("USER");
  const [eActive, setEActive] = useState(true);
  const [eDept, setEDept] = useState("");

  const [reset, setReset] = useState<User | null>(null);
  const [tempPass, setTempPass] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });

  const create = useMutation({
    mutationFn: () =>
      createUser({
        name: cName.trim(),
        email: cEmail.trim(),
        password: cPass,
        role: cRole,
        department: cDept.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setCName("");
      setCEmail("");
      setCPass("");
      setCRole("USER");
      setCDept("");
      toast("success", "Đã tạo người dùng.");
    },
    onError: (e) => toast("error", errMsg(e, "Không tạo được người dùng.")),
  });

  const save = useMutation({
    mutationFn: () =>
      updateUser(edit!.id, {
        name: eName.trim(),
        role: eRole,
        is_active: eActive,
        department: eDept.trim() || null,
      }),
    onSuccess: () => {
      invalidate();
      setEdit(null);
      toast("success", "Đã cập nhật người dùng.");
    },
    onError: (e) => toast("error", errMsg(e, "Không cập nhật được.")),
  });

  const doReset = useMutation({
    mutationFn: () => resetUserPassword(reset!.id),
    onSuccess: (r) => {
      setTempPass(r.temporary_password as string);
      setCopied(false);
      toast(
        "success",
        "Đã cấp mật khẩu tạm. Hãy gửi cho user qua kênh an toàn.",
      );
    },
    onError: (e) => toast("error", errMsg(e, "Không reset được mật khẩu.")),
  });

  const openEdit = (u: User) => {
    setEdit(u);
    setEName(u.name);
    setERole(u.role);
    setEActive(u.is_active);
    setEDept(u.department || "");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Người dùng</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Quản lý tài khoản, phân quyền, khóa/mở và reset mật khẩu.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus size={15} /> Thêm người dùng
        </Button>
      </div>

      {isError ? (
        <Card className="px-6 py-10 text-center">
          <p className="font-semibold text-gray-900">
            Không tải được danh sách
          </p>
          <p className="mt-1 text-sm text-gray-500">Bạn cần quyền Admin.</p>
          <Button size="sm" className="mt-3" onClick={() => refetch()}>
            Thử lại
          </Button>
        </Card>
      ) : isLoading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : (data || []).length === 0 ? (
        <EmptyState
          title="Chưa có người dùng"
          description="Thêm tài khoản đầu tiên cho nhân sự."
          actionLabel="Thêm người dùng"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3">Tên</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Phòng ban</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data || []).map((u) => (
                <tr
                  key={u.id}
                  className={!u.is_active ? "bg-gray-50" : undefined}
                >
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {u.name}
                    {current?.id === u.id && (
                      <span className="ml-2 text-xs text-gray-400">(bạn)</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{u.email}</td>
                  <td className="px-5 py-3">
                    <Badge tone={u.role === "ADMIN" ? "brand" : "neutral"}>
                      {u.role === "ADMIN" ? "Admin" : "Member"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {u.department || "—"}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={u.is_active ? "success" : "danger"}>
                      {u.is_active ? "Đang hoạt động" : "Đã khóa"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <IconButton
                        label={`Edit ${u.email}`}
                        onClick={() => openEdit(u)}
                      >
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton
                        label={`Reset password ${u.email}`}
                        onClick={() => {
                          setReset(u);
                          setTempPass(null);
                        }}
                      >
                        <KeyRound size={14} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Thêm người dùng"
        footer={
          <>
            <Button onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button
              variant="primary"
              loading={create.isPending}
              disabled={!cName.trim() || !cEmail.trim() || cPass.length < 6}
              onClick={() => create.mutate()}
            >
              Tạo
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Tên">
            <TextInput
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              placeholder="Nguyễn Văn A"
            />
          </Field>
          <Field label="Email">
            <TextInput
              value={cEmail}
              onChange={(e) => setCEmail(e.target.value)}
              placeholder="a@vicenza.vn"
            />
          </Field>
          <Field label="Mật khẩu (≥ 6 ký tự)">
            <TextInput
              type="password"
              value={cPass}
              onChange={(e) => setCPass(e.target.value)}
            />
          </Field>
          <Field label="Role">
            <Select value={cRole} onChange={(e) => setCRole(e.target.value)}>
              <option value="USER">Member</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </Field>
          <Field label="Phòng ban">
            <TextInput
              value={cDept}
              onChange={(e) => setCDept(e.target.value)}
              placeholder="Kế toán"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={edit !== null}
        onClose={() => setEdit(null)}
        title="Chỉnh sửa người dùng"
        footer={
          <>
            <Button onClick={() => setEdit(null)}>Hủy</Button>
            <Button
              variant="primary"
              loading={save.isPending}
              disabled={!eName.trim()}
              onClick={() => save.mutate()}
            >
              Lưu
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Tên">
            <TextInput
              value={eName}
              onChange={(e) => setEName(e.target.value)}
            />
          </Field>
          <Field label="Role">
            <Select
              value={eRole}
              onChange={(e) => setERole(e.target.value)}
              disabled={current?.id === edit?.id}
            >
              <option value="USER">Member</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </Field>

          <Field label="Trạng thái">
            <Select
              value={eActive ? "1" : "0"}
              onChange={(e) => setEActive(e.target.value === "1")}
              disabled={current?.id === edit?.id}
            >
              <option value="1">Đang hoạt động</option>
              <option value="0">Đã khóa</option>
            </Select>
          </Field>
          <Field label="Phòng ban">
            <TextInput
              value={eDept}
              onChange={(e) => setEDept(e.target.value)}
              placeholder="Kế toán"
            />
          </Field>
          {current?.id === edit?.id && (
            <p className="text-xs text-gray-500">
              Không thể tự đổi role hoặc tự khóa tài khoản của chính mình.
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={reset !== null}
        onClose={() => {
          setReset(null);
          setTempPass(null);
        }}
        title="Reset mật khẩu"
        footer={
          tempPass ? (
            <Button
              onClick={() => {
                setReset(null);
                setTempPass(null);
              }}
            >
              Đóng
            </Button>
          ) : (
            <>
              <Button onClick={() => setReset(null)}>Hủy</Button>
              <Button
                variant="primary"
                loading={doReset.isPending}
                onClick={() => doReset.mutate()}
              >
                Cấp mật khẩu tạm
              </Button>
            </>
          )
        }
      >
        {!tempPass ? (
          <p className="text-sm text-gray-600">
            Cấp mật khẩu tạm mới cho “{reset?.email}”? Mật khẩu cũ sẽ mất hiệu
            lực ngay.
          </p>
        ) : (
          <div>
            <p className="text-sm text-gray-600">
              Mật khẩu tạm (chỉ hiện 1 lần):
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 rounded bg-gray-100 px-3 py-2 font-mono text-sm">
                {tempPass}
              </code>
              <Button
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(tempPass);
                  setCopied(true);
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Đã copy" : "Copy"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

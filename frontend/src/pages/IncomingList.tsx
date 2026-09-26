import CorrespondenceList from "./CorrespondenceList";

/** Màn hình danh sách công văn ĐẾN (file riêng, không dùng chung với công văn đi). */
export default function IncomingList() {
  return (
    <CorrespondenceList
      direction="INCOMING"
      title="Công văn đến"
      subtitle="Quản lý các văn bản nhận từ bên ngoài."
      base="/correspondence/incoming"
    />
  );
}

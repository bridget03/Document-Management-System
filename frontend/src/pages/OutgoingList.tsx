import CorrespondenceList from "./CorrespondenceList";

/** Màn hình danh sách công văn ĐI (file riêng, không dùng chung với công văn đến). */
export default function OutgoingList() {
  return (
    <CorrespondenceList
      direction="OUTGOING"
      title="Công văn đi"
      subtitle="Quản lý các công văn phát hành từ doanh nghiệp."
      base="/correspondence/outgoing"
    />
  );
}

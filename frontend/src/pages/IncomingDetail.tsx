import CorrespondenceDetail from "./CorrespondenceDetail";

/** Màn hình chi tiết công văn ĐẾN (file riêng). */
export default function IncomingDetail() {
  return (
    <CorrespondenceDetail
      direction="INCOMING"
      title="Văn bản đến"
      base="/correspondence/incoming"
    />
  );
}

import CorrespondenceDetail from "./CorrespondenceDetail";

/** Màn hình chi tiết công văn ĐI (file riêng). */
export default function OutgoingDetail() {
  return (
    <CorrespondenceDetail
      direction="OUTGOING"
      title="Văn bản đi"
      base="/correspondence/outgoing"
    />
  );
}

import CorrespondenceFormPage from "./CorrespondenceFormPage";

/**
 * Màn hình thêm/sửa công văn ĐI (file riêng).
 * Dùng chung lõi CorrespondenceFormPage + OutgoingForm (nhiều nơi nhận).
 * Tùy biến riêng của văn bản đi sửa tại đây.
 */
export default function OutgoingFormPage() {
  return (
    <CorrespondenceFormPage
      direction="OUTGOING"
      title="Thêm công văn đi"
      base="/correspondence/outgoing"
    />
  );
}

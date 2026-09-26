import CorrespondenceFormPage from "./CorrespondenceFormPage";

/**
 * Màn hình thêm/sửa công văn ĐẾN (file riêng).
 * Dùng chung lõi CorrespondenceFormPage + IncomingForm,
 * tùy biến riêng của văn bản đến sửa tại đây.
 */
export default function IncomingFormPage() {
  return (
    <CorrespondenceFormPage
      direction="INCOMING"
      title="Thêm công văn đến"
      base="/correspondence/incoming"
    />
  );
}

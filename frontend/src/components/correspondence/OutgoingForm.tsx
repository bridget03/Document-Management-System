import CorrespondenceForm, {
  type CorrFormValue,
} from "./CorrespondenceForm";
import type { CorrDoc } from "../../types/correspondence";

interface OutgoingFormProps {
  initial?: CorrDoc | null;
  pending: boolean;
  serverError: string;
  createMode: boolean;
  onSubmit: (value: CorrFormValue, and: "close" | "add" | "open") => void;
  onCancel: () => void;
}

/**
 * Form công văn ĐI (riêng, không dùng chung với công văn đến).
 * Hỗ trợ nhiều nơi nhận (chip tag, lưu "A; B; C").
 * Mọi tùy biến riêng của văn bản đi sửa tại file này.
 */
export default function OutgoingForm(props: OutgoingFormProps) {
  return <CorrespondenceForm direction="OUTGOING" multipleParty {...props} />;
}

export type { CorrFormValue };

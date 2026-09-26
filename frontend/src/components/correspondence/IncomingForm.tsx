import CorrespondenceForm, {
  type CorrFormValue,
} from "./CorrespondenceForm";
import type { CorrDoc } from "../../types/correspondence";

interface IncomingFormProps {
  initial?: CorrDoc | null;
  pending: boolean;
  serverError: string;
  createMode: boolean;
  onSubmit: (value: CorrFormValue, and: "close" | "add" | "open") => void;
  onCancel: () => void;
}

/**
 * Form công văn ĐẾN (riêng, không dùng chung với công văn đi).
 * Nơi gửi chỉ 1 -> ô text đơn (multipleParty=false).
 */
export default function IncomingForm(props: IncomingFormProps) {
  return <CorrespondenceForm direction="INCOMING" multipleParty={false} {...props} />;
}

export type { CorrFormValue };

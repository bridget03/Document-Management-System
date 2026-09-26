import CorrespondenceTable from "./CorrespondenceTable";
import type { CorrDoc } from "../../types/correspondence";

interface Props {
  items: CorrDoc[];
  base: string;
  onDelete: (doc: CorrDoc) => void;
}

/** Bảng công văn ĐI — cột đối tác là Nơi nhận (nhiều nơi, hiển thị +n). */
export default function OutgoingTable({ items, base, onDelete }: Props) {
  return <CorrespondenceTable items={items} dir="OUTGOING" base={base} onDelete={onDelete} />;
}

import CorrespondenceTable from "./CorrespondenceTable";
import type { CorrDoc } from "../../types/correspondence";

interface Props {
  items: CorrDoc[];
  base: string;
  onDelete: (doc: CorrDoc) => void;
}

/** Bảng công văn ĐẾN — cột đối tác là Nơi gửi. */
export default function IncomingTable({ items, base, onDelete }: Props) {
  return <CorrespondenceTable items={items} dir="INCOMING" base={base} onDelete={onDelete} />;
}

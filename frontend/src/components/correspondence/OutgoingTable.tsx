import CorrespondenceTable, { type CorrSortKey, type SortOrder } from "./CorrespondenceTable";
import type { CorrDoc } from "../../types/correspondence";

interface Props {
  items: CorrDoc[];
  base: string;
  onDelete: (doc: CorrDoc) => void;
  sortBy: CorrSortKey;
  sortOrder: SortOrder;
  onSort: (key: CorrSortKey) => void;
  onDuplicate: (doc: CorrDoc) => void;
}

/** Bảng công văn ĐI — cột đối tác là Nơi nhận (nhiều nơi, hiển thị +n). */
export default function OutgoingTable({ items, base, onDelete, sortBy, sortOrder, onSort, onDuplicate }: Props) {
  return <CorrespondenceTable items={items} dir="OUTGOING" base={base} onDelete={onDelete} sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} onDuplicate={onDuplicate} />;
}

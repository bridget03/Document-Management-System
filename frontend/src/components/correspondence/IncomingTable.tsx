import CorrespondenceTable, { type CorrSortKey, type SortOrder } from "./CorrespondenceTable";
import type { CorrDoc } from "../../types/correspondence";

interface Props {
  items: CorrDoc[];
  base: string;
  onDelete: (doc: CorrDoc) => void;
  sortBy: CorrSortKey;
  sortOrder: SortOrder;
  onSort: (key: CorrSortKey) => void;
}

/** Bảng công văn ĐẾN — cột đối tác là Nơi gửi. */
export default function IncomingTable({ items, base, onDelete, sortBy, sortOrder, onSort }: Props) {
  return <CorrespondenceTable items={items} dir="INCOMING" base={base} onDelete={onDelete} sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />;
}

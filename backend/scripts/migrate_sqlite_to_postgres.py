#!/usr/bin/env python3
"""
Migrate the DMS SQLite database to PostgreSQL.

Design goals:
- Keep SQLite source untouched/read-only.
- Preserve every existing primary-key value (UUID/ID).
- Preserve NULLs, timestamps, statuses, numbering configs, etc.
- Respect foreign-key dependencies.
- Do NOT copy physical files from storage/documents.
- Migrate Google Drive configuration/data as database rows only.
- Run the PostgreSQL write phase inside one transaction.
- Roll back the whole migration on any error.
- Reset PostgreSQL sequences/identity sequences where applicable.
- Verify row counts in SQLite vs PostgreSQL at the end.

Usage:
    export SQLITE_PATH=backend/dms.db
    export DATABASE_URL='postgresql://user:password@localhost:5432/dms'
    python backend/scripts/migrate_sqlite_to_postgres.py

Optional:
    export PG_SCHEMA=public
    export BATCH_SIZE=500

Dependencies:
    pip install psycopg[binary]
or:
    pip install psycopg2-binary
"""

from __future__ import annotations

import os
import sqlite3
import sys
from collections import defaultdict, deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

try:
    import psycopg
    from psycopg import sql
    PG_DRIVER = "psycopg"
except ImportError:
    try:
        import psycopg2
        from psycopg2 import sql
        PG_DRIVER = "psycopg2"
    except ImportError:
        print(
            "ERROR: PostgreSQL driver not found. Install one of:\n"
            "  pip install psycopg[binary]\n"
            "  pip install psycopg2-binary",
            file=sys.stderr,
        )
        raise


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SQLITE_PATH = Path(os.getenv("SQLITE_PATH", "backend/dms.db"))
DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
PG_SCHEMA = os.getenv("PG_SCHEMA", "public")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "500"))

# Database tables expected in this DMS. The script also checks SQLite for
# additional user tables and will report them rather than silently ignoring.
EXPECTED_TABLES = [
    "users",
    "categories",
    "tags",
    "documents",
    "document_tags",
    "google_drive_configs",
    "google_drive_sync_files",
    "sync_logs",
    "audit_logs",
    "document_types",
    "correspondence_number_configs",
    "correspondence_documents",
    "correspondence_attachments",
    "correspondence_links",
]

# Never touch these paths. This migration only moves DB rows.
FORBIDDEN_FILE_COPY_PATHS = (
    "storage/documents",
)


@dataclass(frozen=True)
class ForeignKey:
    table: str
    parent_table: str
    child_column: str
    parent_column: str
    on_delete: str


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def fail(message: str) -> "NoReturn":
    raise RuntimeError(message)


def quote_ident(name: str) -> str:
    """Quote an identifier for logging only; SQL statements use psycopg.sql."""
    return '"' + name.replace('"', '""') + '"'


def normalize_sqlite_type(type_name: str | None) -> str:
    return (type_name or "").strip().upper()


def connect_sqlite(path: Path) -> sqlite3.Connection:
    if not path.exists():
        fail(f"SQLite database not found: {path}")
    if not path.is_file():
        fail(f"SQLite path is not a file: {path}")

    conn = sqlite3.connect(f"file:{path.resolve()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def connect_postgres():
    if not DATABASE_URL:
        fail(
            "DATABASE_URL (or POSTGRES_URL) is not set.\n"
            "Example: postgresql://user:password@localhost:5432/dms"
        )

    if PG_DRIVER == "psycopg":
        return psycopg.connect(DATABASE_URL)
    return psycopg2.connect(DATABASE_URL)


def pg_cursor(conn):
    return conn.cursor()


# ---------------------------------------------------------------------------
# SQLite introspection
# ---------------------------------------------------------------------------

def sqlite_tables(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
        """
    ).fetchall()
    return [r["name"] for r in rows]


def sqlite_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    rows = conn.execute(
        f"PRAGMA table_info({quote_ident(table)})"
    ).fetchall()
    if not rows:
        fail(f"SQLite table does not exist or has no columns: {table}")
    return [r["name"] for r in rows]


def sqlite_primary_keys(conn: sqlite3.Connection, table: str) -> list[str]:
    rows = conn.execute(
        f"PRAGMA table_info({quote_ident(table)})"
    ).fetchall()
    return [
        r["name"]
        for r in sorted(rows, key=lambda x: x["pk"])
        if r["pk"] > 0
    ]


def sqlite_foreign_keys(conn: sqlite3.Connection) -> list[ForeignKey]:
    result: list[ForeignKey] = []

    for table in sqlite_tables(conn):
        rows = conn.execute(
            f"PRAGMA foreign_key_list({quote_ident(table)})"
        ).fetchall()

        for row in rows:
            result.append(
                ForeignKey(
                    table=table,
                    parent_table=row["table"],
                    child_column=row["from"],
                    parent_column=row["to"],
                    on_delete=(row["on_delete"] or "NO ACTION").upper(),
                )
            )

    return result


# ---------------------------------------------------------------------------
# PostgreSQL introspection
# ---------------------------------------------------------------------------

def pg_tables(conn) -> set[str]:
    with pg_cursor(conn) as cur:
        cur.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = %s
              AND table_type = 'BASE TABLE'
            """,
            (PG_SCHEMA,),
        )
        return {row[0] for row in cur.fetchall()}


def pg_columns(conn, table: str) -> list[dict[str, Any]]:
    with pg_cursor(conn) as cur:
        cur.execute(
            """
            SELECT
                column_name,
                data_type,
                udt_name,
                is_nullable,
                column_default,
                ordinal_position
            FROM information_schema.columns
            WHERE table_schema = %s
              AND table_name = %s
            ORDER BY ordinal_position
            """,
            (PG_SCHEMA, table),
        )
        return [
            {
                "column_name": r[0],
                "data_type": r[1],
                "udt_name": r[2],
                "is_nullable": r[3],
                "column_default": r[4],
                "ordinal_position": r[5],
            }
            for r in cur.fetchall()
        ]


def pg_primary_keys(conn, table: str) -> list[str]:
    with pg_cursor(conn) as cur:
        cur.execute(
            """
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
             AND tc.table_name = kcu.table_name
            WHERE tc.table_schema = %s
              AND tc.table_name = %s
              AND tc.constraint_type = 'PRIMARY KEY'
            ORDER BY kcu.ordinal_position
            """,
            (PG_SCHEMA, table),
        )
        return [r[0] for r in cur.fetchall()]


# ---------------------------------------------------------------------------
# Dependency ordering
# ---------------------------------------------------------------------------

def dependency_order(
    tables: list[str],
    foreign_keys: list[ForeignKey],
) -> list[str]:
    """
    Parent tables before child tables.

    FK: child -> parent
    Migration: parent -> child
    """
    table_set = set(tables)
    children_by_parent: dict[str, set[str]] = defaultdict(set)
    indegree: dict[str, int] = {t: 0 for t in tables}

    for fk in foreign_keys:
        if fk.table not in table_set or fk.parent_table not in table_set:
            continue
        if fk.table == fk.parent_table:
            # Self-reference does not establish an inter-table ordering.
            continue
        if fk.table not in children_by_parent[fk.parent_table]:
            children_by_parent[fk.parent_table].add(fk.table)
            indegree[fk.table] += 1

    queue = deque(sorted(t for t, d in indegree.items() if d == 0))
    result: list[str] = []

    while queue:
        parent = queue.popleft()
        result.append(parent)

        for child in sorted(children_by_parent.get(parent, ())):
            indegree[child] -= 1
            if indegree[child] == 0:
                queue.append(child)

    if len(result) != len(tables):
        remaining = sorted(set(tables) - set(result))
        print(
            "WARNING: Circular/self-referencing dependency detected for: "
            + ", ".join(remaining)
        )
        print(
            "Those tables will be appended in deterministic order. "
            "If PostgreSQL constraints are NOT DEFERRABLE, inspect the "
            "reported tables before running against production."
        )
        result.extend(remaining)

    return result


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------

def validate_schema(
    sqlite_conn: sqlite3.Connection,
    pg_conn,
    tables: list[str],
) -> None:
    pg_table_set = pg_tables(pg_conn)

    missing_pg_tables = [t for t in tables if t not in pg_table_set]
    if missing_pg_tables:
        fail(
            "PostgreSQL is missing required tables:\n  - "
            + "\n  - ".join(missing_pg_tables)
        )

    for table in tables:
        sqlite_cols = sqlite_columns(sqlite_conn, table)
        pg_col_rows = pg_columns(pg_conn, table)
        pg_cols = [r["column_name"] for r in pg_col_rows]

        missing_cols = [c for c in sqlite_cols if c not in pg_cols]
        if missing_cols:
            fail(
                f"Schema mismatch for {table}: PostgreSQL is missing columns: "
                + ", ".join(missing_cols)
            )

        sqlite_pk = sqlite_primary_keys(sqlite_conn, table)
        pg_pk = pg_primary_keys(pg_conn, table)

        if sqlite_pk != pg_pk:
            fail(
                f"Primary-key mismatch for {table}: "
                f"SQLite={sqlite_pk!r}, PostgreSQL={pg_pk!r}"
            )

    print("Schema validation: OK")


# ---------------------------------------------------------------------------
# Data migration
# ---------------------------------------------------------------------------

def sqlite_row_count(conn: sqlite3.Connection, table: str) -> int:
    row = conn.execute(
        f"SELECT COUNT(*) AS c FROM {quote_ident(table)}"
    ).fetchone()
    return int(row["c"])


def pg_row_count(conn, table: str) -> int:
    with pg_cursor(conn) as cur:
        cur.execute(
            sql.SQL("SELECT COUNT(*) FROM {}.{}").format(
                sql.Identifier(PG_SCHEMA),
                sql.Identifier(table),
            )
        )
        return int(cur.fetchone()[0])


def truncate_target(conn, tables: list[str]) -> None:
    """
    Clear only the destination tables, never SQLite.

    RESTART IDENTITY is harmless for UUID PKs and useful if a target schema
    contains sequences. CASCADE lets PostgreSQL handle dependent FK tables.
    """
    with pg_cursor(conn) as cur:
        cur.execute(
            sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY CASCADE").format(
                sql.SQL(", ").join(
                    sql.Identifier(PG_SCHEMA, t) for t in tables
                )
            )
        )


def fetch_sqlite_batches(
    conn: sqlite3.Connection,
    table: str,
    columns: list[str],
    batch_size: int,
    boolean_columns: set[str] | None = None,
) -> Iterable[list[tuple[Any, ...]]]:
    select_sql = (
        "SELECT "
        + ", ".join(quote_ident(c) for c in columns)
        + f" FROM {quote_ident(table)}"
    )

    cursor = conn.execute(select_sql)
    boolean_columns = boolean_columns or set()

    while True:
        rows = cursor.fetchmany(batch_size)
        if not rows:
            break

        batch = []
        for row in rows:
            values = []
            for c in columns:
                value = row[c]
                # SQLite commonly stores BOOLEAN values as INTEGER 0/1,
                # while PostgreSQL expects a real boolean. Convert only
                # columns whose PostgreSQL target type is boolean.
                if c in boolean_columns and value is not None:
                    value = bool(value)
                values.append(value)
            batch.append(tuple(values))

        yield batch


def insert_rows(
    pg_conn,
    table: str,
    columns: list[str],
    batches: Iterable[list[tuple[Any, ...]]],
) -> int:
    if not columns:
        return 0

    placeholders = sql.SQL(", ").join(sql.Placeholder() for _ in columns)

    statement = sql.SQL(
        "INSERT INTO {}.{} ({}) VALUES ({})"
    ).format(
        sql.Identifier(PG_SCHEMA),
        sql.Identifier(table),
        sql.SQL(", ").join(sql.Identifier(c) for c in columns),
        placeholders,
    )

    total = 0

    with pg_cursor(pg_conn) as cur:
        for batch in batches:
            if PG_DRIVER == "psycopg":
                cur.executemany(statement, batch)
            else:
                # psycopg2 accepts SQL objects too, but executemany is enough
                # for the modest DMS datasets this script targets.
                cur.executemany(statement.as_string(pg_conn), batch)
            total += len(batch)

    return total


# ---------------------------------------------------------------------------
# Sequence handling
# ---------------------------------------------------------------------------

def reset_postgres_sequences(pg_conn, tables: list[str]) -> None:
    """
    Reset serial/identity sequences only when PostgreSQL actually has one.

    Most DMS IDs are VARCHAR UUIDs, so this normally reports no sequence.
    """
    reset_count = 0

    for table in tables:
        cols = pg_columns(pg_conn, table)

        for col in cols:
            default = col["column_default"] or ""
            if "nextval(" not in default:
                continue

            column = col["column_name"]

            with pg_cursor(pg_conn) as cur:
                cur.execute(
                    "SELECT pg_get_serial_sequence(%s, %s)",
                    (f"{PG_SCHEMA}.{table}", column),
                )
                row = cur.fetchone()

                if not row or not row[0]:
                    continue

                sequence_name = row[0]

                # Set sequence to max(column), or 1 with is_called=false
                # when the table is empty.
                cur.execute(
                    sql.SQL(
                        "SELECT MAX({}) FROM {}.{}"
                    ).format(
                        sql.Identifier(column),
                        sql.Identifier(PG_SCHEMA),
                        sql.Identifier(table),
                    )
                )
                max_value = cur.fetchone()[0]

                if max_value is None:
                    cur.execute(
                        "SELECT setval(%s, 1, false)",
                        (sequence_name,),
                    )
                else:
                    cur.execute(
                        "SELECT setval(%s, %s, true)",
                        (sequence_name, max_value),
                    )

                reset_count += 1
                print(
                    f"  sequence reset: {PG_SCHEMA}.{table}.{column} "
                    f"-> {sequence_name}"
                )

    if reset_count == 0:
        print("Sequence reset: no PostgreSQL serial/identity sequences found")
    else:
        print(f"Sequence reset: {reset_count} sequence(s)")


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------

def verify_counts(
    sqlite_conn: sqlite3.Connection,
    pg_conn,
    tables: list[str],
) -> bool:
    print("\nCOUNT VERIFICATION")
    print("=" * 76)
    print(f"{'TABLE':38} {'SQLITE':>10} {'POSTGRES':>10} {'STATUS':>10}")
    print("-" * 76)

    all_ok = True

    for table in tables:
        source_count = sqlite_row_count(sqlite_conn, table)
        target_count = pg_row_count(pg_conn, table)
        status = "OK" if source_count == target_count else "MISMATCH"

        if status != "OK":
            all_ok = False

        print(
            f"{table:38} {source_count:>10} "
            f"{target_count:>10} {status:>10}"
        )

    print("=" * 76)
    print("RESULT:", "MIGRATION VERIFIED" if all_ok else "COUNT MISMATCH")
    return all_ok


# ---------------------------------------------------------------------------
# Special safety checks for this DMS
# ---------------------------------------------------------------------------

def verify_dms_expectations(sqlite_conn: sqlite3.Connection) -> None:
    """
    These checks are intentionally read-only and based on the current DMS
    schema/data model. They do not modify anything.
    """
    if "correspondence_number_configs" in sqlite_tables(sqlite_conn):
        rows = sqlite_conn.execute(
            """
            SELECT direction, current_number, number_length, prefix, suffix
            FROM correspondence_number_configs
            ORDER BY direction
            """
        ).fetchall()

        directions = {r["direction"] for r in rows}
        expected = {"INCOMING", "INTERNAL", "OUTGOING"}

        missing = expected - directions
        if missing:
            print(
                "WARNING: missing correspondence numbering direction(s): "
                + ", ".join(sorted(missing))
            )

        print("\nCorrespondence numbering configs:")
        for r in rows:
            print(
                f"  {r['direction']}: current_number={r['current_number']}, "
                f"length={r['number_length']}, prefix={r['prefix']!r}, "
                f"suffix={r['suffix']!r}"
            )

    if "correspondence_documents" in sqlite_tables(sqlite_conn):
        rows = sqlite_conn.execute(
            """
            SELECT direction, COUNT(*) AS c
            FROM correspondence_documents
            GROUP BY direction
            ORDER BY direction
            """
        ).fetchall()

        print("\nCorrespondence documents:")
        for r in rows:
            print(f"  {r['direction']}: {r['c']}")


def main() -> int:
    print("DMS SQLite -> PostgreSQL migration")
    print("=" * 76)
    print(f"SQLite : {SQLITE_PATH.resolve()}")
    print(f"PG     : schema={PG_SCHEMA}")
    print(f"Batch  : {BATCH_SIZE}")
    print()

    sqlite_conn = connect_sqlite(SQLITE_PATH)
    pg_conn = None

    try:
        # Read-only source introspection.
        source_tables = sqlite_tables(sqlite_conn)

        missing_expected = [
            t for t in EXPECTED_TABLES if t not in source_tables
        ]
        if missing_expected:
            fail(
                "SQLite is missing expected DMS table(s):\n  - "
                + "\n  - ".join(missing_expected)
            )

        extra_tables = [
            t for t in source_tables if t not in EXPECTED_TABLES
        ]
        if extra_tables:
            print(
                "WARNING: additional SQLite user table(s) detected; "
                "they will also be migrated:\n  - "
                + "\n  - ".join(extra_tables)
            )

        fks = sqlite_foreign_keys(sqlite_conn)
        order = dependency_order(source_tables, fks)

        print("Migration order:")
        for index, table in enumerate(order, 1):
            print(f"  {index:2}. {table}")

        verify_dms_expectations(sqlite_conn)

        pg_conn = connect_postgres()

        # Validate destination before touching any rows.
        validate_schema(sqlite_conn, pg_conn, source_tables)

        # Start the single PostgreSQL transaction here.
        # psycopg/psycopg2 default to transactional mode.
        print("\nStarting PostgreSQL transaction...")

        # We intentionally clear only destination DB tables. SQLite remains
        # untouched. The CASCADE is handled by PostgreSQL.
        truncate_target(pg_conn, source_tables)
        print("PostgreSQL destination tables cleared.")

        migrated = {}

        for table in order:
            columns = sqlite_columns(sqlite_conn, table)
            pg_col_rows = pg_columns(pg_conn, table)
            pg_boolean_columns = {
                row["column_name"]
                for row in pg_col_rows
                if row["data_type"] == "boolean"
            }
            print(f"  {table}: PostgreSQL boolean columns = {sorted(pg_boolean_columns)}")

            # Do not copy any filesystem data. All columns are DB values only.
            # local_file_path is copied as a string exactly as stored.
            count = insert_rows(
                pg_conn,
                table,
                columns,
                fetch_sqlite_batches(
                    sqlite_conn,
                    table,
                    columns,
                    BATCH_SIZE,
                    boolean_columns=pg_boolean_columns,
                ),
            )
            migrated[table] = count

            print(f"  migrated {table}: {count} row(s)")

        reset_postgres_sequences(pg_conn, order)

        # Verify inside the same transaction before commit.
        # If verification fails, raise -> rollback.
        if not verify_counts(sqlite_conn, pg_conn, source_tables):
            fail("Row-count verification failed; transaction will be rolled back.")

        print("\nCommitting PostgreSQL transaction...")
        pg_conn.commit()
        print("COMMIT: successful")

        # Re-check after commit using a fresh transaction/read.
        print("\nPost-commit verification...")
        if not verify_counts(sqlite_conn, pg_conn, source_tables):
            fail(
                "Post-commit verification failed. "
                "The migration was committed, so inspect PostgreSQL before rerun."
            )

        print("\nMigration completed successfully.")
        print("SQLite source was opened read-only and was not modified.")
        print("No physical files were copied or deleted.")
        return 0

    except Exception as exc:
        if pg_conn is not None:
            try:
                pg_conn.rollback()
                print("\nROLLBACK: PostgreSQL transaction rolled back.")
            except Exception as rollback_exc:
                print(
                    f"ERROR: rollback itself failed: {rollback_exc}",
                    file=sys.stderr,
                )

        print(f"\nMIGRATION FAILED: {exc}", file=sys.stderr)
        return 1

    finally:
        try:
            sqlite_conn.close()
        except Exception:
            pass

        if pg_conn is not None:
            try:
                pg_conn.close()
            except Exception:
                pass


if __name__ == "__main__":
    raise SystemExit(main())

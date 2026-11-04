/**
 * A small CSV reader for LIS exports (RFC 4180: quoted fields, doubled quotes,
 * CRLF). Written here instead of adding a library, because the format is fixed
 * and the whole reader fits on one screen.
 */

export interface CsvTable {
  header: string[];
  records: Record<string, string>[];
}

function splitRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export function parseCsv(text: string): CsvTable {
  const rows = splitRows(text.replace(/^﻿/, ""));
  const header = (rows[0] ?? []).map((h) => h.trim());
  const records = rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((name, i) => {
      record[name] = (cells[i] ?? "").trim();
    });
    return record;
  });
  return { header, records };
}

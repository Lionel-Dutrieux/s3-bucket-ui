// Minimal RFC 4180 parser for the CSV preview — quotes, escaped quotes,
// embedded newlines, CRLF. First record is the header; rows are capped so a
// huge (already 1 MiB-truncated) file can't lock the UI up.

export interface CsvPreview {
  header: string[];
  rows: string[][];
  truncatedRows: boolean;
}

export function parseCsvPreview(text: string, maxRows: number): CsvPreview {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  const endField = () => {
    record.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    records.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i++) {
    // header + capped rows + 1 so truncation is detectable
    if (records.length > maxRows + 1) break;
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      inQuotes = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\n") {
      endRecord();
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field !== "" || record.length > 0) endRecord();

  const [header = [], ...rows] = records;
  return {
    header,
    rows: rows.slice(0, maxRows),
    truncatedRows: rows.length > maxRows,
  };
}

import * as XLSX from 'xlsx';

export function exportToXlsx(
  filename: string,
  rows: Record<string, any>[],
  columns: { key: string; header: string }[]
) {
  const headers = columns.map((c) => c.header);
  const data = rows.map((row) =>
    columns.map((c) => {
      const val = c.key.split('.').reduce((obj: any, k) => obj?.[k], row);
      if (val === null || val === undefined) return '';
      if (val instanceof Date) return val.toLocaleDateString();
      if (typeof val === 'number') return val;
      if (typeof val === 'boolean') return val;
      return String(val);
    })
  );

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Auto-size columns based on header & content length
  const colWidths = columns.map((c, colIdx) => {
    let maxLen = c.header.length;
    for (const row of data) {
      const cellValue = row[colIdx];
      const len = cellValue == null ? 0 : String(cellValue).length;
      if (len > maxLen) maxLen = len;
    }
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  const date = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${filename}_${date}.xlsx`);
}

export function exportToCsv(filename: string, rows: Record<string, any>[], columns: { key: string; header: string }[]) {
  const bom = '\uFEFF';
  const headers = columns.map((c) => `"${c.header}"`).join(',');
  const csvRows = rows.map((row) =>
    columns
      .map((c) => {
        let val = c.key.split('.').reduce((obj: any, k) => obj?.[k], row);
        if (val === null || val === undefined) val = '';
        if (val instanceof Date) val = val.toLocaleDateString();
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(',')
  );

  const csv = bom + [headers, ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

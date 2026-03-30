export async function generatePDF(type: string, data: any): Promise<Buffer | null> {
  // PDF generation placeholder
  // In production, use @react-pdf/renderer with Arabic font support
  // Templates: BatchReport, SalesInvoice, AccountStatement, MonthlyPnL
  console.log(`PDF generation requested: type=${type}`);
  return null;
}

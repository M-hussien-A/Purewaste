export function MonthlyPnL({ data }: { data: any }) {
  return (
    <div style={{ padding: 20, fontFamily: 'Noto Sans Arabic, sans-serif' }}>
      <h1>Monthly P&amp;L - الأرباح والخسائر الشهرية</h1>
      <p>Period: {data?.dateFrom} - {data?.dateTo}</p>
      <p>Total Revenue: {data?.summary?.totalRevenue} EGP</p>
      <p>Total Costs: {data?.summary?.totalCosts} EGP</p>
      <p>Net Profit: {data?.summary?.totalGrossProfit} EGP</p>
    </div>
  );
}

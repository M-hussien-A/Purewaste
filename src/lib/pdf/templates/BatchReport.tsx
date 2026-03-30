export function BatchReport({ data }: { data: any }) {
  return (
    <div style={{ padding: 20, fontFamily: 'Noto Sans Arabic, sans-serif' }}>
      <h1>Batch Report - تقرير الصهرة</h1>
      <p>Batch #{data?.batchNumber}</p>
      <p>Date: {data?.date}</p>
      <p>Total Input: {data?.totalInputQty} kg</p>
      <p>Total Output: {data?.totalOutputQty} kg</p>
      <p>Loss Ratio: {data?.lossRatio ? (Number(data.lossRatio) * 100).toFixed(2) : 0}%</p>
      <p>Total Cost: {data?.totalCost} EGP</p>
      <p>Cost/Kg: {data?.costPerKg} EGP</p>
    </div>
  );
}

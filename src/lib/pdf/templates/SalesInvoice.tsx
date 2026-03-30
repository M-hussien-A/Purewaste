export function SalesInvoice({ data }: { data: any }) {
  return (
    <div style={{ padding: 20, fontFamily: 'Noto Sans Arabic, sans-serif' }}>
      <h1>Sales Invoice - فاتورة مبيعات</h1>
      <p>Customer: {data?.customer?.nameAr || data?.customer?.name}</p>
      <p>Product: {data?.product?.nameAr || data?.product?.name}</p>
      <p>Quantity: {data?.quantity} kg</p>
      <p>Price/Kg: {data?.pricePerKg} EGP</p>
      <p>Total: {data?.totalRevenue} EGP</p>
    </div>
  );
}

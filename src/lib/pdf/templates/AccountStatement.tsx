export function AccountStatement({ data }: { data: any }) {
  return (
    <div style={{ padding: 20, fontFamily: 'Noto Sans Arabic, sans-serif' }}>
      <h1>Account Statement - كشف حساب</h1>
      <p>Entity: {data?.entity?.nameAr || data?.entity?.name}</p>
      <p>Type: {data?.entityType}</p>
      <p>Balance: {data?.balance?.toString()} EGP</p>
    </div>
  );
}

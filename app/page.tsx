const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Yatharth";

export default function HomePage() {
  return (
    <main>
      <h1>{brand}</h1>
    </main>
  );
}

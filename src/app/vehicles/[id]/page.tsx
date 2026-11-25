import Link from "next/link";

export default function VehicleProfilePlaceholder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  void params;
  return (
    <section>
      <h1>Vehicle Profile</h1>
      <p>The vehicle profile page is implemented in a later step.</p>
      <Link className="button button--secondary" href="/vehicles">Back to Vehicle Register</Link>
    </section>
  );
}

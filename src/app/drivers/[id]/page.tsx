import Link from "next/link";

export default function DriverProfilePlaceholder() {
  return (
    <section>
      <h1>Driver Profile</h1>
      <p>The driver profile page is implemented in Step 6.3.</p>
      <Link className="button button--secondary" href="/drivers">Back to Driver Register</Link>
    </section>
  );
}

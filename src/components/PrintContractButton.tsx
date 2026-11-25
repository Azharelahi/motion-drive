"use client";

export default function PrintContractButton({
  label = "Print / Save as PDF",
}: {
  label?: string;
}) {
  return (
    <button className="button button--primary" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}

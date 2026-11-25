"use client";

export default function PrintContractButton() {
  return (
    <button className="button button--primary" type="button" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}

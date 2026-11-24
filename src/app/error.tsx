"use client";

import { useEffect } from "react";
import GlobalErrorBanner from "@/components/GlobalErrorBanner";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="app-error-page">
      <GlobalErrorBanner
        alert={{
          tone: "error",
          title: "Something went wrong",
          message: "This page could not be displayed. Try again to reload it.",
        }}
      />
      <button className="button button--primary app-error-page__retry" type="button" onClick={retry}>
        Try again
      </button>
    </main>
  );
}

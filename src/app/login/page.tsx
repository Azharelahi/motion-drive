"use client";

import { useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const username = formData.get("username");
    const password = formData.get("password");
    if (typeof username !== "string" || typeof password !== "string") {
      setError("Enter your admin username and password.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Sign-in failed.");
        setLoading(false);
        return;
      }

      const requestedPath = new URLSearchParams(window.location.search).get("callback");
      const callback = requestedPath
        ? new URL(requestedPath, window.location.origin)
        : new URL("/", window.location.origin);
      const destination =
        callback.origin === window.location.origin
          ? `${callback.pathname}${callback.search}${callback.hash}`
          : "/";
      window.location.assign(destination);
    } catch {
      setError("Could not reach the server. Try again.");
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="register-form" aria-labelledby="admin-login-title">
        <h1 id="admin-login-title" style={{ marginTop: 0, color: "#12304d" }}>
          Motion Drive Admin Sign-in
        </h1>
        <p style={{ color: "#667085", fontSize: "0.9rem" }}>
          Sign in with the administrator account to continue.
        </p>

        {error ? (
          <p role="alert" style={{ color: "#8a1c23" }}>
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.8rem" }}>
          <label>
            Username
            <input
              name="username"
              type="text"
              autoComplete="username"
              required
              maxLength={80}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
            />
          </label>
          <button className="button button--primary" type="submit" disabled={loading}>
            <LogIn aria-hidden="true" size={17} />
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

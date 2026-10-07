"use client";

/**
 * The last resort: the root layout itself failed, so nothing of the site (its styles, fonts or theme) can be relied on.
 * It therefore renders its own page with plain inline styles.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: { message: string; digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#fbf7ee",
          color: "#1c1a17",
        }}
      >
        <main
          style={{
            maxWidth: "36rem",
            margin: "0 auto",
            padding: "6rem 1.5rem",
          }}
        >
          <h1 style={{ fontSize: "2.25rem", lineHeight: 1.05, margin: 0 }}>
            Gridline hit a problem
          </h1>
          <p style={{ lineHeight: 1.5 }}>
            Something went wrong on our side, nothing you did. Try again; if it
            keeps happening, quote the reference below to support.
          </p>
          {error.digest ? (
            <p style={{ fontFamily: "monospace", fontSize: "0.875rem" }}>
              Reference {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              font: "inherit",
              fontWeight: 600,
              padding: "0.6rem 1.1rem",
              background: "#f5c400",
              color: "#1c1a17",
              border: "2px solid #1c1a17",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

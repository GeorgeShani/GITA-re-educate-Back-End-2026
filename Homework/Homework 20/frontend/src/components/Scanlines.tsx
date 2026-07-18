/** A subtle fixed CRT scanline + vignette overlay above all content. */
export function Scanlines() {
  return (
    <div
      aria-hidden="true"
      className="crt-scanlines animate-flicker pointer-events-none fixed inset-0 z-50"
      style={{
        boxShadow: "inset 0 0 180px rgba(0, 0, 0, 0.7)",
      }}
    />
  );
}

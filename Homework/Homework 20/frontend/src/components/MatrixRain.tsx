import { useEffect, useRef } from "react";

const CHARS = "01アイウエオカキクケコサシスセソ<>{}[]/;=+-*&|^~$#";

/** A subtle digital-rain canvas background. Disabled under prefers-reduced-motion. */
export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fontSize = 16;
    let columns = 0;
    let drops: number[] = [];

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.floor(canvas.width / fontSize);
      drops = new Array(columns).fill(0).map(() => Math.random() * -50);
    }

    resize();
    window.addEventListener("resize", resize);

    function draw() {
      if (!ctx || !canvas) return;
      ctx.fillStyle = "rgba(10, 14, 20, 0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < columns; i++) {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)];
        const x = i * fontSize;
        const y = (drops[i] ?? 0) * fontSize;

        ctx.fillStyle = Math.random() > 0.97 ? "#c6ffe0" : "rgba(57, 255, 20, 0.55)";
        ctx.fillText(char ?? "0", x, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        } else {
          drops[i] = (drops[i] ?? 0) + 1;
        }
      }
    }

    const interval = setInterval(draw, 50);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 opacity-30"
    />
  );
}

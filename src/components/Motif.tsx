import { useEffect, useRef } from "react";
import { useInView } from "../hooks/useInView";
import { useReducedMotion } from "../hooks/useReducedMotion";
import type { Showcase } from "../content";

const AURORA_1 = "#35E0C2";
const AURORA_2 = "#7C6CF6";
const EMBER = "#FFB454";

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
) {
  ctx.clearRect(0, 0, w, h);
  const layers = [AURORA_1, AURORA_2, "#8FDCC9"];
  layers.forEach((color, i) => {
    ctx.beginPath();
    const amp = h * 0.14 * (1 - i * 0.2);
    const freq = 0.012 + i * 0.004;
    const phase = t * (0.6 + i * 0.3) + i * 2;
    for (let x = 0; x <= w; x += 4) {
      const y =
        h / 2 +
        Math.sin(x * freq + phase) * amp +
        Math.sin(x * freq * 2.3 + phase * 1.7) * amp * 0.3;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.75 - i * 0.15;
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

type TickerRow = { label: string; value: string };
const TICKER_ROWS: TickerRow[] = [
  { label: "deposit", value: "+124.5 ETH" },
  { label: "withdraw", value: "-38.2 wstETH" },
  { label: "swap", value: "2,401 USDC" },
  { label: "borrow", value: "+9.8 WBTC" },
  { label: "repay", value: "-1,200 DAI" },
];

function drawTicker(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
) {
  ctx.clearRect(0, 0, w, h);
  const rowHeight = h / TICKER_ROWS.length;
  const totalHeight = TICKER_ROWS.length * rowHeight;
  const scroll = (t * 22) % totalHeight;
  const rows = TICKER_ROWS.concat(TICKER_ROWS);
  ctx.font = '12px "JetBrains Mono", monospace';
  rows.forEach((row, i) => {
    const y = i * rowHeight - scroll;
    if (y < -rowHeight || y > h) return;
    ctx.globalAlpha = Math.max(0.2, 1 - Math.abs(y - h / 2) / h);
    ctx.fillStyle = i % 2 === 0 ? AURORA_1 : AURORA_2;
    ctx.fillRect(12, y + rowHeight * 0.3, 6, 6);
    ctx.fillStyle = "#E9EEF7";
    ctx.fillText(row.label, 28, y + rowHeight * 0.65);
    ctx.fillStyle = "#96A0B5";
    ctx.textAlign = "right";
    ctx.fillText(row.value, w - 16, y + rowHeight * 0.65);
    ctx.textAlign = "left";
  });
  ctx.globalAlpha = 1;
}

function drawSpark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  for (let i = 0; i < 3; i++) {
    const pulse = (Math.sin(t * 1.4 + i * 2.1) + 1) / 2;
    const radius = 14 + pulse * 40 + i * 18;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = i === 0 ? EMBER : i === 1 ? AURORA_1 : AURORA_2;
    ctx.globalAlpha = 0.5 * (1 - pulse * 0.6);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fillStyle = EMBER;
  ctx.globalAlpha = 1;
  ctx.fill();
}

const DRAWERS: Record<Showcase["motif"], typeof drawWaveform> = {
  waveform: drawWaveform,
  ticker: drawTicker,
  spark: drawSpark,
};

export function Motif({ type }: { type: Showcase["motif"] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { ref: containerRef, inView } = useInView<HTMLDivElement>();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = DRAWERS[type];
    const rect = canvas.getBoundingClientRect();

    if (reducedMotion || !inView) {
      draw(ctx, rect.width, rect.height, 0);
      return () => window.removeEventListener("resize", resize);
    }

    let rafId = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const t = (now - start) / 1000;
      const r = canvas.getBoundingClientRect();
      draw(ctx, r.width, r.height, t);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [type, inView, reducedMotion]);

  return (
    <div
      ref={containerRef}
      className="glass aspect-[4/3] w-full overflow-hidden rounded-2xl p-4"
    >
      <canvas ref={canvasRef} aria-hidden="true" className="h-full w-full" />
    </div>
  );
}

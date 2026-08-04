import { useEffect, useRef, useState } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function CaspianLogo() {
  return <div className="brand-mark" aria-hidden="true">
    <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22"/><path d="M8 27c8-8 14 5 22-3 4-4 7-4 11-2"/><path d="M10 33c7-5 13 4 20-2 4-3 7-3 10-2"/></svg>
    <strong>CS</strong>
  </div>;
}

export function OceanCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let pointerX = .72;
    let pointerY = .32;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      const ratio = Math.min(devicePixelRatio, 2);
      canvas.width = Math.floor(canvas.clientWidth * ratio);
      canvas.height = Math.floor(canvas.clientHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const point = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      pointerX = (event.clientX - box.left) / box.width;
      pointerY = (event.clientY - box.top) / box.height;
    };
    const draw = (time = 0) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.clearRect(0, 0, width, height);
      const glow = context.createRadialGradient(pointerX * width, pointerY * height, 0, pointerX * width, pointerY * height, width * .48);
      glow.addColorStop(0, "rgba(43,162,255,.18)"); glow.addColorStop(.55, "rgba(73,91,220,.06)"); glow.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = glow; context.fillRect(0, 0, width, height);
      for (let line = 0; line < 8; line++) {
        context.beginPath();
        for (let x = -20; x <= width + 20; x += 18) {
          const y = height * (.18 + line * .105) + Math.sin(x * .009 + time * .00022 + line * .9) * (18 + line * 3) + Math.sin(x * .021 - time * .00013) * 7;
          if (x === -20) context.moveTo(x, y); else context.lineTo(x, y);
        }
        context.strokeStyle = `rgba(${95 + line * 5},${174 + line * 4},255,${.14 - line * .009})`;
        context.lineWidth = 1;
        context.stroke();
      }
      if (!reduced) frame = requestAnimationFrame(draw);
    };
    resize(); draw();
    addEventListener("resize", resize); canvas.addEventListener("pointermove", point);
    return () => { cancelAnimationFrame(frame); removeEventListener("resize", resize); canvas.removeEventListener("pointermove", point); };
  }, []);
  return <canvas ref={ref} className="ocean-canvas" aria-hidden="true"/>;
}

export function InstallApp() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android">("ios");
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const remember = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
    addEventListener("beforeinstallprompt", remember);
    return () => removeEventListener("beforeinstallprompt", remember);
  }, []);
  async function install() {
    if (!installEvent) { setOpen(true); return; }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setInstallEvent(null);
  }
  return <>
    <button className="install-button" onClick={install}><span>↓</span> Установить приложение</button>
    {open && <div className="install-backdrop" role="presentation" onClick={() => setOpen(false)}>
      <section className="install-sheet" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={(event) => event.stopPropagation()}>
        <button className="install-close" aria-label="Закрыть" onClick={() => setOpen(false)}>×</button>
        <CaspianLogo/><p className="eyebrow">CASPIAN SENTINEL PWA</p><h2 id="install-title">Заберите наблюдение с собой</h2>
        <p>Приложение откроет камеру, определит координаты и сохранит отчёт даже с мобильного экрана.</p>
        <div className="platform-tabs"><button className={platform === "ios" ? "active" : ""} onClick={() => setPlatform("ios")}>iPhone</button><button className={platform === "android" ? "active" : ""} onClick={() => setPlatform("android")}>Android</button></div>
        {platform === "ios" ? <ol><li>Откройте сайт именно в Safari.</li><li>Нажмите кнопку «Поделиться» внизу экрана.</li><li>Выберите «На экран Домой» и нажмите «Добавить».</li></ol> : <ol><li>Откройте сайт в Chrome или Samsung Internet.</li><li>Откройте меню браузера ⋮.</li><li>Выберите «Установить приложение» или «Добавить на главный экран».</li></ol>}
        <small>После установки Caspian Sentinel запускается как отдельное приложение.</small>
      </section>
    </div>}
  </>;
}

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";

type Signal = {
  id: string;
  latitude: number;
  longitude: number;
  status: string;
  category: string;
  confidence: number;
  severity: string;
  summary: string;
  original_url: string;
};

type Task = { status: string };

const categoryName = (value: string) => value === "unknown" ? "Ожидает анализа" : value.replaceAll("_", " ");

export function Explore({ signals, tasks, onReport, onOpenTasks }: {
  signals: Signal[];
  tasks: Task[];
  onReport: () => void;
  onOpenTasks: () => void;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Signal | null>(signals[0] ?? null);
  const [metric, setMetric] = useState<"severity" | "confidence">("severity");
  const [intro, setIntro] = useState(true);
  const active = tasks.filter((task) => task.status !== "VERIFIED").length;
  const verified = tasks.filter((task) => task.status === "VERIFIED").length;
  const confidence = useMemo(() => signals.length ? Math.round(signals.reduce((sum, item) => sum + item.confidence, 0) / signals.length * 100) : 0, [signals]);

  useEffect(() => {
    const timer = window.setTimeout(() => setIntro(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mapElement.current) return;
    const map = L.map(mapElement.current, { zoomControl: false, attributionControl: false, minZoom: 4 }).setView([42.4, 50.7], 6);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    signals.forEach((signal) => {
      const dangerous = signal.severity === "critical" || signal.severity === "high";
      const tone = metric === "confidence" ? (signal.confidence >= .75 ? "cyan" : "amber") : (dangerous ? "coral" : "cyan");
      const marker = L.marker([signal.latitude, signal.longitude], {
        icon: L.divIcon({ className: "signal-icon", html: `<span class="signal-pulse ${tone}"><i></i><b>${Math.round(signal.confidence * 100)}%</b></span>`, iconSize: [58, 58], iconAnchor: [29, 29] }),
      }).addTo(layer);
      marker.on("click", () => setSelected(signal));
    });
    return () => { map.remove(); };
  }, [signals, metric]);

  return <section className="explore">
    <div ref={mapElement} className="explore-map" aria-label="Интерактивная карта экологических наблюдений Каспия" />
    <div className="map-atmosphere" aria-hidden="true"><i/><i/><i/></div>
    <div className="map-scan" aria-hidden="true" />

    <div className="explore-top">
      <div><span className="live-dot"/> LIVE · CASPIAN COAST</div>
      <div className="metric-switch"><button className={metric === "severity" ? "active" : ""} onClick={() => setMetric("severity")}>Приоритет</button><button className={metric === "confidence" ? "active" : ""} onClick={() => setMetric("confidence")}>AI confidence</button></div>
    </div>

    <aside className="mission-panel">
      <p className="eyebrow">CASPIAN RESPONSE NETWORK</p>
      <h1>Каспий.<br/><em>Видеть. Действовать.</em></h1>
      <p>Живая карта загрязнений, где снимок с телефона становится проверенным AI-наблюдением и задачей на очистку.</p>
      <button className="report-action" onClick={onReport}><span>＋</span><b>Сообщить о загрязнении</b><small>камера · GPS · Gemini Vision</small></button>
      <div className="real-data"><span>Только реальные данные MVP</span><strong>{signals.length} наблюдений · {active} активных задач</strong></div>
    </aside>

    {selected && <aside className="signal-detail">
      <button className="detail-close" onClick={() => setSelected(null)}>×</button>
      <img src={selected.original_url} alt="Наблюдение"/>
      <div className="detail-body">
        <div className="detail-meta"><span>{selected.severity}</span><b>{Math.round(selected.confidence * 100)}% AI</b></div>
        <h2>{categoryName(selected.category)}</h2>
        <p>{selected.summary}</p>
        <small>⌖ {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}</small>
      </div>
    </aside>}

    <div className="explore-stats">
      <div><span>Наблюдения</span><strong>{signals.length}</strong></div>
      <div><span>Средняя точность AI</span><strong>{confidence || "—"}{confidence ? "%" : ""}</strong></div>
      <div><span>Задачи в работе</span><strong>{active}</strong></div>
      <button onClick={onOpenTasks}><span>Доказано очисткой</span><strong>{verified}</strong><i>Открыть задачи →</i></button>
    </div>

    <div className={`launch-sequence ${intro ? "visible" : ""}`} aria-hidden={!intro}>
      <div className="launch-orbit"><i/><i/><i/></div>
      <p>CASPIAN SENTINEL</p><h2>Море становится<br/>видимым.</h2><span>Инициализация экологической карты</span>
    </div>
  </section>;
}

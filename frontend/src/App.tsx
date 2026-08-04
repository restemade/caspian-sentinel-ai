import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FormEvent, useEffect, useRef, useState } from "react";

type Observation = {
  id: string; created_at: string; latitude: number; longitude: number; status: string;
  category: string; confidence: number; severity: string; summary: string;
  original_url: string; evidence_url: string | null; cv_metrics: { quality?: string; region_count?: number };
};
type Incident = { id: string; title: string; status: string; latitude: number; longitude: number; category: string; severity: string; confidence: number; recommendation: string; ticket_id: string };
type Ticket = { id: string; incident_id: string; status: string; assignee: string | null; after_url: string | null };
type View = "overview" | "capture" | "map" | "tasks";

function IncidentMap({ incidents }: { incidents: Incident[] }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!element.current) return;
    const map = L.map(element.current, { zoomControl: false }).setView([43.635, 51.168], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    for (const incident of incidents) {
      const color = incident.severity === "critical" || incident.severity === "high" ? "#ff806b" : "#6de3c7";
      L.circleMarker([incident.latitude, incident.longitude], { radius: 12, color, weight: 3, fillColor: color, fillOpacity: .28 })
        .bindPopup(`<strong>${incident.title}</strong><br>${incident.status}<br>${Math.round(incident.confidence * 100)}% AI confidence`)
        .addTo(map);
    }
    return () => { map.remove(); };
  }, [incidents]);
  return <div ref={element} className="map" aria-label="Карта экологических инцидентов" />;
}

function TicketCard({ ticket, reload }: { ticket: Ticket; reload: () => Promise<void> }) {
  const [after, setAfter] = useState<File | null>(null);
  async function setStatus(status: string, assignee = ticket.assignee) {
    await fetch(`/api/tickets/${ticket.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, assignee }) });
    await reload();
  }
  async function upload() {
    if (!after) return;
    const body = new FormData(); body.append("image", after);
    await fetch(`/api/tickets/${ticket.id}/evidence`, { method: "POST", body });
    await reload();
  }
  return <article className="ticket">
    <div className="meta"><span>{ticket.status}</span><span>{ticket.id.slice(0, 8)}</span></div>
    <h3>Задача по очистке</h3><p>{ticket.assignee ? `Ответственный: ${ticket.assignee}` : "Ожидает волонтёра"}</p>
    {ticket.after_url && <img className="after" src={ticket.after_url} alt="Результат после уборки" />}
    {ticket.status === "OPEN" && <button className="primary" onClick={() => setStatus("ASSIGNED", "Volunteer Demo")}>Принять задачу</button>}
    {ticket.status === "ASSIGNED" && <><label className="small-upload">Фото после уборки<input type="file" accept="image/*" capture="environment" onChange={(e) => setAfter(e.target.files?.[0] ?? null)} /></label><button className="primary" disabled={!after} onClick={upload}>Отправить результат</button></>}
    {ticket.status === "COMPLETED" && <button className="primary" onClick={() => setStatus("VERIFIED")}>Подтвердить закрытие</button>}
    {ticket.status === "VERIFIED" && <div className="verified">✓ Работа подтверждена</div>}
  </article>;
}

function Overview({ incidents, tickets, observations, openCapture }: {
  incidents: Incident[]; tickets: Ticket[]; observations: Observation[]; openCapture: () => void;
}) {
  const active = tickets.filter((ticket) => ticket.status !== "VERIFIED").length;
  const verified = tickets.filter((ticket) => ticket.status === "VERIFIED").length;
  const confidence = observations.length
    ? Math.round(observations.reduce((sum, item) => sum + item.confidence, 0) / observations.length * 100)
    : 0;
  return <section className="command">
    <div className="command-hero">
      <div className="command-copy">
        <p className="eyebrow">CASPIAN ENVIRONMENTAL OPERATING SYSTEM</p>
        <h1>Море говорит.<br/><em>Мы превращаем сигнал в действие.</em></h1>
        <p>Единый контур наблюдения, AI-анализа и координации очистки побережья Каспия.</p>
        <div className="command-actions"><button className="primary" onClick={openCapture}>Зафиксировать загрязнение</button><span><i/> Система наблюдения активна</span></div>
      </div>
      <div className="sea-stage" aria-label="Оперативная схема Каспийского моря">
        <div className="sea-glow"/><div className="sea-orbit orbit-a"/><div className="sea-orbit orbit-b"/>
        <svg viewBox="0 0 440 620" role="img" aria-label="Контур Каспийского моря">
          <defs><linearGradient id="sea" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#83dcff"/><stop offset="1" stopColor="#667cff"/></linearGradient></defs>
          <path d="M235 20C185 38 153 91 157 142c4 48-29 84-36 132-7 47 19 78 10 119-10 44-54 69-45 119 10 55 63 91 111 88 49-4 76-43 93-87 19-49 56-85 62-139 6-53-35-83-41-129-6-50 27-92 12-143-14-48-43-96-88-82Z" fill="url(#sea)" fillOpacity=".18" stroke="url(#sea)" strokeWidth="2"/>
          <path d="M225 52c-31 35-32 85-17 126 13 37-4 77-18 111-16 38-13 79 10 112 25 35 18 87-8 130" fill="none" stroke="#bcecff" strokeOpacity=".28" strokeDasharray="5 10"/>
        </svg>
        <div className="pulse p1"><b>01</b><span>Актау<br/><small>AI PILOT</small></span></div>
        <div className="pulse p2"><b>02</b><span>Порт<br/><small>MONITORING</small></span></div>
        <div className="pulse p3"><b>03</b><span>Южный сектор<br/><small>COMMUNITY</small></span></div>
        <div className="stage-label"><span>LIVE NETWORK</span><strong>{incidents.length || 3} узла наблюдения</strong></div>
      </div>
    </div>
    <div className="signal-strip">
      <div><span>НАБЛЮДЕНИЯ</span><strong>{observations.length}</strong><small>фото с геопозицией</small></div>
      <div><span>AI CONFIDENCE</span><strong>{confidence || "—"}{confidence ? "%" : ""}</strong><small>средняя уверенность</small></div>
      <div><span>АКТИВНЫЕ ЗАДАЧИ</span><strong>{active}</strong><small>ожидают реакции</small></div>
      <div><span>ЗАКРЫТО</span><strong>{verified}</strong><small>подтверждено фото</small></div>
    </div>
    <div className="capability-grid">
      <article className="capability featured"><span>01 / VISION</span><h2>AI видит то, что требует внимания</h2><p>Gemini понимает сцену, OpenCV сохраняет проверяемую визуальную разметку, оператор принимает решение.</p><button onClick={openCapture}>Открыть AI-наблюдение →</button></article>
      <article className="capability"><span>02 / RESPONSE</span><h3>От сигнала до исполнителя</h3><p>Подтверждённый инцидент появляется на карте и превращается в задачу с фотографией результата.</p><div className="mini-flow"><i>Фото</i><b>→</b><i>AI</i><b>→</b><i>Задача</i></div></article>
      <article className="capability"><span>03 / DIGITAL TWIN</span><h3>Плавучая станция</h3><p>Следующий контур объединит телеметрию воды, энергетику и прогнозирование в цифровом двойнике.</p><div className="station-mark"><i/><i/><i/><strong>CS–01</strong></div></article>
    </div>
  </section>;
}

export function App() {
  const [view, setView] = useState<View>("overview");
  const [items, setItems] = useState<Observation[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [coords, setCoords] = useState({ latitude: 43.635, longitude: 51.168 });
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const load = async () => {
    try {
      const [a, b, c] = await Promise.all([fetch("/api/observations"), fetch("/api/incidents"), fetch("/api/tickets")]);
      setItems(await a.json()); setIncidents(await b.json()); setTickets(await c.json());
    } catch { setError("API недоступен"); }
  };
  useEffect(() => { void load(); }, []);
  function locate() { navigator.geolocation?.getCurrentPosition((p) => setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude }), () => setError("GPS недоступен — используются демонстрационные координаты.")); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!file) return; setBusy(true); setError("");
    const body = new FormData(); body.append("image", file); body.append("latitude", String(coords.latitude)); body.append("longitude", String(coords.longitude));
    const response = await fetch("/api/observations", { method: "POST", body });
    if (!response.ok) setError((await response.json()).detail ?? "Ошибка анализа"); else { setFile(null); await load(); }
    setBusy(false);
  }
  async function review(id: string, approved: boolean) { await fetch(`/api/observations/${id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approved }) }); await load(); }
  return <main>
    <header><div className="mark">CS</div><div><strong>CASPIAN SENTINEL</strong><small>AI RESPONSE NETWORK</small></div><nav>{(["overview", "capture", "map", "tasks"] as View[]).map((name) => <button className={view === name ? "active" : ""} onClick={() => setView(name)} key={name}>{name === "overview" ? "Центр" : name === "capture" ? "AI обзор" : name === "map" ? "Карта" : "Задачи"}</button>)}</nav><span>LIVE · CASPIAN</span></header>
    {view === "overview" && <Overview incidents={incidents} tickets={tickets} observations={items} openCapture={() => setView("capture")}/>}
    {view === "capture" && <><section className="hero"><div><p className="eyebrow">COMMUNITY ENVIRONMENTAL INTELLIGENCE</p><h1>Увидеть загрязнение.<br/><em>Запустить действие.</em></h1><p>Фотография превращается в проверяемое AI-заключение, инцидент на карте и задачу по очистке.</p></div><form onSubmit={submit}><label className="capture">{file ? file.name : "Сфотографировать загрязнение"}<input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label><div className="coords"><span>{coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</span><button type="button" onClick={locate}>Определить GPS</button></div><button className="analyze" disabled={!file || busy}>{busy ? "OpenCV + Gemini анализируют…" : "Проанализировать"}</button>{error && <p className="error">{error}</p>}</form></section><section className="feed"><div className="section-title"><p className="eyebrow">LIVE EVIDENCE</p><h2>Наблюдения</h2></div>{items.length === 0 && <div className="empty">Загрузите первое наблюдение. Демо-данные всегда отмечаются.</div>}<div className="grid">{items.map((item) => <article key={item.id}><div className="images"><img src={item.original_url} alt="Исходное наблюдение" />{item.evidence_url && <img src={item.evidence_url} alt="CV evidence overlay" />}</div><div className="meta"><span>{item.status}</span><span>{Math.round(item.confidence * 100)}% confidence</span><span>{item.cv_metrics.region_count ?? 0} CV regions</span></div><h3>{item.category.replaceAll("_", " ")}</h3><p>{item.summary}</p>{item.status === "REVIEW" && <div className="actions"><button onClick={() => review(item.id, false)}>Отклонить</button><button onClick={() => review(item.id, true)}>Подтвердить инцидент</button></div>}</article>)}</div></section></>}
    {view === "map" && <section className="workspace"><div className="workspace-head"><div><p className="eyebrow">GEO RESPONSE</p><h2>Карта инцидентов</h2></div><strong>{incidents.length} событий</strong></div><IncidentMap incidents={incidents}/></section>}
    {view === "tasks" && <section className="workspace"><div className="workspace-head"><div><p className="eyebrow">VOLUNTEER OPERATIONS</p><h2>Задачи по очистке</h2></div><strong>{tickets.filter((t) => t.status !== "VERIFIED").length} активных</strong></div><div className="grid">{tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} reload={load}/>)}</div></section>}
  </main>;
}

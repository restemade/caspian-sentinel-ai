import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FormEvent, useEffect, useRef, useState } from "react";
import { CaspianLogo, InstallApp } from "./Experience";
import { Explore } from "./Explore";

type Observation = {
  id: string; created_at: string; latitude: number; longitude: number; status: string;
  category: string; confidence: number; severity: string; summary: string;
  original_url: string; evidence_url: string | null; cv_metrics: { quality?: string; region_count?: number };
};
type Incident = { id: string; title: string; status: string; latitude: number; longitude: number; category: string; severity: string; confidence: number; recommendation: string; ticket_id: string };
type Ticket = { id: string; incident_id: string; status: string; assignee: string | null; after_url: string | null; title: string; category: string; severity: string; latitude: number; longitude: number; before_url: string; recommendation: string };
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
    <div className="ticket-cover"><img src={ticket.before_url} alt="Фото загрязнения"/><div><span>{ticket.severity}</span><strong>{ticket.category.replaceAll("_", " ")}</strong></div></div>
    <div className="ticket-body"><div className="meta"><span>{ticket.status}</span><span>#{ticket.id.slice(0, 6)}</span></div>
    <h3>{ticket.title}</h3><p>{ticket.recommendation}</p><small className="ticket-location">⌖ {ticket.latitude.toFixed(4)}, {ticket.longitude.toFixed(4)}</small>
    <div className="ticket-progress"><i className="done">Обнаружено</i><i className="done">Проверено</i><i className={ticket.status !== "OPEN" ? "done" : ""}>В работе</i><i className={ticket.status === "VERIFIED" ? "done" : ""}>Результат</i></div>
    <p>{ticket.assignee ? `Ответственный: ${ticket.assignee}` : "Задача свободна — её можно принять"}</p>
    {ticket.after_url && <div className="after"><span>ФОТО РЕЗУЛЬТАТА</span><img src={ticket.after_url} alt="Результат после уборки" /></div>}
    {ticket.status === "OPEN" && <button className="primary" onClick={() => setStatus("ASSIGNED", "Volunteer Demo")}>Принять задачу</button>}
    {ticket.status === "ASSIGNED" && <><label className="small-upload">Фото после уборки<input type="file" accept="image/*" capture="environment" onChange={(e) => setAfter(e.target.files?.[0] ?? null)} /></label><button className="primary" disabled={!after} onClick={upload}>Отправить результат</button></>}
    {ticket.status === "COMPLETED" && <button className="primary" onClick={() => setStatus("VERIFIED")}>Подтвердить закрытие</button>}
    {ticket.status === "VERIFIED" && <div className="verified">✓ Работа подтверждена</div>}
    </div>
  </article>;
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
  async function reanalyze(id: string) { setBusy(true); setError(""); const response = await fetch(`/api/observations/${id}/reanalyze`, { method: "POST" }); if (!response.ok) setError("Gemini временно не ответил. Попробуйте ещё раз."); await load(); setBusy(false); }
  return <main>
    <header><CaspianLogo/><div><strong>CASPIAN SENTINEL</strong><small>AI RESPONSE NETWORK</small></div><nav>{(["overview", "capture", "map", "tasks"] as View[]).map((name) => <button className={view === name ? "active" : ""} onClick={() => setView(name)} key={name}>{name === "overview" ? "Главная" : name === "capture" ? "Сообщить" : name === "map" ? "Карта" : "Мои задачи"}</button>)}</nav><InstallApp/></header>
    {view === "overview" && <Explore signals={items} tasks={tickets} onReport={() => setView("capture")} onOpenTasks={() => setView("tasks")}/>}
    {view === "capture" && <><section className="hero"><div><p className="eyebrow">COMMUNITY ENVIRONMENTAL INTELLIGENCE</p><h1>Снимок становится<br/><em>доказуемым действием.</em></h1><p>Камера и GPS фиксируют событие. Gemini объясняет сцену, OpenCV показывает найденные области, а решение всегда подтверждает человек.</p></div><form onSubmit={submit}><label className="capture">{file ? file.name : "Открыть камеру или выбрать фото"}<input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label><div className="coords"><span>{coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</span><button type="button" onClick={locate}>Определить GPS</button></div><button className="analyze" disabled={!file || busy}>{busy ? "Gemini + OpenCV анализируют…" : "Создать AI-наблюдение"}</button>{error && <p className="error">{error}</p>}</form></section><section className="feed"><div className="section-title"><p className="eyebrow">ПРОВЕРЯЕМЫЕ AI-ДОКАЗАТЕЛЬСТВА</p><h2>Наблюдения</h2></div>{items.length === 0 && <div className="empty">Сделайте первое наблюдение с камеры телефона.</div>}<div className="grid">{items.map((item) => <article className="observation-card" key={item.id}><div className="images"><figure><img src={item.original_url} alt="Исходное наблюдение"/><figcaption>ОРИГИНАЛ</figcaption></figure>{item.evidence_url && <figure><img src={item.evidence_url} alt="CV evidence overlay"/><figcaption>CV DEBUG · {item.cv_metrics.region_count ?? 0} ОБЛАСТЕЙ</figcaption></figure>}</div><div className="meta"><span>{item.status}</span><span>{item.confidence ? `${Math.round(item.confidence * 100)}% AI` : "AI НЕ ВЫПОЛНЕН"}</span><span>{item.severity}</span></div><h3>{item.category === "unknown" ? "Требуется AI-анализ" : item.category.replaceAll("_", " ")}</h3><p>{item.summary}</p>{item.confidence === 0 && <button className="reanalyze" disabled={busy} onClick={() => reanalyze(item.id)}>↻ Повторить анализ Gemini</button>}{item.status === "REVIEW" && item.confidence > 0 && <div className="actions"><button onClick={() => review(item.id, false)}>Не является инцидентом</button><button onClick={() => review(item.id, true)}>Подтвердить и создать задачу</button></div>}</article>)}</div></section></>}
    {view === "map" && <section className="workspace"><div className="workspace-head"><div><p className="eyebrow">GEO RESPONSE</p><h2>Карта инцидентов</h2></div><strong>{incidents.length} событий</strong></div><IncidentMap incidents={incidents}/></section>}
    {view === "tasks" && <section className="workspace"><div className="workspace-head"><div><p className="eyebrow">VOLUNTEER OPERATIONS</p><h2>Задачи по очистке</h2></div><strong>{tickets.filter((t) => t.status !== "VERIFIED").length} активных</strong></div><div className="grid">{tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} reload={load}/>)}</div></section>}
  </main>;
}

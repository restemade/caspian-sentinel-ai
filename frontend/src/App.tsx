import { FormEvent, useEffect, useState } from "react";

type Observation = {
  id: string;
  created_at: string;
  latitude: number;
  longitude: number;
  status: string;
  category: string;
  confidence: number;
  severity: string;
  summary: string;
  original_url: string;
  evidence_url: string | null;
  cv_metrics: { quality?: string; region_count?: number };
};

export function App() {
  const [items, setItems] = useState<Observation[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [coords, setCoords] = useState({ latitude: 43.635, longitude: 51.168 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const response = await fetch("/api/observations");
      setItems(await response.json());
    } catch {
      setError("API недоступен");
    }
  };
  useEffect(() => { void load(); }, []);

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (position) => setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => setError("Не удалось получить геолокацию. Можно использовать демонстрационные координаты."),
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true); setError("");
    const body = new FormData();
    body.append("image", file); body.append("latitude", String(coords.latitude)); body.append("longitude", String(coords.longitude));
    const response = await fetch("/api/observations", { method: "POST", body });
    if (!response.ok) setError((await response.json()).detail ?? "Ошибка анализа");
    else { setFile(null); await load(); }
    setBusy(false);
  }

  async function review(id: string, approved: boolean) {
    await fetch(`/api/observations/${id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approved }) });
    await load();
  }

  return <main>
    <header><div className="mark">CS</div><div><strong>CASPIAN SENTINEL</strong><small>AI RESPONSE NETWORK</small></div><span>HACKATHON MVP · DEMO</span></header>
    <section className="hero">
      <div><p className="eyebrow">COMMUNITY ENVIRONMENTAL INTELLIGENCE</p><h1>Увидеть загрязнение.<br/><em>Запустить действие.</em></h1><p>Фотография превращается в проверяемое AI-заключение, инцидент на карте и задачу по очистке.</p></div>
      <form onSubmit={submit}>
        <label className="capture">{file ? file.name : "Сфотографировать загрязнение"}<input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <div className="coords"><span>{coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</span><button type="button" onClick={locate}>Определить GPS</button></div>
        <button className="analyze" disabled={!file || busy}>{busy ? "OpenCV + Gemini анализируют…" : "Проанализировать"}</button>
        {error && <p className="error">{error}</p>}
      </form>
    </section>
    <section className="feed"><div className="section-title"><p className="eyebrow">LIVE EVIDENCE</p><h2>Наблюдения</h2></div>
      {items.length === 0 && <div className="empty">Загрузите первое наблюдение. Демонстрационные данные не маскируются под реальные измерения.</div>}
      <div className="grid">{items.map((item) => <article key={item.id}>
        <div className="images"><img src={item.original_url} alt="Исходное наблюдение" />{item.evidence_url && <img src={item.evidence_url} alt="CV evidence overlay" />}</div>
        <div className="meta"><span>{item.status}</span><span>{Math.round(item.confidence * 100)}% confidence</span><span>{item.cv_metrics.region_count ?? 0} CV regions</span></div>
        <h3>{item.category.replaceAll("_", " ")}</h3><p>{item.summary}</p>
        {item.status === "REVIEW" && <div className="actions"><button onClick={() => review(item.id, false)}>Отклонить</button><button onClick={() => review(item.id, true)}>Подтвердить инцидент</button></div>}
      </article>)}</div>
    </section>
  </main>;
}

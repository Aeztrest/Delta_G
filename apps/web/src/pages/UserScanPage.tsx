import { useCallback, useState } from "react";
import { loadApiKey, saveApiKey } from "../lib/storage.js";
import { generateUnsignedDevnetSampleTx } from "../lib/sampleTx.js";
import type { Cluster } from "../lib/types.js";

type AnalyzeJson = {
  safe?: boolean;
  reasons?: string[];
  riskFindings?: { code: string; severity: string; message: string }[];
  meta?: { cluster?: string; confidence?: string };
};

export function UserScanPage() {
  const [apiKey, setApiKey] = useState(() => loadApiKey());
  const [cluster, setCluster] = useState<Cluster>("devnet");
  const [txB64, setTxB64] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [parsed, setParsed] = useState<AnalyzeJson | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [raw, setRaw] = useState<string | null>(null);

  const persistKey = useCallback(() => saveApiKey(apiKey), [apiKey]);

  const fillSample = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { base64 } = await generateUnsignedDevnetSampleTx();
      setTxB64(base64);
      setCluster("devnet");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const analyze = async () => {
    setLoading(true);
    setErr(null);
    setParsed(null);
    setRaw(null);
    setStatus(null);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
      const r = await fetch("/v1/analyze", {
        method: "POST",
        headers,
        body: JSON.stringify({
          cluster,
          transactionBase64: txB64.trim(),
          policy: {},
        }),
      });
      setStatus(r.status);
      const text = await r.text();
      setRaw(text);
      let j: unknown;
      try {
        j = JSON.parse(text) as unknown;
      } catch {
        j = null;
      }
      if (!r.ok) {
        if (j && typeof j === "object" && j !== null && "error" in j) {
          const er = j as { error?: { message?: string; code?: string } };
          setErr(
            [er.error?.code, er.error?.message].filter(Boolean).join(": ") || text,
          );
        } else {
          setErr(text.slice(0, 500));
        }
        return;
      }
      if (j && typeof j === "object" && j !== null && "safe" in j) {
        setParsed(j as AnalyzeJson);
      } else {
        setErr("Beklenmeyen yanıt biçimi");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const safe = parsed?.safe === true;
  const showResult =
    parsed !== null && status !== null && status >= 200 && status < 300;

  return (
    <div className="user-scan">
      <header className="page-head">
        <h1>Güvenlik taraması</h1>
        <p className="lede">
          Bir Solana işlemini göndermeden önce sunucuya iletin; simülasyon ve kurallara göre özet
          karar alın.
        </p>
      </header>

      <section className="card">
        <label className="label-strong">API anahtarı</label>
        <p className="hint">Sunucu anahtar istiyorsa (çoğu kurulum). Docker: docker-demo-key</p>
        <div className="row">
          <input
            type="password"
            className="input-grow"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Bearer token"
          />
          <button type="button" className="secondary" onClick={persistKey}>
            Kaydet
          </button>
        </div>
      </section>

      <section className="card">
        <label className="label-strong">Ağ</label>
        <select
          className="input-narrow"
          value={cluster}
          onChange={(e) => setCluster(e.target.value as Cluster)}
        >
          <option value="devnet">Devnet (önerilen demo)</option>
          <option value="testnet">Testnet</option>
          <option value="mainnet-beta">Mainnet-beta</option>
        </select>

        <label className="label-strong" style={{ marginTop: "1rem" }}>
          İşlem (base64)
        </label>
        <p className="hint">
          Cüzdan veya araçlarınızdan VersionedTransaction serileştirilmiş hali. Boş bırakmayın.
        </p>
        <textarea
          className="mono tall"
          value={txB64}
          onChange={(e) => setTxB64(e.target.value)}
          placeholder="Base64 VersionedTransaction…"
        />
        <div className="btn-wrap">
          <button type="button" className="secondary" disabled={loading} onClick={fillSample}>
            Örnek devnet işlemi doldur
          </button>
          <button type="button" disabled={loading || !txB64.trim()} onClick={analyze}>
            {loading ? "Analiz ediliyor…" : "İşlemi analiz et"}
          </button>
        </div>
      </section>

      {err ? (
        <div className="card card-error">
          <h2 className="card-title">İstek tamamlanamadı</h2>
          {status !== null ? (
            <p className="status-pill warn">HTTP {status}</p>
          ) : null}
          <p>{err}</p>
        </div>
      ) : null}

      {showResult ? (
        <section className={`verdict ${safe ? "verdict-safe" : "verdict-risk"}`}>
          <p className="verdict-label">{safe ? "Sonuç: güvenli görünüyor" : "Sonuç: risk / engellendi"}</p>
          <p className="verdict-meta">
            {parsed.meta?.cluster ?? cluster} · güven: {parsed.meta?.confidence ?? "—"}
          </p>
          {parsed.reasons?.length ? (
            <ul className="reason-list">
              {parsed.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : null}
          {parsed.riskFindings?.length ? (
            <div className="findings">
              <h3>Risk sinyalleri</h3>
              <ul>
                {parsed.riskFindings.map((f, i) => (
                  <li key={i}>
                    <span className={`sev sev-${f.severity}`}>{f.severity}</span> {f.message}{" "}
                    <code className="code-quiet">{f.code}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <details className="raw-details">
            <summary>Teknik detay (JSON)</summary>
            <pre className="out">{raw}</pre>
          </details>
        </section>
      ) : null}
    </div>
  );
}

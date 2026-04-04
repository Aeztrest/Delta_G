import { useCallback, useState } from "react";
import { loadApiKey } from "../lib/storage.js";
import { generateUnsignedDevnetSampleTx } from "../lib/sampleTx.js";

export type ScenarioRun = {
  runId: string;
  id: string;
  title: string;
  subtitle: string;
  status: number;
  durationMs: number;
  summary: string;
  interpretation: string;
  headers: Record<string, string>;
  bodyText: string;
  bodyJson: unknown;
};

function responseHeaders(r: Response): Record<string, string> {
  const o: Record<string, string> = {};
  r.headers.forEach((v, k) => {
    o[k] = v;
  });
  return o;
}

function paymentRelatedHeaders(h: Record<string, string>): [string, string][] {
  return Object.entries(h).filter(
    ([k]) =>
      /payment|x402|402/i.test(k) || k.toLowerCase().includes("www-authenticate"),
  );
}

async function runScenario(
  id: string,
  title: string,
  subtitle: string,
  exec: () => Promise<Response>,
): Promise<Omit<ScenarioRun, "runId">> {
  const t0 = performance.now();
  const r = await exec();
  const durationMs = Math.round(performance.now() - t0);
  const bodyText = await r.text();
  let bodyJson: unknown = null;
  try {
    bodyJson = JSON.parse(bodyText) as unknown;
  } catch {
    bodyJson = null;
  }
  const headers = responseHeaders(r);
  let summary = `HTTP ${r.status} · ${bodyText.length} bayt`;
  let interpretation = "";

  if (r.status === 200) {
    interpretation =
      "Başarılı yanıt. İçerik tipine göre sağlık veya analiz sonucu dönmüş olmalı.";
  } else if (r.status === 400) {
    interpretation =
      "İstek gövdesi veya işlem geçersiz — Zod / decode hatası. Beklenen demo davranışı.";
  } else if (r.status === 401) {
    interpretation =
      "API anahtarı eksik veya hatalı. Sunucu x402-only değilse önce anahtar gerekir.";
  } else if (r.status === 402) {
    const payHdrs = paymentRelatedHeaders(headers);
    interpretation =
      "HTTP 402: Ödeme gerekli (x402). Aşağıda ödeme / protokolle ilgili başlıklar vurgulanır. İstemci ödeme kanıtı ile tekrar dener.";
    if (payHdrs.length) summary += ` · ${payHdrs.length} ödeme başlığı`;
  } else if (r.status === 502 || r.status === 504) {
    interpretation = "RPC veya ağ zaman aşımı / facilitator hatası olabilir.";
  } else if (r.status === 503) {
    interpretation = "Hazırlık kontrolü: RPC veya yapılandırma eksik olabilir.";
  } else {
    interpretation = "Yanıt kodunu ve gövdeyi inceleyin.";
  }

  return {
    id,
    title,
    subtitle,
    status: r.status,
    durationMs,
    summary,
    interpretation,
    headers,
    bodyText,
    bodyJson,
  };
}

export function JuryLabPage() {
  const [runs, setRuns] = useState<ScenarioRun[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const pushRun = useCallback((run: Omit<ScenarioRun, "runId">) => {
    const full: ScenarioRun = { ...run, runId: `${run.id}-${Date.now()}` };
    setRuns((prev) => [full, ...prev]);
    setSelected(full.runId);
  }, []);

  const runOne = async (id: string) => {
    setLoading(id);
    try {
      let run: Omit<ScenarioRun, "runId">;
      switch (id) {
        case "health":
          run = await runScenario("health", "Canlılık", "GET /health", () =>
            fetch("/health", { headers: { Accept: "application/json" } }),
          );
          break;
        case "ready":
          run = await runScenario("ready", "Hazırlık", "GET /health/ready", () =>
            fetch("/health/ready", { headers: { Accept: "application/json" } }),
          );
          break;
        case "bad400":
          run = await runScenario(
            "bad400",
            "Doğrulama hatası",
            "POST /v1/analyze — eksik transactionBase64",
            () =>
              fetch("/v1/analyze", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                  Authorization: `Bearer ${loadApiKey() || "docker-demo-key"}`,
                },
                body: JSON.stringify({ cluster: "devnet" }),
              }),
          );
          break;
        case "noauth":
          run = await runScenario(
            "noauth",
            "Anahtarsız erişim",
            "POST — Authorization yok, geçerli gövde → 401 veya 402 (x402-only)",
            async () => {
              const { base64 } = await generateUnsignedDevnetSampleTx();
              return fetch("/v1/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({
                  cluster: "devnet",
                  transactionBase64: base64,
                  policy: {},
                }),
              });
            },
          );
          break;
        case "happy":
          run = await runScenario(
            "happy",
            "Tam analiz (anahtarlı)",
            "POST /v1/analyze + kayıtlı API key",
            async () => {
              const key = loadApiKey() || "docker-demo-key";
              const { base64 } = await generateUnsignedDevnetSampleTx();
              return fetch("/v1/analyze", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                  Authorization: `Bearer ${key}`,
                },
                body: JSON.stringify({
                  cluster: "devnet",
                  transactionBase64: base64,
                  policy: {},
                }),
              });
            },
          );
          break;
        default:
          return;
      }
      pushRun(run);
    } finally {
      setLoading(null);
    }
  };

  const runAll = async () => {
    for (const id of ["health", "ready", "bad400", "noauth", "happy"]) {
      await runOne(id);
    }
  };

  const active = runs.find((r) => r.runId === selected) ?? runs[0];

  return (
    <div className="jury-lab">
      <header className="page-head">
        <h1>Jüri laboratuvarı</h1>
        <p className="lede">
          Canlı sunucuya tek tıkla senaryolar. Özellikle <strong>HTTP 402</strong> ve x402 başlıkları
          jüri demosunda protokolün “ödeme beklentisi” anını gösterir. Sunucu yalnızca API anahtarı
          istiyorsa <code>x402probe</code> ve <code>noauth</code> <strong>401</strong> döner — o
          zaman ortamda <code>X402_ENABLED=true</code> ve uygun <code>DELTAG_AUTH_MODE</code>{" "}
          gerekir.
        </p>
      </header>

      <div className="card jury-actions">
        <button type="button" className="secondary" disabled={loading !== null} onClick={runAll}>
          Tüm senaryoları sırayla çalıştır
        </button>
      </div>

      <div className="scenario-grid">
        {(
          [
            ["health", "Canlılık", "/health"],
            ["ready", "Hazırlık", "/health/ready"],
            ["bad400", "400 doğrulama", "Eksik gövde + anahtar"],
            ["noauth", "401 / 402", "Anahtarsız — x402-only ise 402"],
            ["happy", "200 analiz", "Anahtar + örnek tx"],
          ] as const
        ).map(([id, t, d]) => (
          <button
            key={id}
            type="button"
            className={`scenario-card ${loading === id ? "loading" : ""}`}
            disabled={loading !== null}
            onClick={() => runOne(id)}
          >
            <span className="sc-title">{t}</span>
            <span className="sc-desc">{d}</span>
            {loading === id ? <span className="sc-spin">…</span> : null}
          </button>
        ))}
      </div>

      {active ? (
        <section className="card jury-result">
          <div className="jury-result-head">
            <h2 className="card-title">{active.title}</h2>
            <span
              className={`status-pill ${
                active.status === 200
                  ? "ok"
                  : active.status === 402
                    ? "pay"
                    : active.status === 400 || active.status === 401
                      ? "warn"
                      : "err"
              }`}
            >
              HTTP {active.status}
            </span>
            <span className="timing">{active.durationMs} ms</span>
          </div>
          <p className="hint">{active.subtitle}</p>
          <p className="interpret">{active.interpretation}</p>
          <p className="summary-line">{active.summary}</p>

          {paymentRelatedHeaders(active.headers).length > 0 ? (
            <div className="pay-hl">
              <h3>Ödeme / x402 başlıkları</h3>
              <table className="hdr-table">
                <tbody>
                  {paymentRelatedHeaders(active.headers).map(([k, v]) => (
                    <tr key={k}>
                      <th>{k}</th>
                      <td>
                        <code>{v.length > 200 ? `${v.slice(0, 200)}…` : v}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <details open>
            <summary>Tüm yanıt başlıkları</summary>
            <table className="hdr-table">
              <tbody>
                {Object.entries(active.headers).map(([k, v]) => (
                  <tr key={k}>
                    <th>{k}</th>
                    <td>
                      <code>{v.length > 160 ? `${v.slice(0, 160)}…` : v}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          <h3 className="subsection-title">Gövde</h3>
          <pre className="out">
            {active.bodyJson
              ? JSON.stringify(active.bodyJson, null, 2)
              : active.bodyText}
          </pre>
        </section>
      ) : (
        <p className="hint card">Senaryo çalıştırın; sonuç burada görünür.</p>
      )}

      {runs.length > 1 ? (
        <div className="card">
          <h3 className="subsection-title">Geçmiş ({runs.length})</h3>
          <ul className="run-history">
            {runs.map((r) => (
              <li key={r.runId}>
                <button type="button" className="linkish" onClick={() => setSelected(r.runId)}>
                  {r.title}
                </button>{" "}
                — {r.status} — {r.durationMs}ms
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

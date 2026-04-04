import { useCallback, useMemo, useState } from "react";
import { API_KEY_STORAGE, loadApiKey, saveApiKey } from "../lib/storage.js";
import { generateUnsignedDevnetSampleTx } from "../lib/sampleTx.js";
import type { Cluster } from "../lib/types.js";

type FormTab = "form" | "raw";

function cleanPolicy(p: {
  maxLossPercent: string;
  minPostUsdcBalance: string;
  minPostTokenMint: string;
  blockApprovalChanges: boolean;
  blockDelegateChanges: boolean;
  blockRiskyPrograms: boolean;
  blockUnknownProgramExposure: boolean;
  allowWarnings: boolean;
  requireSuccessfulSimulation: boolean;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.maxLossPercent.trim() !== "") {
    const n = Number(p.maxLossPercent);
    if (!Number.isNaN(n)) out.maxLossPercent = n;
  }
  if (p.minPostUsdcBalance.trim() !== "") {
    const n = Number(p.minPostUsdcBalance);
    if (!Number.isNaN(n)) out.minPostUsdcBalance = n;
  }
  if (p.minPostTokenMint.trim()) out.minPostTokenMint = p.minPostTokenMint.trim();
  if (p.blockApprovalChanges) out.blockApprovalChanges = true;
  if (p.blockDelegateChanges) out.blockDelegateChanges = true;
  if (p.blockRiskyPrograms) out.blockRiskyPrograms = true;
  if (p.blockUnknownProgramExposure) out.blockUnknownProgramExposure = true;
  if (p.allowWarnings) out.allowWarnings = true;
  if (p.requireSuccessfulSimulation) out.requireSuccessfulSimulation = true;
  return out;
}

const defaultPolicy = () => ({
  maxLossPercent: "",
  minPostUsdcBalance: "",
  minPostTokenMint: "",
  blockApprovalChanges: false,
  blockDelegateChanges: false,
  blockRiskyPrograms: false,
  blockUnknownProgramExposure: false,
  allowWarnings: false,
  requireSuccessfulSimulation: false,
});

export function DevConsole() {
  const [apiKey, setApiKey] = useState(() => loadApiKey());
  const [tab, setTab] = useState<FormTab>("form");
  const [cluster, setCluster] = useState<Cluster>("devnet");
  const [txB64, setTxB64] = useState("");
  const [userWallet, setUserWallet] = useState("");
  const [integratorRequestId, setIntegratorRequestId] = useState("");
  const [policy, setPolicy] = useState(defaultPolicy);
  const [rawJson, setRawJson] = useState(
    () =>
      JSON.stringify(
        { cluster: "devnet", transactionBase64: "", policy: {} },
        null,
        2,
      ),
  );

  const [healthOut, setHealthOut] = useState("");
  const [readyOut, setReadyOut] = useState("");
  const [analyzeOut, setAnalyzeOut] = useState("");
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const persistKey = useCallback(() => {
    saveApiKey(apiKey);
  }, [apiKey]);

  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey.trim()) h.Authorization = `Bearer ${apiKey.trim()}`;
    return h;
  }, [apiKey]);

  const runHealth = async () => {
    setLoading("health");
    setHealthOut("");
    try {
      const r = await fetch("/health");
      setHealthOut(`${r.status}\n${await r.text()}`);
    } catch (e) {
      setHealthOut(String(e));
    } finally {
      setLoading(null);
    }
  };

  const runReady = async () => {
    setLoading("ready");
    setReadyOut("");
    try {
      const r = await fetch("/health/ready");
      setReadyOut(`${r.status}\n${await r.text()}`);
    } catch (e) {
      setReadyOut(String(e));
    } finally {
      setLoading(null);
    }
  };

  const runAnalyze = async () => {
    setLoading("analyze");
    setAnalyzeOut("");
    setStatus(null);
    try {
      let body: unknown;
      if (tab === "raw") body = JSON.parse(rawJson) as unknown;
      else {
        body = {
          cluster,
          transactionBase64: txB64.trim(),
          policy: cleanPolicy(policy),
          ...(userWallet.trim() ? { userWallet: userWallet.trim() } : {}),
          ...(integratorRequestId.trim()
            ? { integratorRequestId: integratorRequestId.trim() }
            : {}),
        };
      }
      const r = await fetch("/v1/analyze", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      setStatus(r.status);
      const text = await r.text();
      try {
        setAnalyzeOut(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setAnalyzeOut(text);
      }
    } catch (e) {
      setAnalyzeOut(e instanceof Error ? e.message : String(e));
      setStatus(null);
    } finally {
      setLoading(null);
    }
  };

  const applyPreset = (id: string) => {
    switch (id) {
      case "missing_fields":
        setTab("raw");
        setRawJson(JSON.stringify({ cluster: "devnet" }, null, 2));
        break;
      case "empty_tx":
        setTab("form");
        setCluster("devnet");
        setTxB64("");
        break;
      case "invalid_b64":
        setTab("form");
        setCluster("devnet");
        setTxB64("not-valid-base64!!!");
        break;
      case "random_b64":
        setTab("form");
        setCluster("devnet");
        {
          const bytes = crypto.getRandomValues(new Uint8Array(48));
          setTxB64(btoa(String.fromCharCode(...bytes)));
        }
        break;
      case "strict_sim":
        setTab("form");
        setPolicy((p) => ({ ...p, requireSuccessfulSimulation: true }));
        break;
      case "permissive":
        setTab("form");
        setPolicy({ ...defaultPolicy(), allowWarnings: true });
        break;
      default:
        break;
    }
  };

  const generateUnsignedDevnetTx = async () => {
    setLoading("gen-tx");
    try {
      const { base64, feePayer } = await generateUnsignedDevnetSampleTx();
      setTab("form");
      setCluster("devnet");
      setTxB64(base64);
      setAnalyzeOut(
        JSON.stringify(
          {
            _note:
              "İmzasız örnek işlem. Simülasyon çoğu zaman başarısız olur; decode + pipeline testi içindir.",
            feePayer,
          },
          null,
          2,
        ),
      );
    } catch (e) {
      setAnalyzeOut(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const badge =
    status === null ? null : status >= 200 && status < 300 ? (
      <span className="badge ok">{status}</span>
    ) : status === 400 || status === 401 ? (
      <span className="badge warn">{status}</span>
    ) : (
      <span className="badge err">{status}</span>
    );

  const pageOrigin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <>
      <header className="page-head">
        <h1>Geliştirici konsolu</h1>
        <p className="lede">
          Ham istekler, policy alanları ve JSON. Tarayıcı: <code>{pageOrigin || "—"}</code> ·
          Depolama anahtarı: <code>{API_KEY_STORAGE}</code>
        </p>
      </header>

      <details className="card">
        <summary>API özeti</summary>
        <div className="card-body">
          <p>
            <code>/health</code>, <code>/health/ready</code>, <code>POST /v1/analyze</code> göreli
            yollarla proxy edilir.
          </p>
        </div>
      </details>

      <section className="card">
        <h2 className="card-title">Kimlik doğrulama</h2>
        <p className="hint">
          Docker varsayılan: <code>docker-demo-key</code>
        </p>
        <div className="row">
          <input
            type="password"
            placeholder="API key (Bearer)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="input-grow"
          />
          <button type="button" className="secondary" onClick={persistKey}>
            Kaydet
          </button>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Sağlık</h2>
        <div className="row">
          <button type="button" disabled={loading !== null} onClick={runHealth}>
            GET /health
          </button>
          <button type="button" disabled={loading !== null} onClick={runReady}>
            GET /health/ready
          </button>
        </div>
        {healthOut ? (
          <>
            <h3 className="subsection-title">/health</h3>
            <pre className="out">{healthOut}</pre>
          </>
        ) : null}
        {readyOut ? (
          <>
            <h3 className="subsection-title">/health/ready</h3>
            <pre className="out">{readyOut}</pre>
          </>
        ) : null}
      </section>

      <section className="card">
        <h2 className="card-title">Senaryolar (hızlı doldur)</h2>
        <div className="btn-wrap">
          <button type="button" className="secondary" onClick={() => applyPreset("missing_fields")}>
            Eksik gövde
          </button>
          <button type="button" className="secondary" onClick={() => applyPreset("empty_tx")}>
            Boş tx
          </button>
          <button type="button" className="secondary" onClick={() => applyPreset("invalid_b64")}>
            Geçersiz base64
          </button>
          <button type="button" className="secondary" onClick={() => applyPreset("random_b64")}>
            Rastgele base64
          </button>
          <button type="button" className="secondary" onClick={() => applyPreset("strict_sim")}>
            Policy: sim zorunlu
          </button>
          <button type="button" className="secondary" onClick={() => applyPreset("permissive")}>
            Policy: uyarı OK
          </button>
          <button
            type="button"
            className="secondary"
            disabled={loading !== null}
            onClick={generateUnsignedDevnetTx}
          >
            Devnet örnek tx üret
          </button>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">POST /v1/analyze</h2>
        <div className="tabs">
          <button
            type="button"
            className={tab === "form" ? "active" : ""}
            onClick={() => setTab("form")}
          >
            Form
          </button>
          <button
            type="button"
            className={tab === "raw" ? "active" : ""}
            onClick={() => setTab("raw")}
          >
            Ham JSON
          </button>
        </div>

        {tab === "form" ? (
          <>
            <div className="row">
              <label>Cluster</label>
              <select
                value={cluster}
                onChange={(e) => setCluster(e.target.value as Cluster)}
                className="input-narrow"
              >
                <option value="devnet">devnet</option>
                <option value="testnet">testnet</option>
                <option value="mainnet-beta">mainnet-beta</option>
              </select>
            </div>
            <label>transactionBase64</label>
            <textarea
              className="mono"
              value={txB64}
              onChange={(e) => setTxB64(e.target.value)}
            />
            <div className="grid-2">
              <div>
                <label>userWallet</label>
                <input
                  type="text"
                  value={userWallet}
                  onChange={(e) => setUserWallet(e.target.value)}
                />
              </div>
              <div>
                <label>integratorRequestId</label>
                <input
                  type="text"
                  value={integratorRequestId}
                  onChange={(e) => setIntegratorRequestId(e.target.value)}
                />
              </div>
            </div>
            <h3 className="subsection-title">Policy</h3>
            <div className="policy-grid">
              {(
                [
                  ["blockApprovalChanges", policy.blockApprovalChanges],
                  ["blockDelegateChanges", policy.blockDelegateChanges],
                  ["blockRiskyPrograms", policy.blockRiskyPrograms],
                  ["blockUnknownProgramExposure", policy.blockUnknownProgramExposure],
                  ["allowWarnings", policy.allowWarnings],
                  ["requireSuccessfulSimulation", policy.requireSuccessfulSimulation],
                ] as const
              ).map(([k, v]) => (
                <label key={k}>
                  <input
                    type="checkbox"
                    checked={v}
                    onChange={(e) =>
                      setPolicy((p) => ({ ...p, [k]: e.target.checked }))
                    }
                  />
                  {k}
                </label>
              ))}
            </div>
            <div className="grid-2" style={{ marginTop: "0.75rem" }}>
              <div>
                <label>maxLossPercent</label>
                <input
                  type="number"
                  value={policy.maxLossPercent}
                  onChange={(e) =>
                    setPolicy((p) => ({ ...p, maxLossPercent: e.target.value }))
                  }
                />
              </div>
              <div>
                <label>minPostUsdcBalance</label>
                <input
                  type="number"
                  value={policy.minPostUsdcBalance}
                  onChange={(e) =>
                    setPolicy((p) => ({ ...p, minPostUsdcBalance: e.target.value }))
                  }
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label>minPostTokenMint</label>
                <input
                  type="text"
                  value={policy.minPostTokenMint}
                  onChange={(e) =>
                    setPolicy((p) => ({ ...p, minPostTokenMint: e.target.value }))
                  }
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <textarea
              className="mono tall"
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
            />
          </>
        )}

        <div className="row" style={{ marginTop: "1rem" }}>
          <button type="button" disabled={loading !== null} onClick={runAnalyze}>
            Analyze gönder
          </button>
          {badge}
        </div>
        {analyzeOut ? (
          <>
            <h3 className="subsection-title">Yanıt</h3>
            <pre className="out">{analyzeOut}</pre>
          </>
        ) : null}
      </section>
    </>
  );
}

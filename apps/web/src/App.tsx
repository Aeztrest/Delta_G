import { useState } from "react";
import { HomePage } from "./pages/HomePage.js";
import { UserScanPage } from "./pages/UserScanPage.js";
import { JuryLabPage } from "./pages/JuryLabPage.js";
import { DevConsole } from "./pages/DevConsole.js";
import { ArchitecturePage } from "./pages/ArchitecturePage.js";

type Route = "home" | "arch" | "scan" | "jury" | "dev";

const nav: { id: Route; label: string; hint: string }[] = [
  { id: "home", label: "Ana sayfa", hint: "Protokol özeti" },
  { id: "arch", label: "Mimari", hint: "Diyagramlar + bileşenler" },
  { id: "scan", label: "Güvenlik taraması", hint: "Son kullanıcı akışı" },
  { id: "jury", label: "Jüri laboratuvarı", hint: "Senaryolar + x402" },
  { id: "dev", label: "Geliştirici", hint: "Ham API" },
];

export function App() {
  const [route, setRoute] = useState<Route>("home");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div
          className="brand"
          onClick={() => setRoute("home")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setRoute("home");
            }
          }}
          role="button"
          tabIndex={0}
        >
          <span className="brand-mark">Δ</span>
          <div>
            <span className="brand-name">DeltaGuard</span>
            <span className="brand-tag">demo</span>
          </div>
        </div>
        <nav className="main-nav" aria-label="Ana menü">
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              className={route === n.id ? "nav-item active" : "nav-item"}
              title={n.hint}
              onClick={() => setRoute(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <div className="top-meta mono">{origin.replace(/^https?:\/\//, "")}</div>
      </header>

      <main className="main-content">
        {route === "home" ? <HomePage /> : null}
        {route === "arch" ? <ArchitecturePage /> : null}
        {route === "scan" ? <UserScanPage /> : null}
        {route === "jury" ? <JuryLabPage /> : null}
        {route === "dev" ? <DevConsole /> : null}
      </main>

      <footer className="site-footer">
        <span>
          İstekler aynı site üzerinden <code>/v1</code> ve <code>/health</code> ile API’ye gider.
        </span>
      </footer>
    </div>
  );
}

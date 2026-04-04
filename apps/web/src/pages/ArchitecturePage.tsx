import { MermaidBlock } from "../components/MermaidBlock.js";

const DIAG_DEPLOY = `
flowchart TB
  subgraph client["Tarayıcı"]
    UI["React demo arayüzü"]
  end
  subgraph edge["Sunucu kenarı"]
    NX["Nginx<br/>statik dosya + proxy"]
  end
  subgraph api["API konteyneri"]
    FY["Fastify<br/>HTTP sunucusu"]
    RL["Rate limit"]
    AUTH["API key kancası"]
    X402["x402 preHandler"]
    RT["POST /v1/analyze"]
  end
  subgraph chain["Dış servisler"]
    RPC["Solana RPC"]
    FAC["x402 facilitator"]
  end
  UI -->|"GET/POST /"| NX
  NX -->|"proxy /v1 /health"| FY
  FY --> RL
  RL --> AUTH
  AUTH --> X402
  X402 --> RT
  RT --> RPC
  RT --> FAC
`;

const DIAG_ANALYZE_SEQ = `
sequenceDiagram
  participant C as İstemci
  participant F as Fastify
  participant X as x402
  participant A as Analyze
  participant R as Solana RPC
  participant P as Policy motoru
  C->>F: POST /v1/analyze + body
  F->>F: Rate limit, API key
  F->>X: Ödeme doğrula (açıksa)
  alt Ödeme yok / hatalı
    X-->>C: 402 veya hata
  end
  X->>A: İşleme devam
  A->>R: getMultipleAccounts + simulate
  R-->>A: Hesap + sim sonucu
  A->>P: Risk + kurallar
  P-->>A: Decision JSON
  A->>A: Zod ile yanıt doğrula
  A->>X: Settlement (başarılıysa)
  A-->>C: 200 + safe/reasons
`;

const DIAG_PIPELINE = `
flowchart TB
  IN["Base64 VersionedTransaction"]
  D["Çözümleme<br/>wire format"]
  K["Statik hesap anahtarları"]
  PF["Ön-fetch<br/>getMultipleAccountsInfo"]
  SIM["simulateTransaction<br/>sigVerify: false"]
  NORM["Normalizasyon<br/>loglar, hesaplar"]
  DEL["Delta çıkarımı<br/>SOL / SPL / onaylar"]
  RISK["Risk bulguları<br/>program / truncation"]
  POL["Policy değerlendirme<br/>deterministik"]
  OUT["Decision<br/>safe, reasons, meta"]
  IN --> D --> K --> PF --> SIM --> NORM --> DEL --> RISK --> POL --> OUT
`;

const COMPONENTS: {
  name: string;
  role: string;
  why: string;
}[] = [
  {
    name: "Fastify",
    role: "Node.js HTTP çatısı",
    why: "Düşük gecikme, plugin modeli (rate limit, raw body), üretimde olgun. İstek kimliği ve timeout tek yerden yönetilir.",
  },
  {
    name: "Zod",
    role: "İstek ve yanıt şemaları",
    why: "Çalışma anında doğrulama: hatalı JSON veya sürüm kayması erken yakalanır; yanıt şekli sözleşmeye bağlanır.",
  },
  {
    name: "@solana/web3.js · Connection",
    role: "RPC istemcisi",
    why: "Resmi benzeri API ile getMultipleAccountsInfo ve simulateTransaction çağrıları; timeout’lu fetch ve tek seferlik timeout retry ile dayanıklılık.",
  },
  {
    name: "Simülasyon + normalizasyon",
    role: "Zincir öncesi görünürlük",
    why: "İşlem yürütülmeden hesap durumu ve loglar toplanır; farklı RPC cevapları tek iç modele indirgenir.",
  },
  {
    name: "Analiz katmanı",
    role: "SOL/SPL tahmini, onay/delege",
    why: "Kullanıcı cüzdanı bağlamında anlamlı özet üretmek için ham simülasyon verisinden iş kuralı çıkarımı.",
  },
  {
    name: "Risk + policy",
    role: "Bulgular ve karar",
    why: "Risk sinyalleri açıklanabilir; policy aynı girdide her zaman aynı çıktıyı verir (denetim ve entegrasyon için uygun).",
  },
  {
    name: "x402 (@x402/core + @x402/svm)",
    role: "HTTP 402 ödeme",
    why: "Kaynak başına ücret: önce doğrulama, analiz sonrası settlement; facilitator ile zincir üstü ödeme akışı standartlaşır.",
  },
  {
    name: "Pino / structured logging",
    role: "Loglama",
    why: "Üretimde aranabilir olaylar; hassas başlıklar redakte edilir.",
  },
  {
    name: "@fastify/rate-limit",
    role: "Kötüye kullanım sınırı",
    why: "RPC ve CPU maliyetini sınırlar; ters proxy arkasında trustProxy ile istemci IP’si kullanılabilir.",
  },
  {
    name: "Nginx (Docker web)",
    role: "Statik UI + reverse proxy",
    why: "Tek origin: tarayıcı CORS ile uğraşmaz; /v1 ve /health API konteynerine iletilir.",
  },
  {
    name: "Docker Compose",
    role: "api + web",
    why: "Aynı ağda servis keşfi, sağlık kontrolü ile web’in API hazır olana kadar beklemesi, tutarlı dağıtım.",
  },
  {
    name: "React (Vite)",
    role: "Demo arayüzü",
    why: "Jüri ve entegratör için canlı senaryolar; gerçek ürün bu API’yi kendi istemcisinden çağırır.",
  },
];

export function ArchitecturePage() {
  return (
    <div className="arch-page">
      <header className="page-head">
        <h1>Mimari ve teknik akış</h1>
        <p className="lede">
          DeltaGuard’ın parçaları, verinin hangi sırayla aktığı ve her bileşenin neden seçildiği — diyagramlar ve
          kısa sözlük.
        </p>
      </header>

      <section className="card arch-section">
        <h2 className="card-title">Dağıtım görünümü</h2>
        <p className="arch-p">
          Tarayıcı önce Nginx’ten React statik dosyalarını alır. API çağrıları aynı host altında{" "}
          <code>/v1</code> ve <code>/health</code> yollarıyla proxy edilir; böylece tarayıcıda CORS karmaşası olmaz.
        </p>
        <MermaidBlock chart={DIAG_DEPLOY} caption="Docker tabanlı demo topolojisi" />
      </section>

      <section className="card arch-section">
        <h2 className="card-title">İstek sırası: POST /v1/analyze</h2>
        <p className="arch-p">
          Önce güvenlik ve maliyet sınırları, isteğe bağlı ödeme doğrulaması, ardından analiz ve yanıtın şema ile
          doğrulanması. x402 açıksa settlement yalnızca geçerli yanıt onayından sonra çalışır.
        </p>
        <MermaidBlock chart={DIAG_ANALYZE_SEQ} caption="Uçtan uca mesaj sırası (özet)" />
      </section>

      <section className="card arch-section">
        <h2 className="card-title">Analiz boru hattı</h2>
        <p className="arch-p">
          İşlem çözümlenir, sınırlı sayıda hesap için ön durum okunur, simülasyon çalıştırılır; çıktı politika
          motoruna düz bir <code>Decision</code> nesnesi olarak gider.
        </p>
        <MermaidBlock chart={DIAG_PIPELINE} caption="Sunucu içi işlem adımları" />
      </section>

      <section className="card arch-section">
        <h2 className="card-title">Bileşen sözlüğü</h2>
        <p className="arch-p">
          Her satır: <strong>ne</strong> (rol) ve <strong>neden</strong> (tasarım gerekçesi).
        </p>
        <div className="component-grid">
          {COMPONENTS.map((c) => (
            <article key={c.name} className="component-card">
              <h3>{c.name}</h3>
              <p className="component-role">{c.role}</p>
              <p className="component-why">{c.why}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card arch-section arch-note">
        <h2 className="card-title">Sınırlar (kısa)</h2>
        <ul className="arch-list">
          <li>Simülasyon, gerçek yürütmeyi garanti etmez; ağ ve blockhash farkları olabilir.</li>
          <li>Hesap listesi üst sınırı (ör. 64) nedeniyle çok hesaplı işlemlerde kısmi görünürlük.</li>
          <li>x402 tam ödeme akışı üretim cüzdanı + facilitator ile yapılır; demo UI ödeme imzalamaz.</li>
        </ul>
      </section>
    </div>
  );
}

export function HomePage() {
  return (
    <div className="home">
      <section className="hero">
        <p className="eyebrow">Solana · HTTP · makine okunur karar</p>
        <h1 className="hero-title">DeltaGuard</h1>
        <p className="hero-sub">
          İşlemi zincire göndermeden önce <strong>simüle eder</strong>, SOL ve token hareketlerini
          tahmin eder, kurallara göre <strong>güvenli / riskli</strong> kararını ve nedenlerini döner.
          İsteğe bağlı <strong>x402</strong> ile çağır başına ödeme alınabilir.
        </p>
        <ol className="steps">
          <li>
            <span className="step-num">1</span>
            <div>
              <strong>İşlem</strong>
              <p className="step-desc">VersionedTransaction (base64) — cüzdan veya entegratör üretir.</p>
            </div>
          </li>
          <li>
            <span className="step-num">2</span>
            <div>
              <strong>Simülasyon + politika</strong>
              <p className="step-desc">RPC üzerinde çalıştırılır; sonuç deterministik kurallarla değerlendirilir.</p>
            </div>
          </li>
          <li>
            <span className="step-num">3</span>
            <div>
              <strong>Karar</strong>
              <p className="step-desc">
                <code>safe</code>, <code>reasons</code>, risk bulguları — uygulamanız kullanıcıya gösterir veya
                engeller.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="card home-cards">
        <h2 className="card-title">Bu sitede ne var?</h2>
        <ul className="feature-list">
          <li>
            <strong>Mimari</strong> — diyagramlarla dağıtım, istek sırası, analiz boru hattı ve bileşen sözlüğü.
          </li>
          <li>
            <strong>Güvenlik taraması</strong> — sade arayüz; tek tıkla örnek işlem veya kendi base64’ünüz.
          </li>
          <li>
            <strong>Jüri laboratuvarı</strong> — canlı sunucuya karşı senaryolar (sağlık, 400, 401,{" "}
            <strong>HTTP 402 + x402</strong> keşfi).
          </li>
          <li>
            <strong>Geliştirici konsolu</strong> — ham JSON ve tüm policy alanları.
          </li>
        </ul>
        <p className="hint" style={{ marginTop: "1rem" }}>
          Simülasyon gerçek yürütmeyi garanti etmez; üretim sınırları için sunucu{" "}
          <code>LIMITATIONS.md</code> dosyasına bakın.
        </p>
      </section>
    </div>
  );
}

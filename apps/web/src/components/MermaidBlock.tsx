import { useEffect, useId, useRef, useState } from "react";

type Props = {
  chart: string;
  caption?: string;
};

export function MermaidBlock({ chart, caption }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const reactId = useId().replace(/:/g, "");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    el.innerHTML = "";
    setErr(null);

    (async () => {
      try {
        const mod = await import("mermaid");
        const mermaid = mod.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "strict",
          themeVariables: {
            primaryColor: "#2d4a7a",
            primaryTextColor: "#e8edf5",
            primaryBorderColor: "#5b9cff",
            lineColor: "#8b98ab",
            secondaryColor: "#1a2130",
            tertiaryColor: "#121722",
            fontFamily: "DM Sans, system-ui, sans-serif",
          },
        });
        const id = `deltag-mermaid-${reactId}-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, chart.trim());
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  return (
    <figure className="mermaid-block">
      {caption ? <figcaption>{caption}</figcaption> : null}
      <div className="mermaid-inner" ref={containerRef} role="img" aria-label={caption ?? "Diyagram"} />
      {err ? <p className="mermaid-error">Diyagram yüklenemedi: {err}</p> : null}
    </figure>
  );
}

import React, { useEffect, useRef, useId, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'strict',
});

interface MermaidDiagramProps {
  chart: string;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const diagramId = `mermaid-${reactId.replace(/:/g, '')}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram(): Promise<void> {
      try {
        const { svg: renderedSvg } = await mermaid.render(diagramId, chart);
        if (!cancelled) {
          setSvg(renderedSvg);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setSvg(null);
          setError(true);
        }
      }
    }

    setSvg(null);
    setError(false);
    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [chart, diagramId]);

  if (error) {
    return (
      <div className="my-4 rounded-lg border border-white/10 bg-surface p-4">
        <p className="mb-2 text-sm text-warning">Diagram could not be rendered</p>
        <pre className="overflow-x-auto text-sm text-secondary">
          <code>{chart}</code>
        </pre>
      </div>
    );
  }

  if (svg) {
    return (
      <div
        ref={containerRef}
        className="my-4 overflow-x-auto rounded-lg border border-white/10 bg-surface p-4"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  return (
    <div className="my-4 flex items-center justify-center rounded-lg border border-white/10 bg-surface p-4 text-sm text-secondary">
      Loading diagram…
    </div>
  );
};

export default MermaidDiagram;

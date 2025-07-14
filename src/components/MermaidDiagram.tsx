// components/MermaidDiagram.tsx
import React, { useEffect, useRef, useId } from 'react';
// import mermaid from 'mermaid'; // Removed: Using global instance

// Define a type for the global mermaid instance for better type safety
// This assumes the 'mermaid' type is available globally or via a type declaration file
// For a quick fix, 'any' can be used, but defining the type is better.
declare global {
  interface Window {
    globalMermaidInstance?: any; // Consider using a more specific type if available from mermaid
  }
}

interface MermaidDiagramProps {
  chart: string; // The Mermaid syntax string
  theme?: 'light' | 'dark'; // Theme prop is kept for useEffect dependency to re-render if app theme changes
}

const sanitizeMermaidChartString = (chartString: string): string => {
  const initDirectiveRegex = /%%\{init:\s*(\{[\s\S]*?\})\s*\}%%/gm;
  const sanitized = chartString.replace(initDirectiveRegex, (match) => {
    console.warn(`[MermaidDiagram] Removed init directive from chart string: ${match}`);
    return '';
  });
  return sanitized;
};

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart, theme }) => {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const componentId = useId();
  const diagramId = `mermaid-chart-${componentId.replace(/:/g, '-')}`;

  useEffect(() => {
    const mermaidInstance = window.globalMermaidInstance;
    if (!mermaidInstance) {
      console.error("[MermaidDiagram.tsx] globalMermaidInstance not found on window object!");
      if (mermaidRef.current) {
        mermaidRef.current.innerHTML = `<div class="p-3 text-sm text-red-500">Mermaid library not available globally. Diagram cannot be rendered.</div>`;
      }
      return;
    }
    console.log('[MermaidDiagram.tsx] Using globalMermaidInstance version:', typeof mermaidInstance.version === 'function' ? mermaidInstance.version() : mermaidInstance.version);

    if (mermaidRef.current && chart && chart.trim() !== "") {
      const currentDiv = mermaidRef.current;
      const debugPrefix = `[MermaidDiagram Debug - ID: ${diagramId}]`;

      currentDiv.removeAttribute('data-processed');
      currentDiv.innerHTML = '';

      const finalChart = sanitizeMermaidChartString(chart);

      // console.log(`${debugPrefix} Sanitized chart (theme: ${theme}):\n${finalChart.substring(0,200)}...`);
      if (chart !== finalChart) {
        console.log(`${debugPrefix} Original chart (had init directive):\n${chart.substring(0,200)}...`);
      }

      mermaidInstance.render(diagramId, finalChart)
        .then(({ svg, bindFunctions }: { svg: string; bindFunctions?: (element: HTMLElement) => void }) => {
          if (currentDiv) {
            currentDiv.innerHTML = svg;
            if (bindFunctions) {
              bindFunctions(currentDiv);
            }
            // console.log(`${debugPrefix} SVG rendered and bindFunctions called.`);

            const foreignObjects = currentDiv.querySelectorAll('svg foreignObject');
            console.log(`${debugPrefix} Rendered. foreignObject count: ${foreignObjects.length}`);
            if (foreignObjects.length > 0) {
                console.warn(`${debugPrefix} foreignObject tags are STILL PRESENT! This indicates htmlLabels:true was effectively used for this render. SVG contains: ${svg.substring(0,500)}...`);
            }
          }
        })
        .catch((e: any) => {
          console.error(`${debugPrefix} Mermaid rendering error:`, e);
          if (currentDiv) {
            currentDiv.innerHTML = `<pre class="text-xs text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded">Mermaid Diagram Render Error: ${(e as Error).message || String(e)}\n--- Chart Syntax Attempted (after sanitization) ---\n${finalChart}</pre>`;
          }
        });

    } else if (mermaidRef.current) {
      const message = chart && chart.trim() !== ""
        ? "Mermaid chart syntax provided, but an issue occurred before rendering or ref became unavailable."
        : "No diagram to display or chart syntax is empty.";
      mermaidRef.current.innerHTML = `<div class="p-3 text-sm text-light-sidenote dark:text-dark-sidenote">${message}</div>`;
    }
  }, [chart, diagramId, theme]);

  return (
    <div
      ref={mermaidRef}
      className="mermaid-container w-full flex flex-col justify-center items-center p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md overflow-auto min-h-[150px]"
      aria-live="polite"
      role="img"
      aria-label={chart && chart.trim() ? "Dynamically rendered diagram" : "No diagram available"}
      key={diagramId}
    >
    </div>
  );
};

export default MermaidDiagram;
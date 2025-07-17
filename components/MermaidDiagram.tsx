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
  uniqueId?: string; // Optional unique identifier to ensure proper component isolation
}

const sanitizeMermaidChartString = (chartString: string): string => {
  const initDirectiveRegex = /%%\{init:\s*(\{[\s\S]*?\})\s*\}%%/gm;
  const sanitized = chartString.replace(initDirectiveRegex, (match) => {
    console.warn(`[MermaidDiagram] Removed init directive from chart string: ${match}`);
    return '';
  });
  return sanitized;
};

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart, theme, uniqueId }) => {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const componentId = useId();
  const diagramId = uniqueId ? `mermaid-chart-${uniqueId}` : `mermaid-chart-${componentId.replace(/:/g, '-')}`;

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

      // Clear any existing content
      currentDiv.innerHTML = '';

      const finalChart = sanitizeMermaidChartString(chart);

      if (chart !== finalChart) {
        console.log(`${debugPrefix} Original chart (had init directive):\n${chart.substring(0,200)}...`);
      }

      try {
        // Create a pre element with mermaid class containing the chart syntax
        currentDiv.innerHTML = `<pre class="mermaid" id="${diagramId}">${finalChart}</pre>`;
        
        // Get the mermaid element we just created
        const mermaidElement = currentDiv.querySelector('.mermaid') as HTMLElement;
        if (!mermaidElement) {
          throw new Error('Failed to create mermaid element');
        }

        // Remove any existing data-processed attribute to force re-render
        mermaidElement.removeAttribute('data-processed');
        
        console.log(`${debugPrefix} Running mermaid.run() on element with chart:`, finalChart.substring(0, 100) + '...');
        
        // Run mermaid on this specific element
        // Wrap in async function to handle the Promise properly
        const runMermaid = async () => {
          try {
            await mermaidInstance.run({ 
              nodes: [mermaidElement],
              suppressErrors: false 
            });
          } catch (runError: any) {
            // In development, React Strict Mode may cause this to fail on second render
            // Check if it's the parentElement error from double rendering
            if (runError.message?.includes('parentElement') || runError.str?.includes('parentElement')) {
              console.log(`${debugPrefix} Mermaid run failed due to React Strict Mode double-render (this is normal in development)`);
              return; // Exit gracefully
            }
            // Log but don't throw - let the component continue
            console.warn(`${debugPrefix} Mermaid rendering warning:`, runError);
          }
        };
        
        // Execute the async function
        runMermaid().catch((e) => {
          // Catch any remaining promise rejections
          if (e.message?.includes('parentElement') || e.str?.includes('parentElement')) {
            console.log(`${debugPrefix} Caught parentElement error in promise (normal in development)`);
          } else {
            console.error(`${debugPrefix} Unexpected error in mermaid.run:`, e);
          }
        });
        
        // Use setTimeout to check the result after Mermaid has finished rendering
        setTimeout(() => {
          if (!mermaidRef.current) return; // Component may have unmounted
          
          const svgElement = currentDiv.querySelector('svg');
          if (svgElement) {
            console.log(`${debugPrefix} SVG successfully rendered`);
            
            // Add some styling for better visibility
            svgElement.style.maxWidth = '100%';
            svgElement.style.height = 'auto';
            
            // Debug: Check if there are any rect or text elements
            const rects = svgElement.querySelectorAll('rect');
            const texts = svgElement.querySelectorAll('text');
            console.log(`${debugPrefix} Found ${rects.length} rect elements and ${texts.length} text elements`);
          } else {
            // This is expected in React Strict Mode's second render
            console.log(`${debugPrefix} No SVG element found (this may be normal in React Strict Mode)`);
          }
        }, 100); // Small delay to allow Mermaid to complete rendering
        
      } catch (e: any) {
        console.error(`${debugPrefix} Mermaid rendering error:`, e);
        if (currentDiv) {
          currentDiv.innerHTML = `<pre class="text-xs text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded">Mermaid Diagram Render Error: ${(e as Error).message || String(e)}\n--- Chart Syntax Attempted (after sanitization) ---\n${finalChart}</pre>`;
        }
      }

    } else if (mermaidRef.current) {
      const message = chart && chart.trim() !== ""
        ? "Mermaid chart syntax provided, but an issue occurred before rendering or ref became unavailable."
        : "No diagram to display or chart syntax is empty.";
      mermaidRef.current.innerHTML = `<div class="p-3 text-sm text-light-sidenote dark:text-dark-sidenote">${message}</div>`;
    }

    // CRITICAL: Cleanup function to handle React Strict Mode double-rendering
    return () => {
      if (mermaidRef.current) {
        const mermaidElement = mermaidRef.current.querySelector('.mermaid');
        if (mermaidElement) {
          mermaidElement.removeAttribute('data-processed');
        }
        mermaidRef.current.innerHTML = '';
      }
    };
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
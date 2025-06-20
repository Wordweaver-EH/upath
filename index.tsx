import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App'; // Changed to named import
import mermaid from 'mermaid'; // Import mermaid from node_modules

// Extend window interface for globalMermaidInstance and reinitializeMermaidTheme
declare global {
  interface Window {
    globalMermaidInstance?: any;
    reinitializeMermaidTheme?: () => void;
  }
}

const initializeMermaidWithCurrentTheme = () => {
  if (!window.globalMermaidInstance) {
    console.error("[index.tsx] Mermaid instance not found on window for theme initialization.");
    return;
  }

  const isDark = document.documentElement.classList.contains('dark');
  console.log(`[index.tsx] Initializing Mermaid theme. Dark mode: ${isDark}`);

  const themeVariables = {
    fontFamily: "'EB Garamond', 'et-book', serif", // Updated font stack
    
    // Core colors
    primaryColor: isDark ? '#1a1a1a' : '#faf8f1',       // Node fill (app background)
    primaryBorderColor: isDark ? '#ff6b6b' : '#a00000', // Node stroke (app accent red)
    primaryTextColor: isDark ? '#e6e6e6' : '#111111',   // Text on primaryColor nodes (Updated for light)
    
    lineColor: isDark ? '#e6e6e6' : '#111111',          // Edge lines and arrowheads (Updated for light)
    textColor: isDark ? '#e6e6e6' : '#111111',          // General text color (if not primaryTextColor) (Updated for light)

    // Cluster styling (explicitly set, though might inherit from primary)
    clusterBkg: isDark ? '#1a1a1a' : '#faf8f1',
    clusterBorder: isDark ? '#ff6b6b' : '#a00000',

    // Gantt specific variables
    ganttTaskDefaultFill: isDark ? '#1a1a1a' : '#faf8f1',
    ganttTaskDefaultBorderColor: isDark ? '#ff6b6b' : '#a00000',
    ganttTaskTodayMarkerStrokeColor: isDark ? '#ff6b6b' : '#a00000',
    
    taskTextLightColor: '#111111', // Updated for light 
    taskTextDarkColor: '#e6e6e6',
    taskTextOutsideColor: isDark ? '#e6e6e6' : '#111111', // Updated for light
    taskTextClickableColor: isDark ? '#ff8c8c' : '#c00000', // Darker/lighter accent for clickable task text

    gridColor: isDark ? '#444444' : '#dcd9d0', // Gantt grid lines
    
    // Potentially other colors if needed for specific diagram types based on Mermaid docs
    // secondaryColor: isDark ? '#...' : '#...',
    // tertiaryColor: isDark ? '#...' : '#...',
    // noteBkgColor: isDark ? '#...' : '#...',
    // noteTextColor: isDark ? '#...' : '#...',
    // noteBorderColor: isDark ? '#...' : '#...',
  };

  try {
    window.globalMermaidInstance.initialize({
      startOnLoad: false,
      htmlLabels: false,
      theme: isDark ? 'dark' : 'base', // Use Mermaid's 'dark' or 'base' theme as a starting point
      themeVariables: themeVariables,
      flowchart: { useMaxWidth: false },
      // Security level can be important if dealing with user-supplied Mermaid strings.
      // securityLevel: 'strict', // or 'loose' or 'antiscript'
    });
    console.log('[index.tsx] Mermaid re-initialized with theme variables:', themeVariables);

    const mermaidApiRuntime = window.globalMermaidInstance.mermaidAPI as any;
    const config = (mermaidApiRuntime && typeof mermaidApiRuntime.getConfig === 'function')
      ? mermaidApiRuntime.getConfig()
      : { htmlLabels: 'unknown', startOnLoad: 'unknown', theme: 'unknown' };
    console.log('[index.tsx] Effective Mermaid config after theme init. htmlLabels:', config.htmlLabels, 'startOnLoad:', config.startOnLoad, 'theme:', config.theme);

  } catch (error) {
     console.error('[index.tsx] ERROR during Mermaid theme re-initialization:', error);
  }
};


// Initialize Mermaid globally, once.
if (!window.globalMermaidInstance) {
  console.log('[index.tsx] Initializing Mermaid globally (first time)...');
  try {
    // Basic initialization first to create the instance
    mermaid.initialize({
      startOnLoad: false,
      htmlLabels: false,
      theme: 'neutral', // A temporary theme before themeVariables are applied
    });
    window.globalMermaidInstance = mermaid;
    
    // Now apply theme-specific variables
    initializeMermaidWithCurrentTheme();
    window.reinitializeMermaidTheme = initializeMermaidWithCurrentTheme; // Expose for theme toggling

    const mermaidApiRuntime = (mermaid && mermaid.mermaidAPI) ? mermaid.mermaidAPI as any : undefined;
    const versionStr = (mermaidApiRuntime && typeof mermaidApiRuntime.getVersion === 'function')
      ? mermaidApiRuntime.getVersion()
      : 'N/A (getVersion API not found or mermaidAPI undefined)';
    console.log('[index.tsx] globalMermaidInstance assigned. Version:', versionStr);

  } catch (error) {
    console.error('[index.tsx] CRITICAL ERROR during initial Mermaid setup:', error);
    // Provide a more resilient dummy object
    window.globalMermaidInstance = {
      render: (id: string, text: string, cb?: (svgCode: string, bindFunctions: (element: Element) => void) => void, container?: Element): Promise<string> | string => {
        const errorMsg = "Mermaid failed to initialize globally.";
        console.error("Dummy render:", errorMsg, {id, text, container});
        if (cb && typeof cb === 'function') {
           try { cb(errorMsg, () => {}); } catch(e){}
        }
        return Promise.reject(new Error(errorMsg));
      },
      run: (options?: any) => console.error("Dummy run: Mermaid failed to initialize globally. Options:", options),
      initialize: (config: any) => console.error("Dummy initialize: Mermaid failed to initialize globally. Config:", config),
      mermaidAPI: { 
          getConfig: () => ({ htmlLabels: true, startOnLoad: true, theme: 'neutral', securityLevel: 'strict' }), // Return a valid config structure
          getVersion: () => "Error: Not Initialized (dummy)",
          parse: (text: string) => { console.error("Dummy parse:", text); return false; },
          // Add other methods if your app might call them on a failed instance
      }
    };
  }
} else {
  // If it already exists, ensure it's re-initialized with current theme
  // This might happen with HMR or if script runs multiple times in some environments
  console.log('[index.tsx] globalMermaidInstance already exists. Re-initializing theme.');
  initializeMermaidWithCurrentTheme();
  window.reinitializeMermaidTheme = initializeMermaidWithCurrentTheme; // Ensure it's exposed
  
  const existingMermaid = window.globalMermaidInstance;
  const existingMermaidApiRuntime = (existingMermaid && existingMermaid.mermaidAPI) ? existingMermaid.mermaidAPI as any : undefined;

  const existingVersion = (existingMermaidApiRuntime && typeof existingMermaidApiRuntime.getVersion === 'function')
    ? existingMermaidApiRuntime.getVersion()
    : "Unknown Version (getVersion API not found or mermaidAPI undefined)";
  console.log('[index.tsx] Existing Mermaid instance version:', existingVersion);

  const existingConfig = (existingMermaidApiRuntime && typeof existingMermaidApiRuntime.getConfig === 'function')
    ? existingMermaidApiRuntime.getConfig()
    : { htmlLabels: 'unknown', startOnLoad: 'unknown', theme: 'unknown' };
  console.log('[index.tsx] Existing Mermaid config. htmlLabels:', existingConfig.htmlLabels, 'startOnLoad:', existingConfig.startOnLoad);
}


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

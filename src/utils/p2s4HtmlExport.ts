import { P2S4SummaryData, P2S4DURecord, P2S4ISUTheme, P2S4Utterance } from '../types/p2s4Types';

// Helper function to escape HTML special characters
function escapeHtml(unsafe: string | undefined | null): string {
  if (unsafe === undefined || unsafe === null) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Generate speaker badge HTML
function getSpeakerBadge(speaker: 'P' | 'I', isDark: boolean): string {
  const classes = speaker === 'P' 
    ? (isDark ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800')
    : (isDark ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800');
  
  return `<span class="speaker-badge ${classes}">${escapeHtml(speaker)}</span>`;
}

// Generate ISU hierarchy HTML
function generateISUHierarchy(isu: P2S4ISUTheme, isDark: boolean, level: number = 0): string {
  const indent = level * 20;
  let html = `
    <div class="isu-item" style="margin-left: ${indent}px;">
      <div class="isu-header">
        <span class="isu-name">${escapeHtml(isu.unitName)}</span>
        <span class="isu-level">Level ${isu.level}</span>
      </div>
      <div class="isu-details">
        <div class="isu-abstraction">Abstraction: ${escapeHtml(isu.abstractionOp)}</div>
        <div class="isu-definition">${escapeHtml(isu.intensionalDefinition)}</div>
      </div>
      <div class="isu-utterances">
        ${isu.utterances.map(utterance => `
          <div class="utterance">
            ${getSpeakerBadge(utterance.speaker, isDark)}
            <div class="utterance-content">
              <div class="utterance-text">${escapeHtml(utterance.text)}</div>
              <div class="utterance-meta">
                <span class="segment-id">ID: ${escapeHtml(utterance.segmentId)}</span>
                ${utterance.timestamp ? `<span class="timestamp">${escapeHtml(utterance.timestamp)}</span>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  return html;
}

// Generate table row for a DU
function generateDUTableSection(du: P2S4DURecord, isDark: boolean): string {
  const sortedISUs = Array.from(du.isuThemes.values()).sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    return a.unitName.localeCompare(b.unitName);
  });

  return `
    <div class="du-section" id="du-${escapeHtml(du.id)}">
      <div class="du-row">
        <div class="du-cell">
          <div class="du-name">${escapeHtml(du.name)}</div>
          <div class="du-description">${escapeHtml(du.description)}</div>
          <div class="du-segments">Segments: ${du.segmentCount}</div>
        </div>
        <div class="isu-cell">
          ${sortedISUs.map(isu => generateISUHierarchy(isu, isDark)).join('')}
        </div>
      </div>
    </div>
  `;
}

// Main HTML generation function
export function generateP2S4Html(data: P2S4SummaryData, theme: 'light' | 'dark'): string {
  const isDark = theme === 'dark';
  const exportDate = new Date().toISOString().split('T')[0];
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>P2S.4 Summary - ${escapeHtml(data.filename)}</title>
  <style>
    /* Reset and base styles */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'EB Garamond', 'et-book', Palatino, serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      transition: background-color 0.3s, color 0.3s;
    }
    
    /* Theme variables */
    .light-theme {
      background-color: #faf8f1;
      color: #111111;
      --bg-primary: #faf8f1;
      --bg-secondary: #f3f1ea;
      --bg-alt: #e9e6de;
      --text-primary: #111111;
      --text-secondary: #555555;
      --text-sidenote: #777777;
      --border-color: #dcd9d0;
      --accent-color: #a00000;
      --speaker-p-bg: #dbeafe;
      --speaker-p-text: #1e40af;
      --speaker-i-bg: #d1fae5;
      --speaker-i-text: #065f46;
    }
    
    .dark-theme {
      background-color: #1a1a1a;
      color: #e6e6e6;
      --bg-primary: #1a1a1a;
      --bg-secondary: #252525;
      --bg-alt: #333333;
      --text-primary: #e6e6e6;
      --text-secondary: #b3b3b3;
      --text-sidenote: #999999;
      --border-color: #444444;
      --accent-color: #ff6b6b;
      --speaker-p-bg: #1e3a8a;
      --speaker-p-text: #93bbfc;
      --speaker-i-bg: #064e3b;
      --speaker-i-text: #6ee7b7;
    }
    
    /* Container and layout */
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    
    /* Header section */
    .header {
      background-color: var(--bg-secondary);
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
      border: 1px solid var(--border-color);
    }
    
    h1 {
      color: var(--accent-color);
      font-size: 2.5em;
      margin-bottom: 20px;
      font-weight: 600;
    }
    
    .meta-info {
      color: var(--text-secondary);
      font-size: 0.9em;
      margin-bottom: 10px;
    }
    
    /* Statistics section */
    .stats {
      display: flex;
      gap: 30px;
      margin-top: 20px;
      padding: 20px;
      background-color: var(--bg-alt);
      border-radius: 6px;
    }
    
    .stat-item {
      display: flex;
      flex-direction: column;
    }
    
    .stat-label {
      color: var(--text-secondary);
      font-size: 0.9em;
      margin-bottom: 5px;
    }
    
    .stat-value {
      color: var(--text-primary);
      font-size: 1.5em;
      font-weight: 600;
    }
    
    /* Table structure */
    .table-section {
      margin-bottom: 40px;
    }
    
    .table-header {
      display: grid;
      grid-template-columns: 300px 1fr;
      background-color: var(--bg-secondary);
      padding: 15px 20px;
      font-weight: 600;
      border: 1px solid var(--border-color);
      border-bottom: 2px solid var(--border-color);
    }
    
    .du-section {
      border: 1px solid var(--border-color);
      border-top: none;
      background-color: var(--bg-primary);
    }
    
    .du-row {
      display: grid;
      grid-template-columns: 300px 1fr;
      min-height: 100px;
    }
    
    .du-cell {
      padding: 20px;
      border-right: 1px solid var(--border-color);
      background-color: var(--bg-secondary);
    }
    
    .du-name {
      font-size: 1.1em;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 8px;
    }
    
    .du-description {
      color: var(--text-secondary);
      font-style: italic;
      margin-bottom: 8px;
      line-height: 1.4;
    }
    
    .du-segments {
      color: var(--text-sidenote);
      font-size: 0.9em;
    }
    
    .isu-cell {
      padding: 20px;
      background-color: var(--bg-primary);
    }
    
    .isu-item {
      margin-bottom: 20px;
      padding: 15px;
      background-color: var(--bg-alt);
      border-radius: 6px;
      border: 1px solid var(--border-color);
    }
    
    .isu-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .isu-name {
      font-weight: 600;
      color: var(--text-primary);
    }
    
    .isu-level {
      color: var(--text-sidenote);
      font-size: 0.9em;
    }
    
    .isu-details {
      margin-bottom: 15px;
      padding-left: 10px;
    }
    
    .isu-abstraction,
    .isu-definition {
      color: var(--text-secondary);
      font-size: 0.95em;
      margin-bottom: 5px;
    }
    
    .isu-utterances {
      margin-top: 15px;
    }
    
    .utterance {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      padding: 10px;
      background-color: var(--bg-primary);
      border-radius: 4px;
      border: 1px solid var(--border-color);
    }
    
    .speaker-badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75em;
      font-weight: 600;
      height: fit-content;
      flex-shrink: 0;
    }
    
    .speaker-badge.bg-blue-100 { background-color: var(--speaker-p-bg); color: var(--speaker-p-text); }
    .speaker-badge.bg-green-100 { background-color: var(--speaker-i-bg); color: var(--speaker-i-text); }
    
    .utterance-content {
      flex: 1;
    }
    
    .utterance-text {
      color: var(--text-primary);
      margin-bottom: 5px;
    }
    
    .utterance-meta {
      display: flex;
      gap: 15px;
      color: var(--text-sidenote);
      font-size: 0.85em;
    }
    
    /* Network diagrams section */
    .diagrams-section {
      margin-top: 40px;
    }
    
    .section-title {
      color: var(--accent-color);
      font-size: 1.8em;
      font-weight: 600;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--border-color);
    }
    
    .diagram-container {
      margin-bottom: 30px;
      padding: 20px;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
    }
    
    .diagram-header {
      margin-bottom: 15px;
    }
    
    .diagram-title {
      font-size: 1.2em;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 5px;
    }
    
    .diagram-description {
      color: var(--text-secondary);
      font-style: italic;
    }
    
    .diagram-stats {
      display: flex;
      gap: 20px;
      margin-bottom: 15px;
      color: var(--text-sidenote);
      font-size: 0.9em;
    }
    
    .mermaid {
      background-color: var(--bg-primary);
      padding: 20px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      overflow-x: auto;
      text-align: center;
    }
    
    /* Responsive design */
    @media (max-width: 768px) {
      body {
        padding: 10px;
      }
      
      .table-header,
      .du-row {
        grid-template-columns: 1fr;
      }
      
      .du-cell {
        border-right: none;
        border-bottom: 1px solid var(--border-color);
      }
      
      .stats {
        flex-direction: column;
        gap: 15px;
      }
    }
    
    /* Print styles */
    @media print {
      body {
        padding: 0;
        background-color: white;
        color: black;
      }
      
      .container {
        max-width: 100%;
      }
      
      .utterance {
        break-inside: avoid;
      }
      
      .diagram-container {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body class="${theme}-theme">
  <div class="container">
    <!-- Header Section -->
    <div class="header">
      <h1>P2S.4 Summary Analysis Report</h1>
      <div class="meta-info">
        <p><strong>Filename:</strong> ${escapeHtml(data.filename)}</p>
        <p><strong>Independent Variable:</strong> ${escapeHtml(data.independentVariable)}</p>
        <p><strong>Dependent Variable(s):</strong> ${escapeHtml(data.dependentVariables.join(', ') || 'None specified')}</p>
        <p><strong>Export Date:</strong> ${exportDate}</p>
      </div>
      <div class="stats">
        <div class="stat-item">
          <div class="stat-label">Total DUs</div>
          <div class="stat-value">${data.totalDUs}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Total ISUs</div>
          <div class="stat-value">${data.totalISUs}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Total Utterances</div>
          <div class="stat-value">${data.totalUtterances}</div>
        </div>
      </div>
    </div>
    
    <!-- Table Section -->
    <div class="table-section">
      <div class="table-header">
        <div>Diachronic Unit</div>
        <div>ISU Themes & Utterances</div>
      </div>
      ${data.duRecords.map(du => generateDUTableSection(du, isDark)).join('')}
    </div>
    
    <!-- Network Diagrams Section -->
    <div class="diagrams-section">
      <h2 class="section-title">Network Diagrams</h2>
      ${data.duRecords.map(du => `
        <div class="diagram-container">
          <div class="diagram-header">
            <div class="diagram-title">${escapeHtml(du.name)}</div>
            <div class="diagram-description">${escapeHtml(du.description)}</div>
          </div>
          <div class="diagram-stats">
            <span>Nodes: ${du.networkDiagram.nodeCount}</span>
            <span>Links: ${du.networkDiagram.linkCount}</span>
          </div>
          <div class="mermaid" id="diagram-${escapeHtml(du.id)}">
            ${escapeHtml(du.networkDiagram.mermaidSyntax)}
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  
  <!-- Mermaid initialization script -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.0/dist/mermaid.min.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const isDarkTheme = document.body.classList.contains('dark-theme');
      
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: isDarkTheme ? 'dark' : 'base',
        fontFamily: "'EB Garamond', 'et-book', Palatino, serif",
        themeVariables: {
          primaryColor: isDarkTheme ? '#1a1a1a' : '#faf8f1',
          primaryBorderColor: isDarkTheme ? '#ff6b6b' : '#a00000',
          primaryTextColor: isDarkTheme ? '#e6e6e6' : '#111111',
          lineColor: isDarkTheme ? '#e6e6e6' : '#111111',
          textColor: isDarkTheme ? '#e6e6e6' : '#111111'
        }
      });
      
      // Run mermaid on all diagrams
      mermaid.run({
        nodes: document.querySelectorAll('.mermaid')
      }).catch(error => {
        console.error('Mermaid rendering error:', error);
        document.querySelectorAll('.mermaid').forEach(el => {
          if (!el.getAttribute('data-processed')) {
            el.innerHTML = '<p style="color: red;">Error rendering diagram: ' + error.message + '</p>';
          }
        });
      });
    });
  </script>
</body>
</html>`;
}

// Download HTML file
export function downloadP2S4Html(htmlContent: string, filename: string): void {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().split('T')[0];
  
  // Extract base filename without extension
  const baseFilename = filename.replace(/\.[^/.]+$/, '');
  
  link.setAttribute('href', url);
  link.setAttribute('download', `p2s4_summary_${baseFilename}_${date}.html`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL object
  URL.revokeObjectURL(url);
}
export function convertToCSV(data: any[], columns: { field: string; headerName: string }[]): string {
  if (data.length === 0) return '';

  // Create header row
  const headers = columns.map(col => `"${col.headerName}"`).join(',');
  
  // Create data rows
  const rows = data.map(row => {
    return columns.map(col => {
      const value = row[col.field];
      
      // Handle different value types
      if (value === null || value === undefined) {
        return '""';
      } else if (Array.isArray(value)) {
        // Join array values with semicolon
        return `"${value.join('; ').replace(/"/g, '""')}"`;
      } else if (typeof value === 'boolean') {
        return value ? '"Yes"' : '"No"';
      } else {
        // Escape quotes and wrap in quotes
        return `"${String(value).replace(/"/g, '""')}"`;
      }
    }).join(',');
  });

  return [headers, ...rows].join('\n');
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL object
  URL.revokeObjectURL(url);
}
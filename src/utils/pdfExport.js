import html2pdf from 'html2pdf.js';

export function exportReportToPdf(elementId = 'vapt-pdf-report-root', filename = 'Sennovate_VAPT_Security_Report.pdf') {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('PDF export target element not found:', elementId);
    window.print();
    return;
  }

  // High-fidelity page configuration preventing blank pages and awkward element breaks
  const opt = {
    margin: [8, 8, 8, 8],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true, 
      letterRendering: true,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
      scrollY: 0,
      scrollX: 0
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait',
      compress: true
    },
    pagebreak: { 
      mode: ['css', 'legacy'],
      avoid: ['.pdf-avoid-break', 'tr', '.pdf-finding-card', '.pdf-block']
    }
  };

  return html2pdf().set(opt).from(element).save();
}

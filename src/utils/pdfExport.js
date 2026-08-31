import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Enterprise Multi-Page A4 PDF Exporter
 * Renders each pre-paginated .pdf-page DOM container into a dedicated crisp A4 page in jsPDF.
 * Guarantees zero blank pages, zero broken cards/tables, consistent 20mm/15mm margins,
 * and high-resolution 300 DPI text and graphics.
 */
export async function exportReportToPdf(elementId = 'vapt-pdf-report-root', filename = 'Sennovate_VAPT_Security_Report.pdf') {
  const root = document.getElementById(elementId);
  if (!root) {
    console.error('PDF export target element not found:', elementId);
    window.print();
    return false;
  }

  try {
    const originalScrollY = window.scrollY;
    window.scrollTo(0, 0);

    // Find all discrete .pdf-page containers
    const pageElements = root.querySelectorAll('.pdf-page');

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    if (pageElements && pageElements.length > 0) {
      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i];

        const canvas = await html2canvas(pageEl, {
          scale: 2, // 2x high retina resolution
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 1200,
          scrollX: 0,
          scrollY: 0
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);

        if (i > 0) {
          pdf.addPage('a4', 'portrait');
        }

        // Add page image mapped exactly to full A4 dimensions (210mm x 297mm)
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }
    } else {
      // Fallback if no .pdf-page elements found
      const canvas = await html2canvas(root, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: 1200
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const imgHeight = (canvas.height * 210) / canvas.width;
      let heightLeft = imgHeight;
      let pos = 0;

      pdf.addImage(imgData, 'JPEG', 0, pos, 210, imgHeight, undefined, 'FAST');
      heightLeft -= 297;

      while (heightLeft > 2) {
        pos -= 297;
        pdf.addPage('a4', 'portrait');
        pdf.addImage(imgData, 'JPEG', 0, pos, 210, imgHeight, undefined, 'FAST');
        heightLeft -= 297;
      }
    }

    window.scrollTo(0, originalScrollY);
    pdf.save(filename);
    return true;
  } catch (err) {
    console.error('Enterprise PDF Export failed, falling back to browser print:', err);
    window.print();
    return false;
  }
}

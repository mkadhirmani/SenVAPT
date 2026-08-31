import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Universal High-Definition Multi-Page PDF Exporter
 * Captures the exact DOM view into crisp vector-rendered multi-page A4 PDF
 * without runaway blank pages or broken layouts.
 */
export async function exportReportToPdf(elementId = 'vapt-pdf-report-root', filename = 'Sennovate_VAPT_Security_Report.pdf') {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('PDF export target element not found:', elementId);
    window.print();
    return false;
  }

  try {
    // 1. Temporarily save scroll position and ensure full visibility
    const originalScrollY = window.scrollY;
    window.scrollTo(0, 0);

    // 2. High-DPI canvas capture using html2canvas
    const canvas = await html2canvas(element, {
      scale: 2, // 2x retina sharpness
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
      scrollX: 0,
      scrollY: 0
    });

    // Restore scroll position
    window.scrollTo(0, originalScrollY);

    // 3. Convert canvas to JPEG data URL
    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    // 4. Calculate exact A4 dimensions
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    // 5. Add Page 1
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    // 6. Loop for remaining content pages (only creates pages for actual content)
    while (heightLeft > 2) { // 2mm threshold to avoid trailing empty sub-pixel sliver
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    // 7. Save and trigger download
    pdf.save(filename);
    return true;
  } catch (err) {
    console.error('Canvas PDF export error, falling back to browser print:', err);
    window.print();
    return false;
  }
}

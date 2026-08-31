import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Enterprise Multi-Page A4 PDF Exporter
 * Renders each pre-paginated .pdf-page container into standard A4 pages (210mm x 297mm).
 * If any section or finding exceeds a single A4 page height (297mm),
 * it seamlessly continues the content onto the next A4 page with zero clipping.
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

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const PAGE_WIDTH_MM = 210;
    const PAGE_HEIGHT_MM = 297;

    const pageElements = root.querySelectorAll('.pdf-page');

    if (pageElements && pageElements.length > 0) {
      let isFirstPage = true;

      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i];

        const canvas = await html2canvas(pageEl, {
          scale: 2, // 2x retina clarity (300 DPI)
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 1200,
          scrollX: 0,
          scrollY: 0
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const imgHeightMm = (canvas.height * PAGE_WIDTH_MM) / canvas.width;

        if (imgHeightMm <= PAGE_HEIGHT_MM + 2) {
          // Fits within a single A4 page
          if (!isFirstPage) {
            pdf.addPage('a4', 'portrait');
          }
          isFirstPage = false;
          pdf.addImage(imgData, 'JPEG', 0, 0, PAGE_WIDTH_MM, imgHeightMm, undefined, 'FAST');
        } else {
          // Content exceeds A4 single page height: Paginate cleanly across multiple A4 pages
          let heightLeftMm = imgHeightMm;
          let positionMm = 0;

          while (heightLeftMm > 2) {
            if (!isFirstPage) {
              pdf.addPage('a4', 'portrait');
            }
            isFirstPage = false;

            pdf.addImage(imgData, 'JPEG', 0, positionMm, PAGE_WIDTH_MM, imgHeightMm, undefined, 'FAST');
            heightLeftMm -= PAGE_HEIGHT_MM;
            positionMm -= PAGE_HEIGHT_MM;
          }
        }
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
      const imgHeightMm = (canvas.height * PAGE_WIDTH_MM) / canvas.width;
      let heightLeftMm = imgHeightMm;
      let positionMm = 0;

      while (heightLeftMm > 2) {
        if (positionMm < 0) {
          pdf.addPage('a4', 'portrait');
        }
        pdf.addImage(imgData, 'JPEG', 0, positionMm, PAGE_WIDTH_MM, imgHeightMm, undefined, 'FAST');
        heightLeftMm -= PAGE_HEIGHT_MM;
        positionMm -= PAGE_HEIGHT_MM;
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

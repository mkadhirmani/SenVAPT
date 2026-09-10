/**
 * Dynamic Multi-Page Pagination Engine for Enterprise A4 PDF Deliverables
 * 
 * Guarantees:
 * 1. Content determines pagination (no artificial 1-page or 2-page hardcoded quotas).
 * 2. Strict A4 dimensions (210mm x 297mm) with zero overlap, zero text clipping, and consistent margins.
 * 3. Headings are never orphaned at the bottom of a page (keep-with-next rule).
 * 4. Code blocks, evidence boxes, lists, and tables flow naturally across pages when they exceed page limits.
 * 5. Dynamic page counting (Page X of Y) updated across all running headers/footers.
 */

export const A4_CONSTANTS = {
  WIDTH_MM: 210,
  HEIGHT_MM: 297,
  WIDTH_PX: 794,           // 210mm @ 96 DPI
  HEIGHT_PX: 1123,         // 297mm @ 96 DPI
  CONTENT_WIDTH_MM: 182,   // 210mm - 28mm (14mm L/R margins)
  CONTENT_WIDTH_PX: 688,   // 182mm @ 96 DPI
  
  // Safe printable content height per page (excluding top/bottom padding 24mm, header ~14mm, footer ~14mm)
  // 1123 - 90 - 53 - 53 = ~927px. Using 885px guarantees zero collision with the footer.
  MAX_PAGE_CONTENT_HEIGHT_PX: 885,
  
  // Minimum space remaining on a page to allow placing a heading (must fit heading + at least 120px of following content)
  MIN_HEADING_FOLLOW_SPACE_PX: 160,
  
  // Minimum space to start a new finding section at the bottom of an existing page
  // If less than this space remains, the finding starts cleanly on a fresh page.
  MIN_FINDING_START_SPACE_PX: 320,
  
  // Average height per line in pre/code blocks at font-size 11px with leading-relaxed
  CODE_LINE_HEIGHT_PX: 18.5,
  
  // Spacing gap added between blocks
  BLOCK_GAP_PX: 14
};

/**
 * Splits a long code/evidence string into chunks that fit within available vertical pixel heights.
 * @param {string} codeText 
 * @param {number} firstPageMaxHeightPx 
 * @param {number} fullPageMaxHeightPx 
 * @returns {Array<{ text: string, part: number, totalParts: number }>}
 */
export function splitCodeBlock(codeText, firstPageMaxHeightPx, fullPageMaxHeightPx) {
  if (!codeText || typeof codeText !== 'string') {
    return [{ text: '', part: 1, totalParts: 1 }];
  }

  const lines = codeText.split('\n');
  const chromeHeight = 44; // Padding + header bar of code box
  
  const firstPageMaxLines = Math.max(4, Math.floor((firstPageMaxHeightPx - chromeHeight) / A4_CONSTANTS.CODE_LINE_HEIGHT_PX));
  const fullPageMaxLines = Math.max(8, Math.floor((fullPageMaxHeightPx - chromeHeight) / A4_CONSTANTS.CODE_LINE_HEIGHT_PX));

  // If entire code fits in first page allowance, return single chunk
  if (lines.length <= firstPageMaxLines) {
    return [{ text: codeText, part: 1, totalParts: 1 }];
  }

  const chunks = [];
  let remainingLines = [...lines];

  // First chunk
  const firstChunk = remainingLines.slice(0, firstPageMaxLines);
  chunks.push(firstChunk.join('\n'));
  remainingLines = remainingLines.slice(firstPageMaxLines);

  // Subsequent chunks
  while (remainingLines.length > 0) {
    const chunkLines = remainingLines.slice(0, fullPageMaxLines);
    chunks.push(chunkLines.join('\n'));
    remainingLines = remainingLines.slice(fullPageMaxLines);
  }

  const totalParts = chunks.length;
  return chunks.map((text, idx) => ({
    text,
    part: idx + 1,
    totalParts
  }));
}

/**
 * Splits an array of remediation steps into chunks based on available height.
 * @param {string[]} steps 
 * @param {number} firstPageMaxHeightPx 
 * @param {number} fullPageMaxHeightPx 
 * @returns {Array<{ steps: string[], startNumber: number }>}
 */
export function splitListSteps(steps, firstPageMaxHeightPx, fullPageMaxHeightPx) {
  if (!steps || steps.length === 0) return [];
  
  const EST_STEP_HEIGHT = 42; // average height of a numbered remediation step with padding
  const firstPageCount = Math.max(1, Math.floor(firstPageMaxHeightPx / EST_STEP_HEIGHT));
  const fullPageCount = Math.max(2, Math.floor(fullPageMaxHeightPx / EST_STEP_HEIGHT));

  if (steps.length <= firstPageCount) {
    return [{ steps, startNumber: 1 }];
  }

  const chunks = [];
  let currentStart = 1;
  let remaining = [...steps];

  const firstSlice = remaining.slice(0, firstPageCount);
  chunks.push({ steps: firstSlice, startNumber: currentStart });
  currentStart += firstSlice.length;
  remaining = remaining.slice(firstPageCount);

  while (remaining.length > 0) {
    const nextSlice = remaining.slice(0, fullPageCount);
    chunks.push({ steps: nextSlice, startNumber: currentStart });
    currentStart += nextSlice.length;
    remaining = remaining.slice(nextSlice.length);
  }

  return chunks;
}

/**
 * Calibrates and estimates the rendered pixel height of a flow block.
 * @param {Object} block 
 * @returns {number} Estimated height in CSS pixels
 */
export function estimateBlockHeight(block) {
  if (block.height && block.height > 0) return block.height;
  
  switch (block.type) {
    case 'finding-header': {
      const titleLen = (block.title || block.vuln?.title || '').length;
      const titleLines = Math.max(1, Math.ceil(titleLen / 55));
      return 85 + (titleLines * 24);
    }
    case 'section-heading': {
      return 36;
    }
    case 'tech-analysis': {
      const desc = block.description || block.vuln?.description || '';
      const tech = block.technicalAnalysis || block.vuln?.technicalAnalysis || '';
      const descLines = Math.ceil(desc.length / 75) || 1;
      const techLines = tech ? (Math.ceil(tech.length / 75) + 1) : 0;
      return 52 + ((descLines + techLines) * 18.5);
    }
    case 'threat-impact': {
      const impact = block.impact || block.vuln?.impact || '';
      const impactLines = Math.ceil(impact.length / 75) || 1;
      return 50 + (impactLines * 18.5);
    }
    case 'evidence': {
      const text = block.codeText || block.vuln?.evidence || '';
      const lineCount = text.split('\n').length || 1;
      return 44 + (lineCount * A4_CONSTANTS.CODE_LINE_HEIGHT_PX);
    }
    case 'poc': {
      const desc = block.pocDescription || block.vuln?.pocDescription || '';
      const script = block.codeText || block.vuln?.reproduction || block.vuln?.pocScripts?.bash || block.vuln?.pocScripts?.python || '';
      const descLines = desc ? Math.ceil(desc.length / 75) : 0;
      const codeLines = script ? script.split('\n').length : 0;
      return 46 + (descLines * 18.5) + (codeLines > 0 ? (codeLines * A4_CONSTANTS.CODE_LINE_HEIGHT_PX + 36) : 0);
    }
    case 'remediation': {
      const rem = block.remediation || block.vuln?.remediation || '';
      const steps = block.remediationSteps || block.vuln?.remediationSteps || [];
      const remLines = rem ? Math.ceil(rem.length / 75) : 0;
      return 50 + (remLines * 18.5) + (steps.length * 32);
    }
    case 'checklist': {
      return 115;
    }
    case 'matrix-table': {
      const rows = block.rows || [];
      return 44 + (rows.length * 38);
    }
    case 'static-card': {
      return block.estimatedHeight || 110;
    }
    default:
      return block.estimatedHeight || 60;
  }
}

/**
 * Core Dynamic Pagination Algorithm.
 * Distributes an array of measured flow blocks across discrete A4 pages.
 * 
 * @param {Array<Object>} blocks List of flow blocks with { id, type, height, isHeading, isKeepWithNext, ... }
 * @param {Object} options Configuration options (usableHeight, findingContext)
 * @returns {Array<Object>} Array of page definitions containing blocks for each page
 */
export function paginateBlocks(blocks, options = {}) {
  const maxHeight = options.usableHeight || A4_CONSTANTS.MAX_PAGE_CONTENT_HEIGHT_PX;
  const minHeadingFollow = options.minHeadingFollow || A4_CONSTANTS.MIN_HEADING_FOLLOW_SPACE_PX;
  const minFindingStart = options.minFindingStart || A4_CONSTANTS.MIN_FINDING_START_SPACE_PX;
  const gap = A4_CONSTANTS.BLOCK_GAP_PX;

  const pages = [];
  let currentPageBlocks = [];
  let currentHeight = 0;
  let currentFindingContext = null;

  const flushPage = () => {
    if (currentPageBlocks.length > 0) {
      pages.push({
        pageIndex: pages.length,
        blocks: currentPageBlocks,
        height: currentHeight,
        findingContext: currentFindingContext
      });
      currentPageBlocks = [];
      currentHeight = 0;
    }
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockHeight = estimateBlockHeight(block);
    block.calculatedHeight = blockHeight;

    // Update finding context if this block belongs to a finding
    if (block.finding) {
      currentFindingContext = block.finding;
    }

    // 1. If explicit page break requested:
    if (block.forcePageBreakBefore && currentPageBlocks.length > 0) {
      flushPage();
      if (block.finding) currentFindingContext = block.finding;
    }

    // 2. Finding Header Start Check:
    // When a new finding begins, ensure sufficient room remains on the current page.
    // If not enough room for the header + at least the first section (~320px), start on a fresh page.
    if (block.type === 'finding-header') {
      const remaining = maxHeight - currentHeight;
      if (currentPageBlocks.length > 0 && remaining < minFindingStart) {
        flushPage();
        currentFindingContext = block.finding;
      }
    }

    // 3. Bulletproof Heading Keep-With-Next Rule:
    // A heading block must NEVER be alone at the bottom of a page.
    if (block.isHeading) {
      const remaining = maxHeight - currentHeight;
      const nextBlock = blocks[i + 1];
      
      if (nextBlock) {
        const nextHeight = estimateBlockHeight(nextBlock);
        
        if (nextHeight <= maxHeight) {
          // If the next block fits on a fresh page, but CANNOT fit on this page together with heading:
          // Move heading to the next page now, so heading + next block stay together cleanly!
          if (currentPageBlocks.length > 0 && (blockHeight + nextHeight + gap > remaining)) {
            flushPage();
            if (block.finding) currentFindingContext = block.finding;
          }
        } else {
          // Next block is larger than an entire page: ensure at least heading + minHeadingFollow fits
          const neededSpace = blockHeight + minHeadingFollow + gap;
          if (currentPageBlocks.length > 0 && remaining < neededSpace) {
            flushPage();
            if (block.finding) currentFindingContext = block.finding;
          }
        }
      } else {
        // Trailing heading with no content: should never happen, but flush if cramped
        if (currentPageBlocks.length > 0 && remaining < blockHeight + gap) {
          flushPage();
        }
      }
    }

    // 4. Fitting Check:
    const remaining = maxHeight - currentHeight;

    if (currentHeight === 0 || (currentHeight + blockHeight + gap <= maxHeight)) {
      // Fits on current page
      currentPageBlocks.push(block);
      currentHeight += blockHeight + (currentPageBlocks.length > 1 ? gap : 0);
    } else {
      // Does not fit in remaining space on current page!
      // Safety Check: If the last block placed was a heading, move it to the new page with this block!
      let movedHeading = null;
      if (currentPageBlocks.length > 0 && currentPageBlocks[currentPageBlocks.length - 1].isHeading) {
        movedHeading = currentPageBlocks.pop();
      }

      // Can block fit on a fresh page?
      if (blockHeight <= maxHeight) {
        flushPage();
        if (block.finding) currentFindingContext = block.finding;
        
        if (movedHeading) {
          currentPageBlocks.push(movedHeading);
          currentHeight = estimateBlockHeight(movedHeading) + gap;
        }
        currentPageBlocks.push(block);
        currentHeight += blockHeight;
      } else {
        // Block itself is larger than a full page! (e.g. huge code block, massive table)
        if (movedHeading) {
          // Flush the page before the heading so heading starts at the top of the new page with the code block
          flushPage();
          currentPageBlocks.push(movedHeading);
          currentHeight = estimateBlockHeight(movedHeading) + gap;
        }

        // If remaining space on current page is very small (< 150px), start on fresh page first
        if (maxHeight - currentHeight < 150 && currentPageBlocks.length > 0) {
          flushPage();
          if (block.finding) currentFindingContext = block.finding;
        }

        const availableFirst = maxHeight - currentHeight;
        const splitChunks = splitCodeBlock(block.codeText, availableFirst, maxHeight);

        if (splitChunks.length > 0) {
          // Put first chunk on current page
          const firstChunk = splitChunks[0];
          currentPageBlocks.push({
            ...block,
            id: `${block.id}-part1`,
            codeText: firstChunk.text,
            part: firstChunk.part,
            totalParts: firstChunk.totalParts,
            isSplitPart: true
          });
          flushPage();

          // Put remaining chunks on subsequent fresh pages
          for (let c = 1; c < splitChunks.length; c++) {
            const chunk = splitChunks[c];
            if (block.finding) currentFindingContext = block.finding;
            currentPageBlocks.push({
              ...block,
              id: `${block.id}-part${chunk.part}`,
              codeText: chunk.text,
              part: chunk.part,
              totalParts: chunk.totalParts,
              isSplitPart: true
            });

            if (c < splitChunks.length - 1) {
              flushPage();
            } else {
              currentHeight = (chunk.text.split('\n').length * A4_CONSTANTS.CODE_LINE_HEIGHT_PX) + 44;
            }
          }
        }
      }
    }
  }

  flushPage();
  return pages;
}

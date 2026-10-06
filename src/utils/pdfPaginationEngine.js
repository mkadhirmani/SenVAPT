/**
 * Dynamic Multi-Page Continuous-Flow Pagination Engine for Enterprise A4 PDF Deliverables
 * 
 * Guarantees:
 * 1. Content flows continuously till the end of the page like a book/publication.
 * 2. Strict A4 dimensions (210mm x 297mm @ 96 DPI: 794px x 1123px).
 * 3. Subheadings are NEVER orphaned alone at the bottom of a page (keep-with-next rule).
 * 4. Large blocks (code blocks, raw evidence, exploit scripts, remediation steps, matrix tables)
 *    flow smoothly across page boundaries without wasting page space.
 * 5. Dynamic page counting (Page X of Y) updated across all running headers/footers.
 */

export const A4_CONSTANTS = {
  WIDTH_MM: 210,
  HEIGHT_MM: 297,
  WIDTH_PX: 794,           // 210mm @ 96 DPI
  HEIGHT_PX: 1123,         // 297mm @ 96 DPI
  CONTENT_WIDTH_MM: 182,   // 210mm - 28mm (14mm L/R margins)
  CONTENT_WIDTH_PX: 688,   // 182mm @ 96 DPI
  
  // Safe printable content height per page (excluding header ~38px, footer ~36px, padding 24mm ~90px)
  // Max safe content height is 900px, ensuring zero overlap or collision with running headers/footers.
  MAX_PAGE_CONTENT_HEIGHT_PX: 900,
  
  // Minimum space remaining on a page to place a heading (must fit heading + following content chunk)
  MIN_HEADING_FOLLOW_SPACE_PX: 140,
  
  // Minimum space to start a new finding section at the bottom of an existing page
  // If less than 300px remains, the finding starts cleanly on a fresh page.
  MIN_FINDING_START_SPACE_PX: 300,
  
  // Average height per line in pre/code blocks at font-size 11px with leading-relaxed
  CODE_LINE_HEIGHT_PX: 18.5,
  
  // Spacing gap added between blocks
  BLOCK_GAP_PX: 12
};

/**
 * Splits a long code/evidence string into chunks that fit within available vertical pixel heights.
 * @param {string} codeText 
 * @param {number} firstPageMaxHeightPx 
 * @param {number} fullPageMaxHeightPx 
 * @returns {Array<{ text: string, part: number, totalParts: number }> | null}
 */
export function splitCodeBlock(codeText, firstPageMaxHeightPx, fullPageMaxHeightPx) {
  if (!codeText || typeof codeText !== 'string') {
    return null;
  }

  const lines = codeText.split('\n');
  const chromeHeight = 44; // Padding + header bar of code box
  
  const firstPageMaxLines = Math.floor((firstPageMaxHeightPx - chromeHeight) / A4_CONSTANTS.CODE_LINE_HEIGHT_PX);
  const fullPageMaxLines = Math.max(6, Math.floor((fullPageMaxHeightPx - chromeHeight) / A4_CONSTANTS.CODE_LINE_HEIGHT_PX));

  // If first page cannot accommodate at least 3 lines of code, do not split on first page
  if (firstPageMaxLines < 3) {
    return null;
  }

  if (lines.length <= firstPageMaxLines) {
    return [{ text: codeText, part: 1, totalParts: 1 }];
  }

  const chunks = [];
  let remainingLines = [...lines];

  const firstChunk = remainingLines.slice(0, firstPageMaxLines);
  chunks.push(firstChunk.join('\n'));
  remainingLines = remainingLines.slice(firstPageMaxLines);

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
 * Splits an array of remediation steps across page boundaries.
 * @param {Object} block
 * @param {number} firstPageMaxHeightPx
 * @param {number} fullPageMaxHeightPx
 * @returns {Array<Object> | null}
 */
export function splitRemediationSteps(block, firstPageMaxHeightPx, fullPageMaxHeightPx) {
  const steps = block.remediationSteps || (block.vuln && !block.isSplitPart ? block.vuln.remediationSteps : []) || [];
  const remediationDesc = block.remediation || (block.vuln && !block.isSplitPart ? block.vuln.remediation : '') || '';
  
  if (steps.length === 0) return null;

  const descLines = remediationDesc ? Math.ceil(remediationDesc.length / 75) : 0;
  const descHeight = descLines * 19 + 28;
  const availableForStepsFirst = firstPageMaxHeightPx - descHeight;
  
  const EST_STEP_HEIGHT = 34;
  const firstPageStepCount = Math.floor(availableForStepsFirst / EST_STEP_HEIGHT);
  const fullPageStepCount = Math.max(3, Math.floor((fullPageMaxHeightPx - 40) / EST_STEP_HEIGHT));

  if (firstPageStepCount < 1) {
    return null;
  }

  if (steps.length <= firstPageStepCount) {
    return null;
  }

  const chunks = [];
  let currentStart = 1;
  let remaining = [...steps];

  const firstSlice = remaining.slice(0, firstPageStepCount);
  chunks.push({
    ...block,
    id: `${block.id}-part1`,
    remediation: remediationDesc,
    remediationSteps: firstSlice,
    startNumber: currentStart,
    isSplitPart: true
  });
  currentStart += firstSlice.length;
  remaining = remaining.slice(firstPageStepCount);

  while (remaining.length > 0) {
    const nextSlice = remaining.slice(0, fullPageStepCount);
    chunks.push({
      ...block,
      id: `${block.id}-part${chunks.length + 1}`,
      remediation: '',
      remediationSteps: nextSlice,
      startNumber: currentStart,
      isSplitPart: true
    });
    currentStart += nextSlice.length;
    remaining = remaining.slice(nextSlice.length);
  }

  if (chunks.length === 0 || estimateBlockHeight(chunks[0]) > firstPageMaxHeightPx) {
    return null;
  }

  const totalParts = chunks.length;
  return chunks.map((c, idx) => ({
    ...c,
    part: idx + 1,
    totalParts
  }));
}

// Alias for backwards compatibility
export const splitListSteps = (steps, firstH, fullH) => {
  const dummyBlock = { id: 'rem-steps', type: 'remediation', remediationSteps: steps, remediation: '' };
  const res = splitRemediationSteps(dummyBlock, firstH, fullH);
  if (!res) return [{ steps, startNumber: 1 }];
  return res.map(r => ({ steps: r.remediationSteps, startNumber: r.startNumber }));
};

/**
 * Splits a Proof-of-Concept block (description + exploit script) across pages.
 * @param {Object} block
 * @param {number} firstPageMaxHeightPx
 * @param {number} fullPageMaxHeightPx
 * @returns {Array<Object> | null}
 */
export function splitPocBlock(block, firstPageMaxHeightPx, fullPageMaxHeightPx) {
  const desc = block.pocDescription || (block.vuln && !block.isSplitPart ? block.vuln.pocDescription : '') || '';
  const script = block.codeText || (block.vuln && !block.isSplitPart ? (block.vuln.reproduction || block.vuln.pocScripts?.bash || block.vuln.pocScripts?.python) : '') || '';

  const descLines = desc ? Math.ceil(desc.length / 75) : 0;
  const descHeight = desc ? (descLines * 19 + 36) : 0;

  const chunks = [];

  if (desc && script) {
    if (descHeight <= firstPageMaxHeightPx - 60) {
      // Description fits on first page, split script
      const scriptSpaceFirst = firstPageMaxHeightPx - descHeight;
      const splitScriptChunks = splitCodeBlock(script, scriptSpaceFirst, fullPageMaxHeightPx - 30);
      if (splitScriptChunks && splitScriptChunks.length > 0) {
        chunks.push({
          ...block,
          id: `${block.id}-part1`,
          pocDescription: desc,
          codeText: splitScriptChunks[0].text,
          isSplitPart: true
        });
        for (let c = 1; c < splitScriptChunks.length; c++) {
          chunks.push({
            ...block,
            id: `${block.id}-part${c + 1}`,
            pocDescription: '',
            codeText: splitScriptChunks[c].text,
            isSplitPart: true
          });
        }
      } else {
        // Script didn't have room on first page: put description on part 1, script entirely on part 2
        chunks.push({
          ...block,
          id: `${block.id}-part1`,
          pocDescription: desc,
          codeText: '',
          isSplitPart: true
        });
        const splitSub = splitCodeBlock(script, fullPageMaxHeightPx - 30, fullPageMaxHeightPx - 30);
        if (splitSub && splitSub.length > 0) {
          for (const sc of splitSub) {
            chunks.push({
              ...block,
              id: `${block.id}-part${chunks.length + 1}`,
              pocDescription: '',
              codeText: sc.text,
              isSplitPart: true
            });
          }
        } else {
          chunks.push({
            ...block,
            id: `${block.id}-part2`,
            pocDescription: '',
            codeText: script,
            isSplitPart: true
          });
        }
      }
    } else if (descHeight <= firstPageMaxHeightPx) {
      // Only description fits on first page
      chunks.push({
        ...block,
        id: `${block.id}-part1`,
        pocDescription: desc,
        codeText: '',
        isSplitPart: true
      });
      const splitScriptChunks = splitCodeBlock(script, fullPageMaxHeightPx, fullPageMaxHeightPx);
      if (splitScriptChunks) {
        for (const sc of splitScriptChunks) {
          chunks.push({
            ...block,
            id: `${block.id}-part${chunks.length + 1}`,
            pocDescription: '',
            codeText: sc.text,
            isSplitPart: true
          });
        }
      } else {
        chunks.push({
          ...block,
          id: `${block.id}-part2`,
          pocDescription: '',
          codeText: script,
          isSplitPart: true
        });
      }
    } else {
      // Description itself is very long: chunk description paragraphs
      const paragraphs = desc.split('\n\n').filter(Boolean);
      let pChunk = [];
      let pChunkH = 36;
      for (const p of paragraphs) {
        const pH = Math.ceil(p.length / 75) * 19 + 12;
        if (pChunk.length > 0 && pChunkH + pH > firstPageMaxHeightPx) {
          chunks.push({
            ...block,
            id: `${block.id}-part${chunks.length + 1}`,
            pocDescription: pChunk.join('\n\n'),
            codeText: '',
            isSplitPart: true
          });
          pChunk = [p];
          pChunkH = 36 + pH;
        } else {
          pChunk.push(p);
          pChunkH += pH;
        }
      }
      if (pChunk.length > 0) {
        chunks.push({
          ...block,
          id: `${block.id}-part${chunks.length + 1}`,
          pocDescription: pChunk.join('\n\n'),
          codeText: '',
          isSplitPart: true
        });
      }
      if (script) {
        const splitScriptChunks = splitCodeBlock(script, fullPageMaxHeightPx, fullPageMaxHeightPx);
        if (splitScriptChunks) {
          for (const sc of splitScriptChunks) {
            chunks.push({
              ...block,
              id: `${block.id}-part${chunks.length + 1}`,
              pocDescription: '',
              codeText: sc.text,
              isSplitPart: true
            });
          }
        }
      }
    }
  } else if (script) {
    const splitScriptChunks = splitCodeBlock(script, firstPageMaxHeightPx, fullPageMaxHeightPx);
    if (!splitScriptChunks || splitScriptChunks.length <= 1) return null;
    for (const sc of splitScriptChunks) {
      chunks.push({
        ...block,
        id: `${block.id}-part${chunks.length + 1}`,
        pocDescription: '',
        codeText: sc.text,
        isSplitPart: true
      });
    }
  } else {
    if (descHeight > firstPageMaxHeightPx) {
      return null;
    }
    chunks.push({
      ...block,
      id: `${block.id}-part1`,
      pocDescription: desc,
      codeText: '',
      isSplitPart: true
    });
  }

  if (chunks.length === 0 || estimateBlockHeight(chunks[0]) > firstPageMaxHeightPx) {
    return null;
  }

  const totalParts = chunks.length;
  return chunks.map((c, idx) => ({
    ...c,
    part: idx + 1,
    totalParts
  }));
}

/**
 * Splits a large vulnerability summary matrix table across pages.
 * @param {Object} block
 * @param {number} firstPageMaxHeightPx
 * @param {number} fullPageMaxHeightPx
 * @returns {Array<Object> | null}
 */
export function splitTableRows(block, firstPageMaxHeightPx, fullPageMaxHeightPx) {
  const rows = block.rows || [];
  if (rows.length <= 2) return null;

  const rowHeight = 38;
  const headerHeight = 44;

  const firstPageRowCount = Math.floor((firstPageMaxHeightPx - headerHeight) / rowHeight);
  const fullPageRowCount = Math.max(3, Math.floor((fullPageMaxHeightPx - headerHeight) / rowHeight));

  if (firstPageRowCount < 2) return null;
  if (rows.length <= firstPageRowCount) return null;

  const chunks = [];
  let remaining = [...rows];

  const firstSlice = remaining.slice(0, firstPageRowCount);
  chunks.push({
    ...block,
    id: `${block.id}-part1`,
    rows: firstSlice,
    isSplitPart: true
  });
  remaining = remaining.slice(firstPageRowCount);

  while (remaining.length > 0) {
    const nextSlice = remaining.slice(0, fullPageRowCount);
    chunks.push({
      ...block,
      id: `${block.id}-part${chunks.length + 1}`,
      rows: nextSlice,
      isSplitPart: true
    });
    remaining = remaining.slice(nextSlice.length);
  }

  if (chunks.length === 0 || estimateBlockHeight(chunks[0]) > firstPageMaxHeightPx) {
    return null;
  }

  const totalParts = chunks.length;
  return chunks.map((c, idx) => ({
    ...c,
    part: idx + 1,
    totalParts
  }));
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
      return 52 + ((descLines + techLines) * 19);
    }
    case 'threat-impact': {
      const impact = block.impact || block.vuln?.impact || '';
      const impactLines = Math.ceil(impact.length / 75) || 1;
      return 48 + (impactLines * 19);
    }
    case 'evidence': {
      const text = block.codeText || block.vuln?.evidence || '';
      const lineCount = text ? text.split('\n').length : 1;
      return 44 + (lineCount * A4_CONSTANTS.CODE_LINE_HEIGHT_PX);
    }
    case 'poc': {
      const desc = block.pocDescription || (!block.isSplitPart && block.vuln ? block.vuln.pocDescription : '') || '';
      const script = block.codeText || (!block.isSplitPart && block.vuln ? (block.vuln.reproduction || block.vuln.pocScripts?.bash || block.vuln.pocScripts?.python) : '') || '';
      const descLines = desc ? Math.ceil(desc.length / 75) : 0;
      const codeLines = script ? script.split('\n').length : 0;
      let h = 24;
      if (descLines > 0) h += (descLines * 19 + 12);
      if (codeLines > 0) h += (codeLines * A4_CONSTANTS.CODE_LINE_HEIGHT_PX + 40);
      return h;
    }
    case 'remediation': {
      const rem = block.remediation || (!block.isSplitPart && block.vuln ? block.vuln.remediation : '') || '';
      const steps = block.remediationSteps || (!block.isSplitPart && block.vuln ? block.vuln.remediationSteps : []) || [];
      const remLines = rem ? Math.ceil(rem.length / 75) : 0;
      return 48 + (remLines * 19) + (steps.length * 34);
    }
    case 'checklist': {
      return 115;
    }
    case 'matrix-table': {
      const rows = block.rows || [];
      return 44 + (rows.length * 38);
    }
    case 'matrix-guides-card': {
      return block.estimatedHeight || 310;
    }
    case 'exec-intro': {
      return block.estimatedHeight || 85;
    }
    case 'exec-top-vuln-card': {
      return block.estimatedHeight || 90;
    }
    case 'exec-risk-breakdown-grid': {
      return block.estimatedHeight || 160;
    }
    case 'exec-business-impact-card': {
      return block.estimatedHeight || 85;
    }
    case 'exec-roadmap-grid': {
      return block.estimatedHeight || 120;
    }
    case 'ai-summary': {
      const content = block.content || '';
      const lines = Math.ceil(content.length / 75) || 4;
      return 44 + (lines * 19);
    }
    case 'static-card': {
      return block.estimatedHeight || 110;
    }
    default:
      return block.estimatedHeight || 60;
  }
}

/**
 * Checks if a block type supports splitting across page boundaries.
 */
function canSplitBlock(block) {
  if (block.type === 'evidence') return true;
  if (block.type === 'poc') return true;
  if (block.type === 'remediation') return (block.remediationSteps && block.remediationSteps.length > 1) || (block.vuln?.remediationSteps && block.vuln.remediationSteps.length > 1);
  if (block.type === 'matrix-table') return (block.rows && block.rows.length > 2);
  return false;
}

/**
 * Gets the minimum initial height chunk required to place a split block on the current page.
 */
function getMinimumChunkHeight(block) {
  switch (block.type) {
    case 'evidence':
      return 44 + (3 * A4_CONSTANTS.CODE_LINE_HEIGHT_PX); // ~100px
    case 'poc':
      return 100;
    case 'remediation':
      return 85;
    case 'matrix-table':
      return 44 + (2 * 38); // 120px
    default:
      return estimateBlockHeight(block);
  }
}

/**
 * Core Dynamic Continuous-Flow Pagination Algorithm.
 * Fills pages continuously till the end like a book/publication while strictly
 * preserving heading companionship (keep-with-next).
 * 
 * @param {Array<Object>} blocks List of flow blocks
 * @param {Object} options Configuration options (usableHeight, minHeadingFollow, minFindingStart)
 * @returns {Array<Object>} Array of discrete A4 page definitions
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

  const workQueue = [...blocks];
  let i = 0;

  while (i < workQueue.length) {
    const block = workQueue[i];
    const blockHeight = estimateBlockHeight(block);
    block.calculatedHeight = blockHeight;

    if (block.finding) {
      currentFindingContext = block.finding;
    }

    // 1. Explicit forced page break (rarely used now for continuous flow)
    if (block.forcePageBreakBefore && currentPageBlocks.length > 0) {
      flushPage();
      if (block.finding) currentFindingContext = block.finding;
    }

    // 2. Finding Header Start Check:
    // When a finding begins, check if enough space remains for the header + initial content (~300px).
    // If not, cleanly begin on the next page.
    if (block.type === 'finding-header') {
      const remaining = maxHeight - currentHeight;
      if (currentPageBlocks.length > 0 && remaining < minFindingStart) {
        flushPage();
        if (block.finding) currentFindingContext = block.finding;
      }
    }

    // 3. Bulletproof Keep-With-Next Rule for Headings:
    // A heading must NEVER be alone at the bottom of a page.
    if (block.isHeading) {
      const remaining = maxHeight - currentHeight;
      const nextBlock = workQueue[i + 1];

      if (nextBlock) {
        const nextHeight = estimateBlockHeight(nextBlock);
        const canSplit = canSplitBlock(nextBlock);

        if (canSplit) {
          const minChunk = getMinimumChunkHeight(nextBlock);
          if (currentPageBlocks.length > 0 && (blockHeight + minChunk + gap > remaining)) {
            flushPage();
            if (block.finding) currentFindingContext = block.finding;
          }
        } else {
          if (currentPageBlocks.length > 0 && (blockHeight + nextHeight + gap > remaining)) {
            flushPage();
            if (block.finding) currentFindingContext = block.finding;
          }
        }
      } else {
        if (currentPageBlocks.length > 0 && remaining < blockHeight + gap) {
          flushPage();
        }
      }
    }

    // 4. Fitting Check
    const remaining = maxHeight - currentHeight;

    if (currentHeight === 0 || (currentHeight + blockHeight + gap <= maxHeight)) {
      currentPageBlocks.push(block);
      currentHeight += blockHeight + (currentPageBlocks.length > 1 ? gap : 0);
      i++;
    } else {
      // Does not fit on current page:
      let movedHeading = null;
      if (currentPageBlocks.length > 0 && currentPageBlocks[currentPageBlocks.length - 1].isHeading) {
        movedHeading = currentPageBlocks.pop();
        currentHeight -= estimateBlockHeight(movedHeading) + (currentPageBlocks.length > 0 ? gap : 0);
      }

      // Check if block can be split across pages
      let splitChunks = null;
      const availableForSplit = maxHeight - currentHeight;

      if (availableForSplit >= 140) {
        if (block.type === 'evidence') {
          splitChunks = splitCodeBlock(block.codeText, availableForSplit, maxHeight);
        } else if (block.type === 'poc') {
          splitChunks = splitPocBlock(block, availableForSplit, maxHeight);
        } else if (block.type === 'remediation') {
          splitChunks = splitRemediationSteps(block, availableForSplit, maxHeight);
        } else if (block.type === 'matrix-table') {
          splitChunks = splitTableRows(block, availableForSplit, maxHeight);
        }
      }

      if (splitChunks && splitChunks.length > 1) {
        // Splitting succeeded! Place first part on current page
        currentPageBlocks.push(splitChunks[0]);
        flushPage();
        if (block.finding) currentFindingContext = block.finding;

        // Replace current block with remaining split parts in workQueue
        workQueue.splice(i, 1, ...splitChunks.slice(1));
        // Continue processing at index i (which now points to part 2)
      } else {
        // Cannot or did not split: move to next page
        flushPage();
        if (block.finding) currentFindingContext = block.finding;

        if (movedHeading) {
          currentPageBlocks.push(movedHeading);
          currentHeight = estimateBlockHeight(movedHeading);
        }

        // If block alone exceeds full page, split it across full pages
        if (blockHeight > maxHeight) {
          let fullSplit = null;
          const freshAvailable = maxHeight - currentHeight;

          if (block.type === 'evidence') {
            fullSplit = splitCodeBlock(block.codeText, freshAvailable, maxHeight);
          } else if (block.type === 'poc') {
            fullSplit = splitPocBlock(block, freshAvailable, maxHeight);
          } else if (block.type === 'remediation') {
            fullSplit = splitRemediationSteps(block, freshAvailable, maxHeight);
          } else if (block.type === 'matrix-table') {
            fullSplit = splitTableRows(block, freshAvailable, maxHeight);
          }

          if (fullSplit && fullSplit.length > 1) {
            workQueue.splice(i, 1, ...fullSplit);
          } else {
            currentPageBlocks.push(block);
            currentHeight += blockHeight + (currentPageBlocks.length > 1 ? gap : 0);
            i++;
          }
        } else {
          currentPageBlocks.push(block);
          currentHeight += blockHeight + (currentPageBlocks.length > 1 ? gap : 0);
          i++;
        }
      }
    }
  }

  flushPage();
  return pages;
}

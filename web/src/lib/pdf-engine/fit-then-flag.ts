export interface MeasurableFont {
  widthOfTextAtSize: (text: string, size: number) => number;
  heightAtSize: (size: number) => number;
}

export interface FitResult {
  fittedFontSize: number;
  isOverflow: boolean;
  overflowPixels: number;
  status: 'fits' | 'clamped' | 'overflow';
  textWidth: number;
  textHeight: number;
}

export interface MultiLineFitResult {
  lines: string[];
  fittedFontSize: number;
  isOverflow: boolean;
  overflowPixels: number;
  status: 'fits' | 'clamped' | 'overflow';
  lineHeight: number;
  totalHeight: number;
}

export function calculateMultiLineWrap(
  text: string,
  font: MeasurableFont,
  box: { width: number; height: number },
  fontSize = 12,
  lineHeightMultiplier = 1.25,
  minFontSize = 8,
  maxFontSize = 24
): MultiLineFitResult {
  if (!text || text.trim().length === 0) {
    const singleLineHeight = fontSize * lineHeightMultiplier;
    return {
      lines: [''],
      fittedFontSize: fontSize,
      isOverflow: false,
      overflowPixels: 0,
      status: 'fits',
      lineHeight: singleLineHeight,
      totalHeight: singleLineHeight,
    };
  }

  let currentSize = Math.min(Math.max(fontSize, minFontSize), maxFontSize);

  const wrapAtSize = (size: number): { lines: string[]; height: number; lineHeight: number } => {
    const lh = Math.round(size * lineHeightMultiplier * 10) / 10;
    const paragraphs = text.split('\n');
    const wrappedLines: string[] = [];

    for (const paragraph of paragraphs) {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        wrappedLines.push('');
        continue;
      }

      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine.length === 0 ? word : `${currentLine} ${word}`;
        const testWidth = font.widthOfTextAtSize(testLine, size);

        if (testWidth <= box.width) {
          currentLine = testLine;
        } else {
          if (currentLine.length > 0) {
            wrappedLines.push(currentLine);
            currentLine = word;
          } else {
            wrappedLines.push(word);
            currentLine = '';
          }
        }
      }
      if (currentLine.length > 0) {
        wrappedLines.push(currentLine);
      }
    }

    const totalH = wrappedLines.length * lh;
    return { lines: wrappedLines, height: totalH, lineHeight: lh };
  };

  let wrapped = wrapAtSize(currentSize);

  while (wrapped.height > box.height && currentSize > minFontSize) {
    currentSize = Math.max(minFontSize, currentSize - 1);
    wrapped = wrapAtSize(currentSize);
  }

  const isOverflow = wrapped.height > box.height;
  const overflowPixels = isOverflow ? Math.round((wrapped.height - box.height) * 10) / 10 : 0;
  const status: 'fits' | 'clamped' | 'overflow' = isOverflow
    ? 'overflow'
    : currentSize < fontSize
    ? 'clamped'
    : 'fits';

  return {
    lines: wrapped.lines,
    fittedFontSize: currentSize,
    isOverflow,
    overflowPixels,
    status,
    lineHeight: wrapped.lineHeight,
    totalHeight: wrapped.height,
  };
}

export function calculateFit(
  text: string,
  font: MeasurableFont,
  box: { width: number; height: number },
  minFontSize = 8,
  maxFontSize = 24,
  fitMode: 'shrink-to-fit' | 'fixed' | 'multi-line' = 'shrink-to-fit'
): FitResult {
  if (fitMode === 'multi-line') {
    const multi = calculateMultiLineWrap(text, font, box, maxFontSize, 1.25, minFontSize, maxFontSize);
    return {
      fittedFontSize: multi.fittedFontSize,
      isOverflow: multi.isOverflow,
      overflowPixels: multi.overflowPixels,
      status: multi.status,
      textWidth: box.width,
      textHeight: multi.totalHeight,
    };
  }
  if (!text || text.trim().length === 0) {
    return {
      fittedFontSize: maxFontSize,
      isOverflow: false,
      overflowPixels: 0,
      status: 'fits',
      textWidth: 0,
      textHeight: font.heightAtSize(maxFontSize),
    };
  }

  const unitWidth = font.widthOfTextAtSize(text, 1);
  const unitHeight = font.heightAtSize(1);

  if (fitMode === 'fixed') {
    const textWidth = unitWidth * maxFontSize;
    const textHeight = unitHeight * maxFontSize;
    const isOverflow = textWidth > box.width || textHeight > box.height;
    const overflowPixels = Math.max(0, textWidth - box.width);

    return {
      fittedFontSize: maxFontSize,
      isOverflow,
      overflowPixels,
      status: isOverflow ? 'overflow' : 'fits',
      textWidth,
      textHeight,
    };
  }

  // shrink-to-fit mode
  // Max size that physically fits horizontally and vertically
  const maxFittingWidthSize = unitWidth > 0 ? box.width / unitWidth : maxFontSize;
  const maxFittingHeightSize = unitHeight > 0 ? box.height / unitHeight : maxFontSize;
  const idealSize = Math.min(maxFontSize, maxFittingWidthSize, maxFittingHeightSize);

  if (idealSize < minFontSize) {
    // Fits neither width nor height even at min font size
    const actualWidth = unitWidth * minFontSize;
    const actualHeight = unitHeight * minFontSize;
    const overflowPixels = Math.max(0, actualWidth - box.width);

    return {
      fittedFontSize: minFontSize,
      isOverflow: true,
      overflowPixels: Math.round(overflowPixels * 10) / 10,
      status: 'overflow',
      textWidth: Math.round(actualWidth * 10) / 10,
      textHeight: Math.round(actualHeight * 10) / 10,
    };
  }

  const fittedFontSize = Math.floor(idealSize * 10) / 10;
  const textWidth = Math.round(unitWidth * fittedFontSize * 10) / 10;
  const textHeight = Math.round(unitHeight * fittedFontSize * 10) / 10;

  return {
    fittedFontSize,
    isOverflow: false,
    overflowPixels: 0,
    status: fittedFontSize < maxFontSize ? 'clamped' : 'fits',
    textWidth,
    textHeight,
  };
}

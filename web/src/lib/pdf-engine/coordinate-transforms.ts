export interface PdfRect {
  x: number; // bottom-left X in PDF points
  y: number; // bottom-left Y in PDF points
  width: number; // width in PDF points
  height: number; // height in PDF points
}

export interface DomRect {
  x: number; // top-left X in CSS pixels
  y: number; // top-left Y in CSS pixels
  width: number; // width in CSS pixels
  height: number; // height in CSS pixels
}

export interface ViewportConfig {
  width: number; // viewport width in CSS px
  height: number; // viewport height in CSS px
  scale: number; // zoom factor
  rotation: number; // rotation in degrees: 0, 90, 180, 270
}

/**
 * Converts DOM viewport CSS pixels (origin top-left) to canonical PDF points (origin bottom-left).
 */
export function domToPdfRect(dom: DomRect, vp: ViewportConfig): PdfRect {
  const { scale, rotation } = vp;
  const rot = ((rotation % 360) + 360) % 360;

  switch (rot) {
    case 90:
      return {
        x: dom.y / scale,
        y: dom.x / scale,
        width: dom.height / scale,
        height: dom.width / scale,
      };

    case 180:
      return {
        x: (vp.width - (dom.x + dom.width)) / scale,
        y: dom.y / scale,
        width: dom.width / scale,
        height: dom.height / scale,
      };

    case 270:
      return {
        x: (vp.height - (dom.y + dom.height)) / scale,
        y: (vp.width - (dom.x + dom.width)) / scale,
        width: dom.height / scale,
        height: dom.width / scale,
      };

    case 0:
    default:
      return {
        x: dom.x / scale,
        y: (vp.height - (dom.y + dom.height)) / scale,
        width: dom.width / scale,
        height: dom.height / scale,
      };
  }
}

/**
 * Converts canonical PDF points (origin bottom-left) to DOM viewport CSS pixels (origin top-left).
 */
export function pdfToDomRect(pdf: PdfRect, vp: ViewportConfig): DomRect {
  const { scale, rotation } = vp;
  const rot = ((rotation % 360) + 360) % 360;

  switch (rot) {
    case 90:
      return {
        x: pdf.y * scale,
        y: pdf.x * scale,
        width: pdf.height * scale,
        height: pdf.width * scale,
      };

    case 180:
      return {
        x: vp.width - (pdf.x + pdf.width) * scale,
        y: pdf.y * scale,
        width: pdf.width * scale,
        height: pdf.height * scale,
      };

    case 270:
      return {
        x: vp.width - (pdf.y + pdf.height) * scale,
        y: vp.height - (pdf.x + pdf.width) * scale,
        width: pdf.height * scale,
        height: pdf.width * scale,
      };

    case 0:
    default:
      return {
        x: pdf.x * scale,
        y: vp.height - (pdf.y + pdf.height) * scale,
        width: pdf.width * scale,
        height: pdf.height * scale,
      };
  }
}

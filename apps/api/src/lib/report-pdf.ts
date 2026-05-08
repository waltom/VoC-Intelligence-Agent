/**
 * PDF export — intentionally not implemented in MVP.
 *
 * Adding pdf-lib pulls ~500 KB into the Worker bundle and only buys us a
 * server-rendered PDF without charts (pdf-lib has no SVG/HTML support). The
 * far better UX is: open /report.html in a browser and use Print → Save as
 * PDF. The print stylesheet in report-html.ts is already tuned for that.
 *
 * Returning 501 here is the documented path; if a paid plan later enables
 * Browser Rendering we can replace this with a real implementation.
 */
import { err } from "../middleware/auth.js";

export function pdfNotImplemented(analysisId: string): Response {
  return Response.json(
    err(
      "NOT_IMPLEMENTED",
      "PDF export not implemented — open /report.html and use Print → Save as PDF.",
      { alternative: `/analyses/${analysisId}/report.html`, reason: "MVP keeps the bundle small and the report's print stylesheet renders cleanly in browsers." },
    ),
    { status: 501 },
  );
}

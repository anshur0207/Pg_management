import { jsPDF } from "jspdf";

type DownloadRentalAgreementPdfOptions = {
  agreementNumber: string;
  terms: string;
  signedName: string;
  signedAt: string;
};

const isHeading = (line: string) => /^(?:\d+\.\s*)?[A-Z][A-Z0-9 &'()/–—-]*$/.test(line);

function pdfSafeText(value: string) {
  return value
    .replaceAll("₹", "INR ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replaceAll("•", "-");
}

export function downloadRentalAgreementPdf({ agreementNumber, terms, signedName, signedAt }: DownloadRentalAgreementPdfOptions) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentX = 22;
  const contentWidth = pageWidth - contentX * 2;
  const bottomLimit = pageHeight - 22;
  let y = 22;

  function drawFrame() {
    pdf.setDrawColor(7, 158, 229);
    pdf.setLineWidth(2.4);
    pdf.rect(8, 8, pageWidth - 16, pageHeight - 16);
    pdf.setDrawColor(220, 232, 240);
    pdf.setLineWidth(0.25);
    pdf.rect(12, 12, pageWidth - 24, pageHeight - 24);
  }

  function ensureSpace(height: number) {
    if (y + height > bottomLimit) {
      pdf.addPage();
      drawFrame();
      y = 22;
    }
  }

  function writeText(text: string, indent = 0, fontStyle: "normal" | "bold" = "normal") {
    pdf.setFont("times", fontStyle);
    pdf.setFontSize(10.5);
    const lines = pdf.splitTextToSize(pdfSafeText(text), contentWidth - indent) as string[];
    const lineHeight = 5;
    ensureSpace(lines.length * lineHeight + 2);
    pdf.text(lines, contentX + indent, y);
    y += lines.length * lineHeight + 2;
  }

  drawFrame();
  const lines = terms.split("\n");
  const title = pdfSafeText(lines[0]?.replace(/^#+\s*/, "") || "RENTAL AGREEMENT");
  pdf.setFont("times", "bold");
  pdf.setFontSize(24);
  const titleLines = pdf.splitTextToSize(title, contentWidth) as string[];
  pdf.text(titleLines, pageWidth / 2, y + 4, { align: "center" });
  y += titleLines.length * 9 + 2;

  const subtitle = lines[1]?.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
  if (subtitle) {
    pdf.setFont("times", "bold");
    pdf.setFontSize(12);
    const subtitleLines = pdf.splitTextToSize(pdfSafeText(subtitle.toUpperCase()), contentWidth) as string[];
    pdf.text(subtitleLines, pageWidth / 2, y, { align: "center" });
    y += subtitleLines.length * 6 + 5;
  }

  for (const rawLine of lines.slice(2)) {
    const line = rawLine.replace(/^\s*#+\s*/, "").replace(/\*\*/g, "").trim();
    if (!line || /^---+$/.test(line)) {
      y += 2;
      continue;
    }

    if (isHeading(line)) {
      const heading = pdfSafeText(line);
      pdf.setFont("times", "bold");
      pdf.setFontSize(11);
      const headingLines = pdf.splitTextToSize(heading, contentWidth) as string[];
      ensureSpace(headingLines.length * 6 + 3);
      pdf.text(headingLines, contentX, y);
      for (const [index, headingLine] of headingLines.entries()) {
        const lineWidth = Math.min(pdf.getTextWidth(headingLine), contentWidth);
        pdf.setDrawColor(30, 30, 30);
        pdf.setLineWidth(0.25);
        pdf.line(contentX, y + 1 + index * 6, contentX + lineWidth, y + 1 + index * 6);
      }
      y += headingLines.length * 6 + 3;
      continue;
    }

    const numberedClause = line.match(/^(\d+)\.\s+(.+)$/);
    if (numberedClause) {
      writeText(`${numberedClause[1]}.  ${numberedClause[2]}`, 2);
      continue;
    }

    const field = line.match(/^([^:]+):\s*(.*)$/);
    if (field) {
      pdf.setFont("times", "bold");
      pdf.setFontSize(10.5);
      const label = pdfSafeText(`${field[1]}: `);
      const labelWidth = pdf.getTextWidth(label);
      const value = pdfSafeText(field[2]);
      const valueLines = pdf.splitTextToSize(value, Math.max(20, contentWidth - labelWidth - 2)) as string[];
      ensureSpace(Math.max(5, valueLines.length * 5) + 2);
      pdf.text(label, contentX + 1, y);
      pdf.setFont("times", "normal");
      if (valueLines.length) pdf.text(valueLines[0], contentX + 1 + labelWidth, y);
      if (valueLines.length > 1) pdf.text(valueLines.slice(1), contentX + 1, y + 5);
      y += Math.max(5, valueLines.length * 5) + 2;
      continue;
    }

    writeText(line.replace(/^[-•]\s*/, ""), 1);
  }

  y += 3;
  pdf.setFont("times", "bold");
  pdf.setFontSize(11);
  ensureSpace(30);
  pdf.text("ELECTRONIC ACCEPTANCE", contentX, y);
  pdf.setDrawColor(30, 30, 30);
  pdf.line(contentX, y + 1, contentX + pdf.getTextWidth("ELECTRONIC ACCEPTANCE"), y + 1);
  y += 7;
  writeText(`Resident signature: ${signedName}`);
  writeText(`Signed electronically on: ${new Date(signedAt).toLocaleString("en-IN")}`);
  writeText("The resident confirmed that they read and accepted this agreement before submitting the typed-name signature.");

  const safeNumber = agreementNumber.replace(/[^a-zA-Z0-9_-]/g, "-");
  pdf.save(`${safeNumber}.pdf`);
}

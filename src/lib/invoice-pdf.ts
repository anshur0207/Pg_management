import { jsPDF } from "jspdf";

export type InvoicePdfData = {
  invoiceNumber: string;
  residentName: string;
  propertyName: string;
  billingStart: string;
  billingEnd: string;
  issuedAt: string;
  dueDate: string;
  totalPaise: number;
  paidPaise: number;
  status: string;
  notes: string | null;
  items: { description: string; quantity: number; amountPaise: number }[];
};

const amount = (paise: number) => `INR ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

export function downloadInvoicePdf(invoice: InvoicePdfData) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 18;
  const width = pageWidth - margin * 2;
  let y = 22;

  pdf.setFillColor(22, 115, 84);
  pdf.rect(0, 0, pageWidth, 39, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("RENT INVOICE", margin, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(invoice.invoiceNumber, pageWidth - margin, y, { align: "right" });

  y = 52;
  pdf.setTextColor(35, 51, 42);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(invoice.propertyName, margin, y);
  y += 9;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Billed to: ${invoice.residentName}`, margin, y);
  y += 7;
  pdf.text(`Billing period: ${date(invoice.billingStart)} - ${date(invoice.billingEnd)}`, margin, y);
  y += 7;
  pdf.text(`Bill date: ${date(invoice.issuedAt)}    Due date: ${date(invoice.dueDate)}`, margin, y);

  y += 13;
  pdf.setFillColor(242, 247, 243);
  pdf.roundedRect(margin, y - 6, width, 14, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.text("DESCRIPTION", margin + 3, y + 2);
  pdf.text("AMOUNT", pageWidth - margin - 3, y + 2, { align: "right" });
  y += 14;
  pdf.setFont("helvetica", "normal");
  for (const item of invoice.items) {
    const description = pdf.splitTextToSize(item.description, width - 48) as string[];
    if (y + Math.max(8, description.length * 5) > 260) { pdf.addPage(); y = 22; }
    pdf.text(description, margin + 3, y);
    pdf.text(amount(item.amountPaise), pageWidth - margin - 3, y, { align: "right" });
    y += Math.max(8, description.length * 5);
    pdf.setDrawColor(225, 233, 227);
    pdf.line(margin, y - 3, pageWidth - margin, y - 3);
  }
  y += 4;
  pdf.setFont("helvetica", "normal");
  pdf.text("Invoice total", pageWidth - margin - 55, y);
  pdf.setFont("helvetica", "bold");
  pdf.text(amount(invoice.totalPaise), pageWidth - margin, y, { align: "right" });
  y += 7;
  pdf.setFont("helvetica", "normal");
  pdf.text("Paid", pageWidth - margin - 55, y);
  pdf.text(amount(invoice.paidPaise), pageWidth - margin, y, { align: "right" });
  y += 7;
  pdf.setFont("helvetica", "bold");
  pdf.text("Balance due", pageWidth - margin - 55, y);
  pdf.text(amount(Math.max(0, invoice.totalPaise - invoice.paidPaise)), pageWidth - margin, y, { align: "right" });
  y += 12;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Status: ${invoice.status.replaceAll("_", " ").toUpperCase()}`, margin, y);
  if (invoice.notes) {
    y += 10;
    pdf.setFont("helvetica", "bold");
    pdf.text("Notes", margin, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    pdf.text(pdf.splitTextToSize(invoice.notes, width) as string[], margin, y);
  }
  pdf.setTextColor(110, 125, 116);
  pdf.setFontSize(8);
  pdf.text("Generated electronically by PG Manager.", margin, 285);
  pdf.save(`${invoice.invoiceNumber}.pdf`);
}

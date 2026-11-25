import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate } from "./utils";
import { generateUpiQrDataUrl } from "./qrcode";

export interface InvoicePdfData {
  invoiceNumber: string;
  invoiceDate: string | Date;
  dueDate?: string | Date;
  status: string;
  paymentStatus: string;
  seller: {
    businessName: string;
    logoUrl?: string;
    gstin: string;
    address: string;
    city: string;
    state: string;
    stateCode: string;
    pincode: string;
    phone: string;
    email: string;
    bankDetails: {
      bankName: string;
      accountHolder: string;
      accountNumber: string;
      ifscCode: string;
      branch: string;
    };
    upiId?: string;
  };
  customer: {
    name: string;
    businessName?: string;
    phone: string;
    email?: string;
    billingAddress: string;
    shippingAddress?: string;
    gstin?: string;
    state: string;
    stateCode: string;
  };
  items: Array<{
    productName: string;
    sku: string;
    hsnCode: string;
    uom: string;
    rate: number;
    quantity: number;
    discount: number;
    taxableAmount: number;
    gstRate: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalAmount: number;
  }>;
  taxableAmount: number;
  totalDiscount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
  isInterState: boolean;
  amountPaid: number;
  balanceDue: number;
  termsAndConditions?: string;
}

async function resolveLogoDataUrl(logoUrl?: string): Promise<string | null> {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("data:image/")) return logoUrl;
  if (typeof window === "undefined") return null;

  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateInvoicePdf(
  invoice: InvoicePdfData,
  action: "save" | "blob" | "arraybuffer" | "datauristring" = "save"
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  const navy: [number, number, number] = [14, 30, 50]; // #0e1e32 Deep Navy
  const emerald: [number, number, number] = [5, 150, 105]; // #059669 Emerald
  const borderCol: [number, number, number] = [215, 222, 232];
  const textDark: [number, number, number] = [20, 28, 38];
  const textMuted: [number, number, number] = [90, 102, 118];

  const sellerName = invoice.seller?.businessName || "Kyra Enterprises";
  let currentY = margin;

  // 1. HEADER WITH LOGO & ENTERPRISE IDENTITY
  const logoData = await resolveLogoDataUrl(invoice.seller?.logoUrl || "/logo.jpeg");
  let brandTextX = margin;
  if (logoData) {
    try {
      const format = logoData.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(logoData, format, margin, currentY, 15, 15);
      brandTextX = margin + 18;
    } catch {}
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...navy);
  doc.text(sellerName, brandTextX, currentY + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...emerald);
  doc.text("GST Registered Billing & Wholesale Supply", brandTextX, currentY + 10.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...textDark);
  if (invoice.seller?.gstin) {
    doc.text(`GSTIN: ${invoice.seller.gstin}`, brandTextX, currentY + 14.5);
  }

  // Right-side Seller Address & Contact
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  const addrParts = [
    invoice.seller?.address,
    invoice.seller?.city,
    invoice.seller?.state ? `${invoice.seller.state} (${invoice.seller.stateCode})` : "",
    invoice.seller?.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  doc.text(addrParts, pageWidth - margin, currentY + 4.5, {
    align: "right",
    maxWidth: 92,
  });
  doc.text(`Phone: ${invoice.seller?.phone || "N/A"}`, pageWidth - margin, currentY + 10.5, {
    align: "right",
  });
  doc.text(`Email: ${invoice.seller?.email || "N/A"}`, pageWidth - margin, currentY + 14.5, {
    align: "right",
  });

  currentY += 18;
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.6);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // 2. DOCUMENT TITLE BANNER
  currentY += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...navy);
  const docTitle =
    invoice.status === "cancelled"
      ? "TAX INVOICE (CANCELLED)"
      : invoice.status === "amended"
      ? "TAX INVOICE (AMENDED)"
      : "TAX INVOICE";
  doc.text(docTitle, pageWidth / 2, currentY + 1.5, { align: "center" });

  // Payment Status Pill on right
  const statusLabel =
    invoice.paymentStatus === "paid"
      ? "PAID"
      : invoice.paymentStatus === "partial"
      ? "PARTIALLY PAID"
      : invoice.paymentStatus === "overdue"
      ? "OVERDUE"
      : "UNPAID";
  doc.setFontSize(8);
  doc.setTextColor(
    ...(invoice.paymentStatus === "paid"
      ? emerald
      : invoice.paymentStatus === "overdue"
      ? ([200, 35, 35] as [number, number, number])
      : ([180, 110, 10] as [number, number, number]))
  );
  doc.text(`Status: ${statusLabel}`, pageWidth - margin, currentY + 1.5, { align: "right" });

  currentY += 5;

  // 3. INVOICE META & CUSTOMER BOXES
  const halfWidth = (contentWidth - 4) / 2;
  const metaHeight = 26;

  doc.setDrawColor(...borderCol);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, halfWidth, metaHeight, 1.5, 1.5, "S");
  doc.roundedRect(margin + halfWidth + 4, currentY, halfWidth, metaHeight, 1.5, 1.5, "S");

  // Left: Buyer / Customer Details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...navy);
  doc.text("BILLED TO (CUSTOMER DETAILS)", margin + 3, currentY + 4.5);

  doc.setFontSize(8.5);
  doc.setTextColor(...textDark);
  doc.text(
    invoice.customer.businessName || invoice.customer.name,
    margin + 3,
    currentY + 9.2
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...textMuted);
  doc.text(invoice.customer.billingAddress || "", margin + 3, currentY + 13.5, {
    maxWidth: halfWidth - 6,
  });
  doc.text(
    `State: ${invoice.customer.state} (${invoice.customer.stateCode}) | Ph: ${invoice.customer.phone}`,
    margin + 3,
    currentY + 19.5
  );
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text(
    `Customer GSTIN: ${invoice.customer.gstin || "Unregistered"}`,
    margin + 3,
    currentY + 23.8
  );

  // Right: Invoice Metadata
  const rx = margin + halfWidth + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...navy);
  doc.text("INVOICE & TAX METADATA", rx, currentY + 4.5);

  doc.setFontSize(7.5);
  doc.setTextColor(...textDark);
  doc.setFont("helvetica", "normal");
  doc.text("Invoice No:", rx, currentY + 9.5);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.invoiceNumber, rx + 26, currentY + 9.5);

  doc.setFont("helvetica", "normal");
  doc.text("Invoice Date:", rx, currentY + 14);
  doc.setFont("helvetica", "bold");
  doc.text(formatDate(invoice.invoiceDate), rx + 26, currentY + 14);

  doc.setFont("helvetica", "normal");
  doc.text("Due Date:", rx, currentY + 18.5);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.dueDate ? formatDate(invoice.dueDate) : "Immediate", rx + 26, currentY + 18.5);

  doc.setFont("helvetica", "normal");
  doc.text("Tax Regime:", rx, currentY + 23);
  doc.setFont("helvetica", "bold");
  doc.text(
    invoice.isInterState ? "Inter-State (IGST)" : "Intra-State (CGST + SGST)",
    rx + 26,
    currentY + 23
  );

  currentY += metaHeight + 4;

  // 4. LINE ITEMS TABLE
  const isInter = invoice.isInterState;
  const headRow = isInter
    ? [["#", "Product Description", "HSN", "Qty", "Rate", "Disc.", "Taxable", "GST%", "IGST", "Total"]]
    : [["#", "Product Description", "HSN", "Qty", "Rate", "Disc.", "Taxable", "GST%", "CGST+SGST", "Total"]];

  const bodyRows = invoice.items.map((it, idx) => [
    String(idx + 1),
    it.productName,
    it.hsnCode || "-",
    `${it.quantity} ${it.uom || ""}`.trim(),
    Number(it.rate || 0).toFixed(2),
    Number(it.discount || 0).toFixed(2),
    Number(it.taxableAmount || 0).toFixed(2),
    `${it.gstRate}%`,
    isInter
      ? Number(it.igstAmount || 0).toFixed(2)
      : (Number(it.cgstAmount || 0) + Number(it.sgstAmount || 0)).toFixed(2),
    Number(it.totalAmount || 0).toFixed(2),
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: headRow,
    body: bodyRows,
    theme: "grid",
    headStyles: {
      fillColor: navy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
      cellPadding: 2,
    },
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 1.8,
      textColor: textDark,
      lineColor: borderCol,
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 18, halign: "right" },
      5: { cellWidth: 14, halign: "right" },
      6: { cellWidth: 20, halign: "right" },
      7: { cellWidth: 12, halign: "center" },
      8: { cellWidth: 20, halign: "right" },
      9: { cellWidth: 22, halign: "right", fontStyle: "bold" },
    },
  });

  let endY = (doc as any).lastAutoTable.finalY + 3;

  // Ensure enough space for totals + bank + terms
  if (endY + 75 > pageHeight - margin) {
    doc.addPage();
    endY = margin + 4;
  }

  // 5. TOTALS & PAYMENT SUMMARY (Right) + AMOUNT IN WORDS (Left)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...navy);
  doc.text("AMOUNT IN WORDS", margin, endY + 4);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...textDark);
  doc.text(invoice.amountInWords || "", margin, endY + 8.5, { maxWidth: 105 });

  // Payment Summary Box on Left below Words
  doc.setDrawColor(...borderCol);
  doc.roundedRect(margin, endY + 13, 105, 16, 1.2, 1.2, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...navy);
  doc.text("PAYMENT SETTLEMENT SUMMARY", margin + 3, endY + 17.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textDark);
  doc.text(
    `Amount Paid: Rs. ${Number(invoice.amountPaid || 0).toFixed(2)}   |   Balance Due: Rs. ${Number(
      invoice.balanceDue || 0
    ).toFixed(2)}`,
    margin + 3,
    endY + 23
  );
  doc.text(`Payment Status: ${statusLabel}`, margin + 3, endY + 27);

  // Right Totals Breakdown
  let ty = endY + 3.5;
  const labelX = pageWidth - margin - 38;
  const valX = pageWidth - margin;

  const drawTotalLine = (lbl: string, val: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 9 : 7.5);
    doc.setTextColor(...textDark);
    doc.text(lbl, labelX, ty, { align: "right" });
    doc.text(val, valX, ty, { align: "right" });
    ty += 4.3;
  };

  drawTotalLine("Taxable Subtotal:", `Rs. ${Number(invoice.taxableAmount || 0).toFixed(2)}`);
  if ((invoice.totalDiscount || 0) > 0) {
    drawTotalLine("Total Discount:", `- Rs. ${Number(invoice.totalDiscount).toFixed(2)}`);
  }
  if (isInter) {
    drawTotalLine("Total IGST:", `+ Rs. ${Number(invoice.totalIgst || 0).toFixed(2)}`);
  } else {
    drawTotalLine("Total CGST:", `+ Rs. ${Number(invoice.totalCgst || 0).toFixed(2)}`);
    drawTotalLine("Total SGST:", `+ Rs. ${Number(invoice.totalSgst || 0).toFixed(2)}`);
  }
  if ((invoice.roundOff || 0) !== 0) {
    drawTotalLine(
      "Round Off:",
      `${invoice.roundOff > 0 ? "+" : ""}Rs. ${Number(invoice.roundOff).toFixed(2)}`
    );
  }

  doc.setFillColor(...navy);
  doc.roundedRect(pageWidth - margin - 78, ty - 2.5, 78, 8, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("GRAND TOTAL:", pageWidth - margin - 40, ty + 2.8, { align: "right" });
  doc.text(`Rs. ${Number(invoice.grandTotal || 0).toFixed(2)}`, valX - 2, ty + 2.8, {
    align: "right",
  });

  endY = Math.max(endY + 33, ty + 10);

  // 6. BANK DETAILS & UPI QR
  const bankH = 34;
  const qrW = 38;
  const bankW = contentWidth - qrW - 4;

  doc.setDrawColor(...borderCol);
  doc.roundedRect(margin, endY, bankW, bankH, 1.5, 1.5, "S");
  doc.roundedRect(margin + bankW + 4, endY, qrW, bankH, 1.5, 1.5, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...navy);
  doc.text("BANK ACCOUNT & PAYMENT DETAILS", margin + 3, endY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...textDark);
  const bd = invoice.seller?.bankDetails || ({} as any);
  doc.text(`Account Holder: ${bd.accountHolder || sellerName}`, margin + 3, endY + 10.5);
  doc.text(`Bank Name: ${bd.bankName || "N/A"} (${bd.branch || ""})`, margin + 3, endY + 15.5);
  doc.text(`Account No: ${bd.accountNumber || "N/A"}`, margin + 3, endY + 20.5);
  doc.text(`IFSC Code: ${bd.ifscCode || "N/A"}`, margin + 3, endY + 25.5);
  doc.text(`UPI ID: ${invoice.seller?.upiId || "N/A"}`, margin + 3, endY + 30.5);

  const qrBoxX = margin + bankW + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...navy);
  doc.text("SCAN TO PAY UPI", qrBoxX + qrW / 2, endY + 4.5, { align: "center" });

  if (invoice.seller?.upiId) {
    try {
      const payTarget = invoice.balanceDue > 0 ? invoice.balanceDue : invoice.grandTotal;
      const qrDataUrl = await generateUpiQrDataUrl({
        upiId: invoice.seller.upiId,
        payeeName: sellerName,
        amount: payTarget,
        note: `Inv ${invoice.invoiceNumber}`,
      });
      if (qrDataUrl) {
        doc.addImage(qrDataUrl, "PNG", qrBoxX + (qrW - 23) / 2, endY + 6, 23, 23);
      }
    } catch {}
  }

  endY += bankH + 4;

  // 7. TERMS & AUTHORIZED SIGNATORY
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...navy);
  doc.text("TERMS & CONDITIONS", margin, endY + 3.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...textMuted);
  const termsText =
    invoice.termsAndConditions ||
    "1. Goods once sold will be covered as per manufacturer warranty.\n2. Kindly settle outstanding balances within the due date.";
  doc.text(termsText, margin, endY + 7.5, { maxWidth: contentWidth - 55 });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...navy);
  doc.text(`For ${sellerName}`, pageWidth - margin, endY + 6, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...textMuted);
  doc.text("Authorized Signatory", pageWidth - margin, endY + 19, { align: "right" });

  if (action === "blob") {
    return doc.output("blob");
  }
  if (action === "arraybuffer") {
    return doc.output("arraybuffer");
  }
  if (action === "datauristring") {
    return doc.output("datauristring");
  }
  doc.save(`Kyra_Invoice_${invoice.invoiceNumber.replace(/[\/\\]/g, "_")}.pdf`);
}

export function generateTableReportPdf(params: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  fileName: string;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(14, 30, 50);
  doc.text(`Kyra Enterprises — ${params.title}`, 12, 14);

  if (params.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(90, 102, 118);
    doc.text(params.subtitle, 12, 19.5);
  }

  autoTable(doc, {
    startY: 24,
    head: [params.headers],
    body: params.rows.map((r) => r.map((c) => String(c ?? ""))),
    headStyles: {
      fillColor: [14, 30, 50],
      textColor: [255, 255, 255],
      fontSize: 8,
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
  });

  doc.save(params.fileName);
}

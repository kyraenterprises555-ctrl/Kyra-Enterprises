import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate } from "./utils";

export interface InvoicePdfData {
  invoiceNumber: string;
  invoiceDate: string | Date;
  dueDate?: string | Date;
  status: string;
  paymentStatus: string;
  seller: {
    businessName: string;
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

export function generateInvoicePdf(invoice: InvoicePdfData, action: "save" | "blob" = "save") {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Header Banner
  doc.setFillColor(30, 58, 95); // Deep Navy (#1e3a5f)
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.seller.businessName.toUpperCase(), margin, 12);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("TAX INVOICE / BILL OF SUPPLY", margin, 19);
  doc.text(`GSTIN: ${invoice.seller.gstin}`, margin, 24);

  // Invoice Meta top right
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`INVOICE NO: ${invoice.invoiceNumber}`, pageWidth - margin, 12, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${formatDate(invoice.invoiceDate)}`, pageWidth - margin, 18, { align: "right" });
  doc.text(`Place of Supply: ${invoice.customer.state} (${invoice.customer.stateCode})`, pageWidth - margin, 23, { align: "right" });

  // Seller & Buyer Details Box
  let y = 34;
  doc.setDrawColor(220, 226, 235);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, (pageWidth - margin * 2) / 2 - 2, 38, 2, 2, "FD");
  doc.roundedRect(pageWidth / 2 + 2, y, (pageWidth - margin * 2) / 2 - 2, 38, 2, 2, "FD");

  // Seller side
  doc.setTextColor(30, 58, 95);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("BILLED BY (SELLER):", margin + 4, y + 6);

  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.seller.businessName, margin + 4, y + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(invoice.seller.address, margin + 4, y + 16, { maxWidth: 75 });
  doc.text(`${invoice.seller.city}, ${invoice.seller.state} - ${invoice.seller.pincode} (Code: ${invoice.seller.stateCode})`, margin + 4, y + 25);
  doc.text(`Phone: ${invoice.seller.phone} | Email: ${invoice.seller.email}`, margin + 4, y + 30);
  doc.text(`GSTIN: ${invoice.seller.gstin}`, margin + 4, y + 35);

  // Customer side
  const custX = pageWidth / 2 + 6;
  doc.setTextColor(30, 58, 95);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("BILLED TO (BUYER):", custX, y + 6);

  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.customer.businessName || invoice.customer.name, custX, y + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (invoice.customer.businessName) {
    doc.text(`Attn: ${invoice.customer.name}`, custX, y + 16);
    doc.text(invoice.customer.billingAddress, custX, y + 21, { maxWidth: 75 });
  } else {
    doc.text(invoice.customer.billingAddress, custX, y + 16, { maxWidth: 75 });
  }
  doc.text(`State: ${invoice.customer.state} (Code: ${invoice.customer.stateCode})`, custX, y + 26);
  doc.text(`Phone: ${invoice.customer.phone} ${invoice.customer.email ? `| ${invoice.customer.email}` : ""}`, custX, y + 31);
  doc.text(`GSTIN: ${invoice.customer.gstin || "Unregistered"}`, custX, y + 36);

  // Table of Items
  const isInter = invoice.isInterState;
  const tableHeaders = isInter
    ? ["#", "Item Description", "HSN", "Qty", "Rate", "Taxable", "IGST %", "IGST", "Total"]
    : ["#", "Item Description", "HSN", "Qty", "Rate", "Taxable", "CGST", "SGST", "Total"];

  const tableBody = invoice.items.map((item, idx) => {
    return isInter
      ? [
          (idx + 1).toString(),
          item.productName,
          item.hsnCode || "-",
          `${item.quantity} ${item.uom}`,
          formatCurrency(item.rate),
          formatCurrency(item.taxableAmount),
          `${item.gstRate}%`,
          formatCurrency(item.igstAmount),
          formatCurrency(item.totalAmount),
        ]
      : [
          (idx + 1).toString(),
          item.productName,
          item.hsnCode || "-",
          `${item.quantity} ${item.uom}`,
          formatCurrency(item.rate),
          formatCurrency(item.taxableAmount),
          formatCurrency(item.cgstAmount),
          formatCurrency(item.sgstAmount),
          formatCurrency(item.totalAmount),
        ];
  });

  autoTable(doc, {
    startY: y + 43,
    head: [tableHeaders],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      halign: "center",
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { halign: "left" },
      2: { halign: "center", cellWidth: 15 },
      3: { halign: "center", cellWidth: 15 },
      4: { halign: "right", cellWidth: 18 },
      5: { halign: "right", cellWidth: 20 },
      6: { halign: "right", cellWidth: 16 },
      7: { halign: "right", cellWidth: 18 },
      8: { halign: "right", cellWidth: 22 },
    },
    margin: { left: margin, right: margin },
  });

  // Calculate final Y position after table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY + 4;

  // If finalY is too close to bottom, add page
  let currentY = finalY;
  if (currentY > pageHeight - 65) {
    doc.addPage();
    currentY = 20;
  }

  // Summary box on right
  const summaryWidth = 75;
  const summaryX = pageWidth - margin - summaryWidth;

  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  const drawRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, summaryX, currentY);
    doc.text(value, pageWidth - margin, currentY, { align: "right" });
    currentY += 4.5;
  };

  drawRow("Taxable Amount:", formatCurrency(invoice.taxableAmount));
  if (invoice.totalDiscount > 0) {
    drawRow("Total Discount:", `-${formatCurrency(invoice.totalDiscount)}`);
  }

  if (isInter) {
    drawRow(`IGST:`, formatCurrency(invoice.totalIgst));
  } else {
    drawRow(`CGST:`, formatCurrency(invoice.totalCgst));
    drawRow(`SGST:`, formatCurrency(invoice.totalSgst));
  }

  if (invoice.roundOff !== 0) {
    drawRow("Round Off:", formatCurrency(invoice.roundOff));
  }

  // Grand Total highlight bar
  doc.setFillColor(30, 58, 95);
  doc.rect(summaryX - 2, currentY - 3, summaryWidth + 2, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Grand Total:", summaryX, currentY + 1.5);
  doc.text(formatCurrency(invoice.grandTotal), pageWidth - margin, currentY + 1.5, { align: "right" });

  currentY += 8;

  // Amount Paid & Balance Due
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(8);
  drawRow("Amount Paid:", formatCurrency(invoice.amountPaid));
  drawRow("Balance Due:", formatCurrency(invoice.balanceDue), true);

  // Left side: Bank details, Amount in words, Terms
  const leftX = margin;
  let leftY = finalY;

  // Amount in words
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  doc.text("Amount Chargeable (in words):", leftX, leftY);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(51, 65, 85);
  doc.text(invoice.amountInWords, leftX, leftY + 4, { maxWidth: summaryX - leftX - 6 });

  leftY += 13;

  // Bank Details Card
  doc.setDrawColor(220, 226, 235);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(leftX, leftY, summaryX - leftX - 6, 25, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 58, 95);
  doc.text("BANK & PAYMENT DETAILS", leftX + 3, leftY + 5);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(7);
  doc.text(`Bank Name: ${invoice.seller.bankDetails.bankName}`, leftX + 3, leftY + 9.5);
  doc.text(`A/C Holder: ${invoice.seller.bankDetails.accountHolder}`, leftX + 3, leftY + 13.5);
  doc.text(`A/C Number: ${invoice.seller.bankDetails.accountNumber}`, leftX + 3, leftY + 17.5);
  doc.text(`IFSC Code: ${invoice.seller.bankDetails.ifscCode} | Branch: ${invoice.seller.bankDetails.branch}`, leftX + 3, leftY + 21.5);
  if (invoice.seller.upiId) {
    doc.text(`UPI ID: ${invoice.seller.upiId}`, leftX + 3, leftY + 25.5);
  }

  // Footer / Terms & Signature
  const footerY = Math.max(currentY + 6, leftY + 30);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  doc.text("Terms & Conditions:", margin, footerY);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(invoice.termsAndConditions || "Standard trade terms apply. Goods once sold will not be returned.", margin, footerY + 4, {
    maxWidth: pageWidth - margin * 2 - 50,
  });

  // Authorized Signatory
  const signX = pageWidth - margin - 40;
  doc.setTextColor(30, 58, 95);
  doc.setFont("helvetica", "bold");
  doc.text(`For ${invoice.seller.businessName}`, signX, footerY, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("Authorized Signatory", signX, footerY + 14, { align: "center" });

  if (action === "blob") {
    return doc.output("blob");
  } else {
    doc.save(`${invoice.invoiceNumber.replace(/[\/\\]/g, "_")}.pdf`);
  }
}

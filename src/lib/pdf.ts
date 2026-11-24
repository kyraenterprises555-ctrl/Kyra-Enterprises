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
    rate: number; // Basic rate excluding tax
    rateInclusiveTax?: number;
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

export function generateInvoicePdf(invoice: InvoicePdfData, action: "save" | "blob" | "arraybuffer" = "save") {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Title Box
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2);

  // Top Title: Tax Invoice
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("Tax Invoice", pageWidth / 2, margin + 5, { align: "center" });

  doc.line(margin, margin + 7, pageWidth - margin, margin + 7);

  // Top Section: Seller on Left, Invoice Meta on Right
  const midX = pageWidth / 2 + 5;
  const topY = margin + 8;

  // Seller Details (KYRA ENTERPRISES)
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.seller.businessName.toUpperCase(), margin + 3, topY + 4);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.seller.address, margin + 3, topY + 9);
  doc.text(`GSTIN/UIN: ${invoice.seller.gstin}`, margin + 3, topY + 14);
  doc.text(`State Name : ${invoice.seller.state}, Code : ${invoice.seller.stateCode}`, margin + 3, topY + 19);

  // Divider between Seller & Invoice Meta
  doc.line(midX - 5, topY - 1, midX - 5, topY + 45);

  // Invoice Meta
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(`Invoice No.`, midX - 2, topY + 4);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.invoiceNumber, midX + 22, topY + 4);

  doc.setFont("helvetica", "bold");
  doc.text(`Dated`, midX + 50, topY + 4);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(invoice.invoiceDate), midX + 62, topY + 4);

  doc.line(midX - 5, topY + 6.5, pageWidth - margin, topY + 6.5);

  doc.text(`Mode/Terms of Payment: Cash/Current`, midX - 2, topY + 11);
  doc.line(midX - 5, topY + 13.5, pageWidth - margin, topY + 13.5);

  doc.text(`Place of Supply: ${invoice.customer.state} (${invoice.customer.stateCode})`, midX - 2, topY + 18);
  doc.line(midX - 5, topY + 20.5, pageWidth - margin, topY + 20.5);

  doc.text(`Terms of Delivery: Door Delivery / By Hand`, midX - 2, topY + 25);

  // Horizontal line separating top from buyer
  const buyerY = topY + 27;
  doc.line(margin, buyerY, midX - 5, buyerY);

  // Buyer (Bill to) / Consignee (Ship to)
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Buyer (Bill to):", margin + 3, buyerY + 4);
  doc.setFontSize(9);
  doc.text(invoice.customer.businessName || invoice.customer.name, margin + 3, buyerY + 8);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.customer.billingAddress, margin + 3, buyerY + 12);
  doc.text(`GSTIN/UIN : ${invoice.customer.gstin || "Unregistered"}`, margin + 3, buyerY + 16);
  doc.text(`State Name : ${invoice.customer.state}, Code : ${invoice.customer.stateCode}`, margin + 3, buyerY + 20);

  const tableStartY = topY + 47;
  doc.line(margin, tableStartY, pageWidth - margin, tableStartY);

  // Line Items Table matching Sample Bill columns
  const isInter = invoice.isInterState;

  const tableHeaders = [
    "Sl\nNo.",
    "Description of Goods",
    "HSN Code",
    "Quantity",
    "Rate\n(Incl. of Tax)",
    "Rate",
    "per",
    "Amount",
  ];

  const tableBody = invoice.items.map((it, idx) => {
    const rateInclTax = it.rateInclusiveTax || Math.round(it.rate * (1 + it.gstRate / 100) * 100) / 100;
    return [
      String(idx + 1),
      it.productName,
      it.hsnCode || "-",
      `${it.quantity} ${it.uom || "PCS"}`,
      rateInclTax.toFixed(2),
      it.rate.toFixed(2),
      it.uom || "PCS",
      it.taxableAmount.toFixed(2),
    ];
  });

  // Add CGST & SGST or IGST summary rows directly inside or under the table
  if (isInter) {
    tableBody.push(["", "IGST", "", "", "", "", `${invoice.items[0]?.gstRate || 18}%`, invoice.totalIgst.toFixed(2)]);
  } else {
    tableBody.push(["", "CGST", "", "", "", "", "9 %", invoice.totalCgst.toFixed(2)]);
    tableBody.push(["", "SGST", "", "", "", "", "9 %", invoice.totalSgst.toFixed(2)]);
  }

  // Total items quantity
  const totalQty = invoice.items.reduce((acc, it) => acc + it.quantity, 0);
  tableBody.push(["", "Total", "", `${totalQty} PCS`, "", "", "", formatCurrency(invoice.grandTotal).replace("₹", "")]);

  autoTable(doc, {
    startY: tableStartY + 1,
    head: [tableHeaders],
    body: tableBody,
    theme: "plain",
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.2,
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontSize: 7.5,
      fontStyle: "bold",
      halign: "center",
      lineWidth: 0.2,
      lineColor: [0, 0, 0],
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      textColor: [0, 0, 0],
      lineWidth: 0.15,
      lineColor: [200, 200, 200],
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { halign: "left" },
      2: { halign: "center", cellWidth: 22 },
      3: { halign: "center", cellWidth: 20 },
      4: { halign: "right", cellWidth: 24 },
      5: { halign: "right", cellWidth: 20 },
      6: { halign: "center", cellWidth: 14 },
      7: { halign: "right", cellWidth: 26 },
    },
    margin: { left: margin + 0.3, right: margin + 0.3 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY + 3;

  let currentY = finalY;
  if (currentY > pageHeight - 75) {
    doc.addPage();
    currentY = 20;
  }

  // Amount Chargeable in words
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Amount Chargeable (in words):", margin + 3, currentY);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.amountInWords, margin + 3, currentY + 4.5);

  doc.setFont("helvetica", "normal");
  doc.text("E. & O.E", pageWidth - margin - 15, currentY);

  currentY += 9;
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // HSN/SAC Tax Breakdown Table (Exact match to sample invoice!)
  const hsnHeaders = isInter
    ? ["HSN/SAC", "Taxable Value", "IGST Rate", "IGST Amount", "Total Tax Amount"]
    : ["HSN/SAC", "Taxable Value", "CGST Rate", "CGST Amount", "SGST Rate", "SGST Amount", "Total Tax Amount"];

  // Group by HSN
  const hsnMap: { [key: string]: { taxable: number; tax: number; cgst: number; sgst: number; igst: number } } = {};
  for (const it of invoice.items) {
    const h = it.hsnCode || "General";
    if (!hsnMap[h]) {
      hsnMap[h] = { taxable: 0, tax: 0, cgst: 0, sgst: 0, igst: 0 };
    }
    hsnMap[h].taxable += it.taxableAmount;
    hsnMap[h].tax += it.totalTax;
    hsnMap[h].cgst += it.cgstAmount;
    hsnMap[h].sgst += it.sgstAmount;
    hsnMap[h].igst += it.igstAmount;
  }

  const hsnBody = Object.keys(hsnMap).map((h) => {
    const d = hsnMap[h];
    return isInter
      ? [h, d.taxable.toFixed(2), "18%", d.igst.toFixed(2), d.tax.toFixed(2)]
      : [h, d.taxable.toFixed(2), "9%", d.cgst.toFixed(2), "9%", d.sgst.toFixed(2), d.tax.toFixed(2)];
  });

  // Total HSN row
  hsnBody.push(
    isInter
      ? ["Total", invoice.taxableAmount.toFixed(2), "", invoice.totalIgst.toFixed(2), invoice.totalTax.toFixed(2)]
      : ["Total", invoice.taxableAmount.toFixed(2), "", invoice.totalCgst.toFixed(2), "", invoice.totalSgst.toFixed(2), invoice.totalTax.toFixed(2)]
  );

  autoTable(doc, {
    startY: currentY + 1,
    head: [hsnHeaders],
    body: hsnBody,
    theme: "plain",
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.2,
    headStyles: {
      fillColor: [248, 248, 248],
      textColor: [0, 0, 0],
      fontSize: 7,
      fontStyle: "bold",
      halign: "center",
      lineWidth: 0.15,
      lineColor: [0, 0, 0],
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.2,
      textColor: [0, 0, 0],
      lineWidth: 0.1,
      lineColor: [220, 220, 220],
      halign: "right",
    },
    columnStyles: {
      0: { halign: "center" },
    },
    margin: { left: margin + 0.3, right: margin + 0.3 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let footerY = (doc as any).lastAutoTable.finalY + 3;

  // Tax amount in words
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("Tax Amount (in words) :", margin + 3, footerY);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.amountInWords, margin + 3, footerY + 4);

  footerY += 8;
  doc.line(margin, footerY, pageWidth - margin, footerY);

  // Bank Details on Left & Company Signatory on Right
  doc.setFontSize(7.5);
  doc.text(`Bank Name : ${invoice.seller.bankDetails.bankName}`, margin + 3, footerY + 4);
  doc.text(`A/c No. : ${invoice.seller.bankDetails.accountNumber}`, margin + 3, footerY + 8);
  doc.text(`Branch : ${invoice.seller.bankDetails.branch} & IFS Code :- ${invoice.seller.bankDetails.ifscCode}`, margin + 3, footerY + 12);

  // Signatory on Right
  const signX = pageWidth - margin - 45;
  doc.setFont("helvetica", "bold");
  doc.text(`for ${invoice.seller.businessName.toUpperCase()}`, signX, footerY + 4);
  doc.setFont("helvetica", "normal");
  doc.text("Authorised Signatory", signX, footerY + 22);

  footerY += 15;
  doc.line(margin, footerY, signX - 5, footerY);

  // Declaration
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("Declaration", margin + 3, footerY + 3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  const declarationLines = [
    "1. We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
    "2. Payments due within 5 days of Invoice date.",
    "3. In case of a product being defective or having a manufacturing defect, the primary responsibility for repairing or replacing it lies with the company.",
    "4. Burnt and broken will not be warrented, please check while purchasing.",
  ];
  declarationLines.forEach((line, i) => {
    doc.text(line, margin + 3, footerY + 6.5 + i * 3.2, { maxWidth: signX - margin - 8 });
  });

  // Footer note
  doc.setFontSize(7);
  doc.text("This is a Computer Generated Invoice", pageWidth / 2, pageHeight - margin - 2, { align: "center" });

  if (action === "blob") {
    return doc.output("blob");
  } else if (action === "arraybuffer") {
    return doc.output("arraybuffer");
  } else {
    doc.save(`${invoice.invoiceNumber.replace(/[\/\\]/g, "_")}.pdf`);
  }
}

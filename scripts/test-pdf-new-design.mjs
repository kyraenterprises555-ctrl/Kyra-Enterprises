import fs from "fs";
import pkg from "jspdf";
const { jsPDF } = pkg;
import autoTablePkg from "jspdf-autotable";
const autoTable = typeof autoTablePkg === 'function' ? autoTablePkg : autoTablePkg.default;
import QRCode from "qrcode";

async function run() {
  const invoice = {
    invoiceNumber: "26-27/09",
    invoiceDate: new Date(),
    seller: {
      businessName: "KYRA ENTERPRISES",
      address: "BASAITHA MADHUBANI",
      city: "Madhubani",
      state: "Bihar",
      stateCode: "10",
      pincode: "847223",
      phone: "+91 98765 43210",
      email: "kyraenterprises555@gmail.com",
      gstin: "10CPLPK1520H1ZF",
      bankDetails: {
        bankName: "Union Bank of India",
        accountHolder: "KYRA ENTERPRISES",
        accountNumber: "195721010000113",
        ifscCode: "UBIN0919578",
        branch: "BENIPATTI BRANCH",
      },
      upiId: "10cplpk1520h1zf@unionbank",
    },
    customer: {
      name: "DEV ELECTRIC",
      billingAddress: "Main Market, Benipatti, Madhubani, Bihar - 847223",
      phone: "9560010734",
      email: "develectric@gmail.com",
      gstin: "10AABCE1234F1Z5",
      state: "Bihar",
      stateCode: "10",
    },
    items: [
      {
        productName: "Bajaj Notch 500W French Blue M (410651)",
        hsnCode: "8516",
        quantity: 2,
        rate: 1762.5,
        taxableAmount: 3525.0,
      },
      {
        productName: "KTX 1.5 L dlx Kettle (670106)",
        hsnCode: "8516",
        quantity: 1,
        rate: 610.15,
        taxableAmount: 610.15,
      },
      {
        productName: "KTX 1.8 L dlx Kettle (670107)",
        hsnCode: "8516",
        quantity: 1,
        rate: 648.3,
        taxableAmount: 648.3,
      },
      {
        productName: "Bajaj Majesty Canvas Brown (440306)",
        hsnCode: "8516",
        quantity: 1,
        rate: 699.15,
        taxableAmount: 699.15,
      },
      {
        productName: "Bajaj DX 4 Neo Dry Iron (440325)",
        hsnCode: "8516",
        quantity: 1,
        rate: 639.83,
        taxableAmount: 639.83,
      },
    ],
    taxableAmount: 6122.43,
    totalCgst: 551.02,
    totalSgst: 551.02,
    totalIgst: 0,
    grandTotal: 7224.47,
    amountInWords: "Seven Thousand Two Hundred Twenty Four Rupees and Forty Seven Paise Only",
    isInterState: false,
  };

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  const maroon = [139, 30, 30];
  const borderColor = [226, 215, 207];
  const tableHeaderBg = [250, 244, 239];
  const totalBarBg = [248, 236, 232];
  const textDark = [26, 26, 26];
  const textMuted = [85, 85, 85];

  let currentY = margin + 2;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text(invoice.seller.businessName, margin, currentY + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text("Quality Electrical & Home Appliances Wholesale & Retail", margin, currentY + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(invoice.seller.businessName, pageWidth - margin, currentY + 3, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Registered Enterprise, ${invoice.seller.address}, ${invoice.seller.city}, ${invoice.seller.state} - ${invoice.seller.pincode}`, pageWidth - margin, currentY + 6.5, { align: "right" });
  doc.text(`GSTIN: ${invoice.seller.gstin} | Contact: ${invoice.seller.phone}`, pageWidth - margin, currentY + 10, { align: "right" });
  doc.text(`Email: ${invoice.seller.email}`, pageWidth - margin, currentY + 13.5, { align: "right" });

  currentY += 17;

  doc.setDrawColor(maroon[0], maroon[1], maroon[2]);
  doc.setLineWidth(0.6);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text("P R O F O R M A   I N V O I C E", pageWidth / 2, currentY + 2, { align: "center" });

  currentY += 6;

  const colWidth = (contentWidth - 4) / 2;
  const boxHeight = 22;

  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, currentY, colWidth, boxHeight, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text("INVOICE DETAILS", margin + 3, currentY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text("Invoice No:", margin + 3, currentY + 11);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.invoiceNumber, margin + 25, currentY + 11);

  doc.setFont("helvetica", "normal");
  doc.text("Invoice Date:", margin + 3, currentY + 17);
  doc.setFont("helvetica", "bold");
  doc.text("2026-10-31", margin + 25, currentY + 17);

  const rightBoxX = margin + colWidth + 4;
  doc.roundedRect(rightBoxX, currentY, colWidth, boxHeight, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text("REFERENCE & SUPPLY", rightBoxX + 3, currentY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text("Place of Supply:", rightBoxX + 3, currentY + 11);
  doc.setFont("helvetica", "bold");
  doc.text(`${invoice.customer.state} (${invoice.customer.stateCode})`, rightBoxX + 28, currentY + 11);

  doc.setFont("helvetica", "normal");
  doc.text("Client / Order Ref:", rightBoxX + 3, currentY + 17);
  doc.setFont("helvetica", "bold");
  doc.text("Offline / Retail", rightBoxX + 28, currentY + 17);

  currentY += boxHeight + 4;

  const clientBoxHeight = 22;
  doc.roundedRect(margin, currentY, contentWidth, clientBoxHeight, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text("CLIENT DETAILS & BILLING COMPOSITION", margin + 3, currentY + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(invoice.customer.name, margin + 3, currentY + 10.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(invoice.customer.billingAddress, margin + 3, currentY + 15, { maxWidth: colWidth + 20 });
  doc.text(`GSTIN: ${invoice.customer.gstin}`, margin + 3, currentY + 19);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(`Email: ${invoice.customer.email}`, pageWidth - margin - 3, currentY + 10.5, { align: "right" });
  doc.text(`Mobile: ${invoice.customer.phone}`, pageWidth - margin - 3, currentY + 15, { align: "right" });

  currentY += clientBoxHeight + 4;

  const tableRows = invoice.items.map((it) => [
    it.productName,
    it.hsnCode,
    String(it.quantity),
    `Rs. ${it.rate.toFixed(2)}`,
    `Rs. ${it.taxableAmount.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [["PRODUCT DESCRIPTION", "HSN/SAC", "QTY", "RATE (Rs.)", "TOTAL (Rs.)"]],
    body: tableRows,
    theme: "plain",
    headStyles: {
      fillColor: [250, 244, 239],
      textColor: [139, 30, 30],
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "left",
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      lineColor: [226, 215, 207],
      lineWidth: 0.2,
    },
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
      textColor: [30, 30, 30],
      lineColor: [235, 227, 220],
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: "auto", halign: "left", fontStyle: "bold" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 26, halign: "right" },
      4: { cellWidth: 28, halign: "right", fontStyle: "bold" },
    },
  });

  let endY = doc.lastAutoTable.finalY;

  // Subtotal
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text("Subtotal", pageWidth - margin - 45, endY + 4.5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text(`Rs. ${invoice.taxableAmount.toFixed(2)}`, pageWidth - margin - 3, endY + 4.5, { align: "right" });
  endY += 6;

  // Taxes
  doc.setFont("helvetica", "normal");
  doc.text("CGST (9%)", pageWidth - margin - 45, endY + 3.5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text(`+ Rs. ${invoice.totalCgst.toFixed(2)}`, pageWidth - margin - 3, endY + 3.5, { align: "right" });
  endY += 5;

  doc.setFont("helvetica", "normal");
  doc.text("SGST (9%)", pageWidth - margin - 45, endY + 3.5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text(`+ Rs. ${invoice.totalSgst.toFixed(2)}`, pageWidth - margin - 3, endY + 3.5, { align: "right" });
  endY += 5;

  // Total Bar
  const totalBarHeight = 9;
  doc.setFillColor(totalBarBg[0], totalBarBg[1], totalBarBg[2]);
  doc.rect(margin, endY + 2, contentWidth, totalBarHeight, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text("Total Payable Amount", margin + 4, endY + 8);
  doc.text(`Rs. ${invoice.grandTotal.toFixed(2)}`, pageWidth - margin - 4, endY + 8, { align: "right" });

  endY += totalBarHeight + 5;

  // Words note
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(`Net Payable to ${invoice.seller.businessName}: Rs. ${invoice.amountInWords}`, margin + 1, endY + 2);

  endY += 6;

  // Banking (Left) & UPI QR (Right)
  const bHeight = 38;
  const bLeftWidth = contentWidth - 44;
  const qrBoxWidth = 40;

  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, endY, bLeftWidth, bHeight, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text("BANKING & PAYMENT SETTLEMENT", margin + 3, endY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);

  doc.text("In Favour of:", margin + 3, endY + 11);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.seller.bankDetails.accountHolder, margin + 34, endY + 11);

  doc.setFont("helvetica", "normal");
  doc.text("Bank Name:", margin + 3, endY + 16);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.seller.bankDetails.bankName, margin + 34, endY + 16);

  doc.setFont("helvetica", "normal");
  doc.text("Current / Settlement A/C:", margin + 3, endY + 21);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.seller.bankDetails.accountNumber, margin + 34, endY + 21);

  doc.setFont("helvetica", "normal");
  doc.text("IFSC Code:", margin + 3, endY + 26);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.seller.bankDetails.ifscCode, margin + 34, endY + 26);

  doc.setFont("helvetica", "normal");
  doc.text("UPI ID:", margin + 3, endY + 31);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.seller.upiId, margin + 34, endY + 31);

  doc.setFont("helvetica", "normal");
  doc.text("Branch:", margin + 3, endY + 35.5);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.seller.bankDetails.branch, margin + 34, endY + 35.5);

  // QR box
  const qrX = margin + bLeftWidth + 4;
  doc.roundedRect(qrX, endY, qrBoxWidth, bHeight, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text("PAY VIA UPI", qrX + qrBoxWidth / 2, endY + 4.5, { align: "center" });

  const qrDataUrl = await QRCode.toDataURL(
    `upi://pay?pa=${encodeURIComponent(invoice.seller.upiId)}&pn=${encodeURIComponent(invoice.seller.businessName)}&am=${invoice.grandTotal.toFixed(2)}&cu=INR`,
    { margin: 1, width: 200 }
  );
  doc.addImage(qrDataUrl, "PNG", qrX + 7.5, endY + 6, 25, 25);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text("SCAN & PAY WITH ANY UPI APP", qrX + qrBoxWidth / 2, endY + 33, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("G Pay • PhonePe • Paytm • BHIM", qrX + qrBoxWidth / 2, endY + 36, { align: "center" });

  endY += bHeight + 4;

  // Policies
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text("POLICIES & DISPATCH TERMS", margin, endY + 3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  const termsList = [
    "• 100% Genuine Certified Goods sourced directly with authentic manufacturer warranty.",
    "• Payments due within 5 days of Invoice date. Interest @18% p.a. charged on overdue bills.",
    "• Primary responsibility for replacement or repair lies under manufacturer warranty terms.",
    "• Goods once sold will not be taken back or exchanged without prior authorization.",
    "• Subject exclusively to the legal jurisdiction of Madhubani / Patna, Bihar courts.",
  ];
  termsList.forEach((line, i) => {
    doc.text(line, margin, endY + 6.5 + i * 3);
  });

  endY += 23;

  doc.setDrawColor(maroon[0], maroon[1], maroon[2]);
  doc.setLineWidth(0.4);
  doc.line(margin, endY, pageWidth - margin, endY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(maroon[0], maroon[1], maroon[2]);
  doc.text("THANK YOU FOR YOUR VALUED BUSINESS", pageWidth / 2, endY + 3.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    `${invoice.seller.businessName} | ${invoice.seller.address}, ${invoice.seller.city}, ${invoice.seller.state} | ${invoice.seller.email}`,
    pageWidth / 2,
    endY + 6.5,
    { align: "center" }
  );

  const buf = Buffer.from(doc.output("arraybuffer"));
  fs.writeFileSync(".data/test_output.pdf", buf);
  console.log("PDF created successfully! Size:", buf.length);
}

run().catch(console.error);

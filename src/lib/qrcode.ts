import QRCode from "qrcode";

export async function generateUpiQrDataUrl(params: {
  upiId: string;
  payeeName: string;
  amount?: number;
  note?: string;
  transactionRef?: string;
}): Promise<string> {
  try {
    const { upiId, payeeName, amount, note, transactionRef } = params;
    let upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}`;
    if (amount && amount > 0) {
      upiString += `&am=${amount.toFixed(2)}&cu=INR`;
    }
    if (note) {
      upiString += `&tn=${encodeURIComponent(note.slice(0, 40))}`;
    }
    if (transactionRef) {
      upiString += `&tr=${encodeURIComponent(transactionRef)}`;
    }

    return await QRCode.toDataURL(upiString, {
      margin: 1,
      width: 250,
      color: {
        dark: "#1A1A1A",
        light: "#FFFFFF",
      },
    });
  } catch (err) {
    console.error("Failed to generate UPI QR code:", err);
    return "";
  }
}

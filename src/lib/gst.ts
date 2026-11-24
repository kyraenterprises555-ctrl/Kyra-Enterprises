export interface IndianState {
  code: string;
  name: string;
}

export const INDIAN_STATES: IndianState[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "28", name: "Andhra Pradesh (Old)" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
  { code: "97", name: "Other Territory" },
];

export function getStateByCode(code: string): IndianState | undefined {
  return INDIAN_STATES.find((s) => s.code === code);
}

export function getStateByName(name: string): IndianState | undefined {
  if (!name) return undefined;
  const normalized = name.trim().toLowerCase();
  return INDIAN_STATES.find((s) => s.name.toLowerCase() === normalized);
}

export function extractStateCodeFromGstin(gstin: string): string | null {
  if (!gstin || gstin.trim().length < 2) return null;
  const code = gstin.trim().substring(0, 2);
  return INDIAN_STATES.some((s) => s.code === code) ? code : null;
}

export interface TaxCalculationItem {
  rate: number; // selling price per unit
  quantity: number;
  discount: number; // lump sum discount or 0
  discountPercent?: number;
  gstRate: number; // e.g. 18 for 18%
}

export interface CalculatedLineItem {
  grossAmount: number;
  discountAmount: number;
  taxableAmount: number;
  gstRate: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  totalAmount: number;
}

export interface InvoiceTaxSummary {
  taxableAmount: number;
  totalDiscount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  isInterState: boolean;
}

export function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function calculateLineItemTaxes(
  item: TaxCalculationItem,
  isInterState: boolean
): CalculatedLineItem {
  const grossAmount = roundToTwo(item.rate * item.quantity);
  
  let discountAmount = 0;
  if (item.discountPercent && item.discountPercent > 0) {
    discountAmount = roundToTwo((grossAmount * item.discountPercent) / 100);
  } else if (item.discount && item.discount > 0) {
    discountAmount = roundToTwo(Math.min(item.discount, grossAmount));
  }

  const taxableAmount = roundToTwo(Math.max(0, grossAmount - discountAmount));
  const gstRate = item.gstRate || 0;

  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;

  if (gstRate > 0) {
    if (isInterState) {
      igstRate = gstRate;
      igstAmount = roundToTwo((taxableAmount * igstRate) / 100);
    } else {
      cgstRate = gstRate / 2;
      sgstRate = gstRate / 2;
      cgstAmount = roundToTwo((taxableAmount * cgstRate) / 100);
      sgstAmount = roundToTwo((taxableAmount * sgstRate) / 100);
    }
  }

  const totalTax = roundToTwo(cgstAmount + sgstAmount + igstAmount);
  const totalAmount = roundToTwo(taxableAmount + totalTax);

  return {
    grossAmount,
    discountAmount,
    taxableAmount,
    gstRate,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    totalTax,
    totalAmount,
  };
}

export function calculateInvoiceTaxes(
  items: Array<{
    rate: number;
    quantity: number;
    discount?: number;
    discountPercent?: number;
    gstRate: number;
  }>,
  sellerStateCode: string,
  customerStateCode: string
): { items: CalculatedLineItem[]; summary: InvoiceTaxSummary } {
  // If sellerStateCode matches customerStateCode -> Intra-state (CGST + SGST)
  // Else -> Inter-state (IGST)
  const isInterState = sellerStateCode.trim() !== customerStateCode.trim();

  let taxableAmount = 0;
  let totalDiscount = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const calculatedItems = items.map((item) => {
    const calc = calculateLineItemTaxes(
      {
        rate: item.rate,
        quantity: item.quantity,
        discount: item.discount || 0,
        discountPercent: item.discountPercent || 0,
        gstRate: item.gstRate,
      },
      isInterState
    );

    taxableAmount += calc.taxableAmount;
    totalDiscount += calc.discountAmount;
    totalCgst += calc.cgstAmount;
    totalSgst += calc.sgstAmount;
    totalIgst += calc.igstAmount;

    return calc;
  });

  taxableAmount = roundToTwo(taxableAmount);
  totalDiscount = roundToTwo(totalDiscount);
  totalCgst = roundToTwo(totalCgst);
  totalSgst = roundToTwo(totalSgst);
  totalIgst = roundToTwo(totalIgst);
  const totalTax = roundToTwo(totalCgst + totalSgst + totalIgst);
  
  const rawGrandTotal = taxableAmount + totalTax;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = roundToTwo(roundedGrandTotal - rawGrandTotal);

  return {
    items: calculatedItems,
    summary: {
      taxableAmount,
      totalDiscount,
      totalCgst,
      totalSgst,
      totalIgst,
      totalTax,
      roundOff,
      grandTotal: roundedGrandTotal,
      isInterState,
    },
  };
}

const singleDigits = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
];
const teens = [
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const tens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function convertBelowThousand(n: number): string {
  let str = "";
  if (n >= 100) {
    str += singleDigits[Math.floor(n / 100)] + " Hundred ";
    n %= 100;
  }
  if (n >= 20) {
    str += tens[Math.floor(n / 10)] + " ";
    n %= 10;
  } else if (n >= 10) {
    str += teens[n - 10] + " ";
    return str.trim();
  }
  if (n > 0) {
    str += singleDigits[n] + " ";
  }
  return str.trim();
}

export function numberToWordsINR(amount: number): string {
  if (amount === 0) return "Zero Rupees Only";
  if (isNaN(amount)) return "";

  const absAmount = Math.abs(amount);
  const rupees = Math.floor(absAmount);
  const paise = Math.round((absAmount - rupees) * 100);

  let result = "";

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const remaining = rupees % 1000;

  if (crore > 0) {
    result += convertBelowThousand(crore) + " Crore ";
  }
  if (lakh > 0) {
    result += convertBelowThousand(lakh) + " Lakh ";
  }
  if (thousand > 0) {
    result += convertBelowThousand(thousand) + " Thousand ";
  }
  if (remaining > 0) {
    result += convertBelowThousand(remaining) + " ";
  }

  result = result.trim() + " Rupees";

  if (paise > 0) {
    result += " and " + convertBelowThousand(paise) + " Paise";
  }

  return (result + " Only").replace(/\s+/g, " ");
}

import { NextResponse } from "next/server";
import { DataService } from "@/lib/db-store";
import { generateInvoicePdf } from "@/lib/pdf";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await DataService.getInvoiceById(id);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const buffer = (await generateInvoicePdf(invoice as any, "arraybuffer")) as ArrayBuffer;

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber.replace(/[\/\\]/g, "_")}.pdf"`,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to generate PDF";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

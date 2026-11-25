import { NextResponse } from "next/server";
import { generateBulkTemplateCsv, generateBulkTemplateExcel } from "@/lib/bulk-import";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "xlsx").toLowerCase();

    if (format === "csv") {
      const csv = generateBulkTemplateCsv();
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="Kyra_Enterprises_Product_Template.csv"',
        },
      });
    }

    const xlsxBuf = await generateBulkTemplateExcel();
    return new NextResponse(new Uint8Array(xlsxBuf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="Kyra_Enterprises_Product_Template.xlsx"',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

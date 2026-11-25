"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Trash2,
  ArrowRight,
  RefreshCw,
  Columns,
  Database,
  History,
  FileDown,
} from "lucide-react";
import type { BulkColumnMapping, ValidatedBulkRow } from "@/lib/bulk-import";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const MAPPING_FIELDS: Array<{ key: keyof BulkColumnMapping; label: string; required?: boolean }> = [
  { key: "productName", label: "Product Name", required: true },
  { key: "sku", label: "SKU", required: true },
  { key: "category", label: "Category" },
  { key: "description", label: "Description" },
  { key: "purchasePrice", label: "Purchase Price", required: true },
  { key: "sellingPrice", label: "Selling Price", required: true },
  { key: "quantity", label: "Quantity", required: true },
  { key: "unit", label: "Unit" },
  { key: "hsnCode", label: "HSN Code", required: true },
  { key: "gstPercentage", label: "GST Percentage", required: true },
  { key: "minStockLevel", label: "Minimum Stock Level" },
];

export default function BulkProductUploadPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  // Parsed state
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState<"xlsx" | "xls" | "csv">("xlsx");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRecords, setRawRecords] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<BulkColumnMapping>({
    productName: "",
    sku: "",
    category: "",
    description: "",
    purchasePrice: "",
    sellingPrice: "",
    quantity: "",
    unit: "",
    hsnCode: "",
    gstPercentage: "",
    minStockLevel: "",
  });
  const [showColumnMapper, setShowColumnMapper] = useState(false);

  // Preview rows & validation
  const [rows, setRows] = useState<ValidatedBulkRow[]>([]);
  const [rowFilter, setRowFilter] = useState<"all" | "valid" | "invalid" | "existing">("all");

  // Duplicate options
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "update" | "new_only">("skip");
  const [updateStock, setUpdateStock] = useState(false);

  // Import completion report & history
  const [importReport, setImportReport] = useState<any>(null);
  const [importHistory, setImportHistory] = useState<any[]>([]);

  const fetchImportHistory = async () => {
    try {
      const res = await fetch("/api/products/bulk-import");
      const data = await res.json();
      if (data.success) setImportHistory(data.jobs || []);
    } catch {}
  };

  useEffect(() => {
    fetchImportHistory();
  }, []);

  const handleFileSelected = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["xlsx", "xls", "csv"].includes(ext)) {
      toast.error("Please select a valid Excel (.xlsx, .xls) or CSV (.csv) file");
      return;
    }

    try {
      setParsing(true);
      setImportReport(null);
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/products/bulk-parse", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse uploaded file");

      setFileName(data.fileName);
      setFileType(data.fileType);
      setHeaders(data.headers || []);
      setRawRecords(data.rawRecords || []);
      setMapping(data.mapping);
      setRows(data.rows || []);

      // Auto-expand column mapper if any required field wasn't auto-matched
      const missingCoreMapping =
        !data.mapping.productName ||
        !data.mapping.sku ||
        !data.mapping.sellingPrice ||
        !data.mapping.hsnCode ||
        !data.mapping.gstPercentage;
      setShowColumnMapper(missingCoreMapping);

      toast.success(`Extracted ${data.rows?.length || 0} product rows from "${file.name}"`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error reading spreadsheet");
    } finally {
      setParsing(false);
    }
  };

  const handleApplyColumnMapping = async () => {
    try {
      setParsing(true);
      const res = await fetch("/api/products/bulk-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawRecords, mapping }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remap columns");
      setRows(data.rows || []);
      toast.success("Columns remapped and validated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Remap failed");
    } finally {
      setParsing(false);
    }
  };

  const revalidateEditedRows = async (updatedRows: ValidatedBulkRow[]) => {
    try {
      const res = await fetch("/api/products/bulk-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: updatedRows }),
      });
      const data = await res.json();
      if (data.success) setRows(data.rows);
    } catch {}
  };

  const handleCellChange = (
    rowIndexInFullList: number,
    field: keyof ValidatedBulkRow,
    value: string
  ) => {
    const next = rows.slice();
    next[rowIndexInFullList] = {
      ...next[rowIndexInFullList],
      [field]: field === "sku" || field === "unit" ? value.toUpperCase() : value,
    };
    setRows(next);
  };

  const handleRemoveRow = (rowNumber: number) => {
    const filtered = rows.filter((r) => r.rowNumber !== rowNumber);
    setRows(filtered);
    revalidateEditedRows(filtered);
  };

  const handleRemoveAllInvalid = () => {
    const onlyValid = rows.filter((r) => r.isValid);
    setRows(onlyValid);
    toast.success("Removed all invalid rows from preview");
  };

  const handleExecuteImport = async () => {
    if (rows.length === 0) {
      toast.error("No rows to import");
      return;
    }
    const validCount = rows.filter((r) => r.isValid).length;
    if (validCount === 0) {
      toast.error("There are 0 valid rows. Please fix validation errors before importing.");
      return;
    }

    try {
      setImporting(true);
      const res = await fetch("/api/products/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          fileType,
          rows,
          duplicateStrategy,
          updateStock: duplicateStrategy === "update" ? updateStock : false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulk import failed");

      setImportReport(data.report);
      fetchImportHistory();
      toast.success(
        `Bulk import completed! ${data.report.importedCount} created, ${data.report.updatedCount} updated.`
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error during bulk import");
    } finally {
      setImporting(false);
    }
  };

  const downloadErrorReportCsv = (reportObj: any) => {
    const errs = reportObj?.validationErrors || [];
    if (errs.length === 0) {
      toast.info("No validation errors to export");
      return;
    }
    const csvLines = [
      "Row Number,SKU,Product Name,Validation Errors",
      ...errs.map(
        (e: any) =>
          `${e.rowNumber},"${String(e.sku || "").replace(/"/g, '""')}","${String(
            e.productName || ""
          ).replace(/"/g, '""')}","${(e.errors || []).join("; ").replace(/"/g, '""')}"`
      ),
    ];
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Kyra_Import_Errors_${reportObj.jobNumber || Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = rows.filter((r) => r.isValid).length;
  const invalidCount = rows.filter((r) => !r.isValid).length;
  const existingCount = rows.filter((r) => r.existsInDb).length;

  const displayedRows = rows.filter((r) => {
    if (rowFilter === "valid") return r.isValid;
    if (rowFilter === "invalid") return !r.isValid;
    if (rowFilter === "existing") return r.existsInDb;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <span>Bulk Product Upload &mdash; Excel &amp; CSV</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Upload .xlsx, .xls, or .csv catalogs, map columns, edit &amp; validate records, and batch import safely into MongoDB
          </p>
        </div>

        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold"
        >
          <span>View Product Catalog</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Step 1 & Step 2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Step 1: Download Sample Template */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider mb-2">
              Step 1 &bull; Standard Template
            </span>
            <h2 className="text-sm font-bold text-slate-900">Download Sample Template</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Pre-formatted with all 11 standard columns: Product Name, SKU, Category, Description, Purchase Price, Selling Price, Quantity, Unit, HSN Code, GST %, and Min Stock Level.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <a
              href="/api/products/bulk-template?format=xlsx"
              download
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#0e1e32] hover:bg-[#142a45] text-white text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Excel (.xlsx)</span>
            </a>
            <a
              href="/api/products/bulk-template?format=csv"
              download
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV (.csv)</span>
            </a>
          </div>
        </div>

        {/* Step 2: Drag & Drop File Upload */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) handleFileSelected(dropped);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`lg:col-span-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center text-center ${
            dragActive
              ? "border-emerald-500 bg-emerald-50/50"
              : "border-slate-300 bg-white hover:border-emerald-500 hover:bg-slate-50/60"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelected(f);
              e.target.value = "";
            }}
            className="hidden"
          />
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-3">
            {parsing ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : (
              <UploadCloud className="w-6 h-6" />
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
            Step 2 &bull; Upload Spreadsheet
          </span>
          <div className="text-sm font-bold text-slate-900">
            {parsing
              ? "Reading & validating spreadsheet..."
              : fileName
              ? `Loaded: ${fileName} (${rows.length} rows)`
              : "Drag & drop your Excel (.xlsx / .xls) or CSV (.csv) file here"}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            or click to browse local files &bull; Custom column headers are automatically detected &amp; mappable
          </p>
        </div>
      </div>

      {/* Step 3: Column Mapping Panel (when a file is loaded) */}
      {headers.length > 0 && (
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Columns className="w-4 h-4 text-emerald-600" />
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Step 3 &bull; Column Mapping ({headers.length} columns detected)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Map spreadsheet columns when headers differ from the standard template
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowColumnMapper(!showColumnMapper)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {showColumnMapper ? "Hide Column Mapper" : "Customize Column Mapping"}
            </button>
          </div>

          {showColumnMapper && (
            <div className="pt-3 border-t border-slate-100 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                {MAPPING_FIELDS.map((field) => (
                  <div key={field.key}>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      value={mapping[field.key] || ""}
                      onChange={(e) =>
                        setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Unmapped / Default --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleApplyColumnMapping}
                  className="px-4 py-2 rounded-lg bg-[#0e1e32] hover:bg-[#142a45] text-white text-xs font-semibold"
                >
                  Apply Column Mapping &amp; Re-Validate
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 7: Import Completion Summary Banner (shown after import) */}
      {importReport && (
        <div className="bg-emerald-950 text-white p-6 rounded-2xl border border-emerald-800 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-bold">
                  Step 7 &bull; Import Report ({importReport.jobNumber})
                </h2>
                <p className="text-xs text-emerald-200">
                  Completed batch processing for {importReport.fileName}
                </p>
              </div>
            </div>

            {importReport.validationErrors?.length > 0 && (
              <button
                onClick={() => downloadErrorReportCsv(importReport)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
              >
                <FileDown className="w-4 h-4" />
                <span>Download Error Report ({importReport.validationErrors.length})</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white/10">
              <div className="text-emerald-200">Total Rows</div>
              <div className="text-xl font-bold font-mono mt-0.5">{importReport.totalRows}</div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30">
              <div className="text-emerald-200">Successfully Imported</div>
              <div className="text-xl font-bold font-mono mt-0.5 text-emerald-300">
                {importReport.importedCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-sky-500/20 border border-sky-400/30">
              <div className="text-sky-200">Updated Products</div>
              <div className="text-xl font-bold font-mono mt-0.5 text-sky-300">
                {importReport.updatedCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-400/30">
              <div className="text-amber-200">Skipped Products</div>
              <div className="text-xl font-bold font-mono mt-0.5 text-amber-300">
                {importReport.skippedCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-400/30">
              <div className="text-red-200">Failed / Invalid Rows</div>
              <div className="text-xl font-bold font-mono mt-0.5 text-red-300">
                {importReport.failedCount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4, 5 & 6: Interactive Preview Table + Validation + Duplicate Config */}
      {rows.length > 0 && (
        <div className="space-y-5">
          {/* Step 6 Configuration Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Step 6 &bull; Duplicate SKU Strategy &amp; MongoDB Batch Import
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <label
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  duplicateStrategy === "skip"
                    ? "border-emerald-500 bg-emerald-50/40"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <input
                    type="radio"
                    name="dupMode"
                    checked={duplicateStrategy === "skip"}
                    onChange={() => setDuplicateStrategy("skip")}
                    className="accent-emerald-600"
                  />
                  <span>Skip Existing Products</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Recommended default. Existing SKUs remain untouched; new SKUs are created.
                </p>
              </label>

              <label
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  duplicateStrategy === "update"
                    ? "border-emerald-500 bg-emerald-50/40"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <input
                    type="radio"
                    name="dupMode"
                    checked={duplicateStrategy === "update"}
                    onChange={() => setDuplicateStrategy("update")}
                    className="accent-emerald-600"
                  />
                  <span>Update Existing Products by SKU</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Updates prices, GST %, HSN &amp; details for matching SKUs. Stock is protected unless checked below.
                </p>
              </label>

              <label
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  duplicateStrategy === "new_only"
                    ? "border-emerald-500 bg-emerald-50/40"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <input
                    type="radio"
                    name="dupMode"
                    checked={duplicateStrategy === "new_only"}
                    onChange={() => setDuplicateStrategy("new_only")}
                    className="accent-emerald-600"
                  />
                  <span>Import Only New Products</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Strictly inserts brand-new SKUs and ignores all catalog SKUs already in MongoDB.
                </p>
              </label>
            </div>

            {duplicateStrategy === "update" && (
              <label className="flex items-center gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateStock}
                  onChange={(e) => setUpdateStock(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span>
                  <strong>Explicitly update stock quantities for existing SKUs</strong> (Every stock change will be logged in <code className="font-mono">StockMovements</code>; leave unchecked to preserve current warehouse stock).
                </span>
              </label>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  {validCount} Valid Rows Ready
                </span>
                <span className="px-2.5 py-1 rounded-md bg-red-50 text-red-700 font-bold border border-red-200">
                  {invalidCount} Invalid Rows (Will Not Be Saved)
                </span>
                <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  {existingCount} Existing DB SKUs
                </span>
              </div>

              <div className="flex items-center gap-2">
                {invalidCount > 0 && (
                  <button
                    type="button"
                    onClick={handleRemoveAllInvalid}
                    className="px-3.5 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold"
                  >
                    Remove Invalid Rows ({invalidCount})
                  </button>
                )}
                <button
                  type="button"
                  disabled={importing || validCount === 0}
                  onClick={handleExecuteImport}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  <Database className="w-4 h-4" />
                  <span>
                    {importing
                      ? "Importing Batch to MongoDB..."
                      : `Confirm & Import ${validCount} Valid Products`}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Step 4 & 5 Preview & Inline Editor Table */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Steps 4 &amp; 5 &bull; Interactive Data Preview &amp; Row Validation
                </h2>
                <p className="text-[11px] text-slate-500">
                  Click any cell to edit values directly; click Re-Validate after editing to refresh error badges
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={rowFilter}
                  onChange={(e) => setRowFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                >
                  <option value="all">All Rows ({rows.length})</option>
                  <option value="valid">Valid Only ({validCount})</option>
                  <option value="invalid">Errors Only ({invalidCount})</option>
                  <option value="existing">Existing SKUs ({existingCount})</option>
                </select>
                <button
                  type="button"
                  onClick={() => revalidateEditedRows(rows)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0e1e32] text-white text-xs font-semibold"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-Validate Edits</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Validation</th>
                    <th className="py-2.5 px-3 min-w-[190px]">Product Name *</th>
                    <th className="py-2.5 px-3 min-w-[130px]">SKU *</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Category</th>
                    <th className="py-2.5 px-3 min-w-[95px]">Purchase ₹</th>
                    <th className="py-2.5 px-3 min-w-[95px]">Selling ₹ *</th>
                    <th className="py-2.5 px-3 min-w-[75px]">Qty</th>
                    <th className="py-2.5 px-3 min-w-[70px]">Unit</th>
                    <th className="py-2.5 px-3 min-w-[95px]">HSN *</th>
                    <th className="py-2.5 px-3 min-w-[75px]">GST % *</th>
                    <th className="py-2.5 px-3 min-w-[75px]">Min Stock</th>
                    <th className="py-2.5 px-3 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedRows.map((row) => {
                    const realIdx = rows.findIndex((r) => r.rowNumber === row.rowNumber);
                    return (
                      <tr
                        key={row.rowNumber}
                        className={!row.isValid ? "bg-red-50/50" : "hover:bg-slate-50/70"}
                      >
                        <td className="py-2 px-3 font-mono text-slate-500">{row.rowNumber}</td>
                        <td className="py-2 px-3 min-w-[180px]">
                          {row.isValid ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Valid</span>
                              </span>
                              {row.existsInDb && (
                                <span className="text-[10px] text-blue-600 font-semibold">
                                  Exists in DB ({duplicateStrategy})
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              {row.errors.map((err, i) => (
                                <div
                                  key={i}
                                  className="flex items-start gap-1 text-[10px] text-red-700 font-semibold"
                                >
                                  <XCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                  <span>{err}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={row.productName}
                            onChange={(e) =>
                              handleCellChange(realIdx, "productName", e.target.value)
                            }
                            onBlur={() => revalidateEditedRows(rows)}
                            className="w-full px-2 py-1 rounded border border-slate-200 bg-white text-xs"
                          />
                        </td>

                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={row.sku}
                            onChange={(e) => handleCellChange(realIdx, "sku", e.target.value)}
                            onBlur={() => revalidateEditedRows(rows)}
                            className="w-full px-2 py-1 rounded border border-slate-200 bg-white font-mono text-xs uppercase"
                          />
                        </td>

                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={row.category}
                            onChange={(e) => handleCellChange(realIdx, "category", e.target.value)}
                            className="w-full px-2 py-1 rounded border border-slate-200 bg-white text-xs"
                          />
                        </td>

                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            value={row.purchasePrice}
                            onChange={(e) =>
                              handleCellChange(realIdx, "purchasePrice", e.target.value)
                            }
                            onBlur={() => revalidateEditedRows(rows)}
                            className="w-full px-2 py-1 rounded border border-slate-200 bg-white font-mono text-xs"
                          />
                        </td>

                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            value={row.sellingPrice}
                            onChange={(e) =>
                              handleCellChange(realIdx, "sellingPrice", e.target.value)
                            }
                            onBlur={() => revalidateEditedRows(rows)}
                            className="w-full px-2 py-1 rounded border border-slate-200 bg-white font-mono text-xs"
                          />
                        </td>

                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            value={row.quantity}
                            onChange={(e) => handleCellChange(realIdx, "quantity", e.target.value)}
                            onBlur={() => revalidateEditedRows(rows)}
                            className="w-full px-2 py-1 rounded border border-slate-200 bg-white font-mono text-xs"
                          />
                        </td>

                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => handleCellChange(realIdx, "unit", e.target.value)}
                            className="w-full px-2 py-1 rounded border border-slate-200 bg-white font-mono text-xs uppercase"
                          />
                        </td>

                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={row.hsnCode}
                            onChange={(e) => handleCellChange(realIdx, "hsnCode", e.target.value)}
                            onBlur={() => revalidateEditedRows(rows)}
                            className="w-full px-2 py-1 rounded border border-slate-200 bg-white font-mono text-xs"
                          />
                        </td>

                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            value={row.gstPercentage}
                            onChange={(e) =>
                              handleCellChange(realIdx, "gstPercentage", e.target.value)
                            }
                            onBlur={() => revalidateEditedRows(rows)}
                            className="w-full px-2 py-1 rounded border border-slate-200 bg-white font-mono text-xs"
                          />
                        </td>

                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            value={row.minStockLevel}
                            onChange={(e) =>
                              handleCellChange(realIdx, "minStockLevel", e.target.value)
                            }
                            className="w-full px-2 py-1 rounded border border-slate-200 bg-white font-mono text-xs"
                          />
                        </td>

                        <td className="py-1.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.rowNumber)}
                            className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Historical Import Jobs Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Recent Bulk Import Jobs</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Job #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">File Name</th>
                <th className="py-3 px-4 text-center">Duplicate Rule</th>
                <th className="py-3 px-4 text-center">Imported</th>
                <th className="py-3 px-4 text-center">Updated</th>
                <th className="py-3 px-4 text-center">Skipped</th>
                <th className="py-3 px-4 text-center">Failed</th>
                <th className="py-3 px-4 text-right">Errors CSV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {importHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No bulk import jobs recorded yet
                  </td>
                </tr>
              ) : (
                importHistory.map((job) => (
                  <tr key={job._id || job.jobNumber} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                      {job.jobNumber}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">
                      {formatDateTime(job.completedAt || job.createdAt)}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">{job.fileName}</td>
                    <td className="py-2.5 px-4 text-center uppercase text-[10px] font-bold text-slate-600">
                      {job.duplicateStrategy}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono font-bold text-emerald-600">
                      {job.importedCount}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono font-bold text-blue-600">
                      {job.updatedCount}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono text-amber-600">
                      {job.skippedCount}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono text-red-600">
                      {job.failedCount}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {job.validationErrors?.length > 0 ? (
                        <button
                          onClick={() => downloadErrorReportCsv(job)}
                          className="text-red-600 hover:underline font-semibold text-[11px]"
                        >
                          Download ({job.validationErrors.length})
                        </button>
                      ) : (
                        <span className="text-slate-400">&mdash;</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

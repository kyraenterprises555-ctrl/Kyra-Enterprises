import mongoose, { Schema, Document, Model } from "mongoose";

export interface IImportValidationError {
  rowNumber: number;
  sku?: string;
  productName?: string;
  errors: string[];
}

export interface IImportJob extends Document {
  jobNumber: string;
  fileName: string;
  fileType: "xlsx" | "xls" | "csv";
  duplicateStrategy: "skip" | "update" | "new_only";
  updateStock: boolean;
  totalRows: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  validationErrors: IImportValidationError[];
  status: "processing" | "completed" | "failed";
  performedBy: {
    userId?: string;
    userName?: string;
  };
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ImportJobSchema = new Schema<IImportJob>(
  {
    jobNumber: { type: String, required: true, unique: true, index: true },
    fileName: { type: String, required: true },
    fileType: { type: String, enum: ["xlsx", "xls", "csv"], required: true },
    duplicateStrategy: {
      type: String,
      enum: ["skip", "update", "new_only"],
      default: "skip",
    },
    updateStock: { type: Boolean, default: false },
    totalRows: { type: Number, required: true, default: 0 },
    importedCount: { type: Number, default: 0 },
    updatedCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    validationErrors: [
      {
        rowNumber: { type: Number, required: true },
        sku: { type: String },
        productName: { type: String },
        errors: [{ type: String }],
      },
    ],
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "completed",
    },
    performedBy: {
      userId: { type: String },
      userName: { type: String, default: "Admin" },
    },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

export const ImportJob: Model<IImportJob> =
  mongoose.models.ImportJob || mongoose.model<IImportJob>("ImportJob", ImportJobSchema);

export default ImportJob;

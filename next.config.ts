import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["mongoose", "nodemailer", "exceljs", "bcryptjs"],
};

export default nextConfig;

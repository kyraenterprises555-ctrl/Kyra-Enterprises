"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Lock, Mail, ArrowRight, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid work email address"),
  password: z.string().min(4, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid credentials");
      }

      toast.success(`Welcome back, ${data.user.name}!`);
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setServerError(msg);
      toast.error(msg);
    }
  };

  const selectRoleDemo = (userEmail: string, userPass: string) => {
    setValue("email", userEmail, { shouldValidate: true });
    setValue("password", userPass, { shouldValidate: true });
    setServerError("");
  };

  return (
    <div className="min-h-screen bg-[#091422] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden bg-[#0e1e32] border border-slate-700 shadow-lg shadow-emerald-500/10 mb-4">
            <img
              src="/logo.jpeg"
              alt="Kyra Enterprises"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Kyra Enterprises</h1>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise Billing, Inventory &amp; Payment Management System
          </p>
        </div>

        <div className="bg-[#0e1e32]/95 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">Sign In to Workspace</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Authorized access for Kyra Enterprises staff &amp; management
            </p>
          </div>

          {serverError && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  {...register("email")}
                  placeholder="admin@kyra.com"
                  className="w-full bg-[#091422] border border-slate-700 rounded-lg pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
              {errors.email && (
                <p className="text-[11px] text-red-400 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  placeholder="••••••••••••"
                  className="w-full bg-[#091422] border border-slate-700 rounded-lg pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] text-red-400 mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md shadow-emerald-600/20"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Kyra Enterprises</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 mb-2.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Authorized Role Quick-Fill:</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => selectRoleDemo("admin@kyra.com", "Admin@123")}
                className="px-2.5 py-2 rounded-lg bg-[#091422] hover:bg-slate-800 text-[11px] text-slate-200 border border-slate-700/80 text-center transition-colors hover:border-emerald-500"
              >
                <div className="font-semibold text-emerald-400">Admin / Owner</div>
                <div className="text-[10px] text-slate-400">Full Control</div>
              </button>
              <button
                type="button"
                onClick={() => selectRoleDemo("manager@kyra.com", "Manager@123")}
                className="px-2.5 py-2 rounded-lg bg-[#091422] hover:bg-slate-800 text-[11px] text-slate-200 border border-slate-700/80 text-center transition-colors hover:border-emerald-500"
              >
                <div className="font-semibold text-sky-400">Manager</div>
                <div className="text-[10px] text-slate-400">Stock &amp; Reports</div>
              </button>
              <button
                type="button"
                onClick={() => selectRoleDemo("staff@kyra.com", "Staff@123")}
                className="px-2.5 py-2 rounded-lg bg-[#091422] hover:bg-slate-800 text-[11px] text-slate-200 border border-slate-700/80 text-center transition-colors hover:border-emerald-500"
              >
                <div className="font-semibold text-amber-400">Billing Staff</div>
                <div className="text-[10px] text-slate-400">GST Counter</div>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-500">
          <p>&copy; 2026 Kyra Enterprises &bull; GST Invoicing &amp; Inventory Compliant</p>
        </div>
      </div>
    </div>
  );
}

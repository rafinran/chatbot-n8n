"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/api";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { setError("Token tidak ditemukan di URL."); return; }
    setError("");
    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Gagal mereset password.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold text-gray-800">Link Tidak Valid</h2>
        <p className="mt-3 text-sm text-gray-500">
          Link reset password tidak lengkap. Silakan request ulang.
        </p>
        <Link href="/forgot-password">
          <Button className="mt-6 h-12 w-full rounded-xl bg-[#0a2a8b] hover:bg-[#09206b]">
            Request Ulang
          </Button>
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center py-8">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle size={32} className="text-emerald-500" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Password Berhasil Direset</h2>
        <p className="mt-3 text-sm text-gray-500">Silakan login dengan password baru Anda.</p>
        <Link href="/login">
          <Button className="mt-6 h-12 w-full rounded-xl bg-[#0a2a8b] hover:bg-[#09206b]">
            Login Sekarang
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-gray-800">Reset Password</h2>
      <p className="mt-2 text-sm text-gray-500">Masukkan password baru Anda.</p>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Password Baru</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Min. 8 karakter, 1 huruf besar, 1 angka"
              className="pl-10 pr-10 h-12 rounded-xl"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-[#0a2a8b] hover:bg-[#09206b]"
          disabled={loading}
        >
          {loading ? "Mereset..." : "Reset Password"}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[#f5f6f8] flex items-center justify-center p-6">
      <Card className="w-full max-w-md overflow-hidden rounded-3xl border bg-white shadow-2xl">
        <div className="p-8 md:p-10">
          <Suspense fallback={
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-[#0a2a8b] border-t-transparent rounded-full mx-auto" />
            </div>
          }>
            <ResetForm />
          </Suspense>
        </div>
      </Card>
    </main>
  );
}

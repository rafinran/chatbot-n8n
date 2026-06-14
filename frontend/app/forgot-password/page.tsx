"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Gagal mengirim email reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f6f8] flex items-center justify-center p-6">
      <Card className="w-full max-w-md overflow-hidden rounded-3xl border bg-white shadow-2xl">
        <div className="p-8 md:p-10">
          <div className="flex justify-between items-center mb-6">
            <Link href="/login" className="text-gray-400 hover:text-gray-600 transition">
              <ArrowLeft size={20} />
            </Link>
          </div>

          {sent ? (
            <div className="text-center py-8">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle size={32} className="text-emerald-500" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Email Terkirim</h2>
              <p className="mt-3 text-gray-500 text-sm leading-relaxed">
                Jika email <strong>{email}</strong> terdaftar, link reset password telah dikirim ke inbox Anda.
                Silakan cek folder spam jika tidak muncul.
              </p>
              <Link href="/login">
                <Button className="mt-6 h-12 w-full rounded-xl bg-[#0a2a8b] hover:bg-[#09206b]">
                  Kembali ke Login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-800">Lupa Password</h2>
              <p className="mt-2 text-sm text-gray-500">
                Masukkan email Anda untuk menerima link reset password.
              </p>

              <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      type="email"
                      placeholder="nama@epson.com"
                      className="pl-10 h-12 rounded-xl"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl bg-[#0a2a8b] hover:bg-[#09206b]"
                  disabled={loading}
                >
                  {loading ? "Mengirim..." : "Kirim Link Reset"}
                </Button>
              </form>
            </>
          )}
        </div>
      </Card>
    </main>
  );
}

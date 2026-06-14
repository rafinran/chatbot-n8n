"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyEmail } from "@/lib/api";

function VerifyForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Memverifikasi email Anda...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Token verifikasi tidak ditemukan di URL.");
      return;
    }
    (async () => {
      try {
        await verifyEmail(token);
        setStatus("success");
        setMessage("Email berhasil diverifikasi. Anda sekarang dapat login.");
      } catch (err: any) {
        setStatus("error");
        setMessage(err.message || "Gagal memverifikasi email. Token mungkin sudah kadaluarsa.");
      }
    })();
  }, [token]);

  return (
    <div className="text-center py-8">
      {status === "loading" && (
        <>
          <div className="flex justify-center mb-4">
            <Loader2 size={40} className="animate-spin text-[#0a2a8b]" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Verifikasi Email</h2>
          <p className="mt-2 text-sm text-gray-500">{message}</p>
        </>
      )}

      {status === "success" && (
        <>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle size={32} className="text-emerald-500" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-800">Email Terverifikasi</h2>
          <p className="mt-2 text-sm text-gray-500">{message}</p>
          <Link href="/login">
            <Button className="mt-6 h-12 w-full rounded-xl bg-[#0a2a8b] hover:bg-[#09206b]">
              Login Sekarang
            </Button>
          </Link>
        </>
      )}

      {status === "error" && (
        <>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <XCircle size={32} className="text-red-500" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-800">Verifikasi Gagal</h2>
          <p className="mt-2 text-sm text-gray-500">{message}</p>
          <Link href="/login">
            <Button className="mt-6 h-12 w-full rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700">
              Kembali ke Login
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen bg-[#f5f6f8] flex items-center justify-center p-6">
      <Card className="w-full max-w-md overflow-hidden rounded-3xl border bg-white shadow-2xl">
        <div className="p-8 md:p-10">
          <Suspense fallback={
            <div className="text-center py-12">
              <Loader2 size={40} className="animate-spin text-[#0a2a8b] mx-auto" />
              <p className="mt-3 text-sm text-gray-400">Memuat...</p>
            </div>
          }>
            <VerifyForm />
          </Suspense>
        </div>
      </Card>
    </main>
  );
}

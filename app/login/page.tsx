"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import {
  Bot,
  Eye,
  EyeOff,
  Lock,
  Mail,
  X,
} from "lucide-react";

import { useState } from "react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="min-h-screen bg-[#f5f6f8] flex items-center justify-center p-6">
      <Card className="w-full max-w-5xl overflow-hidden rounded-3xl border bg-white shadow-2xl">
        <div className="grid md:grid-cols-2">
          {/* LEFT SIDE */}
          <div className="relative hidden md:flex flex-col justify-between bg-gradient-to-br from-[#f5f7ff] to-[#eef2ff] p-12">
            <div>
              <h1 className="text-4xl font-bold text-[#0a2a8b]">
                Chatson
              </h1>

              <p className="mt-6 max-w-sm text-muted-foreground leading-7">
                Welcome back to the future of enterprise intelligence.
                Secure, precise, and entirely at your command.
              </p>
            </div>

            <div className="flex items-center justify-center">
              <div className="flex h-72 w-72 items-center justify-center rounded-full bg-gradient-to-br from-[#dfe7ff] to-[#b9c9ff] shadow-inner">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-[#0a2a8b] text-white shadow-lg">
                  <Bot size={42} />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="p-8 md:p-12">
            <div className="flex justify-end">
              <button className="text-gray-500 hover:text-black transition">
                ✕
              </button>
            </div>

            <div className="mt-2">
              <h2 className="text-3xl font-bold">
                Sign in to your account
              </h2>

              <p className="mt-2 text-muted-foreground">
                Access your AI operations dashboard.
              </p>
            </div>

            <form className="mt-8 space-y-6">
              {/* EMAIL */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Email Address
                </label>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />

                  <Input
                    type="email"
                    placeholder="operator@enterprise.com"
                    className="pl-10 h-12 rounded-xl"
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Password
                </label>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />

                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-12 rounded-xl"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? (
                      <Eye size={18} />
                    ) : (
                      <EyeOff size={18} />
                    )}
                  </button>
                </div>
              </div>

              {/* REMEMBER */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox id="remember" />
                  <label
                    htmlFor="remember"
                    className="text-sm text-muted-foreground"
                  >
                    Remember me
                  </label>
                </div>

                <button
                  type="button"
                  className="text-sm font-medium text-[#0a2a8b] hover:underline"
                >
                  Forgot Password?
                </button>
              </div>

              {/* LOGIN BUTTON */}
              <Button className="h-12 w-full rounded-xl bg-[#0a2a8b] hover:bg-[#09206b]">
                Login →
              </Button>

              {/* LOGIN BUTTON */}
              <Button className="h-12 w-full rounded-xl bg-[#919191] hover:bg-[#09206b]">
                Register →
              </Button>
            </form>
          </div>
        </div>
      </Card>
    </main>
  );
}
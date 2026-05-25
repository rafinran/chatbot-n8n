"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

import {
  Bot,
  Shield,
  Boxes,
  BarChart3,
  Building2,
  Cpu,
  Code2,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const isLoggedIn = !loading && user !== null;

  const handleBotClick = () => {
    if (isLoggedIn) {
      router.push("/chatbot");
    } else {
      router.push("/login");
    }
  }; 

  return (
    <main className="min-h-screen bg-[#f5f5f5] text-black">
      {/* NAVBAR */}
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* LEFT */}
          <div className="flex items-center gap-12">
            <a href="/">
              <h1 className="text-xl font-bold text-[#0A2A8B] cursor-pointer">
                WEBSON & CHATSON
              </h1>
            </a>

            <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
              <a href="#">Solutions</a>
              <a href="#">Platform</a>
              <a href="#">Enterprise</a>
              <a href="#">Pricing</a>
              <a href="#">Industries</a>
              <a href="#">Support</a>
            </nav>
          </div>

          {/* RIGHT */}
          <div className="hidden items-center gap-5 text-sm md:flex">
            <a href="#">EN</a>
            <a href="#">About Webson</a>
            <a href="#">Accessibility</a>

            {/* Tombol Login hilang kalau sudah login */}
            {isLoggedIn === false && (
              <Button
                variant="outline"
                className="rounded-full px-5"
                onClick={() => router.push("/login")}
              >
                Login
              </Button>
            )}

            {/* Kalau sudah login, tampilkan tombol ke dashboard */}
            {isLoggedIn === true && (
              <Button
                className="rounded-full bg-[#0A2A8B] px-5 hover:bg-[#081f66]"
                onClick={() => router.push("/chat")}
              >
                Dashboard
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto grid max-w-7xl gap-16 px-6 py-20 md:grid-cols-2">
        {/* LEFT */}
        <div className="flex flex-col justify-center">
          <div className="mb-6 w-fit rounded bg-[#0A2A8B] px-3 py-1 text-xs font-semibold text-white">
            NEW
          </div>

          <h2 className="max-w-xl text-5xl font-bold leading-tight">
            Enterprise AI.
            <br />
            Engineered for Precision.
          </h2>

          <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
            Transform your corporate workflow with Webson &
            Chatson. Secure, scalable, and built to integrate
            seamlessly with your existing data infrastructure.
          </p>

          <div className="mt-10">
            <Button className="h-12 rounded-none bg-[#0A2A8B] px-8 hover:bg-[#081f66]">
              Start Your Trial
              <ChevronRight className="ml-2" size={18} />
            </Button>
          </div>
        </div>

        {/* RIGHT MOCKUP */}
        <div className="flex items-center justify-center">
          <div className="relative h-[260px] w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="absolute left-6 top-6 h-24 w-40 rounded-md bg-[#e8edf8]" />

            <div className="absolute right-6 top-6 h-24 w-40 rounded-md border bg-[#fafafa]" />

            <div className="absolute bottom-6 left-6 right-6 h-24 rounded-xl bg-gradient-to-r from-[#f5f7ff] to-[#ffffff]" />

            <div className="absolute bottom-8 right-10 h-16 w-16 rounded-full bg-[#dfe7ff] blur-2xl" />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto grid max-w-6xl grid-cols-2 gap-10 border-t border-b py-12 md:grid-cols-6">
        <Feature icon={Cpu} title="AI Models" />
        <Feature icon={Boxes} title="Integration" />
        <Feature icon={Shield} title="Security" />
        <Feature icon={Code2} title="Developer APIs" />
        <Feature icon={BarChart3} title="Analytics" />
        <Feature icon={Building2} title="Enterprise" />
      </section>

      {/* FOOTER */}
      <footer className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-12 md:grid-cols-4">
          <div>
            <h3 className="mb-5 font-semibold">
              Products
            </h3>

            <div className="space-y-3 text-sm text-muted-foreground">
              <p>AI Models</p>
              <p>Chat Assistant</p>
              <p>Integration Hub</p>
              <p>Analytics Tools</p>
              <p>Enterprise API</p>
              <p>Security Add-ons</p>
              <p>Custom Solutions</p>
            </div>
          </div>

          <div>
            <h3 className="mb-5 font-semibold">
              Support
            </h3>

            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Documentation</p>
              <p>API Reference</p>
              <p>Community Forum</p>
              <p>System Status</p>
              <p>Contact Support</p>
              <p>Security Bulletins</p>
            </div>
          </div>

          <div>
            <h3 className="mb-5 font-semibold">
              Company
            </h3>

            <div className="space-y-3 text-sm text-muted-foreground">
              <p>About Us</p>
              <p>Careers</p>
              <p>Newsroom</p>
              <p>Partner Program</p>
              <p>Investors</p>
            </div>
          </div>

          <div>
            <h3 className="mb-5 font-semibold">
              Stay Connected with Webson & Chatson
            </h3>

            <div className="space-y-4">
              <div className="flex gap-3">
                <Input placeholder="Email Address*" />

                <Input
                  placeholder="Country*"
                  className="max-w-[140px]"
                />
              </div>

              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <input type="checkbox" />

                <p>
                  Opt-in for promotional emails regarding my
                  relationship, I agree that I will be
                  contacted in accordance with the Privacy
                  Policy.
                </p>
              </div>

              <Button className="bg-[#0A2A8B] hover:bg-[#081f66]">
                Sign Up
              </Button>
            </div>
          </div>
        </div>
      </footer>

      {/* BOTTOM BAR */}
      <div className="bg-[#0A2A8B] px-6 py-4 text-xs text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p>
            Webson & Chatson use cookies to provide a better
            website experience.
          </p>

          <div className="flex gap-5">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Use</a>
          </div>
        </div>
      </div>

      {/* FLOATING CHATBOT BUTTON */}
      <button
        onClick={handleBotClick}
        className="fixed bottom-8 right-8 flex h-20 w-20 items-center justify-center rounded-full bg-[#0A2A8B] text-white shadow-2xl transition hover:scale-105 hover:bg-[#081f66]"
      >
        <Bot size={42} />
      </button>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
}: {
  icon: any;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Icon size={28} />

      <p className="text-sm font-medium">
        {title}
      </p>
    </div>
  );
}

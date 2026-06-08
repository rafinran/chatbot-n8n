"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

import {
  Bot,
  Shield,
  Boxes,
  BarChart3,
  Building2,
  Cpu,
  Code2,
  ChevronRight,
  LogOut,
  Menu,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function HomePage() {
  const router = useRouter();
  const { user, loading, logout: contextLogout } = useAuth();
  const isLoggedIn = !loading && user !== null;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleBotClick = () => {
    router.push(isLoggedIn ? "/chatbot" : "/login");
  };

  const handleLogout = async () => {
    try {
      await contextLogout();
      router.push("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f5f5] text-black">

      {/* ── NAVBAR ── */}
      <header className="border-b bg-white sticky top-0 z-20">
        <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-4 sm:px-6">

          {/* Logo + desktop nav */}
          <div className="flex items-center gap-6 lg:gap-12">
            <a href="/">
              <h1 className="text-base sm:text-xl font-bold text-[#0A2A8B] cursor-pointer whitespace-nowrap">
                WEBSON & CHATSON
              </h1>
            </a>
            <nav className="hidden items-center gap-6 lg:gap-8 text-sm font-medium lg:flex">
              <a href="#" className="hover:text-[#0A2A8B] transition">Solutions</a>
              <a href="#" className="hover:text-[#0A2A8B] transition">Platform</a>
              <a href="#" className="hover:text-[#0A2A8B] transition">Enterprise</a>
              <a href="#" className="hover:text-[#0A2A8B] transition">Pricing</a>
              <a href="#" className="hover:text-[#0A2A8B] transition">Industries</a>
              <a href="#" className="hover:text-[#0A2A8B] transition">Support</a>
            </nav>
          </div>

          {/* Desktop right */}
          <div className="hidden lg:flex items-center gap-5 text-sm">
            <a href="#" className="hover:text-[#0A2A8B] transition">EN</a>
            <a href="#" className="hover:text-[#0A2A8B] transition">About Webson</a>
            <a href="#" className="hover:text-[#0A2A8B] transition">Accessibility</a>
          
            {isLoggedIn && user?.role === "ADMIN" && (
              <Button
                variant="outline"
                className="rounded-full px-5"
                onClick={() => router.push("/admin")}
              >
                Admin
              </Button>
            )}
          
            {isLoggedIn ? (
              <Button
                variant="outline"
                className="rounded-full px-5 gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-400"
                onClick={handleLogout}
              >
                <LogOut size={15} />
                Logout
              </Button>
            ) : (
              <Button
                variant="outline"
                className="rounded-full px-5"
                onClick={() => router.push("/login")}
              >
                Login
              </Button>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="lg:hidden flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 transition"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t bg-white px-4 py-4 flex flex-col gap-3 text-sm">
            {isLoggedIn && (
              <p className="text-gray-500 font-medium pb-1 border-b">
                {user?.fullName || user?.username}
              </p>
            )}
            <a href="#" className="text-gray-700 hover:text-[#0A2A8B]">Solutions</a>
            <a href="#" className="text-gray-700 hover:text-[#0A2A8B]">Platform</a>
            <a href="#" className="text-gray-700 hover:text-[#0A2A8B]">Enterprise</a>
            <a href="#" className="text-gray-700 hover:text-[#0A2A8B]">Pricing</a>
            <a href="#" className="text-gray-700 hover:text-[#0A2A8B]">Industries</a>
            <a href="#" className="text-gray-700 hover:text-[#0A2A8B]">Support</a>
            <div className="pt-2 border-t">
              <a href="#" className="block text-gray-500 py-1">EN</a>
              <a href="#" className="block text-gray-500 py-1">About Webson</a>
              <a href="#" className="block text-gray-500 py-1">Accessibility</a>
            </div>
            {isLoggedIn ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-red-500 hover:text-red-700 font-medium pt-1"
              >
                <LogOut size={15} />
                Logout
              </button>
            ) : (
              <Button
                variant="outline"
                className="w-full mt-1"
                onClick={() => router.push("/login")}
              >
                Login
              </Button>
            )}
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section className="mx-auto grid max-w-7xl gap-10 lg:gap-16 px-4 sm:px-6 py-12 sm:py-16 lg:py-20 lg:grid-cols-2">
        {/* Left */}
        <div className="flex flex-col justify-center">
          <div className="mb-5 w-fit rounded bg-[#0A2A8B] px-3 py-1 text-xs font-semibold text-white">
            NEW
          </div>
          <h2 className="max-w-xl text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
            Enterprise AI.
            <br />
            Engineered for Precision.
          </h2>
          <p className="mt-5 max-w-lg text-base sm:text-lg leading-7 sm:leading-8 text-muted-foreground">
            Transform your corporate workflow with Webson & Chatson.
            Secure, scalable, and built to integrate seamlessly with
            your existing data infrastructure.
          </p>
          <div className="mt-8 sm:mt-10">
            <Button className="h-11 sm:h-12 rounded-none bg-[#0A2A8B] px-6 sm:px-8 hover:bg-[#081f66] text-sm sm:text-base">
              Start Your Trial
              <ChevronRight className="ml-2" size={18} />
            </Button>
          </div>
        </div>

        {/* Right mockup */}
        <div className="flex items-center justify-center">
          <div className="relative h-[200px] sm:h-[240px] lg:h-[260px] w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="absolute left-6 top-6 h-20 sm:h-24 w-36 sm:w-40 rounded-md bg-[#e8edf8]" />
            <div className="absolute right-6 top-6 h-20 sm:h-24 w-36 sm:w-40 rounded-md border bg-[#fafafa]" />
            <div className="absolute bottom-6 left-6 right-6 h-20 sm:h-24 rounded-xl bg-gradient-to-r from-[#f5f7ff] to-[#ffffff]" />
            <div className="absolute bottom-8 right-10 h-16 w-16 rounded-full bg-[#dfe7ff] blur-2xl" />
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="mx-auto max-w-6xl border-t border-b py-10 sm:py-12 px-4 sm:px-6">
        <div className="grid grid-cols-3 gap-6 sm:gap-10 md:grid-cols-6">
          <Feature icon={Cpu} title="AI Models" />
          <Feature icon={Boxes} title="Integration" />
          <Feature icon={Shield} title="Security" />
          <Feature icon={Code2} title="Developer APIs" />
          <Feature icon={BarChart3} title="Analytics" />
          <Feature icon={Building2} title="Enterprise" />
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
        <div className="grid gap-10 sm:gap-12 grid-cols-2 md:grid-cols-4">
          <div>
            <h3 className="mb-4 sm:mb-5 font-semibold text-sm sm:text-base">Products</h3>
            <div className="space-y-2 sm:space-y-3 text-sm text-muted-foreground">
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
            <h3 className="mb-4 sm:mb-5 font-semibold text-sm sm:text-base">Support</h3>
            <div className="space-y-2 sm:space-y-3 text-sm text-muted-foreground">
              <p>Documentation</p>
              <p>API Reference</p>
              <p>Community Forum</p>
              <p>System Status</p>
              <p>Contact Support</p>
              <p>Security Bulletins</p>
            </div>
          </div>

          <div>
            <h3 className="mb-4 sm:mb-5 font-semibold text-sm sm:text-base">Company</h3>
            <div className="space-y-2 sm:space-y-3 text-sm text-muted-foreground">
              <p>About Us</p>
              <p>Careers</p>
              <p>Newsroom</p>
              <p>Partner Program</p>
              <p>Investors</p>
            </div>
          </div>

          {/* Newsletter — full width on mobile */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="mb-4 sm:mb-5 font-semibold text-sm sm:text-base">
              Stay Connected with Webson & Chatson
            </h3>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex gap-2 sm:gap-3">
                <Input placeholder="Email Address*" className="text-sm" />
                <Input placeholder="Country*" className="max-w-[110px] sm:max-w-[140px] text-sm" />
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <input type="checkbox" className="mt-0.5 flex-shrink-0" />
                <p>
                  Opt-in for promotional emails regarding my relationship,
                  I agree that I will be contacted in accordance with the
                  Privacy Policy.
                </p>
              </div>
              <Button className="bg-[#0A2A8B] hover:bg-[#081f66] w-full sm:w-auto">
                Sign Up
              </Button>
            </div>
          </div>
        </div>
      </footer>

      {/* ── BOTTOM BAR ── */}
      <div className="bg-[#0A2A8B] px-4 sm:px-6 py-4 text-xs text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>Webson & Chatson use cookies to provide a better website experience.</p>
          <div className="flex gap-4 sm:gap-5">
            <a href="#" className="hover:underline">Privacy Policy</a>
            <a href="#" className="hover:underline">Terms of Use</a>
          </div>
        </div>
      </div>

      {/* ── FLOATING CHATBOT BUTTON ── */}
      <button
        onClick={handleBotClick}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-[#0A2A8B] text-white shadow-2xl transition hover:scale-105 hover:bg-[#081f66]"
      >
        <Bot size={30} className="sm:hidden" />
        <Bot size={42} className="hidden sm:block" />
      </button>
    </main>
  );
}

function Feature({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex flex-col items-center gap-2 sm:gap-4 text-center">
      <Icon size={22} className="sm:hidden" />
      <Icon size={28} className="hidden sm:block" />
      <p className="text-xs sm:text-sm font-medium leading-tight">{title}</p>
    </div>
  );
}

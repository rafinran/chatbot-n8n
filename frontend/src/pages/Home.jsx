import { useAuth } from "../context/AuthContext";

export default function Home({ onStartChat }) {
  const { user, logout } = useAuth();

  const features = [
    {
      icon: "💬",
      title: "Tanya Jawab Otomatis",
      desc: "Dapatkan jawaban instan dari knowledge base Epson berdasarkan FAQ dan dokumentasi resmi.",
    },
    {
      icon: "🖼️",
      title: "Analisis Foto Defect",
      desc: "Upload foto hasil cetak atau komponen bermasalah — AI akan menganalisis dan memberikan rekomendasi.",
    },
    {
      icon: "📚",
      title: "Berbasis Dokumen Resmi",
      desc: "Semua jawaban bersumber dari dokumentasi internal Epson, bukan dari internet umum.",
    },
    {
      icon: "🎫",
      title: "Eskalasi Otomatis",
      desc: "Jika chatbot tidak menemukan jawaban, pertanyaan dicatat dan kamu akan diarahkan ke tim helpdesk.",
    },
  ];

  const faqs = [
    "How do I refill the ink tanks?",
    "My printout has lines running through it",
    "Printer is offline on Windows",
    "Printing is slow over wireless",
    "How do I scan a document?",
    "Paper keeps jamming",
  ];

  return (
    <div style={s.root}>
      {/* Navbar */}
      <nav style={s.nav}>
        <div style={s.navLogo}>
          <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
            <rect x="2"  y="2"  width="10" height="10" rx="2" fill="#00B4D8"/>
            <rect x="16" y="2"  width="10" height="10" rx="2" fill="#00B4D8" opacity="0.5"/>
            <rect x="2"  y="16" width="10" height="10" rx="2" fill="#00B4D8" opacity="0.5"/>
            <rect x="16" y="16" width="10" height="10" rx="2" fill="#00B4D8"/>
          </svg>
          <span style={s.navLogoText}>Epson Helpdesk AI</span>
        </div>
        <div style={s.navRight}>
          <span style={s.navUser}>👤 {user?.fullName || user?.username}</span>
          <button style={s.navLogout} onClick={logout}>Keluar</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={s.hero}>
        <div style={s.heroGrid} />
        <div style={s.heroContent}>
          <div style={s.heroBadge}>✦ Powered by Gemini AI</div>
          <h1 style={s.heroTitle}>
            Selamat datang,<br />
            <span style={s.heroName}>{user?.fullName || user?.username}!</span>
          </h1>
          <p style={s.heroDesc}>
            Asisten helpdesk internal Epson siap membantu menyelesaikan masalah teknis printer
            dan operasional kamu secara cepat dan akurat.
          </p>
          <button style={s.heroBtn} onClick={onStartChat}>
            Mulai Chat dengan AI →
          </button>
        </div>
      </section>

      {/* Features */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Apa yang bisa dibantu?</h2>
        <div style={s.featuresGrid}>
          {features.map((f, i) => (
            <div key={i} style={s.featureCard}>
              <div style={s.featureIcon}>{f.icon}</div>
              <h3 style={s.featureTitle}>{f.title}</h3>
              <p style={s.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick questions */}
      <section style={{ ...s.section, paddingTop: 0 }}>
        <h2 style={s.sectionTitle}>Pertanyaan yang sering ditanyakan</h2>
        <div style={s.faqGrid}>
          {faqs.map((q, i) => (
            <button key={i} style={s.faqChip} onClick={onStartChat}>
              {q} →
            </button>
          ))}
        </div>
      </section>

      {/* CTA bottom */}
      <section style={s.cta}>
        <h2 style={s.ctaTitle}>Ada masalah dengan printer?</h2>
        <p style={s.ctaDesc}>Tanyakan langsung ke AI helpdesk — tersedia 24/7 tanpa antrian.</p>
        <button style={s.ctaBtn} onClick={onStartChat}>Buka Chatbot →</button>
      </section>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0A0F1E; }
        button { font-family: 'DM Sans', sans-serif; }
      `}</style>
    </div>
  );
}

const s = {
  root: {
    minHeight: "100vh", background: "#0A0F1E",
    color: "#F0F4FF", fontFamily: "'DM Sans', sans-serif",
    overflowX: "hidden",
  },

  // Navbar
  nav: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 48px",
    borderBottom: "1px solid rgba(0,180,216,0.1)",
    background: "rgba(17,24,39,0.8)",
    backdropFilter: "blur(10px)",
    position: "sticky", top: 0, zIndex: 100,
  },
  navLogo:     { display: "flex", alignItems: "center", gap: "10px" },
  navLogoText: { fontSize: "15px", fontWeight: "600", color: "#F0F4FF" },
  navRight:    { display: "flex", alignItems: "center", gap: "16px" },
  navUser:     { fontSize: "13px", color: "#7B90A8" },
  navLogout: {
    background: "transparent", border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: "7px", color: "#EF4444", fontSize: "13px",
    padding: "6px 14px", cursor: "pointer",
  },

  // Hero
  hero: {
    position: "relative", padding: "100px 48px 80px",
    textAlign: "center", overflow: "hidden",
  },
  heroGrid: {
    position: "absolute", inset: 0,
    backgroundImage: `
      radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,180,216,0.12) 0%, transparent 70%),
      linear-gradient(rgba(0,180,216,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,180,216,0.04) 1px, transparent 1px)
    `,
    backgroundSize: "auto, 40px 40px, 40px 40px",
  },
  heroContent: { position: "relative", maxWidth: "640px", margin: "0 auto" },
  heroBadge: {
    display: "inline-block",
    background: "rgba(0,180,216,0.1)", border: "1px solid rgba(0,180,216,0.25)",
    borderRadius: "20px", color: "#00B4D8",
    fontSize: "12px", fontWeight: "500", padding: "5px 14px", marginBottom: "24px",
  },
  heroTitle: {
    fontSize: "48px", fontWeight: "700", lineHeight: "1.2",
    letterSpacing: "-1px", marginBottom: "16px",
  },
  heroName:  { color: "#00B4D8" },
  heroDesc: {
    fontSize: "17px", color: "#7B90A8", lineHeight: "1.7",
    marginBottom: "36px", maxWidth: "480px", margin: "0 auto 36px",
  },
  heroBtn: {
    background: "#00B4D8", border: "none", borderRadius: "10px",
    color: "#0A0F1E", fontSize: "16px", fontWeight: "600",
    padding: "14px 32px", cursor: "pointer",
    boxShadow: "0 0 32px rgba(0,180,216,0.3)",
  },

  // Sections
  section: { padding: "64px 48px", maxWidth: "1100px", margin: "0 auto" },
  sectionTitle: {
    fontSize: "26px", fontWeight: "600", marginBottom: "32px",
    color: "#F0F4FF", letterSpacing: "-0.5px",
  },

  // Features
  featuresGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px",
  },
  featureCard: {
    background: "#111827", border: "1px solid rgba(0,180,216,0.12)",
    borderRadius: "14px", padding: "28px 24px",
  },
  featureIcon:  { fontSize: "28px", marginBottom: "14px" },
  featureTitle: { fontSize: "15px", fontWeight: "600", color: "#F0F4FF", marginBottom: "8px" },
  featureDesc:  { fontSize: "13px", color: "#4B6480", lineHeight: "1.6" },

  // FAQ chips
  faqGrid: { display: "flex", flexWrap: "wrap", gap: "10px" },
  faqChip: {
    background: "#111827", border: "1px solid rgba(0,180,216,0.15)",
    borderRadius: "8px", color: "#7B90A8",
    fontSize: "13px", padding: "10px 16px", cursor: "pointer",
    textAlign: "left",
  },

  // CTA
  cta: {
    textAlign: "center", padding: "64px 48px",
    background: "linear-gradient(180deg, transparent, rgba(0,180,216,0.05))",
    borderTop: "1px solid rgba(0,180,216,0.08)",
  },
  ctaTitle: { fontSize: "28px", fontWeight: "600", marginBottom: "12px" },
  ctaDesc:  { fontSize: "15px", color: "#4B6480", marginBottom: "28px" },
  ctaBtn: {
    background: "transparent", border: "1px solid rgba(0,180,216,0.4)",
    borderRadius: "10px", color: "#00B4D8",
    fontSize: "15px", fontWeight: "500", padding: "12px 28px", cursor: "pointer",
  },
};

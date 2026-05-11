import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login({ onSwitchToRegister }) {
  const { login }   = useAuth();
  const [form, setForm]     = useState({ username: "", password: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.username, form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.root}>
      <div style={s.grid} />
      <div style={s.card}>
        <div style={s.logoArea}>
          <div style={s.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="2"  y="2"  width="10" height="10" rx="2" fill="#00B4D8"/>
              <rect x="16" y="2"  width="10" height="10" rx="2" fill="#00B4D8" opacity="0.5"/>
              <rect x="2"  y="16" width="10" height="10" rx="2" fill="#00B4D8" opacity="0.5"/>
              <rect x="16" y="16" width="10" height="10" rx="2" fill="#00B4D8"/>
            </svg>
          </div>
          <div>
            <div style={s.logoTitle}>Epson Helpdesk AI</div>
            <div style={s.logoSub}>Internal Support System</div>
          </div>
        </div>

        <h1 style={s.heading}>Selamat datang</h1>
        <p style={s.subheading}>Masuk untuk mengakses asisten helpdesk</p>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.fieldGroup}>
            <label style={s.label}>Username</label>
            <input style={s.input} type="text" placeholder="username kamu"
              value={form.username} autoFocus required
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            />
          </div>
          <div style={s.fieldGroup}>
            <label style={s.label}>Password</label>
            <input style={s.input} type="password" placeholder="••••••••"
              value={form.password} required
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>

          {error && <div style={s.error}>{error}</div>}

          <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} disabled={loading} type="submit">
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        <div style={s.divider}>
          <div style={s.dividerLine}/>
          <span style={s.dividerText}>atau</span>
          <div style={s.dividerLine}/>
        </div>

        <button style={s.registerBtn} onClick={onSwitchToRegister}>
          Daftar Akun Baru
        </button>

        <div style={s.footer}>Hanya untuk karyawan yang terdaftar</div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input { font-family: 'DM Sans', sans-serif; }
        input:focus { outline: none; border-color: #00B4D8 !important; }
      `}</style>
    </div>
  );
}

const s = {
  root: {
    minHeight: "100vh", background: "#0A0F1E",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'DM Sans', sans-serif", position: "relative", overflow: "hidden",
  },
  grid: {
    position: "absolute", inset: 0,
    backgroundImage: `linear-gradient(rgba(0,180,216,0.06) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(0,180,216,0.06) 1px, transparent 1px)`,
    backgroundSize: "40px 40px",
  },
  card: {
    position: "relative", background: "#111827",
    border: "1px solid rgba(0,180,216,0.2)", borderRadius: "16px",
    padding: "40px", width: "100%", maxWidth: "400px",
    boxShadow: "0 0 60px rgba(0,180,216,0.08)",
  },
  logoArea:  { display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" },
  logoIcon:  { background: "rgba(0,180,216,0.1)", border: "1px solid rgba(0,180,216,0.2)", borderRadius: "10px", padding: "8px", display: "flex" },
  logoTitle: { color: "#F0F4FF", fontSize: "16px", fontWeight: "600" },
  logoSub:   { color: "#4B6480", fontSize: "12px", marginTop: "1px" },
  heading:   { color: "#F0F4FF", fontSize: "24px", fontWeight: "600", margin: "0 0 6px", letterSpacing: "-0.5px" },
  subheading:{ color: "#4B6480", fontSize: "14px", margin: "0 0 28px" },
  form:      { display: "flex", flexDirection: "column", gap: "18px" },
  fieldGroup:{ display: "flex", flexDirection: "column", gap: "6px" },
  label:     { color: "#7B90A8", fontSize: "13px", fontWeight: "500" },
  input: {
    background: "#1C2537", border: "1px solid rgba(0,180,216,0.15)",
    borderRadius: "8px", color: "#F0F4FF", fontSize: "15px",
    padding: "11px 14px", transition: "border-color 0.2s", fontFamily: "inherit",
  },
  error: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: "8px", color: "#FCA5A5", fontSize: "13px", padding: "10px 14px",
  },
  btn: {
    background: "#00B4D8", border: "none", borderRadius: "8px",
    color: "#0A0F1E", fontSize: "15px", fontWeight: "600",
    padding: "12px", marginTop: "4px", fontFamily: "inherit", cursor: "pointer",
  },
  divider: {
    display: "flex", alignItems: "center", gap: "12px", margin: "20px 0 0",
  },
  dividerLine: { flex: 1, height: "1px", background: "rgba(0,180,216,0.1)" },
  dividerText: { color: "#3D5470", fontSize: "12px" },
  registerBtn: {
    width: "100%", background: "transparent",
    border: "1px solid rgba(0,180,216,0.25)", borderRadius: "8px",
    color: "#00B4D8", fontSize: "14px", fontWeight: "500",
    padding: "11px", marginTop: "12px", fontFamily: "inherit", cursor: "pointer",
  },
  footer: { color: "#2D4055", fontSize: "12px", textAlign: "center", marginTop: "24px" },
};

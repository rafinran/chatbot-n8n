import { useState } from "react";
import { api } from "../api";

export default function Register({ onSwitchToLogin }) {
  const [form, setForm]     = useState({ username: "", email: "", fullName: "", password: "", confirm: "" });
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Password dan konfirmasi password tidak cocok.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    setLoading(true);
    try {
      await api.register({
        username: form.username,
        email:    form.email,
        fullName: form.fullName,
        password: form.password,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Tampilan setelah registrasi berhasil
  if (success) {
    return (
      <div style={s.root}>
        <div style={s.grid} />
        <div style={s.card}>
          <div style={s.successIcon}>✓</div>
          <h2 style={s.heading}>Akun berhasil dibuat!</h2>
          <p style={{ ...s.subheading, textAlign: "center" }}>
            Silakan login menggunakan username dan password yang baru saja kamu daftarkan.
          </p>
          <button style={s.btn} onClick={onSwitchToLogin}>Ke Halaman Login</button>
        </div>
      </div>
    );
  }

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

        <h1 style={s.heading}>Daftar Akun</h1>
        <p style={s.subheading}>Buat akun untuk mengakses helpdesk</p>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.fieldGroup}>
            <label style={s.label}>Nama Lengkap</label>
            <input style={s.input} type="text" placeholder="nama lengkap kamu"
              value={form.fullName} autoFocus required
              onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
            />
          </div>
          <div style={s.fieldGroup}>
            <label style={s.label}>Username</label>
            <input style={s.input} type="text" placeholder="username (min. 3 karakter)"
              value={form.username} required minLength={3}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            />
          </div>
          <div style={s.fieldGroup}>
            <label style={s.label}>Email</label>
            <input style={s.input} type="email" placeholder="email@epson.com"
              value={form.email} required
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div style={s.row}>
            <div style={{ ...s.fieldGroup, flex: 1 }}>
              <label style={s.label}>Password</label>
              <input style={s.input} type="password" placeholder="min. 8 karakter"
                value={form.password} required minLength={8}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div style={{ ...s.fieldGroup, flex: 1 }}>
              <label style={s.label}>Konfirmasi</label>
              <input style={s.input} type="password" placeholder="ulangi password"
                value={form.confirm} required
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              />
            </div>
          </div>

          {error && <div style={s.error}>{error}</div>}

          <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} disabled={loading} type="submit">
            {loading ? "Memproses..." : "Daftar"}
          </button>
        </form>

        <div style={s.divider}>
          <div style={s.dividerLine}/>
          <span style={s.dividerText}>sudah punya akun?</span>
          <div style={s.dividerLine}/>
        </div>

        <button style={s.loginBtn} onClick={onSwitchToLogin}>
          Masuk Sekarang
        </button>
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
    padding: "40px", width: "100%", maxWidth: "480px",
    boxShadow: "0 0 60px rgba(0,180,216,0.08)",
  },
  successIcon: {
    width: "56px", height: "56px", borderRadius: "50%",
    background: "rgba(0,180,216,0.15)", border: "1px solid rgba(0,180,216,0.3)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "24px", color: "#00B4D8", margin: "0 auto 20px",
  },
  logoArea:  { display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" },
  logoIcon:  { background: "rgba(0,180,216,0.1)", border: "1px solid rgba(0,180,216,0.2)", borderRadius: "10px", padding: "8px", display: "flex" },
  logoTitle: { color: "#F0F4FF", fontSize: "16px", fontWeight: "600" },
  logoSub:   { color: "#4B6480", fontSize: "12px", marginTop: "1px" },
  heading:   { color: "#F0F4FF", fontSize: "22px", fontWeight: "600", margin: "0 0 6px", letterSpacing: "-0.5px" },
  subheading:{ color: "#4B6480", fontSize: "14px", margin: "0 0 24px" },
  form:      { display: "flex", flexDirection: "column", gap: "16px" },
  row:       { display: "flex", gap: "12px" },
  fieldGroup:{ display: "flex", flexDirection: "column", gap: "6px" },
  label:     { color: "#7B90A8", fontSize: "13px", fontWeight: "500" },
  input: {
    background: "#1C2537", border: "1px solid rgba(0,180,216,0.15)",
    borderRadius: "8px", color: "#F0F4FF", fontSize: "14px",
    padding: "10px 14px", transition: "border-color 0.2s", fontFamily: "inherit",
    width: "100%",
  },
  error: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: "8px", color: "#FCA5A5", fontSize: "13px", padding: "10px 14px",
  },
  btn: {
    background: "#00B4D8", border: "none", borderRadius: "8px",
    color: "#0A0F1E", fontSize: "15px", fontWeight: "600",
    padding: "12px", marginTop: "4px", fontFamily: "inherit", cursor: "pointer",
    width: "100%",
  },
  divider: { display: "flex", alignItems: "center", gap: "12px", margin: "20px 0 0" },
  dividerLine: { flex: 1, height: "1px", background: "rgba(0,180,216,0.1)" },
  dividerText: { color: "#3D5470", fontSize: "12px", whiteSpace: "nowrap" },
  loginBtn: {
    width: "100%", background: "transparent",
    border: "1px solid rgba(0,180,216,0.25)", borderRadius: "8px",
    color: "#00B4D8", fontSize: "14px", fontWeight: "500",
    padding: "11px", marginTop: "12px", fontFamily: "inherit", cursor: "pointer",
  },
};

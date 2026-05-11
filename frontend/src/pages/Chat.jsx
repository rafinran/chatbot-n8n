import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api }     from "../api";

export default function Chat() {
  const { user, logout }              = useAuth();
  const [messages,  setMessages]      = useState([{
    role: "assistant",
    content: `Halo, ${user?.fullName || user?.username}! 👋\nSaya asisten helpdesk Epson. Silakan ajukan pertanyaan atau upload foto printer untuk analisis.`,
  }]);
  const [input,     setInput]         = useState("");
  const [image,     setImage]         = useState(null);
  const [preview,   setPreview]       = useState(null);
  const [loading,   setLoading]       = useState(false);
  const bottomRef                     = useRef(null);
  const fileRef                       = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    api.getHistory().then(({ history }) => {
      if (history.length > 0) {
        setMessages(prev => [prev[0], ...history.map(h => ({ role: h.role, content: h.content }))]);
      }
    }).catch(() => {});
  }, []);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImage(null); setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const sendMessage = async () => {
    if ((!input.trim() && !image) || loading) return;

    const userMsg = { role: "user", content: input, image: preview };
    setMessages(prev => [...prev, userMsg]);
    const sentInput = input;
    setInput(""); clearImage(); setLoading(true);

    try {
      const data = image
        ? await api.chatWithImage(sentInput || "Tolong analisis gambar ini.", image)
        : await api.chat(sentInput);
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleNewChat = async () => {
    await api.clearHistory().catch(() => {});
    setMessages([{ role: "assistant", content: "Percakapan baru dimulai. Ada yang bisa saya bantu?" }]);
  };

  return (
    <div style={s.root}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.sideTop}>
          <div style={s.logoRow}>
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
              <rect x="2"  y="2"  width="10" height="10" rx="2" fill="#00B4D8"/>
              <rect x="16" y="2"  width="10" height="10" rx="2" fill="#00B4D8" opacity="0.5"/>
              <rect x="2"  y="16" width="10" height="10" rx="2" fill="#00B4D8" opacity="0.5"/>
              <rect x="16" y="16" width="10" height="10" rx="2" fill="#00B4D8"/>
            </svg>
            <span style={s.logoText}>Epson Helpdesk AI</span>
          </div>
          <button style={s.newChatBtn} onClick={handleNewChat}>+ Percakapan Baru</button>
        </div>

        <div style={s.sideBottom}>
          <div style={s.userInfo}>
            <div style={s.avatar}>{(user?.fullName || user?.username || "U")[0].toUpperCase()}</div>
            <div>
              <div style={s.userName}>{user?.fullName || user?.username}</div>
              <div style={s.userEmail}>{user?.email}</div>
            </div>
          </div>
          <button style={s.logoutBtn} onClick={logout}>Keluar</button>
        </div>
      </aside>

      {/* Main chat */}
      <main style={s.main}>
        <div style={s.messages}>
          {messages.map((msg, i) => (
            <div key={i} style={{ ...s.msgRow, justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              {msg.role === "assistant" && <div style={s.botAvatar}>AI</div>}
              <div style={{ ...s.bubble, ...(msg.role === "user" ? s.bubbleUser : s.bubbleBot) }}>
                {msg.image && (
                  <img src={msg.image} alt="upload"
                    style={{ maxWidth: "220px", borderRadius: "8px", marginBottom: "8px", display: "block" }}
                  />
                )}
                {msg.content.split("\n").map((line, j) => <span key={j}>{line}<br /></span>)}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ ...s.msgRow, justifyContent: "flex-start" }}>
              <div style={s.botAvatar}>AI</div>
              <div style={{ ...s.bubble, ...s.bubbleBot }}>
                <span className="typing"><span/><span/><span/></span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={s.inputArea}>
          {preview && (
            <div style={s.previewRow}>
              <img src={preview} alt="preview" style={s.previewImg} />
              <button style={s.removeImg} onClick={clearImage}>✕</button>
            </div>
          )}
          <div style={s.inputRow}>
            <button style={s.iconBtn} onClick={() => fileRef.current?.click()} title="Upload gambar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="3"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="M21 15l-5-5L5 21"/>
              </svg>
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: "none" }} />

            <textarea style={s.textarea} rows={1}
              placeholder="Ketik pertanyaan atau upload foto printer..."
              value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            />

            <button style={{ ...s.sendBtn, opacity: (!input.trim() && !image) || loading ? 0.4 : 1 }}
              onClick={sendMessage} disabled={(!input.trim() && !image) || loading}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
              </svg>
            </button>
          </div>
          <div style={s.hint}>Enter untuk kirim · Shift+Enter untuk baris baru</div>
        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0A0F1E; }
        textarea { resize: none; }
        textarea:focus { outline: none; }
        @keyframes blink {
          0%,80%,100% { opacity:0; transform:scale(0.8); }
          40% { opacity:1; transform:scale(1); }
        }
        .typing span { display:inline-block; width:6px; height:6px; border-radius:50%;
          background:#00B4D8; margin:0 2px; animation:blink 1.2s infinite; }
        .typing span:nth-child(2) { animation-delay:0.2s; }
        .typing span:nth-child(3) { animation-delay:0.4s; }
      `}</style>
    </div>
  );
}

const s = {
  root:      { display: "flex", height: "100vh", fontFamily: "'DM Sans', sans-serif", background: "#0A0F1E", color: "#F0F4FF" },
  sidebar:   { width: "240px", flexShrink: 0, background: "#111827", borderRight: "1px solid rgba(0,180,216,0.1)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "20px 16px" },
  sideTop:   { display: "flex", flexDirection: "column", gap: "20px" },
  logoRow:   { display: "flex", alignItems: "center", gap: "10px" },
  logoText:  { fontSize: "14px", fontWeight: "600", color: "#F0F4FF" },
  newChatBtn:{ background: "rgba(0,180,216,0.1)", border: "1px solid rgba(0,180,216,0.25)", borderRadius: "8px", color: "#00B4D8", fontSize: "13px", fontWeight: "500", padding: "9px 14px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" },
  sideBottom:{ display: "flex", flexDirection: "column", gap: "12px" },
  userInfo:  { display: "flex", alignItems: "center", gap: "10px" },
  avatar:    { width: "34px", height: "34px", borderRadius: "50%", background: "rgba(0,180,216,0.2)", border: "1px solid rgba(0,180,216,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "600", color: "#00B4D8", flexShrink: 0 },
  userName:  { fontSize: "13px", fontWeight: "500", color: "#D0DCE8" },
  userEmail: { fontSize: "11px", color: "#3D5470", marginTop: "2px" },
  logoutBtn: { background: "transparent", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "7px", color: "#EF4444", fontSize: "13px", padding: "8px", cursor: "pointer", fontFamily: "inherit" },
  main:      { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  messages:  { flex: 1, overflowY: "auto", padding: "28px 32px", display: "flex", flexDirection: "column", gap: "16px" },
  msgRow:    { display: "flex", alignItems: "flex-end", gap: "10px" },
  botAvatar: { width: "30px", height: "30px", borderRadius: "50%", flexShrink: 0, background: "rgba(0,180,216,0.15)", border: "1px solid rgba(0,180,216,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "600", color: "#00B4D8" },
  bubble:    { maxWidth: "68%", padding: "12px 16px", borderRadius: "14px", fontSize: "14px", lineHeight: "1.65" },
  bubbleBot: { background: "#1C2537", border: "1px solid rgba(0,180,216,0.1)", borderBottomLeftRadius: "4px", color: "#D0DCE8" },
  bubbleUser:{ background: "#00B4D8", color: "#0A0F1E", borderBottomRightRadius: "4px", fontWeight: "500" },
  inputArea: { padding: "16px 24px 20px", borderTop: "1px solid rgba(0,180,216,0.08)", background: "#0D1424" },
  previewRow:{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "10px" },
  previewImg:{ height: "72px", width: "72px", objectFit: "cover", borderRadius: "8px", border: "1px solid rgba(0,180,216,0.2)" },
  removeImg: { background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", color: "#EF4444", fontSize: "12px", padding: "3px 8px", cursor: "pointer" },
  inputRow:  { display: "flex", alignItems: "center", gap: "10px", background: "#1C2537", border: "1px solid rgba(0,180,216,0.15)", borderRadius: "12px", padding: "8px 12px" },
  iconBtn:   { background: "none", border: "none", color: "#4B6480", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px", borderRadius: "6px" },
  textarea:  { flex: 1, background: "none", border: "none", color: "#F0F4FF", fontSize: "14px", fontFamily: "inherit", lineHeight: "1.5", maxHeight: "120px", overflowY: "auto" },
  sendBtn:   { background: "#00B4D8", border: "none", borderRadius: "8px", color: "#0A0F1E", width: "36px", height: "36px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  hint:      { color: "#2D4055", fontSize: "11px", textAlign: "center", marginTop: "8px" },
};
 
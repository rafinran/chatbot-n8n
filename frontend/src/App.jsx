import { AuthProvider, useAuth } from "./context/AuthContext";
import Login    from "./pages/Login";
import Register from "./pages/Register";
import Home     from "./pages/Home";
import Chat     from "./pages/Chat";
import { useState } from "react";

function AppContent() {
  const { user, loading } = useAuth();
  const [page, setPage]   = useState("home"); // "home" | "chat"
  const [authPage, setAuthPage] = useState("login"); // "login" | "register"

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0A0F1E",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#4B6480", fontFamily: "'DM Sans', sans-serif", fontSize: "14px",
      }}>
        Memuat...
      </div>
    );
  }

  // Belum login → login atau register
  if (!user) {
    if (authPage === "register") {
      return <Register onSwitchToLogin={() => setAuthPage("login")} />;
    }
    return <Login onSwitchToRegister={() => setAuthPage("register")} />;
  }

  // Sudah login → home atau chat
  if (page === "chat") {
    return <Chat onBack={() => setPage("home")} />;
  }
  return <Home onStartChat={() => setPage("chat")} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

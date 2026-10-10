import { createContext, useContext, useEffect, useState } from "react";
import { getMe, TOKEN_KEY } from "./api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = () =>
    getMe()
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

  useEffect(() => {
    refresh();
  }, []);

  const login = async (idToken) => {
    if (idToken) sessionStorage.setItem(TOKEN_KEY, idToken);
    const res = await getMe();
    setUser(res.data);
  };

  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    window.google?.accounts.id.disableAutoSelect();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user?.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

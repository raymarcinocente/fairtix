"use client";
import { useEffect } from "react";
import { refreshAuth, useAuth } from "@/lib/auth-client";
import { refreshRecords, clearRecords } from "@/lib/customer-records";
export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  useEffect(() => {
    const sync = () => {
      clearRecords();
      void refreshAuth().then(refreshRecords);
    };
    void refreshAuth().then(refreshRecords);
    window.addEventListener("focus", sync);
    window.addEventListener("fairtix-account", sync);
    const channel = new BroadcastChannel("fairtix-session");
    channel.onmessage = sync;
    const broadcast = () => channel.postMessage("changed");
    window.addEventListener("fairtix-account", broadcast);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("fairtix-account", sync);
      window.removeEventListener("fairtix-account", broadcast);
      channel.close();
    };
  }, []);
  useEffect(() => {
    clearRecords();
    void refreshRecords();
  }, [user?.id, user?.wallet]);
  return children;
}

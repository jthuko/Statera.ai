import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { login } from "../api/endpoints";
type AuthCtx = { isAuthed:boolean; signIn:(e:string,p:string)=>Promise<void>; signOut:()=>void; };
const Ctx = createContext<AuthCtx|null>(null);
export function AuthProvider({ children }:{children:ReactNode}){
  const [isAuthed,setAuthed] = useState<boolean>(!!localStorage.getItem("accessToken"));
  async function signIn(email:string, password:string){ const tokens = await login(email,password); localStorage.setItem("accessToken", tokens.accessToken); setAuthed(true); }
  function signOut(){ localStorage.removeItem("accessToken"); setAuthed(false); }
  return <Ctx.Provider value={{isAuthed,signIn,signOut}}>{children}</Ctx.Provider>;
}
export function useAuth(){ const ctx = useContext(Ctx); if(!ctx) throw new Error("AuthProvider missing"); return ctx; }

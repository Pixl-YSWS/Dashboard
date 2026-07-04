import { redirect } from "next/navigation";
import { getSession, type AdminSession } from "./session";

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

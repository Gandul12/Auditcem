import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAuthenticated()) {
    redirect("/");
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#0D0F14] px-5 py-12 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,166,35,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(74,158,255,0.12),transparent_34%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/40 to-transparent" />
      <div className="relative z-10 w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  );
}

import Link from "next/link";
import { Building2, UserRound } from "lucide-react";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

export function StudentHeader({ email }: { email?: string | null }) {
  return <header className="flex h-[68px] items-center justify-between border-b border-[#e7ece8] bg-white px-5 sm:px-8">
    <Link href="/student/dashboard" className="flex items-center gap-2.5 font-semibold tracking-tight text-[#23332a]"><span className="grid size-8 place-items-center rounded-lg bg-[#167354] text-white"><Building2 size={17} /></span><span>pg<span className="text-[#167354]">manager</span></span></Link>
    <div className="flex items-center gap-3"><Link href="/student/profile" className="inline-flex max-w-[45vw] items-center gap-2 truncate text-sm text-[#526058] hover:text-[#167354]" aria-label={`Open profile for ${email ?? "resident"}`}><UserRound size={16} className="shrink-0" /><span className="hidden truncate sm:inline">{email ?? "My profile"}</span><span className="sm:hidden">My profile</span></Link><SignOutButton redirectTo="/student/login" /></div>
  </header>;
}

import Link from "next/link";
import { ArrowLeft, Building2, Check } from "lucide-react";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(400px,.9fr)_1.1fr]">
      <section className="flex min-h-screen flex-col px-6 py-6 sm:px-10 lg:px-14 lg:py-9">
        <Link href="/" className="inline-flex w-fit items-center gap-2.5 font-semibold tracking-tight text-[#23332a]">
          <span className="grid size-9 place-items-center rounded-xl bg-[#167354] text-white"><Building2 size={19} /></span><span className="text-[17px]">pg<span className="text-[#167354]">manager</span></span>
        </Link>
        <div className="mx-auto my-auto w-full max-w-[410px] py-12">{children}</div>
        <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm text-[#89948d] transition hover:text-[#425149]"><ArrowLeft size={16} /> Back to home</Link>
      </section>
      <aside className="relative hidden overflow-hidden bg-[#f4f8f4] px-12 py-14 lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -right-36 -top-32 size-[520px] rounded-full border border-[#dce9de]"/><div className="absolute -right-16 -top-12 size-[360px] rounded-full border border-[#e2ece3]"/><div className="absolute bottom-[-230px] left-[-120px] size-[500px] rounded-full bg-[#e8f2e7]"/>
        <div className="relative z-10 max-w-xl"><span className="inline-flex items-center gap-2 rounded-full border border-[#dce8dc] bg-white/70 px-3 py-1.5 text-xs font-medium text-[#557260]">A little more breathing room</span><h2 className="mt-7 text-4xl font-semibold leading-[1.13] tracking-[-.05em] text-[#1b3025] xl:text-5xl">The little details, taken care of.</h2><p className="mt-5 max-w-md text-base leading-7 text-[#68796e]">A thoughtful home runs on a hundred small details. Keep yours organized, without the paperwork pile-up.</p></div>
        <div className="relative z-10 mt-12 max-w-lg rounded-2xl border border-white/80 bg-white/75 p-6 shadow-[0_20px_70px_-45px_rgba(27,65,41,.25)] backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[.13em] text-[#809187]">Your workspace, your way</p>
          <ul className="mt-5 space-y-4">{["Keep property information in one place", "Make room and bed details easy to find", "Give your team a clearer daily workflow"].map((item) => <li key={item} className="flex items-center gap-3 text-base text-[#44554a]"><span className="grid size-5 place-items-center rounded-full bg-[#e7f3e9] text-[#28704c]"><Check size={12} /></span>{item}</li>)}</ul>
        </div>
        <div className="relative z-10 flex items-center justify-between text-sm text-[#849188]"><span>PG Manager · A better way to host</span><span>Secure owner access</span></div>
      </aside>
    </main>
  );
}

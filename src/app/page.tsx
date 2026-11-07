import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BedDouble, Building2, Check, ChevronRight, CircleCheck, ShieldCheck, Sparkles } from "lucide-react";

const highlights = [
  { icon: Building2, title: "Every property, one view", text: "Bring rooms, beds, people, and day-to-day operations into one clear workspace." },
  { icon: BedDouble, title: "Know what’s available", text: "See bed availability at a glance and keep occupancy records in order." },
  { icon: ShieldCheck, title: "Private by design", text: "Built for separate owner accounts, with secure access controls planned from day one." },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-white">
      <header className="mx-auto flex max-w-[1320px] items-center justify-between px-6 py-5 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight" aria-label="PG Manager home">
          <span className="grid size-9 place-items-center rounded-xl bg-[#167354] text-white"><Building2 size={19} strokeWidth={2.2} /></span>
          <span className="text-[17px]">pg<span className="text-[#167354]">manager</span></span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-[#526058] md:flex" aria-label="Main navigation">
          <a className="transition hover:text-[#167354]" href="#platform">Platform</a>
          <a className="transition hover:text-[#167354]" href="#how-it-works">How it works</a>
          <a className="transition hover:text-[#167354]" href="#security">Security</a>
        </nav>
        <div className="flex items-center gap-2.5">
          <Link href="/login" className="hidden rounded-lg px-4 py-2.5 text-sm font-medium text-[#425149] transition hover:bg-[#f4f7f5] sm:inline-flex">Log in</Link>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-[#167354] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#105a41]">Get started <ArrowRight size={15} /></Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1320px] items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pb-28 lg:pt-20">
        <div className="relative z-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#dce9e1] bg-[#f7faf7] px-3.5 py-2 text-xs font-medium text-[#466454]"><Sparkles size={14} className="text-[#167354]" /> A more thoughtful way to manage your PG</div>
          <h1 className="max-w-[660px] text-[clamp(3rem,6.6vw,5.7rem)] font-semibold leading-[1.02] tracking-[-.065em] text-[#17241f]">Make room for <span className="text-[#167354]">better</span> living.</h1>
          <p className="mt-7 max-w-[510px] text-lg leading-8 text-[#64736a]">The calm, clear workspace for managing paying guest homes, hostels, and co-living spaces — all in one place.</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-[#167354] px-5 py-3.5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(22,115,84,.18)] transition hover:-translate-y-0.5 hover:bg-[#105a41]">Create your workspace <ArrowRight size={16} /></Link>
            <Link href="/login" className="rounded-lg border border-[#dce4de] px-5 py-3.5 text-sm font-medium text-[#425149] transition hover:bg-[#f7faf7]">Sign in</Link>
          </div>
          <div className="mt-8 flex items-center gap-2 text-xs text-[#77837c]"><CircleCheck size={15} className="text-[#167354]" /> Built for independent PG owners and growing teams</div>
        </div>

        <div className="relative mx-auto w-full max-w-[580px]" aria-label="Product interface preview">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#e6f4eb] blur-3xl" />
          <div className="absolute -bottom-12 -left-8 h-44 w-44 rounded-full bg-[#f0f3db] blur-3xl" />
          <div className="relative rounded-[20px] border border-[#e5ebe6] bg-white p-3 shadow-[0_30px_90px_-40px_rgba(28,66,47,.3)] sm:p-5">
            <div className="flex items-center justify-between border-b border-[#edf0ed] px-2 pb-4">
              <div><p className="text-[10px] font-medium uppercase tracking-[.13em] text-[#859188]">Workspace preview</p><p className="mt-1 text-sm font-semibold text-[#25342c]">Your properties</p></div>
              <span className="flex items-center gap-1.5 rounded-full bg-[#eff7f1] px-2.5 py-1 text-[10px] font-medium text-[#26714f]"><span className="size-1.5 rounded-full bg-[#38a16b]" /> Preview</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#edf0ed] bg-[#fbfcfb] p-4"><div className="flex items-center justify-between text-[#88938c]"><span className="text-xs">Properties</span><Building2 size={15} /></div><div className="mt-5 h-2 w-20 rounded bg-[#dfe8e1]" /><div className="mt-2 h-2 w-12 rounded bg-[#eef1ee]" /></div>
              <div className="rounded-xl border border-[#edf0ed] bg-[#fbfcfb] p-4"><div className="flex items-center justify-between text-[#88938c]"><span className="text-xs">Bed overview</span><BedDouble size={15} /></div><div className="mt-4 flex gap-1.5">{[1, 2, 3, 4, 5, 6].map((item) => <span key={item} className={`h-7 flex-1 rounded-md ${item === 3 ? "bg-[#e6e9e5]" : "bg-[#d6eee0]"}`} />)}</div><div className="mt-2 flex gap-1.5">{[1, 2, 3, 4, 5, 6].map((item) => <span key={item} className={`h-7 flex-1 rounded-md ${item === 5 ? "bg-[#e6e9e5]" : "bg-[#d6eee0]"}`} />)}</div></div>
            </div>
            <div className="mt-3 rounded-xl border border-[#edf0ed] p-4">
              <div className="flex items-center justify-between"><span className="text-xs font-medium text-[#44534a]">A simpler daily rhythm</span><ChevronRight size={15} className="text-[#91a097]" /></div>
              <div className="mt-4 space-y-3">{["Keep property details together", "Track room and bed availability", "Welcome residents with confidence"].map((item, index) => <div key={item} className="flex items-center gap-3"><span className="grid size-6 place-items-center rounded-full bg-[#eff7f1] text-[#26714f]"><Check size={12} /></span><span className="h-2 w-[60%] rounded bg-[#eef1ee]"/><span className="ml-auto text-[10px] text-[#9aa39d]">0{index + 1}</span></div>)}</div>
            </div>
            <p className="px-1 pt-3 text-[10px] text-[#929c95]">Illustrative preview · your workspace starts with your data</p>
          </div>
          <div className="absolute -left-7 top-[42%] hidden items-center gap-3 rounded-xl border border-[#e8ede8] bg-white p-3 shadow-[0_12px_34px_-18px_rgba(0,0,0,.24)] sm:flex"><span className="grid size-9 place-items-center rounded-lg bg-[#eff7f1] text-[#167354]"><ArrowUpRight size={17} /></span><div><p className="text-xs font-semibold text-[#25342c]">Less admin, more care</p><p className="mt-0.5 text-[10px] text-[#7b8980]">One thoughtful system</p></div></div>
        </div>
      </section>

      <section id="platform" className="border-y border-[#edf0ed] bg-[#fbfcfb]">
        <div className="mx-auto max-w-[1320px] px-6 py-16 lg:px-10 lg:py-20">
          <div className="max-w-xl"><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#167354]">Made for the details that matter</p><h2 className="mt-4 text-3xl font-semibold tracking-[-.04em] text-[#17241f] sm:text-4xl">Good operations make a better home.</h2><p className="mt-4 leading-7 text-[#69776f]">Spend less time chasing spreadsheets and more time building a place residents are glad to come home to.</p></div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">{highlights.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-[#e8ede8] bg-white p-6"><span className="grid size-10 place-items-center rounded-xl bg-[#eff7f1] text-[#167354]"><Icon size={19} /></span><h3 className="mt-5 text-base font-semibold text-[#24332b]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#718078]">{text}</p></article>)}</div>
        </div>
      </section>
      <section id="how-it-works" className="mx-auto flex max-w-[1320px] flex-col gap-6 px-6 py-14 text-sm text-[#77837c] sm:flex-row sm:items-center sm:justify-between lg:px-10"><p>Thoughtful software for the people who make a place feel like home.</p><div id="security" className="flex items-center gap-2"><ShieldCheck size={16} className="text-[#167354]" /> Your data stays yours <ArrowDownRight size={14} /></div></section>
    </main>
  );
}

import Link from "next/link";
import {
  Bell,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  FileSignature,
  LayoutDashboard,
  Megaphone,
  ReceiptText,
  Utensils,
  Users,
} from "lucide-react";

const sections = [
  {
    title: "Workspace",
    items: [
      { label: "Overview", view: "overview", icon: LayoutDashboard },
      { label: "Properties", view: "properties", icon: Building2 },
      { label: "Floors, rooms & beds", view: "layout", icon: ClipboardList },
      { label: "Residents", view: "residents", icon: Users },
      { label: "Rental agreements", view: "agreements", icon: FileSignature },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Payments", view: "payments", icon: CreditCard },
      { label: "Invoices", view: "invoices", icon: FileText },
      { label: "Expenses", view: "expenses", icon: ReceiptText },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Maintenance tickets", view: "tickets", icon: ClipboardList },
      { label: "Notice requests", view: "notices", icon: Bell },
      { label: "Announcements", view: "announcements", icon: Megaphone },
      { label: "Food menu", view: "meals", icon: Utensils },
    ],
  },
];

export function OwnerSidebar({ openTicketCount = 0, pendingNoticeCount = 0 }: { openTicketCount?: number; pendingNoticeCount?: number }) {
  return (
    <aside className="w-full shrink-0 border-b border-[#e7ece8] bg-white lg:sticky lg:top-0 lg:h-[calc(100vh-68px)] lg:w-[250px] lg:border-b-0 lg:border-r">
      <nav aria-label="Owner dashboard sections" className="space-y-5 overflow-x-auto px-4 py-4 lg:overflow-visible lg:px-4 lg:py-7">
        {sections.map((section) => (
          <div key={section.title} className="lg:space-y-1">
            <h2 className="hidden px-3 pb-2 text-[11px] font-semibold uppercase tracking-[.13em] text-[#9aa49d] lg:block">{section.title}</h2>
            <div className="flex min-w-max gap-1 lg:flex-col lg:min-w-0">
              {section.items.map(({ label, view, icon: Icon }) => (
                <Link
                  key={view}
                  href={`/dashboard?section=${view}`}
                  className="inline-flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#526058] transition hover:bg-[#eff7f1] hover:text-[#167354] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#167354]"
                >
                  <Icon size={17} className="shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">{label}</span>
                  {view === "tickets" && openTicketCount > 0 && <span aria-label={`${openTicketCount} open tickets`} className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-[#dff2e7] px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[#126345]">{openTicketCount > 99 ? "99+" : openTicketCount}</span>}
                  {view === "notices" && pendingNoticeCount > 0 && <span aria-label={`${pendingNoticeCount} pending notice requests`} className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-[#fff0d4] px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[#805d18]">{pendingNoticeCount > 99 ? "99+" : pendingNoticeCount}</span>}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

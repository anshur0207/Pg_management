"use client";

import { useState } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { PropertyCreateForm } from "@/components/dashboard/property-create-form";

export function PropertyCreateDisclosure({ ownerId }: { ownerId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-5">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="new-property-form"
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex items-center gap-2 rounded-lg bg-[#167354] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#105a41] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#167354]/20"
      >
        <Building2 size={17} />
        New property — Add here
        <ChevronDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && <div id="new-property-form" className="mt-4"><PropertyCreateForm ownerId={ownerId} /></div>}
    </div>
  );
}

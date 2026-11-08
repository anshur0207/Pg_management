"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type PropertyOption = { id: string; name: string };
type WeeklyMenu = { id: string; property_id: string; day_of_week: number; meal_type: string; week_of_month: number; items: string[] };
type MealType = "breakfast" | "lunch" | "dinner";

const days = [
  { number: 1, name: "Monday" },
  { number: 2, name: "Tuesday" },
  { number: 3, name: "Wednesday" },
  { number: 4, name: "Thursday" },
  { number: 5, name: "Friday" },
  { number: 6, name: "Saturday" },
  { number: 7, name: "Sunday" },
] as const;
const meals: MealType[] = ["breakfast", "lunch", "dinner"];
const sweetWeeks = [1, 2, 3, 4, 5] as const;
type Schedule = Record<string, string>;

function makeSchedule(menus: WeeklyMenu[], propertyId: string): Schedule {
  const schedule: Schedule = {};
  for (const menu of menus) {
    if (menu.property_id !== propertyId) continue;
    schedule[`${menu.day_of_week}:${menu.meal_type}:${menu.week_of_month}`] = menu.items.join("\n");
  }
  return schedule;
}

export function OwnerMealMenuManager({ properties, menus, ownerId, userId }: { properties: PropertyOption[]; menus: WeeklyMenu[]; ownerId: string; userId: string }) {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [values, setValues] = useState<Schedule>(() => makeSchedule(menus, properties[0]?.id ?? ""));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  function updateProperty(nextPropertyId: string) {
    setPropertyId(nextPropertyId);
    setValues(makeSchedule(menus, nextPropertyId));
  }

  async function saveMenu(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!propertyId) return;
    setSaving(true);
    setNotice(null);
    const rows = days.flatMap((day) => [
      ...meals.map((meal) => ({
        owner_id: ownerId,
        property_id: propertyId,
        day_of_week: day.number,
        meal_type: meal,
        week_of_month: 0,
        items: (values[`${day.number}:${meal}:0`] ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
        updated_by: userId,
      })),
      ...(day.number === 7 ? sweetWeeks.map((week) => ({
        owner_id: ownerId,
        property_id: propertyId,
        day_of_week: 7,
        meal_type: "sweets",
        week_of_month: week,
        items: (values[`7:sweets:${week}`] ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
        updated_by: userId,
      })) : []),
    ]);
    const { error } = await createClient().from("weekly_meal_menus").upsert(rows, { onConflict: "property_id,day_of_week,meal_type,week_of_month" });
    if (error) setNotice({ kind: "error", text: error.message });
    else {
      setNotice({ kind: "success", text: `Weekly breakfast, lunch, dinner, and Sunday sweets saved for ${properties.find((property) => property.id === propertyId)?.name ?? "this PG"}.` });
      router.refresh();
    }
    setSaving(false);
  }

  const inputClass = "w-full min-w-[145px] resize-y rounded-md border border-[#dfe6e1] bg-white px-2.5 py-2 text-sm leading-5 text-[#203028] outline-none focus:border-[#63a888] focus:ring-2 focus:ring-[#167354]/[.12]";

  return <section className="space-y-5">
    {properties.length === 0 ? <p className="rounded-lg bg-[#f7faf7] px-4 py-4 text-sm text-[#718078]">Add a property before creating meal menus.</p> : <>
      <label className="block max-w-md text-sm font-medium text-[#38473e]">PG / property<select value={propertyId} onChange={(event) => updateProperty(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#dfe6e1] bg-white px-3.5 py-3 text-sm text-[#203028] outline-none focus:border-[#63a888]">{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
      <form onSubmit={saveMenu}>
        <div className="overflow-x-auto rounded-xl border border-[#dfe6e1]">
          <table className="w-full min-w-[920px] table-fixed border-collapse text-center text-sm">
            <thead className="bg-[#f7faf7]"><tr><th className="w-32 border-b border-r border-[#dfe6e1] px-3 py-3 text-left font-semibold text-[#34443a]">Day</th>{meals.map((meal) => <th key={meal} className="border-b border-r border-[#dfe6e1] px-3 py-3 font-semibold capitalize text-[#34443a]">{meal}</th>)}</tr></thead>
            <tbody>{days.map((day) => <tr key={day.number} className="align-top"><th scope="row" className="border-b border-r border-[#edf0ed] bg-[#fbfcfb] px-3 py-3 text-left font-semibold text-[#34443a]">{day.name}</th>{meals.map((meal) => <td key={meal} className="border-b border-r border-[#edf0ed] p-2"><textarea aria-label={`${day.name} ${meal}`} rows={3} value={values[`${day.number}:${meal}:0`] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [`${day.number}:${meal}:0`]: event.target.value }))} className={inputClass} placeholder="Enter dishes, one per line" /></td>)}</tr>)}</tbody>
          </table>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-[#dfe6e1]">
          <table className="w-full min-w-[580px] border-collapse text-left text-sm">
            <thead className="bg-[#f7faf7]"><tr><th className="w-36 border-b border-r border-[#dfe6e1] px-3 py-3 font-semibold text-[#34443a]">Sunday</th><th className="border-b border-[#dfe6e1] px-3 py-3 font-semibold text-[#34443a]">Sweet</th></tr></thead>
            <tbody>{sweetWeeks.map((week) => <tr key={week}><th scope="row" className="border-b border-r border-[#edf0ed] px-3 py-2.5 font-medium text-[#526058]">{week}{week === 1 ? "st" : week === 2 ? "nd" : week === 3 ? "rd" : "th"} Sunday</th><td className="border-b border-[#edf0ed] p-2"><textarea aria-label={`${week} Sunday sweet`} rows={1} value={values[`7:sweets:${week}`] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [`7:sweets:${week}`]: event.target.value }))} className={inputClass} placeholder="e.g. Gulab Jamun" /></td></tr>)}</tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3"><Button type="submit" disabled={saving || !propertyId} className="py-2.5">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}Save weekly menu</Button><span className="text-xs text-[#89948d]">Students see the menu for the current day; Sunday sweets follow the week of the month.</span></div>
        {notice && <p role="status" className={`mt-4 rounded-lg border px-4 py-3 text-sm ${notice.kind === "success" ? "border-[#cfe7d7] bg-[#f2faf4] text-[#286344]" : "border-[#f0d7d4] bg-[#fff7f6] text-[#9b413c]"}`}>{notice.text}</p>}
      </form>
      <div className="flex items-start gap-2 text-xs leading-5 text-[#89948d]"><Utensils size={14} className="mt-0.5 shrink-0 text-[#167354]" /><p>Use one dish per line. The weekly schedule repeats until the owner updates it.</p></div>
    </>}
  </section>;
}

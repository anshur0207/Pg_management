type RentalAgreementDocumentProps = { terms: string };

const isHeading = (line: string) => /^(?:\d+\.\s*)?[A-Z][A-Z0-9 &'()/–—-]*$/.test(line);

export function RentalAgreementDocument({ terms }: RentalAgreementDocumentProps) {
  const lines = terms.split("\n");
  const title = lines[0]?.replace(/^#+\s*/, "") || "RENTAL AGREEMENT";
  const subtitle = lines[1]?.replace(/^#+\s*/, "");

  return (
    <article className="mx-auto w-full max-w-3xl border-[7px] border-[#079ee5] bg-white p-1.5 shadow-sm sm:border-[9px] sm:p-2" aria-label="Rental agreement document">
      <div className="border border-[#e7edf1] px-5 py-7 text-[#171717] sm:px-10 sm:py-10">
        <header className="mb-8 text-center font-serif">
          <h1 className="text-3xl font-bold tracking-wide sm:text-4xl">{title}</h1>
          {subtitle && <h2 className="mt-2 text-base font-bold uppercase tracking-wide sm:text-lg">{subtitle}</h2>}
        </header>
        <div className="space-y-3 font-serif text-sm leading-6 sm:text-[15px] sm:leading-7">
          {lines.slice(2).map((rawLine, index) => {
            const line = rawLine.replace(/^\s*#+\s*/, "").replace(/\*\*/g, "").trim();
            if (!line || /^---+$/.test(line)) return null;
            const key = `${index}-${line}`;
            if (isHeading(line)) {
              return <h3 key={key} className="pt-1 font-sans text-sm font-bold uppercase underline decoration-1 underline-offset-2">{line}</h3>;
            }
            const numberedClause = line.match(/^(\d+)\.\s+(.+)$/);
            if (numberedClause) {
              return <p key={key} className="flex gap-2 pl-1"><span className="shrink-0">{numberedClause[1]}.</span><span>{numberedClause[2]}</span></p>;
            }
            const bulletClause = line.replace(/^[-•]\s*/, "");
            const field = bulletClause.match(/^([^:]+):\s*(.*)$/);
            if (field) {
              return <p key={key} className="pl-1"><strong>{field[1]}:</strong>{field[2] ? ` ${field[2]}` : ""}</p>;
            }
            return <p key={key} className="pl-1">{bulletClause}</p>;
          })}
        </div>
      </div>
    </article>
  );
}

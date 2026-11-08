"use client";

import { useRef, useState } from "react";
import { BedDouble, ChevronLeft, ChevronRight } from "lucide-react";

type PropertyImageCarouselProps = {
  images: string[];
  label: string;
  className?: string;
};

export function PropertyImageCarousel({ images, label, className = "" }: PropertyImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const imageCount = images.length;

  function showPrevious() {
    setActiveIndex((current) => (current - 1 + imageCount) % imageCount);
  }

  function showNext() {
    setActiveIndex((current) => (current + 1) % imageCount);
  }

  function finishTouch(clientX: number) {
    if (touchStartX.current === null) return;
    const distance = clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 40 || imageCount < 2) return;
    if (distance > 0) showPrevious();
    else showNext();
  }

  return (
    <div className={`group relative overflow-hidden bg-[#eff4ef] ${className}`} aria-label={`${label} photo gallery`} onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const clientX = event.changedTouches[0]?.clientX; if (clientX !== undefined) finishTouch(clientX); }}>
      {imageCount ? (
        <>
          <img src={images[activeIndex]} alt={`${label} photo ${activeIndex + 1} of ${imageCount}`} className="h-full w-full object-cover" />
          {imageCount > 1 && <>
            <button type="button" onClick={showPrevious} aria-label="Previous photo" className="absolute left-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#24332b] shadow transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167354]">
              <ChevronLeft size={20} />
            </button>
            <button type="button" onClick={showNext} aria-label="Next photo" className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#24332b] shadow transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167354]">
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-3 right-3 rounded-full bg-[#17241f]/75 px-2.5 py-1 text-xs font-medium text-white" aria-live="polite">{activeIndex + 1} / {imageCount}</div>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.map((image, index) => <button key={`${index}-${image}`} type="button" onClick={() => setActiveIndex(index)} aria-label={`Show photo ${index + 1}`} aria-current={index === activeIndex} className={`size-2 rounded-full transition ${index === activeIndex ? "bg-white ring-1 ring-[#24332b]/40" : "bg-white/60 hover:bg-white"}`} />)}
            </div>
          </>}
        </>
      ) : <div className="grid h-full place-items-center text-[#a8b7ac]"><div className="text-center"><BedDouble size={34} strokeWidth={1.4} className="mx-auto" /><p className="mt-2 text-xs">Photos coming soon</p></div></div>}
    </div>
  );
}

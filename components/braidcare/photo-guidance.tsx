// PRD FR-CARE-02.2 — lighting / angle / distance guidance before capture.
const TIPS = [
  {
    title: "Good light",
    body: "Face a window or bright light. Avoid shadows falling across your scalp.",
  },
  {
    title: "Part the hair",
    body: "Part along the areas you want checked — hairline, parting lines, crown, nape.",
  },
  {
    title: "Close, but steady",
    body: "Hold the camera 15–20 cm away. Get the scalp in focus, not the braids.",
  },
  {
    title: "A few angles",
    body: "2–4 photos of different areas gives the best read. Up to 6.",
  },
];

export function PhotoGuidance() {
  return (
    <div className="rounded-lg border border-mist bg-white p-5">
      <h2 className="font-display text-lg text-plum">Taking good photos</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {TIPS.map((t) => (
          <li key={t.title} className="flex gap-2.5">
            <span
              aria-hidden
              className="bg-teal/10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs text-teal-deep"
            >
              ✓
            </span>
            <span>
              <span className="block text-sm font-medium text-plum">{t.title}</span>
              <span className="block text-sm text-slate">{t.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

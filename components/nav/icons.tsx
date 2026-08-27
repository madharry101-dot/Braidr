// Minimal inline icon set (24px, currentColor, 1.6 stroke). Keeps the bundle
// free of an icon dependency for the handful the nav needs.
type P = React.SVGProps<SVGSVGElement>;

function icon(name: string, path: React.ReactNode) {
  const Icon = (props: P) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-6 w-6"
      {...props}
    >
      {path}
    </svg>
  );
  Icon.displayName = name;
  return Icon;
}

export const HomeIcon = icon(
  "HomeIcon",
  <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H4a1 1 0 0 1-1-1Z" />
);
export const SearchIcon = icon(
  "SearchIcon",
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>
);
export const CalendarIcon = icon(
  "CalendarIcon",
  <>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v3M16 3v3" />
  </>
);
export const HeartPulseIcon = icon(
  "HeartPulseIcon",
  <>
    <path d="M12 20s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-.4.8-1 1.6-1.7 2.4" />
    <path d="M3 13h4l2-3 2 5 2-4 1 2h5" />
  </>
);
export const UserIcon = icon(
  "UserIcon",
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
  </>
);
export const BriefcaseIcon = icon(
  "BriefcaseIcon",
  <>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
  </>
);
export const ShieldIcon = icon("ShieldIcon", <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6Z" />);
export const UsersIcon = icon(
  "UsersIcon",
  <>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c1-3.5 3.6-5 6.5-5s5.5 1.5 6.5 5" />
    <path d="M16 5.5a3.5 3.5 0 0 1 0 7M18 20c-.4-1.6-1-3-2-4" />
  </>
);

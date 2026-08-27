import type { Role } from "@/types/database";
import {
  HomeIcon,
  SearchIcon,
  CalendarIcon,
  HeartPulseIcon,
  UserIcon,
  BriefcaseIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/nav/icons";

export type NavItem = {
  href: string;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement;
};

// PRD 6.3 mobile tab bar is client-centric (Home, Search, Bookings,
// BraidCare, Account). Braider/expert/admin get role-appropriate sets —
// same 5-slot ceiling so the bottom bar stays within touch spacing rules.
const CLIENT: NavItem[] = [
  { href: "/dashboard/client", label: "Home", icon: HomeIcon },
  { href: "/braiders", label: "Search", icon: SearchIcon },
  { href: "/bookings", label: "Bookings", icon: CalendarIcon },
  { href: "/braidcare", label: "BraidCare", icon: HeartPulseIcon },
  { href: "/account", label: "Account", icon: UserIcon },
];

const BRAIDER: NavItem[] = [
  { href: "/dashboard/braider", label: "Home", icon: HomeIcon },
  { href: "/dashboard/braider/bookings", label: "Bookings", icon: CalendarIcon },
  { href: "/dashboard/braider/profile", label: "Profile", icon: BriefcaseIcon },
  { href: "/dashboard/braider/pro", label: "Pro", icon: HeartPulseIcon },
  { href: "/account", label: "Account", icon: UserIcon },
];

const EXPERT: NavItem[] = [
  { href: "/dashboard/expert", label: "Home", icon: HomeIcon },
  { href: "/dashboard/expert/referrals", label: "Referrals", icon: UsersIcon },
  { href: "/account", label: "Account", icon: UserIcon },
];

const ADMIN: NavItem[] = [
  { href: "/admin", label: "Overview", icon: ShieldIcon },
  { href: "/admin/verification", label: "Verify", icon: BriefcaseIcon },
  { href: "/admin/disputes", label: "Disputes", icon: CalendarIcon },
  { href: "/admin/users", label: "Users", icon: UsersIcon },
];

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  client: CLIENT,
  braider: BRAIDER,
  expert: EXPERT,
  admin: ADMIN,
};

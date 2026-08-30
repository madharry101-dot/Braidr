/*
 * ────────────────────────────────────────────────────────────────
 * APPROVED HOMEPAGE COPY — Phase 1, locked.
 *
 * Every string below has been through an ASA/CAP Code compliance pass.
 * Do not paraphrase, shorten, or "improve" any of it. If a component
 * cannot fit a string, raise it rather than rewording — a truncation is
 * a design bug, not a licence to rewrite an approved claim.
 *
 * Verification is described as Braidr health and safety verification,
 * never as physical or face-to-face inspection. Scalp analysis is a
 * methodology claim ("dermatology-trained"), never an endorsement claim.
 * ────────────────────────────────────────────────────────────────
 */

export const ROUTES = {
  braiders: "/braiders",
  registerBraider: "/register?role=braider",
  register: "/register",
  login: "/login",
  braidcare: "/braidcare",
  privacy: "/privacy",
  terms: "/terms",
} as const;

export const HOME_COPY = {
  hero: {
    eyebrow: "A standard for UK braiding",
    // The middle fragment is the single gold word in the headline.
    headline: [
      "Verified braiders. Monitored scalp health. Payment that stays ",
      "yours",
      " until you’re done.",
    ] as const,
    sub: "Every braider on Braidr completes health and safety verification before accepting a booking — workspace, products, and hair-condition disclosure all checked. Three scalp health check-ins are included with every appointment. Your payment is held until twenty-four hours after you leave the chair.",
    primaryCta: "Browse verified braiders",
    secondaryCta: "List your services",
  },

  // Trust strip — four statements, in this order.
  proof: [
    "Every braider Braidr-verified",
    "3 scalp check-ins with every booking",
    "Payment held 24 hours after your appointment",
    "Products and conditions disclosed before booking",
  ],

  clients: {
    label: "Braidr for clients",
    heading: "Everything you couldn’t verify before booking",
    sub: "Three risks have always sat with the client: who you’re booking, what the style is doing to your scalp, and whether your money is safe. Braidr takes on all three.",
    benefits: [
      {
        icon: "Search",
        title: "Choose on evidence, not reputation",
        body: "You see a braider’s portfolio, pricing, specialities, and full verification record before you make contact. No extended messaging to establish whether they offer the style you want.",
      },
      {
        icon: "Leaf",
        title: "Scalp health, monitored properly",
        body: "You have probably had an install that felt too tight and decided it would settle. Three photo check-ins across every booking record whether it did, and raise it early if it didn’t.",
      },
      {
        icon: "Lock",
        title: "Your payment stays yours",
        body: "You pay through Braidr and the money is held, not forwarded. It releases twenty-four hours after your appointment, once you have seen the finished style and lived with it for a day.",
      },
    ],
    imageNote: "Client mid-appointment, braider’s hands in frame, warm interior light, unposed",
  },

  braidcare: {
    label: "Scalp health",
    heading: "Tension damage rarely announces itself",
    // The approved copy is a single block. It is split here at sentence
    // boundaries only, to match the approved three-paragraph layout —
    // not a word is changed, added or removed.
    body: [
      "Most people know the signs. A scalp that stays tender for the first few days, a hairline that takes a little longer to recover than it used to. Usually it settles and everything is fine — occasionally it doesn’t, and by the time it is visible in the mirror it has been developing for months.",
      "BraidCare gives you three guided photo check-ins with every booking: before your appointment, midway through the style, and before takedown. Each session is read using dermatology-trained analysis.",
      "Where a session suggests a specialist is worth seeing, BraidCare tells you plainly and connects you to a dermatologist who understands braided hair. Without a booking, BraidCare is £7.99 a month for unlimited sessions.",
    ],
    // Mandatory, verbatim, every time BraidCare is discussed anywhere in
    // the product. Do not drop it from any BraidCare surface.
    closer: "BraidCare doesn’t replace your dermatologist. It makes sure you know when to see one.",
    cta: "See how BraidCare works",
    imageNote: "Phone held to a parted section of scalp, guided camera overlay visible",
    sessions: [
      { number: "1", title: "Before your appointment", status: "Completed" },
      { number: "2", title: "Midway through the style", status: "Open now" },
      { number: "3", title: "Before takedown", status: "Opens later" },
    ],
    sessionsHeading: "Your sessions",
    sessionsChip: "Included with your booking",
  },

  dark: {
    label: "Why the braiding community trusts Braidr",
    heading: "Three standards this industry has never had",
    sub: "Braiders verified against Braidr’s health and safety standards. Scalp health monitored across every style. Payment that stays yours until the appointment is done.",
    cards: [
      {
        icon: "Shield",
        title: "Verified braiders",
        body: "Workspace standards, product disclosure, and hair-condition declarations are all reviewed against Braidr’s health and safety standards before a braider accepts a single booking. Braiders who have not completed verification are not listed.",
      },
      {
        icon: "Leaf",
        title: "BraidCare monitoring",
        body: "Three scalp check-ins included with every booking. Dermatology-trained analysis, and plain language when something warrants a closer look.",
      },
      {
        icon: "Lock",
        title: "Payment held until satisfied",
        body: "Your payment releases twenty-four hours after your appointment. Not at booking. Not the moment you leave the chair. A day later, once you have lived with the result.",
      },
    ],
    cta: "Browse verified braiders",
  },

  braiders: {
    label: "Braidr for braiders",
    heading: "Braiding is a business. Braidr gives you the paperwork to prove it.",
    body: "Verification your clients can see, a booking system that replaces the back-and-forth in your messages, and Braidr Pro to take you through HMRC registration, insurance, and a business account across five structured steps.",
    cta: "List your services",
    imageNote:
      "Braider in their own workspace, chair and station visible, looking directly at camera",
  },

  footer: {
    tagline: "Built for an industry that built itself.",
    support: "Braiding has always been skilled work. Now it has infrastructure.",
    links: [
      { label: "Book a braider", href: ROUTES.braiders },
      { label: "List your services", href: ROUTES.registerBraider },
      { label: "BraidCare", href: ROUTES.braidcare },
      // No public Braidr Pro page exists yet — the approved Pro copy is
      // held for a future client-facing page. Until that ships, the link
      // points at the braider doorway rather than a role-gated dashboard.
      { label: "Braidr Pro", href: ROUTES.registerBraider },
      { label: "Privacy", href: ROUTES.privacy },
      { label: "Terms", href: ROUTES.terms },
    ],
  },
} as const;

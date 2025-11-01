import * as React from "react";

export function RaceTimerProLogo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="hsl(var(--primary))" />
      <path d="M2 17l10 5 10-5" stroke="hsl(var(--accent))" />
      <path d="M2 12l10 5 10-5" stroke="hsl(var(--accent))" strokeOpacity="0.6" />
      <circle cx="12" cy="12" r="3" fill="hsl(var(--sidebar-foreground))" />
    </svg>
  );
}

// The otterfund wordmark.
//
// Renders the brand name in its signature face (Space Grotesk) so "otterfund"
// reads as a wordmark everywhere it appears, standalone or inline in a
// sentence. It inherits font-size and color from context, so it drops into a
// footer, a heading, or running copy without extra styling. Use this anywhere
// the brand name is shown to a user, in place of the literal text "otterfund".

import { cn } from "@/lib/utils";

export function Wordmark({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={cn("of-wordmark", className)} style={style}>
      otterfund
    </span>
  );
}

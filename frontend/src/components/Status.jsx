import { Circle, Info, MinusCircle, Warning, WarningOctagon } from "@phosphor-icons/react";

// Status is never colour alone: each tone has a colour, a shape and a word.
const STATUS_MAP = {
  good: { Icon: Circle, weight: "fill" },
  warning: { Icon: Warning },
  critical: { Icon: WarningOctagon },
  info: { Icon: Info },
  muted: { Icon: MinusCircle },
};

export default function Status({ tone, children }) {
  const { Icon, weight = "regular" } = STATUS_MAP[tone];
  return (
    <span className={`status status-${tone}`}>
      <Icon size={16} weight={weight} aria-hidden />
      {children}
    </span>
  );
}

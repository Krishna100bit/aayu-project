import { Children, cloneElement, isValidElement, type HTMLAttributes, type ReactElement } from "react";
import { cn } from "@/lib/utils";

/** Minimal Slot: merges props/className onto its single child (avoids a Radix dependency for now). */
export function Slot({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  const child = Children.only(children);
  if (!isValidElement(child)) return null;
  const el = child as ReactElement<HTMLAttributes<HTMLElement>>;
  return cloneElement(el, { ...props, ...el.props, className: cn(className, el.props.className) });
}

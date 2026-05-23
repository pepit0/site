import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate, type LinkProps } from "react-router-dom";

type PageSlideLinkProps = Omit<LinkProps, "to"> & {
  to: string;
  children: ReactNode;
};

/** Navigate with a horizontal slide when the browser supports View Transitions. */
export function PageSlideLink({ to, children, onClick, ...rest }: PageSlideLinkProps) {
  const navigate = useNavigate();

  return (
    <Link
      to={to}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        e.preventDefault();
        const go = () => {
          navigate(to);
        };

        const doc = document as Document & {
          startViewTransition?: (callback: () => void | Promise<void>) => { finished: Promise<void> };
        };
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (typeof doc.startViewTransition === "function" && !prefersReducedMotion) {
          doc.startViewTransition(() => {
            flushSync(() => {
              go();
            });
          });
        } else {
          go();
        }
      }}
    >
      {children}
    </Link>
  );
}

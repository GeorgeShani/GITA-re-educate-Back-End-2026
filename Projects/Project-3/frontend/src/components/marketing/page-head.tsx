import type { CSSProperties, ReactNode } from "react";
import { cssVars } from "@/lib/css-vars";

/** The top of an inner page: a condensed headline that rises out of its mask, and the line that says what the page is. */
export function PageHead({
  title,
  children,
  actions,
}: {
  /** One entry per printed line, so the lines can rise one after another. */
  title: readonly string[];
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-6 py-14 lg:py-20">
        <h1 className="headline max-w-4xl text-[3rem] leading-[0.92] sm:text-[4.5rem] lg:text-[5.25rem]">
          {title.map((line, index) => {
            const style: CSSProperties = cssVars({
              "--line-delay": `${index * 110}ms`,
            });
            return (
              <span key={line} className="line-mask">
                <span className="line-rise" style={style}>
                  {line}
                </span>
              </span>
            );
          })}
        </h1>
        <div className="copy max-w-2xl text-text-muted">{children}</div>
        {actions ? (
          <div className="flex flex-wrap gap-2.5">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}

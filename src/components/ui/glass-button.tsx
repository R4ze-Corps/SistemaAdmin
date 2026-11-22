"use client";

import { type ComponentProps, type ReactNode, useRef } from "react";
import { GlassSurface, type GlassSurfaceHandle } from "@/components/ui/glass";
import { Track, glide, easeGel, easeSoft, PRESS, RELEASE } from "@/components/ui/glass-motion";

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

interface GlassButtonProps extends ComponentProps<"button"> {
  /** Frosted tint from 0 to 1. */
  tint?: number;
  /** Icon disc or text capsule. */
  variant?: "icon" | "capsule";
  children?: ReactNode;
}

export function GlassButton({
  tint = 0.4,
  variant = "icon",
  children,
  className,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  ...props
}: GlassButtonProps) {
  const surface = useRef<GlassSurfaceHandle | null>(null);
  const scaleEl = useRef<HTMLSpanElement | null>(null);
  const scale = useRef(new Track(1));
  const isIcon = variant === "icon";

  const press = () => {
    scale.current.watch((value) => {
      if (scaleEl.current) scaleEl.current.style.scale = String(value);
    });
    surface.current?.setTintLift(-0.14);
    glide(scale.current, 0.92, PRESS, easeGel);
  };

  const release = () => {
    surface.current?.setTintLift(0);
    glide(scale.current, 1, RELEASE, easeSoft);
  };

  return (
    <button
      type="button"
      className={cn(
        "relative select-none outline-none transition-[filter] focus-visible:brightness-110",
        isIcon ? "rounded-full" : "rounded-2xl",
        className,
      )}
      onPointerDown={(event) => { press(); onPointerDown?.(event); }}
      onPointerUp={(event) => { release(); onPointerUp?.(event); }}
      onPointerLeave={(event) => { release(); onPointerLeave?.(event); }}
      onPointerCancel={(event) => { release(); onPointerCancel?.(event); }}
      {...props}
    >
      <span ref={scaleEl} className="block origin-center" style={{ scale: "1" }}>
        <GlassSurface
          handleRef={surface}
          tint={tint}
          radius={isIcon ? 999 : 16}
          className={cn("text-white", isIcon ? "size-12" : "h-12 px-6")}
          contentClassName="flex items-center justify-center"
        >
          <span className="relative z-10 text-sm font-medium">{children}</span>
        </GlassSurface>
      </span>
    </button>
  );
}

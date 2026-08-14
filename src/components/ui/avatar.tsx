"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

// Robust image: rendered as a plain <img> layered above the fallback.
// Radix' AvatarImage permanently hides the picture after a single failed or
// aborted request (common with slow storage responses / re-mounted lists),
// which made avatars randomly "disappear". Here we retry once and simply keep
// the fallback visible underneath while loading.
const AvatarImage = React.forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(
  ({ className, src, onError, ...props }, ref) => {
    const [attempt, setAttempt] = React.useState(0);
    const [failed, setFailed] = React.useState(false);

    React.useEffect(() => {
      setAttempt(0);
      setFailed(false);
    }, [src]);

    if (!src || failed) return null;

    const resolved = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;

    return (
      <img
        ref={ref}
        src={resolved}
        decoding="async"
        className={cn("absolute inset-0 z-10 aspect-square h-full w-full object-cover", className)}
        onError={(e) => {
          if (attempt < 1) setAttempt((a) => a + 1);
          else setFailed(true);
          onError?.(e);
        }}
        {...props}
      />
    );
  },
);
AvatarImage.displayName = "AvatarImage";


const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };

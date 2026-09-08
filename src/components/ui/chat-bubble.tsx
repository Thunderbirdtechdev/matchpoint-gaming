/**
 * Chat bubble primitives — from 21st.dev (@jakobhoeg/chat-bubble).
 *
 * Kept as the vendored component so an upstream update stays a diff rather
 * than a rewrite. The only local change is `variant="sent"` painting with
 * `bg-primary/15` instead of a solid `bg-primary`: on this theme a solid
 * primary bubble sits at almost the same lightness as the brand gradient
 * behind the panel, and the message edge disappears into it.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageLoading } from "@/components/ui/message-loading";

interface ChatBubbleProps {
  variant?: "sent" | "received";
  layout?: "default" | "ai";
  className?: string;
  children: React.ReactNode;
}

export function ChatBubble({ variant = "received", className, children }: ChatBubbleProps) {
  return (
    <div
      className={cn("flex items-end gap-2", variant === "sent" && "flex-row-reverse", className)}
    >
      {children}
    </div>
  );
}

interface ChatBubbleMessageProps {
  variant?: "sent" | "received";
  isLoading?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function ChatBubbleMessage({
  variant = "received",
  isLoading,
  className,
  style,
  children,
}: ChatBubbleMessageProps) {
  return (
    <div
      style={style}
      className={cn(
        "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
        variant === "sent"
          ? "bg-primary/15 text-foreground"
          : "border border-border/50 bg-surface/60 text-foreground",
        className,
      )}
    >
      {isLoading ? (
        <div className="flex items-center space-x-2">
          <MessageLoading />
        </div>
      ) : (
        children
      )}
    </div>
  );
}

interface ChatBubbleAvatarProps {
  src?: string;
  fallback?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function ChatBubbleAvatar({ src, fallback = "?", className, style }: ChatBubbleAvatarProps) {
  return (
    <Avatar className={cn("h-8 w-8", className)} style={style}>
      {src && <AvatarImage src={src} />}
      <AvatarFallback className="bg-transparent text-[11px] font-semibold">
        {fallback}
      </AvatarFallback>
    </Avatar>
  );
}

interface ChatBubbleActionProps {
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  title?: string;
}

export function ChatBubbleAction({ icon, onClick, className, title }: ChatBubbleActionProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      title={title}
      className={cn("h-6 w-6", className)}
      onClick={onClick}
    >
      {icon}
    </Button>
  );
}

export function ChatBubbleActionWrapper({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("flex items-center gap-1", className)}>{children}</div>;
}

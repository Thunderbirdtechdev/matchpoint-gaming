import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 2 * 1024 * 1024; // matches the bucket's file_size_limit
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

export function AvatarUpload({
  userId,
  avatarUrl,
  displayName,
  onChange,
}: {
  userId: string;
  avatarUrl: string | null;
  displayName: string;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const initials = (displayName || "MP").slice(0, 2).toUpperCase();

  async function upload(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Use a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("That image is over 2MB. Pick a smaller one.");
      return;
    }

    setBusy(true);
    try {
      // Bucket policies key ownership off the first path segment, so the file
      // must live under <user-id>/. The timestamp busts the CDN cache, since
      // the public URL is stable per path.
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);
      if (profileError) throw profileError;

      onChange(publicUrl);
      toast.success("Avatar updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId);
      if (error) throw error;
      onChange(null);
      toast.success("Avatar removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove avatar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative">
        <Avatar className="h-20 w-20 ring-1 ring-inset ring-white/10">
          <AvatarImage src={avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="bg-gradient-to-b from-[oklch(0.27_0.062_285)] to-[oklch(0.195_0.048_285)] text-lg font-bold text-primary-glow">
            {initials}
          </AvatarFallback>
        </Avatar>
        {busy && (
          <div className="absolute inset-0 grid place-items-center rounded-full bg-background/70">
            <Loader2 className="h-5 w-5 animate-spin text-primary-glow" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="mr-1.5 h-4 w-4" />
            {avatarUrl ? "Change" : "Upload"}
          </Button>
          {avatarUrl && (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={remove}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPEG or WebP · up to 2MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </div>
  );
}

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Paperclip, FileVideo, ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { attachEvidence, listEvidence } from "@/lib/evidence.functions";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";

const MAX_BYTES = 10 * 1024 * 1024; // matches the bucket's file_size_limit
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"];

/**
 * Evidence attached to a contest. The bucket is private, so the listing comes
 * back from the server with short-lived signed URLs rather than public links.
 */
export function EvidenceUpload({
  userId,
  challengeId,
  tournamentMatchId,
  canUpload,
}: {
  userId: string;
  challengeId?: string;
  tournamentMatchId?: string;
  canUpload: boolean;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const attachFn = useServerFn(attachEvidence);
  const listFn = useServerFn(listEvidence);

  const target = challengeId
    ? { challenge_id: challengeId }
    : { tournament_match_id: tournamentMatchId! };
  const key = challengeId
    ? ["evidence", "challenge", challengeId]
    : ["evidence", "match", tournamentMatchId];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => (await listFn({ data: target })).items,
  });

  async function upload(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Use a PNG, JPEG, WebP, MP4 or WebM file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("That file is over 10MB.");
      return;
    }

    setBusy(true);
    try {
      // Storage policy keys ownership off the first path segment, so the file
      // must sit under <user-id>/.
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("match-evidence")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;

      await attachFn({
        data: {
          ...target,
          file_path: path,
          kind: file.type.startsWith("video/") ? "clip" : "screenshot",
        },
      });

      toast.success("Evidence attached");
      qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const items = data ?? [];

  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Evidence</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Screenshots or clips backing the result. Visible only to the players in this match and
            our moderators.
          </p>
        </div>
        {canUpload && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="mr-1.5 h-4 w-4" />
            )}
            Attach
          </Button>
        )}
      </div>

      <div className="mt-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading evidence…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing attached yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((it) => (
              <li
                key={it.id}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 p-3"
              >
                <IconTile size="sm">
                  {it.kind === "clip" ? (
                    <FileVideo className="h-4 w-4" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                </IconTile>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium capitalize">{it.kind}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(it.created_at).toLocaleString()}
                  </div>
                </div>
                {it.url && (
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-primary-glow hover:underline"
                  >
                    View
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
    </div>
  );
}

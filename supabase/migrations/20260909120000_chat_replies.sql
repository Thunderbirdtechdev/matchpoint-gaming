-- Quoted replies in chat.
--
-- A match room is where a dispute is argued before it reaches a moderator, and
-- "you said 8pm" is only evidence if you can see WHICH message it answers. A
-- flat list loses that the moment two conversations overlap.
--
-- ON DELETE SET NULL, not CASCADE: a moderator removing an off-platform payment
-- offer must not silently take the replies to it with it — those replies are
-- often the useful half, and deleting them would erase the record of who
-- pushed back.
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID
    REFERENCES public.chat_messages(id) ON DELETE SET NULL;

-- Reading a room fetches its parents in one `id IN (...)`, but the moderator
-- queue walks the other way — "what did people say back to this" — and that is
-- the direction that needs the index.
CREATE INDEX IF NOT EXISTS chat_messages_reply_to_idx
  ON public.chat_messages (reply_to_id)
  WHERE reply_to_id IS NOT NULL;

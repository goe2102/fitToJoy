-- ═══════════════════════════════════════════════════════════════
-- ACTIVITY GROUP CHATS — run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Group chat per activity (one-to-one with activities)
CREATE TABLE IF NOT EXISTS activity_chats (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid REFERENCES activities(id) ON DELETE CASCADE NOT NULL UNIQUE,
  created_at  timestamptz DEFAULT now()
);

-- 2. Messages inside a group chat
CREATE TABLE IF NOT EXISTS group_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    uuid REFERENCES activity_chats(id) ON DELETE CASCADE NOT NULL,
  sender_id  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. Per-user settings: mute notifications + last-read timestamp
CREATE TABLE IF NOT EXISTS group_chat_members (
  chat_id      uuid REFERENCES activity_chats(id) ON DELETE CASCADE NOT NULL,
  user_id      uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  muted        boolean DEFAULT false,
  last_read_at timestamptz DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS group_messages_chat_id_idx ON group_messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS group_chat_members_user_idx ON group_chat_members(user_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE activity_chats     ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_chat_members ENABLE ROW LEVEL SECURITY;

-- Helper: can this user access this chat?
CREATE OR REPLACE FUNCTION can_access_activity_chat(p_chat_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM activity_chats ac
    JOIN   activities a ON a.id = ac.activity_id
    WHERE  ac.id = p_chat_id
      AND (
        a.host_id = p_user_id
        OR EXISTS (
          SELECT 1 FROM participants p
          WHERE  p.activity_id = a.id
            AND  p.user_id     = p_user_id
            AND  p.status IN ('joined','approved')
        )
      )
  )
$$;

-- activity_chats policies
DROP POLICY IF EXISTS "select_chat"  ON activity_chats;
DROP POLICY IF EXISTS "insert_chat"  ON activity_chats;
CREATE POLICY "select_chat" ON activity_chats FOR SELECT USING (can_access_activity_chat(id, auth.uid()));
CREATE POLICY "insert_chat" ON activity_chats FOR INSERT WITH CHECK (true); -- trigger handles creation

-- group_messages policies
DROP POLICY IF EXISTS "read_group_messages"   ON group_messages;
DROP POLICY IF EXISTS "send_group_messages"   ON group_messages;
CREATE POLICY "read_group_messages" ON group_messages
  FOR SELECT USING (can_access_activity_chat(chat_id, auth.uid()));
CREATE POLICY "send_group_messages" ON group_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND can_access_activity_chat(chat_id, auth.uid())
  );

-- group_chat_members policies (each user owns their own row)
DROP POLICY IF EXISTS "own_member_row" ON group_chat_members;
CREATE POLICY "own_member_row" ON group_chat_members
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── Auto-create a group chat when an activity is inserted ────────────────────
CREATE OR REPLACE FUNCTION create_activity_chat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO activity_chats (activity_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_activity_created ON activities;
CREATE TRIGGER on_activity_created
  AFTER INSERT ON activities
  FOR EACH ROW EXECUTE FUNCTION create_activity_chat();

-- Backfill existing activities
INSERT INTO activity_chats (activity_id)
SELECT id FROM activities
ON CONFLICT DO NOTHING;

-- ── Push notifications for new group messages ────────────────────────────────
CREATE OR REPLACE FUNCTION send_push_on_group_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_activity_id    uuid;
  v_activity_title text;
  v_sender_name    text;
  v_uid            uuid;
  v_token          text;
  v_muted          boolean;
BEGIN
  SET LOCAL row_security = off;

  -- Resolve activity + sender
  SELECT ac.activity_id, a.title
    INTO v_activity_id, v_activity_title
    FROM activity_chats ac
    JOIN activities a ON a.id = ac.activity_id
   WHERE ac.id = NEW.chat_id;

  SELECT username INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;

  -- Fan-out: host + all joined/approved participants, except sender
  FOR v_uid IN
    SELECT a.host_id FROM activities a WHERE a.id = v_activity_id AND a.host_id <> NEW.sender_id
    UNION
    SELECT p.user_id FROM participants p
     WHERE p.activity_id = v_activity_id
       AND p.user_id     <> NEW.sender_id
       AND p.status IN ('joined','approved')
  LOOP
    -- Respect mute preference
    SELECT COALESCE(muted, false) INTO v_muted
      FROM group_chat_members
     WHERE chat_id = NEW.chat_id AND user_id = v_uid;

    CONTINUE WHEN v_muted IS TRUE;

    SELECT expo_push_token INTO v_token FROM profiles WHERE id = v_uid;
    CONTINUE WHEN v_token IS NULL OR v_token NOT LIKE 'ExponentPushToken%';

    PERFORM net.http_post(
      url     := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body    := json_build_object(
        'to',    v_token,
        'title', v_activity_title,
        'body',  '@' || v_sender_name || ': ' || left(NEW.content, 120),
        'data',  json_build_object('chat_id', NEW.chat_id, 'type', 'group_message')
      )::text::jsonb
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_group_message_insert ON group_messages;
CREATE TRIGGER on_group_message_insert
  AFTER INSERT ON group_messages
  FOR EACH ROW EXECUTE FUNCTION send_push_on_group_message();

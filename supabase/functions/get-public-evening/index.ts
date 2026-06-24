import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function collectPlayerIds(evening: any): string[] {
  const ids = new Set<string>();
  const addPlayer = (player: any) => {
    if (player?.id) ids.add(player.id);
  };

  (evening?.players || []).forEach(addPlayer);
  (evening?.pairs || []).forEach((pair: any) => (pair?.players || []).forEach(addPlayer));
  (evening?.schedule || []).forEach((match: any) => {
    (match?.pairA?.players || []).forEach(addPlayer);
    (match?.pairB?.players || []).forEach(addPlayer);
    addPlayer(match?.sittingOut);
  });

  return Array.from(ids);
}

function applyAvatarMap(evening: any, avatarByPlayerId: Record<string, string | null>) {
  const withAvatar = (player: any) => {
    if (!player?.id) return player;
    const avatarUrl = avatarByPlayerId[player.id] ?? null;
    return avatarUrl ? { ...player, avatarUrl } : player;
  };

  if (Array.isArray(evening?.players)) {
    evening.players = evening.players.map(withAvatar);
  }

  if (Array.isArray(evening?.pairs)) {
    evening.pairs = evening.pairs.map((pair: any) => ({
      ...pair,
      players: (pair.players || []).map(withAvatar),
    }));
  }

  if (Array.isArray(evening?.schedule)) {
    evening.schedule = evening.schedule.map((match: any) => ({
      ...match,
      pairA: match.pairA
        ? { ...match.pairA, players: (match.pairA.players || []).map(withAvatar) }
        : match.pairA,
      pairB: match.pairB
        ? { ...match.pairB, players: (match.pairB.players || []).map(withAvatar) }
        : match.pairB,
      sittingOut: withAvatar(match.sittingOut),
    }));
  }

  return evening;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const shareCode = url.searchParams.get("code");

    if (!shareCode || shareCode.length === 0 || shareCode.length > 20) {
      return new Response(JSON.stringify({ error: "Invalid code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleaned = shareCode.trim().toUpperCase();
    if (!/^[A-Z0-9-]+$/.test(cleaned)) {
      return new Response(JSON.stringify({ error: "Invalid code format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to bypass RLS for public read
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("evenings")
      .select("id, data, updated_at, share_code, team_id")
      .eq("share_code", cleaned)
      .maybeSingle();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let eveningData = data.data;

    if (data.team_id && eveningData) {
      const playerIds = collectPlayerIds(eveningData);
      if (playerIds.length > 0) {
        const { data: accounts } = await supabase
          .from("player_accounts")
          .select("player_id, user_id")
          .eq("team_id", data.team_id)
          .in("player_id", playerIds);

        const userIds = [...new Set((accounts || []).map((account: any) => account.user_id).filter(Boolean))];

        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, avatar_url")
            .in("id", userIds);

          const avatarByUserId = Object.fromEntries(
            (profiles || []).map((profile: any) => [profile.id, profile.avatar_url ?? null])
          );
          const avatarByPlayerId = Object.fromEntries(
            (accounts || []).map((account: any) => [
              account.player_id,
              avatarByUserId[account.user_id] ?? null,
            ])
          );

          eveningData = applyAvatarMap(structuredClone(eveningData), avatarByPlayerId);
        }
      }
    }

    return new Response(
      JSON.stringify({
        id: data.id,
        data: eveningData,
        updated_at: data.updated_at,
        team_id: data.team_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

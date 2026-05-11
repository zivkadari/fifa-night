export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      club_overrides: {
        Row: {
          club_id: string
          deleted: boolean
          stars: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          club_id: string
          deleted?: boolean
          stars: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          club_id?: string
          deleted?: boolean
          stars?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      club_stats: {
        Row: {
          club_id: string
          club_name: string
          goals_conceded: number
          goals_scored: number
          times_used: number
          times_won: number
          updated_at: string
        }
        Insert: {
          club_id: string
          club_name: string
          goals_conceded?: number
          goals_scored?: number
          times_used?: number
          times_won?: number
          updated_at?: string
        }
        Update: {
          club_id?: string
          club_name?: string
          goals_conceded?: number
          goals_scored?: number
          times_used?: number
          times_won?: number
          updated_at?: string
        }
        Relationships: []
      }
      evening_members: {
        Row: {
          evening_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          evening_id: string
          id?: string
          joined_at?: string
          role: string
          user_id: string
        }
        Update: {
          evening_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evening_members_evening_id_fkey"
            columns: ["evening_id"]
            isOneToOne: false
            referencedRelation: "evenings"
            referencedColumns: ["id"]
          },
        ]
      }
      evenings: {
        Row: {
          created_at: string
          data: Json
          id: string
          owner_id: string
          share_code: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          id: string
          owner_id: string
          share_code?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          owner_id?: string
          share_code?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evenings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      join_attempts: {
        Row: {
          attempted_at: string
          id: string
          success: boolean
          user_id: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          success?: boolean
          user_id: string
        }
        Update: {
          attempted_at?: string
          id?: string
          success?: boolean
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pairs_pool_config: {
        Row: {
          distribution: Json
          id: string
          include_prime: boolean
          prime_count: number
          updated_at: string | null
          updated_by: string | null
          wins_to_complete: number
        }
        Insert: {
          distribution: Json
          id?: string
          include_prime?: boolean
          prime_count?: number
          updated_at?: string | null
          updated_by?: string | null
          wins_to_complete: number
        }
        Update: {
          distribution?: Json
          id?: string
          include_prime?: boolean
          prime_count?: number
          updated_at?: string | null
          updated_by?: string | null
          wins_to_complete?: number
        }
        Relationships: []
      }
      player_accounts: {
        Row: {
          claimed_at: string
          id: string
          player_id: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          player_id: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          player_id?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_accounts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_matchups: {
        Row: {
          id: string
          player1_id: string
          player1_wins: number
          player2_id: string
          player2_wins: number
          total_games: number
          updated_at: string
        }
        Insert: {
          id?: string
          player1_id: string
          player1_wins?: number
          player2_id: string
          player2_wins?: number
          total_games?: number
          updated_at?: string
        }
        Update: {
          id?: string
          player1_id?: string
          player1_wins?: number
          player2_id?: string
          player2_wins?: number
          total_games?: number
          updated_at?: string
        }
        Relationships: []
      }
      player_stats: {
        Row: {
          alpha_count: number
          beta_count: number
          delta_count: number
          gamma_count: number
          longest_win_streak: number
          player_id: string
          total_goals_against: number
          total_goals_for: number
          total_wins: number
          tournaments_played: number
          updated_at: string
        }
        Insert: {
          alpha_count?: number
          beta_count?: number
          delta_count?: number
          gamma_count?: number
          longest_win_streak?: number
          player_id: string
          total_goals_against?: number
          total_goals_for?: number
          total_wins?: number
          tournaments_played?: number
          updated_at?: string
        }
        Update: {
          alpha_count?: number
          beta_count?: number
          delta_count?: number
          gamma_count?: number
          longest_win_streak?: number
          player_id?: string
          total_goals_against?: number
          total_goals_for?: number
          total_wins?: number
          tournaments_played?: number
          updated_at?: string
        }
        Relationships: []
      }
      player_stats_by_team: {
        Row: {
          alpha_count: number
          beta_count: number
          delta_count: number
          games_drawn: number
          games_lost: number
          games_played: number
          games_won: number
          gamma_count: number
          goals_against: number
          goals_for: number
          id: string
          player_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          alpha_count?: number
          beta_count?: number
          delta_count?: number
          games_drawn?: number
          games_lost?: number
          games_played?: number
          games_won?: number
          gamma_count?: number
          goals_against?: number
          goals_for?: number
          id?: string
          player_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          alpha_count?: number
          beta_count?: number
          delta_count?: number
          games_drawn?: number
          games_lost?: number
          games_played?: number
          games_won?: number
          gamma_count?: number
          goals_against?: number
          goals_for?: number
          id?: string
          player_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      player_stats_global: {
        Row: {
          alpha_count: number
          beta_count: number
          delta_count: number
          games_drawn: number
          games_lost: number
          games_played: number
          games_won: number
          gamma_count: number
          goals_against: number
          goals_for: number
          id: string
          player_id: string
          updated_at: string
        }
        Insert: {
          alpha_count?: number
          beta_count?: number
          delta_count?: number
          games_drawn?: number
          games_lost?: number
          games_played?: number
          games_won?: number
          gamma_count?: number
          goals_against?: number
          goals_for?: number
          id?: string
          player_id: string
          updated_at?: string
        }
        Update: {
          alpha_count?: number
          beta_count?: number
          delta_count?: number
          games_drawn?: number
          games_lost?: number
          games_played?: number
          games_won?: number
          gamma_count?: number
          goals_against?: number
          goals_for?: number
          id?: string
          player_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_join_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          requester_email: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          requester_email?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          requester_email?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_join_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          joined_at: string
          member_mode: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          member_mode?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          member_mode?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_players: {
        Row: {
          created_at: string
          player_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          player_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          player_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          invite_code: string
          name: string
          owner_id: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          name: string
          owner_id: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_join_attempts: { Args: never; Returns: undefined }
      create_team_evening: {
        Args: { _data: Json; _evening_id: string; _team_id: string }
        Returns: string
      }
      get_evening_share_code: { Args: { _evening_id: string }; Returns: string }
      get_team_evenings: {
        Args: { _team_id: string }
        Returns: {
          created_at: string
          data: Json
          id: string
          team_id: string
          updated_at: string
        }[]
      }
      get_team_invite_code: { Args: { _team_id: string }; Returns: string }
      is_clubs_admin: { Args: { user_id: string }; Returns: boolean }
      is_evening_member: {
        Args: { _evening_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_owner: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      join_evening_by_code: {
        Args: { _code: string }
        Returns: {
          evening_id: string
        }[]
      }
      join_team_by_code: {
        Args: { _code: string }
        Returns: {
          team_id: string
          team_name: string
        }[]
      }
      notify_team_evening_started: {
        Args: {
          _evening_id: string
          _team_id: string
          _tournament_mode: string
        }
        Returns: number
      }
      notify_team_join_request_created: {
        Args: { _request_id: string }
        Returns: number
      }
      notify_team_join_request_decision: {
        Args: { _approved: boolean; _request_id: string }
        Returns: undefined
      }
      regenerate_team_invite_code: {
        Args: { _team_id: string }
        Returns: string
      }
      resolve_invite_code: {
        Args: { _code: string }
        Returns: {
          evening_id: string
          kind: string
          team_id: string
          team_name: string
        }[]
      }
      trigger_stats_backfill: { Args: never; Returns: undefined }
      user_evening_ids: { Args: { _user_id: string }; Returns: string[] }
      user_team_ids: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

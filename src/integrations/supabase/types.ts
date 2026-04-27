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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          agency_id: string
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          client_id: string | null
          created_at: string
          ends_at: string
          id: string
          location: string | null
          notes: string | null
          owner_id: string | null
          property_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          client_id?: string | null
          created_at?: string
          ends_at: string
          id?: string
          location?: string | null
          notes?: string | null
          owner_id?: string | null
          property_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          client_id?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          owner_id?: string | null
          property_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          agency_id: string
          area_max: number | null
          area_min: number | null
          budget_max: number | null
          budget_min: number | null
          client_type: Database["public"]["Enums"]["client_type"]
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          preferred_cities: string[] | null
          preferred_listing: Database["public"]["Enums"]["listing_type"] | null
          preferred_types: Database["public"]["Enums"]["property_type"][] | null
          rooms_min: number | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          area_max?: number | null
          area_min?: number | null
          budget_max?: number | null
          budget_min?: number | null
          client_type?: Database["public"]["Enums"]["client_type"]
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          preferred_cities?: string[] | null
          preferred_listing?: Database["public"]["Enums"]["listing_type"] | null
          preferred_types?:
            | Database["public"]["Enums"]["property_type"][]
            | null
          rooms_min?: number | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          area_max?: number | null
          area_min?: number | null
          budget_max?: number | null
          budget_min?: number | null
          client_type?: Database["public"]["Enums"]["client_type"]
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          preferred_cities?: string[] | null
          preferred_listing?: Database["public"]["Enums"]["listing_type"] | null
          preferred_types?:
            | Database["public"]["Enums"]["property_type"][]
            | null
          rooms_min?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          agency_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          agency_id: string
          client_id: string
          created_at: string
          id: string
          notes: string | null
          property_id: string
          score: number
          status: Database["public"]["Enums"]["match_status"]
        }
        Insert: {
          agency_id: string
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          property_id: string
          score?: number
          status?: Database["public"]["Enums"]["match_status"]
        }
        Update: {
          agency_id?: string
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          property_id?: string
          score?: number
          status?: Database["public"]["Enums"]["match_status"]
        }
        Relationships: [
          {
            foreignKeyName: "matches_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agency_id: string
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          agency_id: string
          area: number | null
          bathrooms: number | null
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          energy_class: string | null
          features: string[] | null
          id: string
          images: string[] | null
          listing_type: Database["public"]["Enums"]["listing_type"]
          owner_id: string | null
          plot_area: number | null
          postal_code: string | null
          price: number | null
          property_type: Database["public"]["Enums"]["property_type"]
          rooms: number | null
          seller_client_id: string | null
          status: Database["public"]["Enums"]["property_status"]
          title: string
          updated_at: string
          year_built: number | null
        }
        Insert: {
          address?: string | null
          agency_id: string
          area?: number | null
          bathrooms?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          energy_class?: string | null
          features?: string[] | null
          id?: string
          images?: string[] | null
          listing_type?: Database["public"]["Enums"]["listing_type"]
          owner_id?: string | null
          plot_area?: number | null
          postal_code?: string | null
          price?: number | null
          property_type?: Database["public"]["Enums"]["property_type"]
          rooms?: number | null
          seller_client_id?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          title: string
          updated_at?: string
          year_built?: number | null
        }
        Update: {
          address?: string | null
          agency_id?: string
          area?: number | null
          bathrooms?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          energy_class?: string | null
          features?: string[] | null
          id?: string
          images?: string[] | null
          listing_type?: Database["public"]["Enums"]["listing_type"]
          owner_id?: string | null
          plot_area?: number | null
          postal_code?: string | null
          price?: number | null
          property_type?: Database["public"]["Enums"]["property_type"]
          rooms?: number | null
          seller_client_id?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          title?: string
          updated_at?: string
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_seller_client_id_fkey"
            columns: ["seller_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_agency_id: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "owner" | "agent" | "assistant" | "superadmin"
      appointment_status: "scheduled" | "completed" | "cancelled"
      appointment_type: "viewing" | "meeting" | "call" | "other"
      client_type: "buyer" | "seller" | "tenant" | "landlord"
      lead_status: "new" | "contacted" | "qualified" | "converted" | "lost"
      listing_type: "sale" | "rent"
      match_status:
        | "suggested"
        | "contacted"
        | "interested"
        | "rejected"
        | "converted"
      property_status:
        | "draft"
        | "available"
        | "reserved"
        | "sold"
        | "rented"
        | "archived"
      property_type: "apartment" | "house" | "commercial" | "land" | "other"
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
    Enums: {
      app_role: ["owner", "agent", "assistant", "superadmin"],
      appointment_status: ["scheduled", "completed", "cancelled"],
      appointment_type: ["viewing", "meeting", "call", "other"],
      client_type: ["buyer", "seller", "tenant", "landlord"],
      lead_status: ["new", "contacted", "qualified", "converted", "lost"],
      listing_type: ["sale", "rent"],
      match_status: [
        "suggested",
        "contacted",
        "interested",
        "rejected",
        "converted",
      ],
      property_status: [
        "draft",
        "available",
        "reserved",
        "sold",
        "rented",
        "archived",
      ],
      property_type: ["apartment", "house", "commercial", "land", "other"],
    },
  },
} as const

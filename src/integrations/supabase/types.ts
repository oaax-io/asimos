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
          agency_id?: string
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
          agency_id?: string
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
      company: {
        Row: {
          agency_id: string
          created_at: string
          id: boolean
          name: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: boolean
          name?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      financing_dossiers: {
        Row: {
          agency_id: string
          client_id: string
          completion_percent: number
          created_at: string
          id: string
          section_additional: Json
          section_affordability: Json
          section_customer: Json
          section_financing: Json
          section_income: Json
          section_property_docs: Json
          section_quality_check: Json
          section_rejection_reasons: Json
          section_self_employed: Json
          section_tax: Json
          status: Database["public"]["Enums"]["financing_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          agency_id?: string
          client_id: string
          completion_percent?: number
          created_at?: string
          id?: string
          section_additional?: Json
          section_affordability?: Json
          section_customer?: Json
          section_financing?: Json
          section_income?: Json
          section_property_docs?: Json
          section_quality_check?: Json
          section_rejection_reasons?: Json
          section_self_employed?: Json
          section_tax?: Json
          status?: Database["public"]["Enums"]["financing_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          client_id?: string
          completion_percent?: number
          created_at?: string
          id?: string
          section_additional?: Json
          section_affordability?: Json
          section_customer?: Json
          section_financing?: Json
          section_income?: Json
          section_property_docs?: Json
          section_quality_check?: Json
          section_rejection_reasons?: Json
          section_self_employed?: Json
          section_tax?: Json
          status?: Database["public"]["Enums"]["financing_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      financing_links: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string | null
          dossier_id: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          agency_id?: string
          created_at?: string
          created_by?: string | null
          dossier_id: string
          expires_at?: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string | null
          dossier_id?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financing_links_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "financing_dossiers"
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
          agency_id?: string
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
          agency_id?: string
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
      module_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit_all: boolean
          can_edit_own: boolean
          can_view: boolean
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit_all?: boolean
          can_edit_own?: boolean
          can_view?: boolean
          id?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit_all?: boolean
          can_edit_own?: boolean
          can_view?: boolean
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_get_stats: {
        Args: never
        Returns: {
          agencies_count: number
          appointments_count: number
          clients_count: number
          leads_count: number
          properties_count: number
          users_count: number
        }[]
      }
      admin_set_user_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      current_agency_id: { Args: never; Returns: string }
      financing_link_resolve: {
        Args: { _token: string }
        Returns: {
          client_name: string
          completion_percent: number
          dossier_id: string
          section_additional: Json
          section_affordability: Json
          section_customer: Json
          section_financing: Json
          section_income: Json
          section_property_docs: Json
          section_self_employed: Json
          section_tax: Json
          status: string
        }[]
      }
      financing_link_save: {
        Args: { _completion: number; _payload: Json; _token: string }
        Returns: undefined
      }
      financing_link_submit: { Args: { _token: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_manager_or_above: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      user_can: { Args: { _action: string; _module: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "owner"
        | "agent"
        | "assistant"
        | "superadmin"
        | "employee"
        | "manager"
        | "admin"
      appointment_status: "scheduled" | "completed" | "cancelled"
      appointment_type: "viewing" | "meeting" | "call" | "other"
      client_type:
        | "buyer"
        | "seller"
        | "tenant"
        | "landlord"
        | "investor"
        | "other"
      document_type:
        | "client_document"
        | "property_document"
        | "contract"
        | "mandate"
        | "reservation"
        | "financing"
        | "media"
        | "other"
      financing_status: "draft" | "submitted" | "reviewed"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "converted"
        | "lost"
        | "viewing_planned"
      listing_type: "sale" | "rent"
      mandate_status:
        | "draft"
        | "sent"
        | "signed"
        | "active"
        | "expired"
        | "cancelled"
      match_status:
        | "suggested"
        | "contacted"
        | "interested"
        | "rejected"
        | "converted"
        | "shortlisted"
      property_status:
        | "draft"
        | "available"
        | "reserved"
        | "sold"
        | "rented"
        | "archived"
        | "preparation"
        | "active"
      property_type:
        | "apartment"
        | "house"
        | "commercial"
        | "land"
        | "other"
        | "parking"
        | "mixed_use"
      reservation_status:
        | "draft"
        | "sent"
        | "signed"
        | "cancelled"
        | "converted"
      task_priority: "low" | "normal" | "high" | "urgent"
      task_status: "open" | "in_progress" | "waiting" | "done" | "cancelled"
      user_role: "owner" | "admin" | "agent" | "assistant" | "backoffice"
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
      app_role: [
        "owner",
        "agent",
        "assistant",
        "superadmin",
        "employee",
        "manager",
        "admin",
      ],
      appointment_status: ["scheduled", "completed", "cancelled"],
      appointment_type: ["viewing", "meeting", "call", "other"],
      client_type: [
        "buyer",
        "seller",
        "tenant",
        "landlord",
        "investor",
        "other",
      ],
      document_type: [
        "client_document",
        "property_document",
        "contract",
        "mandate",
        "reservation",
        "financing",
        "media",
        "other",
      ],
      financing_status: ["draft", "submitted", "reviewed"],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "converted",
        "lost",
        "viewing_planned",
      ],
      listing_type: ["sale", "rent"],
      mandate_status: [
        "draft",
        "sent",
        "signed",
        "active",
        "expired",
        "cancelled",
      ],
      match_status: [
        "suggested",
        "contacted",
        "interested",
        "rejected",
        "converted",
        "shortlisted",
      ],
      property_status: [
        "draft",
        "available",
        "reserved",
        "sold",
        "rented",
        "archived",
        "preparation",
        "active",
      ],
      property_type: [
        "apartment",
        "house",
        "commercial",
        "land",
        "other",
        "parking",
        "mixed_use",
      ],
      reservation_status: ["draft", "sent", "signed", "cancelled", "converted"],
      task_priority: ["low", "normal", "high", "urgent"],
      task_status: ["open", "in_progress", "waiting", "done", "cancelled"],
      user_role: ["owner", "admin", "agent", "assistant", "backoffice"],
    },
  },
} as const

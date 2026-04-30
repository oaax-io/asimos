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
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          related_id: string | null
          related_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          related_id?: string | null
          related_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          related_id?: string | null
          related_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          agency_id: string | null
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          assigned_to: string | null
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
          agency_id?: string | null
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          assigned_to?: string | null
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
          agency_id?: string | null
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          assigned_to?: string | null
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
            foreignKeyName: "appointments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      bank_accounts: {
        Row: {
          account_holder: string | null
          bank_name: string | null
          bic: string | null
          created_at: string
          iban: string | null
          id: string
          is_active: boolean
          is_default: boolean
          label: string
          notes: string | null
          purpose: string | null
          updated_at: string
        }
        Insert: {
          account_holder?: string | null
          bank_name?: string | null
          bic?: string | null
          created_at?: string
          iban?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          label: string
          notes?: string | null
          purpose?: string | null
          updated_at?: string
        }
        Update: {
          account_holder?: string | null
          bank_name?: string | null
          bic?: string | null
          created_at?: string
          iban?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          label?: string
          notes?: string | null
          purpose?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      brand_settings: {
        Row: {
          company_address: string | null
          company_email: string | null
          company_name: string | null
          company_website: string | null
          created_at: string
          font_family: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
        }
        Insert: {
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_website?: string | null
          created_at?: string
          font_family?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Update: {
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_website?: string | null
          created_at?: string
          font_family?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      checklist_items: {
        Row: {
          assigned_to: string | null
          checklist_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_done: boolean
          sort_order: number
          title: string
        }
        Insert: {
          assigned_to?: string | null
          checklist_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_done?: boolean
          sort_order?: number
          title: string
        }
        Update: {
          assigned_to?: string | null
          checklist_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_done?: boolean
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          default_related_type: string | null
          description: string | null
          id: string
          items: Json
          key: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_related_type?: string | null
          description?: string | null
          id?: string
          items?: Json
          key: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_related_type?: string | null
          description?: string | null
          id?: string
          items?: Json
          key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      checklists: {
        Row: {
          created_at: string
          id: string
          related_id: string | null
          related_type: string | null
          template_key: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          related_id?: string | null
          related_type?: string | null
          template_key?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          related_id?: string | null
          related_type?: string | null
          template_key?: string | null
          title?: string
        }
        Relationships: []
      }
      client_children: {
        Row: {
          birth_date: string | null
          client_id: string
          created_at: string
          full_name: string | null
          gender: string | null
          id: string
          is_shared_child: boolean
          sort_order: number
        }
        Insert: {
          birth_date?: string | null
          client_id: string
          created_at?: string
          full_name?: string | null
          gender?: string | null
          id?: string
          is_shared_child?: boolean
          sort_order?: number
        }
        Update: {
          birth_date?: string | null
          client_id?: string
          created_at?: string
          full_name?: string | null
          gender?: string | null
          id?: string
          is_shared_child?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_children_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_relationships: {
        Row: {
          client_id: string
          created_at: string
          id: string
          notes: string | null
          related_client_id: string
          relationship_type: Database["public"]["Enums"]["client_relationship_type"]
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          related_client_id: string
          relationship_type?: Database["public"]["Enums"]["client_relationship_type"]
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          related_client_id?: string
          relationship_type?: Database["public"]["Enums"]["client_relationship_type"]
        }
        Relationships: [
          {
            foreignKeyName: "client_relationships_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_relationships_related_client_id_fkey"
            columns: ["related_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_self_disclosures: {
        Row: {
          additional_income: number | null
          advisor_id: string | null
          alimony_expense: number | null
          annual_net_salary: number | null
          benchmark_status: string | null
          birth_country: string | null
          birth_date: string | null
          birth_name: string | null
          birth_place: string | null
          city: string | null
          client_id: string
          country: string | null
          created_at: string
          credit_expense: number | null
          disclosure_date: string | null
          disclosure_place: string | null
          email: string | null
          employed_as: string | null
          employed_since: string | null
          employer_address: string | null
          employer_name: string | null
          employer_phone: string | null
          employment_status: string | null
          first_name: string | null
          health_insurance_expense: number | null
          id: string
          income_job_two: number | null
          income_rental: number | null
          internal_notes: string | null
          last_name: string | null
          leasing_expense: number | null
          life_insurance_expense: number | null
          living_costs_expense: number | null
          marital_status: string | null
          miscellaneous_expense: number | null
          mobile: string | null
          mortgage_expense: number | null
          nationality: string | null
          phone: string | null
          postal_code: string | null
          property_insurance_expense: number | null
          rent_expense: number | null
          reserve_ratio: number | null
          reserve_total: number | null
          resident_since: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          salary_net_monthly: number | null
          salary_type: string | null
          salutation: string | null
          sent_at: string | null
          status: string
          street: string | null
          street_number: string | null
          submitted_at: string | null
          tax_id_ch: string | null
          taxes_expense: number | null
          telecom_expense: number | null
          title: string | null
          total_expenses_monthly: number | null
          total_income_monthly: number | null
          updated_at: string
          utilities_expense: number | null
        }
        Insert: {
          additional_income?: number | null
          advisor_id?: string | null
          alimony_expense?: number | null
          annual_net_salary?: number | null
          benchmark_status?: string | null
          birth_country?: string | null
          birth_date?: string | null
          birth_name?: string | null
          birth_place?: string | null
          city?: string | null
          client_id: string
          country?: string | null
          created_at?: string
          credit_expense?: number | null
          disclosure_date?: string | null
          disclosure_place?: string | null
          email?: string | null
          employed_as?: string | null
          employed_since?: string | null
          employer_address?: string | null
          employer_name?: string | null
          employer_phone?: string | null
          employment_status?: string | null
          first_name?: string | null
          health_insurance_expense?: number | null
          id?: string
          income_job_two?: number | null
          income_rental?: number | null
          internal_notes?: string | null
          last_name?: string | null
          leasing_expense?: number | null
          life_insurance_expense?: number | null
          living_costs_expense?: number | null
          marital_status?: string | null
          miscellaneous_expense?: number | null
          mobile?: string | null
          mortgage_expense?: number | null
          nationality?: string | null
          phone?: string | null
          postal_code?: string | null
          property_insurance_expense?: number | null
          rent_expense?: number | null
          reserve_ratio?: number | null
          reserve_total?: number | null
          resident_since?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          salary_net_monthly?: number | null
          salary_type?: string | null
          salutation?: string | null
          sent_at?: string | null
          status?: string
          street?: string | null
          street_number?: string | null
          submitted_at?: string | null
          tax_id_ch?: string | null
          taxes_expense?: number | null
          telecom_expense?: number | null
          title?: string | null
          total_expenses_monthly?: number | null
          total_income_monthly?: number | null
          updated_at?: string
          utilities_expense?: number | null
        }
        Update: {
          additional_income?: number | null
          advisor_id?: string | null
          alimony_expense?: number | null
          annual_net_salary?: number | null
          benchmark_status?: string | null
          birth_country?: string | null
          birth_date?: string | null
          birth_name?: string | null
          birth_place?: string | null
          city?: string | null
          client_id?: string
          country?: string | null
          created_at?: string
          credit_expense?: number | null
          disclosure_date?: string | null
          disclosure_place?: string | null
          email?: string | null
          employed_as?: string | null
          employed_since?: string | null
          employer_address?: string | null
          employer_name?: string | null
          employer_phone?: string | null
          employment_status?: string | null
          first_name?: string | null
          health_insurance_expense?: number | null
          id?: string
          income_job_two?: number | null
          income_rental?: number | null
          internal_notes?: string | null
          last_name?: string | null
          leasing_expense?: number | null
          life_insurance_expense?: number | null
          living_costs_expense?: number | null
          marital_status?: string | null
          miscellaneous_expense?: number | null
          mobile?: string | null
          mortgage_expense?: number | null
          nationality?: string | null
          phone?: string | null
          postal_code?: string | null
          property_insurance_expense?: number | null
          rent_expense?: number | null
          reserve_ratio?: number | null
          reserve_total?: number | null
          resident_since?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          salary_net_monthly?: number | null
          salary_type?: string | null
          salutation?: string | null
          sent_at?: string | null
          status?: string
          street?: string | null
          street_number?: string | null
          submitted_at?: string | null
          tax_id_ch?: string | null
          taxes_expense?: number | null
          telecom_expense?: number | null
          title?: string | null
          total_expenses_monthly?: number | null
          total_income_monthly?: number | null
          updated_at?: string
          utilities_expense?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_self_disclosures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          agency_id: string | null
          archived_at: string | null
          area_max: number | null
          area_min: number | null
          assigned_to: string | null
          budget_max: number | null
          budget_min: number | null
          city: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          country: string | null
          created_at: string
          email: string | null
          equity: number | null
          financing_status: string | null
          full_name: string
          id: string
          is_archived: boolean
          notes: string | null
          owner_id: string | null
          phone: string | null
          postal_code: string | null
          preferred_cities: string[] | null
          preferred_listing: Database["public"]["Enums"]["listing_type"] | null
          preferred_locations: string[] | null
          preferred_property_types:
            | Database["public"]["Enums"]["property_type"][]
            | null
          preferred_types: Database["public"]["Enums"]["property_type"][] | null
          rooms_min: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          agency_id?: string | null
          archived_at?: string | null
          area_max?: number | null
          area_min?: number | null
          assigned_to?: string | null
          budget_max?: number | null
          budget_min?: number | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          country?: string | null
          created_at?: string
          email?: string | null
          equity?: number | null
          financing_status?: string | null
          full_name: string
          id?: string
          is_archived?: boolean
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_cities?: string[] | null
          preferred_listing?: Database["public"]["Enums"]["listing_type"] | null
          preferred_locations?: string[] | null
          preferred_property_types?:
            | Database["public"]["Enums"]["property_type"][]
            | null
          preferred_types?:
            | Database["public"]["Enums"]["property_type"][]
            | null
          rooms_min?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          agency_id?: string | null
          archived_at?: string | null
          area_max?: number | null
          area_min?: number | null
          assigned_to?: string | null
          budget_max?: number | null
          budget_min?: number | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          country?: string | null
          created_at?: string
          email?: string | null
          equity?: number | null
          financing_status?: string | null
          full_name?: string
          id?: string
          is_archived?: boolean
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_cities?: string[] | null
          preferred_listing?: Database["public"]["Enums"]["listing_type"] | null
          preferred_locations?: string[] | null
          preferred_property_types?:
            | Database["public"]["Enums"]["property_type"][]
            | null
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
          {
            foreignKeyName: "clients_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company: {
        Row: {
          address: string | null
          agency_id: string
          city: string | null
          commercial_register: string | null
          country: string | null
          created_at: string
          default_place: string | null
          default_signatory_name: string | null
          default_signatory_role: string | null
          email: string | null
          id: boolean
          legal_name: string | null
          logo_url: string | null
          name: string
          phone: string | null
          postal_code: string | null
          uid_number: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          agency_id: string
          city?: string | null
          commercial_register?: string | null
          country?: string | null
          created_at?: string
          default_place?: string | null
          default_signatory_name?: string | null
          default_signatory_role?: string | null
          email?: string | null
          id?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          uid_number?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          agency_id?: string
          city?: string | null
          commercial_register?: string | null
          country?: string | null
          created_at?: string
          default_place?: string | null
          default_signatory_name?: string | null
          default_signatory_role?: string | null
          email?: string | null
          id?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          uid_number?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          category: string | null
          content: string
          created_at: string
          default_variables: Json
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          variables: Json
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          default_variables?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          variables?: Json
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          default_variables?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          document_type: Database["public"]["Enums"]["document_type"]
          file_name: string | null
          file_url: string
          id: string
          mime_type: string | null
          notes: string | null
          related_id: string
          related_type: string
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          file_name?: string | null
          file_url: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          related_id: string
          related_type: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          file_name?: string | null
          file_url?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          related_id?: string
          related_type?: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financing_checklist_items: {
        Row: {
          created_at: string
          document_id: string | null
          dossier_id: string
          id: string
          is_present: boolean
          item_key: string
          label: string
          note: string | null
          section: Database["public"]["Enums"]["financing_checklist_section"]
          sort_order: number
          status: Database["public"]["Enums"]["financing_checklist_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          dossier_id: string
          id?: string
          is_present?: boolean
          item_key: string
          label: string
          note?: string | null
          section: Database["public"]["Enums"]["financing_checklist_section"]
          sort_order?: number
          status?: Database["public"]["Enums"]["financing_checklist_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          dossier_id?: string
          id?: string
          is_present?: boolean
          item_key?: string
          label?: string
          note?: string | null
          section?: Database["public"]["Enums"]["financing_checklist_section"]
          sort_order?: number
          status?: Database["public"]["Enums"]["financing_checklist_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financing_checklist_items_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "financing_dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      financing_dossiers: {
        Row: {
          affordability_ratio: number | null
          agency_id: string | null
          amortisation_yearly: number | null
          ancillary_costs_yearly: number | null
          bank_contact: string | null
          bank_decision_at: string | null
          bank_email: string | null
          bank_name: string | null
          bank_notes: string | null
          bank_phone: string | null
          bank_type: string | null
          calculated_interest_rate: number | null
          client_id: string
          completion_percent: number
          construction_additional_costs: number | null
          construction_costs: number | null
          created_at: string
          current_bank: string | null
          data_source: string | null
          dossier_status:
            | Database["public"]["Enums"]["financing_dossier_status"]
            | null
          existing_mortgage: number | null
          financing_modules: string[]
          financing_type: Database["public"]["Enums"]["financing_type"] | null
          gross_income_yearly: number | null
          id: string
          interest_rate_expiry: string | null
          internal_notes: string | null
          land_price: number | null
          loan_to_value_ratio: number | null
          new_total_mortgage: number | null
          own_funds_gift: number | null
          own_funds_inheritance: number | null
          own_funds_liquid: number | null
          own_funds_pension_fund: number | null
          own_funds_pillar_3a: number | null
          own_funds_private_loan: number | null
          own_funds_total: number | null
          own_funds_vested_benefits: number | null
          property_id: string | null
          property_snapshot: Json | null
          property_value: number | null
          purchase_additional_costs: number | null
          purchase_price: number | null
          quick_check_reasons: Json | null
          quick_check_status:
            | Database["public"]["Enums"]["financing_quick_check_status"]
            | null
          renovation_costs: number | null
          renovation_description: string | null
          renovation_value_increase: number | null
          requested_increase: number | null
          requested_mortgage: number | null
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
          submitted_to_bank_at: string | null
          title: string | null
          total_investment: number | null
          updated_at: string
          valuation_external_id: string | null
          valuation_price_per_sqm: number | null
          valuation_provider: string | null
          valuation_result: Json | null
          valuation_status: string | null
        }
        Insert: {
          affordability_ratio?: number | null
          agency_id?: string | null
          amortisation_yearly?: number | null
          ancillary_costs_yearly?: number | null
          bank_contact?: string | null
          bank_decision_at?: string | null
          bank_email?: string | null
          bank_name?: string | null
          bank_notes?: string | null
          bank_phone?: string | null
          bank_type?: string | null
          calculated_interest_rate?: number | null
          client_id: string
          completion_percent?: number
          construction_additional_costs?: number | null
          construction_costs?: number | null
          created_at?: string
          current_bank?: string | null
          data_source?: string | null
          dossier_status?:
            | Database["public"]["Enums"]["financing_dossier_status"]
            | null
          existing_mortgage?: number | null
          financing_modules?: string[]
          financing_type?: Database["public"]["Enums"]["financing_type"] | null
          gross_income_yearly?: number | null
          id?: string
          interest_rate_expiry?: string | null
          internal_notes?: string | null
          land_price?: number | null
          loan_to_value_ratio?: number | null
          new_total_mortgage?: number | null
          own_funds_gift?: number | null
          own_funds_inheritance?: number | null
          own_funds_liquid?: number | null
          own_funds_pension_fund?: number | null
          own_funds_pillar_3a?: number | null
          own_funds_private_loan?: number | null
          own_funds_total?: number | null
          own_funds_vested_benefits?: number | null
          property_id?: string | null
          property_snapshot?: Json | null
          property_value?: number | null
          purchase_additional_costs?: number | null
          purchase_price?: number | null
          quick_check_reasons?: Json | null
          quick_check_status?:
            | Database["public"]["Enums"]["financing_quick_check_status"]
            | null
          renovation_costs?: number | null
          renovation_description?: string | null
          renovation_value_increase?: number | null
          requested_increase?: number | null
          requested_mortgage?: number | null
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
          submitted_to_bank_at?: string | null
          title?: string | null
          total_investment?: number | null
          updated_at?: string
          valuation_external_id?: string | null
          valuation_price_per_sqm?: number | null
          valuation_provider?: string | null
          valuation_result?: Json | null
          valuation_status?: string | null
        }
        Update: {
          affordability_ratio?: number | null
          agency_id?: string | null
          amortisation_yearly?: number | null
          ancillary_costs_yearly?: number | null
          bank_contact?: string | null
          bank_decision_at?: string | null
          bank_email?: string | null
          bank_name?: string | null
          bank_notes?: string | null
          bank_phone?: string | null
          bank_type?: string | null
          calculated_interest_rate?: number | null
          client_id?: string
          completion_percent?: number
          construction_additional_costs?: number | null
          construction_costs?: number | null
          created_at?: string
          current_bank?: string | null
          data_source?: string | null
          dossier_status?:
            | Database["public"]["Enums"]["financing_dossier_status"]
            | null
          existing_mortgage?: number | null
          financing_modules?: string[]
          financing_type?: Database["public"]["Enums"]["financing_type"] | null
          gross_income_yearly?: number | null
          id?: string
          interest_rate_expiry?: string | null
          internal_notes?: string | null
          land_price?: number | null
          loan_to_value_ratio?: number | null
          new_total_mortgage?: number | null
          own_funds_gift?: number | null
          own_funds_inheritance?: number | null
          own_funds_liquid?: number | null
          own_funds_pension_fund?: number | null
          own_funds_pillar_3a?: number | null
          own_funds_private_loan?: number | null
          own_funds_total?: number | null
          own_funds_vested_benefits?: number | null
          property_id?: string | null
          property_snapshot?: Json | null
          property_value?: number | null
          purchase_additional_costs?: number | null
          purchase_price?: number | null
          quick_check_reasons?: Json | null
          quick_check_status?:
            | Database["public"]["Enums"]["financing_quick_check_status"]
            | null
          renovation_costs?: number | null
          renovation_description?: string | null
          renovation_value_increase?: number | null
          requested_increase?: number | null
          requested_mortgage?: number | null
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
          submitted_to_bank_at?: string | null
          title?: string | null
          total_investment?: number | null
          updated_at?: string
          valuation_external_id?: string | null
          valuation_price_per_sqm?: number | null
          valuation_provider?: string | null
          valuation_result?: Json | null
          valuation_status?: string | null
        }
        Relationships: []
      }
      financing_links: {
        Row: {
          agency_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          dossier_id: string | null
          expires_at: string
          id: string
          link_type: string
          token: string
          used_at: string | null
        }
        Insert: {
          agency_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          dossier_id?: string | null
          expires_at?: string
          id?: string
          link_type?: string
          token: string
          used_at?: string | null
        }
        Update: {
          agency_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          dossier_id?: string | null
          expires_at?: string
          id?: string
          link_type?: string
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
      financing_profiles: {
        Row: {
          approval_status: string | null
          assigned_to: string | null
          bank_contact: string | null
          bank_email: string | null
          bank_name: string | null
          bank_phone: string | null
          bank_type: string | null
          budget: number | null
          client_id: string
          created_at: string
          equity: number | null
          id: string
          income: number | null
          internal_notes: string | null
          notes: string | null
          profile_status: string
          updated_at: string
        }
        Insert: {
          approval_status?: string | null
          assigned_to?: string | null
          bank_contact?: string | null
          bank_email?: string | null
          bank_name?: string | null
          bank_phone?: string | null
          bank_type?: string | null
          budget?: number | null
          client_id: string
          created_at?: string
          equity?: number | null
          id?: string
          income?: number | null
          internal_notes?: string | null
          notes?: string | null
          profile_status?: string
          updated_at?: string
        }
        Update: {
          approval_status?: string | null
          assigned_to?: string | null
          bank_contact?: string | null
          bank_email?: string | null
          bank_name?: string | null
          bank_phone?: string | null
          bank_type?: string | null
          budget?: number | null
          client_id?: string
          created_at?: string
          equity?: number | null
          id?: string
          income?: number | null
          internal_notes?: string | null
          notes?: string | null
          profile_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financing_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_documents: {
        Row: {
          created_at: string
          created_by: string | null
          document_type: string | null
          esign_envelope_id: string | null
          esign_provider: string | null
          esign_signed_at: string | null
          esign_status: string | null
          esign_url: string | null
          file_url: string | null
          html_content: string | null
          id: string
          pdf_generated_at: string | null
          pdf_provider: string | null
          pdf_url: string | null
          recipients: Json
          related_id: string | null
          related_type: string | null
          sent_at: string | null
          status: string
          template_id: string | null
          title: string | null
          variables: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_type?: string | null
          esign_envelope_id?: string | null
          esign_provider?: string | null
          esign_signed_at?: string | null
          esign_status?: string | null
          esign_url?: string | null
          file_url?: string | null
          html_content?: string | null
          id?: string
          pdf_generated_at?: string | null
          pdf_provider?: string | null
          pdf_url?: string | null
          recipients?: Json
          related_id?: string | null
          related_type?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          title?: string | null
          variables?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_type?: string | null
          esign_envelope_id?: string | null
          esign_provider?: string | null
          esign_signed_at?: string | null
          esign_status?: string | null
          esign_url?: string | null
          file_url?: string | null
          html_content?: string | null
          id?: string
          pdf_generated_at?: string | null
          pdf_provider?: string | null
          pdf_url?: string | null
          recipients?: Json
          related_id?: string | null
          related_type?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          title?: string | null
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          agency_id: string | null
          assigned_to: string | null
          budget_max: number | null
          budget_min: number | null
          converted_client_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          interest_type: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          preferred_location: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          assigned_to?: string | null
          budget_max?: number | null
          budget_min?: number | null
          converted_client_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          interest_type?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          preferred_location?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          assigned_to?: string | null
          budget_max?: number | null
          budget_min?: number | null
          converted_client_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          interest_type?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          preferred_location?: string | null
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
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      mandates: {
        Row: {
          client_id: string | null
          commission_model: string | null
          commission_value: number | null
          created_at: string
          generated_document_id: string | null
          id: string
          mandate_type: string
          notes: string | null
          property_id: string | null
          status: Database["public"]["Enums"]["mandate_status"]
          template_id: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          client_id?: string | null
          commission_model?: string | null
          commission_value?: number | null
          created_at?: string
          generated_document_id?: string | null
          id?: string
          mandate_type?: string
          notes?: string | null
          property_id?: string | null
          status?: Database["public"]["Enums"]["mandate_status"]
          template_id?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          client_id?: string | null
          commission_model?: string | null
          commission_value?: number | null
          created_at?: string
          generated_document_id?: string | null
          id?: string
          mandate_type?: string
          notes?: string | null
          property_id?: string | null
          status?: Database["public"]["Enums"]["mandate_status"]
          template_id?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mandates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_generated_document_id_fkey"
            columns: ["generated_document_id"]
            isOneToOne: false
            referencedRelation: "generated_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          agency_id: string | null
          client_id: string
          created_at: string
          id: string
          notes: string | null
          property_id: string
          reasons: Json | null
          score: number
          status: Database["public"]["Enums"]["match_status"]
        }
        Insert: {
          agency_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          property_id: string
          reasons?: Json | null
          score?: number
          status?: Database["public"]["Enums"]["match_status"]
        }
        Update: {
          agency_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          property_id?: string
          reasons?: Json | null
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
      nda_agreements: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          generated_document_id: string | null
          id: string
          nda_type: string
          notes: string | null
          property_id: string | null
          status: string
          template_id: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          generated_document_id?: string | null
          id?: string
          nda_type?: string
          notes?: string | null
          property_id?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          generated_document_id?: string | null
          id?: string
          nda_type?: string
          notes?: string | null
          property_id?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agency_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          agency_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          agency_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_role?: Database["public"]["Enums"]["user_role"]
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
          agency_id: string | null
          area: number | null
          assigned_to: string | null
          availability_date: string | null
          balcony_area: number | null
          bathrooms: number | null
          building_type: string | null
          cellar_available: boolean | null
          city: string | null
          condition: string | null
          country: string | null
          created_at: string
          description: string | null
          energy_class: string | null
          energy_source: string | null
          features: string[] | null
          floor: number | null
          garden_area: number | null
          heating_type: string | null
          id: string
          images: string[] | null
          internal_minimum_price: number | null
          internal_notes: string | null
          is_unit: boolean
          listing_type: Database["public"]["Enums"]["listing_type"]
          living_area: number | null
          marketing_type: string | null
          owner_client_id: string | null
          owner_id: string | null
          parent_property_id: string | null
          parking_spaces: number | null
          plot_area: number | null
          postal_code: string | null
          price: number | null
          property_type: Database["public"]["Enums"]["property_type"]
          renovated_at: number | null
          rent: number | null
          reservation_amount_default: number | null
          rooms: number | null
          seller_client_id: string | null
          status: Database["public"]["Enums"]["property_status"]
          terrace_area: number | null
          title: string
          total_floors: number | null
          unit_floor: string | null
          unit_number: string | null
          unit_status: string | null
          unit_type: string | null
          updated_at: string
          usable_area: number | null
          year_built: number | null
        }
        Insert: {
          address?: string | null
          agency_id?: string | null
          area?: number | null
          assigned_to?: string | null
          availability_date?: string | null
          balcony_area?: number | null
          bathrooms?: number | null
          building_type?: string | null
          cellar_available?: boolean | null
          city?: string | null
          condition?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          energy_class?: string | null
          energy_source?: string | null
          features?: string[] | null
          floor?: number | null
          garden_area?: number | null
          heating_type?: string | null
          id?: string
          images?: string[] | null
          internal_minimum_price?: number | null
          internal_notes?: string | null
          is_unit?: boolean
          listing_type?: Database["public"]["Enums"]["listing_type"]
          living_area?: number | null
          marketing_type?: string | null
          owner_client_id?: string | null
          owner_id?: string | null
          parent_property_id?: string | null
          parking_spaces?: number | null
          plot_area?: number | null
          postal_code?: string | null
          price?: number | null
          property_type?: Database["public"]["Enums"]["property_type"]
          renovated_at?: number | null
          rent?: number | null
          reservation_amount_default?: number | null
          rooms?: number | null
          seller_client_id?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          terrace_area?: number | null
          title: string
          total_floors?: number | null
          unit_floor?: string | null
          unit_number?: string | null
          unit_status?: string | null
          unit_type?: string | null
          updated_at?: string
          usable_area?: number | null
          year_built?: number | null
        }
        Update: {
          address?: string | null
          agency_id?: string | null
          area?: number | null
          assigned_to?: string | null
          availability_date?: string | null
          balcony_area?: number | null
          bathrooms?: number | null
          building_type?: string | null
          cellar_available?: boolean | null
          city?: string | null
          condition?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          energy_class?: string | null
          energy_source?: string | null
          features?: string[] | null
          floor?: number | null
          garden_area?: number | null
          heating_type?: string | null
          id?: string
          images?: string[] | null
          internal_minimum_price?: number | null
          internal_notes?: string | null
          is_unit?: boolean
          listing_type?: Database["public"]["Enums"]["listing_type"]
          living_area?: number | null
          marketing_type?: string | null
          owner_client_id?: string | null
          owner_id?: string | null
          parent_property_id?: string | null
          parking_spaces?: number | null
          plot_area?: number | null
          postal_code?: string | null
          price?: number | null
          property_type?: Database["public"]["Enums"]["property_type"]
          renovated_at?: number | null
          rent?: number | null
          reservation_amount_default?: number | null
          rooms?: number | null
          seller_client_id?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          terrace_area?: number | null
          title?: string
          total_floors?: number | null
          unit_floor?: string | null
          unit_number?: string | null
          unit_status?: string | null
          unit_type?: string | null
          updated_at?: string
          usable_area?: number | null
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
            foreignKeyName: "properties_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_owner_client_id_fkey"
            columns: ["owner_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_parent_property_id_fkey"
            columns: ["parent_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
      property_media: {
        Row: {
          created_at: string
          description: string | null
          file_name: string | null
          file_type: string | null
          file_url: string
          id: string
          is_cover: boolean
          property_id: string
          sort_order: number
          title: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          is_cover?: boolean
          property_id: string
          sort_order?: number
          title?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_cover?: boolean
          property_id?: string
          sort_order?: number
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_media_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          client_id: string | null
          created_at: string
          generated_document_id: string | null
          id: string
          notes: string | null
          property_id: string | null
          reservation_fee: number | null
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          generated_document_id?: string | null
          id?: string
          notes?: string | null
          property_id?: string | null
          reservation_fee?: number | null
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          generated_document_id?: string | null
          id?: string
          notes?: string | null
          property_id?: string | null
          reservation_fee?: number | null
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_generated_document_id_fkey"
            columns: ["generated_document_id"]
            isOneToOne: false
            referencedRelation: "generated_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          related_id: string | null
          related_type: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          related_id?: string | null
          related_type?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          related_id?: string | null
          related_type?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      is_owner_or_admin: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      self_disclosure_link_resolve: {
        Args: { _token: string }
        Returns: {
          client_id: string
          client_name: string
          disclosure: Json
          status: string
        }[]
      }
      self_disclosure_link_save: {
        Args: { _payload: Json; _token: string }
        Returns: undefined
      }
      self_disclosure_link_submit: {
        Args: { _token: string }
        Returns: undefined
      }
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
      client_relationship_type:
        | "spouse"
        | "co_applicant"
        | "co_investor"
        | "other"
      client_type:
        | "buyer"
        | "seller"
        | "tenant"
        | "landlord"
        | "investor"
        | "other"
        | "owner"
      document_type:
        | "client_document"
        | "property_document"
        | "contract"
        | "mandate"
        | "reservation"
        | "financing"
        | "media"
        | "other"
        | "nda"
        | "reservation_receipt"
        | "mandate_partial"
      financing_checklist_section:
        | "customer"
        | "financing_structure"
        | "property_docs"
        | "income_employment"
        | "tax"
        | "self_employed"
        | "affordability"
        | "additional_check"
        | "submission_quality"
        | "rejection_reasons"
      financing_checklist_status:
        | "open"
        | "present"
        | "missing"
        | "not_relevant"
      financing_dossier_status:
        | "draft"
        | "quick_check"
        | "documents_missing"
        | "ready_for_bank"
        | "submitted_to_bank"
        | "approved"
        | "rejected"
        | "cancelled"
      financing_quick_check_status:
        | "realistic"
        | "critical"
        | "not_financeable"
        | "incomplete"
      financing_status: "draft" | "submitted" | "reviewed"
      financing_type:
        | "purchase"
        | "renovation"
        | "increase"
        | "refinance"
        | "new_build"
        | "mortgage_increase"
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
      client_relationship_type: [
        "spouse",
        "co_applicant",
        "co_investor",
        "other",
      ],
      client_type: [
        "buyer",
        "seller",
        "tenant",
        "landlord",
        "investor",
        "other",
        "owner",
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
        "nda",
        "reservation_receipt",
        "mandate_partial",
      ],
      financing_checklist_section: [
        "customer",
        "financing_structure",
        "property_docs",
        "income_employment",
        "tax",
        "self_employed",
        "affordability",
        "additional_check",
        "submission_quality",
        "rejection_reasons",
      ],
      financing_checklist_status: [
        "open",
        "present",
        "missing",
        "not_relevant",
      ],
      financing_dossier_status: [
        "draft",
        "quick_check",
        "documents_missing",
        "ready_for_bank",
        "submitted_to_bank",
        "approved",
        "rejected",
        "cancelled",
      ],
      financing_quick_check_status: [
        "realistic",
        "critical",
        "not_financeable",
        "incomplete",
      ],
      financing_status: ["draft", "submitted", "reviewed"],
      financing_type: [
        "purchase",
        "renovation",
        "increase",
        "refinance",
        "new_build",
        "mortgage_increase",
      ],
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

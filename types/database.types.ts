export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          created_at: string
          details: string | null
          id: number
          ip_address: string | null
          target_id: string | null
          target_name: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          details?: string | null
          id?: number
          ip_address?: string | null
          target_id?: string | null
          target_name?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          details?: string | null
          id?: number
          ip_address?: string | null
          target_id?: string | null
          target_name?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      ai_abuse_blocks: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          is_active: boolean
          reason: string
          visitor_key: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          reason: string
          visitor_key?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          reason?: string
          visitor_key?: string | null
        }
        Relationships: []
      }
      ai_abuse_events: {
        Row: {
          blocked: boolean
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          message: string | null
          severity: number
          visitor_key: string | null
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          message?: string | null
          severity?: number
          visitor_key?: string | null
        }
        Update: {
          blocked?: boolean
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          message?: string | null
          severity?: number
          visitor_key?: string | null
        }
        Relationships: []
      }
      ai_consult_feedback: {
        Row: {
          comment: string | null
          consult_id: string
          created_at: string
          id: string
          question_text: string | null
          rating: number
          turn_index: number
          turn_text: string | null
        }
        Insert: {
          comment?: string | null
          consult_id: string
          created_at?: string
          id?: string
          question_text?: string | null
          rating: number
          turn_index: number
          turn_text?: string | null
        }
        Update: {
          comment?: string | null
          consult_id?: string
          created_at?: string
          id?: string
          question_text?: string | null
          rating?: number
          turn_index?: number
          turn_text?: string | null
        }
        Relationships: []
      }
      ai_consult_logs: {
        Row: {
          consulted_at: string
          created_at: string
          id: string
          intent_category: string | null
          ip_address: string | null
          is_recommendation: boolean | null
          keywords: string[] | null
          location_type: string | null
          question_text: string
          store_id: string | null
          visitor_key: string | null
        }
        Insert: {
          consulted_at?: string
          created_at?: string
          id?: string
          intent_category?: string | null
          ip_address?: string | null
          is_recommendation?: boolean | null
          keywords?: string[] | null
          location_type?: string | null
          question_text: string
          store_id?: string | null
          visitor_key?: string | null
        }
        Update: {
          consulted_at?: string
          created_at?: string
          id?: string
          intent_category?: string | null
          ip_address?: string | null
          is_recommendation?: boolean | null
          keywords?: string[] | null
          location_type?: string | null
          question_text?: string
          store_id?: string | null
          visitor_key?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      content_reactions: {
        Row: {
          created_at: string
          id: number
          vendor_content_id: string
          visitor_key: string
        }
        Insert: {
          created_at?: string
          id?: number
          vendor_content_id: string
          visitor_key: string
        }
        Update: {
          created_at?: string
          id?: number
          vendor_content_id?: string
          visitor_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reactions_vendor_content_id_fkey"
            columns: ["vendor_content_id"]
            isOneToOne: false
            referencedRelation: "vendor_contents"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          email: string
          id: string
          message: string
          name: string | null
          replied_at: string | null
          replied_by: string | null
          reply_notes: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          email: string
          id?: string
          message: string
          name?: string | null
          replied_at?: string | null
          replied_by?: string | null
          reply_notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string | null
          replied_at?: string | null
          replied_by?: string | null
          reply_notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      knowledge_embeddings: {
        Row: {
          category: string | null
          content: string | null
          embedding: string | null
          id: string
          image_url: string | null
          title: string | null
        }
        Insert: {
          category?: string | null
          content?: string | null
          embedding?: string | null
          id: string
          image_url?: string | null
          title?: string | null
        }
        Update: {
          category?: string | null
          content?: string | null
          embedding?: string | null
          id?: string
          image_url?: string | null
          title?: string | null
        }
        Relationships: []
      }
      location_assignments: {
        Row: {
          created_at: string | null
          id: string
          location_id: string
          market_date: string
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          location_id: string
          market_date: string
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          location_id?: string
          market_date?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_assignments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "market_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_assignments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      map_landmarks: {
        Row: {
          category: string
          created_at: string
          description: string
          external_url: string | null
          height_px: number
          image_url: string
          key: string
          latitude: number
          lines: string[]
          longitude: number
          name: string
          notes: string | null
          open_from: string | null
          open_until: string | null
          photo_credit: string | null
          photo_url: string | null
          show_at_min_zoom: boolean
          show_on_map: boolean
          tags: string[]
          transit_mode: string | null
          updated_at: string
          verified: boolean
          width_px: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          external_url?: string | null
          height_px: number
          image_url: string
          key: string
          latitude: number
          lines?: string[]
          longitude: number
          name: string
          notes?: string | null
          open_from?: string | null
          open_until?: string | null
          photo_credit?: string | null
          photo_url?: string | null
          show_at_min_zoom?: boolean
          show_on_map?: boolean
          tags?: string[]
          transit_mode?: string | null
          updated_at?: string
          verified?: boolean
          width_px: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          external_url?: string | null
          height_px?: number
          image_url?: string
          key?: string
          latitude?: number
          lines?: string[]
          longitude?: number
          name?: string
          notes?: string | null
          open_from?: string | null
          open_until?: string | null
          photo_credit?: string | null
          photo_url?: string | null
          show_at_min_zoom?: boolean
          show_on_map?: boolean
          tags?: string[]
          transit_mode?: string | null
          updated_at?: string
          verified?: boolean
          width_px?: number
        }
        Relationships: []
      }
      map_layout_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          landmarks_json: Json
          roads_json: Json
          route_config_json: Json
          route_json: Json
          shops_json: Json
          summary: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          landmarks_json: Json
          roads_json?: Json
          route_config_json?: Json
          route_json?: Json
          shops_json: Json
          summary?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          landmarks_json?: Json
          roads_json?: Json
          route_config_json?: Json
          route_json?: Json
          shops_json?: Json
          summary?: Json | null
        }
        Relationships: []
      }
      map_roads: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          updated_at: string
          width_meters: number
        }
        Insert: {
          created_at?: string
          id: string
          kind?: string
          name: string
          updated_at?: string
          width_meters?: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          updated_at?: string
          width_meters?: number
        }
        Relationships: []
      }
      map_route_configs: {
        Row: {
          created_at: string
          key: string
          road_half_width_meters: number
          snap_distance_meters: number
          updated_at: string
          visible_distance_meters: number
        }
        Insert: {
          created_at?: string
          key: string
          road_half_width_meters?: number
          snap_distance_meters?: number
          updated_at?: string
          visible_distance_meters?: number
        }
        Update: {
          created_at?: string
          key?: string
          road_half_width_meters?: number
          snap_distance_meters?: number
          updated_at?: string
          visible_distance_meters?: number
        }
        Relationships: []
      }
      map_route_points: {
        Row: {
          branch_from_id: string | null
          created_at: string
          id: string
          latitude: number
          longitude: number
          road_id: string | null
          sort_order: number
        }
        Insert: {
          branch_from_id?: string | null
          created_at?: string
          id: string
          latitude: number
          longitude: number
          road_id?: string | null
          sort_order: number
        }
        Update: {
          branch_from_id?: string | null
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          road_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "map_route_points_branch_from_id_fkey"
            columns: ["branch_from_id"]
            isOneToOne: false
            referencedRelation: "map_route_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_route_points_road_id_fkey"
            columns: ["road_id"]
            isOneToOne: false
            referencedRelation: "map_roads"
            referencedColumns: ["id"]
          },
        ]
      }
      market_days: {
        Row: {
          created_at: string
          market_date: string
          note: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          market_date: string
          note?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          market_date?: string
          note?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      market_events: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          end_time: string | null
          event_date: string
          highlight_dates: string[]
          id: string
          image_url: string | null
          is_published: boolean
          location: string | null
          start_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          event_date: string
          highlight_dates?: string[]
          id?: string
          image_url?: string | null
          is_published?: boolean
          location?: string | null
          start_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          event_date?: string
          highlight_dates?: string[]
          id?: string
          image_url?: string | null
          is_published?: boolean
          location?: string | null
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_locations: {
        Row: {
          created_at: string | null
          district: string | null
          id: string
          latitude: number
          longitude: number
          store_number: number
        }
        Insert: {
          created_at?: string | null
          district?: string | null
          id?: string
          latitude: number
          longitude: number
          store_number: number
        }
        Update: {
          created_at?: string | null
          district?: string | null
          id?: string
          latitude?: number
          longitude?: number
          store_number?: number
        }
        Relationships: []
      }
      product_sales: {
        Row: {
          created_at: string
          id: string
          product_name: string
          quantity: number
          sale_date: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_name: string
          quantity: number
          sale_date?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_name?: string
          quantity?: number
          sale_date?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_sales_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      product_search_logs: {
        Row: {
          id: string
          keyword: string
          result_count: number
          searched_at: string
        }
        Insert: {
          id?: string
          keyword: string
          result_count?: number
          searched_at?: string
        }
        Update: {
          id?: string
          keyword?: string
          result_count?: number
          searched_at?: string
        }
        Relationships: []
      }
      product_seasons: {
        Row: {
          product_id: string
          season_id: number
        }
        Insert: {
          product_id: string
          season_id: number
        }
        Update: {
          product_id?: string
          season_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_seasons_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          name: string
          price: number | null
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name: string
          price?: number | null
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name?: string
          price?: number | null
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      report_readers: {
        Row: {
          added_at: string
          email: string
          id: string
          note: string | null
        }
        Insert: {
          added_at?: string
          email: string
          id?: string
          note?: string | null
        }
        Update: {
          added_at?: string
          email?: string
          id?: string
          note?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_email: string | null
          reporter_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: string
          target_name: string | null
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_email?: string | null
          reporter_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id: string
          target_name?: string | null
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_email?: string | null
          reporter_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string
          target_name?: string | null
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      seasons: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id: number
          name: string
        }
        Update: {
          id?: number
          name?: string
        }
        Relationships: []
      }
      security_reports: {
        Row: {
          anomaly_count: number
          created_at: string
          html_content: string
          id: string
          report_date: string
          risk_level: string
          summary: string
          total_coupon_actions: number
          total_page_visits: number
          total_visitors: number
          week_end: string
          week_start: string
        }
        Insert: {
          anomaly_count?: number
          created_at?: string
          html_content: string
          id?: string
          report_date: string
          risk_level?: string
          summary?: string
          total_coupon_actions?: number
          total_page_visits?: number
          total_visitors?: number
          week_end: string
          week_start: string
        }
        Update: {
          anomaly_count?: number
          created_at?: string
          html_content?: string
          id?: string
          report_date?: string
          risk_level?: string
          summary?: string
          total_coupon_actions?: number
          total_page_visits?: number
          total_visitors?: number
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      shop_attendance_vendor: {
        Row: {
          created_at: string
          id: string
          is_open: boolean
          shop_id: string
          updated_at: string
          vendor_confirmed: boolean
          vendor_id: string
          vote_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_open: boolean
          shop_id: string
          updated_at?: string
          vendor_confirmed?: boolean
          vendor_id: string
          vote_date: string
        }
        Update: {
          created_at?: string
          id?: string
          is_open?: boolean
          shop_id?: string
          updated_at?: string
          vendor_confirmed?: boolean
          vendor_id?: string
          vote_date?: string
        }
        Relationships: []
      }
      shop_attendance_votes: {
        Row: {
          created_at: string
          id: string
          shop_id: string
          updated_at: string
          user_id: string
          vote_date: string
          vote_yes: boolean
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          shop_id: string
          updated_at?: string
          user_id: string
          vote_date: string
          vote_yes: boolean
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          shop_id?: string
          updated_at?: string
          user_id?: string
          vote_date?: string
          vote_yes?: boolean
          weight?: number
        }
        Relationships: []
      }
      shop_page_views: {
        Row: {
          id: string
          source: string | null
          vendor_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          source?: string | null
          vendor_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          source?: string | null
          vendor_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_page_views_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      shops_import: {
        Row: {
          lat: number | null
          legacy_id: number | null
          lng: number | null
        }
        Insert: {
          lat?: number | null
          legacy_id?: number | null
          lng?: number | null
        }
        Update: {
          lat?: number | null
          legacy_id?: number | null
          lng?: number | null
        }
        Relationships: []
      }
      shops_name_staging: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      shops_strong: {
        Row: {
          legacy_id: number | null
          shop_strength: string | null
        }
        Insert: {
          legacy_id?: number | null
          shop_strength?: string | null
        }
        Update: {
          legacy_id?: number | null
          shop_strength?: string | null
        }
        Relationships: []
      }
      shops_topic_import: {
        Row: {
          id: string
          topic: Json | null
        }
        Insert: {
          id: string
          topic?: Json | null
        }
        Update: {
          id?: string
          topic?: Json | null
        }
        Relationships: []
      }
      store_knowledge: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_knowledge_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      todos: {
        Row: {
          id: string
          todo: string
        }
        Insert: {
          id?: string
          todo: string
        }
        Update: {
          id?: string
          todo?: string
        }
        Relationships: []
      }
      vendor_contents: {
        Row: {
          body: string | null
          category_id: string | null
          created_at: string | null
          expires_at: string
          id: string
          image_url: string | null
          status: string
          title: string | null
          vendor_id: string
        }
        Insert: {
          body?: string | null
          category_id?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          image_url?: string | null
          status?: string
          title?: string | null
          vendor_id: string
        }
        Update: {
          body?: string | null
          category_id?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          image_url?: string | null
          status?: string
          title?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_contents_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_embeddings: {
        Row: {
          content: string
          embedding: string
          shop_name: string | null
          store_number: number | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          content: string
          embedding: string
          shop_name?: string | null
          store_number?: number | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          content?: string
          embedding?: string
          shop_name?: string | null
          store_number?: number | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_embeddings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_owner_profiles: {
        Row: {
          created_at: string
          is_public: boolean
          owner_name: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          is_public?: boolean
          owner_name?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          is_public?: boolean
          owner_name?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_owner_profiles_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          business_hours_end: string | null
          business_hours_start: string | null
          category_id: string | null
          closed_dates: string[]
          created_at: string | null
          id: string
          main_product_prices: Json | null
          main_products: string[] | null
          must_change_password: boolean | null
          payment_methods: string[] | null
          rain_policy: string | null
          role: string | null
          schedule: string[] | null
          shop_image_url: string | null
          shop_name: string
          sns_hp: string | null
          sns_instagram: string | null
          sns_x: string | null
          strength: string | null
          style: string | null
          style_tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          business_hours_end?: string | null
          business_hours_start?: string | null
          category_id?: string | null
          closed_dates?: string[]
          created_at?: string | null
          id: string
          main_product_prices?: Json | null
          main_products?: string[] | null
          must_change_password?: boolean | null
          payment_methods?: string[] | null
          rain_policy?: string | null
          role?: string | null
          schedule?: string[] | null
          shop_image_url?: string | null
          shop_name: string
          sns_hp?: string | null
          sns_instagram?: string | null
          sns_x?: string | null
          strength?: string | null
          style?: string | null
          style_tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          business_hours_end?: string | null
          business_hours_start?: string | null
          category_id?: string | null
          closed_dates?: string[]
          created_at?: string | null
          id?: string
          main_product_prices?: Json | null
          main_products?: string[] | null
          must_change_password?: boolean | null
          payment_methods?: string[] | null
          rain_policy?: string | null
          role?: string | null
          schedule?: string[] | null
          shop_image_url?: string | null
          shop_name?: string
          sns_hp?: string | null
          sns_instagram?: string | null
          sns_x?: string | null
          strength?: string | null
          style?: string | null
          style_tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      web_page_daily_summaries: {
        Row: {
          unique_visitors: number
          updated_at: string
          vendor_unique_visitors: number
          visit_date: string
        }
        Insert: {
          unique_visitors?: number
          updated_at?: string
          vendor_unique_visitors?: number
          visit_date: string
        }
        Update: {
          unique_visitors?: number
          updated_at?: string
          vendor_unique_visitors?: number
          visit_date?: string
        }
        Relationships: []
      }
      web_page_analytics: {
        Row: {
          created_at: string
          duration_seconds: number
          id: number
          path: string
          user_role: string | null
          visit_date: string
          visitor_key: string
        }
        Insert: {
          created_at?: string
          duration_seconds: number
          id?: number
          path: string
          user_role?: string | null
          visit_date: string
          visitor_key: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          id?: number
          path?: string
          user_role?: string | null
          visit_date?: string
          visitor_key?: string
        }
        Relationships: []
      }
      web_visitor_daily_uniques: {
        Row: {
          created_at: string | null
          visit_date: string
          visitor_key: string
        }
        Insert: {
          created_at?: string | null
          visit_date: string
          visitor_key: string
        }
        Update: {
          created_at?: string | null
          visit_date?: string
          visitor_key?: string
        }
        Relationships: []
      }
      web_visitor_stats: {
        Row: {
          created_at: string | null
          updated_at: string | null
          visit_date: string
          visitor_count: number
        }
        Insert: {
          created_at?: string | null
          updated_at?: string | null
          visit_date: string
          visitor_count: number
        }
        Update: {
          created_at?: string | null
          updated_at?: string | null
          visit_date?: string
          visitor_count?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_reaction_counts: {
        Args: { content_ids: string[] }
        Returns: {
          cnt: number
          vendor_content_id: string
        }[]
      }
      get_shop_attendance_estimates: {
        Args: { target_date: string }
        Returns: {
          evidence_summary: string
          label: string
          n_eff: number
          p: number
          shop_id: string
          vendor_override: boolean
        }[]
      }
      match_knowledge_embeddings: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          id: string
          similarity: number
        }[]
      }
      match_store_knowledge: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
          target_store_id: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          store_id: string
        }[]
      }
      match_vendor_embeddings: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          similarity: number
          vendor_id: string
        }[]
      }
      replace_map_route_points: { Args: { p_points: Json }; Returns: undefined }
      restore_map_layout_snapshot: {
        Args: {
          p_landmarks: Json
          p_roads?: Json
          p_route_config: Json
          p_route_points: Json
          p_shops: Json
        }
        Returns: undefined
      }
      save_roads_and_points: {
        Args: { p_points: Json; p_removed_road_ids?: Json; p_roads: Json }
        Returns: undefined
      }
      track_home_visit: {
        Args: { p_visit_date: string; p_visitor_key: string }
        Returns: boolean
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const


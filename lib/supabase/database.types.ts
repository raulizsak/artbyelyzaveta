export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          safe_metadata: Json
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          safe_metadata?: Json
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          safe_metadata?: Json
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      commission_enquiries: {
        Row: {
          budget: string | null
          consent: boolean
          created_at: string
          dimensions: string | null
          email: string
          id: string
          inspiration: string | null
          legacy_convex_id: string | null
          name: string
          notes: string | null
          phone: string | null
          status: string
          subject: string
          timing: string | null
          updated_at: string
        }
        Insert: {
          budget?: string | null
          consent: boolean
          created_at?: string
          dimensions?: string | null
          email: string
          id?: string
          inspiration?: string | null
          legacy_convex_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          status?: string
          subject: string
          timing?: string | null
          updated_at?: string
        }
        Update: {
          budget?: string | null
          consent?: boolean
          created_at?: string
          dimensions?: string | null
          email?: string
          id?: string
          inspiration?: string | null
          legacy_convex_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          status?: string
          subject?: string
          timing?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      commission_inspiration_files: {
        Row: {
          bytes: number
          commission_enquiry_id: string
          created_at: string
          id: string
          legacy_storage_id: string | null
          mime_type: string
          storage_path: string
        }
        Insert: {
          bytes: number
          commission_enquiry_id: string
          created_at?: string
          id?: string
          legacy_storage_id?: string | null
          mime_type: string
          storage_path: string
        }
        Update: {
          bytes?: number
          commission_enquiry_id?: string
          created_at?: string
          id?: string
          legacy_storage_id?: string | null
          mime_type?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_inspiration_files_commission_enquiry_id_fkey"
            columns: ["commission_enquiry_id"]
            isOneToOne: false
            referencedRelation: "commission_enquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_enquiries: {
        Row: {
          consent: boolean
          created_at: string
          email: string
          id: string
          legacy_convex_id: string | null
          message: string
          name: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          consent: boolean
          created_at?: string
          email: string
          id?: string
          legacy_convex_id?: string | null
          message: string
          name: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          consent?: boolean
          created_at?: string
          email?: string
          id?: string
          legacy_convex_id?: string | null
          message?: string
          name?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          country: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          line1: string
          line2: string | null
          postcode: string
          recipient_name: string
          state: string
          suburb: string
          updated_at: string
          user_id: string
        }
        Insert: {
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          line1: string
          line2?: string | null
          postcode: string
          recipient_name: string
          state: string
          suburb: string
          updated_at?: string
          user_id: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          line1?: string
          line2?: string | null
          postcode?: string
          recipient_name?: string
          state?: string
          suburb?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_outbox: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string
          id: string
          last_error: string | null
          next_attempt_at: string
          order_id: string | null
          payload: Json
          provider_message_id: string | null
          recipient: string
          sent_at: string | null
          status: string
          template: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          order_id?: string | null
          payload?: Json
          provider_message_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: string
          template: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          order_id?: string | null
          payload?: Json
          provider_message_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
          template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          id: string
          invoice_reference: string
          issued_at: string
          order_id: string
          storage_path: string | null
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_reference: string
          issued_at?: string
          order_id: string
          storage_path?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_reference?: string
          issued_at?: string
          order_id?: string
          storage_path?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_type: string
          actor_user_id: string | null
          created_at: string
          customer_safe_description: string
          event_type: string
          id: string
          internal_metadata: Json
          order_id: string
          stripe_event_id: string | null
        }
        Insert: {
          actor_type: string
          actor_user_id?: string | null
          created_at?: string
          customer_safe_description: string
          event_type: string
          id?: string
          internal_metadata?: Json
          order_id: string
          stripe_event_id?: string | null
        }
        Update: {
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          customer_safe_description?: string
          event_type?: string
          id?: string
          internal_metadata?: Json
          order_id?: string
          stripe_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          dimensions: string | null
          id: string
          image_path: string | null
          line_total_cents: number
          medium: string | null
          order_id: string
          painting_id: string | null
          painting_slug: string
          quantity: number
          title: string
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          dimensions?: string | null
          id?: string
          image_path?: string | null
          line_total_cents: number
          medium?: string | null
          order_id: string
          painting_id?: string | null
          painting_slug: string
          quantity?: number
          title: string
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          dimensions?: string | null
          id?: string
          image_path?: string | null
          line_total_cents?: number
          medium?: string | null
          order_id?: string
          painting_id?: string | null
          painting_slug?: string
          quantity?: number
          title?: string
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_painting_id_fkey"
            columns: ["painting_id"]
            isOneToOne: false
            referencedRelation: "paintings"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_refunded_cents: number
          billing_address: Json | null
          cancelled_at: string | null
          commission_eta: string | null
          commission_stage: string | null
          created_at: string
          currency: string
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          customer_phone: string | null
          customer_status_message: string | null
          customer_user_id: string | null
          delivered_at: string | null
          delivery_method: string
          delivery_notes: string | null
          expected_dispatch: string | null
          fulfillment_status: string
          guest_access_expires_at: string | null
          guest_access_token_hash: string | null
          id: string
          internal_admin_notes: string | null
          normalized_email: string | null
          order_reference: string
          order_status: string
          order_type: string
          paid_at: string | null
          payment_status: string
          refund_status: string
          reservation_expires_at: string | null
          shipped_at: string | null
          shipping_address: Json
          shipping_cents: number
          shipping_method: string | null
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          tracking_carrier: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          amount_refunded_cents?: number
          billing_address?: Json | null
          cancelled_at?: string | null
          commission_eta?: string | null
          commission_stage?: string | null
          created_at?: string
          currency?: string
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          customer_phone?: string | null
          customer_status_message?: string | null
          customer_user_id?: string | null
          delivered_at?: string | null
          delivery_method?: string
          delivery_notes?: string | null
          expected_dispatch?: string | null
          fulfillment_status?: string
          guest_access_expires_at?: string | null
          guest_access_token_hash?: string | null
          id?: string
          internal_admin_notes?: string | null
          normalized_email?: string | null
          order_reference: string
          order_status?: string
          order_type?: string
          paid_at?: string | null
          payment_status?: string
          refund_status?: string
          reservation_expires_at?: string | null
          shipped_at?: string | null
          shipping_address?: Json
          shipping_cents?: number
          shipping_method?: string | null
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal_cents: number
          tax_cents?: number
          total_cents: number
          tracking_carrier?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          amount_refunded_cents?: number
          billing_address?: Json | null
          cancelled_at?: string | null
          commission_eta?: string | null
          commission_stage?: string | null
          created_at?: string
          currency?: string
          customer_email?: string
          customer_first_name?: string
          customer_last_name?: string
          customer_phone?: string | null
          customer_status_message?: string | null
          customer_user_id?: string | null
          delivered_at?: string | null
          delivery_method?: string
          delivery_notes?: string | null
          expected_dispatch?: string | null
          fulfillment_status?: string
          guest_access_expires_at?: string | null
          guest_access_token_hash?: string | null
          id?: string
          internal_admin_notes?: string | null
          normalized_email?: string | null
          order_reference?: string
          order_status?: string
          order_type?: string
          paid_at?: string | null
          payment_status?: string
          refund_status?: string
          reservation_expires_at?: string | null
          shipped_at?: string | null
          shipping_address?: Json
          shipping_cents?: number
          shipping_method?: string | null
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          tracking_carrier?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      painting_media: {
        Row: {
          alt_text: string
          bytes: number
          created_at: string
          height: number
          id: string
          kind: string
          mime_type: string
          painting_id: string
          position: number
          storage_path: string
          variant: string
          width: number
        }
        Insert: {
          alt_text: string
          bytes: number
          created_at?: string
          height: number
          id?: string
          kind: string
          mime_type: string
          painting_id: string
          position?: number
          storage_path: string
          variant: string
          width: number
        }
        Update: {
          alt_text?: string
          bytes?: number
          created_at?: string
          height?: number
          id?: string
          kind?: string
          mime_type?: string
          painting_id?: string
          position?: number
          storage_path?: string
          variant?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "painting_media_painting_id_fkey"
            columns: ["painting_id"]
            isOneToOne: false
            referencedRelation: "paintings"
            referencedColumns: ["id"]
          },
        ]
      }
      paintings: {
        Row: {
          category: string | null
          certificate: boolean
          created_at: string
          currency: string
          depth_cm: number | null
          description: string
          featured: boolean
          frame_description: string | null
          framed: boolean
          height_cm: number | null
          id: string
          legacy_convex_id: string | null
          medium: string | null
          orientation: string | null
          price_cents: number
          published_at: string | null
          ready_to_hang: boolean
          reserved_order_id: string | null
          reserved_until: string | null
          seo_description: string | null
          seo_title: string | null
          signed: boolean
          slug: string
          status: string
          story: string
          surface: string | null
          title: string
          updated_at: string
          width_cm: number | null
          year: number | null
        }
        Insert: {
          category?: string | null
          certificate?: boolean
          created_at?: string
          currency?: string
          depth_cm?: number | null
          description?: string
          featured?: boolean
          frame_description?: string | null
          framed?: boolean
          height_cm?: number | null
          id?: string
          legacy_convex_id?: string | null
          medium?: string | null
          orientation?: string | null
          price_cents: number
          published_at?: string | null
          ready_to_hang?: boolean
          reserved_order_id?: string | null
          reserved_until?: string | null
          seo_description?: string | null
          seo_title?: string | null
          signed?: boolean
          slug: string
          status?: string
          story?: string
          surface?: string | null
          title: string
          updated_at?: string
          width_cm?: number | null
          year?: number | null
        }
        Update: {
          category?: string | null
          certificate?: boolean
          created_at?: string
          currency?: string
          depth_cm?: number | null
          description?: string
          featured?: boolean
          frame_description?: string | null
          framed?: boolean
          height_cm?: number | null
          id?: string
          legacy_convex_id?: string | null
          medium?: string | null
          orientation?: string | null
          price_cents?: number
          published_at?: string | null
          ready_to_hang?: boolean
          reserved_order_id?: string | null
          reserved_until?: string | null
          seo_description?: string | null
          seo_title?: string | null
          signed?: boolean
          slug?: string
          status?: string
          story?: string
          surface?: string | null
          title?: string
          updated_at?: string
          width_cm?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "paintings_reserved_order_id_fkey"
            columns: ["reserved_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          brand: string
          created_at: string
          exp_month: number
          exp_year: number
          id: string
          is_default: boolean
          last4: string
          stripe_payment_method_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand: string
          created_at?: string
          exp_month: number
          exp_year: number
          id?: string
          is_default?: boolean
          last4: string
          stripe_payment_method_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string
          created_at?: string
          exp_month?: number
          exp_year?: number
          id?: string
          is_default?: boolean
          last4?: string
          stripe_payment_method_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          role: string
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          role?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          role?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_events: {
        Row: {
          created_at: string
          id: number
          key_hash: string
          scope: string
        }
        Insert: {
          created_at?: string
          id?: number
          key_hash: string
          scope: string
        }
        Update: {
          created_at?: string
          id?: number
          key_hash?: string
          scope?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount_cents: number
          created_at: string
          failure_reason: string | null
          id: string
          order_id: string
          reason: string
          requested_by: string | null
          restock_on_success: boolean
          status: string
          stripe_refund_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          order_id: string
          reason: string
          requested_by?: string | null
          restock_on_success?: boolean
          status?: string
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          order_id?: string
          reason?: string
          requested_by?: string | null
          restock_on_success?: boolean
          status?: string
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      return_evidence: {
        Row: {
          bytes: number
          created_at: string
          id: string
          mime_type: string
          return_request_id: string
          storage_path: string
          user_id: string | null
        }
        Insert: {
          bytes: number
          created_at?: string
          id?: string
          mime_type: string
          return_request_id: string
          storage_path: string
          user_id?: string | null
        }
        Update: {
          bytes?: number
          created_at?: string
          id?: string
          mime_type?: string
          return_request_id?: string
          storage_path?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_evidence_return_request_id_fkey"
            columns: ["return_request_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      return_requests: {
        Row: {
          admin_response: string | null
          approved_refund_cents: number | null
          created_at: string
          explanation: string
          id: string
          order_id: string
          reason: string
          requested_refund_cents: number | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_response?: string | null
          approved_refund_cents?: number | null
          created_at?: string
          explanation: string
          id?: string
          order_id: string
          reason: string
          requested_refund_cents?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_response?: string | null
          approved_refund_cents?: number | null
          created_at?: string
          explanation?: string
          id?: string
          order_id?: string
          reason?: string
          requested_refund_cents?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          event_type: string
          processed_at: string | null
          received_at: string
          result: Json
          status: string
          stripe_event_id: string
        }
        Insert: {
          event_type: string
          processed_at?: string | null
          received_at?: string
          result?: Json
          status?: string
          stripe_event_id: string
        }
        Update: {
          event_type?: string
          processed_at?: string | null
          received_at?: string
          result?: Json
          status?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_access_state: {
        Args: never
        Returns: {
          is_aal2: boolean
          is_admin: boolean
        }[]
      }
      admin_update_commission: {
        Args: {
          p_customer_message: string
          p_eta: string
          p_expected_dispatch: string
          p_internal_notes: string
          p_notify?: boolean
          p_order_id: string
          p_stage: string
        }
        Returns: {
          amount_refunded_cents: number
          billing_address: Json | null
          cancelled_at: string | null
          commission_eta: string | null
          commission_stage: string | null
          created_at: string
          currency: string
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          customer_phone: string | null
          customer_status_message: string | null
          customer_user_id: string | null
          delivered_at: string | null
          delivery_method: string
          delivery_notes: string | null
          expected_dispatch: string | null
          fulfillment_status: string
          guest_access_expires_at: string | null
          guest_access_token_hash: string | null
          id: string
          internal_admin_notes: string | null
          normalized_email: string | null
          order_reference: string
          order_status: string
          order_type: string
          paid_at: string | null
          payment_status: string
          refund_status: string
          reservation_expires_at: string | null
          shipped_at: string | null
          shipping_address: Json
          shipping_cents: number
          shipping_method: string | null
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          tracking_carrier: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_order: {
        Args: {
          p_action: string
          p_changes: Json
          p_notify?: boolean
          p_order_id: string
        }
        Returns: {
          amount_refunded_cents: number
          billing_address: Json | null
          cancelled_at: string | null
          commission_eta: string | null
          commission_stage: string | null
          created_at: string
          currency: string
          customer_email: string
          customer_first_name: string
          customer_last_name: string
          customer_phone: string | null
          customer_status_message: string | null
          customer_user_id: string | null
          delivered_at: string | null
          delivery_method: string
          delivery_notes: string | null
          expected_dispatch: string | null
          fulfillment_status: string
          guest_access_expires_at: string | null
          guest_access_token_hash: string | null
          id: string
          internal_admin_notes: string | null
          normalized_email: string | null
          order_reference: string
          order_status: string
          order_type: string
          paid_at: string | null
          payment_status: string
          refund_status: string
          reservation_expires_at: string | null
          shipped_at: string | null
          shipping_address: Json
          shipping_cents: number
          shipping_method: string | null
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          tracking_carrier: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_return: {
        Args: {
          p_approved_refund_cents?: number
          p_notify?: boolean
          p_response: string
          p_return_id: string
          p_status: string
        }
        Returns: {
          admin_response: string | null
          approved_refund_cents: number | null
          created_at: string
          explanation: string
          id: string
          order_id: string
          reason: string
          requested_refund_cents: number | null
          status: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "return_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      attach_stripe_checkout_session: {
        Args: {
          p_order_id: string
          p_payment_intent_id?: string
          p_session_id: string
          p_stripe_customer_id?: string
        }
        Returns: undefined
      }
      claim_email_outbox: {
        Args: { p_limit?: number; p_order_id?: string }
        Returns: {
          attempts: number
          created_at: string
          dedupe_key: string
          id: string
          last_error: string | null
          next_attempt_at: string
          order_id: string | null
          payload: Json
          provider_message_id: string | null
          recipient: string
          sent_at: string | null
          status: string
          template: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "email_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_my_guest_orders: { Args: never; Returns: number }
      create_checkout_reservation: {
        Args: {
          p_customer_email: string
          p_customer_first_name: string
          p_customer_last_name: string
          p_customer_phone: string
          p_customer_user_id: string
          p_delivery_method: string
          p_delivery_notes: string
          p_painting_id: string
          p_reservation_minutes?: number
          p_shipping_address: Json
          p_shipping_cents?: number
        }
        Returns: {
          currency: string
          guest_token: string
          order_id: string
          order_reference: string
          reservation_expires_at: string
          total_cents: number
        }[]
      }
      delete_my_address: { Args: { p_id: string }; Returns: boolean }
      lookup_guest_order: { Args: { p_token: string }; Returns: string }
      process_refund_event: {
        Args: {
          p_amount_cents: number
          p_event_id: string
          p_event_type: string
          p_failure_reason?: string
          p_payment_intent_id: string
          p_reason?: string
          p_refund_id: string
          p_status: string
        }
        Returns: Json
      }
      process_setup_intent_event: {
        Args: {
          p_brand: string
          p_event_id: string
          p_exp_month: number
          p_exp_year: number
          p_last4: string
          p_payment_method_id: string
          p_user_id: string
        }
        Returns: Json
      }
      process_stripe_event: {
        Args: { p_data: Json; p_event_id: string; p_event_type: string }
        Returns: Json
      }
      release_checkout_reservation: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: boolean
      }
      save_my_address: {
        Args: {
          p_country: string
          p_id: string
          p_is_default: boolean
          p_label: string
          p_line1: string
          p_line2: string
          p_postcode: string
          p_recipient_name: string
          p_state: string
          p_suburb: string
        }
        Returns: {
          country: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          line1: string
          line2: string | null
          postcode: string
          recipient_name: string
          state: string
          suburb: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "customer_addresses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_my_profile: {
        Args: { p_first_name: string; p_last_name: string; p_phone?: string }
        Returns: {
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          role: string
          stripe_customer_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
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
  public: {
    Enums: {},
  },
} as const

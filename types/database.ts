export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
        }
        Update: {
          full_name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
      }
      interviews: {
        Row: {
          id: string
          user_id: string
          title: string
          status: 'draft' | 'in-progress' | 'completed'
          progress: number
          messages: any[]
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          title: string
          status?: 'draft' | 'in-progress' | 'completed'
          progress?: number
          messages?: any[]
        }
        Update: {
          title?: string
          status?: 'draft' | 'in-progress' | 'completed'
          progress?: number
          messages?: any[]
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          interview_id: string
          title: string
          content: any
          status: 'generating' | 'completed' | 'failed'
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          interview_id: string
          title: string
          content?: any
          status?: 'generating' | 'completed' | 'failed'
        }
        Update: {
          title?: string
          content?: any
          status?: 'generating' | 'completed' | 'failed'
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          plan: 'creator' | 'professional' | 'business'
          status: 'active' | 'cancelled' | 'past_due' | 'trialing'
          interviews_used: number
          builds_used: number
          current_period_start: string
          current_period_end: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          plan?: 'creator' | 'professional' | 'business'
          status?: 'active' | 'cancelled' | 'past_due' | 'trialing'
        }
        Update: {
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          plan?: 'creator' | 'professional' | 'business'
          status?: 'active' | 'cancelled' | 'past_due' | 'trialing'
          interviews_used?: number
          builds_used?: number
          current_period_end?: string
          updated_at?: string
        }
      }
    }
  }
}

export type Role = 
  | 'MARKETING_EXECUTIVE'
  | 'MARKETING_MANAGER'
  | 'CEO'
  | 'TENDER_OFFICER'
  | 'SALES_MANAGER'
  | 'SENIOR_MANAGER'
  | 'SYSTEM_ADMIN';

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  photo_url?: string;
  role: Role;
  status: UserStatus;
  last_login_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Organization {
  id: string;
  name: string;
  type_of_business?: string;
  sector?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  relationship_status?: string;
  lead_source?: string;
  priority?: string;
  assigned_to?: string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface Contact {
  id: string;
  organization_id: string;
  name: string;
  position?: string;
  department?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  is_decision_maker?: boolean;
  relationship_strength?: string;
  notes?: string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export type AssignmentType = 'SELF_PLANNED' | 'MANAGER_ASSIGNED' | 'SYSTEM_RECOMMENDED';
export type VisitStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULE_REQUESTED';
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface PlannedVisit {
  id: string;
  daily_plan_id?: string;
  employee_id: string;
  organization_id: string;
  planned_date: string; // YYYY-MM-DD
  planned_start_time: string; // HH:MM or HH:MM AM/PM
  estimated_duration: number; // duration in minutes
  sequence?: number;
  purpose: string;
  priority: Priority;
  assignment_type: AssignmentType;
  assigned_by?: string;
  status: VisitStatus;
  notes?: string;
  reschedule_reason?: string;
  created_at?: string;
  updated_at?: string;

  // Populated relationships
  organization?: Organization;
  employee?: AppUser;
  assigner?: AppUser;
}

export interface FollowUp {
  id: string;
  organization_id: string;
  contact_id?: string;
  assigned_to: string;
  title: string;
  description?: string;
  due_date: string;
  priority: Priority;
  status: 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  created_by: string;
  created_at?: string;

  // Populated
  organization?: Organization;
  employee?: AppUser;
}

export type FieldSessionStatus = 'ACTIVE' | 'PAUSED' | 'ENDED';

export interface FieldSession {
  id: string;
  employee_id: string;
  session_date: string;
  start_time: string;
  end_time?: string;
  start_latitude?: number;
  start_longitude?: number;
  end_latitude?: number;
  end_longitude?: number;
  current_latitude?: number;
  current_longitude?: number;
  last_location_time?: string;
  status: FieldSessionStatus;
  total_visits_planned: number;
  total_visits_completed: number;
  total_opportunities_created: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export type VisitOutcome = 
  | 'INTERESTED'
  | 'QUOTATION_REQUESTED'
  | 'FOLLOW_UP_REQUIRED'
  | 'CLOSED_WON'
  | 'RESCHEDULED'
  | 'NOT_INTERESTED';

export interface VisitLog {
  id: string;
  planned_visit_id?: string;
  session_id?: string;
  organization_id: string;
  employee_id: string;
  check_in_time: string;
  check_out_time?: string;
  check_in_lat?: number;
  check_in_lng?: number;
  check_out_lat?: number;
  check_out_lng?: number;
  contact_person?: string;
  contact_phone?: string;
  meeting_summary: string;
  client_feedback?: string;
  outcome: VisitOutcome;
  opportunity_created?: boolean;
  opportunity_id?: string;
  follow_up_id?: string;
  duration_minutes?: number;
  created_at?: string;

  // Populated
  organization?: Organization;
}

export type OpportunityStage = 
  | 'IDENTIFIED' 
  | 'QUALIFIED' 
  | 'PROPOSAL_SENT' 
  | 'NEGOTIATION' 
  | 'WON' 
  | 'LOST';

export interface Opportunity {
  id: string;
  organization_id: string;
  contact_id?: string;
  created_by: string;
  title: string;
  product_or_service: string;
  estimated_value: number;
  currency: 'RWF' | 'USD';
  stage: OpportunityStage;
  expected_close_date: string;
  confidence_percentage?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;

  // Populated
  organization?: Organization;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  related_entity_type?: string;
  related_entity_id?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  details?: string;
  target_id?: string;
  metadata?: any;
  timestamp: string;
}

export type MessageUrgency = 'LOW' | 'NORMAL' | 'URGENT' | 'CRITICAL';
export type MessageSituation = 
  | 'PRICING_APPROVAL'
  | 'TENDER_ALERT'
  | 'SAMPLE_REQUEST'
  | 'CLIENT_OBJECTION'
  | 'ROUTE_DELAY'
  | 'FIELD_EMERGENCY'
  | 'DEAL_WON'
  | 'GENERAL';

export interface InternalMessage {
  id: string;
  sender_id: string;
  sender_name?: string;
  sender_role?: Role | string;
  recipient_id?: string | null; // specific user ID or null for role broadcast
  recipient_role?: Role | 'ALL'; // role broadcast or 'ALL'
  recipient_name?: string;
  situation: MessageSituation;
  urgency: MessageUrgency;
  title: string;
  body: string;
  organization_id?: string;
  organization_name?: string;
  planned_visit_id?: string;
  latitude?: number;
  longitude?: number;
  read: boolean;
  status: 'SENT' | 'DELIVERED' | 'QUEUED_OFFLINE';
  created_at: string;
}

export type OfflineActionType = 
  | 'START_SESSION'
  | 'END_SESSION'
  | 'LOG_VISIT'
  | 'CREATE_ORGANIZATION'
  | 'CREATE_OPPORTUNITY'
  | 'CREATE_FOLLOW_UP'
  | 'SEND_MESSAGE';

export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  payload: any;
  timestamp: string;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  lastError?: string;
  summaryText: string;
}


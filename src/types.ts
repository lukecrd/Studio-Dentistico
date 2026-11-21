export type PageKey =
  | 'agenda'
  | 'cancellations'
  | 'patients'
  | 'procedures'
  | 'team'
  | 'proposals'
  | 'reminders'
  | 'rooms'
  | 'audit';

export type ViewMode = 'day' | 'week';

export interface User {
  username: string;
  role: string;
}

export interface Professional {
  id: number;
  name: string;
  specialty: string;
  color: string;
  procedure_ids: string;
  appointments_count?: number;
}

export interface Chair {
  id: number;
  name: string;
  resources: string;
  active: number;
}

export interface Procedure {
  id: number;
  name: string;
  duration: number;
  specialty: string;
  resources: string;
  appointments_count?: number;
}

export interface Patient {
  id: number;
  name: string;
  phone: string;
  notes: string;
  appointments_count?: number;
  booked_count?: number;
}

export interface PatientDetailAppointment {
  id: number;
  starts_at: string;
  status: string;
  procedure: string;
  duration: number;
  professional: string;
  color: string;
  chair: string;
  confirmation_state: 'pending' | 'confirmed' | 'cancelled' | 'expired' | null;
}

export interface PatientDetailReminder {
  id: number;
  appointment_id: number;
  recipient: string;
  status: 'prepared' | 'sent' | 'responded' | 'cancelled' | 'expired';
  sent_at: string | null;
  sent_via: string | null;
  sent_from: string | null;
  created_at: string;
  starts_at: string;
  procedure: string;
}

export interface PatientDetailData {
  patient: Patient;
  appointments: PatientDetailAppointment[];
  reminders: PatientDetailReminder[];
}

export interface Appointment {
  id: number;
  patient_id: number;
  professional_id: number;
  chair_id: number;
  procedure_id: number;
  starts_at: string;
  status: string;
  patient: string;
  phone: string;
  procedure: string;
  duration: number;
  specialty: string;
  professional: string;
  color: string;
  chair: string;
  confirmation_state: 'pending' | 'confirmed' | 'cancelled' | 'expired' | null;
  reminder_status: 'prepared' | 'responded' | 'cancelled' | 'expired' | null;
}

export interface Proposal {
  id: number;
  appointment_id: number;
  freed_appointment_id: number;
  state:
    | 'pending_patient'
    | 'accepted_waiting_approval'
    | 'approved'
    | 'declined'
    | 'rejected';
  offered_at: string;
  responded_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  patient: string;
  phone?: string;
  procedure: string;
  duration?: number;
  original_starts_at: string;
  freed_starts_at: string;
  freed_professional?: string;
  freed_chair?: string;
  original_professional?: string;
  original_chair?: string;
  invite_code?: string | null;
  sms_sent_at?: string | null;
  move_sms_sent_at?: string | null;
}

export interface CancellationCandidate {
  id: number;
  patient: string;
  phone: string;
  procedure: string;
  duration: number;
  starts_at: string;
  professional: string;
  chair: string;
}

export interface CancellationItem {
  id: number;
  patient_id: number;
  professional_id: number;
  chair_id: number;
  procedure_id: number;
  starts_at: string;
  patient: string;
  phone: string;
  procedure: string;
  duration: number;
  specialty: string;
  professional: string;
  color: string;
  chair: string;
  chair_active: boolean;
  slot_status: 'free' | 'replaced' | 'past' | 'inactive_room';
  replaced_by: {
    id: number;
    starts_at: string;
    patient: string;
    procedure: string;
    duration: number;
    professional: string;
    chair: string;
  } | null;
  pending_proposals_count: number;
  candidates: CancellationCandidate[];
}

export interface WhatsAppConfig {
  connected: boolean;
  phone: string;
  sender_name: string;
  default_prefix: string;
  cloud_api_configured: boolean;
  updated_at: string | null;
}

export interface TextBeeSim {
  subscriptionId: number;
  carrierName: string;
  simSlotIndex: number;
  serviceState: string;
}

export interface TextBeeDevice {
  id: string;
  brand: string;
  model: string;
  enabled: boolean;
  label: string;
  sims: TextBeeSim[];
}

export interface SmsConfig {
  configured: boolean;
  base_url: string;
  device_id: string;
  sim_subscription_id: number | null;
  devices: TextBeeDevice[];
  error: string | null;
}

export interface ReminderMessage {
  id: number;
  appointment_id: number;
  confirmation_id: number;
  type: string;
  recipient: string;
  body: string;
  status: 'prepared' | 'sent' | 'responded' | 'cancelled' | 'expired';
  sent_at?: string | null;
  sent_via?: string | null;
  sent_from?: string | null;
  wa_url?: string;
  created_at: string;
  patient: string;
  starts_at: string;
  procedure: string;
}

export interface AuditEvent {
  id: number;
  actor: string;
  action: string;
  details: string;
  created_at: string;
}

export interface CatalogData {
  professionals: Professional[];
  chairs: Chair[];
  procedures: Procedure[];
  patients: Patient[];
}

export interface AgendaData {
  appointments: Appointment[];
  professionals: Professional[];
  chairs: Chair[];
}

export interface AgendaFilters {
  professional: string;
  chair: string;
  procedure: string;
}

export interface BookingPrefill {
  dateISO?: string;
  hour?: number;
  minute?: number;
  professionalId?: number;
  chairId?: number;
  procedureId?: number;
  replacingLabel?: string;
}


export type StudentStatus = 'cursando' | 'desistiu' | 'concluiu';

export interface Student {
  id: string;
  name: string;
  phone: string;
  status: StudentStatus;
  enrolledClassIds: string[]; // Histórico de turmas onde já foi matriculado
  observations?: string;
  registrationDate?: string; // ISO String (YYYY-MM-DD)
}

export interface Class {
  id: string;
  courseName: string;
  days: string[]; // ['Segunda', 'Quarta']
  time: string;
  frequency: 1 | 2; // 1x ou 2x por semana
  studentIds: string[];
  position?: number;
  semester: string; // "1º Semestre" ou "2º Semestre"
  year: number;
  archived?: boolean;
  startDate?: string; // ISO String (YYYY-MM-DD)
  endDate?: string;   // ISO String (YYYY-MM-DD)
}

export type AttendanceStatus = 'presente' | 'ausente' | 'justificado';

export interface AttendanceRecord {
  id: string;
  date: string; // ISO String (YYYY-MM-DD)
  classId: string;
  statuses: Record<string, AttendanceStatus>; // Mapeamento de ID do aluno para seu status
}

export type View = 'dashboard' | 'students' | 'classes' | 'attendance' | 'reports';

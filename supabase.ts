
import { createClient } from '@supabase/supabase-js';
import { Student, Class, AttendanceRecord } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not found. Check your .env.local file.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Helpers para facilitar o uso no App.tsx
export const db = {
    students: {
        getAll: async () => {
            const { data, error } = await supabase.from('students').select('*').order('name');
            if (error) throw error;
            return (data || []).map(s => ({
                id: s.id,
                name: s.name,
                phone: s.phone,
                status: s.status || 'cursando',
                enrolledClassIds: s.enrolled_class_ids || [],
                observations: s.observations || ''
            })) as Student[];
        },
        save: async (student: Student) => {
            const payload = {
                id: student.id,
                name: student.name,
                phone: student.phone,
                status: student.status,
                enrolled_class_ids: student.enrolledClassIds,
                observations: student.observations
            };
            const { data, error } = await supabase.from('students').upsert(payload).select();
            if (error) throw error;
            const s = data[0];
            return {
                id: s.id,
                name: s.name,
                phone: s.phone,
                status: s.status,
                enrolledClassIds: s.enrolled_class_ids,
                observations: s.observations
            } as Student;
        },
        delete: async (id: string) => {
            const { error } = await supabase.from('students').delete().eq('id', id);
            if (error) throw error;
        }
    },
    classes: {
        getAll: async () => {
            const { data, error } = await supabase.from('classes').select('*').order('position', { ascending: true });
            if (error) throw error;
            // Map snake_case to camelCase
            return (data || []).map(c => ({
                id: c.id,
                courseName: c.course_name,
                days: c.days,
                time: c.time,
                frequency: c.frequency,
                studentIds: c.student_ids || [],
                position: c.position,
                semester: c.semester || '1º Semestre',
                year: c.year || new Date().getFullYear(),
                archived: !!c.archived
            })) as Class[];
        },
        save: async (cls: Class) => {
            const payload = {
                id: cls.id,
                course_name: cls.courseName,
                days: cls.days,
                time: cls.time,
                frequency: cls.frequency,
                student_ids: cls.studentIds,
                position: cls.position,
                semester: cls.semester,
                year: cls.year,
                archived: !!cls.archived
            };
            const { data, error } = await supabase.from('classes').upsert(payload).select();
            if (error) throw error;
            const saved = data[0];
            return {
                id: saved.id,
                courseName: saved.course_name,
                days: saved.days,
                time: saved.time,
                frequency: saved.frequency,
                studentIds: saved.student_ids,
                position: saved.position,
                semester: saved.semester,
                year: saved.year,
                archived: !!saved.archived
            } as Class;
        },
        saveAll: async (classesToSave: Class[]) => {
            const payloads = classesToSave.map(cls => ({
                id: cls.id,
                course_name: cls.courseName,
                days: cls.days,
                time: cls.time,
                frequency: cls.frequency,
                student_ids: cls.studentIds,
                position: cls.position,
                semester: cls.semester,
                year: cls.year,
                archived: !!cls.archived
            }));
            const { data, error } = await supabase.from('classes').upsert(payloads).select();
            if (error) throw error;
            return (data || []).map(saved => ({
                id: saved.id,
                courseName: saved.course_name,
                days: saved.days,
                time: saved.time,
                frequency: saved.frequency,
                studentIds: saved.student_ids,
                position: saved.position,
                semester: saved.semester,
                year: saved.year,
                archived: !!saved.archived
            })) as Class[];
        },
        delete: async (id: string) => {
            const { error } = await supabase.from('classes').delete().eq('id', id);
            if (error) throw error;
        }
    },
    attendance: {
        getAll: async () => {
            const { data, error } = await supabase.from('attendance_records').select('*');
            if (error) throw error;
            return (data || []).map(r => ({
                id: r.id,
                date: r.date,
                classId: r.class_id,
                statuses: r.statuses || {}
            })) as AttendanceRecord[];
        },
        save: async (record: AttendanceRecord) => {
            const payload = {
                id: record.id,
                date: record.date,
                class_id: record.classId,
                statuses: record.statuses
            };
            const { data, error } = await supabase.from('attendance_records').upsert(payload).select();
            if (error) throw error;
            const saved = data[0];
            return {
                id: saved.id,
                date: saved.date,
                classId: saved.class_id,
                statuses: saved.statuses
            } as AttendanceRecord;
        }
    }
};

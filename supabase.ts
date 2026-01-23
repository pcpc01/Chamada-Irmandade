
import { createClient } from '@supabase/supabase-js';
import { Student, Class, AttendanceRecord, Holiday } from './types';

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
                observations: s.observations || '',
                registrationDate: s.registration_date
            })) as Student[];
        },
        save: async (student: Student) => {
            const payload = {
                id: student.id,
                name: student.name,
                phone: student.phone,
                status: student.status,
                enrolled_class_ids: student.enrolledClassIds,
                observations: student.observations,
                registration_date: student.registrationDate
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
                observations: s.observations,
                registrationDate: s.registration_date
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
                archived: !!c.archived,
                startDate: c.start_date,
                endDate: c.end_date
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
                archived: !!cls.archived,
                start_date: cls.startDate,
                end_date: cls.endDate
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
                archived: !!saved.archived,
                startDate: saved.start_date,
                endDate: saved.end_date
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
                archived: !!cls.archived,
                start_date: cls.startDate,
                end_date: cls.endDate
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
                archived: !!saved.archived,
                startDate: saved.start_date,
                endDate: saved.end_date
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
    },
    holidays: {
        getAll: async () => {
            const { data, error } = await supabase.from('holidays').select('*').order('date');
            if (error) throw error;
            return (data || []).map(h => ({
                id: h.id,
                date: h.date,
                name: h.name
            })) as Holiday[];
        },
        save: async (holiday: Holiday) => {
            const payload = {
                id: holiday.id,
                date: holiday.date,
                name: holiday.name
            };
            const { data, error } = await supabase.from('holidays').upsert(payload).select();
            if (error) throw error;
            const saved = data[0];
            return {
                id: saved.id,
                date: saved.date,
                name: saved.name
            } as Holiday;
        },
        delete: async (id: string) => {
            const { error } = await supabase.from('holidays').delete().eq('id', id);
            if (error) throw error;
        }
    },
    earnings: {
        getAll: async () => {
            const { data, error } = await supabase.from('earnings_records').select('*').order('month', { ascending: false });
            if (error) throw error;
            return (data || []).map(r => ({
                id: r.id,
                month: r.month,
                valuePerClass: r.value_per_class,
                classesPerDay: r.classes_per_day,
                totalClasses: r.total_classes,
                totalAmount: r.total_amount,
                selectedDays: r.selected_days || [],
                updatedAt: r.updated_at
            }));
        },
        save: async (record: any) => {
            const payload = {
                id: record.id,
                month: record.month,
                value_per_class: record.valuePerClass,
                classes_per_day: record.classesPerDay,
                total_classes: record.totalClasses,
                total_amount: record.totalAmount,
                selected_days: record.selectedDays,
                updated_at: new Date().toISOString()
            };
            const { data, error } = await supabase.from('earnings_records').upsert(payload).select();
            if (error) throw error;
            const saved = data[0];
            return {
                id: saved.id,
                month: saved.month,
                valuePerClass: saved.value_per_class,
                classesPerDay: saved.classes_per_day,
                totalClasses: saved.total_classes,
                totalAmount: saved.total_amount,
                selectedDays: saved.selected_days || [],
                updatedAt: saved.updated_at
            };
        },
        delete: async (id: string) => {
            const { error } = await supabase.from('earnings_records').delete().eq('id', id);
            if (error) throw error;
        }
    }
};

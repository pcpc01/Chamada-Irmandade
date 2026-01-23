
import React, { useState, useEffect } from 'react';
import { Student, Class, AttendanceRecord, View, Holiday } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StudentManager from './components/StudentManager';
import ClassManager from './components/ClassManager';
import AttendanceTaker from './components/AttendanceTaker';
import SystemSettings from './components/SystemSettings';
import Reports from './components/Reports';
import LoginPage from './components/Login';
import { db, supabase } from './supabase';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [view, setView] = useState<View>('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReportStudentId, setSelectedReportStudentId] = useState<string | null>(null);
  const [selectedReportClassId, setSelectedReportClassId] = useState<string | null>(null);

  // Gerenciar Sessão do Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Carregar dados iniciais do Supabase
  useEffect(() => {
    if (!session) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [studentsData, classesData, attendanceData, holidaysData] = await Promise.all([
          db.students.getAll(),
          db.classes.getAll(),
          db.attendance.getAll(),
          db.holidays.getAll()
        ]);

        setStudents(studentsData);
        setClasses(classesData);
        setAttendanceRecords(attendanceData);
        setHolidays(holidaysData);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        alert('Erro ao conectar com o banco de dados. Verifique sua conexão.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  if (!session) {
    return <LoginPage onLogin={() => { }} />;
  }

  const handleSetView = (newView: View) => {
    // Resetar seleções ao navegar manualmente
    if (newView !== 'reports') {
      setSelectedReportStudentId(null);
      setSelectedReportClassId(null);
    }
    setView(newView);
  };

  const renderView = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      );
    }

    switch (view) {
      case 'dashboard':
        return <Dashboard
          students={students}
          classes={classes}
          records={attendanceRecords}
          holidays={holidays}
          onNavigate={handleSetView}
        />;
      case 'students':
        return <StudentManager
          students={students}
          setStudents={setStudents}
          classes={classes}
          setClasses={setClasses}
          onViewReport={(studentId) => {
            setSelectedReportStudentId(studentId);
            setView('reports');
          }}
        />;
      case 'classes':
        return <ClassManager
          classes={classes}
          setClasses={setClasses}
          students={students}
          setStudents={setStudents}
        />;
      case 'attendance':
        return <AttendanceTaker
          classes={classes}
          setClasses={setClasses}
          students={students}
          records={attendanceRecords}
          setRecords={setAttendanceRecords}
          holidays={holidays}
        />;
      case 'holidays':
      case 'settings':
        return <SystemSettings
          holidays={holidays}
          setHolidays={setHolidays}
        />;
      case 'reports':
        return <Reports
          students={students}
          setStudents={setStudents}
          classes={classes}
          setClasses={setClasses}
          records={attendanceRecords}
          initialStudentId={selectedReportStudentId}
          initialClassId={selectedReportClassId}
          holidays={holidays}
        />;
      default:
        return <Dashboard
          students={students}
          classes={classes}
          records={attendanceRecords}
          holidays={holidays}
          onNavigate={handleSetView}
        />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar currentView={view} setView={handleSetView} />
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

export default App;

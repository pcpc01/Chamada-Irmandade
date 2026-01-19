
import React, { useState, useEffect } from 'react';
import { Student, Class, AttendanceRecord, View } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StudentManager from './components/StudentManager';
import ClassManager from './components/ClassManager';
import AttendanceTaker from './components/AttendanceTaker';
import Reports from './components/Reports';
import { db } from './supabase';

const App: React.FC = () => {
  const [view, setView] = useState<View>('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReportStudentId, setSelectedReportStudentId] = useState<string | null>(null);
  const [selectedReportClassId, setSelectedReportClassId] = useState<string | null>(null);

  // Carregar dados iniciais do Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [studentsData, classesData, attendanceData] = await Promise.all([
          db.students.getAll(),
          db.classes.getAll(),
          db.attendance.getAll()
        ]);

        setStudents(studentsData);
        setClasses(classesData);
        setAttendanceRecords(attendanceData);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        alert('Erro ao conectar com o banco de dados. Verifique sua conexão.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
        />;
      default:
        return <Dashboard
          students={students}
          classes={classes}
          records={attendanceRecords}
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


import React, { useState } from 'react';
import { Student, Class, AttendanceRecord } from '../types';
import { db } from '../supabase';
import * as XLSX from 'xlsx';

interface ReportsProps {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  classes: Class[];
  setClasses: React.Dispatch<React.SetStateAction<Class[]>>;
  records: AttendanceRecord[];
  initialStudentId?: string | null;
  initialClassId?: string | null;
}

const Reports: React.FC<ReportsProps> = ({ students, setStudents, classes, setClasses, records, initialStudentId, initialClassId }) => {
  const [selectedClassId, setSelectedClassId] = useState(initialClassId || '');
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId || '');
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reportViewMode, setReportViewMode] = useState<'summary' | 'spreadsheet'>('spreadsheet');
  const [reportMonth, setReportMonth] = useState(new Date().getMonth()); // 0-11
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  const calculateStats = (studentId: string, classId: string) => {
    const classRecords = records.filter(r => r.classId === classId);
    const relevantRecords = classRecords.filter(r => r.statuses && r.statuses[studentId]);
    const totalClasses = relevantRecords.length;
    const presences = relevantRecords.filter(r => r.statuses?.[studentId] === 'presente').length;
    const justified = relevantRecords.filter(r => r.statuses?.[studentId] === 'justificado').length;
    const absences = relevantRecords.filter(r => r.statuses?.[studentId] === 'ausente').length;
    const effectivePresences = presences + justified;
    const percentage = totalClasses > 0 ? (effectivePresences / totalClasses) * 100 : 0;
    return { totalClasses, presences, justified, absences, percentage };
  };

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const selectedStudent = students.find(s => s.id === selectedStudentId);

  const classStudents = students.filter(s =>
    selectedClass && (
      (selectedClass.studentIds || []).includes(s.id) ||
      (s.enrolledClassIds || []).includes(selectedClass.id)
    )
  );

  const handleDeleteClass = async (e: React.MouseEvent, classId: string) => {
    e.stopPropagation();
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;

    if (confirm(`Tem certeza que deseja excluir a turma "${cls.courseName}"? Esta ação não pode ser desfeita e removerá o vínculo de todos os alunos.`)) {
      try {
        await db.classes.delete(classId);
        setClasses(prev => prev.filter(c => c.id !== classId));
        const studentsToUpdate = students.filter(s => (s.enrolledClassIds || []).includes(classId));
        if (studentsToUpdate.length > 0) {
          const updatedStudentsList = students.map(s => {
            if ((s.enrolledClassIds || []).includes(classId)) {
              return { ...s, enrolledClassIds: s.enrolledClassIds.filter(id => id !== classId) };
            }
            return s;
          });
          for (const student of studentsToUpdate) {
            const updatedEnrolledIds = (student.enrolledClassIds || []).filter(id => id !== classId);
            await db.students.save({ ...student, enrolledClassIds: updatedEnrolledIds });
          }
          setStudents(updatedStudentsList);
        }
        alert('Turma excluída com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir turma:', error);
        alert('Erro ao excluir a turma. Tente novamente.');
      }
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    try {
      setIsSaving(true);
      await db.classes.save(editingClass);
      setClasses(prev => prev.map(c => c.id === editingClass.id ? editingClass : c));
      setEditingClass(null);
      alert('Turma atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar turma:', error);
      alert('Erro ao salvar as alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportExcel = () => {
    if (!selectedClass) return;

    const classRecords = records
      .filter(r => r.classId === selectedClassId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Prepare headers
    const headers = ['Aluno'];
    classRecords.forEach(r => {
      const date = new Date(r.date + 'T12:00:00');
      headers.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    });
    headers.push('Faltas', 'Presenças', '% Frequência');

    // Prepare data
    const data = classStudents.map(s => {
      const row: any = [s.name];
      let rowAbsences = 0;
      let rowPresences = 0;

      classRecords.forEach(record => {
        const status = record?.statuses?.[s.id];
        if (status === 'presente') {
          row.push('P');
          rowPresences++;
        } else if (status === 'ausente') {
          row.push('F');
          rowAbsences++;
        } else if (status === 'justificado') {
          row.push('J');
          rowPresences++;
        } else {
          row.push('');
        }
      });

      row.push(rowAbsences);
      row.push(rowPresences);
      const percentage = rowPresences + rowAbsences > 0
        ? ((rowPresences / (rowPresences + rowAbsences)) * 100).toFixed(0) + '%'
        : '0%';
      row.push(percentage);
      return row;
    });

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet([
      [`RELATÓRIO DE FREQUÊNCIA - ${selectedClass.courseName.toUpperCase()}`],
      [`Período: ${selectedClass.year} • ${selectedClass.semester}`],
      [],
      headers,
      ...data
    ]);

    // Set some styling/formatting if possible (SheetJS basic style is limited in community version, but column widths help)
    const wscols = [{ wch: 30 }]; // Aluno column width
    classRecords.forEach(() => wscols.push({ wch: 6 })); // Date columns
    wscols.push({ wch: 8 }, { wch: 10 }, { wch: 12 }); // Summary columns

    worksheet['!cols'] = wscols;

    // Create workbook and download
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Frequência");
    XLSX.writeFile(workbook, `Frequencia_${selectedClass.courseName.replace(/\s+/g, '_')}_${selectedClass.year}.xlsx`);
  };

  const filteredClasses = classes.filter(c => {
    const classStudentsCount = students.filter(s =>
      (c.studentIds || []).includes(s.id) ||
      (s.enrolledClassIds || []).includes(c.id)
    ).filter(s => s.status === 'cursando' || s.status === 'concluiu').length;
    return classStudentsCount > 0;
  });

  const groupedClasses = filteredClasses.reduce((acc, c) => {
    const key = `${c.year}-${c.semester}`;
    if (!acc[key]) acc[key] = { year: c.year, semester: c.semester, items: [] };
    acc[key].items.push(c);
    return acc;
  }, {} as Record<string, { year: number, semester: string, items: Class[] }>);

  const dayPriority: Record<string, number> = {
    'Segunda': 1, 'Terça': 2, 'Quarta': 3, 'Quinta': 4, 'Sexta': 5, 'Sábado': 6, 'Domingo': 7
  };

  const sortedGroups = (Object.values(groupedClasses) as { year: number, semester: string, items: Class[] }[]).sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return b.semester.localeCompare(a.semester);
  }).map(group => ({
    ...group,
    items: [...group.items].sort((a, b) => {
      const dayA = a.days[0] || '';
      const dayB = b.days[0] || '';
      if (dayPriority[dayA] !== dayPriority[dayB]) {
        return (dayPriority[dayA] || 99) - (dayPriority[dayB] || 99);
      }
      return (a.time || '00:00').localeCompare(b.time || '00:00');
    })
  }));

  return (
    <div className="pb-10 animate-in fade-in duration-500">
      <header className="mb-10 text-center md:text-left print:hidden">
        <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight uppercase">Relatórios de Frequência</h1>
        <p className="text-gray-500 font-medium">Analise a assiduidade e o desempenho de frequência das turmas.</p>
      </header>

      {/* SEÇÃO 1: LISTA GRUPADA DE TURMAS */}
      {!selectedClassId && !selectedStudentId && (
        <div className="animate-in slide-in-from-bottom-8 duration-500">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">Selecione uma turma para analisar</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-gray-100 to-transparent"></div>
          </div>

          {classes.length === 0 ? (
            <div className="bg-white rounded-[40px] border-4 border-dashed border-gray-100 p-20 text-center max-w-2xl mx-auto shadow-sm">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-8 text-gray-200">
                <i className="fas fa-folder-open text-4xl"></i>
              </div>
              <h3 className="text-2xl font-black text-gray-300 uppercase tracking-widest leading-tight">Nenhuma turma encontrada.</h3>
            </div>
          ) : (
            <div className="space-y-16">
              {sortedGroups.map((group: any) => (
                <div key={`${group.year}-${group.semester}`} className="animate-in fade-in slide-in-from-left-4 duration-500">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="h-px w-8 bg-indigo-200"></div>
                    <h3 className="text-base font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                      <i className="fas fa-calendar-check text-indigo-500"></i>
                      {group.year} • {group.semester}
                    </h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-indigo-100 to-transparent"></div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {group.items.map((c: Class) => {
                      const colors = [
                        { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', accent: 'bg-blue-500', shadow: 'shadow-blue-500/25' },
                        { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', accent: 'bg-emerald-500', shadow: 'shadow-emerald-500/25' },
                        { bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600', accent: 'bg-amber-500', shadow: 'shadow-amber-500/25' },
                        { bg: 'bg-rose-50', icon: 'bg-rose-100 text-rose-600', accent: 'bg-rose-500', shadow: 'shadow-rose-500/25' },
                        { bg: 'bg-violet-50', icon: 'bg-violet-100 text-violet-600', accent: 'bg-violet-500', shadow: 'shadow-violet-500/25' },
                        { bg: 'bg-cyan-50', icon: 'bg-cyan-100 text-cyan-600', accent: 'bg-cyan-500', shadow: 'shadow-cyan-500/25' }
                      ];
                      const colorIndex = classes.findIndex(cl => cl.id === c.id);
                      const color = colors[colorIndex % colors.length];
                      const studentCount = students.filter(s =>
                        (c.studentIds || []).includes(s.id) ||
                        (s.enrolledClassIds || []).includes(c.id)
                      ).length;

                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedClassId(c.id)}
                          className={`relative group ${color.bg} rounded-[24px] shadow-sm border border-gray-100 hover:shadow-xl ${color.shadow} hover:-translate-y-1 cursor-pointer transition-all duration-300 overflow-hidden`}
                        >
                          <div className={`absolute -right-6 -top-6 w-32 h-32 ${color.accent} rounded-full opacity-5 group-hover:opacity-10 transition-all duration-500`}></div>

                          <div className="relative z-10 flex items-center justify-between p-4 gap-6">
                            <div className="flex items-center gap-5 flex-1 min-w-0">
                              <div className={`w-14 h-14 ${color.icon} rounded-2xl flex items-center justify-center shadow-inner shrink-0 group-hover:bg-white transition-all`}>
                                <i className="fas fa-chart-line text-xl"></i>
                              </div>
                              <div className="flex flex-col gap-1 min-w-0">
                                <h3 className="font-black text-lg text-gray-800 leading-none group-hover:text-indigo-900 transition-colors uppercase tracking-tight truncate pr-4">
                                  {c.courseName}
                                </h3>
                                <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-gray-400">
                                  <span className="flex items-center gap-1.5 bg-white/60 px-2 py-1 rounded-lg shrink-0">
                                    <i className="fas fa-clock text-indigo-400"></i>
                                    {c.time || '--:--'}
                                  </span>
                                  <span className="bg-white/60 px-2 py-1 rounded-lg uppercase tracking-wider shrink-0 text-[9px]">
                                    {c.days.join(' • ')}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="hidden md:flex items-center gap-3">
                              <div className="bg-white/60 px-3 py-1.5 rounded-xl font-black text-[10px] text-gray-500 shadow-sm uppercase tracking-wide flex items-center gap-2 border border-black/5">
                                <i className="fas fa-users"></i>
                                <span>{studentCount} Alunos</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 border-l border-black/5 pl-4">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingClass(c);
                                }}
                                className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all"
                                title="Editar"
                              >
                                <i className="fas fa-pen text-sm"></i>
                              </button>
                              <button
                                onClick={(e) => handleDeleteClass(e, c.id)}
                                className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                title="Excluir"
                              >
                                <i className="fas fa-trash-alt text-sm"></i>
                              </button>
                              <div className="w-8 h-8 flex items-center justify-center text-gray-300 group-hover:text-indigo-400 transition-colors ml-2">
                                <i className="fas fa-chevron-right text-sm"></i>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SEÇÃO 2: DETALHES DO RELATÓRIO DA TURMA */}
      {selectedClassId && !selectedStudentId && (
        <div className="animate-in zoom-in-95 duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-[28px] border border-gray-100 shadow-sm print:hidden">
            <div className="flex items-center gap-4 flex-1">
              <button
                onClick={() => setSelectedClassId('')}
                className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                title="Voltar para a lista"
              >
                <i className="fas fa-arrow-left text-sm"></i>
              </button>
              <div>
                <span className="block text-[8px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-0.5">Análise de Turma</span>
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter leading-none">{selectedClass?.courseName}</h2>
                <span className="text-[8px] font-black text-gray-400 uppercase mt-0.5 inline-block bg-gray-100 px-1.5 py-0.5 rounded-md">
                  {selectedClass?.year} • {selectedClass?.semester}
                </span>
              </div>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner">
              <button
                onClick={() => setReportViewMode('summary')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${reportViewMode === 'summary' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Resumo
              </button>
              <button
                onClick={() => setReportViewMode('spreadsheet')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${reportViewMode === 'spreadsheet' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Planilha
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 flex-1">
              <div className="bg-indigo-50 px-4 py-2.5 rounded-2xl text-center min-w-[100px] border border-indigo-100">
                <span className="block text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Aulas Dadas</span>
                <span className="text-xl font-black text-indigo-600 leading-none">{records.filter(r => r.classId === selectedClassId).length}</span>
              </div>
              <div className="bg-gray-50 px-4 py-2.5 rounded-2xl text-center min-w-[100px] border border-gray-100">
                <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Total Alunos</span>
                <span className="text-xl font-black text-gray-700 leading-none">{classStudents.length}</span>
              </div>
            </div>
          </div>

          {reportViewMode === 'summary' ? (
            <div className="bg-white rounded-[44px] shadow-2xl shadow-indigo-200/20 border border-gray-50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-gray-100">
                    <tr>
                      <th className="px-10 py-6">Aluno</th>
                      <th className="px-6 py-6 text-center">Presenças</th>
                      <th className="px-6 py-6 text-center">Faltas</th>
                      <th className="px-6 py-6 text-center">Justificativas</th>
                      <th className="px-10 py-6 text-right">Média Frequência</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 px-4">
                    {classStudents.map(s => {
                      const stats = calculateStats(s.id, selectedClassId);
                      return (
                        <tr key={s.id} className="group hover:bg-gray-50/50 transition-colors">
                          <td className="px-10 py-6">
                            <button
                              onClick={() => setSelectedStudentId(s.id)}
                              className="flex items-center gap-4 text-left group/btn hover:translate-x-1 transition-transform"
                            >
                              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-black text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-all capitalize shadow-inner">
                                {s.name.charAt(0)}
                              </div>
                              <div>
                                <span className="block text-lg font-black text-gray-800 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{s.name}</span>
                                <span className="text-[9px] font-black text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">Clique para ver detalhes</span>
                              </div>
                            </button>
                          </td>
                          <td className="px-6 py-6 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 text-green-600 font-black text-sm">{stats.presences}</span>
                          </td>
                          <td className="px-6 py-6 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-600 font-black text-sm">{stats.absences}</span>
                          </td>
                          <td className="px-6 py-6 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 text-amber-600 font-black text-sm">{stats.justified}</span>
                          </td>
                          <td className="px-10 py-6">
                            <div className="flex items-center justify-end gap-4">
                              <div className="w-24 bg-gray-100 rounded-full h-2.5 overflow-hidden hidden sm:block shadow-inner">
                                <div
                                  className={`h-full rounded-full transition-all duration-1000 ${stats.percentage < 75 ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-green-500 to-emerald-500'}`}
                                  style={{ width: `${stats.percentage}%` }}
                                ></div>
                              </div>
                              <span className={`text-xl font-black ${stats.percentage < 75 ? 'text-red-500' : 'text-green-600'} tracking-tighter`}>
                                {stats.percentage.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50 p-4 rounded-3xl border border-gray-100 print:hidden">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-indigo-400 bg-indigo-50 px-3 py-1.5 rounded-xl uppercase tracking-widest border border-indigo-100">
                      <i className="fas fa-list-ol mr-2"></i>
                      Lista de Chamadas Realizadas
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all border border-emerald-500/20"
                >
                  <i className="fas fa-file-excel"></i>
                  Exportar Planilha
                </button>
              </div>

              <div className="bg-white rounded-[32px] border border-gray-200 shadow-xl overflow-hidden print:shadow-none print:border-black print:rounded-none">
                <div className="p-10 border-b-2 border-gray-100 bg-white hidden print:block">
                  <div className="flex items-center gap-8 mb-10">
                    <img src="/logo.png" alt="Logo" className="w-24 h-24 object-contain" />
                    <div className="flex-1 border-l-4 border-indigo-600 pl-8">
                      <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Irmandade de Misericórdia de Taubaté</h1>
                      <p className="text-sm font-black text-indigo-400 uppercase tracking-[0.3em] mt-2">Controle de Frequência - Depto. de Cursos</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-8">
                    <div className="border-b-2 border-gray-300 pb-2">
                      <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Professor(a)</span>
                      <div className="h-6"></div>
                    </div>
                    <div className="border-b-2 border-gray-300 pb-2">
                      <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Matéria / Conteúdo</span>
                      <span className="text-sm font-black text-gray-800 uppercase">{selectedClass?.courseName}</span>
                    </div>
                    <div className="border-b-2 border-gray-300 pb-2">
                      <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Turma / Ano</span>
                      <span className="text-sm font-black text-gray-800 uppercase">{selectedClass?.year} • {selectedClass?.semester}</span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[9px]">
                    <thead>
                      <tr className="bg-gray-800 text-white">
                        <th className="border border-gray-700 p-2 text-left min-w-[180px] font-black uppercase tracking-widest" rowSpan={2}>
                          Aluno
                        </th>
                        {records
                          .filter(r => r.classId === selectedClassId)
                          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                          .map((record) => {
                            const date = new Date(record.date + 'T12:00:00');
                            const weekDay = date.toLocaleDateString('pt-BR', { weekday: 'short' }).substring(0, 3);
                            return (
                              <th key={record.id} className="border border-gray-700 p-1 text-center min-w-[28px] leading-tight odd:bg-gray-700">
                                <span className="block text-[7px] font-normal uppercase">{weekDay}</span>
                                <span className="block">{date.getDate().toString().padStart(2, '0')}/{(date.getMonth() + 1).toString().padStart(2, '0')}</span>
                              </th>
                            );
                          })}
                        <th className="border border-gray-700 p-2 text-center font-black uppercase" colSpan={3}>Resumo</th>
                      </tr>
                      <tr className="bg-gray-800 text-white/50 text-[7px]">
                        {records
                          .filter(r => r.classId === selectedClassId)
                          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                          .map((r) => (
                            <th key={r.id} className="border border-gray-700 p-0 text-center odd:bg-gray-700"></th>
                          ))}
                        <th className="border border-gray-700 px-2 py-1 text-center font-black uppercase text-white bg-red-900/30">F</th>
                        <th className="border border-gray-700 px-2 py-1 text-center font-black uppercase text-white bg-green-900/30">P</th>
                        <th className="border border-gray-700 px-2 py-1 text-center font-black uppercase text-white">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {classStudents.map((s, idx) => {
                        const classRecords = records
                          .filter(r => r.classId === selectedClassId)
                          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                        let totalAbsences = 0;
                        let totalPresences = 0;
                        return (
                          <tr key={s.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-indigo-50/50 transition-colors`}>
                            <td className="border border-gray-200 px-3 py-1.5 font-bold text-gray-800 uppercase truncate">
                              {s.name}
                            </td>
                            {classRecords.map((record) => {
                              const status = record?.statuses?.[s.id];
                              let cellText = '';
                              let cellClass = 'text-gray-200';
                              if (status === 'presente') {
                                cellText = 'P';
                                cellClass = 'bg-blue-50 text-blue-600 font-black';
                                totalPresences++;
                              } else if (status === 'ausente') {
                                cellText = 'F';
                                cellClass = 'bg-red-50 text-red-600 font-black';
                                totalAbsences++;
                              } else if (status === 'justificado') {
                                cellText = 'J';
                                cellClass = 'bg-amber-50 text-amber-600 font-black';
                                totalPresences++;
                              }
                              return (
                                <td key={record.id} className={`border border-gray-200 p-0 text-center text-[8px] h-8 ${cellClass}`}>
                                  {cellText}
                                </td>
                              );
                            })}
                            <td className="border border-gray-300 p-0 text-center font-black text-red-600 bg-red-50/30 w-8">{totalAbsences}</td>
                            <td className="border border-gray-300 p-0 text-center font-black text-green-600 bg-green-50/30 w-8">{totalPresences}</td>
                            <td className="border border-gray-300 p-0 text-center font-black text-gray-800 bg-gray-50 w-10">
                              {totalPresences + totalAbsences > 0
                                ? ((totalPresences / (totalPresences + totalAbsences)) * 100).toFixed(0) + '%'
                                : '--'
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {records.filter(r => r.classId === selectedClassId).length === 0 && (
                    <div className="p-20 text-center text-gray-400 italic font-medium uppercase tracking-widest text-[10px]">
                      Nenhuma chamada realizada para esta turma.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SEÇÃO 3: RELATÓRIO INDIVIDUAL DO ALUNO */}
      {selectedStudentId && (
        <div className="animate-in slide-in-from-right-8 duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 bg-white p-8 rounded-[36px] border border-indigo-100 shadow-xl shadow-indigo-100/20">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setSelectedStudentId('')}
                className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm group"
                title="Voltar"
              >
                <i className="fas fa-chevron-left group-hover:-translate-x-1 transition-transform"></i>
              </button>
              <div>
                <span className="block text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-1">Dossiê do Aluno</span>
                <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tighter leading-none">{selectedStudent?.name}</h2>
              </div>
            </div>
            {selectedStudent?.phone && (
              <div className="flex items-center gap-4 bg-emerald-50 px-6 py-4 rounded-3xl border border-emerald-100">
                <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm">
                  <i className="fas fa-phone-alt text-lg"></i>
                </div>
                <div>
                  <span className="block text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-0.5">Contato do Aluno</span>
                  <span className="text-xl font-black text-emerald-700 tracking-tighter">{selectedStudent.phone}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-12">
            {(() => {
              const studentClasses = classes.filter(c =>
                (selectedStudent?.enrolledClassIds || []).includes(c.id) ||
                records.some(r => r.classId === c.id && r.statuses?.[selectedStudentId])
              ).sort((a, b) => {
                if (b.year !== a.year) return b.year - a.year;
                return b.semester.localeCompare(a.semester);
              });

              if (studentClasses.length === 0) {
                return (
                  <div className="bg-white rounded-[40px] border-4 border-dashed border-gray-100 p-20 text-center max-w-2xl mx-auto shadow-sm">
                    <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-8 text-gray-200">
                      <i className="fas fa-user-slash text-4xl"></i>
                    </div>
                    <h3 className="text-2xl font-black text-gray-300 uppercase tracking-widest leading-tight">Nenhuma frequência registrada.</h3>
                  </div>
                );
              }

              return studentClasses.map(cls => {
                const stats = calculateStats(selectedStudentId, cls.id);
                const classHistory = records
                  .filter(r => r.classId === cls.id && r.statuses?.[selectedStudentId])
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                return (
                  <div key={cls.id} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                        <i className="fas fa-graduation-cap"></i>
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">{cls.courseName}</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {cls.year} • {cls.semester} • {cls.days.join(', ')}
                        </p>
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent"></div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      <div className="lg:col-span-4">
                        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 h-full">
                          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                            <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
                            Desempenho nesta Turma
                          </h3>
                          <div className="space-y-8">
                            <div className="flex flex-col items-center">
                              <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                                <svg className="w-full h-full transform -rotate-90">
                                  <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-gray-100" />
                                  <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray={364} strokeDashoffset={364 - (364 * stats.percentage) / 100} strokeLinecap="round" className={stats.percentage < 75 ? "text-red-500" : "text-green-500"} />
                                </svg>
                                <span className={`absolute text-2xl font-black ${stats.percentage < 75 ? "text-red-500" : "text-green-500"}`}>
                                  {stats.percentage.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="text-center p-3 bg-green-50 rounded-2xl border border-green-100">
                                <span className="block text-xl font-black text-green-600">{stats.presences}</span>
                                <span className="text-[8px] font-black text-green-700/50 uppercase tracking-widest">Pres</span>
                              </div>
                              <div className="text-center p-3 bg-red-50 rounded-2xl border border-red-100">
                                <span className="block text-xl font-black text-red-600">{stats.absences}</span>
                                <span className="text-[8px] font-black text-red-700/50 uppercase tracking-widest">Faltas</span>
                              </div>
                              <div className="text-center p-3 bg-amber-50 rounded-2xl border border-amber-100">
                                <span className="block text-xl font-black text-amber-600">{stats.justified}</span>
                                <span className="text-[8px] font-black text-amber-700/50 uppercase tracking-widest">Just.</span>
                              </div>
                            </div>
                            <div className="pt-6 border-t border-gray-50 flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                              <span className="text-gray-400">Total de aulas: {stats.totalClasses}</span>
                              <span className={stats.percentage < 75 ? "text-red-500" : "text-green-600"}>
                                {stats.percentage < 75 ? "Revisar" : "Aprovado"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="lg:col-span-8">
                        <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead className="bg-gray-50/50 text-gray-400 text-[9px] font-black uppercase tracking-widest border-b border-gray-100">
                                <tr>
                                  <th className="px-8 py-4">Data</th>
                                  <th className="px-8 py-4 text-right">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {classHistory.map(record => {
                                  const status = record.statuses?.[selectedStudentId];
                                  return (
                                    <tr key={record.id} className="hover:bg-gray-50/80 transition-colors">
                                      <td className="px-8 py-4">
                                        <span className="text-gray-800 font-black uppercase tracking-tight">
                                          {new Date(record.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                        </span>
                                      </td>
                                      <td className="px-8 py-4 text-right">
                                        <span className={`inline-flex px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${status === 'presente' ? 'bg-green-50 text-green-600 border-green-100' :
                                          status === 'ausente' ? 'bg-red-50 text-red-600 border-red-100' :
                                            'bg-amber-50 text-amber-600 border-amber-100'
                                          }`}>
                                          {status}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO RÁPIDA */}
      {editingClass && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <header className="p-8 bg-indigo-50/50 border-b border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Configurações Rápidas</span>
                <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Editar Turma</h3>
              </div>
              <button onClick={() => setEditingClass(null)} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors shadow-sm">
                <i className="fas fa-times"></i>
              </button>
            </header>
            <form onSubmit={handleSaveEdit} className="p-8 space-y-6">
              <div className="space-y-4">
                <section>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Nome do Curso / Matéria</label>
                  <input
                    type="text"
                    value={editingClass.courseName}
                    onChange={e => setEditingClass({ ...editingClass, courseName: e.target.value })}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white outline-none font-bold text-gray-700 transition-all"
                    required
                  />
                </section>
                <div className="grid grid-cols-2 gap-4">
                  <section>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Ano</label>
                    <input
                      type="number"
                      value={editingClass.year}
                      onChange={e => setEditingClass({ ...editingClass, year: parseInt(e.target.value) })}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white outline-none font-bold text-gray-700 transition-all"
                      required
                    />
                  </section>
                  <section>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Semestre</label>
                    <select
                      value={editingClass.semester}
                      onChange={e => setEditingClass({ ...editingClass, semester: e.target.value })}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white outline-none font-bold text-gray-700 transition-all"
                    >
                      <option value="1º Semestre">1º Semestre</option>
                      <option value="2º Semestre">2º Semestre</option>
                    </select>
                  </section>
                </div>
                <section>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Dias (separados por vírgula)</label>
                  <input
                    type="text"
                    value={editingClass.days.join(', ')}
                    onChange={e => setEditingClass({ ...editingClass, days: e.target.value.split(',').map(d => d.trim()) })}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white outline-none font-bold text-gray-700 transition-all"
                    placeholder="Segunda, Quarta..."
                    required
                  />
                </section>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs p-5 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                >
                  {isSaving ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;


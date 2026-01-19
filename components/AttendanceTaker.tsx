
import React, { useState, useMemo } from 'react';
import { Class, Student, AttendanceRecord, AttendanceStatus } from '../types';
import { db } from '../supabase';

interface AttendanceTakerProps {
  classes: Class[];
  students: Student[];
  records: AttendanceRecord[];
  setRecords: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  setClasses: React.Dispatch<React.SetStateAction<Class[]>>;
}

const dayNameMap: Record<number, string> = {
  0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado'
};

const dayShortMap: Record<string, string> = {
  'Segunda': 'SEG', 'Terça': 'TER', 'Quarta': 'QUA', 'Quinta': 'QUI', 'Sexta': 'SEX', 'Sábado': 'SAB', 'Domingo': 'DOM'
};

const dayIndices: Record<string, number> = {
  'Domingo': 0, 'Segunda': 1, 'Terça': 2, 'Quarta': 3, 'Quinta': 4, 'Sexta': 5, 'Sábado': 6
};

const daysOfWeek = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Função para gerar todas as datas de aula de uma turma no semestre
const generateSemesterDates = (year: number, semester: string, classDays: string[], customStart?: string, customEnd?: string) => {
  const dates: { date: string, dayName: string, short: string }[] = [];

  let startDate: Date;
  let endDate: Date;

  if (customStart && customEnd) {
    startDate = new Date(customStart + 'T12:00:00');
    endDate = new Date(customEnd + 'T12:00:00');
  } else {
    const startMonth = semester === '1º Semestre' ? 1 : 7; // Feb (1) ou Aug (7) - 0 indexed
    const endMonth = semester === '1º Semestre' ? 5 : 11; // Jun (5) ou Dec (11)
    startDate = new Date(year, startMonth, 1);
    endDate = new Date(year, endMonth, 31);
  }

  const targetIndices = classDays.map(d => dayIndices[d]);

  let curr = new Date(startDate);
  while (curr <= endDate) {
    if (targetIndices.includes(curr.getDay())) {
      const isoDate = curr.toISOString().split('T')[0];
      const dayName = dayNameMap[curr.getDay()];
      dates.push({
        date: isoDate,
        dayName: dayName,
        short: dayShortMap[dayName]
      });
    }
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
};

const AttendanceTaker: React.FC<AttendanceTakerProps> = ({ classes, setClasses, students, records, setRecords }) => {
  const [selectedClassId, setSelectedClassId] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterSemester, setFilterSemester] = useState<'1º Semestre' | '2º Semestre'>(
    new Date().getMonth() < 6 ? '1º Semestre' : '2º Semestre'
  );
  const [isBulkConfigOpen, setIsBulkConfigOpen] = useState(false);
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [isSavingBulk, setIsSavingBulk] = useState(false);

  const selectedClass = classes.find(c => c.id === selectedClassId);

  const filteredClasses = useMemo(() => {
    return classes.filter(c =>
      c.year === filterYear &&
      c.semester.trim().toLowerCase() === filterSemester.trim().toLowerCase()
    );
  }, [classes, filterYear, filterSemester]);

  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students
      .filter(s =>
        ((selectedClass.studentIds || []).includes(s.id) || (s.enrolledClassIds || []).includes(selectedClass.id)) &&
        s.status === 'cursando'
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedClass, students]);

  const semesterDates = useMemo(() => {
    if (!selectedClass) return [];
    return generateSemesterDates(selectedClass.year, selectedClass.semester, selectedClass.days, selectedClass.startDate, selectedClass.endDate);
  }, [selectedClass]);

  // ... (keeping other memos and handlers same)
  // Mapeamento de registros por data para acesso rápido
  const recordsMap = useMemo(() => {
    const map: Record<string, AttendanceRecord> = {};
    records.forEach(r => {
      if (r.classId === selectedClassId) {
        map[r.date] = r;
      }
    });
    return map;
  }, [records, selectedClassId]);

  const handleCellClick = async (studentId: string, date: string) => {
    if (!selectedClassId || savingId) return;

    const existingRecord = recordsMap[date];
    const currentStatus = existingRecord?.statuses[studentId];

    // Ciclo: null -> presente (P) -> ausente (F) -> justificado (J) -> null
    let nextStatus: AttendanceStatus | undefined;
    if (!currentStatus) nextStatus = 'presente';
    else if (currentStatus === 'presente') nextStatus = 'ausente';
    else if (currentStatus === 'ausente') nextStatus = 'justificado';
    else nextStatus = undefined;

    setSavingId(`${studentId}-${date}`);

    try {
      const newRecord: AttendanceRecord = {
        id: existingRecord?.id || crypto.randomUUID(),
        date: date,
        classId: selectedClassId,
        statuses: {
          ...(existingRecord?.statuses || {}),
        }
      };

      if (nextStatus) {
        newRecord.statuses[studentId] = nextStatus;
      } else {
        delete newRecord.statuses[studentId];
      }

      const savedRecord = await db.attendance.save(newRecord);

      setRecords(prev => {
        const filtered = prev.filter(r => r.id !== savedRecord.id);
        return [...filtered, savedRecord];
      });
    } catch (error) {
      console.error('Erro ao salvar chamada:', error);
    } finally {
      setSavingId(null);
    }
  };

  const handleBulkUpdateDates = async () => {
    if (!bulkStartDate || !bulkEndDate || isSavingBulk) return;

    if (!window.confirm(`Isso irá atualizar as datas de início e fim de TODAS as ${filteredClasses.length} turmas do ${filterSemester} de ${filterYear}. Deseja continuar?`)) {
      return;
    }

    setIsSavingBulk(true);
    try {
      const updatedClasses = filteredClasses.map(c => ({
        ...c,
        startDate: bulkStartDate,
        endDate: bulkEndDate
      }));

      await db.classes.saveAll(updatedClasses);

      setClasses(prev => prev.map(c => {
        const updated = updatedClasses.find(uc => uc.id === c.id);
        return updated ? updated : c;
      }));

      setIsBulkConfigOpen(false);
      alert('Datas do semestre atualizadas com sucesso em todas as turmas!');
    } catch (error: any) {
      console.error('Erro ao atualizar datas em massa:', error);
      alert(`Erro ao atualizar datas: ${error.message || 'Erro desconhecido'}. Verifique se as colunas start_date e end_date existem na tabela classes.`);
    } finally {
      setIsSavingBulk(false);
    }
  };

  const getStatusDisplay = (studentId: string, date: string) => {
    const status = recordsMap[date]?.statuses[studentId];
    if (status === 'presente') return { char: 'P', color: 'text-blue-600', bg: 'bg-blue-50/30' };
    if (status === 'ausente') return { char: 'F', color: 'text-rose-600', bg: 'bg-rose-50/30' }; // F de Falta (como na imagem)
    if (status === 'justificado') return { char: 'J', color: 'text-amber-600', bg: 'bg-amber-50/30' };
    return { char: '', color: '', bg: '' };
  };

  const getSummary = (studentId: string) => {
    const datesWithStatus = semesterDates.map(d => recordsMap[d.date]?.statuses[studentId]).filter(Boolean);
    const presences = datesWithStatus.filter(s => s === 'presente' || s === 'justificado').length;
    const absences = datesWithStatus.filter(s => s === 'ausente').length;
    const total = datesWithStatus.length;
    const freq = total > 0 ? Math.round((presences / total) * 100) : null;
    return { presences, absences, freq };
  };

  if (!selectedClassId) {
    return (
      <div className="pb-10 animate-in fade-in duration-500">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight uppercase">Folha de Chamada</h1>
            <p className="text-gray-500 font-medium text-xs leading-none uppercase tracking-widest">Selecione uma turma para visualizar a folha de presença do semestre.</p>
          </div>

          <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-2">
            <button
              onClick={() => {
                setBulkStartDate('');
                setBulkEndDate('');
                setIsBulkConfigOpen(true);
              }}
              className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100/50 mr-2"
              title="Configurar datas para todas as turmas deste período"
            >
              <i className="fas fa-calendar-alt mr-2"></i>
              Configurar Período
            </button>
            <input
              type="number"
              value={filterYear}
              onChange={(e) => setFilterYear(parseInt(e.target.value))}
              className="w-20 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-[11px] font-black text-gray-700 focus:border-indigo-500 outline-none transition-all"
            />
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value as any)}
              className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-[11px] font-black text-gray-700 focus:border-indigo-500 outline-none transition-all"
            >
              <option value="1º Semestre">1º Semestre</option>
              <option value="2º Semestre">2º Semestre</option>
            </select>
          </div>
        </header>

        {/* Modal de Configuração em Massa */}
        {isBulkConfigOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <header className="p-8 bg-indigo-50/50 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Configuração em Massa</span>
                  <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Datas do Semestre</h3>
                </div>
                <button onClick={() => setIsBulkConfigOpen(false)} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors shadow-sm">
                  <i className="fas fa-times"></i>
                </button>
              </header>
              <div className="p-8 space-y-6">
                <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-xl text-[10px] font-bold text-amber-800 leading-relaxed uppercase tracking-tight">
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  Esta alteração afetará as {filteredClasses.length} turmas selecionadas no filtro atual ({filterYear} - {filterSemester}).
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <section>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Data de Início das Aulas</label>
                    <input
                      type="date"
                      value={bulkStartDate}
                      onChange={e => setBulkStartDate(e.target.value)}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white outline-none font-bold text-gray-700 transition-all shadow-inner"
                    />
                  </section>
                  <section>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Data de Término das Aulas</label>
                    <input
                      type="date"
                      value={bulkEndDate}
                      onChange={e => setBulkEndDate(e.target.value)}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white outline-none font-bold text-gray-700 transition-all shadow-inner"
                    />
                  </section>
                </div>
                <button
                  onClick={handleBulkUpdateDates}
                  disabled={isSavingBulk || !bulkStartDate || !bulkEndDate}
                  className="w-full bg-indigo-600 text-white font-black uppercase tracking-widest text-xs p-5 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95"
                >
                  {isSavingBulk ? 'ATUALIZANDO...' : 'APLICAR EM TODAS AS TURMAS'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-12">
          {filteredClasses.length === 0 ? (
            <div className="py-32 text-center bg-white rounded-[40px] border-4 border-dashed border-gray-100">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-200">
                <i className="fas fa-folder-open text-3xl"></i>
              </div>
              <p className="text-gray-400 font-bold text-xl uppercase tracking-widest">Nenhuma turma encontrada para este período</p>
            </div>
          ) : (
            daysOfWeek.map(day => {
              const classesOnDay = filteredClasses
                .filter(c => c.days.includes(day))
                .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));

              if (classesOnDay.length === 0) return null;

              return (
                <div key={day} className="animate-in fade-in slide-in-from-left-4 duration-500">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-200"></div>
                    <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-2">
                      <i className="fas fa-calendar-day text-indigo-400"></i>
                      {day}
                    </h2>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-200"></div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {classesOnDay.map((c) => {
                      const colors = [
                        { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', accent: 'bg-blue-500', shadow: 'shadow-blue-500/20' },
                        { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', accent: 'bg-emerald-500', shadow: 'shadow-emerald-500/20' },
                        { bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600', accent: 'bg-amber-500', shadow: 'shadow-amber-500/20' },
                        { bg: 'bg-rose-50', icon: 'bg-rose-100 text-rose-600', accent: 'bg-rose-500', shadow: 'shadow-rose-500/20' },
                        { bg: 'bg-violet-50', icon: 'bg-violet-100 text-violet-600', accent: 'bg-violet-500', shadow: 'shadow-violet-500/20' },
                        { bg: 'bg-cyan-50', icon: 'bg-cyan-100 text-cyan-600', accent: 'bg-cyan-500', shadow: 'shadow-cyan-500/20' }
                      ];
                      const colorIndex = filteredClasses.findIndex(cl => cl.id === c.id);
                      const color = colors[colorIndex % colors.length];

                      const studentCount = students.filter(s =>
                        (c.studentIds || []).includes(s.id) ||
                        (s.enrolledClassIds || []).includes(c.id)
                      ).filter(s => s.status === 'cursando').length;

                      return (
                        <div
                          key={`${day}-${c.id}`}
                          onClick={() => setSelectedClassId(c.id)}
                          className={`${color.bg} rounded-[24px] shadow-sm border border-gray-100 hover:shadow-xl ${color.shadow} hover:-translate-y-1 cursor-pointer transition-all duration-300 group relative overflow-hidden`}
                        >
                          <div className={`absolute -right-6 -top-6 w-32 h-32 ${color.accent} rounded-full opacity-5 group-hover:opacity-10 transition-all duration-500`}></div>

                          <div className="relative z-10 flex items-center justify-between p-4 gap-6">
                            <div className="flex items-center gap-5 flex-1 min-w-0">
                              <div className={`w-14 h-14 ${color.icon} rounded-2xl flex items-center justify-center shadow-inner shrink-0`}>
                                <i className="fas fa-calendar-check text-xl"></i>
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
                                  <span className="bg-white/60 px-2 py-1 rounded-lg uppercase tracking-wider shrink-0">
                                    {c.year} • {c.semester}
                                  </span>
                                  <span className="bg-white/60 px-2 py-1 rounded-lg uppercase tracking-wider shrink-0 text-indigo-400 font-black">
                                    {c.days.join(', ')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="hidden md:flex items-center gap-3">
                              <div className="bg-indigo-50/80 text-indigo-600 px-3 py-1.5 rounded-xl font-black text-[10px] shadow-sm uppercase tracking-wide flex items-center gap-2 border border-indigo-100/30">
                                <i className="fas fa-user-check"></i>
                                <span>{studentCount} Ativos</span>
                              </div>
                            </div>

                            <div className="w-8 h-8 flex items-center justify-center text-gray-300 group-hover:text-indigo-400 transition-colors ml-2">
                              <i className="fas fa-chevron-right"></i>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10 animate-in fade-in duration-500 max-w-full overflow-hidden">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedClassId('')}
            className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-gray-100"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <div>
            <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight leading-none">{selectedClass?.courseName}</h1>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
              Chamada Semestral • {selectedClass?.year} - {selectedClass?.semester}
            </p>
          </div>
        </div>

        <div className="flex gap-2 text-[9px] font-black uppercase tracking-widest">
          <div className="flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg border border-blue-100">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span> P = Presente
          </div>
          <div className="flex items-center gap-2 bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg border border-rose-100">
            <span className="w-2 h-2 rounded-full bg-rose-600"></span> F = Falta
          </div>
          <div className="flex items-center gap-2 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg border border-amber-100">
            <span className="w-2 h-2 rounded-full bg-amber-600"></span> J = Justificada
          </div>
        </div>
      </header>

      {/* TABELA ESTILO PLANILHA */}
      <div className="bg-white rounded-[32px] border border-gray-200 shadow-2xl shadow-indigo-100/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#1e293b] text-white">
                <th className="sticky left-0 z-20 bg-[#1e293b] p-4 text-left font-black text-[11px] uppercase tracking-widest min-w-[200px] border-r border-gray-700">Aluno</th>
                {semesterDates.map(d => (
                  <th key={d.date} className="p-3 text-center border-r border-gray-700 min-w-[60px]">
                    <div className="text-[9px] font-black opacity-60">{d.short}</div>
                    <div className="text-[11px] font-black mt-0.5">{d.date.split('-').reverse().slice(0, 2).join('/')}</div>
                  </th>
                ))}
                <th colSpan={3} className="bg-[#1e293b] p-3 text-center font-black text-[11px] uppercase tracking-widest border-l border-gray-700">Resumo</th>
              </tr>
              <tr className="bg-[#2d3748] text-white/70 border-b border-gray-800">
                <th className="sticky left-0 z-20 bg-[#2d3748] border-r border-gray-800"></th>
                {semesterDates.map(d => <th key={`sub-${d.date}`} className="border-r border-gray-800"></th>)}
                <th className="text-[9px] font-black p-2 min-w-[40px] border-r border-gray-800 bg-rose-900/20 text-rose-300">F</th>
                <th className="text-[9px] font-black p-2 min-w-[40px] border-r border-gray-800 bg-emerald-900/20 text-emerald-300">P</th>
                <th className="text-[9px] font-black p-2 min-w-[50px] bg-indigo-900/20 text-indigo-300">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {classStudents.map(student => {
                const summary = getSummary(student.id);
                return (
                  <tr key={student.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 p-4 font-black text-[13px] text-gray-700 uppercase border-r border-gray-100 whitespace-nowrap">
                      {student.name}
                    </td>
                    {semesterDates.map(d => {
                      const display = getStatusDisplay(student.id, d.date);
                      const isSaving = savingId === `${student.id}-${d.date}`;
                      return (
                        <td
                          key={`${student.id}-${d.date}`}
                          onClick={() => handleCellClick(student.id, d.date)}
                          className={`p-0 border-r border-gray-100 cursor-pointer hover:bg-indigo-50/50 transition-all relative ${display.bg}`}
                        >
                          <div className={`w-full h-12 flex items-center justify-center font-black text-sm ${display.color}`}>
                            {isSaving ? (
                              <i className="fas fa-circle-notch fa-spin text-indigo-300"></i>
                            ) : display.char}
                          </div>
                        </td>
                      );
                    })}
                    {/* COLUNAS DE RESUMO */}
                    <td className="p-3 text-center font-black text-[13px] text-rose-500 bg-rose-50/30 border-r border-gray-100 min-w-[40px]">
                      {summary.absences}
                    </td>
                    <td className="p-3 text-center font-black text-[13px] text-emerald-600 bg-emerald-50/30 border-r border-gray-100 min-w-[40px]">
                      {summary.presences}
                    </td>
                    <td className="p-3 text-center font-black text-[12px] text-gray-500 bg-gray-50/50 min-w-[50px]">
                      {summary.freq !== null ? `${summary.freq}%` : '--'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 bg-indigo-50 p-6 rounded-[28px] border border-indigo-100">
        <p className="text-gray-600 text-[11px] font-medium leading-relaxed">
          <i className="fas fa-info-circle text-indigo-400 mr-2"></i>
          Para registrar a presença, basta clicar na célula correspondente à data e ao aluno.
          O sistema alterna entre <strong>P (Presente) → F (Falta) → J (Justificada) → Vazio</strong> automaticamente e salva em tempo real.
        </p>
      </div>
    </div>
  );
};

export default AttendanceTaker;

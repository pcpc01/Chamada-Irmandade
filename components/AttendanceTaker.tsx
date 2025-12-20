
import React, { useState, useMemo } from 'react';
import { Class, Student, AttendanceRecord, AttendanceStatus } from '../types';
import { db } from '../supabase';

interface AttendanceTakerProps {
  classes: Class[];
  students: Student[];
  records: AttendanceRecord[];
  setRecords: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
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

// Função para gerar todas as datas de aula de uma turma no semestre
const generateSemesterDates = (year: number, semester: string, classDays: string[]) => {
  const dates: { date: string, dayName: string, short: string }[] = [];
  const startMonth = semester === '1º Semestre' ? 1 : 7; // Feb (1) ou Aug (7) - 0 indexed
  const endMonth = semester === '1º Semestre' ? 5 : 11; // Jun (5) ou Dec (11)

  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, endMonth, 31);

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

const AttendanceTaker: React.FC<AttendanceTakerProps> = ({ classes, students, records, setRecords }) => {
  const [selectedClassId, setSelectedClassId] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterSemester, setFilterSemester] = useState<'1º Semestre' | '2º Semestre'>(
    new Date().getMonth() < 6 ? '1º Semestre' : '2º Semestre'
  );

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
    return generateSemesterDates(selectedClass.year, selectedClass.semester, selectedClass.days);
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClasses.length > 0 ? (
            filteredClasses.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedClassId(c.id)}
                className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <i className="fas fa-calendar-check text-xl"></i>
                  </div>
                  <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-2 py-1 rounded-lg uppercase tracking-widest">{c.time}</span>
                </div>
                <h3 className="font-black text-gray-800 uppercase tracking-tight mb-2 truncate">{c.courseName}</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {c.year} • {c.semester} • {c.days.join(', ')}
                </p>
              </button>
            ))
          ) : (
            <div className="col-span-full py-20 bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-200 text-center">
              <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-[10px]">Nenhuma turma encontrada para este período.</p>
            </div>
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

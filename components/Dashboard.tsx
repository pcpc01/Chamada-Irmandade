
import React, { useState, useMemo } from 'react';
import { View, Student, Class, AttendanceRecord } from '../types';

interface DashboardProps {
  students: Student[];
  classes: Class[];
  records: AttendanceRecord[];
  onNavigate: (view: View) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ students, classes, records, onNavigate }) => {
  const [filterMode, setFilterMode] = useState<'always' | 'period'>('period');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterSemester, setFilterSemester] = useState<'1º Semestre' | '2º Semestre'>(
    new Date().getMonth() < 6 ? '1º Semestre' : '2º Semestre'
  );

  // Filtragem dos dados
  const filteredData = useMemo(() => {
    if (filterMode === 'always') {
      return {
        classes: classes,
        studentsCount: students.length,
        studentsList: students,
        records: records
      };
    }

    const filteredClasses = classes.filter(c => c.year === filterYear && c.semester === filterSemester);
    const filteredClassIds = new Set(filteredClasses.map(c => c.id));

    // Alunos vinculados àquelas turmas (diretamente ou por matrícula)
    const filteredStudents = students.filter(s =>
      (s.enrolledClassIds || []).some(id => filteredClassIds.has(id)) ||
      filteredClasses.some(c => (c.studentIds || []).includes(s.id))
    );

    const filteredRecords = records.filter(r => filteredClassIds.has(r.classId));

    return {
      classes: filteredClasses,
      studentsCount: filteredStudents.length,
      studentsList: filteredStudents,
      records: filteredRecords
    };
  }, [filterMode, filterYear, filterSemester, students, classes, records]);

  // 1. Estatísticas de Alunos por Status (baseado nos dados filtrados)
  const statusCounts = filteredData.studentsList.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // 2. Turmas de Hoje (sempre mostra as turmas reais de hoje, independente do filtro de período, 
  // mas vamos respeitar o filtro de período se o usuário quiser ver apenas turmas "desse período" que seriam hoje)
  const daysMap: Record<number, string> = {
    0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado'
  };
  const todayName = daysMap[new Date().getDay()];
  const todayClasses = filteredData.classes.filter(c => c.days.includes(todayName));

  // 3. Taxa de Frequência Recente (baseado nos registros filtrados)
  let totalPresences = 0;
  let totalStatuses = 0;

  filteredData.records.forEach(r => {
    Object.values(r.statuses || {}).forEach(status => {
      if (status === 'presente' || status === 'justificado') totalPresences++;
      if (status) totalStatuses++;
    });
  });

  const attendanceRate = totalStatuses > 0 ? (totalPresences / totalStatuses) * 100 : 0;

  return (
    <div className="pb-10 animate-in fade-in duration-500">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-6 text-center md:text-left">
          <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center p-2 hidden md:flex shrink-0 border border-gray-100 animate-in zoom-in-50 duration-700">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-gray-900 mb-1 tracking-tight uppercase">Dashboard</h1>
            <p className="text-gray-500 font-medium text-xs">Resumo operacional e estatístico do EduPresença.</p>
          </div>
        </div>

        {/* FILTROS DE DASHBOARD */}
        <div className="bg-white p-2 rounded-3xl border border-gray-100 shadow-sm flex flex-wrap items-center gap-2">
          <div className="flex bg-gray-50 p-1 rounded-2xl border border-gray-100">
            <button
              onClick={() => setFilterMode('always')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterMode === 'always' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Sempre
            </button>
            <button
              onClick={() => setFilterMode('period')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterMode === 'period' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Período
            </button>
          </div>

          {filterMode === 'period' && (
            <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
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
          )}
        </div>
      </header>

      {/* SEÇÃO 1: NÚMEROS PRINCIPAIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-[28px] shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group" onClick={() => onNavigate('students')}>
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 text-2xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
            <i className="fas fa-users"></i>
          </div>
          <div>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest leading-none mb-1">Total de Alunos</p>
            <h3 className="text-3xl font-black text-gray-800 tracking-tighter">{filteredData.studentsCount}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[28px] shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group" onClick={() => onNavigate('classes')}>
          <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 text-2xl group-hover:bg-purple-600 group-hover:text-white transition-all shadow-inner">
            <i className="fas fa-book"></i>
          </div>
          <div>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest leading-none mb-1">Turmas</p>
            <h3 className="text-3xl font-black text-gray-800 tracking-tighter">{filteredData.classes.length}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[28px] shadow-sm border border-gray-100 flex items-center gap-4 group">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 text-2xl shadow-inner group-hover:bg-emerald-600 group-hover:text-white transition-all">
            <i className="fas fa-chart-line"></i>
          </div>
          <div>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest leading-none mb-1">Frequência Geral</p>
            <h3 className="text-3xl font-black text-emerald-600 tracking-tighter">{attendanceRate.toFixed(0)}%</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[28px] shadow-sm border border-gray-100 flex items-center gap-4 group">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 text-2xl shadow-inner group-hover:bg-amber-600 group-hover:text-white transition-all">
            <i className="fas fa-calendar-day"></i>
          </div>
          <div>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest leading-none mb-1">Aulas Hoje</p>
            <h3 className="text-3xl font-black text-gray-800 tracking-tighter">{todayClasses.length}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* SEÇÃO 2: TURMAS DE HOJE */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">Turmas Programadas para Hoje</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-gray-100 to-transparent"></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {todayClasses.length > 0 ? (
              todayClasses.map(c => (
                <div key={c.id} className="bg-white p-6 rounded-[32px] border border-gray-50 shadow-sm hover:shadow-lg transition-all border-l-4 border-l-indigo-500 group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <i className="fas fa-graduation-cap"></i>
                    </div>
                    <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-2 py-1 rounded-lg uppercase tracking-widest flex items-center gap-2">
                      <i className="fas fa-clock text-indigo-400"></i>
                      {c.time}
                    </span>
                  </div>
                  <h3 className="font-black text-gray-800 uppercase tracking-tight mb-2 truncate">{c.courseName}</h3>
                  <div className="flex items-center gap-3 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                    <span>{c.year} • {c.semester}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full bg-gray-50/50 p-8 rounded-[32px] border-2 border-dashed border-gray-200 text-center">
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Nenhuma turma programada para hoje ({todayName}).</p>
              </div>
            )}
          </div>

          {/* QUICK ACTIONS */}
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 mt-10">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              Ações Rápidas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => onNavigate('attendance')}
                className="flex items-center gap-6 p-6 bg-indigo-50/50 border border-indigo-100 rounded-3xl hover:bg-indigo-600 hover:text-white transition-all group shadow-sm hover:shadow-lg hover:shadow-indigo-100"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:bg-indigo-500 group-hover:text-white transition-all">
                  <i className="fas fa-calendar-check text-2xl"></i>
                </div>
                <div className="text-left">
                  <span className="block font-black uppercase tracking-tighter text-lg leading-none mb-1">Fazer Chamada</span>
                  <span className="block text-[9px] font-bold opacity-60 uppercase tracking-widest">Registrar presenças hoje</span>
                </div>
              </button>
              <button
                onClick={() => onNavigate('reports')}
                className="flex items-center gap-6 p-6 bg-emerald-50/50 border border-emerald-100 rounded-3xl hover:bg-emerald-600 hover:text-white transition-all group shadow-sm hover:shadow-lg hover:shadow-emerald-100"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm group-hover:bg-emerald-500 group-hover:text-white transition-all">
                  <i className="fas fa-file-export text-2xl"></i>
                </div>
                <div className="text-left">
                  <span className="block font-black uppercase tracking-tighter text-lg leading-none mb-1">Ver Relatórios</span>
                  <span className="block text-[9px] font-bold opacity-60 uppercase tracking-widest">Analisar estatísticas detalhadas</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* SEÇÃO 3: DISTRIBUIÇÃO DE ALUNOS */}
        <div className="lg:col-span-4 space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">Resumo de Alunos {filterMode === 'period' ? 'no Período' : ''}</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-gray-100 to-transparent"></div>
          </div>

          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 space-y-8">
            <div className="space-y-6">
              {[
                { label: 'Cursando', count: statusCounts['cursando'] || 0, color: 'bg-blue-500', icon: 'fa-user-clock', text: 'text-blue-600' },
                { label: 'Concluiu', count: statusCounts['concluiu'] || 0, color: 'bg-emerald-500', icon: 'fa-user-check', text: 'text-emerald-600' },
                { label: 'Desistiu', count: statusCounts['desistiu'] || 0, color: 'bg-rose-500', icon: 'fa-user-times', text: 'text-rose-600' }
              ].map(item => (
                <div key={item.label} className="group cursor-pointer hover:translate-x-2 transition-transform" onClick={() => onNavigate('students')}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                      <i className={`fas ${item.icon} ${item.text}`}></i>
                      {item.label}
                    </span>
                    <span className="text-lg font-black text-gray-800 tracking-tighter">{item.count}</span>
                  </div>
                  <div className="w-full h-3 bg-gray-50 rounded-full overflow-hidden shadow-inner flex">
                    <div
                      className={`h-full ${item.color} transition-all duration-1000 ease-out`}
                      style={{ width: `${filteredData.studentsCount > 0 ? (item.count / filteredData.studentsCount) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-8 border-t border-gray-50">
              <div className="bg-gray-50/50 p-6 rounded-[32px] border border-gray-100">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <i className="fas fa-info-circle"></i>
                  </div>
                  <span className="text-[10px] font-black text-gray-800 uppercase tracking-widest">Contexto</span>
                </div>
                <p className="text-gray-500 text-[11px] leading-relaxed font-medium">
                  Exibindo dados para <strong>{filterMode === 'always' ? 'Todo o Histórico' : `${filterYear} - ${filterSemester}`}</strong>.
                  {filteredData.studentsCount > 0 ? ` Você possui ${filteredData.studentsCount} alunos vinculados a este contexto.` : ' Nenhuma informação encontrada para este filtro.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

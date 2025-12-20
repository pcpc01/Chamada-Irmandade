
import React, { useState } from 'react';
import { Student, Class, StudentStatus } from '../types';
import { db } from '../supabase';

interface StudentManagerProps {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  classes: Class[];
  setClasses: React.Dispatch<React.SetStateAction<Class[]>>;
  onViewReport: (studentId: string) => void;
}

const StudentManager: React.FC<StudentManagerProps> = ({ students, setStudents, classes, setClasses, onViewReport }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [observations, setObservations] = useState('');
  const [status, setStatus] = useState<StudentStatus>('cursando');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setName('');
    setPhone('');
    setObservations('');
    setStatus('cursando');
  };

  const handleEdit = (student: Student) => {
    setEditingId(student.id);
    setName(student.name);
    setPhone(student.phone);
    setObservations(student.observations || '');
    setStatus(student.status);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;

    setSaving(true);
    try {
      // Validar telefone duplicado
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone) {
        const isDuplicate = students.some(s =>
          s.id !== editingId &&
          s.phone.replace(/\D/g, '') === cleanPhone
        );

        if (isDuplicate) {
          alert('Já existe um aluno cadastrado com este número de telefone.');
          setSaving(false);
          return;
        }
      }

      const existing = students.find(s => s.id === editingId);

      const studentData: Student = {
        id: editingId || crypto.randomUUID(),
        name,
        phone,
        observations,
        status,
        enrolledClassIds: existing ? existing.enrolledClassIds : []
      };

      const savedStudent = await db.students.save(studentData);

      // Lógica de remoção de turmas se status não for 'cursando'
      let updatedClasses = classes;
      if (status !== 'cursando') {
        const affectedClasses = classes.filter(c => c.studentIds.includes(savedStudent.id));

        for (const cls of affectedClasses) {
          const newStudentIds = cls.studentIds.filter(id => id !== savedStudent.id);
          const updatedCls = { ...cls, studentIds: newStudentIds };
          await db.classes.save(updatedCls);
          updatedClasses = updatedClasses.map(c => c.id === cls.id ? updatedCls : c);
        }
        setClasses(updatedClasses);
      }

      if (editingId) {
        const updatedList = students.map(s => s.id === editingId ? savedStudent : s);
        setStudents([...updatedList].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const newList = [...students, savedStudent];
        setStudents(newList.sort((a, b) => a.name.localeCompare(b.name)));
      }

      resetForm();
    } catch (error) {
      console.error('Erro ao salvar aluno:', error);
      alert('Erro ao salvar o aluno. Verifique se o banco de dados foi atualizado com as novas colunas.');
    } finally {
      setSaving(false);
    }
  };

  const removeStudent = async (id: string) => {
    if (window.confirm('Deseja realmente remover este aluno? Isso o removerá de todas as turmas vinculadas.')) {
      setSaving(true);
      try {
        // 1. Remover o aluno do banco
        await db.students.delete(id);

        // 2. Atualizar todas as turmas em que o aluno estava
        const affectedClasses = classes.filter(c => c.studentIds.includes(id));
        let updatedClasses = [...classes];

        for (const cls of affectedClasses) {
          const updatedCls = {
            ...cls,
            studentIds: cls.studentIds.filter(sid => sid !== id)
          };
          await db.classes.save(updatedCls);
          updatedClasses = updatedClasses.map(c => c.id === cls.id ? updatedCls : c);
        }

        // 3. Atualizar estados globais
        setStudents(students.filter(s => s.id !== id));
        setClasses(updatedClasses);
      } catch (error) {
        console.error('Erro ao remover aluno:', error);
        alert('Erro ao remover o aluno e limpar turmas.');
      } finally {
        setSaving(false);
      }
    }
  };

  const changeStatus = async (student: Student, nextStatus: StudentStatus) => {
    if (saving || student.status === nextStatus) return;

    setSaving(true);
    try {
      const updatedStudent: Student = { ...student, status: nextStatus };
      const savedStudent = await db.students.save(updatedStudent);

      // Lógica de remoção de turmas se status não for 'cursando'
      if (nextStatus !== 'cursando') {
        const affectedClasses = classes.filter(c => c.studentIds.includes(student.id));
        let updatedClasses = classes;

        for (const cls of affectedClasses) {
          const newStudentIds = cls.studentIds.filter(id => id !== student.id);
          const updatedCls = { ...cls, studentIds: newStudentIds };
          await db.classes.save(updatedCls);
          updatedClasses = updatedClasses.map(c => c.id === cls.id ? updatedCls : c);
        }
        setClasses(updatedClasses);
      }

      setStudents(students.map(s => s.id === student.id ? savedStudent : s));
    } catch (error) {
      console.error('Erro ao trocar status:', error);
      alert('Erro ao atualizar o status do aluno.');
    } finally {
      setSaving(false);
    }
  };

  const getStatusSelect = (student: Student) => {
    const status = student.status;
    let colorClass = "";
    switch (status) {
      case 'cursando': colorClass = "text-green-700 bg-green-100 border-green-200"; break;
      case 'desistiu': colorClass = "text-red-700 bg-red-100 border-red-200"; break;
      case 'concluiu': colorClass = "text-blue-700 bg-blue-100 border-blue-200"; break;
    }

    return (
      <select
        value={status}
        disabled={saving}
        onChange={(e) => changeStatus(student, e.target.value as StudentStatus)}
        className={`px-2 py-1 rounded-lg text-xs font-bold border outline-none appearance-none cursor-pointer transition-all ${colorClass} text-center min-w-[100px] hover:opacity-80`}
      >
        <option value="cursando">CURSANDO</option>
        <option value="desistiu">DESISTIU</option>
        <option value="concluiu">CONCLUIU</option>
      </select>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Alunos</h1>
        <button
          onClick={() => isAdding ? resetForm() : setIsAdding(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2 transition-colors"
        >
          <i className={`fas ${isAdding ? 'fa-times' : 'fa-plus'}`}></i>
          {isAdding ? 'Cancelar' : 'Novo Aluno'}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-lg font-bold text-gray-800 mb-4">{editingId ? 'Editar Aluno' : 'Novo Aluno'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Ex: João Silva"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea
                value={observations}
                onChange={e => setObservations(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px] resize-none"
                placeholder="Ex: Aluno possui restrições, observações pedagógicas, etc..."
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-4 w-full md:w-auto bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
          >
            {saving ? 'Salvando...' : editingId ? 'Atualizar Aluno' : 'Salvar Aluno'}
          </button>
        </form>
      )}

      <div className="space-y-4 mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {students.length === 0 ? (
          <div className="bg-white rounded-[40px] border-4 border-dashed border-gray-100 p-20 text-center shadow-sm">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-8 text-gray-200 text-4xl">
              <i className="fas fa-users-slash"></i>
            </div>
            <h3 className="text-2xl font-black text-gray-300 uppercase tracking-[0.2em]">Nenhum aluno encontrado</h3>
          </div>
        ) : (
          [...students]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((s, index) => {
              const colors = [
                { bg: 'bg-[#f0f9ff]', border: 'border-blue-100/50', icon: 'text-blue-400' },
                { bg: 'bg-[#f0fdf4]', border: 'border-emerald-100/50', icon: 'text-emerald-400' },
                { bg: 'bg-[#fffbeb]', border: 'border-amber-100/50', icon: 'text-amber-400' },
                { bg: 'bg-[#fff1f2]', border: 'border-rose-100/50', icon: 'text-rose-400' },
                { bg: 'bg-[#faf5ff]', border: 'border-violet-100/50', icon: 'text-violet-400' },
                { bg: 'bg-[#ecfeff]', border: 'border-cyan-100/50', icon: 'text-cyan-400' }
              ];
              const color = colors[index % colors.length];

              return (
                <div
                  key={s.id}
                  className={`${color.bg} ${color.border} border-2 p-5 rounded-[32px] shadow-lg shadow-black/[0.02] hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-500 group relative overflow-hidden`}
                >
                  <div className="flex flex-col lg:flex-row items-center gap-6 relative z-10">
                    {/* 1. Profile Column (Increased Width) */}
                    <div className="flex items-center gap-4 lg:w-80 shrink-0">
                      <button
                        onClick={() => onViewReport(s.id)}
                        className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-lg font-black text-gray-300 shadow-inner hover:bg-indigo-600 hover:text-white transition-all duration-500 uppercase cursor-pointer shrink-0"
                        title="Ver Relatório"
                      >
                        {s.name.charAt(0)}
                      </button>
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => onViewReport(s.id)}
                          className="group/name text-left block w-full"
                        >
                          <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight leading-tight group-hover:text-indigo-600 transition-colors duration-300 cursor-pointer truncate">
                            {s.name}
                          </h3>
                        </button>
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block mt-0.5">
                          ID: {s.id.split('-')[0]}
                        </span>
                      </div>
                    </div>

                    {/* 2. Contact Column (Fixed Width) */}
                    <div className="w-full lg:w-48 shrink-0">
                      <div className="bg-white/50 px-4 py-2.5 rounded-2xl border border-white/60 shadow-sm">
                        <div className="min-w-0">
                          <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Telefone</span>
                          <span className="text-xs font-black text-gray-800 tracking-tighter leading-none block truncate">
                            {s.phone || '(00) 00000-0000'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Observations Column (Flexible) */}
                    <div className="flex-1 w-full min-w-0">
                      {s.observations ? (
                        <div className="bg-white/30 px-4 py-2.5 rounded-2xl border border-white/40 shadow-sm">
                          <div className="min-w-0">
                            <span className="block text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Observação</span>
                            <p className="text-[10px] font-bold text-gray-600 leading-tight italic truncate">
                              {s.observations}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="h-12 border border-dashed border-black/5 rounded-2xl flex items-center px-4 opacity-20">
                          <span className="text-[8px] font-black uppercase tracking-widest">Sem observações</span>
                        </div>
                      )}
                    </div>

                    {/* 4. Courses Column (Reduced Width) */}
                    <div className="lg:w-48 shrink-0 flex items-center gap-2 overflow-hidden">
                      <div className="flex flex-col gap-1.5 w-full">
                        {s.enrolledClassIds && s.enrolledClassIds.slice(0, 2).map(classId => {
                          const cls = classes.find(c => c.id === classId);
                          return cls ? (
                            <div key={classId} className="bg-white/80 px-2.5 py-1.5 rounded-lg border border-black/5 shadow-sm flex justify-between items-center gap-2">
                              <span className="text-[9px] font-black text-gray-800 uppercase tracking-tight truncate flex-1">
                                {cls.courseName}
                              </span>
                              <span className="text-[7px] font-bold text-indigo-400 uppercase tracking-widest whitespace-nowrap shrink-0">
                                {cls.year} • {cls.semester}
                              </span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>

                    {/* 5. Actions Column (Fixed Width) */}
                    <div className="flex items-center gap-2 shrink-0 border-l border-black/5 pl-4">
                      <button
                        onClick={() => handleEdit(s)}
                        className="w-9 h-9 bg-white text-indigo-500 rounded-lg hover:bg-indigo-600 hover:text-white transition-all duration-300 flex items-center justify-center shadow-sm border border-gray-100"
                        title="Editar"
                      >
                        <i className="fas fa-edit text-xs"></i>
                      </button>
                      <button
                        onClick={() => removeStudent(s.id)}
                        className="w-9 h-9 bg-white text-red-300 hover:bg-red-500 hover:text-white transition-all duration-300 flex items-center justify-center shadow-sm border border-gray-100"
                        title="Remover"
                      >
                        <i className="fas fa-trash-alt text-xs"></i>
                      </button>
                    </div>
                  </div>

                  {/* Faint decorative element */}
                  <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full pointer-events-none group-hover:scale-125 transition-transform duration-700"></div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
};

export default StudentManager;

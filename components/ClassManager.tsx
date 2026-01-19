
import React, { useState } from 'react';
import { Class, Student, StudentStatus } from '../types';
import { db } from '../supabase';

interface ClassManagerProps {
  classes: Class[];
  setClasses: React.Dispatch<React.SetStateAction<Class[]>>;
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
}

const ClassManager: React.FC<ClassManagerProps> = ({ classes, setClasses, students, setStudents }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingDetailsId, setViewingDetailsId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [time, setTime] = useState('');
  const [frequency, setFrequency] = useState<1 | 2>(1);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [semester, setSemester] = useState(new Date().getMonth() + 1 <= 6 ? '1º Semestre' : '2º Semestre');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [transferringStudent, setTransferringStudent] = useState<{ id: string, name: string } | null>(null);
  const [isAddingStudentModalOpen, setIsAddingStudentModalOpen] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [formStudentSearch, setFormStudentSearch] = useState('');
  const [isCloningModalOpen, setIsCloningModalOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const currentSemester = new Date().getMonth() + 1 <= 6 ? '1º Semestre' : '2º Semestre';

  const [cloneYear, setCloneYear] = useState(currentYear);
  const [cloneSemester, setCloneSemester] = useState(currentSemester);
  const [filterYear, setFilterYear] = useState<number>(currentYear);
  const [filterSemester, setFilterSemester] = useState<string>(currentSemester);

  const daysOfWeek = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const toggleStudent = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter(sid => sid !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  };

  const resetForm = () => {
    setCourseName('');
    setSelectedDays([]);
    setTime('');
    setFrequency(1);
    setSelectedStudentIds([]);
    setYear(new Date().getFullYear());
    setSemester(new Date().getMonth() + 1 <= 6 ? '1º Semestre' : '2º Semestre');
    setStartDate('');
    setEndDate('');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (e: React.MouseEvent, cls: Class) => {
    e.stopPropagation();
    setEditingId(cls.id);
    setCourseName(cls.courseName);
    setSelectedDays(cls.days);
    setTime(cls.time);
    setFrequency(cls.frequency);
    setSelectedStudentIds(cls.studentIds);
    setYear(cls.year);
    setSemester(cls.semester);
    setStartDate(cls.startDate || '');
    setEndDate(cls.endDate || '');
    setIsAdding(true);
    setViewingDetailsId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName || selectedDays.length === 0 || saving) {
      alert('Preencha o nome e selecione ao menos um dia.');
      return;
    }

    setSaving(true);
    try {
      const classId = editingId || crypto.randomUUID();
      const existingClass = classes.find(c => c.id === editingId);

      const classData: Class = {
        id: classId,
        courseName,
        days: selectedDays,
        time,
        frequency,
        studentIds: selectedStudentIds,
        year,
        semester,
        startDate,
        endDate,
        position: existingClass?.position !== undefined ? existingClass.position : classes.length
      };

      const savedClass = await db.classes.save(classData);

      // 1. Identificar alunos para ADICIONAR a turma
      const studentsToAdd = students.filter(s =>
        selectedStudentIds.includes(s.id) &&
        !(s.enrolledClassIds || []).includes(classId)
      );

      // 2. Identificar alunos para REMOVER a turma (apenas se estivermos editando)
      const studentsToRemove = students.filter(s =>
        !selectedStudentIds.includes(s.id) &&
        (s.enrolledClassIds || []).includes(classId)
      );

      const newStudentsState = [...students];

      // Processar adições
      for (const s of studentsToAdd) {
        const updated = {
          ...s,
          status: 'cursando' as StudentStatus,
          enrolledClassIds: [...(s.enrolledClassIds || []), classId]
        };
        await db.students.save(updated);
        const idx = newStudentsState.findIndex(st => st.id === s.id);
        if (idx !== -1) newStudentsState[idx] = updated;
      }

      // Processar remoções
      for (const s of studentsToRemove) {
        const updated = {
          ...s,
          enrolledClassIds: (s.enrolledClassIds || []).filter(id => id !== classId)
        };
        await db.students.save(updated);
        const idx = newStudentsState.findIndex(st => st.id === s.id);
        if (idx !== -1) newStudentsState[idx] = updated;
      }

      setStudents(newStudentsState);

      if (editingId) {
        setClasses(classes.map(c => c.id === editingId ? savedClass : c));
      } else {
        setClasses([...classes, savedClass]);
      }

      resetForm();
    } catch (error: any) {
      console.error('Erro ao salvar turma:', error);
      alert(`Erro ao salvar a turma: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  const removeClass = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Deseja remover esta turma?')) {
      try {
        await db.classes.delete(id);
        setClasses(classes.filter(c => c.id !== id));
      } catch (error) {
        console.error('Erro ao remover turma:', error);
        alert('Erro ao remover a turma do banco de dados.');
      }
    }
  };

  const handleStatusChange = async (student: Student, nextStatus: StudentStatus) => {
    if (saving || student.status === nextStatus) return;
    setSaving(true);
    try {
      const updatedStudent: Student = { ...student, status: nextStatus };
      const savedStudent = await db.students.save(updatedStudent);
      setStudents(students.map(s => s.id === student.id ? savedStudent : s));
    } catch (error) {
      console.error('Erro ao trocar status:', error);
      alert('Erro ao atualizar o status do aluno.');
    } finally {
      setSaving(false);
    }
  };

  const handleCloneSemester = async () => {
    if (saving) return;

    const activeClasses = classes.filter(c => !c.archived);
    if (activeClasses.length === 0) {
      alert('Não há turmas ativas para clonar.');
      return;
    }

    if (!window.confirm(`Isso irá arquivar as ${activeClasses.length} turmas atuais e criar novas turmas para o ${cloneSemester} de ${cloneYear}. Os alunos deverão ser matriculados novamente nas novas turmas. Deseja continuar?`)) {
      return;
    }

    setSaving(true);
    try {
      // 1. Arquivar as atuais
      const archivedClasses = activeClasses.map(c => ({ ...c, archived: true }));

      // 2. Criar as novas (clones estruturais)
      const newClonedClasses: Class[] = activeClasses.map(c => ({
        id: crypto.randomUUID(),
        courseName: c.courseName,
        days: c.days,
        time: c.time,
        frequency: c.frequency,
        studentIds: [], // Novos clones começam sem alunos
        position: c.position || 0,
        year: cloneYear,
        semester: cloneSemester,
        archived: false
      }));

      // 3. Salvar tudo no banco
      await db.classes.saveAll([...archivedClasses, ...newClonedClasses]);

      // 4. Atualizar o estado global
      const otherClasses = classes.filter(c => c.archived);
      setClasses([...otherClasses, ...archivedClasses, ...newClonedClasses]);

      setIsCloningModalOpen(false);
      alert('Próximo semestre configurado com sucesso! As turmas anteriores foram arquivadas.');
    } catch (error: any) {
      console.error('Erro na clonagem:', error);
      alert('Erro ao clonar semestre: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;

    const newClasses = [...classes];
    const [draggedItem] = newClasses.splice(draggedIndex, 1);
    newClasses.splice(index, 0, draggedItem);

    // Atualizar posições
    const updatedClasses = newClasses.map((c, i) => ({
      ...c,
      position: i
    }));

    setClasses(updatedClasses);
    setDraggedIndex(null);

    try {
      await db.classes.saveAll(updatedClasses);
    } catch (error) {
      console.error('Erro ao salvar nova ordem:', error);
    }
  };

  const handleTransfer = async (toClassId: string) => {
    if (!transferringStudent || !viewingDetailsId) return;

    setSaving(true);
    try {
      const fromClass = classes.find(c => c.id === viewingDetailsId);
      const toClass = classes.find(c => c.id === toClassId);
      const student = students.find(s => s.id === transferringStudent.id);

      if (!fromClass || !toClass || !student) return;

      // 1. Remover do antigo
      const updatedFromClass = {
        ...fromClass,
        studentIds: fromClass.studentIds.filter(id => id !== student.id)
      };

      // 2. Adicionar no novo
      if (toClass.studentIds.includes(student.id)) {
        alert('O aluno já está matriculado nesta turma.');
        setTransferringStudent(null);
        return;
      }

      const updatedToClass = {
        ...toClass,
        studentIds: [...toClass.studentIds, student.id]
      };

      // 3. Atualizar histórico do aluno se necessário
      const updatedStudent = {
        ...student,
        enrolledClassIds: Array.from(new Set([
          ...(student.enrolledClassIds || []).filter(id => id !== fromClass.id),
          toClassId
        ]))
      };

      // Salvar tudo
      await Promise.all([
        db.classes.save(updatedFromClass),
        db.classes.save(updatedToClass),
        db.students.save(updatedStudent)
      ]);

      // Atualizar estado global
      setClasses(classes.map(c => {
        if (c.id === fromClass.id) return updatedFromClass;
        if (c.id === toClass.id) return updatedToClass;
        return c;
      }));

      setStudents(students.map(s => s.id === student.id ? updatedStudent : s));
      setTransferringStudent(null);

      alert(`Aluno transferido com sucesso para ${toClass.courseName}`);
    } catch (error: any) {
      console.error('Erro ao transferir aluno:', error);
      alert('Erro ao processar a transferência: ' + (error.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleAddStudentToDetails = async (studentId: string) => {
    if (!viewingDetailsId || saving) return;

    const currentClass = classes.find(c => c.id === viewingDetailsId);
    if (!currentClass) return;

    setSaving(true);
    try {
      // 1. Atualizar a turma
      const currentStudentIds = currentClass.studentIds || [];
      const updatedClass = {
        ...currentClass,
        studentIds: [...currentStudentIds, studentId]
      };

      // 2. Atualizar o aluno (histórico de turmas)
      const student = students.find(s => s.id === studentId);
      if (!student) throw new Error('Aluno não encontrado');

      const updatedStudent = {
        ...student,
        status: 'cursando' as StudentStatus,
        enrolledClassIds: Array.from(new Set([...(student.enrolledClassIds || []), viewingDetailsId]))
      };

      await Promise.all([
        db.classes.save(updatedClass),
        db.students.save(updatedStudent)
      ]);

      // 3. Atualizar estado global
      setClasses(classes.map(c => c.id === viewingDetailsId ? updatedClass : c));
      setStudents(students.map(s => s.id === studentId ? updatedStudent : s));

      setIsAddingStudentModalOpen(false);
      setStudentSearchTerm('');
    } catch (error: any) {
      console.error('Erro ao adicionar aluno à turma:', error);
      alert('Erro ao matricular aluno: ' + (error.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const StudentRow: React.FC<{ student: Student }> = ({ student }) => (
    <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
          ${student.status === 'cursando' ? 'bg-green-100 text-green-700' :
            student.status === 'concluiu' ? 'bg-blue-100 text-blue-700' :
              'bg-red-100 text-red-700'}`}>
          {student.name.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-gray-800">{student.name}</p>
          <p className="text-[10px] text-gray-500">{student.phone || 'Sem telefone'}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTransferringStudent({ id: student.id, name: student.name })}
          title="Transferir de Turma"
          className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all opacity-0 group-hover:opacity-100"
        >
          <i className="fas fa-exchange-alt text-xs"></i>
        </button>
        <select
          value={student.status}
          onChange={(e) => handleStatusChange(student, e.target.value as StudentStatus)}
          className={`px-3 py-1.5 rounded-full text-[10px] font-black border outline-none cursor-pointer transition-all uppercase tracking-wider
            ${student.status === 'cursando' ? 'text-green-700 bg-green-50 border-green-200' :
              student.status === 'desistiu' ? 'text-red-700 bg-red-50 border-red-200' :
                'text-blue-700 bg-blue-50 border-blue-200'}`}
        >
          <option value="cursando">CURSANDO</option>
          <option value="desistiu">DESISTIU</option>
          <option value="concluiu">CONCLUIU</option>
        </select>
        <button
          onClick={async () => {
            if (window.confirm(`Tem certeza que deseja remover ${student.name} desta turma?`)) {
              setSaving(true);
              try {
                const currentClass = classes.find(c => c.id === viewingDetailsId);
                if (!currentClass) return;

                const updatedClass = {
                  ...currentClass,
                  studentIds: currentClass.studentIds.filter(id => id !== student.id)
                };

                const updatedStudent = {
                  ...student,
                  enrolledClassIds: (student.enrolledClassIds || []).filter(id => id !== viewingDetailsId)
                };

                await Promise.all([
                  db.classes.save(updatedClass),
                  db.students.save(updatedStudent)
                ]);

                setClasses(classes.map(c => c.id === viewingDetailsId ? updatedClass : c));
                setStudents(students.map(s => s.id === student.id ? updatedStudent : s));

                alert('Aluno removido da turma com sucesso.');
              } catch (error: any) {
                console.error('Erro ao remover aluno da turma:', error);
                alert('Erro ao remover aluno: ' + (error.message || ''));
              } finally {
                setSaving(false);
              }
            }
          }}
          title="Remover da Turma"
          className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
        >
          <i className="fas fa-trash-alt text-xs"></i>
        </button>
      </div>
    </div>
  );

  const Section: React.FC<{ title: string, list: Student[], icon: string, colorClass: string }> = ({ title, list, icon, colorClass }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
      <div className={`px-6 py-4 border-b border-gray-50 flex items-center justify-between ${colorClass}`}>
        <div className="flex items-center gap-2">
          <i className={`fas ${icon}`}></i>
          <h3 className="font-extrabold text-sm uppercase tracking-widest">{title}</h3>
        </div>
        <span className="bg-white bg-opacity-30 px-2 py-0.5 rounded-full text-xs font-bold">{list.length}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {list.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm italic">
            Nenhum aluno nesta categoria
          </div>
        ) : (
          list.map(s => <StudentRow key={s.id} student={s} />)
        )}
      </div>
    </div>
  );

  const getRenderDetails = () => {
    const cls = classes.find(c => c.id === viewingDetailsId);
    if (!cls) return null;

    // Lógica robusta: busca alunos pelo studentIds da turma OU pelo enrolledClassIds do próprio aluno
    const classStudents = students.filter(s =>
      (cls.studentIds || []).includes(s.id) ||
      (s.enrolledClassIds || []).includes(cls.id)
    );

    const cursando = classStudents.filter(s => s.status === 'cursando');
    const concluiu = classStudents.filter(s => s.status === 'concluiu');
    const desistiu = classStudents.filter(s => s.status === 'desistiu');

    const filteredAvailable = students.filter(s =>
      !(cls.studentIds || []).includes(s.id) &&
      !(s.enrolledClassIds || []).includes(cls.id) &&
      s.name.toLowerCase().includes(studentSearchTerm.toLowerCase())
    );

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
        {/* Modal de Transferência */}
        {transferringStudent && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] p-8 shadow-2xl max-w-md w-full animate-in zoom-in-95">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                  <i className="fas fa-exchange-alt text-xl"></i>
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-800 leading-none">Transferir Aluno</h3>
                  <p className="text-sm text-gray-400 font-bold mt-1 uppercase tracking-wider">{transferringStudent.name}</p>
                </div>
              </div>

              <p className="text-gray-500 text-sm mb-6 font-medium">Selecione a nova turma para onde deseja mover este aluno:</p>

              <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto mb-8 custom-scrollbar">
                {classes.filter(c => c.id !== cls.id).map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleTransfer(c.id)}
                    className="flex items-center justify-between p-4 bg-gray-50 hover:bg-indigo-50 rounded-2xl transition-all group text-left border-2 border-transparent hover:border-indigo-100"
                  >
                    <div>
                      <p className="font-black text-gray-700 uppercase tracking-tight">{c.courseName}</p>
                      <p className="text-[10px] font-bold text-gray-400">{c.days.join(', ')} • {c.time}</p>
                    </div>
                    <i className="fas fa-chevron-right text-gray-300 group-hover:text-indigo-400 transition-colors"></i>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setTransferringStudent(null)}
                className="w-full py-4 text-gray-400 font-black uppercase text-xs tracking-widest hover:text-gray-600 transition-colors"
              >
                Cancelar Operação
              </button>
            </div>
          </div>
        )}

        {/* Modal de Adicionar Novo Aluno */}
        {isAddingStudentModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] p-8 shadow-2xl max-w-md w-full animate-in zoom-in-95">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
                  <i className="fas fa-user-plus text-xl"></i>
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-800 leading-none">Matricular Aluno</h3>
                  <p className="text-sm text-gray-400 font-bold mt-1 uppercase tracking-wider">Na Turma: {cls.courseName}</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="relative">
                  <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"></i>
                  <input
                    type="text"
                    placeholder="Buscar aluno por nome..."
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-green-500 font-bold text-gray-700 border-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto mb-8 custom-scrollbar">
                {filteredAvailable.length === 0 ? (
                  <div className="py-10 text-center text-gray-400">
                    <i className="fas fa-users-slash text-2xl mb-2 opacity-20"></i>
                    <p className="text-xs font-bold italic">Nenhum aluno disponível</p>
                  </div>
                ) : (
                  filteredAvailable.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleAddStudentToDetails(s.id)}
                      className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-green-50 rounded-2xl transition-all group text-left border-2 border-transparent hover:border-green-100"
                    >
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-black text-green-600 shadow-sm">
                        {s.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-black text-gray-700 uppercase tracking-tight">{s.name}</p>
                        <p className="text-[10px] font-bold text-gray-400">{s.phone || 'Sem telefone'}</p>
                      </div>
                      <i className="fas fa-plus-circle ml-auto text-green-300 group-hover:text-green-500 transition-colors"></i>
                    </button>
                  ))
                )}
              </div>

              <button
                onClick={() => {
                  setIsAddingStudentModalOpen(false);
                  setStudentSearchTerm('');
                }}
                className="w-full py-4 text-gray-400 font-black uppercase text-xs tracking-widest hover:text-gray-600 transition-colors"
              >
                Fechar Lista
              </button>
            </div>
          </div>
        )}

        <header className="flex flex-col md:flex-row md:items-end gap-6 mb-10">
          <button
            onClick={() => setViewingDetailsId(null)}
            className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-all text-indigo-600 self-start"
          >
            <i className="fas fa-chevron-left"></i>
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest mb-2">
              <i className="fas fa-graduation-cap"></i>
              Gestão de Matrículas
            </div>
            <h1 className="text-4xl font-black text-gray-900 leading-tight uppercase tracking-tight">
              {cls.courseName}
              <span className="block text-sm font-bold text-gray-400 normal-case tracking-normal mt-1 flex flex-wrap items-center gap-2">
                <i className="fas fa-calendar-alt text-indigo-300"></i>
                {cls.days.join(', ')} • {cls.time || '--:--'}
                <span className="hidden md:inline mx-1 opacity-20">•</span>
                <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md text-[10px] uppercase font-black tracking-widest border border-indigo-100/50">
                  {cls.year} • {cls.semester}
                </span>
              </span>
            </h1>
          </div>
          <button
            onClick={() => setIsAddingStudentModalOpen(true)}
            className="bg-green-600 text-white px-8 py-4 rounded-2xl hover:bg-green-700 flex items-center gap-3 transition-all shadow-lg shadow-green-100 font-black uppercase tracking-widest text-xs self-start md:self-end active:scale-95"
          >
            <i className="fas fa-user-plus"></i>
            Matricular Aluno
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Section title="Atuais" list={cursando} icon="fa-user-check" colorClass="bg-green-600 text-white" />
          <Section title="Concluídos" list={concluiu} icon="fa-user-graduate" colorClass="bg-blue-600 text-white" />
          <Section title="Desistências" list={desistiu} icon="fa-user-times" colorClass="bg-red-500 text-white" />
        </div>
      </div>
    );
  };

  const availableStudents = students;

  // Filtragem inteligente: Se o usuário estiver filtrando, mostramos as turmas daquele período (mesmo arquivadas)
  const activeViewClasses = classes.filter(c =>
    c.year === filterYear &&
    c.semester === filterSemester
  );

  if (viewingDetailsId) {
    return getRenderDetails();
  }

  return (
    <div className="pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">Turmas</h1>
          <p className="text-gray-500 font-medium">Arraste os cards para reordenar a exibição.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsCloningModalOpen(true)}
            className="bg-white text-indigo-600 border-2 border-indigo-100 px-6 py-3 rounded-2xl hover:bg-indigo-50 flex items-center gap-3 transition-all font-bold active:scale-95 shadow-sm"
          >
            <i className="fas fa-copy"></i>
            Clonar Próximo Semestre
          </button>
          <button
            onClick={() => isAdding ? resetForm() : setIsAdding(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl hover:bg-indigo-700 flex items-center gap-3 transition-all shadow-lg shadow-indigo-200 font-bold active:scale-95"
          >
            <i className={`fas ${isAdding ? 'fa-times' : 'fa-plus'}`}></i>
            {isAdding ? 'Cancelar' : 'Nova Turma'}
          </button>
        </div>
      </div>

      {/* Barra de Filtros de Período */}
      {!isAdding && !viewingDetailsId && (
        <div className="flex flex-col md:flex-row items-center gap-6 mb-12 bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4 text-indigo-600">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <i className="fas fa-filter text-sm"></i>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">Filtrar Período:</span>
          </div>

          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            <div className="relative group">
              <label className="absolute -top-2 left-4 px-2 bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest z-10 group-focus-within:text-indigo-500 transition-colors">Ano</label>
              <input
                type="number"
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl px-5 py-3 font-black text-gray-700 outline-none transition-all"
              />
            </div>

            <div className="relative group">
              <label className="absolute -top-2 left-4 px-2 bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest z-10 group-focus-within:text-indigo-500 transition-colors">Semestre</label>
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value)}
                className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl px-5 py-3 font-black text-gray-700 outline-none transition-all cursor-pointer appearance-none"
              >
                <option value="1º Semestre">1º Semestre</option>
                <option value="2º Semestre">2º Semestre</option>
              </select>
            </div>

            <div className="hidden md:flex items-center gap-2 px-4 py-3 bg-indigo-50 rounded-2xl border border-indigo-100/50">
              <i className="fas fa-info-circle text-indigo-400"></i>
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-tight">
                Exibindo {activeViewClasses.length} turmas
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Clonagem de Semestre */}
      {isCloningModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] p-10 shadow-2xl max-w-xl w-full animate-in zoom-in-95 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50"></div>

            <div className="relative z-10">
              <div className="flex items-center gap-5 mb-8">
                <div className="w-16 h-16 bg-indigo-100 rounded-[24px] flex items-center justify-center text-indigo-600">
                  <i className="fas fa-copy text-2xl"></i>
                </div>
                <div>
                  <h3 className="text-3xl font-black text-gray-900 tracking-tighter uppercase leading-none">Clonar Semestre</h3>
                  <p className="text-sm font-bold text-gray-400 mt-2 uppercase tracking-widest">Preparar novo período letivo</p>
                </div>
              </div>

              <div className="bg-amber-50 border-l-4 border-amber-400 p-6 rounded-2xl mb-8">
                <div className="flex gap-3">
                  <i className="fas fa-exclamation-triangle text-amber-500 mt-1"></i>
                  <p className="text-sm text-amber-800 font-bold leading-relaxed">
                    Atenção: Ao clonar, as turmas atuais ({classes.filter(c => !c.archived).length}) serão arquivadas e as novas começarão com a lista de alunos <span className="underline italic">vazia</span> para novas matrículas.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-10">
                <div>
                  <label className="block text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-3">Ano de Destino</label>
                  <input
                    type="number"
                    value={cloneYear}
                    onChange={e => setCloneYear(Number(e.target.value))}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-[22px] focus:border-indigo-500 focus:bg-white outline-none font-black text-gray-700 text-lg transition-all shadow-inner"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-3">Próximo Semestre</label>
                  <select
                    value={cloneSemester}
                    onChange={e => setCloneSemester(e.target.value)}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-[22px] focus:border-indigo-500 focus:bg-white outline-none font-black text-gray-700 text-lg cursor-pointer transition-all shadow-inner appearance-none"
                  >
                    <option value="1º Semestre">1º Semestre (Jan-Jun)</option>
                    <option value="2º Semestre">2º Semestre (Jul-Dez)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleCloneSemester}
                  disabled={saving}
                  className="flex-1 bg-indigo-600 text-white py-5 rounded-[24px] font-black uppercase tracking-tighter text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98]"
                >
                  {saving ? 'PROCESSANDO...' : 'CONFIRMAR CLONAGEM'}
                </button>
                <button
                  onClick={() => setIsCloningModalOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-400 py-5 rounded-[24px] font-black uppercase tracking-widest text-xs hover:bg-gray-200 hover:text-gray-600 transition-all"
                >
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-white p-10 rounded-[44px] shadow-2xl shadow-indigo-100/50 border border-gray-100 mb-16 animate-in zoom-in-95 duration-500 relative overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-32 -mt-32 opacity-50 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-50 rounded-full -ml-24 -mb-24 opacity-50 pointer-events-none"></div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-indigo-600 rounded-[24px] flex items-center justify-center text-white shadow-xl shadow-indigo-200">
                  <i className={`fas ${editingId ? 'fa-edit' : 'fa-layer-group'} text-2xl`}></i>
                </div>
                <div>
                  <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">{editingId ? 'Editar Turma' : 'Criar Nova Turma'}</h2>
                  <p className="text-sm font-bold text-gray-400 mt-1">Configure os detalhes e matricule os alunos iniciais.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-2xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all font-bold active:scale-95"
                title="Descartar alteração"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
              {/* Coluna da Esquerda: Configurações */}
              <div className="xl:col-span-7 space-y-10">
                <section>
                  <label className="flex items-center gap-2 text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-4">
                    <i className="fas fa-signature text-sm"></i>
                    Identificação da Turma
                  </label>
                  <input
                    type="text"
                    value={courseName}
                    onChange={e => setCourseName(e.target.value)}
                    className="w-full p-6 bg-gray-50 border-2 border-transparent rounded-[28px] focus:border-indigo-500 focus:bg-white outline-none font-black text-gray-800 text-2xl transition-all placeholder-gray-300 shadow-inner"
                    placeholder="Ex: INFORMÁTICA AVANÇADA"
                    required
                  />
                </section>

                <div className="grid grid-cols-2 gap-4">
                  <section>
                    <label className="flex items-center gap-2 text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-4">
                      <i className="fas fa-calendar-check text-sm"></i>
                      Ano Letivo
                    </label>
                    <input
                      type="number"
                      value={year}
                      onChange={e => setYear(Number(e.target.value))}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-[24px] focus:border-indigo-500 focus:bg-white outline-none font-black text-gray-700 text-lg transition-all shadow-inner"
                      placeholder="Ex: 2024"
                    />
                  </section>
                  <section>
                    <label className="flex items-center gap-2 text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-4">
                      <i className="fas fa-layer-group text-sm"></i>
                      Semestre
                    </label>
                    <select
                      value={semester}
                      onChange={e => {
                        const val = e.target.value;
                        setSemester(val);
                        // Sugerir datas padrão se estiverem vazias
                        if (!startDate && !endDate) {
                          if (val === '1º Semestre') {
                            setStartDate(`${year}-02-01`);
                            setEndDate(`${year}-06-30`);
                          } else {
                            setStartDate(`${year}-08-01`);
                            setEndDate(`${year}-12-15`);
                          }
                        }
                      }}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-[24px] focus:border-indigo-500 focus:bg-white outline-none font-black text-gray-700 text-lg cursor-pointer transition-all shadow-inner appearance-none"
                    >
                      <option value="1º Semestre">1º Semestre (Jan-Jun)</option>
                      <option value="2º Semestre">2º Semestre (Jul-Dez)</option>
                    </select>
                  </section>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <section>
                    <label className="flex items-center gap-2 text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-4">
                      <i className="fas fa-calendar-plus text-sm"></i>
                      Início das Aulas
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-[24px] focus:border-indigo-500 focus:bg-white outline-none font-black text-gray-700 text-lg transition-all shadow-inner"
                    />
                  </section>
                  <section>
                    <label className="flex items-center gap-2 text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-4">
                      <i className="fas fa-calendar-minus text-sm"></i>
                      Final das Aulas
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-[24px] focus:border-indigo-500 focus:bg-white outline-none font-black text-gray-700 text-lg transition-all shadow-inner"
                    />
                  </section>
                </div>

                <section>
                  <label className="flex items-center gap-2 text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-4">
                    <i className="fas fa-calendar-alt text-sm"></i>
                    Dias de Aula
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {daysOfWeek.map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`flex items-center justify-center py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all active:scale-95 ${selectedDays.includes(day)
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200'
                          : 'bg-white text-gray-400 border-gray-100 hover:border-indigo-200 hover:text-indigo-400'
                          }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </section>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <section>
                    <label className="flex items-center gap-2 text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-4">
                      <i className="fas fa-clock text-sm"></i>
                      Horário
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        value={time}
                        onChange={e => setTime(e.target.value)}
                        className="w-full p-5 bg-gray-50 border-2 border-transparent rounded-[24px] focus:border-indigo-500 focus:bg-white outline-none font-black text-gray-700 text-xl transition-all shadow-inner"
                      />
                    </div>
                  </section>
                  <section>
                    <label className="flex items-center gap-2 text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-4">
                      <i className="fas fa-sync-alt text-sm"></i>
                      Frequência Semanal
                    </label>
                    <select
                      value={frequency}
                      onChange={e => setFrequency(Number(e.target.value) as 1 | 2)}
                      className="w-full p-5 bg-gray-50 border-2 border-transparent rounded-[24px] focus:border-indigo-500 focus:bg-white outline-none font-black text-gray-700 text-lg cursor-pointer transition-all shadow-inner appearance-none"
                    >
                      <option value={1}>1 VEZ POR SEMANA</option>
                      <option value={2}>2 VEZES POR SEMANA</option>
                    </select>
                  </section>
                </div>
              </div>

              {/* Coluna da Direita: Matrícula */}
              <div className="xl:col-span-5">
                <div className="bg-gray-50/50 rounded-[40px] p-8 border border-gray-100 h-full flex flex-col shadow-inner">
                  <header className="flex items-center justify-between mb-6">
                    <div>
                      <label className="flex items-center gap-2 text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-1">
                        <i className="fas fa-users-medical text-sm"></i>
                        Vincular Alunos
                      </label>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{selectedStudentIds.length} selecionados</span>
                    </div>
                  </header>

                  <div className="relative mb-4">
                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"></i>
                    <input
                      type="text"
                      placeholder="Buscar por nome..."
                      value={formStudentSearch}
                      onChange={e => setFormStudentSearch(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm text-gray-600 border border-gray-100 shadow-sm transition-all"
                    />
                  </div>

                  <div className="flex-1 min-h-[300px] xl:max-h-[400px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
                    {availableStudents
                      .filter(s => s.name.toLowerCase().includes(formStudentSearch.toLowerCase()))
                      .length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <i className="fas fa-user-slash text-3xl mb-3 opacity-20"></i>
                        <p className="text-xs font-black uppercase tracking-widest opacity-40">Nenhum aluno encontrado</p>
                      </div>
                    ) : (
                      availableStudents
                        .filter(s => s.name.toLowerCase().includes(formStudentSearch.toLowerCase()))
                        .map(s => (
                          <label
                            key={s.id}
                            className={`flex items-center justify-between p-4 rounded-3xl cursor-pointer transition-all border-2 group ${selectedStudentIds.includes(s.id)
                              ? 'bg-white border-indigo-500 shadow-lg shadow-indigo-100'
                              : 'bg-transparent border-transparent hover:bg-white hover:border-gray-200'
                              }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl transition-all shadow-sm ${selectedStudentIds.includes(s.id) ? 'bg-indigo-600 text-white' : 'bg-white text-gray-300'}`}>
                                {s.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-black text-gray-800 uppercase tracking-tight">{s.name}</p>
                                {s.status !== 'cursando' ? (
                                  <span className="text-[9px] text-red-500 font-black uppercase tracking-widest leading-none">{s.status}</span>
                                ) : (
                                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-none">{s.phone || 'Sem contato'}</span>
                                )}
                              </div>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedStudentIds.includes(s.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 bg-white'}`}>
                              {selectedStudentIds.includes(s.id) && <i className="fas fa-check text-[10px]"></i>}
                            </div>
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.includes(s.id)}
                              onChange={() => toggleStudent(s.id)}
                              className="hidden"
                            />
                          </label>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-16 flex flex-col sm:flex-row gap-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-[2] bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-10 py-6 rounded-[32px] hover:shadow-2xl hover:shadow-indigo-500/30 hover:-translate-y-1 transition-all font-black text-xl shadow-xl shadow-indigo-100 active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-tighter"
              >
                {saving ? (
                  <>
                    <i className="fas fa-circle-notch fa-spin"></i>
                    PROCESSANDO...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check-circle"></i>
                    {editingId ? 'Salvar Alterações na Turma' : 'Concluir e Criar Turma'}
                  </>
                )}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-10 py-6 rounded-[32px] bg-gray-50 text-gray-400 font-black uppercase tracking-widest text-xs hover:bg-gray-100 hover:text-gray-600 transition-all border-2 border-transparent hover:border-gray-200"
                >
                  Descartar
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      {!isAdding && (
        <div className="space-y-12">
          {activeViewClasses.length === 0 ? (
            <div className="py-32 text-center bg-white rounded-[40px] border-4 border-dashed border-gray-100">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-200">
                <i className="fas fa-folder-open text-3xl"></i>
              </div>
              <p className="text-gray-400 font-bold text-xl uppercase tracking-widest">Nenhuma turma ativa registrada</p>
            </div>
          ) : (
            daysOfWeek.map(day => {
              const classesOnDay = activeViewClasses
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
                    {classesOnDay.map((c, idx) => {
                      const colors = [
                        { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', accent: 'bg-blue-500', shadow: 'shadow-blue-500/20' },
                        { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', accent: 'bg-emerald-500', shadow: 'shadow-emerald-500/20' },
                        { bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600', accent: 'bg-amber-500', shadow: 'shadow-amber-500/20' },
                        { bg: 'bg-rose-50', icon: 'bg-rose-100 text-rose-600', accent: 'bg-rose-500', shadow: 'shadow-rose-500/20' },
                        { bg: 'bg-violet-50', icon: 'bg-violet-100 text-violet-600', accent: 'bg-violet-500', shadow: 'shadow-violet-500/20' },
                        { bg: 'bg-cyan-50', icon: 'bg-cyan-100 text-cyan-600', accent: 'bg-cyan-500', shadow: 'shadow-cyan-500/20' }
                      ];
                      const colorIndex = activeViewClasses.findIndex(cl => cl.id === c.id);
                      const color = colors[colorIndex % colors.length];
                      const classStudents = students.filter(s =>
                        (c.studentIds || []).includes(s.id) ||
                        (s.enrolledClassIds || []).includes(c.id)
                      );
                      const activeCount = classStudents.filter(s => s.status === 'cursando').length;
                      const completedCount = classStudents.filter(s => s.status === 'concluiu').length;

                      return (
                        <div
                          key={`${day}-${c.id}`}
                          onClick={() => setViewingDetailsId(c.id)}
                          className={`${color.bg} rounded-[24px] shadow-sm border border-gray-100 hover:shadow-xl ${color.shadow} hover:-translate-y-1 cursor-pointer transition-all duration-300 group relative overflow-hidden`}
                        >
                          <div className={`absolute -right-6 -top-6 w-32 h-32 ${color.accent} rounded-full opacity-5 group-hover:opacity-10 transition-all duration-500`}></div>

                          <div className="relative z-10 flex items-center justify-between p-4 gap-6">
                            {/* Left: Icon & Info */}
                            <div className="flex items-center gap-5 flex-1 min-w-0">
                              <div className={`w-14 h-14 ${color.icon} rounded-2xl flex items-center justify-center shadow-inner shrink-0`}>
                                <i className="fas fa-book-open text-xl"></i>
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

                            {/* Middle: Stats */}
                            <div className="hidden md:flex items-center gap-3">
                              <div className="bg-green-100 text-green-700 px-3 py-1.5 rounded-xl font-black text-[10px] shadow-sm uppercase tracking-wide flex items-center gap-2">
                                <i className="fas fa-user-check"></i>
                                <span>{activeCount} Ativos</span>
                              </div>
                              <div className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-xl font-black text-[10px] shadow-sm uppercase tracking-wide flex items-center gap-2">
                                <i className="fas fa-user-graduate"></i>
                                <span>{completedCount} Formados</span>
                              </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-1 pl-4 border-l border-black/5">
                              <button
                                onClick={(e) => handleEdit(e, c)}
                                className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all"
                                title="Editar"
                              >
                                <i className="fas fa-pen-nib text-sm"></i>
                              </button>
                              <button
                                onClick={(e) => removeClass(e, c.id)}
                                className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                title="Excluir"
                              >
                                <i className="fas fa-trash-alt text-sm"></i>
                              </button>

                              <div className="w-8 h-8 flex items-center justify-center text-gray-300 group-hover:text-indigo-400 transition-colors ml-2">
                                <i className="fas fa-chevron-right"></i>
                              </div>
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
      )}
    </div>
  );
};

export default ClassManager;

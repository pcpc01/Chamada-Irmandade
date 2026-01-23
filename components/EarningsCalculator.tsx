import React, { useState, useMemo, useEffect } from 'react';
import { Holiday, EarningsRecord } from '../types';
import { db } from '../supabase';

interface EarningsCalculatorProps {
    holidays: Holiday[];
    onClose: () => void;
}

const STORAGE_KEY = 'edupresenca_earnings_data';

const EarningsCalculator: React.FC<EarningsCalculatorProps> = ({ holidays, onClose }) => {
    const [valuePerClass, setValuePerClass] = useState<number>(0);
    const [classesPerDay, setClassesPerDay] = useState<number>(1);
    const [totalClasses, setTotalClasses] = useState<number>(0);
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [history, setHistory] = useState<EarningsRecord[]>([]);
    const [saving, setSaving] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(true);

    const currentMonthKey = useMemo(() => {
        return `${String(currentDate.getMonth() + 1).padStart(2, '0')}-${currentDate.getFullYear()}`;
    }, [currentDate]);

    // Cálculo do total anual baseado no ano selecionado no calendário
    const annualTotal = useMemo(() => {
        const currentYear = currentDate.getFullYear();
        return history
            .filter(record => record.month.endsWith(`-${currentYear}`))
            .reduce((sum, record) => sum + record.totalAmount, 0);
    }, [history, currentDate]);

    // 1. Carregar histórico inicial do Supabase
    useEffect(() => {
        const loadHistory = async () => {
            setLoadingHistory(true);
            try {
                const historyData = await db.earnings.getAll();
                setHistory(historyData);

                // Carregar esboço inicial do LocalStorage
                const savedData = localStorage.getItem(STORAGE_KEY);
                if (savedData) {
                    const parsed = JSON.parse(savedData);
                    setValuePerClass(parsed.valuePerClass || 0);
                    setClassesPerDay(parsed.classesPerDay || 1);
                } else if (historyData.length > 0) {
                    // Se não tem nada no localStorage, pega o último valor do histórico para os campos fixos
                    setValuePerClass(historyData[0].valuePerClass || 0);
                    setClassesPerDay(historyData[0].classesPerDay || 1);
                }
            } catch (e) {
                console.error('Erro ao carregar histórico:', e);
            } finally {
                setLoadingHistory(false);
            }
        };
        loadHistory();
    }, []);

    // 2. Lógica de troca de mês: Sincronizar com histórico ou limpar dados variáveis
    useEffect(() => {
        if (loadingHistory) return;

        const recordOfThisMonth = history.find(r => r.month === currentMonthKey);

        if (recordOfThisMonth) {
            // Se já salvamos este mês, puxamos TUDO dele
            setValuePerClass(recordOfThisMonth.valuePerClass);
            setClassesPerDay(recordOfThisMonth.classesPerDay);
            setTotalClasses(recordOfThisMonth.totalClasses);
            setSelectedDays(recordOfThisMonth.selectedDays || []);
        } else {
            // Se é um mês novo/não salvo, limpamos o total e os dias, mas MANTEMOS valor/aula e aulas/dia
            setTotalClasses(0);
            setSelectedDays([]);
        }
    }, [currentMonthKey, history, loadingHistory]);

    // 3. Salvar configurações fixas no LocalStorage
    useEffect(() => {
        const dataToSave = { valuePerClass, classesPerDay }; // Apenas o que deve persistir entre meses novos
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    }, [valuePerClass, classesPerDay]);

    const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const daysInMonth = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysCount = new Date(year, month + 1, 0).getDate();
        const daysArray = [];
        for (let i = 0; i < firstDay; i++) daysArray.push(null);
        for (let i = 1; i <= daysCount; i++) daysArray.push(new Date(year, month, i));
        return daysArray;
    }, [currentDate]);

    const monthName = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    const toggleDay = (date: Date) => {
        const dateStr = formatDate(date);
        let updatedDays = selectedDays.includes(dateStr)
            ? selectedDays.filter(d => d !== dateStr)
            : [...selectedDays, dateStr];
        setSelectedDays(updatedDays);
        setTotalClasses(updatedDays.length * classesPerDay);
    };

    const isHoliday = (date: Date) => date && holidays.find(h => h.date === formatDate(date));
    const totalEarnings = totalClasses * valuePerClass;

    const changeMonth = (offset: number) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    };

    const handleClassesPerDayChange = (val: number) => {
        setClassesPerDay(val);
        setTotalClasses(selectedDays.length * val);
    };

    const handleSaveToSupabase = async () => {
        setSaving(true);
        try {
            const existingRecord = history.find(r => r.month === currentMonthKey);
            const generateUUID = () => {
                if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                    const r = Math.random() * 16 | 0;
                    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
                });
            };
            const record = {
                id: existingRecord ? existingRecord.id : generateUUID(),
                month: currentMonthKey,
                valuePerClass,
                classesPerDay,
                totalClasses,
                totalAmount: totalEarnings,
                selectedDays,
            };
            const saved = await db.earnings.save(record);
            setHistory(prev => [saved, ...prev.filter(r => r.month !== currentMonthKey)].sort((a, b) => b.month.localeCompare(a.month)));
        } catch (e: any) {
            alert(`Erro ao salvar: ${e.message || 'Verifique sua conexão'}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRecord = async (id: string, month: string) => {
        if (!window.confirm(`Tem certeza que deseja apagar o registro de ${month}?`)) return;

        try {
            await db.earnings.delete(id);
            setHistory(prev => prev.filter(r => r.id !== id));

            if (month === currentMonthKey) {
                setTotalClasses(0);
                setSelectedDays([]);
            }
        } catch (e: any) {
            alert(`Erro ao apagar: ${e.message}`);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-7xl rounded-[32px] md:rounded-[48px] shadow-2xl flex flex-col lg:grid lg:grid-cols-12 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[95vh]">

                {/* Lado Esquerdo: Calendário */}
                <div className="lg:col-span-5 p-6 md:p-8 bg-gray-50/50 overflow-y-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl md:text-2xl font-black text-gray-800 capitalize leading-tight">{monthName}</h3>
                            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Marque os dias de aula</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => changeMonth(-1)} className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-indigo-600 transition-all shadow-sm">
                                <i className="fas fa-chevron-left"></i>
                            </button>
                            <button onClick={() => changeMonth(1)} className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-indigo-600 transition-all shadow-sm">
                                <i className="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 md:gap-2">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(day => (
                            <div key={day} className="text-center text-[10px] font-black text-gray-300 uppercase py-2">{day}</div>
                        ))}
                        {daysInMonth.map((date, idx) => {
                            if (!date) return <div key={`empty-${idx}`} className="aspect-square"></div>;
                            const isSelected = selectedDays.includes(formatDate(date));
                            const holiday = isHoliday(date);
                            const isToday = formatDate(new Date()) === formatDate(date);
                            return (
                                <button
                                    key={idx}
                                    onClick={() => toggleDay(date)}
                                    className={`relative aspect-square rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-lg scale-105 z-10' : 'hover:bg-white text-gray-600'} ${holiday ? 'ring-2 ring-red-100 shadow-sm' : ''}`}
                                >
                                    <span className="text-xs md:text-sm font-black">{date.getDate()}</span>
                                    {isToday && !isSelected && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>}
                                    {holiday && <div className={`absolute bottom-1.5 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/50' : 'bg-red-400'}`}></div>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Meio: Cálculo */}
                <div className="lg:col-span-4 bg-white border-x border-gray-100 p-6 md:p-8 flex flex-col overflow-y-auto">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                            <i className="fas fa-calculator text-lg"></i>
                        </div>
                        <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Cálculo</h2>
                    </div>

                    <div className="space-y-6 flex-1 pr-2 custom-scrollbar">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Valor por Aula (R$)</label>
                            <input
                                type="number"
                                value={valuePerClass || ''}
                                onChange={(e) => setValuePerClass(Number(e.target.value))}
                                className="w-full bg-gray-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl px-5 py-3 font-black text-gray-700 outline-none transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Aulas / Dia</label>
                                <input
                                    type="number"
                                    value={classesPerDay || ''}
                                    onChange={(e) => handleClassesPerDayChange(Number(e.target.value))}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl px-5 py-3 font-black text-gray-700 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Total Aulas</label>
                                <input
                                    type="number"
                                    value={totalClasses || ''}
                                    onChange={(e) => setTotalClasses(Number(e.target.value))}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl px-5 py-3 font-black text-gray-700 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="bg-gray-900 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-12 -mt-12"></div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 text-center">Total Estimado</p>
                            <div className="text-3xl font-black text-white text-center flex items-center justify-center gap-2">
                                <span className="text-lg text-emerald-400">R$</span>
                                {totalEarnings.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 pt-2">
                            <button
                                onClick={handleSaveToSupabase}
                                disabled={saving}
                                className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 border-2 border-emerald-400/30"
                            >
                                <i className={saving ? "fas fa-spinner animate-spin" : "fas fa-save"}></i>
                                {saving ? 'SALVANDO...' : 'SALVAR NO HISTÓRICO'}
                            </button>

                            <a
                                href="https://www.nfse.gov.br/EmissorNacional/Login"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full bg-blue-50 text-blue-600 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-100 transition-all flex items-center justify-center gap-2 border-2 border-blue-200/50"
                            >
                                <i className="fas fa-external-link-alt"></i> EMITIR NOTA FISCAL
                            </a>
                        </div>
                    </div>
                </div>

                {/* Direita: Histórico e Acumulado Anual */}
                <div className="lg:col-span-3 bg-gray-50 p-6 md:p-8 flex flex-col overflow-y-auto relative">
                    <button onClick={onClose} className="absolute top-6 right-6 w-8 h-8 rounded-full hover:bg-white flex items-center justify-center text-gray-300 hover:text-gray-500 transition-all">
                        <i className="fas fa-times"></i>
                    </button>

                    <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-8">
                        <i className="fas fa-history text-indigo-400"></i> Histórico
                    </h2>

                    {/* Novo: Soma Anual - Estilo Azul Profissional */}
                    <div className="bg-blue-50 p-6 rounded-3xl shadow-sm mb-6 relative overflow-hidden group border-2 border-blue-200/50">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-blue-200/20 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-125"></div>
                        <div className="absolute bottom-0 left-0 w-12 h-12 bg-blue-200/10 rounded-full -ml-6 -mb-6"></div>

                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-2 relative flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                            Acumulado {currentDate.getFullYear()}
                        </p>
                        <div className="text-2xl font-black text-blue-900 relative flex items-baseline gap-1.5">
                            <span className="text-sm text-blue-300 font-medium">R$</span>
                            {annualTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>

                    <div className="space-y-3 pr-2 custom-scrollbar overflow-y-auto flex-1">
                        {loadingHistory ? (
                            <div className="text-center py-10"><i className="fas fa-spinner animate-spin text-indigo-300 text-2xl"></i></div>
                        ) : history.length === 0 ? (
                            <p className="text-center py-10 text-[10px] font-black text-gray-300 uppercase">Vazio</p>
                        ) : (
                            history.map(item => (
                                <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-200/50 shadow-sm group hover:border-red-100 transition-all relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[10px] font-black text-indigo-500 uppercase">{item.month}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-gray-800">R$ {item.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            <button
                                                onClick={() => handleDeleteRecord(item.id, item.month)}
                                                className="w-6 h-6 rounded-lg bg-red-50 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                                            >
                                                <i className="fas fa-trash-alt text-[10px]"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-[8px] font-bold text-gray-400 uppercase">
                                        <span>{item.totalClasses} aulas</span>
                                        <span>{item.selectedDays?.length || 0} dias</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default EarningsCalculator;

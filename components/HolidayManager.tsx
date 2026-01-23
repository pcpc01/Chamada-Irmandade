
import React, { useState } from 'react';
import { Holiday } from '../types';
import { db } from '../supabase';

interface HolidayManagerProps {
    holidays: Holiday[];
    setHolidays: React.Dispatch<React.SetStateAction<Holiday[]>>;
}

const HolidayManager: React.FC<HolidayManagerProps> = ({ holidays, setHolidays }) => {
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [saving, setSaving] = useState(false);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !date || saving) return;

        setSaving(true);
        try {
            const newHoliday: Holiday = {
                id: crypto.randomUUID(),
                name,
                date,
            };

            const savedHoliday = await db.holidays.save(newHoliday);
            setHolidays(prev => [...prev, savedHoliday].sort((a, b) => a.date.localeCompare(b.date)));
            setName('');
            setDate('');
        } catch (error: any) {
            console.error('Erro ao salvar feriado:', error);
            alert('Erro ao salvar feriado: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setSaving(false);
        }
    };

    const removeHoliday = async (id: string) => {
        if (!window.confirm('Deseja remover este feriado?')) return;

        try {
            await db.holidays.delete(id);
            setHolidays(prev => prev.filter(h => h.id !== id));
        } catch (error) {
            console.error('Erro ao remover feriado:', error);
            alert('Erro ao remover feriado.');
        }
    };

    return (
        <div className="animate-in fade-in duration-500">

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Formulário */}
                <div className="lg:col-span-1">
                    <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm sticky top-8">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                                <i className="fas fa-calendar-plus text-xl"></i>
                            </div>
                            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Novo Feriado</h2>
                        </div>

                        <form onSubmit={handleAdd} className="space-y-6">
                            <div className="relative group">
                                <label className="absolute -top-2 left-4 px-2 bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest z-10 group-focus-within:text-indigo-500 transition-colors">Data do Feriado</label>
                                <input
                                    type="date"
                                    required
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl px-5 py-4 font-black text-gray-700 outline-none transition-all"
                                />
                            </div>

                            <div className="relative group">
                                <label className="absolute -top-2 left-4 px-2 bg-white text-[9px] font-black text-gray-400 uppercase tracking-widest z-10 group-focus-within:text-indigo-500 transition-colors">Nome do Feriado</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Natal, Páscoa..."
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl px-5 py-4 font-black text-gray-700 outline-none transition-all placeholder:text-gray-300"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {saving ? 'SALVANDO...' : 'CADASTRAR FERIADO'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Lista */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <i className="fas fa-list text-indigo-400"></i>
                                <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm">Cronograma de Feriados</h3>
                            </div>
                            <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                                {holidays.length} Total
                            </span>
                        </div>

                        <div className="divide-y divide-gray-50">
                            {holidays.length === 0 ? (
                                <div className="p-20 text-center">
                                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <i className="fas fa-calendar-alt text-gray-200 text-3xl"></i>
                                    </div>
                                    <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Nenhum feriado cadastrado</p>
                                </div>
                            ) : (
                                holidays.map(holiday => (
                                    <div key={holiday.id} className="p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors group">
                                        <div className="flex items-center gap-6">
                                            <div className="text-center min-w-[60px]">
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter leading-none mb-1">
                                                    {new Date(holiday.date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                                                </p>
                                                <p className="text-2xl font-black text-gray-800 leading-none">
                                                    {new Date(holiday.date + 'T00:00:00').getDate()}
                                                </p>
                                            </div>
                                            <div className="h-10 w-px bg-gray-100 mr-2"></div>
                                            <div>
                                                <h4 className="font-black text-gray-800 uppercase tracking-tight text-lg leading-tight">{holiday.name}</h4>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                                    {new Date(holiday.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeHoliday(holiday.id)}
                                            className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                            title="Excluir Feriado"
                                        >
                                            <i className="fas fa-trash-alt"></i>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HolidayManager;

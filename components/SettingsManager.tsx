
import React, { useState } from 'react';
import { Holiday } from '../types';
import HolidayManager from './HolidayManager';
import EarningsCalculator from './EarningsCalculator';

interface SettingsManagerProps {
    holidays: Holiday[];
    setHolidays: React.Dispatch<React.SetStateAction<Holiday[]>>;
}

const SettingsManager: React.FC<SettingsManagerProps> = ({ holidays, setHolidays }) => {
    const [activeTool, setActiveTool] = useState<'menu' | 'holidays' | 'calculator'>('menu');

    if (activeTool === 'holidays') {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setActiveTool('menu')}
                            className="w-10 h-10 bg-white border border-gray-100 rounded-xl flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm group"
                        >
                            <i className="fas fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
                        </button>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 mb-1 uppercase tracking-tight">Gestão de Feriados</h1>
                            <p className="text-gray-500 font-medium text-xs">Defina dias sem aula no calendário geral.</p>
                        </div>
                    </div>
                </div>
                <HolidayManager holidays={holidays} setHolidays={setHolidays} />
            </div>
        );
    }

    return (
        <div className="pb-20">
            <header className="mb-10 text-center md:text-left">
                <h1 className="text-4xl font-black text-gray-900 mb-2 uppercase tracking-tight">Configurações</h1>
                <p className="text-gray-500 font-medium">Ajuste os parâmetros gerais do sistema.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto md:mx-0">
                {/* Botão Feriados */}
                <button
                    onClick={() => setActiveTool('holidays')}
                    className="group bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-100 hover:-translate-y-2 transition-all text-left relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 mb-8 group-hover:scale-110 transition-transform">
                            <i className="fas fa-calendar-day text-2xl"></i>
                        </div>
                        <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight mb-2">Feriados</h2>
                        <p className="text-gray-400 text-sm font-medium leading-relaxed">Gerencie os dias de folga e suspensão de aulas no sistema.</p>
                        <div className="mt-8 flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em]">
                            Acessar Gestão <i className="fas fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                        </div>
                    </div>
                </button>

                {/* Botão Calculadora */}
                <button
                    onClick={() => setActiveTool('calculator')}
                    className="group bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-emerald-100 hover:-translate-y-2 transition-all text-left relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 mb-8 group-hover:scale-110 transition-transform">
                            <i className="fas fa-hand-holding-usd text-2xl"></i>
                        </div>
                        <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight mb-2">Calculadora</h2>
                        <p className="text-gray-400 text-sm font-medium leading-relaxed">Calcule seus recebimentos mensais baseados nas aulas dadas.</p>
                        <div className="mt-8 flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-[0.2em]">
                            Abrir Simulador <i className="fas fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                        </div>
                    </div>
                </button>
            </div>

            {activeTool === 'calculator' && (
                <EarningsCalculator
                    holidays={holidays}
                    onClose={() => setActiveTool('menu')}
                />
            )}
        </div>
    );
};

export default SettingsManager;

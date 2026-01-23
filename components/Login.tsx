import React, { useState } from 'react';
import { supabase } from '../supabase';

interface LoginPageProps {
    onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            onLogin();
        } catch (err: any) {
            setError(err.message || 'Erro ao realizar login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-sans selection:bg-indigo-100">
            {/* Elementos Decorativos de Fundo */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-[120px] opacity-60"></div>
                <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-emerald-50 rounded-full blur-[120px] opacity-60"></div>
            </div>

            <div className="w-full max-w-[440px] relative">
                {/* Logo e Título */}
                <div className="text-center mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-[28px] shadow-xl shadow-indigo-100/50 mb-6 group transition-all hover:scale-105">
                        <i className="fas fa-graduation-cap text-4xl text-indigo-600 transition-transform group-hover:rotate-12"></i>
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight uppercase mb-2">EduPresença</h1>
                    <p className="text-gray-400 font-bold text-xs uppercase tracking-[0.2em]">Gestão Escolar Inteligente</p>
                </div>

                {/* Card de Login */}
                <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[40px] border border-white shadow-2xl shadow-indigo-100/20 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
                    <div className="mb-8">
                        <h2 className="text-2xl font-black text-gray-800 tracking-tight">Bem-vindo de volta!</h2>
                        <p className="text-gray-500 text-sm font-medium mt-1">Acesse sua conta para gerenciar suas turmas.</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 border border-red-100 text-red-600 px-5 py-4 rounded-2xl text-xs font-bold animate-shake">
                                <i className="fas fa-exclamation-circle mr-2"></i>
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">E-mail</label>
                            <div className="relative group">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                    <i className="far fa-envelope text-lg"></i>
                                </span>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl pl-14 pr-6 py-4 font-bold text-gray-700 outline-none transition-all placeholder:text-gray-300"
                                    placeholder="seu@email.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Senha</label>
                            <div className="relative group">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
                                    <i className="fas fa-lock text-lg"></i>
                                </span>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl pl-14 pr-6 py-4 font-bold text-gray-700 outline-none transition-all placeholder:text-gray-300"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70 disabled:pointer-events-none group mt-4 overflow-hidden relative"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {loading ? (
                                    <i className="fas fa-circle-notch animate-spin text-lg"></i>
                                ) : (
                                    <>
                                        ACESSAR SISTEMA
                                        <i className="fas fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                                    </>
                                )}
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-500 group-hover:to-indigo-400 transition-all"></div>
                        </button>
                    </form>
                </div>

                <div className="text-center mt-8 animate-in fade-in duration-1000 delay-500">
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                        © 2026 EduPresença • Todos os direitos reservados
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake { animation: shake 0.3s ease-in-out; }
            `}</style>
        </div>
    );
};

export default LoginPage;

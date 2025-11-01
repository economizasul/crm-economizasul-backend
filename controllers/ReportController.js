import React from 'react';
import { 
    PieChart, Pie, BarChart, Bar, 
    XAxis, YAxis, Tooltip, ResponsiveContainer, Cell 
} from 'recharts'; 

const STATUS_ORDER = ['Novo', 'Primeiro Contato', 'Retorno Agendado', 'Em Negociação', 'Proposta Enviada', 'Ganho', 'Perdido'];
const FUNNEL_COLORS = ['#A3D4FF', '#74BDE9', '#4CA3D5', '#3A8FB9', '#2C6E91', '#1A4D67', '#FF6B6B'];

const ReportsDashboard = ({ data }) => {
    
    // =============================================================
    // CORREÇÃO CRÍTICA: Cláusula de Guarda para evitar 'undefined'
    // Se 'data' for null/undefined (antes do fetch), sai do componente.
    // =============================================================
    if (!data) {
        return <div className="text-center p-10 font-medium text-gray-500">Carregando dados do dashboard...</div>;
    }


    // =============================================================
    // 1. Processamento de Dados (Arrays defensivos mantidos)
    // =============================================================

    // 1.1. Processa Dados do Funil (Garante que data.funnelData é um array)
    const rawFunnelData = data.funnelData || []; 
    const processedFunnel = [];
    let totalLeads = 0;
    let previousCount = 0;

    for (const status of STATUS_ORDER) {
        const item = rawFunnelData.find(d => d.status === status);
        const count = item ? item.count : 0;
        
        if (status === 'Novo') {
            totalLeads = count;
        }

        let conversionRate = 0;
        if (previousCount > 0) {
            conversionRate = (count / previousCount) * 100;
        }
        
        processedFunnel.push({
            status,
            count,
            conversionRate: conversionRate.toFixed(1)
        });

        if (status !== 'Perdido') {
            previousCount = count;
        }
    }
    
    const reversedFunnel = processedFunnel.filter(d => d.count > 0).reverse();

    // 1.2. Processa Dados de Perda (Garante que data.lossReasons é um array)
    const lossReasonsData = (data.lossReasons || []).map(item => ({ 
        name: item.reason,
        value: parseInt(item.count)
    }));

    // 1.3. Função auxiliar para formatar tempo (minutos)
    const formatTime = (minutes) => {
        if (!minutes || minutes < 0) return 'N/A';
        if (minutes < 60) return `${Math.round(minutes)} min`;
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours}h ${mins} min`;
    };


    return (
        <div className="space-y-8">
            {/* ============================== 1. CARDS DE MÉTRICAS (Seguros, pois 'data' foi checado) ============================== */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                {/* Card: Novos Leads */}
                <div className="bg-blue-100 p-6 rounded-lg shadow-md flex justify-between items-center">
                    <div>
                        <p className="text-sm font-semibold text-blue-800">Novos Leads</p>
                        <p className="text-3xl font-bold text-blue-900">{data.newLeads}</p>
                    </div>
                </div>

                {/* Card: Taxa de Conversão Geral */}
                <div className="bg-green-100 p-6 rounded-lg shadow-md flex justify-between items-center">
                    <div>
                        <p className="text-sm font-semibold text-green-800">Taxa de Conversão Geral</p>
                        <p className="text-3xl font-bold text-green-900">{data.conversionRate}</p>
                    </div>
                </div>
                
                {/* Card: Tempo Médio de Resposta */}
                <div className="bg-yellow-100 p-6 rounded-lg shadow-md flex justify-between items-center">
                    <div>
                        <p className="text-sm font-semibold text-yellow-800">Tempo Médio de Resposta</p>
                        <p className="text-3xl font-bold text-yellow-900">{formatTime(data.avgResponseTime)}</p>
                    </div>
                </div>
                
                {/* Card: Valor Total em Negociação */}
                <div className="bg-purple-100 p-6 rounded-lg shadow-md flex justify-between items-center">
                    <div>
                        <p className="text-sm font-semibold text-purple-800">Valor em Negociação</p>
                        {/* Garante que o valor existe antes de chamar toLocaleString */}
                        <p className="text-3xl font-bold text-purple-900">R$ {(data.totalValueInNegotiation || 0).toLocaleString('pt-BR')}</p>
                    </div>
                </div>
            </div>

            {/* ============================== 2. FUNIL DE VENDAS E PERFORMANCE ============================== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* COLUNA ESQUERDA: FUNIL DE VENDAS */}
                <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Funil de Vendas (Pipeline)</h2>
                    
                    <div className="h-96 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                layout="vertical" 
                                data={reversedFunnel} 
                                margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                                barCategoryGap="0%" 
                                stackOffset="sign"
                            >
                                <YAxis 
                                    dataKey="status" 
                                    type="category" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    width={120} 
                                    tick={({ x, y, payload }) => (
                                        <g transform={`translate(${x},${y})`}>
                                            <text x={0} y={0} dy={5} textAnchor="end" fill="#666" fontSize={10}>
                                                {payload.value} ({payload.payload.count})
                                            </text>
                                        </g>
                                    )}
                                />
                                <XAxis 
                                    type="number" 
                                    hide={true} 
                                    domain={[0, totalLeads]} 
                                />
                                <Tooltip 
                                    formatter={(value, name, props) => [`Leads: ${value}`, props.payload.status]} 
                                    labelFormatter={(label) => `Estágio: ${label}`}
                                />
                                
                                <Bar dataKey="count" isAnimationActive={false}>
                                    {reversedFunnel.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={FUNNEL_COLORS[STATUS_ORDER.indexOf(entry.status)]} 
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* COLUNAS DIREITAS: TABELA DE PERFORMANCE */}
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md overflow-x-auto">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Performance Individual dos Vendedores</h2>
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendedor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leads Ativos</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendas Ganhas</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Taxa Conv.</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tempo Fecham.</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {/* Garante que data.sellerPerformance é um array */}
                            {(data.sellerPerformance || []).map((seller, index) => ( 
                                <tr key={index}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{seller.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{seller.activeLeads}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{seller.wonLeads}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-bold">{seller.conversionRate}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{seller.avgTimeToClose} dias</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* ============================== 3. ANÁLISE ESTRATÉGICA ============================== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* COLUNA ESQUERDA: ANÁLISE DE FUNIL POR ORIGEM */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Análise de Conversão por Origem</h2>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            {/* Garante que data.originAnalysis é um array */}
                            <BarChart data={data.originAnalysis || []}> 
                                <XAxis dataKey="origin" stroke="#888888" interval={0} angle={-25} textAnchor="end" height={60} />
                                <YAxis yAxisId="left" orientation="left" stroke="#82ca9d" />
                                <YAxis yAxisId="right" orientation="right" stroke="#8884d8" domain={[0, 100]} unit="%" />
                                <Tooltip formatter={(value, name, props) => name === 'conversionRate' ? [`${value}%`, 'Taxa de Conversão'] : [value, name === 'totalLeads' ? 'Total Leads' : 'Leads Ganhos']} />
                                <Bar yAxisId="left" dataKey="totalLeads" fill="#8884d8" name="Total de Leads" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* COLUNA DIREITA: PRINCIPAIS RAZÕES DE PERDA */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Principais Razões de Perda</h2>
                    <div className="h-80 flex justify-center items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={lossReasonsData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    fill="#8884d8"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                >
                                    {lossReasonsData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={['#FF6B6B', '#FFAA6B', '#FFD86B', '#A2FF6B', '#6BFFCE'][index % 5]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value, name, props) => [value, props.payload.name]} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default ReportsDashboard;
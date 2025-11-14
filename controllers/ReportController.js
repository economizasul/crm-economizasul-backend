// src/pages/ReportsPage.jsx

import React from 'react';
import { motion } from 'framer-motion';
import { useReports } from '../hooks/useReports';
import FilterBar from '../components/FilterBar.jsx';
import ReportsDashboard from '../components/reports/ReportsDashboard.jsx';

// Funções auxiliares para formatação de exibição
const formatPercent = (value) => `${(Number(value ?? 0) * 100).toFixed(1).replace('.', ',')}%`;
const formatKw = (value) => `${Number(value ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kW`;
const formatDays = (value) => `${Number(value ?? 0).toFixed(1).replace('.', ',')} dias`;
const formatNumber = (value) => Number(value ?? 0).toLocaleString('pt-BR');

const initialFilters = {
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  ownerId: 'all',
  source: 'all'
};

export default function ReportsPage() {
  const {
    data,
    filters,
    loading,
    error,
    exporting,
    updateFilter,
    applyFilters,
    exportToCsv,
    exportToPdf,
  } = useReports(initialFilters);

  // Usa a estrutura de métricas filtradas para o restante do dashboard
  const summary = data?.productivity; 

  return (
    <div className="min-h-screen bg-[#F7F9FB] text-[#0F172A]">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32 }}
          className="text-3xl font-extrabold text-[#1A7F3C] mb-4"
        >
          Relatórios & Métricas
        </motion.h1>

        <div className="flex items-start md:items-center justify-between flex-col md:flex-row">
          <div className="w-full md:w-auto">
            <FilterBar 
              currentFilters={filters}
              onFilterChange={updateFilter}
              onApplyFilters={applyFilters}
              exportToCsv={exportToCsv}
              exportToPdf={exportToPdf}
              isLoading={loading}
              isExporting={exporting}
            />
          </div>
          
          {/* quick summary (hidden on small screens) */}
          <div className="hidden md:flex items-center gap-6 mt-4 md:mt-0 bg-white p-3 rounded-xl shadow-sm border border-gray-200 divide-x divide-gray-200">
            
            {/* 1. Leads Ativos (GLOBAL) - CORRIGIDO */}
            <div className="text-sm text-gray-600 px-6">
                <div className="font-semibold text-xl text-indigo-600">
                    {/* 🚨 USA A NOVA CHAVE GLOBAL */}
                    {formatNumber(data?.globalActiveLeads)} 
                </div>
                <div className="text-xs">Leads Ativos (Total)</div> 
            </div>

            {/* 2. kW Vendido (FILTRADO) - Permanece usando o valor filtrado */}
            <div className="text-sm text-gray-600 px-6">
              <div className="font-semibold text-xl text-green-600">
                {formatKw(summary?.totalWonValueKW)}
              </div>
              <div className="text-xs">kW Vendido (Filtrado)</div>
            </div>

            {/* 3. Taxa de Conversão (FILTRADA) */}
            <div className="text-sm text-gray-600 px-6">
                <div className="font-semibold text-xl text-blue-600">
                    {formatPercent(summary?.conversionRate)}
                </div>
                <div className="text-xs">Conversão (Filtrado)</div>
            </div>

            {/* 4. Tempo Médio de Fechamento (FILTRADO) */}
            <div className="text-sm text-gray-600 pl-6">
              <div className="font-semibold text-xl text-orange-600">
                {formatDays(summary?.avgClosingTimeDays)}
              </div>
              <div className="text-xs">Fechamento Médio (Filtrado)</div>
            </div>

          </div>
        </div>

        {/* Dashboard main */}
        <div className="mt-6">
          <ReportsDashboard data={data} loading={loading} error={error} />
        </div>

        {/* Fallback messages */}
        {!data && !loading && !error && (
          <div className="mt-8 p-4 bg-white border border-gray-200 text-gray-700 rounded-2xl shadow-sm text-center">
            📊 Use os filtros acima e clique em <strong>Aplicar Filtros</strong> para carregar o relatório.
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl shadow-sm text-center">
            ⚠️ Erro ao carregar o relatório: {error}
          </div>
        )}
      </div>
    </div>
  );
}
export const CHART_THEME = {
  color: ['#6366F1', '#10B981', '#F59E0B', '#FB7185', '#38BDF8', '#A78BFA', '#34D399', '#FBBF24'],
  backgroundColor: 'transparent',
  textStyle: {
    color: '#94A3B8',
    fontFamily: 'Inter, ui-sans-serif, system-ui',
    fontSize: 12,
  },
  title: {
    textStyle: { color: '#F8FAFC' },
    subtextStyle: { color: '#94A3B8' },
  },
  legend: {
    textStyle: { color: '#94A3B8', fontSize: 12 },
    pageIconColor: '#6366F1',
    pageTextStyle: { color: '#64748B' },
  },
  tooltip: {
    backgroundColor: '#1A2338',
    borderColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    textStyle: { color: '#F8FAFC', fontSize: 12 },
    extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.4);',
  },
  grid: {
    borderColor: 'rgba(255,255,255,0.06)',
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
    axisTick: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    axisLabel: { color: '#64748B', fontSize: 11 },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
  },
  valueAxis: {
    axisLine: { show: false, lineStyle: { color: 'rgba(255,255,255,0.08)' } },
    axisTick: { show: false },
    axisLabel: { color: '#64748B', fontSize: 11 },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)', type: 'dashed' } },
    nameTextStyle: { color: '#64748B' },
  },
  line: {
    smooth: true,
    symbol: 'circle',
    symbolSize: 5,
    itemStyle: { borderWidth: 2 },
  },
  bar: {
    itemStyle: { borderRadius: [4, 4, 0, 0] },
  },
  visualMap: {
    color: ['#6366F1', '#3730A3', '#1e1b4b', '#131929'],
    textStyle: { color: '#94A3B8' },
  },
};

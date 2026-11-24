/**
 * Recharts 2.x subcomponents shared by the Overview and Analytics pages.
 * Keeps axis / tooltip formatting consistent across the admin console.
 */
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PackageAnalyticsRow, RevenueBucket } from '@/types';

/** Distinct fills for the package-share pie (high contrast, ordered). */
export const PIE_COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0EA5E9'] as const;

/** Revenue by TZ-day as a filled area (Overview). */
export function RevenueAreaChart({ data }: { data: RevenueBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="period" tickFormatter={(v) => v.slice(5)} fontSize={12} />
        <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={50} />
        <Tooltip formatter={(v: number) => `TZS ${v.toLocaleString()}`} />
        <Area
          type="monotone"
          dataKey="revenueTzs"
          stroke="#2563EB"
          fill="#DBEAFE"
          fillOpacity={0.35}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Revenue by TZ-day as bars (Analytics). */
export function RevenueBarChart({ data }: { data: RevenueBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="period" tickFormatter={(v) => v.slice(5)} fontSize={12} />
        <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={50} />
        <Tooltip formatter={(v: number) => `TZS ${v.toLocaleString()}`} />
        <Bar dataKey="revenueTzs" fill="#2563EB" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Revenue share by package (Analytics). */
export function PackagePieChart({ data }: { data: PackageAnalyticsRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="revenueTzs" nameKey="packageName" innerRadius={55} outerRadius={85}>
          {data.map((row, i) => (
            <Cell key={row.packageId} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => `TZS ${v.toLocaleString()}`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

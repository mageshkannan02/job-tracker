import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ApplicationStatus } from '@/types';
import { STATUS_CHART_COLORS } from '@/lib/utils';

interface StatusDistributionChartProps {
  byStatus: Record<ApplicationStatus, number>;
}

export const StatusDistributionChart: React.FC<StatusDistributionChartProps> = ({
  byStatus,
}) => {
  const data = Object.entries(byStatus || {})
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      name: status as ApplicationStatus,
      value: count,
      color: STATUS_CHART_COLORS[status as ApplicationStatus] || '#94a3b8',
    }));

  const totalApplications = data.reduce((acc, curr) => acc + curr.value, 0);
  const hasData = data.length > 0;

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Status Distribution
          </CardTitle>
          {hasData && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              {totalApplications} Total
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 justify-between">
        {hasData ? (
          <div>
            <div className="h-[250px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0];
                        const pct =
                          totalApplications > 0
                            ? ((Number(item.value) / totalApplications) * 100).toFixed(1)
                            : '0';
                        return (
                          <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-primary font-bold mt-0.5">
                              {item.value} applications ({pct}%)
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    formatter={(val) => {
                      const item = data.find((d) => d.name === val);
                      return (
                        <span className="text-xs text-foreground font-medium mr-2">
                          {val} <span className="font-bold text-muted-foreground">({item?.value ?? 0})</span>
                        </span>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed Count Badges Grid */}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 border-t">
              {data.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground truncate">{item.name}</span>
                  </div>
                  <span className="font-bold text-foreground ml-2">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            No status data available yet
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface ApplicationsOverTimeChartProps {
  monthlyData: Array<{ month: string; count: number }>;
}

export const ApplicationsOverTimeChart: React.FC<ApplicationsOverTimeChartProps> = ({
  monthlyData,
}) => {
  const hasData = monthlyData && monthlyData.length > 0;
  const totalCount = (monthlyData || []).reduce((acc, curr) => acc + curr.count, 0);

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Monthly Applications
          </CardTitle>
          {hasData && (
            <span className="text-xs text-muted-foreground font-medium">
              Total: <span className="font-bold text-foreground">{totalCount}</span>
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyData}
                margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md">
                          <p className="font-medium text-muted-foreground">{label}</p>
                          <p className="font-bold text-primary text-sm mt-0.5">
                            {payload[0].value} applications
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={45}
                >
                  <LabelList
                    dataKey="count"
                    position="top"
                    className="fill-foreground text-[11px] font-semibold"
                    formatter={(val: any) => (Number(val) > 0 ? val : '')}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            No timeline data available yet
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface WeeklyActivityChartProps {
  weeklyData: Array<{ week: string; count: number }>;
}

export const WeeklyActivityChart: React.FC<WeeklyActivityChartProps> = ({
  weeklyData,
}) => {
  const hasData = weeklyData && weeklyData.length > 0;
  const totalCount = (weeklyData || []).reduce((acc, curr) => acc + curr.count, 0);

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Weekly Activity
          </CardTitle>
          {hasData && (
            <span className="text-xs text-muted-foreground font-medium">
              Total: <span className="font-bold text-foreground">{totalCount}</span>
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-[250px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyData}
                margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="week"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md">
                          <p className="font-medium text-muted-foreground">{label}</p>
                          <p className="font-bold text-indigo-500 text-sm mt-0.5">
                            {payload[0].value} jobs added
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="#818cf8"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={35}
                >
                  <LabelList
                    dataKey="count"
                    position="top"
                    className="fill-foreground text-[11px] font-semibold"
                    formatter={(val: any) => (Number(val) > 0 ? val : '')}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            No weekly data recorded
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface TopCompaniesChartProps {
  companies: Array<{ company: string; count: number }>;
}

export const TopCompaniesChart: React.FC<TopCompaniesChartProps> = ({
  companies,
}) => {
  const hasData = companies && companies.length > 0;

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Top Applied Companies
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={companies.slice(0, 5)}
                margin={{ top: 5, right: 25, left: 30, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="company"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={90}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md">
                          <p className="font-medium text-muted-foreground">{label}</p>
                          <p className="font-bold text-emerald-500 text-sm mt-0.5">
                            {payload[0].value} positions
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="#10b981"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={25}
                >
                  <LabelList
                    dataKey="count"
                    position="right"
                    className="fill-foreground text-[11px] font-semibold"
                    formatter={(val: any) => (Number(val) > 0 ? val : '')}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            No company trends yet
          </div>
        )}
      </CardContent>
    </Card>
  );
};

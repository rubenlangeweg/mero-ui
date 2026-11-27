/*! @rubenlangeweg/mero-ui 1.0.0 | MIT */
export type MeroChartType = "line" | "area" | "bar" | "composed" | "pie" | "radar" | "radial";

export interface MeroChartRow {
  label: string;
  values: number[];
}

export interface MeroChartOptions {
  type?: MeroChartType;
  title: string;
  caption?: string;
  series: string[];
  rows: MeroChartRow[];
  locale?: string;
  numberFormat?: Intl.NumberFormatOptions;
  axisNumberFormat?: Intl.NumberFormatOptions;
}

export function renderChart(options: MeroChartOptions): string;

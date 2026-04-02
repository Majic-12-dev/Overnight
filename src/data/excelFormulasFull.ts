import { EXCEL_FORMULAS as NEW_FORMULAS } from './masterFormulas.json';

export interface ExcelFormula {
  name: string;
  category: string;
  popularity: number;
  syntax: string;
  placeholders: string[];
  description: string;
  useCase: string;
  example: string;
}

export const EXCEL_FORMULAS: ExcelFormula[] = NEW_FORMULAS as ExcelFormula[];

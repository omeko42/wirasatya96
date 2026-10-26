import { KasTransaction, IuranAnggota, FinanceSummary, AssetPortfolioItem } from '@/types';
import { AKPOL_1996_IURAN } from './akpol1996Alumni';
import {
  DUMMY_ASSETS,
  DUMMY_FINANCE_SUMMARY,
  DUMMY_IURAN_LIST,
  DUMMY_TRANSACTIONS,
} from './dummySimulationData';

export const INITIAL_FINANCE_SUMMARY: FinanceSummary = {
  ...DUMMY_FINANCE_SUMMARY,
};

export const INITIAL_TRANSACTIONS: KasTransaction[] = [...DUMMY_TRANSACTIONS];

export const INITIAL_ASSETS: AssetPortfolioItem[] = [...DUMMY_ASSETS];


export const INITIAL_IURAN_LIST: IuranAnggota[] = [
  ...DUMMY_IURAN_LIST,
  ...AKPOL_1996_IURAN,
];



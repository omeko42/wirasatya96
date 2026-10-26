import { AnggotaWiraSatya } from '@/types';
import { AKPOL_1996_MEMBERS } from './akpol1996Alumni';
import { DUMMY_MEMBERS } from './dummySimulationData';

export const INITIAL_MEMBERS: AnggotaWiraSatya[] = [
  ...DUMMY_MEMBERS,
  ...AKPOL_1996_MEMBERS,
];



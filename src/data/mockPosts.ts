import { FeedPost } from '@/types';
import { DUMMY_POSTS } from './dummySimulationData';

export const PRESET_POST_IMAGES = [
  {
    label: 'Banner Polri Bersama Masyarakat',
    url: '/default-cover.jpg',
    description: 'Melindungi, Mengayomi dan Melayani Masyarakat',
  },
  {
    label: 'Ilustrasi Personel Polri',
    url: '/default-avatar.png',
    description: 'Identitas Resmi Personel Kepolisian Negara Republik Indonesia',
  },
];

export const PRESET_POST_VIDEOS = [
  {
    label: 'Video Dokumentasi Kegiatan & Usaha Bersama WS96',
    url: '/sample-ws96-video.mp4',
    description: 'Cuplikan dokumentasi silaturahmi & program kerja Batalyon Wira Satya 96',
  },
];

export const INITIAL_FEED_POSTS: FeedPost[] = [...DUMMY_POSTS];

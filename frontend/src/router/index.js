import { createRouter, createWebHistory } from 'vue-router';
import IndexView from '@/views/IndexView.vue';
import AccountView from '@/views/AccountView.vue';
import PublicBookingView from '@/views/PublicBookingView.vue';
import PublicInformationView from '@/views/PublicInformationView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) { return savedPosition || (to.path !== from.path ? { top: 0 } : false) },
  routes: [
    { name: 'bowelScan', path: '/bowel-scan', component: () => import('@/views/BowelScanView.vue') },
    { name: 'screeningGuide', path: '/screening-guide', component: PublicInformationView },
    { name: 'contact', path: '/contact', component: PublicInformationView },
    {
      name: 'public',
      path: '/',
      component: IndexView,
    },
    {
      name: 'admin',
      path: '/admin',
      component: IndexView,
    },
    {
      name: 'account',
      path: '/account',
      component: AccountView,
    },
    {
      name: 'booking',
      path: '/booking',
      component: PublicBookingView,
    },
    {
      name: 'bookingInvitation',
      path: '/booking/invitation',
      component: PublicBookingView,
      meta: { bookingEntry: 'invitation' },
    },
    {
      name: 'bookingGeneral',
      path: '/booking/general',
      component: PublicBookingView,
      meta: { bookingEntry: 'general' },
    },
  ],
})

export default router;

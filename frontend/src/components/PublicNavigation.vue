<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PublicBrand from './PublicBrand.vue'
const route = useRoute()
const menuOpen = ref(false)
const links = [{ path: '/', label: '首頁' }, { path: '/screening-guide', label: '篩檢須知' }, { path: '/contact', label: '聯絡我們' }]
watch(() => route.fullPath, () => { menuOpen.value = false })
</script>
<template>
  <header class="public-navigation" @keydown.esc="menuOpen = false">
    <div class="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 lg:gap-6 lg:px-8 lg:py-5">
      <PublicBrand subtitle @click="$router.push('/')" />
      <nav class="hidden items-center gap-2 lg:flex" aria-label="網站導覽"><RouterLink v-for="link in links" :key="link.path" :to="link.path" :class="['public-nav-link', route.path === link.path ? 'is-current' : '']">{{ link.label }}</RouterLink></nav>
      <RouterLink to="/account" class="public-account-link hidden lg:inline-flex"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/></svg>後台登入／帳號申請</RouterLink>
      <button type="button" class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#bdc8af] text-[#40573c] lg:hidden" :aria-expanded="menuOpen" :aria-label="menuOpen ? '關閉選單' : '開啟選單'" aria-controls="mobile-public-nav" @click="menuOpen = !menuOpen"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path v-if="menuOpen" d="m6 6 12 12M6 18 18 6"/><path v-else d="M4 7h16M4 12h16M4 17h16"/></svg></button>
    </div>
    <nav v-if="menuOpen" id="mobile-public-nav" class="border-t border-[#d8ddce] px-5 py-3 lg:hidden" aria-label="手機版網站導覽"><RouterLink v-for="link in links" :key="link.path" :to="link.path" :class="['public-nav-link block', route.path === link.path ? 'is-current' : '']" @click="menuOpen = false">{{ link.label }}</RouterLink><RouterLink to="/account" class="public-nav-link mt-2 block border-t border-[#d8ddce]" @click="menuOpen = false">後台登入／帳號申請</RouterLink></nav>
  </header>
</template>
<style scoped>
.public-navigation { position:relative; z-index:10; background:#fffdf8; border-bottom:1px solid #d8ddce; }
.public-nav-link { min-height:48px; padding:12px 20px; border-radius:8px; font-size:18px; line-height:1.4; color:#59695a; }
.public-nav-link:hover { background:#f1f2e8; color:#40573c; }
.public-nav-link.is-current { background:#e7ecdf; color:#2f493a; }
.public-account-link { min-height:48px; align-items:center; gap:8px; padding:10px 16px; border:1px solid #bdc8af; border-radius:10px; white-space:nowrap; color:#40573c; font-size:14px; }
.public-account-link:hover { background:#e7ecdf; }
:is(a,button):focus-visible { outline:3px solid #526c4b; outline-offset:3px; }
</style>

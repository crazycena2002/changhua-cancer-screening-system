<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import PublicNavigation from '@/components/PublicNavigation.vue'
import PublicFooter from '@/components/PublicFooter.vue'
import ScreeningGuide from '@/components/ScreeningGuide.vue'
import { healthBureau, healthCenters, contactSource, contactVerifiedDate } from '@/data/healthContacts'
const route = useRoute()
const isGuide = computed(() => route.name === 'screeningGuide')
const area = ref('全部')
const keyword = ref('')
const areas = [...new Set(healthCenters.map(item => item.area))]
const contacts = computed(() => healthCenters.filter(item => (area.value === '全部' || area.value === item.area) && `${item.name}${item.address}${item.phones.join('')}`.replaceAll('-', '').includes(keyword.value.trim().replaceAll('-', ''))))
function reset() { area.value = '全部'; keyword.value = '' }
</script>
<template>
  <div class="public-information natural-surface flex min-h-screen flex-col">
    <PublicNavigation />
    <main class="mx-auto w-full max-w-7xl flex-1 px-5 py-8 lg:px-8 lg:py-12">
      <nav aria-label="目前位置" class="mb-7 text-base text-[#59695a]"><RouterLink to="/" class="underline underline-offset-4">首頁</RouterLink><span class="mx-3" aria-hidden="true">／</span><span aria-current="page">{{ isGuide ? '篩檢須知' : '聯絡我們' }}</span></nav>
      <ScreeningGuide v-if="isGuide" standalone />
      <template v-else>
        <h1 class="text-3xl font-normal sm:text-4xl">聯絡我們</h1><p class="mt-4 max-w-3xl text-lg leading-8 text-[#59695a]">篩檢項目、檢查準備與場次資訊，可洽詢承辦衛生所；其他衛生業務問題，可聯絡彰化縣衛生局。</p>
        <section class="mt-8 rounded-2xl border border-[#d8ddce] bg-[#e7ecdf] p-6 sm:p-8" aria-labelledby="bureau-title"><div class="grid gap-6 lg:grid-cols-[1fr_1.5fr]"><div><h2 id="bureau-title" class="text-2xl font-normal">{{ healthBureau.name }}</h2><a :href="'tel:' + healthBureau.phone.replaceAll('-', '')" class="mt-4 inline-flex min-h-12 items-center text-2xl text-[#40573c] underline underline-offset-4" aria-label="撥打彰化縣衛生局 04-7115141">{{ healthBureau.phone }}</a></div><div class="space-y-3 text-base leading-8"><p>地址：{{ healthBureau.address }}</p><p>服務時間：{{ healthBureau.hours }}</p><a :href="healthBureau.website" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-12 items-center text-[#40573c] underline underline-offset-4">衛生局官方網站（另開視窗）</a></div></div></section>
        <section class="mt-10" aria-labelledby="centers-title"><h2 id="centers-title" class="text-2xl font-normal">尋找衛生所</h2><p class="mt-3 text-base leading-7 text-[#59695a]">依鄉鎮市區篩選，或輸入名稱、地址、電話搜尋。</p>
          <div class="mt-5 grid items-end gap-4 sm:grid-cols-[1fr_2fr_auto]"><div><label for="contact-area" class="mb-2 block text-base">鄉鎮市區</label><select id="contact-area" v-model="area" class="field"><option value="全部">全部鄉鎮市區</option><option v-for="item in areas" :key="item">{{ item }}</option></select></div><div><label for="contact-keyword" class="mb-2 block text-base">搜尋衛生所</label><input id="contact-keyword" v-model="keyword" class="field" placeholder="例如員林、旭光路或電話號碼"></div><button type="button" class="contact-reset" @click="reset">清除條件</button></div>
          <p role="status" class="mt-5 text-base text-[#59695a]">找到 {{ contacts.length }} 個衛生所</p>
          <ul class="mt-4 divide-y divide-[#d8ddce] border-y border-[#d8ddce]"><li v-for="item in contacts" :key="item.name" class="contact-row"><div><h3 class="text-xl font-normal">{{ item.name }}</h3><p class="mt-3 text-base leading-7 text-[#59695a]">{{ item.address }}</p></div><div class="flex flex-wrap items-center gap-x-5 gap-y-2"><a v-for="phone in item.phones" :key="phone" :href="'tel:' + phone.replaceAll('-', '')" class="inline-flex min-h-12 items-center text-lg text-[#40573c] underline underline-offset-4" :aria-label="'撥打' + item.name + ' ' + phone">{{ phone }}</a></div><a :href="item.website" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-12 items-center text-base text-[#40573c] underline underline-offset-4">官方網站<span class="sr-only">：{{ item.name }}，另開視窗</span></a></li></ul>
          <div v-if="!contacts.length" class="py-10 text-base leading-8 text-[#59695a]"><p>沒有符合條件的衛生所，請調整鄉鎮或搜尋文字。</p><button class="contact-reset mt-4" @click="reset">顯示全部衛生所</button></div>
        </section>
        <p class="mt-8 text-sm leading-7 text-[#59695a]">資料查核日期：{{ contactVerifiedDate }}。服務時間、臨時辦公地點及最新聯絡資訊，請以各單位公告為準。</p><a :href="contactSource" target="_blank" rel="noopener noreferrer" class="mt-2 inline-flex min-h-12 items-center text-base text-[#40573c] underline underline-offset-4">資料來源：彰化縣衛生局衛生所通訊資料（另開視窗）</a>
      </template>
    </main>
    <PublicFooter />
  </div>
</template>
<style scoped>
.public-information { font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif; }
.public-information .field { min-height:54px; font-size:18px; }
.contact-row { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) auto; gap:24px; align-items:center; padding:24px 0; }
.contact-reset { min-height:54px; padding:12px 20px; border:1px solid #bdc8af; border-radius:10px; color:#40573c; background:#fffdf8; font-size:18px; }
.contact-reset:hover { background:#e7ecdf; }
:is(a,button):focus-visible { outline:3px solid #526c4b; outline-offset:3px; }
@media(max-width:767px) { .contact-row { grid-template-columns:1fr; gap:8px; } }
</style>

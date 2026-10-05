<script setup>
import { computed, ref } from 'vue'
import PublicIcon from './PublicIcon.vue'
defineProps({ standalone: Boolean })
const selected = ref('integrated')
const guides = [
  { key: 'integrated', title: '整合性篩檢', intro: '同一場次提供多項健康檢查；實際檢查項目與資格，依場次安排及現場核對為準。', sections: [
    { title: '出發前', items: ['攜帶健保卡、身分證件及邀約通知（如有）。', '先查看預約場次的報到時間、地點與檢查項目。'] },
    { title: '檢查準備', items: ['若安排空腹抽血，請事先向承辦單位確認空腹時間與飲水規定。', '正在服藥或有慢性疾病時，請詢問醫療人員如何準備，勿自行停藥。'] },
    { title: '報到與後續', items: ['依預約時間報到，向工作人員告知健康狀況及正在使用的藥物。', '檢查後依承辦單位說明查詢結果；需要追蹤時，請依醫療人員安排回診。'] },
  ], source: '彰化縣衛生局｜整合式篩檢專區', url: 'https://www.chshb.gov.tw/topic/316' },
  { key: 'cervical', title: '子宮頸抹片', intro: '採集少量子宮頸表面細胞，協助發現異常細胞變化。', sections: [
    { title: '出發前', items: ['攜帶健保卡與身分證件，依預約時間報到。', '安排檢查時請避開月經期間；如當天仍有出血，先詢問院所是否需要改期。'] },
    { title: '檢查準備', items: ['檢查前避免盆浴、陰道沖洗及使用陰道塞劑；如有處方用藥，先向醫療人員確認。', '檢查前一晚避免性行為，以免影響抹片判讀。'] },
    { title: '檢查與後續', items: ['採檢時若感到不適，請告知醫療人員。', '依院所說明查詢結果；若通知需要追蹤，請安排回診確認。'] },
  ], source: '國民健康署｜子宮頸抹片檢查前的準備', url: 'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=127&pid=13842' },
  { key: 'breast', title: '乳房攝影', intro: '以乳房 X 光影像檢查協助早期發現異常，檢查時會短暫壓迫乳房。', sections: [
    { title: '出發前', items: ['攜帶健保卡、身分證件；如有過去檢查影像或報告，可先詢問院所是否需要帶來。', '建議穿著上下分開、方便更換的衣物。'] },
    { title: '檢查準備', items: ['檢查當天避免在乳房或腋下使用除臭劑、粉劑與護膚霜，以免影響影像判讀。', '可能懷孕、正在哺乳、曾做乳房手術或有植入物，請事先告知醫療人員。'] },
    { title: '檢查與後續', items: ['壓迫時可能感到不適；若疼痛，請立即告知操作人員。', '若結果需要進一步檢查，請依院所通知安排追蹤。'] },
  ], source: '國民健康署｜乳癌防治', url: 'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=614&pid=1124&sid=1122' },
  { key: 'bowel', title: '糞便潛血', intro: '使用採便管採集少量糞便，檢查是否含有肉眼不易看見的血液。', sections: [
    { title: '領管前', items: ['攜帶健保卡與身分證件至預約院所，領取採便管並確認採集方式。', '確認繳回地點、收件時間與院所提供的保存說明。'] },
    { title: '採集與保存', items: ['依採便管附帶說明採集，避免糞便碰到尿液或馬桶水。', '採集後依院所指示冷藏保存，並儘速送回；避免高溫或日曬。'] },
    { title: '收到結果後', items: ['結果陽性不等於罹癌，但應依醫囑接受進一步大腸鏡檢查。', '不要以再次做糞便潛血檢查，取代陽性結果後應接受的進一步檢查。'] },
  ], source: '國民健康署｜大腸癌篩檢介紹', url: 'https://www.hpa.gov.tw/Pages/List.aspx?nodeid=354' },
]
const current = computed(() => guides.find(guide => guide.key === selected.value))
</script>
<template>
  <section id="screening-guide" class="screening-guide" :class="standalone ? '' : 'mt-12 border-t border-[#d8ddce] pt-8 sm:mt-16 sm:pt-12'" aria-labelledby="screening-guide-title">
    <component :is="standalone ? 'h1' : 'h2'" id="screening-guide-title" class="text-3xl font-normal sm:text-4xl">篩檢須知</component>
    <p class="mt-3 text-lg leading-8 text-[#59695a]">選擇檢查項目，查看出發前的準備與檢查提醒。</p>
    <div class="my-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label="篩選檢查須知">
      <button v-for="guide in guides" :key="guide.key" type="button" :aria-pressed="selected === guide.key" aria-controls="screening-guide-content" :class="['guide-filter', selected === guide.key ? 'is-selected' : '']" @click="selected = guide.key"><PublicIcon name="guide" />{{ guide.title }}</button>
    </div>
    <article id="screening-guide-content" class="guide-content" aria-live="polite" aria-atomic="true">
      <h3 class="text-2xl font-normal">{{ current.title }}{{ current.key === 'integrated' ? '須知' : '檢查須知' }}</h3><p class="mt-3 max-w-3xl text-lg leading-8 text-[#59695a]">{{ current.intro }}</p>
      <div class="mt-6 grid gap-6 lg:grid-cols-3"><section v-for="part in current.sections" :key="part.title" class="border-t border-[#d8ddce] pt-5"><h4 class="text-xl font-normal">{{ part.title }}</h4><ul class="mt-3 list-disc space-y-3 pl-5 text-base leading-8 text-[#59695a]"><li v-for="item in part.items" :key="item">{{ item }}</li></ul></section></div>
      <p class="mt-7 border-t border-[#d8ddce] pt-5 text-base leading-7 text-[#59695a]">個別場次與院所的通知為準；有準備上的疑問，請先詢問承辦單位。</p><a :href="current.url" target="_blank" rel="noopener noreferrer" class="mt-3 inline-block text-base text-[#40573c] underline underline-offset-4">資料來源：{{ current.source }}（另開視窗）</a>
      <a v-if="current.key === 'breast'" href="https://www.vghtc.gov.tw/News_Content/2207/8411" target="_blank" rel="noopener noreferrer" class="mt-3 block text-base text-[#40573c] underline underline-offset-4">延伸閱讀：臺中榮總乳房攝影檢查準備（另開視窗）</a>
      <a v-if="current.key === 'bowel'" href="https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=5053&amp;pid=20024&amp;sid=20026" target="_blank" rel="noopener noreferrer" class="mt-3 block text-base text-[#40573c] underline underline-offset-4">延伸閱讀：國民健康署糞便潛血陽性後的檢查（另開視窗）</a>
    </article>
  </section>
</template>
<style scoped>
.guide-filter { display:flex; align-items:center; justify-content:center; gap:12px; min-height:60px; padding:12px 16px; border:1px solid #bdc8af; border-radius:12px; background:#fffdf8; color:#40573c; font-size:20px; }
.guide-filter.is-selected { background:#526c4b; border-color:#526c4b; color:#fff; }
.guide-filter:hover:not(.is-selected) { background:#e7ecdf; }
.guide-content { padding:28px; background:#fffdf8; border:1px solid #d8ddce; border-radius:16px; }
@media(max-width:639px) { .guide-content { padding:20px; } }
</style>

<script setup>
defineProps({ samples: { type: Array, default: () => [] }, automatic: { type: Boolean, default: false } })
defineEmits(['select'])
</script>

<template>
  <section v-if="samples.length" class="admin-samples" aria-label="模擬測試資料">
    <p class="text-sm">模擬測試資料 <span class="ml-2 text-xs text-[#59695a]">僅供本機測試</span></p>
    <p class="mt-1 text-xs leading-6 text-[#59695a]">{{ automatic ? '帶入後會更新篩選結果；儲存與列印仍需另外確認。' : '帶入會取代此區欄位，請核對後再按查詢或儲存。' }}</p>
    <div class="mt-3 grid gap-2 sm:grid-cols-3">
      <button v-for="(sample, index) in samples.slice(0, 5)" :key="sample.label" type="button" class="admin-sample-button" @click="$emit('select', sample)">
        <span class="flex items-center justify-between gap-3"><span>{{ index + 1 }} · {{ sample.label }}</span><span class="shrink-0 text-xs">帶入 ↗</span></span>
        <span class="mt-1 block text-xs leading-5 text-[#59695a]">{{ sample.description }}</span>
      </button>
    </div>
  </section>
</template>

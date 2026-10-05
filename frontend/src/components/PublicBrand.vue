<script setup>
defineProps({ subtitle: Boolean })
</script>

<template>
  <button class="flex min-w-0 items-center gap-3 text-left font-normal text-[#2f493a]" aria-label="彰化縣癌症篩檢活動預約系統首頁">
    <img src="/images/changhua-logo.png" alt="" width="72" height="48" class="h-11 w-[66px] shrink-0 rounded-md object-contain sm:h-12 sm:w-[72px]">
    <span class="min-w-0 font-normal leading-6 tracking-tight" :class="subtitle ? 'text-[15px] sm:text-base' : 'text-[13px] sm:text-base'">
      <span>彰化縣癌症篩檢<span class="block sm:inline">活動預約系統</span></span>
      <span v-if="subtitle" class="hidden text-xs leading-5 tracking-normal text-[#59695a] sm:block">守護健康，從定期篩檢開始</span>
    </span>
  </button>
</template>

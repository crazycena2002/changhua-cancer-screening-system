<script setup>
import { ref, watch, nextTick } from 'vue'
import JsBarcode from 'jsbarcode'
const props = defineProps({ value: { type: String, required: true } })
const svg = ref(null)
const failed = ref(false)
watch(() => props.value, async value => {
  await nextTick()
  if (!svg.value) return
  try {
    JsBarcode(svg.value, value, { format: 'CODE128', width: 2, height: 32, margin: 0, marginLeft: 20, marginRight: 20, background: '#ffffff', lineColor: '#000000', displayValue: false })
    const width = svg.value.getAttribute('width'), height = svg.value.getAttribute('height')
    svg.value.setAttribute('viewBox', `0 0 ${width} ${height}`)
    failed.value = false
  } catch { failed.value = true }
}, { immediate: true })
</script>
<template>
  <div class="max-w-full bg-white">
    <svg ref="svg" role="img" :aria-label="`Code 128 條碼 ${value}`" class="block h-auto max-w-full" />
    <p v-if="failed" class="p-3 text-sm text-[#9b342b]" role="alert">條碼無法產生，請重新整理後再試一次。</p>
  </div>
</template>

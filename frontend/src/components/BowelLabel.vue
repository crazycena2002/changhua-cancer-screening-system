<script setup>
import BowelBarcode from './BowelBarcode.vue'
import '@/styles/bowel-label.css'
defineProps({ record: { type: Object, required: true } })
</script>

<template>
  <div class="bowel-print-label" aria-label="採便管標籤">
    <div class="bowel-print-label-header">
      <span class="bowel-print-label-provider">{{ record.institutionName }}</span>
      <span class="bowel-print-label-name">{{ record.name }}</span>
    </div>
    <p class="bowel-print-label-details">{{ record.institutionType }} · {{ record.identity }} · {{ record.reservationDate }}</p>
    <BowelBarcode :value="record.barcode" />
    <p class="bowel-print-label-serial">條碼 {{ record.barcode }} · 預約編號 {{ record.reservationId }}</p>
  </div>
</template>

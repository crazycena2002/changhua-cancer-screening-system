<script setup>
defineProps({ name: { type: String, default: 'calendar' } })
const paths = {
  tube: 'M9 3h6m-5 0v14a3 3 0 0 0 6 0V3M10 10h6m-3 4h3',
  list: 'M8 5h13M8 12h13M8 19h13M3 5h.1M3 12h.1M3 19h.1',
  label: 'M3 3h8l10 10-8 8L3 11V3Zm4 4h.1',
  provider: 'M4 21V3h16v18M2 21h20M9 21v-5h6v5M8 7h8m-4-3v6',
  chart: 'M4 3v18h17M8 17v-4m5 4V8m5 9V5',
  calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2m3 10h3v3H8z',
  search: 'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  guide: 'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5',
  edit: 'm14 5 5 5M4 20l5-1L21 7l-5-5L4 14z',
}
</script>
<template><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name] || paths.calendar" /></svg></template>

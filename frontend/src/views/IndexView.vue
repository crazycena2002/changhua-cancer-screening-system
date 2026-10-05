<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PublicHomeView from '@/views/PublicHomeView.vue'
import AdminDashboardView from '@/views/AdminDashboardView.vue'
const route = useRoute()
const isAdmin = computed(() => route.name === 'admin')
</script>
<template><AdminDashboardView v-if="isAdmin" /><PublicHomeView v-else /></template>

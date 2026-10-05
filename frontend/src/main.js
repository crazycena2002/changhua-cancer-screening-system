import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './style.css'
import './styles/natural.css'
import { useDemoStore } from './stores/demo'
import { assignLabelCodes, readStoredLabels, mergeLabelRecords, persistLabels } from './utils/bowelLabels'

const app = createApp(App)

app.use(createPinia())
const demo = useDemoStore()
// Only the bowel label roster persists locally for barcode matching across pages.
let labelStorage
try { labelStorage = window.localStorage } catch { labelStorage = null }
demo.tracking = mergeLabelRecords(demo.tracking, readStoredLabels(labelStorage))
watch(() => demo.tracking, records => {
  assignLabelCodes(records)
  persistLabels(records, labelStorage)
}, { deep: true, immediate: true, flush: 'post' })
app.use(router)

app.mount('#app')

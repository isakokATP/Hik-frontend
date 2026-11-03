<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

useHead({
  title: 'ประวัติการเข้าออก',
  bodyAttrs: { style: 'margin:0' },
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600&display=swap'
    }
  ]
})

// ---------- state ----------
const page = ref(0)
const size = ref(10)
const keyword = ref('')
const search = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const preview = ref(null)
const brokenImages = ref(new Set())
const pageSizes = [10, 20, 50]

const config = useRuntimeConfig()
const apiBase = config.public?.apiBase || 'http://localhost:9090'

// ---------- data ----------
const { data, pending, error, refresh } = await useFetch(`${apiBase}/api/hikvision/logs/page`, {
  query: {
    page,
    size,
    keyword: computed(() => search.value || undefined),
    startDate: computed(() => dateFrom.value || undefined),
    endDate: computed(() => dateTo.value || undefined)
  },
  lazy: true,
  server: false
})

const logs = computed(() => data.value?.content ?? [])
const totalPages = computed(() => Math.max(data.value?.totalPages ?? 1, 1))
const totalItems = computed(() => data.value?.totalElements ?? null)
const firstItem = computed(() => (logs.value.length ? page.value * size.value + 1 : 0))
const lastItem = computed(() => page.value * size.value + logs.value.length)

// ---------- filters ----------
let timer
watch(keyword, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => { search.value = v.trim() }, 400)
})
onBeforeUnmount(() => clearTimeout(timer))
watch([search, dateFrom, dateTo, size], () => { page.value = 0 })

const hasFilters = computed(() => !!(keyword.value || dateFrom.value || dateTo.value))
function clearFilters() {
  keyword.value = ''
  search.value = ''
  dateFrom.value = ''
  dateTo.value = ''
}

// Quick date ranges (local time, not UTC, so "today" is correct in Thailand)
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return ymd(d)
}
const quickRanges = [
  { key: 'today', label: 'วันนี้', from: () => daysAgo(0), to: () => daysAgo(0) },
  { key: 'yesterday', label: 'เมื่อวาน', from: () => daysAgo(1), to: () => daysAgo(1) },
  { key: '7d', label: '7 วันล่าสุด', from: () => daysAgo(6), to: () => daysAgo(0) },
  { key: '30d', label: '30 วันล่าสุด', from: () => daysAgo(29), to: () => daysAgo(0) }
]
const activeRange = computed(
  () => quickRanges.find((r) => r.from() === dateFrom.value && r.to() === dateTo.value)?.key
)
function applyRange(r) {
  if (activeRange.value === r.key) {
    dateFrom.value = ''
    dateTo.value = ''
  } else {
    dateFrom.value = r.from()
    dateTo.value = r.to()
  }
}

// ---------- pagination ----------
const pageNumbers = computed(() => {
  const total = totalPages.value
  const start = Math.max(0, Math.min(page.value - 2, total - 5))
  const end = Math.min(total, start + 5)
  return Array.from({ length: end - start }, (_, i) => start + i)
})

// ---------- formatting ----------
const dateFmt = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

function parseDate(v) {
  if (!v) return null
  let d = new Date(v)
  if (isNaN(d)) d = new Date(String(v).replace(' ', 'T'))
  return isNaN(d) ? null : d
}
const fmtDate = (v) => {
  const d = parseDate(v)
  return d ? dateFmt.format(d) : ''
}
const fmtTime = (v) => {
  const d = parseDate(v)
  return d ? timeFmt.format(d) : String(v ?? '—')
}

const initials = (name) => (name || '?').trim().slice(0, 1)
const hasPhoto = (log) => !!log.pictureUrl && !brokenImages.value.has(log.id)
const markBroken = (id) => { brokenImages.value = new Set(brokenImages.value).add(id) }

function onKey(e) {
  if (e.key === 'Escape') preview.value = null
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="page">
    <div class="wrap">

      <!-- Header -->
      <header class="head">
        <div>
          <h1>ประวัติการเข้าออก</h1>
          <p class="sub">
            <template v-if="totalItems !== null">
              ทั้งหมด {{ totalItems.toLocaleString('th-TH') }} รายการ จากเครื่องสแกนใบหน้า
            </template>
            <template v-else>ข้อมูลการสแกนใบหน้าจากเครื่อง Hikvision</template>
          </p>
        </div>
        <button type="button" class="btn" :disabled="pending" @click="refresh()">
          <svg :class="{ spin: pending }" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" />
          </svg>
          รีเฟรช
        </button>
      </header>

      <!-- Filters -->
      <section class="card filters">
        <div class="chips">
          <span class="chips-label">ช่วงเวลา</span>
          <button
            v-for="r in quickRanges"
            :key="r.key"
            type="button"
            class="chip"
            :class="{ on: activeRange === r.key }"
            :aria-pressed="activeRange === r.key"
            @click="applyRange(r)"
          >
            {{ r.label }}
          </button>
        </div>

        <div class="filter-row">
          <label class="f-search">
            <span class="label">ค้นหา</span>
            <input v-model="keyword" type="search" class="field" placeholder="ชื่อ หรือรหัสพนักงาน" />
          </label>
          <label>
            <span class="label">ตั้งแต่วันที่</span>
            <input v-model="dateFrom" type="date" class="field" :max="dateTo || undefined" />
          </label>
          <label>
            <span class="label">ถึงวันที่</span>
            <input v-model="dateTo" type="date" class="field" :min="dateFrom || undefined" />
          </label>
          <button type="button" class="btn btn-clear" :disabled="!hasFilters" @click="clearFilters">
            ล้างตัวกรอง
          </button>
        </div>
      </section>

      <!-- Error -->
      <section v-if="error" class="card state state-error">
        <p class="state-title">โหลดข้อมูลไม่สำเร็จ</p>
        <p class="state-text">ตรวจสอบว่าเซิร์ฟเวอร์ทำงานอยู่ แล้วลองใหม่อีกครั้ง</p>
        <button type="button" class="btn btn-primary" @click="refresh()">ลองใหม่</button>
      </section>

      <!-- Table -->
      <section v-else class="card table-card">
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th class="c-photo">ภาพ</th>
                <th>พนักงาน</th>
                <th>เวลาที่สแกน</th>
                <th class="c-dev">อุปกรณ์</th>
              </tr>
            </thead>

            <tbody>
              <template v-if="pending && !logs.length">
                <tr v-for="n in 6" :key="`s${n}`">
                  <td class="c-photo"><div class="skeleton" style="width:56px;height:56px" /></td>
                  <td>
                    <div class="skeleton" style="width:140px;height:16px;margin-bottom:8px" />
                    <div class="skeleton" style="width:80px;height:12px" />
                  </td>
                  <td><div class="skeleton" style="width:96px;height:20px" /></td>
                  <td class="c-dev"><div class="skeleton" style="width:110px;height:14px" /></td>
                </tr>
              </template>

              <template v-else>
                <tr v-for="log in logs" :key="log.id" :class="{ dim: pending }">
                  <td class="c-photo">
                    <button
                      v-if="hasPhoto(log)"
                      type="button"
                      class="photo-btn"
                      :aria-label="`ดูรูปของ ${log.name || log.employeeId}`"
                      @click="preview = log"
                    >
                      <img
                        :src="log.pictureUrl"
                        :alt="`ภาพสแกนของ ${log.name || log.employeeId}`"
                        loading="lazy"
                        @error="markBroken(log.id)"
                      />
                    </button>
                    <div v-else class="avatar" title="ไม่มีรูป">{{ initials(log.name) }}</div>
                  </td>

                  <td>
                    <div class="who">{{ log.name || '—' }}</div>
                    <div class="meta">รหัส {{ log.employeeId }}</div>
                  </td>

                  <td class="nowrap">
                    <div class="time">{{ fmtTime(log.scanTime) }}</div>
                    <div class="meta">{{ fmtDate(log.scanTime) }}</div>
                  </td>

                  <td class="c-dev meta">{{ log.deviceIp }}</td>
                </tr>

                <tr v-if="!logs.length" class="empty-row">
                  <td colspan="4">
                    <div class="state">
                      <p class="state-title">
                        {{ hasFilters ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีประวัติการสแกน' }}
                      </p>
                      <p class="state-text">
                        {{ hasFilters ? 'ลองเปลี่ยนคำค้นหาหรือช่วงวันที่' : 'รายการจะแสดงที่นี่เมื่อมีการสแกนใบหน้า' }}
                      </p>
                      <button v-if="hasFilters" type="button" class="btn btn-primary" @click="clearFilters">
                        ล้างตัวกรอง
                      </button>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <footer class="foot">
          <div class="foot-left">
            <label class="size">
              แสดง
              <select v-model.number="size" class="field field-sm">
                <option v-for="s in pageSizes" :key="s" :value="s">{{ s }}</option>
              </select>
              รายการ/หน้า
            </label>
            <span v-if="logs.length" class="meta show-md">รายการที่ {{ firstItem }}–{{ lastItem }}</span>
          </div>

          <nav class="pager" aria-label="เปลี่ยนหน้า">
            <button type="button" class="pg" :disabled="page === 0" aria-label="หน้าแรก" @click="page = 0">«</button>
            <button type="button" class="pg" :disabled="page === 0" @click="page--">ก่อนหน้า</button>
            <button
              v-for="n in pageNumbers"
              :key="n"
              type="button"
              class="pg"
              :class="{ 'pg-on': n === page }"
              :aria-current="n === page ? 'page' : undefined"
              @click="page = n"
            >
              {{ n + 1 }}
            </button>
            <button type="button" class="pg" :disabled="page >= totalPages - 1" @click="page++">ถัดไป</button>
            <button type="button" class="pg" :disabled="page >= totalPages - 1" aria-label="หน้าสุดท้าย" @click="page = totalPages - 1">»</button>
          </nav>
        </footer>
      </section>
    </div>

    <!-- Photo viewer -->
    <div v-if="preview" class="overlay" role="dialog" aria-modal="true" @click.self="preview = null">
      <figure class="viewer">
        <img :src="preview.pictureUrl" :alt="`ภาพสแกนของ ${preview.name}`" />
        <figcaption>
          <div>
            <div class="who">{{ preview.name || preview.employeeId }}</div>
            <div class="meta">
              รหัส {{ preview.employeeId }} · {{ fmtDate(preview.scanTime) }} {{ fmtTime(preview.scanTime) }}
            </div>
          </div>
          <button type="button" class="btn" @click="preview = null">ปิด</button>
        </figcaption>
      </figure>
    </div>
  </div>
</template>

<style scoped>
.page, .page * { box-sizing: border-box; }

.page {
  --ink: #16222e;
  --muted: #5b6b7b;
  --line: #dde3e9;
  --soft: #f7f9fa;
  --accent: #0f766e;
  --accent-dark: #0b5e58;
  --accent-tint: #e3f3f1;

  min-height: 100vh;
  padding: 32px 16px 48px;
  background: #f3f5f7;
  color: var(--ink);
  font-family: 'IBM Plex Sans Thai', system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 15px;
  line-height: 1.5;
}
.wrap { max-width: 1100px; margin: 0 auto; }

/* header */
.head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
h1 { margin: 0; font-size: 1.75rem; font-weight: 600; letter-spacing: -0.01em; }
.sub { margin: 4px 0 0; color: var(--muted); font-size: 0.9rem; }

.card { background: #fff; border: 1px solid var(--line); border-radius: 12px; }

/* buttons & fields */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 40px; padding: 0 16px;
  border: 1px solid #ccd5dd; border-radius: 8px;
  background: #fff; color: var(--ink);
  font: inherit; font-size: 0.875rem; font-weight: 500; cursor: pointer;
}
.btn:hover:not(:disabled) { background: var(--soft); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--accent-dark); }
.btn:focus-visible, .chip:focus-visible, .pg:focus-visible, .photo-btn:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
}

.label { display: block; margin-bottom: 4px; font-size: 0.8125rem; color: var(--muted); }
.field {
  display: block; width: 100%; height: 40px; padding: 0 12px;
  border: 1px solid #ccd5dd; border-radius: 8px; background: #fff;
  font: inherit; font-size: 0.875rem; color: var(--ink);
}
.field:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
.field-sm { display: inline-block; width: auto; height: 32px; padding: 0 8px; }

/* filters */
.filters { padding: 16px; margin-bottom: 16px; display: grid; gap: 14px; }
.chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.chips-label { margin-right: 4px; font-size: 0.8125rem; color: var(--muted); }
.chip {
  height: 32px; padding: 0 14px; border: 1px solid #ccd5dd; border-radius: 999px;
  background: #fff; color: var(--ink); font: inherit; font-size: 0.8125rem; cursor: pointer;
}
.chip:hover { background: var(--soft); }
.chip.on { background: var(--accent-tint); border-color: var(--accent); color: var(--accent-dark); font-weight: 600; }

.filter-row { display: grid; grid-template-columns: minmax(0, 1fr) 170px 170px auto; gap: 12px; align-items: end; }
.btn-clear { height: 40px; }

/* table */
.table-card { overflow: hidden; }
.scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; text-align: left; }
thead th {
  padding: 12px 16px; background: var(--soft); border-bottom: 1px solid var(--line);
  font-size: 0.8125rem; font-weight: 500; color: var(--muted); white-space: nowrap;
}
tbody td { padding: 12px 16px; border-top: 1px solid #eef1f4; vertical-align: middle; }
tbody tr:first-child td { border-top: 0; }
tbody tr:hover:not(.empty-row) { background: var(--soft); }
.dim { opacity: 0.6; }
.c-photo { width: 88px; }
.nowrap { white-space: nowrap; }

.who { font-weight: 500; }
.meta { font-size: 0.8125rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.time { font-size: 1.125rem; font-weight: 600; font-variant-numeric: tabular-nums; }

.photo-btn { display: block; padding: 0; border: 0; background: none; border-radius: 8px; cursor: zoom-in; }
.photo-btn img {
  display: block; width: 56px; height: 56px; object-fit: cover;
  border-radius: 8px; border: 1px solid var(--line);
}
.avatar {
  width: 56px; height: 56px; display: grid; place-items: center;
  border-radius: 8px; background: #e8eef2; color: var(--muted); font-weight: 600; font-size: 1.125rem;
}

/* states */
.state { padding: 48px 24px; text-align: center; }
.state-error { border-color: #e8c4c4; }
.state-error .state-title { color: #9b2c2c; }
.state-title { margin: 0; font-weight: 600; }
.state-text { margin: 4px 0 16px; color: var(--muted); font-size: 0.875rem; }

.skeleton {
  border-radius: 6px;
  background: linear-gradient(90deg, #eef1f4 25%, #e3e8ec 50%, #eef1f4 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer { to { background-position: -200% 0; } }
.spin { animation: rot 0.9s linear infinite; }
@keyframes rot { to { transform: rotate(360deg); } }

/* footer */
.foot {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 16px; border-top: 1px solid var(--line); background: var(--soft);
}
.foot-left { display: flex; align-items: center; gap: 16px; font-size: 0.875rem; color: var(--muted); }
.size { display: flex; align-items: center; gap: 8px; }
.pager { display: flex; flex-wrap: wrap; gap: 4px; }
.pg {
  min-width: 34px; height: 34px; padding: 0 10px; border: 1px solid transparent; border-radius: 6px;
  background: transparent; color: var(--ink); font: inherit; font-size: 0.8125rem;
  font-variant-numeric: tabular-nums; cursor: pointer;
}
.pg:hover:not(:disabled):not(.pg-on) { background: #e8eef2; }
.pg:disabled { opacity: 0.4; cursor: not-allowed; }
.pg-on { background: var(--accent); color: #fff; font-weight: 600; }

/* photo viewer */
.overlay {
  position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 16px;
  background: rgba(22, 34, 46, 0.72);
}
.viewer { margin: 0; width: 100%; max-width: 460px; overflow: hidden; border-radius: 12px; background: #fff; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3); }
.viewer img { display: block; width: 100%; max-height: 70vh; object-fit: contain; background: #e8eef2; }
.viewer figcaption { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 16px; }

/* responsive */
.show-md { display: none; }
@media (min-width: 900px) { .show-md { display: inline; } }
@media (max-width: 760px) {
  .filter-row { grid-template-columns: 1fr 1fr; }
  .f-search, .btn-clear { grid-column: 1 / -1; }
}
@media (max-width: 600px) {
  .page { padding: 20px 12px 32px; }
  .c-dev { display: none; }
  .c-photo { width: 72px; }
  tbody td, thead th { padding-left: 12px; padding-right: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton, .spin { animation: none; }
}
</style>

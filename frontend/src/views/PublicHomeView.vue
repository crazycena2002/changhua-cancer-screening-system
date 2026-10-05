<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import PublicNavigation from "@/components/PublicNavigation.vue";
import PublicFooter from "@/components/PublicFooter.vue";

import PublicIcon from "@/components/PublicIcon.vue";

const router = useRouter();
const heroSection = ref(null);
const desktopHeroImage = ref(null);
const mobileHeroFrame = ref(null);
const mobileHeroImage = ref(null);
let parallaxFrame = 0;

function updateParallax() {
  parallaxFrame = 0;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.matchMedia("(max-width: 1023px)").matches;
  const frame = mobile ? mobileHeroFrame.value : heroSection.value;
  const image = mobile ? mobileHeroImage.value : desktopHeroImage.value;

  if (!frame || !image) return;
  if (reduceMotion) {
    image.style.setProperty("--parallax-y", "0px");
    return;
  }

  const bounds = frame.getBoundingClientRect();
  if (bounds.bottom < 0 || bounds.top > window.innerHeight) return;

  const distanceFromCenter = window.innerHeight / 2 - (bounds.top + bounds.height / 2);
  const limit = mobile ? 18 : 36;
  const offset = Math.max(-limit, Math.min(limit, distanceFromCenter * 0.1));
  image.style.setProperty("--parallax-y", `${offset}px`);
}

function queueParallax() {
  if (!parallaxFrame) parallaxFrame = window.requestAnimationFrame(updateParallax);
}

onMounted(() => {
  window.addEventListener("scroll", queueParallax, { passive: true });
  window.addEventListener("resize", queueParallax);
  queueParallax();
});

onUnmounted(() => {
  window.removeEventListener("scroll", queueParallax);
  window.removeEventListener("resize", queueParallax);
  window.cancelAnimationFrame(parallaxFrame);
});

function navigate(path) {
  router.push(path);
}

</script>

<template>
  <div class="public-home natural-surface flex min-h-screen flex-col bg-[#f8f6f0] text-[#2f493a]">
    <PublicNavigation />

    <main id="top" class="flex-1">
      <section ref="heroSection" class="relative overflow-hidden bg-[#eeeee3]">
        <div ref="mobileHeroFrame" class="h-[180px] overflow-hidden min-[390px]:h-[200px] sm:h-[260px] lg:hidden">
          <img
            ref="mobileHeroImage"
            src="/images/screening-banner.png"
            alt="護理人員向民眾說明癌症篩檢"
            class="hero-parallax-image h-full w-full object-cover object-right"
          />
        </div>
        <img
          ref="desktopHeroImage"
          src="/images/screening-banner.png"
          alt=""
          class="hero-parallax-image absolute inset-0 hidden h-full w-full object-cover object-center lg:block"
        />
        <div class="hero-overlay absolute inset-0 hidden lg:block"></div>
        <div
          class="relative z-10 mx-auto max-w-7xl px-5 py-8 sm:py-12 lg:min-h-[390px] lg:px-8 lg:py-16"
        >
          <h1
            class="max-w-xl text-[2rem] font-normal leading-[1.25] tracking-[-0.03em] text-[#2f493a] sm:text-[2.5rem] lg:text-[3.5rem]"
          >
            <span class="block">彰化縣癌症</span><span class="block">篩檢預約</span>
          </h1>
          <div
            class="mt-5 max-w-xl border-t border-[#b6c3a8] pt-5 sm:mt-7 sm:pt-6"
          >
            <p class="max-w-lg text-base font-normal leading-7 text-[#59695a] sm:text-lg sm:leading-8">
              選擇篩檢服務並完成預約，也可以查詢或取消已建立的預約。
            </p>

          </div>
          <p class="mt-5 max-w-xl text-sm leading-6 text-[#59695a] sm:mt-6 sm:text-base sm:leading-7">
            本機 DEMO：驗證碼顯示在畫面上。請使用測試資料，勿填寫真實個資。
          </p>
        </div>
      </section>

      <section
        aria-label="常用服務"
        class="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10"
      >
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr]">
          <button
            class="service-card bg-[#526c4b] text-left text-white sm:col-span-2 lg:col-span-1"
            @click="navigate('/booking')"
          >
            <PublicIcon name="calendar" class="mb-4 h-8 w-8" /><span class="block pr-8 text-2xl font-normal">我要預約篩檢</span
            ><span class="mt-3 block text-base leading-6 text-[#e7ecdf]"
              >選擇服務、場次與時段</span
            ><span class="absolute right-6 top-6 text-xl" aria-hidden="true"
              >→</span
            >
          </button>
          <button
            class="service-card border border-[#d8ddce] bg-[#fffdf8] text-left"
            @click="navigate('/booking?action=lookup')"
          >
            <PublicIcon name="search" class="mb-4 h-8 w-8" /><span class="block pr-8 text-2xl font-normal">查詢／取消預約</span
            ><span class="mt-3 block text-base leading-6 text-[#59695a]"
              >查看預約內容，或取消已建立的預約</span
            ><span class="absolute right-6 top-6 text-xl" aria-hidden="true"
              >→</span
            >
          </button>
          <button
            class="service-card border border-[#d8ddce] bg-[#fffdf8] text-left"
            @click="navigate('/screening-guide')"
          >
            <PublicIcon name="guide" class="mb-4 h-8 w-8" /><span class="block pr-8 text-2xl font-normal">篩檢須知</span
            ><span class="mt-3 block text-base leading-6 text-[#59695a]"
              >選擇檢查項目，查看準備與提醒</span
            ><span class="absolute right-6 top-6 text-xl" aria-hidden="true"
              >→</span
            >
          </button>
        </div>
      </section>


    </main>
    <PublicFooter />
  </div>
</template>

<style scoped>
.public-home {
  font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif;
}
.public-home button:focus-visible {
  outline: 3px solid #40573c;
  outline-offset: 3px;
}
.public-home ::selection {
  background: #e3ead8;
  color: #2f493a;
}
.hero-overlay {
  background: linear-gradient(90deg, #eeeee3 0%, rgba(238, 238, 227, .97) 28%, rgba(238, 238, 227, .72) 47%, rgba(238, 238, 227, .05) 72%);
}
.hero-parallax-image {
  transform: translate3d(0, var(--parallax-y, 0px), 0) scale(1.2);
  transform-origin: center;
  will-change: transform;
}
@media (prefers-reduced-motion: reduce) {
  .hero-parallax-image {
    transform: none;
    will-change: auto;
  }
}
.service-card {
  position: relative;
  display: block;
  min-height: 148px;
  border-radius: 16px;
  padding: 24px;
}
.service-card:hover {
  box-shadow: 0 4px 14px rgba(47, 73, 58, .09);
}
@media (max-width: 639px) {
  .service-card {
    min-height: 124px;
    padding: 20px;
  }
}
</style>

/* islay.js — Islay guide: Leaflet distillery map */

'use strict';

/* distillery data for the map */
const DISTILLERIES = [
  {
    name: 'Bowmore',
    jp: 'ボウモア',
    lat: 55.7574,
    lng: -6.2874,
    ppm: 25,
    color: '#c8a96e',
    note: '創業1779年 · アイラ最古',
  },
  {
    name: 'Laphroaig',
    jp: 'ラフロイグ',
    lat: 55.6318,
    lng: -6.1548,
    ppm: 43,
    color: '#d4845a',
    note: '創業1815年 · 王室御用達',
  },
  {
    name: 'Ardbeg',
    jp: 'アードベッグ',
    lat: 55.6397,
    lng: -6.0989,
    ppm: 53,
    color: '#e07048',
    note: '創業1815年 · ヘビーピート',
  },
  {
    name: 'Lagavulin',
    jp: 'ラガヴーリン',
    lat: 55.6364,
    lng: -6.1259,
    ppm: 37,
    color: '#c8956e',
    note: '創業1816年 · 長時間蒸留',
  },
  {
    name: 'Port Ellen',
    jp: 'ポートエレン',
    lat: 55.6292,
    lng: -6.1882,
    ppm: 35,
    color: '#9b7ec8',
    note: '創業1825年 · 2023年再開',
  },
  {
    name: 'Caol Ila',
    jp: 'カリラ',
    lat: 55.8326,
    lng: -6.1099,
    ppm: 35,
    color: '#5b9bd5',
    note: '創業1846年 · 最大生産量',
  },
  {
    name: 'Bruichladdich',
    jp: 'ブルックラディー',
    lat: 55.7627,
    lng: -6.3612,
    ppm: 2,
    color: '#5bbfd5',
    note: '創業1881年 · ノンピート主体',
  },
  {
    name: 'Bunnahabhain',
    jp: 'ブナハーブン',
    lat: 55.8748,
    lng: -6.1247,
    ppm: 3,
    color: '#7bc87b',
    note: '創業1881年 · アイラ最北東',
  },
  {
    name: 'Kilchoman',
    jp: 'キルホーマン',
    lat: 55.7880,
    lng: -6.4491,
    ppm: 50,
    color: '#c8a96e',
    note: '創業2005年 · ファームディスティラリー',
  },
  {
    name: 'Ardnahoe',
    jp: 'アードナッホー',
    lat: 55.8584,
    lng: -6.1365,
    ppm: 40,
    color: '#d5855b',
    note: '創業2019年 · ワームタブ式',
  },
  {
    name: 'Laggan Bay',
    jp: 'ラガンベイ',
    lat: 55.6815,
    lng: -6.2530,
    ppm: null,
    color: '#b85c3c',
    note: '2026年蒸留開始 · Ian Macleod · ヘビーピート',
  },
  {
    name: 'Portintruan',
    jp: 'ポートイントルアン',
    lat: 55.6248,
    lng: -6.2041,
    ppm: null,
    color: '#b0b8c8',
    note: '建設中 · Elixir Distillers',
    upcoming: true,
  },
];

/* init leaflet map */
function initMap() {
  const mapEl = document.getElementById('distillery-map');
  if (!mapEl || typeof L === 'undefined') return;

  const map = L.map('distillery-map', {
    center: [55.76, -6.25],
    zoom: 10,
    zoomControl: true,
    attributionControl: true,
  });

  // Light tile layer (CartoDB Positron)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  // Add markers — numbered in Distilleries section order (1–11), Portintruan separate
  DISTILLERIES.forEach((d, i) => {
    const num   = i + 1;
    const label = d.upcoming ? '?' : String(num);

    const markerHtml = d.upcoming
      ? `<div style="
          width:32px;height:32px;border-radius:50%;
          background:#f0f0f4;
          border:2px dashed #b0b8c8;
          display:flex;align-items:center;justify-content:center;
          font-size:13px;font-weight:700;color:#8890a0;
          box-shadow:0 2px 6px rgba(0,0,0,0.12);
          font-family:'Inter',sans-serif;
          opacity:0.85;
        ">${label}</div>`
      : `<div style="
          width:32px;height:32px;border-radius:50%;
          background:${d.color};
          border:2px solid rgba(255,255,255,0.7);
          display:flex;align-items:center;justify-content:center;
          font-size:12px;font-weight:700;color:#1c1814;
          box-shadow:0 2px 8px rgba(0,0,0,0.18);
          font-family:'Inter',sans-serif;
        ">${label}</div>`;

    const icon = L.divIcon({
      html: markerHtml,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -20],
    });

    const ppmText = d.ppm === null
      ? '<small style="color:#999;">Phenol: — (未公表)</small>'
      : `<small>Phenol: <strong style="color:#9a7240;">${d.ppm} ppm</strong></small>`;

    const numBadge = d.upcoming
      ? `<span style="font-size:10px;background:#e8e8f0;color:#8890a0;border-radius:3px;padding:1px 5px;margin-left:4px;">建設中</span>`
      : `<span style="font-size:10px;background:#f2ede4;color:#9a7240;border-radius:3px;padding:1px 5px;margin-left:4px;">#${num}</span>`;

    const marker = L.marker([d.lat, d.lng], { icon }).addTo(map);
    marker.bindPopup(`
      <strong style="color:#1c1814;">${d.name}</strong>${numBadge}
      <span style="color:#6b6358;font-size:12px;margin-left:4px;">${d.jp}</span><br>
      <small style="color:#8a8078;">${d.note}</small><br>
      ${ppmText}
    `, { maxWidth: 220 });
  });
}

/* init */
document.addEventListener('DOMContentLoaded', () => {
  initMap();
});

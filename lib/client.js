window.__ModuleLoader__.load({
  id: 'dsh-usage-statistics',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const { createPortal } = require('react-dom')
    const { useCallback, useEffect, useMemo, useRef, useState } = React
    const h = React.createElement

    const ENDPOINT = '/plugins/dsh-usage-statistics/data'
    const ACTIVATE_ENDPOINT = '/plugins/dsh-usage-statistics/activate-provider'
    const POLL_MS = 20_000

    const CSS = `
.dsh-usage{--u-text:var(--dsw-alias-label-primary,#e8eaed);--u-sub:var(--dsw-alias-label-secondary,rgba(232,234,237,.68));--u-dim:var(--dsw-alias-label-tertiary,rgba(232,234,237,.45));--u-border:var(--dsw-alias-border-l2,rgba(255,255,255,.1));--u-card:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.032));--u-card-2:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.05));--u-accent:#4f9cff;--u-accent-soft:rgba(79,156,255,.14);--u-green:#3ecf8e;--u-warn:#f0b35a;--u-danger:#ff6b6b;display:flex;flex-direction:column;gap:14px;padding:2px 2px 40px;color:var(--u-text);font-size:13px;line-height:1.5;min-width:0;max-width:900px}
.dsh-usage *{box-sizing:border-box}
.dsh-usage h2,.dsh-usage h3,.dsh-usage p{margin:0}
.dsh-usage button{font:inherit;color:inherit}
.u-head{position:relative;z-index:200;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:nowrap}
.u-head > div:first-child{min-width:0;flex:1 1 auto}
.u-title{font-size:20px;line-height:28px;font-weight:650;letter-spacing:-.01em}
.u-sub{margin-top:4px;color:var(--u-sub);font-size:12px}
.u-head-actions{position:relative;z-index:210;display:flex;align-items:center;gap:8px;flex:0 0 auto;flex-wrap:nowrap;white-space:nowrap}
.u-ranges{display:flex;gap:2px;padding:2px;border:1px solid var(--u-border);border-radius:9px;background:var(--u-card)}
.u-range{border:0;background:transparent;border-radius:7px;padding:5px 10px;color:var(--u-sub);cursor:pointer;font-size:12px;white-space:nowrap}
.u-range:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));color:var(--u-text)}
.u-range[aria-pressed="true"]{background:var(--u-accent-soft);color:var(--u-text);box-shadow:inset 0 0 0 1px rgba(79,156,255,.28)}
.u-refresh{width:32px;height:30px;border:1px solid var(--u-border);border-radius:9px;background:var(--u-card);cursor:pointer;color:var(--u-sub);display:grid;place-items:center;font-size:15px}
.u-refresh:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));color:var(--u-text)}
.u-refresh.is-busy{animation:u-spin .9s linear infinite;color:var(--u-accent)}
@keyframes u-spin{to{transform:rotate(360deg)}}
.u-alert{border:1px solid rgba(255,107,107,.35);background:rgba(255,107,107,.08);color:#ffb4b4;border-radius:10px;padding:9px 12px;font-size:12px}
.u-card{background:var(--u-card);border:1px solid var(--u-border);border-radius:14px;padding:16px;min-width:0}
.u-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.u-card-title{font-size:13px;font-weight:600;letter-spacing:.01em}
.u-card-note{color:var(--u-dim);font-size:11px}
.u-balances{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.u-balance{position:relative;background:var(--u-card);border:1px solid var(--u-border);border-radius:14px;padding:14px 15px;min-width:0;overflow:hidden}
.u-balance.is-active{border-color:rgba(79,156,255,.55);box-shadow:0 0 0 1px rgba(79,156,255,.12),0 12px 34px rgba(0,0,0,.22)}
.u-balance.is-active:before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:linear-gradient(180deg,#4f9cff,rgba(79,156,255,.1))}
.u-bal-head{display:flex;align-items:center;gap:7px;min-width:0}
.u-dot{width:7px;height:7px;border-radius:50%;background:var(--u-green);box-shadow:0 0 0 3px rgba(62,207,142,.12);flex:0 0 auto}
.u-dot.is-off{background:var(--u-dim);box-shadow:none}
.u-provider{font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u-badge{font-size:10px;line-height:18px;border-radius:999px;padding:0 7px;background:var(--u-accent-soft);color:#9cc7ff;border:1px solid rgba(79,156,255,.25);white-space:nowrap}
.u-badge.is-muted{background:rgba(255,255,255,.05);color:var(--u-dim);border-color:var(--u-border)}
.u-bal-main{display:flex;align-items:baseline;gap:6px;margin-top:12px}
.u-bal-value{font-size:30px;line-height:36px;font-weight:650;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.u-bal-unit{color:var(--u-sub);font-size:12px}
.u-bal-sub{color:var(--u-sub);font-size:11px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u-bal-message{margin-top:12px;color:var(--u-sub);font-size:12px;word-break:break-word}
.u-windows{display:flex;flex-direction:column;gap:6px;margin-top:12px}
.u-window{display:grid;grid-template-columns:34px minmax(0,1fr) 34px;align-items:center;gap:8px;font-size:11px;color:var(--u-sub)}
.u-window b{font-weight:500;color:var(--u-sub)}
.u-window em{font-style:normal;text-align:right;font-variant-numeric:tabular-nums;color:var(--u-text)}
.u-meter{height:5px;border-radius:999px;background:var(--u-border);overflow:hidden}
.u-meter i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#3f8cff,#63b3ff);transition:width .35s ease}
.u-meter i.is-warn{background:linear-gradient(90deg,#e59b35,#f0b35a)}
.u-meter i.is-danger{background:linear-gradient(90deg,#e05252,#ff6b6b)}
.u-bal-foot{margin-top:10px;padding-top:9px;border-top:1px solid var(--u-border);display:flex;justify-content:space-between;gap:8px;color:var(--u-dim);font-size:10.5px;flex-wrap:wrap}
.u-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.u-stat{background:var(--u-card);border:1px solid var(--u-border);border-radius:12px;padding:12px 13px;min-width:0}
.u-stat-label{color:var(--u-sub);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:4px}.u-info{color:var(--u-dim);font-size:10px;cursor:help;flex:none}
.u-stat-value{margin-top:6px;font-size:23px;line-height:28px;font-weight:650;letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u-stat-sub{margin-top:3px;color:var(--u-dim);font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u-filters{display:flex;align-items:flex-end;flex-wrap:wrap;gap:8px;border:1px solid var(--u-border);background:var(--u-card);border-radius:12px;padding:10px 12px}
.u-filter{display:flex;flex-direction:column;gap:4px;min-width:0;color:var(--u-dim);font-size:10px;flex:1 1 128px}
.u-select{width:100%;height:28px;border:1px solid var(--u-border);border-radius:7px;background:var(--u-card-2);color:var(--u-text);font:inherit;font-size:11px;padding:0 6px;min-width:0;cursor:pointer}
.u-select:focus{outline:none;border-color:rgba(79,156,255,.55);box-shadow:0 0 0 2px var(--u-accent-soft)}
.u-filter-clear{flex:0 0 auto;height:28px;border:1px solid var(--u-border);background:transparent;color:var(--u-sub);border-radius:7px;padding:0 10px;font-size:11px;cursor:pointer;white-space:nowrap}
.u-filter-clear:hover{color:var(--u-text);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.u-card-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;min-width:0}
.u-sorts{display:flex;gap:2px;padding:2px;border:1px solid var(--u-border);border-radius:8px;background:rgba(0,0,0,.12)}
.u-sort{border:0;background:transparent;border-radius:6px;padding:4px 8px;color:var(--u-sub);font-size:10.5px;cursor:pointer;white-space:nowrap}
.u-sort:hover{color:var(--u-text);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.u-sort.is-active{background:var(--u-card-2);color:var(--u-text);box-shadow:0 1px 2px rgba(0,0,0,.18)}
.u-pager{display:flex;align-items:center;justify-content:flex-end;gap:3px;flex-wrap:wrap;padding-top:10px}
.u-page{min-width:26px;height:26px;border:1px solid var(--u-border);background:transparent;border-radius:6px;color:var(--u-sub);cursor:pointer;font-size:11px;padding:0 5px;font-variant-numeric:tabular-nums}
.u-page:hover:not(:disabled){color:var(--u-text);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.u-page:disabled{opacity:.35;cursor:default}
.u-page.is-active{background:var(--u-accent);border-color:var(--u-accent);color:#fff}
.u-page-gap{color:var(--u-dim);padding:0 2px;font-size:10px}
.u-page-info{color:var(--u-dim);font-size:10.5px;margin-left:6px;white-space:nowrap}
.u-chart-body{position:relative;padding-left:44px}
.u-yaxis{position:absolute;left:0;top:8px;bottom:22px;width:36px;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;color:var(--u-dim);font-size:9px;line-height:1;pointer-events:none;font-variant-numeric:tabular-nums}
.u-chart-grid{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:6px;align-items:end;height:170px;padding-top:8px;background:repeating-linear-gradient(to top,var(--u-border) 0 1px,transparent 1px 42px);border-bottom:1px solid var(--u-border)}
.u-bar-col{display:flex;flex-direction:column;align-items:stretch;height:100%;min-width:0}
.u-bar-wrap{flex:1;display:flex;align-items:flex-end;justify-content:center;min-height:0}
.u-bar{width:min(70%,26px);min-height:2px;border-radius:5px 5px 2px 2px;background:linear-gradient(180deg,#6ab6ff,#3f8cff);opacity:.9;transition:height .35s ease,opacity .15s}
.u-bar:hover{opacity:1;background:linear-gradient(180deg,#8cc9ff,#4f9cff)}
.u-bar.is-empty{min-height:0;background:transparent}
.u-bar-label{position:relative;z-index:1;height:22px;padding-top:6px;text-align:center;color:var(--u-dim);font-size:9px;white-space:nowrap;overflow:visible}
.u-tabs{display:flex;gap:2px;padding:2px;border:1px solid var(--u-border);border-radius:8px;background:rgba(0,0,0,.12)}
.u-tab{border:0;background:transparent;border-radius:6px;padding:4px 9px;color:var(--u-sub);font-size:11px;cursor:pointer;white-space:nowrap}
.u-tab:hover{color:var(--u-text);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.u-tab[aria-selected="true"]{background:var(--u-card-2);color:var(--u-text);box-shadow:0 1px 2px rgba(0,0,0,.18)}
.u-ranks{display:flex;flex-direction:column;gap:2px}
.u-rank{display:grid;grid-template-columns:20px minmax(0,1fr) 78px 66px;align-items:center;gap:10px;border:0;background:transparent;border-radius:9px;padding:8px 8px;text-align:left;cursor:pointer;min-width:0}
.u-rank:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.05))}
.u-rank.is-selected{background:var(--u-accent-soft);box-shadow:inset 0 0 0 1px rgba(79,156,255,.2)}
.u-rank-no{color:var(--u-dim);font-size:10px;font-variant-numeric:tabular-nums;text-align:right}
.u-rank-main{min-width:0;display:flex;flex-direction:column;gap:1px}
.u-rank-title{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u-rank-sub{color:var(--u-dim);font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u-rank-bar{height:4px;border-radius:999px;background:var(--u-border);overflow:hidden}
.u-rank-bar i{display:block;height:100%;border-radius:inherit;background:rgba(79,156,255,.7)}
.u-rank-value{text-align:right;font-size:11px;font-variant-numeric:tabular-nums;color:var(--u-sub);white-space:nowrap}
.u-rank-value b{display:block;color:var(--u-text);font-weight:600;font-size:11.5px}
.u-showall{align-self:flex-start;margin-top:6px;border:0;background:transparent;color:var(--u-accent);font-size:11px;cursor:pointer;padding:4px 8px;border-radius:6px}
.u-showall:hover{background:var(--u-accent-soft)}
.u-table{display:flex;flex-direction:column;min-width:0}
.u-tr{display:grid;grid-template-columns:74px minmax(0,1.5fr) minmax(0,1.1fr) 50px 50px 50px 58px;gap:8px;align-items:center;padding:7px 4px;border-bottom:1px solid var(--u-border);min-width:0;font-variant-numeric:tabular-nums}
.u-tr:last-child{border-bottom:0}
.u-th{color:var(--u-dim);font-size:10px;padding-top:0;padding-bottom:6px;border-bottom:1px solid var(--u-border)}
.u-td{font-size:11px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u-td.num{text-align:right;color:var(--u-sub)}
.u-td.time{color:var(--u-dim);font-size:10.5px}
.u-td.session{color:var(--u-text)}
.u-source-tag{display:inline-block;max-width:72px;overflow:hidden;text-overflow:ellipsis;vertical-align:1px;margin-right:5px;padding:1px 4px;border:1px solid rgba(233,180,95,.32);border-radius:4px;color:#e9b45f;font-size:8.5px;font-style:normal;white-space:nowrap}
.u-td.model{display:flex;flex-direction:column;gap:0;line-height:15px}
.u-td.model b{font-weight:500;font-size:11px;overflow:hidden;text-overflow:ellipsis}
.u-td.model span{font-size:9.5px;color:var(--u-dim)}
.u-session-chip{display:inline-flex;align-items:center;gap:6px;max-width:100%;border:1px solid rgba(79,156,255,.3);background:var(--u-accent-soft);color:#b8d8ff;border-radius:999px;padding:2px 4px 2px 9px;font-size:10.5px}
.u-session-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px}
.u-session-chip button{border:0;background:transparent;color:inherit;cursor:pointer;font-size:13px;line-height:1;padding:0 4px;border-radius:50%}
.u-session-chip button:hover{background:rgba(255,255,255,.1)}
.u-empty{padding:26px 8px;text-align:center;color:var(--u-dim);font-size:12px}
.u-loading{display:flex;flex-direction:column;gap:12px}
.u-skeleton{height:86px;border-radius:14px;background:linear-gradient(90deg,rgba(255,255,255,.045),rgba(255,255,255,.09),rgba(255,255,255,.045));background-size:200% 100%;animation:u-shimmer 1.4s ease infinite}
.u-skeleton.tall{height:190px}
@keyframes u-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.u-foot{color:var(--u-dim);font-size:10.5px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:0 2px}
@media (max-width:720px){.u-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.u-balances{grid-template-columns:1fr}.u-tr{grid-template-columns:62px minmax(0,1.2fr) minmax(0,1fr) 42px 42px 44px 46px;gap:6px}.u-rank{grid-template-columns:18px minmax(0,1fr) 60px 58px}.u-head-actions{flex:0 0 auto}.u-source-trigger{max-width:34px;padding:0 6px}.u-source-trigger .u-trigger-label{display:none}}
@media (max-width:520px){.u-stats{grid-template-columns:1fr 1fr}.u-tr{grid-template-columns:54px minmax(0,1fr) minmax(0,.9fr) 38px 38px 44px;gap:5px}.u-tr .u-col-output{display:none}.u-bal-value{font-size:26px}.u-card-tools{width:100%;justify-content:flex-start}}
/* 0.3.0: text menus, compact pager, range picker, chart metrics */
.u-head-actions{gap:6px}
.u-range-wrap{position:relative}
.u-range-trigger{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 9px;border:0;border-radius:8px;background:transparent;color:var(--u-sub);font-size:12px;cursor:pointer;white-space:nowrap}
.u-range-trigger:hover,.u-range-trigger.is-open{color:var(--u-text);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.u-range-trigger:focus-visible,.u-trigger:focus-visible,.u-sync:focus-visible,.u-chart-tab:focus-visible,.u-page-arrow:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--u-accent));outline-offset:1px}
.u-sync{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border:1px solid var(--u-border);border-radius:8px;background:transparent;color:var(--u-sub);font-size:11px;cursor:pointer;white-space:nowrap}
.u-sync:hover{color:var(--u-text);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.u-sync-icon{font-size:14px;line-height:1;display:inline-block}
.u-sync.is-busy .u-sync-icon{animation:u-spin .9s linear infinite}
@keyframes u-spin{to{transform:rotate(360deg)}}
.u-filters{display:flex;align-items:center;flex-wrap:nowrap;gap:2px;border:0;background:transparent;padding:0 0 2px;min-width:0;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;scrollbar-width:none;-ms-overflow-style:none}.u-filters::-webkit-scrollbar{display:none}.u-filters.is-menu-open{overflow:visible}
.u-filters > .u-menu-wrap{flex:0 0 auto}
.u-filters > .u-search{flex:1 0 180px;min-width:180px}
.u-menu-wrap{position:relative;min-width:0;flex:0 1 auto}
.u-trigger{display:inline-flex;align-items:center;gap:5px;height:32px;max-width:132px;padding:0 7px;border:0;border-radius:8px;background:transparent;color:var(--u-sub);font-size:11px;cursor:pointer;white-space:nowrap;min-width:0}
.u-trigger:hover,.u-trigger.is-open{color:var(--u-text);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.u-trigger-label{min-width:0;overflow:hidden;text-overflow:ellipsis}
.u-trigger-chevron{display:inline-flex;color:var(--u-dim);flex:none}
.u-menu-pop{position:absolute;top:calc(100% + 6px);left:0;z-index:70;display:flex;flex-direction:column;gap:1px;padding:4px;border:1px solid var(--u-border);border-radius:10px;background:var(--dsw-alias-bg-layer-2,#24262b);box-shadow:0 12px 32px rgba(0,0,0,.32);max-height:320px;overflow:auto}
.u-menu-pop.is-right{left:auto;right:0}
.u-menu-item{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:30px;padding:5px 8px;border:0;border-radius:7px;background:transparent;color:var(--u-sub);font-size:11.5px;text-align:left;cursor:pointer}
.u-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));color:var(--u-text)}
.u-menu-item.is-active{color:var(--u-text);background:var(--dsw-alias-button-ghost-active-fill,rgba(255,255,255,.07))}
.u-menu-item-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.u-menu-check{display:inline-flex;color:var(--u-accent);flex:none}
.u-source-wrap{flex:none}
.u-source-trigger{max-width:154px}
.u-source-pop{min-width:264px;padding:6px;gap:2px;z-index:1000}
.u-source-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:5px 7px 7px;border-bottom:1px solid var(--u-border);margin-bottom:3px}
.u-source-head b{font-size:11px;color:var(--u-text);font-weight:600}
.u-source-head span{font-size:9.5px;color:var(--u-dim)}
.u-source-list{display:flex;flex-direction:column;gap:1px}
.u-source-row{display:flex;align-items:center;gap:8px;width:100%;min-height:36px;padding:5px 7px;border:0;border-radius:7px;background:transparent;color:var(--u-sub);text-align:left;cursor:pointer}
.u-source-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.u-source-row.is-on{color:var(--u-text)}
.u-source-check{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;flex:none;border:1px solid var(--u-border);border-radius:4px;color:var(--u-accent)}
.u-source-row.is-on .u-source-check{border-color:rgba(87,211,154,.55);background:rgba(87,211,154,.12)}
.u-source-copy{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.u-source-name{font-size:11px;color:inherit;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.u-source-kind{font-size:9px;color:var(--u-dim)}
.u-source-count{font-size:9px;color:var(--u-dim);font-variant-numeric:tabular-nums;flex:none}
.u-source-foot{display:flex;align-items:center;gap:6px;padding:6px 3px 2px;border-top:1px solid var(--u-border);margin-top:3px}
.u-source-action{height:24px;padding:0 7px;border:0;border-radius:6px;background:transparent;color:var(--u-dim);font-size:10px;cursor:pointer}
.u-source-action:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));color:var(--u-text)}
.u-source-note{padding:4px 7px 2px;color:var(--u-dim);font-size:9px}
.u-search{display:flex;align-items:center;gap:5px;height:30px;flex:1 1 150px;min-width:110px;border-bottom:1px solid transparent;color:var(--u-dim);transition:border-color .15s}
.u-search:focus-within{border-bottom-color:rgba(79,156,255,.55)}
.u-search-icon{display:inline-flex;flex:none}
.u-search-input{min-width:0;width:100%;border:0;background:transparent;color:var(--u-text);font:inherit;font-size:11px;outline:none}
.u-search-input::placeholder{color:var(--u-dim)}
.u-search-clear{flex:none;width:20px;height:20px;border:0;border-radius:50%;background:transparent;color:var(--u-dim);cursor:pointer;font-size:13px;line-height:1}
.u-search-clear:hover{color:var(--u-text);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.u-filter-clear{flex:none;width:26px;height:28px;border:0;border-radius:7px;background:transparent;color:var(--u-dim);font-size:15px;line-height:1;cursor:pointer}
.u-filter-clear:hover{color:var(--u-text);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.u-card-title-wrap{display:flex;align-items:baseline;gap:8px;min-width:0;flex-wrap:wrap}
.u-card-tools{flex-wrap:nowrap;gap:6px;justify-content:flex-end}
.u-card-tools .u-menu-wrap{flex:none}
.u-chart-tabs{display:flex;align-items:center;gap:12px;flex:none}
.u-chart-tab{border:0;border-bottom:1px solid transparent;background:transparent;color:var(--u-dim);font-size:11px;padding:4px 1px;cursor:pointer}
.u-chart-tab:hover{color:var(--u-text)}
.u-chart-tab.is-active{color:var(--u-text);border-bottom-color:var(--u-accent)}
.u-bar-requests{background:linear-gradient(180deg,#6fe0ae,#35b97e)}
.u-bar-requests:hover{background:linear-gradient(180deg,#8cecc0,#43c98d)}
.u-bar-cost{background:linear-gradient(180deg,#f1bd6d,#d9952f)}
.u-bar-cost:hover{background:linear-gradient(180deg,#f7cd87,#e3a542)}
.u-pager{display:flex;align-items:center;justify-content:flex-end;gap:1px;padding-top:10px;flex-wrap:nowrap}
.u-page-arrow{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;border-radius:7px;background:transparent;color:var(--u-sub);cursor:pointer}
.u-page-arrow:hover:not(:disabled){color:var(--u-text);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.u-page-arrow:disabled{opacity:.35;cursor:default}
.u-page-jump{display:inline-flex;align-items:center;gap:4px;margin:0 5px;color:var(--u-dim);font-size:11px;white-space:nowrap}
.u-page-input{width:34px;height:24px;border:0;border-bottom:1px solid transparent;background:transparent;color:var(--u-text);font:inherit;font-size:11px;text-align:center;outline:none;font-variant-numeric:tabular-nums}
.u-page-input:focus{border-bottom-color:var(--u-accent)}
.u-page-prefix,.u-page-total{color:var(--u-dim);white-space:nowrap}
.u-range-pop{position:absolute;right:0;top:calc(100% + 8px);z-index:1000;max-height:calc(100vh - 24px);overflow:auto;display:grid;grid-template-columns:104px minmax(0,1fr) 220px;grid-template-rows:auto auto;gap:10px 12px;width:min(566px,calc(100vw - 24px));padding:12px;border:1px solid var(--u-border);border-radius:12px;background:var(--dsw-alias-bg-layer-2,#24262b);box-shadow:0 18px 48px rgba(0,0,0,.4)}
.u-range-heading{color:var(--u-dim);font-size:10px;margin:0 0 6px 2px}
.u-range-presets{grid-row:1 / 3;display:flex;flex-direction:column;gap:1px;border-right:1px solid var(--u-border);padding-right:8px;min-width:0}
.u-range-preset{height:28px;border:0;border-radius:7px;background:transparent;color:var(--u-sub);font-size:11px;text-align:left;padding:0 8px;cursor:pointer;white-space:nowrap}
.u-range-preset:hover{color:var(--u-text);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.u-range-preset.is-active{color:var(--u-text);background:var(--dsw-alias-button-ghost-active-fill,rgba(255,255,255,.07));box-shadow:inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border,var(--u-border))}
.u-range-custom{min-width:0}
.u-range-fields{display:flex;flex-direction:column;gap:6px}
.u-range-field{display:flex;flex-direction:column;gap:3px;padding:5px 7px;border:1px solid transparent;border-radius:8px;background:var(--u-card);cursor:text}
.u-range-field.is-active{border-color:rgba(79,156,255,.35);background:var(--u-accent-soft)}
.u-range-label{color:var(--u-dim);font-size:9.5px}
.u-range-inputs{display:flex;align-items:center;gap:6px;min-width:0}
.u-range-date{min-width:0;width:100%;border:0;background:transparent;color:var(--u-text);font:inherit;font-size:11px;outline:none;font-variant-numeric:tabular-nums}
.u-range-time{width:58px;flex:none;border:0;background:transparent;color:var(--u-sub);font:inherit;font-size:11px;outline:none;color-scheme:dark}
.u-range-check{display:flex;align-items:center;gap:6px;margin-top:8px;color:var(--u-sub);font-size:10.5px;cursor:pointer}
.u-range-check input{accent-color:var(--u-accent)}
.u-range-error{margin-top:5px;color:var(--u-danger);font-size:10px}
.u-range-calendar{min-width:0;display:flex;justify-content:flex-end}
.u-calendar{width:220px;display:flex;flex-direction:column;gap:4px;padding:4px;border:1px solid var(--u-border);border-radius:10px;background:var(--u-card)}
.u-calendar-head{display:flex;align-items:center;justify-content:space-between;gap:4px}
.u-calendar-title{flex:1;text-align:center;color:var(--u-text);font-size:12px;line-height:1.6}
.u-calendar-nav{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:0;border-radius:7px;background:transparent;color:var(--u-sub);cursor:pointer}
.u-calendar-nav:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));color:var(--u-text)}
.u-calendar-week,.u-calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.u-calendar-weekday{height:22px;display:flex;align-items:center;justify-content:center;color:var(--u-dim);font-size:10px}
.u-calendar-cell,.u-calendar-blank{height:28px;display:flex;align-items:center;justify-content:center;border:0;border-radius:7px;background:transparent;color:var(--u-text);font:inherit;font-size:11px;font-variant-numeric:tabular-nums}
.u-calendar-cell{cursor:pointer}
.u-calendar-cell:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.u-calendar-cell.is-today{box-shadow:inset 0 0 0 .5px var(--u-border)}
.u-calendar-cell.is-selected{background:var(--dsw-alias-button-ghost-active-fill,rgba(255,255,255,.08));box-shadow:inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border,var(--u-border))}
.u-range-actions{grid-column:2 / 4;display:flex;justify-content:flex-end;gap:8px;padding-top:10px;border-top:1px solid var(--u-border)}
.u-range-cancel,.u-range-confirm{height:30px;padding:0 16px;border-radius:8px;font-size:11px;cursor:pointer}
.u-range-cancel{border:1px solid var(--u-border);background:transparent;color:var(--u-sub)}
.u-range-cancel:hover{color:var(--u-text);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.u-range-confirm{border:1px solid #e8751f;background:#e8751f;color:#fff}
.u-range-confirm:hover{background:#f0802b}
.u-forecast-summary{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:2px 2px 0}
.u-forecast-item{display:flex;flex-direction:column;gap:1px;min-width:0}
.u-forecast-label{color:var(--u-dim);font-size:10px}
.u-forecast-item b{font-size:20px;line-height:26px;font-weight:650;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.u-forecast-item b.is-warn{color:var(--u-warn)}
.u-forecast-arrow{color:var(--u-dim);font-size:14px}
.u-forecast-meta{margin-left:auto;display:flex;gap:12px;color:var(--u-dim);font-size:10.5px;flex-wrap:wrap}
.u-forecast-meta .is-warn{color:var(--u-warn)}
.u-forecast-chart{display:block;width:100%;height:auto;margin-top:4px;overflow:visible}
.u-forecast-wrap{position:relative}
.u-forecast-tip{position:absolute;z-index:5;transform:translate(-50%,-100%);margin-top:-20px;min-width:132px;padding:8px 10px;border:1px solid var(--u-border);border-radius:9px;background:var(--dsw-alias-bg-layer-2,#24262b);box-shadow:0 10px 28px rgba(0,0,0,.38);pointer-events:none;color:var(--u-text);font-size:10.5px}
.u-forecast-tip.is-below{transform:translate(-50%,0);margin-top:12px}
.u-tip-date{color:var(--u-sub);font-size:10px;margin-bottom:4px}
.u-tip-row{display:flex;align-items:baseline;justify-content:space-between;gap:18px;line-height:18px}
.u-tip-row span{color:var(--u-dim)}
.u-tip-row b{font-weight:600;font-variant-numeric:tabular-nums}
.u-forecast-axis{fill:var(--u-dim);font-size:9px;font-variant-numeric:tabular-nums}
.u-forecast-limit{fill:var(--u-dim);font-size:9px}
.u-forecast-axis.is-active{fill:var(--u-text);font-weight:600}
.u-forecast-legend{display:flex;align-items:center;gap:14px;flex-wrap:wrap;color:var(--u-dim);font-size:10px;margin-top:2px}
.u-forecast-legend i{display:inline-block;width:12px;height:2px;margin-right:4px;vertical-align:middle;border-radius:2px}
.u-legend-usage{background:#57d39a}
.u-legend-forecast{background:#e9b45f}
.u-legend-limit{background:rgba(232,234,237,.42)}
.u-forecast-note{margin-left:auto}@media (max-width:640px){.u-range-pop{left:0;right:auto;grid-template-columns:1fr;grid-template-rows:auto auto auto auto;width:min(420px,calc(100vw - 24px))}.u-range-presets{grid-row:auto;flex-direction:row;flex-wrap:wrap;border-right:0;border-bottom:1px solid var(--u-border);padding:0 0 8px}.u-range-calendar{justify-content:flex-start}.u-calendar{width:100%;max-width:260px}.u-range-actions{grid-column:1}.u-filters{flex-wrap:wrap}.u-trigger{max-width:150px}}

/* 0.4.3: clone-based cyclic filter strip and provider carousel */
.u-filters{display:flex;align-items:center;flex-wrap:nowrap;gap:6px;border:0;background:transparent;padding:0;min-width:0;overflow:visible}
.u-filter-scroll{display:flex;align-items:center;flex:1 1 auto;min-width:0;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;scrollbar-width:none;-ms-overflow-style:none;padding:0 0 2px}
.u-filter-scroll::-webkit-scrollbar{display:none}
.u-filter-scroll.is-menu-open{overflow:visible}
.u-filter-track{display:flex;align-items:center;gap:2px;width:max-content;min-width:max-content}
.u-filter-set{display:flex;align-items:center;justify-content:space-between;gap:2px;flex:0 0 auto}
.u-filter-set .u-menu-wrap{flex:0 1 auto;min-width:0}
.u-filter-set .u-trigger{max-width:150px}
.u-filter-tools{display:flex;align-items:center;gap:3px;flex:0 0 auto;min-width:0}
.u-filter-tools .u-search{flex:0 1 190px;min-width:110px}
@media (max-width:640px){.u-filters{flex-wrap:nowrap}.u-filter-tools .u-search{flex:0 1 150px;min-width:96px}}
@media (max-width:460px){.u-filter-tools .u-search{flex:0 1 110px;min-width:80px}.u-filter-tools .u-search-input::placeholder{color:transparent}}
.u-provider-carousel{display:flex;flex-direction:column;gap:8px;min-width:0}
.u-provider-viewport{overflow:hidden;min-width:0;border-radius:14px}
.u-provider-track{display:flex;align-items:stretch;will-change:transform}
.u-provider-page{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;flex:0 0 100%;min-width:100%;align-items:stretch}
.u-balance-slot{display:flex;min-width:0;border-radius:14px;outline:none}
.u-balance-slot .u-balance{flex:1;min-width:0;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
.u-balance-slot:not(.is-active){cursor:pointer}
.u-balance-slot:not(.is-active):hover .u-balance{transform:translateY(-1px);border-color:rgba(79,156,255,.36)}
.u-balance-slot:not(.is-active):focus-visible .u-balance{border-color:rgba(79,156,255,.6);box-shadow:0 0 0 2px rgba(79,156,255,.2)}
.u-balance-slot.is-active{cursor:default}
.u-balance-slot.is-busy{opacity:.62;pointer-events:none}
.u-balance-add-slot{border:1px dashed var(--u-border);background:rgba(255,255,255,.012);color:var(--u-sub);cursor:pointer;align-items:center;justify-content:center;font:inherit;transition:border-color .18s,background .18s,color .18s}
.u-balance-add-slot:hover{border-color:rgba(79,156,255,.5);background:rgba(79,156,255,.06);color:var(--u-text)}
.u-balance-add{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:22px 14px;border:0;background:transparent;box-shadow:none}
.u-bal-add-plus{display:grid;place-items:center;width:32px;height:32px;border:1px dashed rgba(129,133,140,.5);border-radius:50%;font-size:20px;line-height:1;color:var(--u-sub)}
.u-bal-add-title{font-size:12px;font-weight:600;color:var(--u-text)}
.u-bal-add-sub{font-size:10px;color:var(--u-dim)}
.u-provider-dots{display:flex;align-items:center;justify-content:center;gap:5px;height:10px}
.u-provider-dot{width:5px;height:5px;padding:0;border:0;border-radius:999px;background:rgba(232,234,237,.24);cursor:pointer;transition:width .18s ease,background .18s ease}
.u-provider-dot.is-active{width:14px;background:var(--u-accent)}

`

    function cssHash(text) {
      let hash = 5381
      for (let index = 0; index < text.length; index += 1) hash = ((hash * 33) ^ text.charCodeAt(index)) >>> 0
      return hash.toString(36)
    }

    function ensureCss() {
      if (typeof document === 'undefined') return
      const version = cssHash(CSS)
      const existing = document.querySelector('style[data-dsh-usage-statistics]')
      if (existing !== null) {
        if (existing.dataset.version !== version) {
          existing.textContent = CSS
          existing.dataset.version = version
        }
        return
      }
      const tag = document.createElement('style')
      tag.dataset.dshUsageStatistics = '1'
      tag.dataset.version = version
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /* ------------------------------------------------------------------ *
     * formatting
     * ------------------------------------------------------------------ */

    function compact(value) {
      const n = Number(value) || 0
      if (n >= 1e9) return trim(n / 1e9) + 'B'
      if (n >= 1e6) return trim(n / 1e6) + 'M'
      if (n >= 1e3) return trim(n / 1e3) + 'K'
      return String(Math.round(n))
    }

    function axisValue(value) {
      const n = Number(value) || 0
      if (n >= 1e8) return axisTrim(n / 1e8) + '亿'
      if (n >= 1e6) return axisTrim(n / 1e6) + 'M'
      if (n >= 1e3) return axisTrim(n / 1e3) + 'K'
      return String(Math.round(n))
    }

    function axisTrim(n) {
      return (n >= 10 ? n.toFixed(0) : n.toFixed(1)).replace(/\.0$/, '')
    }

    function trim(n) {
      return n >= 100 ? String(Math.round(n)) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
    }

    function num(value) {
      return (Number(value) || 0).toLocaleString('zh-CN')
    }

    function pct(value, digits = 1) {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
      return (Number(value) * 100).toFixed(digits).replace(/\.0$/, '') + '%'
    }

    function usedPct(value) {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return null
      return Math.max(0, Math.min(100, Number(value)))
    }

    function money(value, currency = 'CNY') {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
      const symbol = currency === 'USD' ? '$' : currency === 'CNY' ? '¥' : ''
      const n = Number(value)
      const digits = n !== 0 && Math.abs(n) < 0.01 ? 4 : 2
      return symbol + (Math.abs(n) >= 1000 ? num(n) : n.toFixed(digits))
    }

    function costParts(counters) {
      if (!counters) return []
      const sortCurrencies = (entries) => entries.sort((left, right) => {
        if (left[0] === right[0]) return 0
        if (left[0] === 'USD') return -1
        if (right[0] === 'USD') return 1
        return left[0].localeCompare(right[0])
      })
      if (counters.costs !== null && typeof counters.costs === 'object') {
        const entries = Object.entries(counters.costs)
        if (entries.length > 0) return sortCurrencies(entries)
      }
      if (typeof counters.cost === 'number') return [[counters.currency || 'USD', counters.cost]]
      return []
    }

    function costText(counters) {
      const parts = costParts(counters)
      if (parts.length === 0) return counters?.requests === 0 ? '—' : '未定价'
      return parts.map(([currency, value]) => money(value, currency)).join(' + ')
    }

    function timeOf(value) {
      const date = new Date(Number(value))
      if (Number.isNaN(date.getTime())) return '—'
      const two = (n) => String(n).padStart(2, '0')
      return `${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`
    }

    function clockOf(value) {
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return '—'
      const two = (n) => String(n).padStart(2, '0')
      return `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`
    }

    function dayLabel(key) {
      const parts = String(key).split('-')
      return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : key
    }

    function relative(value) {
      const at = Number(value)
      if (!Number.isFinite(at) || at <= 0) return '—'
      const diff = Date.now() - at
      if (diff < 60_000) return '刚刚'
      const mins = Math.floor(diff / 60_000)
      if (mins < 60) return `${mins} 分钟前`
      const hours = Math.floor(mins / 60)
      if (hours < 24) return `${hours} 小时前`
      const days = Math.floor(hours / 24)
      if (days < 30) return `${days} 天前`
      return timeOf(at).slice(0, 5)
    }

    function countdown(iso) {
      const at = Date.parse(iso)
      if (Number.isNaN(at)) return '—'
      const diff = at - Date.now()
      if (diff <= 0) return '即将重置'
      const mins = Math.floor(diff / 60_000)
      if (mins < 60) return `${Math.max(1, mins)} 分钟后`
      const hours = Math.floor(mins / 60)
      if (hours < 24) return `${hours} 小时 ${mins % 60} 分后`
      const days = Math.floor(hours / 24)
      return `${days} 天 ${hours % 24} 小时后`
    }

    function providerLabel(provider) {
      const value = String(provider || '')
      if (value.includes('opencode')) return 'OpenCode Go'
      if (value.includes('deepseek')) return 'DeepSeek'
      return value || '未知供应商'
    }

    function statusText(status) {
      switch (status) {
        case 'ok': return '正常'
        case 'warning': return '接近上限'
        case 'exhausted': return '已用尽'
        case 'limited': return '已限流'
        default: return status || '未知'
      }
    }

    /* ------------------------------------------------------------------ *
     * icons and menus
     * ------------------------------------------------------------------ */

    function Svg({ size = 14, viewBox = '0 0 16 16', children, className = '' }) {
      return h('svg', {
        className,
        width: size,
        height: size,
        viewBox,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
      }, children)
    }

    function IconChevronDown({ size = 10 }) {
      return h(Svg, { size }, h('path', { d: 'M3.5 6 8 10.5 12.5 6' }))
    }

    function IconChevronLeft({ size = 14 }) {
      return h(Svg, { size }, h('path', { d: 'M10 3.5 5.5 8 10 12.5' }))
    }

    function IconChevronRight({ size = 14 }) {
      return h(Svg, { size }, h('path', { d: 'M6 3.5 10.5 8 6 12.5' }))
    }

    function IconChevronsLeft({ size = 14 }) {
      return h(Svg, { size }, h('path', { d: 'M7.5 3.5 3 8l4.5 4.5M13 3.5 8.5 8l4.5 4.5' }))
    }

    function IconChevronsRight({ size = 14 }) {
      return h(Svg, { size }, h('path', { d: 'M8.5 3.5 13 8l-4.5 4.5M3 3.5 7.5 8 3 12.5' }))
    }

    function IconSliders({ size = 14 }) {
      return h(Svg, { size },
        h('path', { d: 'M2.5 4.5h11M2.5 11.5h11' }),
        h('circle', { cx: 6, cy: 4.5, r: 1.6, fill: 'currentColor', stroke: 'none' }),
        h('circle', { cx: 10.5, cy: 11.5, r: 1.6, fill: 'currentColor', stroke: 'none' }),
      )
    }

    function IconSearch({ size = 13 }) {
      return h(Svg, { size }, h('circle', { cx: 7, cy: 7, r: 4.2 }), h('path', { d: 'm10.2 10.2 3 3' }))
    }

    function IconStack({ size = 14 }) {
      return h(Svg, { size },
        h('path', { d: 'm8 2.8 5.5 3L8 8.8l-5.5-3z' }),
        h('path', { d: 'm2.5 8.3 5.5 3 5.5-3M2.5 11.2l5.5 3 5.5-3' }),
      )
    }

    function IconCalendar({ size = 14 }) {
      return h(Svg, { size },
        h('rect', { x: 2.5, y: 3.5, width: 11, height: 10, rx: 2 }),
        h('path', { d: 'M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2' }),
      )
    }

    function IconCheck({ size = 12 }) {
      return h(Svg, { size }, h('path', { d: 'm3 8.5 3 3 7-7' }))
    }

    function Menu({ label, value, options, onChange, icon = null, align = 'left', minWidth = 170, className = '', ariaLabel = '', onOpenChange }) {
      const [open, setOpen] = useState(false)
      const rootRef = useRef(null)
      const changeOpen = (next) => {
        setOpen(next)
        onOpenChange?.(next)
      }
      useEffect(() => {
        if (!open) return undefined
        const onPointer = (event) => {
          if (rootRef.current !== null && !rootRef.current.contains(event.target)) changeOpen(false)
        }
        const onKey = (event) => {
          if (event.key === 'Escape') changeOpen(false)
        }
        document.addEventListener('pointerdown', onPointer)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('pointerdown', onPointer)
          document.removeEventListener('keydown', onKey)
        }
      }, [open])
      const active = options.find((option) => option.value === value)
      return h('div', { className: `u-menu-wrap ${className}`.trim(), ref: rootRef },
        h('button', {
          type: 'button',
          className: 'u-trigger' + (open ? ' is-open' : ''),
          onClick: () => changeOpen(!open),
          'aria-haspopup': 'listbox',
          'aria-expanded': open,
          'aria-label': ariaLabel || label || '选择',
          title: active?.title || label,
        },
          icon,
          label === null ? null : h('span', { className: 'u-trigger-label' }, label),
          h('span', { className: 'u-trigger-chevron' }, h(IconChevronDown, { size: 10 })),
        ),
        open
          ? h('div', {
            className: 'u-menu-pop' + (align === 'right' ? ' is-right' : ''),
            style: { minWidth },
            role: 'listbox',
            'aria-label': ariaLabel || label || '选项',
          }, options.map((option) => h('button', {
            type: 'button',
            key: option.value,
            className: 'u-menu-item' + (option.value === value ? ' is-active' : ''),
            role: 'option',
            'aria-selected': option.value === value,
            title: option.title || option.label,
            onClick: () => {
              onChange(option.value)
              changeOpen(false)
            },
          },
            h('span', { className: 'u-menu-item-label' }, option.label),
            option.value === value ? h('span', { className: 'u-menu-check' }, h(IconCheck, { size: 12 })) : null,
          )))
          : null,
      )
    }

    /* ------------------------------------------------------------------ *
     * balance cards
     * ------------------------------------------------------------------ */

    function OpenCodeCard({ provider }) {
      const active = provider?.active === true
      const windows = provider?.windows ?? {}
      const rolling = windows.rolling ?? null
      const primaryUsed = usedPct(rolling?.percent)
      const remaining = primaryUsed === null ? null : Math.max(0, 100 - primaryUsed)
      const resets = ['rolling', 'weekly', 'monthly']
        .map((key) => windows[key]?.resetsAt)
        .filter(Boolean)
        .map((iso) => Date.parse(iso))
        .filter((at) => Number.isFinite(at) && at > Date.now())
        .sort((a, b) => a - b)
      const rows = [
        ['rolling', '滚动'],
        ['weekly', '本周'],
        ['monthly', '本月'],
      ]
      return h('div', { className: 'u-balance' + (active ? ' is-active' : '') },
        h('div', { className: 'u-bal-head' },
          h('span', { className: 'u-dot' + (provider?.ok ? '' : ' is-off') }),
          h('span', { className: 'u-provider' }, 'OpenCode Go'),
          active ? h('span', { className: 'u-badge' }, '当前生效') : null,
          provider?.ok && rolling ? h('span', { className: 'u-badge is-muted' }, statusText(rolling.status)) : null,
        ),
        provider?.ok
          ? h(React.Fragment, null,
            h('div', { className: 'u-bal-main' },
              h('span', { className: 'u-bal-value' }, remaining === null ? '—' : `${Math.round(remaining)}%`),
              h('span', { className: 'u-bal-unit' }, '滚动窗口剩余'),
            ),
            h('div', { className: 'u-bal-sub' }, `套餐限额 · 已用 ${primaryUsed === null ? '—' : `${Math.round(primaryUsed)}%`}`),
            h('div', { className: 'u-windows' },
              rows.map(([key, label]) => {
                const item = windows[key]
                const used = usedPct(item?.percent)
                return h('div', { className: 'u-window', key },
                  h('b', null, label),
                  h('div', { className: 'u-meter' },
                    h('i', { className: used === null ? '' : used >= 90 ? 'is-danger' : used >= 70 ? 'is-warn' : '', style: { width: `${used ?? 0}%` } }),
                  ),
                  h('em', null, used === null ? '—' : `${Math.round(used)}%`),
                )
              }),
            ),
            h('div', { className: 'u-bal-foot' },
              h('span', null, '本周 / 本月为套餐窗口'),
              h('span', null, resets.length > 0 ? `${countdown(new Date(resets[0]).toISOString())}重置` : '暂无重置时间'),
            ),
          )
          : h('div', { className: 'u-bal-message' }, provider?.message || '暂时读不到 OpenCode Go 额度'),
      )
    }

    function DeepSeekCard({ provider }) {
      const active = provider?.active === true
      const info = Array.isArray(provider?.balances) ? provider.balances[0] : null
      return h('div', { className: 'u-balance' + (active ? ' is-active' : '') },
        h('div', { className: 'u-bal-head' },
          h('span', { className: 'u-dot' + (provider?.ok ? '' : ' is-off') }),
          h('span', { className: 'u-provider' }, 'DeepSeek 官方'),
          active ? h('span', { className: 'u-badge' }, '当前生效') : null,
          provider?.ok ? h('span', { className: 'u-badge is-muted' }, provider.available === false ? '不可用' : '可用') : null,
        ),
        provider?.ok && info
          ? h(React.Fragment, null,
            h('div', { className: 'u-bal-main' },
              h('span', { className: 'u-bal-value' }, money(info.total, info.currency)),
              h('span', { className: 'u-bal-unit' }, '可用余额'),
            ),
            h('div', { className: 'u-bal-sub' }, `赠送 ${money(info.granted, info.currency)} · 充值 ${money(info.toppedUp, info.currency)}`),
            h('div', { className: 'u-bal-foot' },
              h('span', null, 'DeepSeek 开放平台账户'),
              h('span', null, info.currency === 'CNY' ? '人民币' : info.currency),
            ),
          )
          : h('div', { className: 'u-bal-message' }, provider?.message || '暂时读不到 DeepSeek 余额'),
      )
    }

    function PresetCard({ provider }) {
      const active = provider?.active === true
      return h('div', { className: 'u-balance' + (active ? ' is-active' : '') },
        h('div', { className: 'u-bal-head' },
          h('span', { className: 'u-dot' + (provider?.available === false ? ' is-off' : '') }),
          h('span', { className: 'u-provider' }, provider?.name || provider?.id || '供应商'),
          active ? h('span', { className: 'u-badge' }, '当前生效') : null,
          h('span', { className: 'u-badge is-muted' }, provider?.available === false ? '不可用' : '已配置'),
        ),
        h('div', { className: 'u-bal-main' },
          h('span', { className: 'u-bal-value' }, `${Math.max(0, Number(provider?.modelCount) || 0)}`),
          h('span', { className: 'u-bal-unit' }, '个可用模型'),
        ),
        h('div', { className: 'u-bal-sub' }, active ? '当前默认模型来自该供应商' : '点击卡片设为当前供应商'),
        h('div', { className: 'u-bal-foot' },
          h('span', null, provider?.id || ''),
          h('span', null, '未接入余额查询'),
        ),
      )
    }

    function ProviderAddCard() {
      return h('div', { className: 'u-balance u-balance-add' },
        h('div', { className: 'u-bal-add-plus' }, '+'),
        h('div', { className: 'u-bal-add-title' }, '新增供应商'),
        h('div', { className: 'u-bal-add-sub' }, '打开 DSH 模型设置'),
      )
    }

    function Balances({ balance, providers, onActivate, onAdd, activating = '' }) {
      const base = Array.isArray(providers) && providers.length > 0
        ? providers
        : (Array.isArray(balance?.providers) ? balance.providers : []).map((provider) => ({
          ...provider,
          balance: provider,
          kind: 'balance',
          active: provider.active === true,
          available: provider.ok !== false,
        }))
      const items = [...base.map((provider) => ({ ...provider, add: false })), { id: '__add__', add: true }]
      const count = items.length
      const [page, setPage] = useState(0)
      const [animated, setAnimated] = useState(true)
      const pageRef = useRef(0)
      const wheelAt = useRef(0)
      const viewportRef = useRef(null)
      const safePage = count === 0 ? 0 : Math.min(page, count - 1)
      useEffect(() => {
        setPage(0)
        pageRef.current = 0
      }, [base.map((provider) => `${provider.id}:${provider.active ? 1 : 0}`).join('|')])
      const go = useCallback((direction) => {
        if (count <= 1) return
        const current = pageRef.current
        const next = (current + direction + count) % count
        const wrap = (current === 0 && direction < 0) || (current === count - 1 && direction > 0)
        if (wrap) {
          setAnimated(false)
          pageRef.current = next
          setPage(next)
          requestAnimationFrame(() => setAnimated(true))
        } else {
          pageRef.current = next
          setPage(next)
        }
      }, [count])
      useEffect(() => {
        const node = viewportRef.current
        if (node === null) return undefined
        const onWheel = (event) => {
          const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
          if (delta === 0) return
          event.preventDefault()
          const at = Date.now()
          if (at - wheelAt.current < 240) return
          wheelAt.current = at
          go(delta > 0 ? 1 : -1)
        }
        node.addEventListener('wheel', onWheel, { passive: false })
        return () => node.removeEventListener('wheel', onWheel)
      }, [go])
      const activate = (item) => {
        if (item.add || item.active || activating !== '') return
        onActivate?.(item)
      }
      return h('div', { className: 'u-provider-carousel' },
        h('div', { className: 'u-provider-viewport', ref: viewportRef, 'aria-roledescription': 'carousel' },
          h('div', {
            className: 'u-provider-track',
            style: {
              transform: `translateX(-${safePage * 100}%)`,
              transition: animated ? 'transform .42s cubic-bezier(.22,1.22,.36,1)' : 'none',
            },
          }, items.map((_, pageIndex) => h('div', { className: 'u-provider-page', key: `page-${pageIndex}` },
            [items[pageIndex], items[(pageIndex + 1) % count]].map((item, slot) => {
              if (item.add) {
                return h('button', {
                  type: 'button',
                  key: `add-${pageIndex}-${slot}`,
                  className: 'u-balance-slot u-balance-add-slot',
                  onClick: onAdd,
                  title: '新增供应商（打开 DSH 模型设置）',
                  'aria-label': '新增供应商',
                }, h(ProviderAddCard))
              }
              const active = item.active === true
              const card = item.id === 'opencode-go'
                ? h(OpenCodeCard, { provider: { ...(item.balance ?? {}), active } })
                : item.id === 'deepseek-official' || item.balance !== null
                  ? h(DeepSeekCard, { provider: { ...(item.balance ?? {}), active } })
                  : h(PresetCard, { provider: item })
              return h('div', {
                key: `${item.id}-${pageIndex}-${slot}`,
                className: 'u-balance-slot' + (active ? ' is-active' : '') + (activating === item.id ? ' is-busy' : ''),
                role: 'button',
                tabIndex: active ? -1 : 0,
                'aria-pressed': active,
                title: active ? `${item.name}：当前生效` : `切换为 ${item.name}`,
                onClick: () => activate(item),
                onKeyDown: (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    activate(item)
                  }
                },
              }, card)
            }),
          ))),
        ),
        count > 1
          ? h('div', { className: 'u-provider-dots', role: 'tablist', 'aria-label': '供应商分页' },
            items.map((item, index) => h('button', {
              key: `dot-${item.id}`,
              type: 'button',
              className: 'u-provider-dot' + (safePage === index ? ' is-active' : ''),
              'aria-label': `第 ${index + 1} 页`,
              onClick: () => {
                pageRef.current = index
                setPage(index)
              },
            })),
          )
          : null,
      )
    }

    /* ------------------------------------------------------------------ *
     * chart / ranking / table
     * ------------------------------------------------------------------ */

    const DAY_MS = 86_400_000

    function localDayStart(ms) {
      const date = new Date(ms)
      date.setHours(0, 0, 0, 0)
      return date.getTime()
    }

    function dailyCostMap(data, currency) {
      const map = new Map()
      const requests = Array.isArray(data?.requests) ? data.requests : []
      for (const request of requests) {
        if (typeof request.cost !== 'number') continue
        if ((request.currency || 'CNY') !== currency) continue
        const key = dateTextOf(request.time)
        map.set(key, (map.get(key) || 0) + request.cost)
      }
      if (map.size === 0) {
        for (const day of Array.isArray(data?.days) ? data.days : []) {
          let value = 0
          if (day.costs !== null && typeof day.costs === 'object' && typeof day.costs[currency] === 'number') value = day.costs[currency]
          else if (!day.costs && typeof day.cost === 'number') value = day.cost
          if (value !== 0) map.set(day.date, value)
        }
      }
      return map
    }

    function buildForecast(data, filters = {}) {
      const now = Date.now()
      const providers = Array.isArray(data?.balance?.providers) ? data.balance.providers : []
      const active = filters.provider || data?.active?.provider || data?.balance?.activeId || ''
      if (active.includes('opencode')) {
        const go = providers.find((provider) => provider.id === 'opencode-go')
        const monthly = go?.windows?.monthly
        const current = Number(monthly?.percent)
        if (!Number.isFinite(current)) return null
        const parsedEnd = Date.parse(monthly?.resetsAt)
        const cycleEnd = Number.isFinite(parsedEnd) ? parsedEnd : now + 30 * DAY_MS
        const cycleStart = cycleEnd - 30 * DAY_MS
        const elapsed = Math.max(1, (now - cycleStart) / DAY_MS)
        const remaining = Math.max(0, (cycleEnd - now) / DAY_MS)
        const daily = current / elapsed
        const projected = current + daily * remaining
        const costMap = dailyCostMap(data, 'USD')
        const totalCost = [...costMap.values()].reduce((sum, value) => sum + value, 0)
        const activeDays = [...costMap.values()].filter((value) => value > 0).length
        const smoothHistory = activeDays < 3
        const points = [{ time: cycleStart, actual: 0, forecast: null }]
        let cumulative = 0
        for (let cursor = localDayStart(cycleStart); cursor < now; cursor += DAY_MS) {
          const key = dateTextOf(cursor)
          cumulative += costMap.get(key) || 0
          const ratio = !smoothHistory && totalCost > 0
            ? cumulative / totalCost
            : Math.min(1, (cursor - cycleStart) / Math.max(1, now - cycleStart))
          points.push({ time: Math.min(cursor + DAY_MS, now), actual: current * ratio, forecast: null })
        }
        points.push({ time: now, actual: current, forecast: current })
        for (let cursor = localDayStart(now) + DAY_MS; cursor <= cycleEnd; cursor += DAY_MS) {
          points.push({ time: cursor, actual: null, forecast: current + daily * ((cursor - now) / DAY_MS) })
        }
        const hitDay = daily > 0 && current < 100 ? (100 - current) / daily : null
        const hitAt = current >= 100 ? now : hitDay !== null && hitDay <= remaining ? now + hitDay * DAY_MS : null
        return {
          mode: 'subscription',
          currency: 'USD',
          current,
          projected,
          daily,
          limit: 100,
          cycleStart,
          cycleEnd,
          now,
          points,
          hitAt,
        }
      }
      if (active.includes('deepseek')) {
        const deepseek = providers.find((provider) => provider.id === 'deepseek')
        const info = deepseek?.info ?? {}
        const topBalance = Array.isArray(deepseek?.balances) ? deepseek.balances[0] : null
        const limit = Number(Number.isFinite(Number(info.total)) ? info.total : topBalance?.total)
        if (!Number.isFinite(limit) || limit <= 0) return null
        const currency = info.currency || topBalance?.currency || 'CNY'
        const costMap = dailyCostMap(data, currency)
        const spent = [...costMap.values()].reduce((sum, value) => sum + value, 0)
        const days = Array.isArray(data?.days) ? data.days : []
        const spanDays = Math.max(1, days.length)
        const daily = spent / spanDays
        // The balance is a remaining budget, so compare it with future spend,
        // not with spend that already happened before the balance was read.
        const projected = daily * 30
        const cycleStart = now
        const cycleEnd = now + 30 * DAY_MS
        const points = [{ time: now, actual: 0, forecast: 0 }]
        for (let cursor = localDayStart(now) + DAY_MS; cursor <= cycleEnd; cursor += DAY_MS) {
          points.push({ time: cursor, actual: null, forecast: daily * ((cursor - now) / DAY_MS) })
        }
        const hitDay = daily > 0 ? limit / daily : null
        const hitAt = hitDay !== null && hitDay <= 30 ? now + hitDay * DAY_MS : null
        return {
          mode: 'balance',
          currency,
          spent,
          current: 0,
          projected,
          daily,
          limit,
          cycleStart,
          cycleEnd,
          now,
          points,
          hitAt,
        }
      }
      return null
    }

    function ForecastChart({ forecast, rangeLabel }) {
      const [hover, setHover] = useState(null)
      const svgRef = useRef(null)
      if (forecast === null) {
        return h('div', { className: 'u-empty' }, '当前配置没有可预测的套餐或余额')
      }
      const subscription = forecast.mode === 'subscription'
      const yMax = subscription
        ? Math.max(300, Math.ceil((forecast.projected * 1.1) / 50) * 50)
        : Math.max(forecast.limit * 1.2, forecast.projected * 1.1, 1)
      const width = 640
      const height = 220
      const pad = { left: 44, right: 18, top: 18, bottom: 26 }
      const plotW = width - pad.left - pad.right
      const plotH = height - pad.top - pad.bottom
      const x = (time) => pad.left + ((time - forecast.cycleStart) / Math.max(1, forecast.cycleEnd - forecast.cycleStart)) * plotW
      const y = (value) => pad.top + (1 - Math.max(0, Math.min(yMax, value)) / yMax) * plotH
      const actual = forecast.points.filter((point) => typeof point.actual === 'number')
      const projectedLine = forecast.points.filter((point) => typeof point.forecast === 'number')
      const line = (points, key) => points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.time).toFixed(1)},${y(point[key]).toFixed(1)}`).join(' ')
      const actualPath = line(actual, 'actual')
      const forecastPath = line(projectedLine, 'forecast')
      const areaPath = projectedLine.length === 0
        ? ''
        : `${forecastPath} L${x(forecast.cycleEnd).toFixed(1)},${y(0).toFixed(1)} L${x(forecast.now).toFixed(1)},${y(0).toFixed(1)} Z`
      const ticks = [0, 0.25, 0.5, 0.75, 1]
      const format = (value) => subscription
        ? `${Math.round(value)}%`
        : money(value, forecast.currency)
      const currentLabel = subscription
        ? `${forecast.current.toFixed(1).replace(/\.0$/, '')}%`
        : money(forecast.spent, forecast.currency)
      const projectedLabel = subscription
        ? `${forecast.projected.toFixed(1).replace(/\.0$/, '')}%`
        : money(forecast.projected, forecast.currency)
      const dailyLabel = subscription
        ? `+${forecast.daily.toFixed(1)}% / 天`
        : `+${money(forecast.daily, forecast.currency)} / 天`
      const hitLabel = subscription && forecast.current >= forecast.limit
        ? '已达到月额度 100%'
        : forecast.hitAt === null
          ? (subscription ? '按当前趋势不会用完' : '未来 30 天不会用完余额')
          : `预计 ${new Date(forecast.hitAt).getMonth() + 1}/${new Date(forecast.hitAt).getDate()} ${subscription ? '达到 100%' : '用完余额'}`
      const onMove = (event) => {
        const svg = svgRef.current
        if (svg === null) return
        const rect = svg.getBoundingClientRect()
        const localX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * width
        const ratio = Math.max(0, Math.min(1, (localX - pad.left) / plotW))
        const time = forecast.cycleStart + ratio * (forecast.cycleEnd - forecast.cycleStart)
        let best = 0
        for (let index = 1; index < forecast.points.length; index += 1) {
          if (Math.abs(forecast.points[index].time - time) < Math.abs(forecast.points[best].time - time)) best = index
        }
        const point = forecast.points[best]
        const value = typeof point.actual === 'number' ? point.actual : point.forecast
        const top = y(value) * (rect.height / height)
        setHover({
          index: best,
          left: Math.max(76, Math.min(width - 76, x(point.time))) * (rect.width / width),
          top,
          below: top < 92,
        })
      }
      const hoverPoint = hover === null ? null : forecast.points[hover.index]
      const hoverValue = hoverPoint === null
        ? 0
        : typeof hoverPoint.actual === 'number' ? hoverPoint.actual : hoverPoint.forecast
      return h(React.Fragment, null,
        h('div', { className: 'u-forecast-summary' },
          h('div', { className: 'u-forecast-item' },
            h('span', { className: 'u-forecast-label' }, subscription ? '当前已用' : '本周期已用'),
            h('b', null, currentLabel),
          ),
          h('div', { className: 'u-forecast-arrow' }, '→'),
          h('div', { className: 'u-forecast-item' },
            h('span', { className: 'u-forecast-label' }, subscription ? '按趋势预计' : '未来 30 天预计'),
            h('b', { className: forecast.projected > forecast.limit ? 'is-warn' : '' }, projectedLabel),
          ),
          h('div', { className: 'u-forecast-meta' },
            subscription ? null : h('span', null, `余额 ${money(forecast.limit, forecast.currency)}`),
            h('span', null, dailyLabel),
            h('span', { className: forecast.hitAt === null ? '' : 'is-warn' }, hitLabel),
          ),
        ),
        h('div', { className: 'u-forecast-wrap' },
          h('svg', {
            ref: svgRef,
            className: 'u-forecast-chart',
            viewBox: `0 0 ${width} ${height}`,
            role: 'img',
            'aria-label': subscription ? '订阅用量趋势预测' : 'DeepSeek 余额消耗预测',
            onMouseMove: onMove,
            onClick: onMove,
            onMouseLeave: () => setHover(null),
          },
            h('rect', { x: 0, y: 0, width, height, fill: 'transparent' }),
            h('defs', null,
            h('pattern', { id: 'u-forecast-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
              h('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'rgba(240,179,90,.24)', strokeWidth: 1.5 }),
            ),
          ),
          ticks.map((tick) => {
            const value = yMax * tick
            return h('g', { key: tick },
              h('line', { x1: pad.left, y1: y(value), x2: width - pad.right, y2: y(value), stroke: 'var(--u-border)', strokeDasharray: tick === 0 ? '0' : '2 5' }),
              h('text', { x: pad.left - 7, y: y(value) + 3, textAnchor: 'end', className: 'u-forecast-axis' }, format(value)),
            )
          }),
          h('line', {
            x1: pad.left,
            y1: y(forecast.limit),
            x2: width - pad.right,
            y2: y(forecast.limit),
            stroke: 'rgba(232,234,237,.42)',
            strokeDasharray: '4 4',
          }),
          h('text', { x: width - pad.right, y: y(forecast.limit) - 5, textAnchor: 'end', className: 'u-forecast-limit' }, subscription ? '月额度 100%' : `余额 ${money(forecast.limit, forecast.currency)}`),
          areaPath === '' ? null : h('path', { d: areaPath, fill: 'url(#u-forecast-hatch)' }),
          actualPath === '' ? null : h('path', { d: actualPath, fill: 'none', stroke: '#57d39a', strokeWidth: 1.8, strokeLinejoin: 'round' }),
          forecastPath === '' ? null : h('path', { d: forecastPath, fill: 'none', stroke: '#e9b45f', strokeWidth: 1.8, strokeDasharray: '4 4', strokeLinejoin: 'round' }),
          h('line', { x1: x(forecast.now), y1: pad.top, x2: x(forecast.now), y2: height - pad.bottom, stroke: 'rgba(232,234,237,.28)', strokeDasharray: '2 4' }),
          h('circle', { cx: x(forecast.now), cy: y(forecast.current), r: 4, fill: '#57d39a', stroke: 'var(--u-card-2,#22262e)', strokeWidth: 2 }),
          hoverPoint === null ? null : h(React.Fragment, null,
            h('line', {
              x1: x(hoverPoint.time),
              y1: pad.top,
              x2: x(hoverPoint.time),
              y2: height - pad.bottom,
              stroke: 'rgba(232,234,237,.62)',
              strokeDasharray: '3 3',
            }),
            h('line', {
              x1: x(hoverPoint.time),
              y1: height - pad.bottom,
              x2: x(hoverPoint.time),
              y2: height - pad.bottom + 4,
              stroke: 'var(--u-text)',
              strokeWidth: 1.5,
            }),
            h('circle', {
              cx: x(hoverPoint.time),
              cy: y(hoverValue),
              r: 4.5,
              fill: '#e9b45f',
              stroke: 'var(--u-card-2,#22262e)',
              strokeWidth: 2,
            }),
          ),
          h('text', { x: pad.left, y: height - 6, className: 'u-forecast-axis' }, forecast.cycleStart === forecast.now
            ? '今天'
            : `${new Date(forecast.cycleStart).getMonth() + 1}/${new Date(forecast.cycleStart).getDate()}`),
          forecast.cycleStart === forecast.now ? null : h('text', { x: x(forecast.now), y: height - 6, textAnchor: 'middle', className: 'u-forecast-axis' }, '今天'),
          hoverPoint === null ? null : h('text', {
            x: x(hoverPoint.time),
            y: height - 6,
            textAnchor: 'middle',
            className: 'u-forecast-axis is-active',
          }, `${new Date(hoverPoint.time).getMonth() + 1}/${new Date(hoverPoint.time).getDate()}`),
          h('text', { x: width - pad.right, y: height - 6, textAnchor: 'end', className: 'u-forecast-axis' }, `${new Date(forecast.cycleEnd).getMonth() + 1}/${new Date(forecast.cycleEnd).getDate()}`),
        ),
        hover === null ? null : h('div', {
          className: 'u-forecast-tip',
          style: { left: `${hover.left}px`, top: `${hover.top}px` },
        },
          h('div', { className: 'u-tip-date' }, `${new Date(hoverPoint.time).getMonth() + 1}月${new Date(hoverPoint.time).getDate()}日`),
          h('div', { className: 'u-tip-row' },
            h('span', null, hoverPoint.time > forecast.now ? '预测' : '已用'),
            h('b', null, subscription ? `${hoverValue.toFixed(1)}%` : money(hoverValue, forecast.currency)),
          ),
          h('div', { className: 'u-tip-row' },
            h('span', null, '日均'),
            h('b', null, subscription ? `+${forecast.daily.toFixed(1)}%` : `+${money(forecast.daily, forecast.currency)}`),
          ),
        ),
      ),
        h('div', { className: 'u-forecast-legend' },
          h('span', null, h('i', { className: 'u-legend-usage' }), subscription ? '已用比例' : '未来花费'),
          h('span', null, h('i', { className: 'u-legend-forecast' }), '预测'),
          h('span', null, h('i', { className: 'u-legend-limit' }), subscription ? '月额度 100%' : `余额 ${money(forecast.limit, forecast.currency)}`),
          h('span', { className: 'u-forecast-note' }, '按本机日志与当前余额/套餐窗口估算'),
        ),
      )
    }

    function buildHourlySeries(data) {
      const range = data?.range
      if (range !== 'today' && range !== '24h') return null
      const now = Date.now()
      const start = range === 'today' ? localDayStart(now) : now - 24 * 3_600_000
      const count = Math.max(1, Math.ceil((now - start) / 3_600_000))
      const points = Array.from({ length: count }, (_, index) => ({
        time: start + index * 3_600_000,
        requests: 0,
        tokens: 0,
        input: 0,
        cacheRead: 0,
        output: 0,
        cost: 0,
        costs: {},
      }))
      for (const request of Array.isArray(data?.requests) ? data.requests : []) {
        if (typeof request.time !== 'number' || request.time < start || request.time > now) continue
        const index = Math.min(count - 1, Math.floor((request.time - start) / 3_600_000))
        const point = points[index]
        point.requests += 1
        point.input += Number(request.input) || 0
        point.cacheRead += Number(request.cacheRead) || 0
        point.output += Number(request.output) || 0
        point.tokens = (point.tokens || 0) + (Number(request.input) || 0) + (Number(request.cacheRead) || 0) + (Number(request.cacheWrite) || 0) + (Number(request.output) || 0)
        if (typeof request.cost === 'number') {
          point.cost += request.cost
          const currency = request.currency || 'USD'
          point.costs[currency] = (point.costs[currency] || 0) + request.cost
        }
      }
      return points
    }

    function niceMax(value) {
      const n = Number(value) || 0
      if (n <= 0) return 1
      const exponent = Math.floor(Math.log10(n))
      const fraction = n / 10 ** exponent
      const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
      return nice * 10 ** exponent
    }

    function TrendCard({ data, rangeLabel, filters = {}, initialMetric = 'tokens', forecastData = null }) {
      const [metric, setMetric] = useState(initialMetric)
      const days = Array.isArray(data.days) ? data.days : []
      const costs = data.totals?.costs ?? {}
      const currency = data.totals?.currency || (costs.USD !== undefined ? 'USD' : 'CNY')
      const metrics = [
        { id: 'tokens', label: 'Tokens' },
        { id: 'requests', label: '请求' },
        { id: 'cost', label: '成本' },
        { id: 'forecast', label: '预测' },
      ]
      // Host 0.2.x did not put cost on day buckets; rebuild it from the
      // request rows so the Cost tab still works during a staged reload.
      const fallbackCosts = useMemo(() => {
        const map = new Map()
        for (const request of Array.isArray(data.requests) ? data.requests : []) {
          if (typeof request.cost !== 'number') continue
          const key = dateTextOf(request.time)
          let row = map.get(key)
          if (row === undefined) {
            row = {}
            map.set(key, row)
          }
          const code = request.currency || 'USD'
          row[code] = (row[code] || 0) + request.cost
        }
        return map
      }, [data.requests])
      const valueOf = (day) => {
        if (metric === 'requests') return Number(day.requests) || 0
        if (metric === 'cost') {
          if (typeof day.costs?.[currency] === 'number') return day.costs[currency]
          const fallback = fallbackCosts.get(day.date)
          if (fallback !== undefined && typeof fallback[currency] === 'number') return fallback[currency]
          return Number(day.cost) || 0
        }
        return Number(day.tokens) || 0
      }
      const forecast = useMemo(() => buildForecast(forecastData ?? data, filters), [data, forecastData, filters])
      if (metric === 'forecast') {
        return h('section', { className: 'u-card' },
          h('div', { className: 'u-card-head' },
            h('div', { className: 'u-card-title-wrap' },
              h('h3', { className: 'u-card-title' }, '使用趋势'),
              h('span', { className: 'u-card-note' }, rangeLabel),
            ),
            h('div', { className: 'u-chart-tabs', role: 'tablist', 'aria-label': '趋势指标' },
              metrics.map((item) => h('button', {
                key: item.id,
                className: 'u-chart-tab' + (metric === item.id ? ' is-active' : ''),
                role: 'tab',
                'aria-selected': metric === item.id,
                onClick: () => setMetric(item.id),
              }, item.label)),
            ),
          ),
          h(ForecastChart, { forecast, rangeLabel }),
        )
      }
      const hourly = buildHourlySeries(data)
      const series = hourly ?? days
      const rawMax = series.reduce((value, point) => Math.max(value, valueOf(point)), 0)
      const max = niceMax(rawMax)
      const ticks = [1, 0.75, 0.5, 0.25, 0]
      const labelEvery = hourly === null
        ? (series.length > 14 ? Math.ceil(series.length / 4) : 1)
        : Math.max(1, Math.ceil(series.length / 6))
      const unit = metric === 'cost' ? (currency === 'USD' ? '$' : '¥') : ''
      const format = (value) => metric === 'cost' ? unit + money(value, currency).replace(/^[¥$]/, '') : axisValue(value)
      const pointLabel = (point) => {
        if (hourly === null) return dayLabel(point.date)
        const date = new Date(point.time)
        const time = `${pad2(date.getHours())}:00`
        if (data.range === '24h' && date.toDateString() !== new Date().toDateString()) {
          return `${date.getMonth() + 1}/${date.getDate()} ${time}`
        }
        return time
      }
      return h('section', { className: 'u-card' },
        h('div', { className: 'u-card-head' },
          h('div', { className: 'u-card-title-wrap' },
            h('h3', { className: 'u-card-title' }, '使用趋势'),
            h('span', { className: 'u-card-note' }, rangeLabel),
          ),
          h('div', { className: 'u-chart-tabs', role: 'tablist', 'aria-label': '趋势指标' },
            metrics.map((item) => h('button', {
              key: item.id,
              className: 'u-chart-tab' + (metric === item.id ? ' is-active' : ''),
              role: 'tab',
              'aria-selected': metric === item.id,
              onClick: () => setMetric(item.id),
            }, item.label)),
          ),
        ),
        rawMax === 0
          ? h('div', { className: 'u-empty' }, '当前时段没有用量')
          : h('div', { className: 'u-chart-body' },
            h('div', { className: 'u-yaxis', 'aria-hidden': 'true' },
              ticks.map((tick) => h('span', { key: tick, title: metric === 'cost' ? `${money(max * tick, currency)}` : `${num(max * tick)}` }, format(max * tick))),
            ),
            h('div', { className: 'u-chart-grid' },
              series.map((point, index) => {
                const value = valueOf(point)
                const height = value === 0 ? 0 : Math.max(2, (value / max) * 100)
                const show = index === 0 || index === series.length - 1 || index % labelEvery === 0
                const label = pointLabel(point)
                const detail = metric === 'cost'
                  ? money(value, currency)
                  : metric === 'requests'
                    ? `${num(value)} 次请求`
                    : `${num(value)} tokens`
                return h('div', { className: 'u-bar-col', key: point.time ?? point.date },
                  h('div', { className: 'u-bar-wrap' },
                    h('div', {
                      className: `u-bar u-bar-${metric}` + (value === 0 ? ' is-empty' : ''),
                      style: { height: `${height}%` },
                      title: `${label} · ${detail}`,
                    }),
                  ),
                  h('div', { className: 'u-bar-label' }, show ? label : ''),
                )
              }),
            ),
          ),
      )
    }

    function Pager({ page, total, onChange }) {
      const [draft, setDraft] = useState(String(page))
      useEffect(() => { setDraft(String(page)) }, [page])
      if (total <= 1) return null
      const commit = () => {
        const parsed = Number.parseInt(draft, 10)
        const next = Number.isFinite(parsed) ? Math.max(1, Math.min(total, parsed)) : page
        setDraft(String(next))
        if (next !== page) onChange(next)
      }
      return h('div', { className: 'u-pager' },
        h('button', { type: 'button', className: 'u-page-arrow', disabled: page <= 1, onClick: () => onChange(1), title: '第一页', 'aria-label': '第一页' }, h(IconChevronsLeft, { size: 14 })),
        h('button', { type: 'button', className: 'u-page-arrow', disabled: page <= 1, onClick: () => onChange(page - 1), title: '上一页', 'aria-label': '上一页' }, h(IconChevronLeft, { size: 14 })),
        h('span', { className: 'u-page-jump' },
          h('span', { className: 'u-page-prefix' }, '第'),
          h('input', {
            className: 'u-page-input',
            value: draft,
            inputMode: 'numeric',
            'aria-label': '跳转页码',
            onChange: (event) => setDraft(event.target.value.replace(/[^\d]/g, '')),
            onFocus: (event) => event.target.select(),
            onBlur: commit,
            onKeyDown: (event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commit()
              } else if (event.key === 'Escape') {
                setDraft(String(page))
                event.target.blur()
              }
            },
          }),
          h('span', { className: 'u-page-total' }, `/ ${num(total)} 页`),
        ),
        h('button', { type: 'button', className: 'u-page-arrow', disabled: page >= total, onClick: () => onChange(page + 1), title: '下一页', 'aria-label': '下一页' }, h(IconChevronRight, { size: 14 })),
        h('button', { type: 'button', className: 'u-page-arrow', disabled: page >= total, onClick: () => onChange(total), title: '最后一页', 'aria-label': '最后一页' }, h(IconChevronsRight, { size: 14 })),
      )
    }

    function SourcePicker({ sources = [], selected = ['dsh-session'], onChange, align = 'left' }) {
      const [open, setOpen] = useState(false)
      const rootRef = useRef(null)
      useEffect(() => {
        if (!open) return undefined
        const onPointer = (event) => {
          if (rootRef.current !== null && !rootRef.current.contains(event.target)) setOpen(false)
        }
        const onKey = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('pointerdown', onPointer)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('pointerdown', onPointer)
          document.removeEventListener('keydown', onKey)
        }
      }, [open])
      const options = sources.length > 0
        ? sources
        : [{ id: 'dsh-session', label: 'DSH 会话', kind: 'builtin', builtin: true }]
      const selectedSet = new Set(selected)
      const active = options.filter((option) => selectedSet.has(option.id))
      const current = active.length === 0
        ? '未选择'
        : active.length === 1
          ? active[0].label
          : `${active.length} 个来源`
      const toggle = (id) => {
        const next = selectedSet.has(id)
          ? selected.filter((item) => item !== id)
          : [...selected, id]
        onChange(next)
      }
      return h('div', { className: 'u-menu-wrap u-source-wrap', ref: rootRef },
        h('button', {
          type: 'button',
          className: 'u-trigger u-source-trigger' + (open ? ' is-open' : ''),
          onClick: () => setOpen((previous) => !previous),
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
          'aria-label': `统计来源：${current}`,
          title: `统计来源：${active.map((item) => item.label).join('、') || '未选择'}`,
        },
          h(IconStack, { size: 13 }),
          h('span', { className: 'u-trigger-label' }, `来源 · ${current}`),
          h('span', { className: 'u-trigger-chevron' }, h(IconChevronDown, { size: 10 })),
        ),
        open
          ? h('div', { className: 'u-menu-pop u-source-pop' + (align === 'right' ? ' is-right' : ''), role: 'dialog', 'aria-label': '选择统计来源' },
            h('div', { className: 'u-source-head' },
              h('b', null, '统计来源'),
              h('span', null, '只汇总勾选的来源'),
            ),
            h('div', { className: 'u-source-list' }, options.map((option) => {
              const on = selectedSet.has(option.id)
              return h('button', {
                type: 'button',
                key: option.id,
                className: 'u-source-row' + (on ? ' is-on' : ''),
                'aria-pressed': on,
                onClick: () => toggle(option.id),
              },
                h('span', { className: 'u-source-check' }, on ? h(IconCheck, { size: 11 }) : null),
                h('span', { className: 'u-source-copy' },
                  h('span', { className: 'u-source-name' }, option.label || option.id),
                  h('span', { className: 'u-source-kind' }, option.builtin
                    ? '本机会话日志'
                    : option.kind === 'mcp'
                      ? 'MCP 推送'
                      : option.kind === 'plugin'
                        ? '插件推送'
                        : '外部推送'),
                ),
                typeof option.events === 'number' && option.events > 0
                  ? h('span', { className: 'u-source-count' }, `${num(option.events)} 条`)
                  : null,
              )
            })),
            h('div', { className: 'u-source-foot' },
              h('button', { type: 'button', className: 'u-source-action', onClick: () => onChange(['dsh-session']) }, '只选 DSH'),
              h('button', {
                type: 'button',
                className: 'u-source-action',
                onClick: () => onChange(options.map((option) => option.id)),
              }, '全选'),
            ),
            options.length <= 1
              ? h('div', { className: 'u-source-note' }, '其它插件接入后会出现在这里')
              : null,
          )
          : null,
      )
    }

    function FilterBar({ data, filters = {}, onChange, onClear, search = '', onSearch }) {
      const facets = data?.facets ?? {}
      const scrollRef = useRef(null)
      const trackRef = useRef(null)
      const [setWidth, setSetWidth] = useState(0)
      const [hydrated, setHydrated] = useState(false)
      const [openMenus, setOpenMenus] = useState(0)
      const onMenuOpenChange = (open) => {
        setOpenMenus((count) => Math.max(0, count + (open ? 1 : -1)))
      }
      useEffect(() => setHydrated(true), [])
      useEffect(() => {
        const node = scrollRef.current
        if (node === null) return undefined
        const measure = () => setSetWidth(Math.max(0, Math.floor(node.clientWidth)))
        measure()
        if (typeof ResizeObserver !== 'function') return undefined
        const observer = new ResizeObserver(measure)
        observer.observe(node)
        return () => observer.disconnect()
      }, [])
      useEffect(() => {
        const node = scrollRef.current
        if (node === null || setWidth <= 0) return
        node.scrollLeft = setWidth
      }, [setWidth, hydrated])
      useEffect(() => {
        const node = scrollRef.current
        const track = trackRef.current
        if (node === null || track === null) return undefined
        let frame = 0
        const copyWidth = () => track.scrollWidth / 3
        const normalize = () => {
          const width = copyWidth()
          if (width <= 0) return
          if (node.scrollLeft < width * 0.5) node.scrollLeft += width
          else if (node.scrollLeft > width * 1.5) node.scrollLeft -= width
        }
        const onScroll = () => {
          if (frame !== 0) return
          frame = requestAnimationFrame(() => {
            frame = 0
            normalize()
          })
        }
        const onWheel = (event) => {
          if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
          const max = node.scrollWidth - node.clientWidth
          if (max <= 1 || event.deltaY === 0) return
          node.scrollLeft += event.deltaY
          event.preventDefault()
        }
        node.scrollLeft = copyWidth()
        node.addEventListener('scroll', onScroll, { passive: true })
        node.addEventListener('wheel', onWheel, { passive: false })
        return () => {
          if (frame !== 0) cancelAnimationFrame(frame)
          node.removeEventListener('scroll', onScroll)
          node.removeEventListener('wheel', onWheel)
        }
      }, [])
      const sessions = Array.isArray(facets.sessions) ? facets.sessions : []
      const workspaces = Array.isArray(facets.workspaces) ? facets.workspaces : []
      const models = Array.isArray(facets.models) ? facets.models : []
      const providers = Array.isArray(facets.providers) ? facets.providers : []
      const active = Boolean(filters.session || filters.workspace || filters.provider || filters.model)
      const sessionRow = sessions.find((row) => row.id === filters.session)
      const workspaceRow = workspaces.find((row) => row.path === filters.workspace)
      const modelRow = models.find((row) => row.model === filters.model)
      const providerRow = providers.find((row) => row.id === filters.provider)
      const trigger = (key, dimension, current, options) => h(Menu, {
        key,
        label: `${dimension} · ${current}`,
        value: filters[key] || '',
        onChange: (value) => onChange({ ...filters, [key]: value }),
        onOpenChange: onMenuOpenChange,
        options: [{ value: '', label: `全部${dimension}`, title: `全部${dimension}` }, ...options],
        minWidth: 210,
      })
      const filterSet = (copy) => h('div', {
        className: 'u-filter-set',
        key: `filter-set-${copy}`,
        style: setWidth > 0 ? { width: `${setWidth}px` } : undefined,
      },
        trigger('session', '会话', filters.session ? (sessionRow?.title || '已选会话') : '全部', sessions.map((row) => ({
          value: row.id,
          label: row.title || row.id,
          title: `${row.title || row.id} · ${row.workspace || ''}`,
        }))),
        trigger('workspace', '工作区', filters.workspace ? (workspaceRow?.name || '已选工作区') : '全部', workspaces.map((row) => ({
          value: row.path,
          label: row.name || row.path,
          title: row.path,
        }))),
        trigger('provider', '供应商', filters.provider ? providerLabel(filters.provider) : '全部', providers.map((row) => ({
          value: row.id,
          label: providerLabel(row.id),
        }))),
        trigger('model', '模型', filters.model ? filters.model : '全部', models.map((row) => ({
          value: row.model,
          label: `${providerLabel(row.provider)} / ${row.model}`,
        }))),
      )
      return h('div', { className: 'u-filters' },
        h('div', {
          className: 'u-filter-scroll' + (openMenus > 0 ? ' is-menu-open' : ''),
          ref: scrollRef,
        },
          h('div', { className: 'u-filter-track', ref: trackRef },
            (hydrated ? [0, 1, 2] : [1]).map(filterSet),
          ),
        ),
        h('div', { className: 'u-filter-tools' },
          h('label', { className: 'u-search' },
            h('span', { className: 'u-search-icon' }, h(IconSearch, { size: 13 })),
            h('input', {
              className: 'u-search-input',
              value: search,
              placeholder: '搜索会话 / 模型 / 工作区',
              'aria-label': '搜索会话、模型或工作区',
              onChange: (event) => onSearch(event.target.value),
            }),
            search
              ? h('button', { type: 'button', className: 'u-search-clear', onClick: () => onSearch(''), title: '清除搜索', 'aria-label': '清除搜索' }, '×')
              : null,
          ),
          active
            ? h('button', { type: 'button', className: 'u-filter-clear', onClick: onClear, title: '清除筛选', 'aria-label': '清除筛选' }, '×')
            : null,
        ),
      )
    }

    function BreakdownCard({ data, filters = {}, sort = 'active', onSort, onSelectSession, onSelectWorkspace, onSelectModel }) {
      const [tab, setTab] = useState('sessions')
      const [page, setPage] = useState(1)
      const source = tab === 'sessions' ? data.sessions : tab === 'workspaces' ? data.workspaces : data.models
      const all = Array.isArray(source) ? source : []
      const pageSize = 10
      const totalPages = Math.max(1, Math.ceil(all.length / pageSize))
      useEffect(() => { setPage(1) }, [tab, sort, data.range, data.search, filters.workspace, filters.provider, filters.model, filters.session])
      const safePage = Math.min(page, totalPages)
      const start = (safePage - 1) * pageSize
      const visible = all.slice(start, start + pageSize)
      const max = all.reduce((value, row) => Math.max(value, Number(row.tokens) || 0), 0)
      const tabs = [
        ['sessions', '会话'],
        ['workspaces', '工作区'],
        ['models', '模型'],
      ]
      const clickRow = (row) => {
        if (tab === 'sessions') onSelectSession(filters.session === row.id ? '' : row.id)
        else if (tab === 'workspaces') onSelectWorkspace(filters.workspace === row.path ? '' : row.path)
        else onSelectModel(row)
      }
      const isSelected = (row) => tab === 'sessions'
        ? filters.session === row.id
        : tab === 'workspaces'
          ? filters.workspace === row.path
          : filters.provider === row.provider && filters.model === row.model
      return h('section', { className: 'u-card' },
        h('div', { className: 'u-card-head' },
          h('h3', { className: 'u-card-title' }, '用量明细'),
          h('div', { className: 'u-card-tools' },
            h('div', { className: 'u-tabs', role: 'tablist' },
              tabs.map(([id, label]) => h('button', {
                key: id, className: 'u-tab', role: 'tab', 'aria-selected': tab === id,
                onClick: () => setTab(id),
              }, label)),
            ),
            h(Menu, {
              label: null,
              value: sort,
              onChange: onSort,
              icon: h(IconSliders, { size: 14 }),
              align: 'right',
              minWidth: 150,
              ariaLabel: '排序方式',
              options: [
                { value: 'active', label: '活跃优先', title: '最近使用的排前面' },
                { value: 'tokens', label: '用量优先', title: 'Tokens 多的排前面' },
              ],
            }),
          ),
        ),
        all.length === 0
          ? h('div', { className: 'u-empty' }, '当前筛选范围内还没有 API 用量')
          : h('div', { className: 'u-ranks' },
            visible.map((row, index) => {
              const tokens = Number(row.tokens) || 0
              const selected = isSelected(row)
              const title = tab === 'sessions' ? row.title : tab === 'workspaces' ? row.name : `${providerLabel(row.provider)} / ${row.model}`
              const sub = tab === 'sessions'
                ? `${row.source && row.source !== 'dsh-session' ? `${row.sourceLabel || row.source} · ` : ''}${row.workspace} · ${num(row.requests)} 次 · ${relative(row.lastAt)}`
                : tab === 'workspaces'
                  ? `${row.path} · ${num(row.sessions)} 个会话 · ${num(row.requests)} 次`
                  : `${num(row.sessions)} 个会话 · ${num(row.requests)} 次 · ${relative(row.lastAt)}`
              return h('button', {
                key: tab === 'sessions' ? row.id : tab === 'workspaces' ? row.path : `${row.provider}/${row.model}`,
                className: 'u-rank' + (selected ? ' is-selected' : ''),
                onClick: () => clickRow(row),
                title: `${title}（点击筛选）`,
              },
                h('span', { className: 'u-rank-no' }, start + index + 1),
                h('span', { className: 'u-rank-main' },
                  h('span', { className: 'u-rank-title' }, title),
                  h('span', { className: 'u-rank-sub' }, sub),
                ),
                h('span', { className: 'u-rank-bar' }, h('i', { style: { width: `${max === 0 ? 0 : Math.max(3, (tokens / max) * 100)}%` } })),
                h('span', { className: 'u-rank-value' },
                  h('b', null, compact(tokens)),
                  `${num(row.requests)} 次`,
                ),
              )
            }),
            h(Pager, { page: safePage, total: totalPages, onChange: setPage }),
          ),
      )
    }

    function RequestsCard({ data, filters = {}, onClearSession }) {
      const facets = data?.facets?.sessions
      const selected = (Array.isArray(facets) ? facets : data.sessions || []).find((session) => session.id === filters.session) ?? null
      const rows = Array.isArray(data.requests) ? data.requests : []
      const pageSize = 10
      const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
      const [page, setPage] = useState(totalPages)
      const [follow, setFollow] = useState(true)
      const resetKey = [data.range, data.search, filters.session, filters.workspace, filters.provider, filters.model].join('\u0000')
      useEffect(() => {
        setFollow(true)
        setPage(Math.max(1, Math.ceil(rows.length / pageSize)))
      }, [resetKey])
      useEffect(() => {
        if (follow) setPage(totalPages)
      }, [totalPages, follow])
      const safePage = Math.min(page, totalPages)
      const ascending = [...rows].sort((left, right) => left.time - right.time)
      const visible = ascending.slice((safePage - 1) * pageSize, safePage * pageSize).reverse()
      const goto = (next) => {
        setPage(next)
        setFollow(next >= totalPages)
      }
      return h('section', { className: 'u-card' },
        h('div', { className: 'u-card-head' },
          h('h3', { className: 'u-card-title' }, '请求日志'),
          h('div', { className: 'u-card-tools' },
            selected
              ? h('span', { className: 'u-session-chip' },
                h('span', null, selected.title),
                h('button', { onClick: onClearSession, title: '清除筛选' }, '×'),
              )
              : null,
            h('span', { className: 'u-card-note' }, `${num(rows.length)} 条 · 第 ${safePage} / ${totalPages} 页 · 最新在前`),
          ),
        ),
        rows.length === 0
          ? h('div', { className: 'u-empty' }, selected ? '这个会话在当前范围内没有请求' : '当前筛选范围内没有请求')
          : h(React.Fragment, null,
            h('div', { className: 'u-table' },
              h('div', { className: 'u-tr u-th' },
                h('span', null, '时间'),
                h('span', null, '会话'),
                h('span', null, '模型'),
                h('span', { className: 'u-col-input' }, '输入'),
                h('span', { className: 'u-col-cache' }, '缓存'),
                h('span', { className: 'u-col-output' }, '输出'),
                h('span', { className: 'u-col-cost' }, '成本'),
              ),
              visible.map((row, index) => h('div', { className: 'u-tr', key: `${row.sessionId}:${row.time}:${index}` },
                h('span', { className: 'u-td time' }, timeOf(row.time)),
                h('span', {
                  className: 'u-td session',
                  title: `${row.source && row.source !== 'dsh-session' ? `${row.sourceLabel || row.source} · ` : ''}${row.sessionTitle || row.sessionId}`,
                },
                  row.source && row.source !== 'dsh-session'
                    ? h('i', { className: 'u-source-tag' }, row.sourceLabel || row.source)
                    : null,
                  row.sessionTitle || row.sessionId,
                ),
                h('span', { className: 'u-td model' },
                  h('b', { title: row.model }, row.model),
                  h('span', null, providerLabel(row.provider)),
                ),
                h('span', { className: 'u-td num u-col-input' }, compact(row.input)),
                h('span', { className: 'u-td num u-col-cache' }, compact(row.cacheRead)),
                h('span', { className: 'u-td num u-col-output' }, compact(row.output)),
                h('span', { className: 'u-td num u-col-cost' },
                  row.cost === null || row.cost === undefined
                    ? '未定价'
                    : row.billing === 'free'
                      ? '免费'
                      : money(row.cost, row.currency || 'USD'),
                ),
              )),
            ),
            h(Pager, { page: safePage, total: totalPages, onChange: goto }),
          ),
      )
    }

    /* ------------------------------------------------------------------ *
     * page
     * ------------------------------------------------------------------ */

    const RANGE_PRESETS = [
      { id: 'today', label: '当天' },
      { id: '24h', label: '近24小时' },
      { id: '7d', label: '近7天' },
      { id: '14d', label: '近14天' },
      { id: '30d', label: '近30天' },
      { id: 'all', label: '全部' },
    ]

    function pad2(value) {
      return String(value).padStart(2, '0')
    }

    function dateTextOf(ms) {
      const date = new Date(ms)
      return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
    }

    function timeTextOf(ms) {
      const date = new Date(ms)
      return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
    }

    function parseLocalDateTime(date, time) {
      const stamp = new Date(`${date}T${time || '00:00'}:00`)
      return Number.isNaN(stamp.getTime()) ? null : stamp.getTime()
    }

    function rangeLabelOf(range) {
      if (range.mode === 'custom' && Number.isFinite(range.from) && Number.isFinite(range.to)) {
        const from = new Date(range.from)
        const to = new Date(range.to)
        return `${pad2(from.getMonth() + 1)}/${pad2(from.getDate())} ${timeTextOf(range.from)} – ${pad2(to.getMonth() + 1)}/${pad2(to.getDate())} ${timeTextOf(range.to)}`
      }
      return RANGE_PRESETS.find((item) => item.id === range.mode)?.label || '近7天'
    }

    function Calendar({ value, onPick }) {
      const initial = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date()
      const [view, setView] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1))
      const year = view.getFullYear()
      const month = view.getMonth()
      const offset = (new Date(year, month, 1).getDay() + 6) % 7
      const total = new Date(year, month + 1, 0).getDate()
      const today = dateTextOf(Date.now())
      const cells = Array.from({ length: 42 }, (_, index) => {
        const day = index - offset + 1
        return day >= 1 && day <= total ? day : null
      })
      return h('div', { className: 'u-calendar' },
        h('div', { className: 'u-calendar-head' },
          h('button', { type: 'button', className: 'u-calendar-nav', onClick: () => setView(new Date(year, month - 1, 1)), 'aria-label': '上个月' }, h(IconChevronLeft, { size: 14 })),
          h('span', { className: 'u-calendar-title' }, `${year}年${month + 1}月`),
          h('button', { type: 'button', className: 'u-calendar-nav', onClick: () => setView(new Date(year, month + 1, 1)), 'aria-label': '下个月' }, h(IconChevronRight, { size: 14 })),
        ),
        h('div', { className: 'u-calendar-week' }, ['一', '二', '三', '四', '五', '六', '日'].map((label) => h('span', { key: label, className: 'u-calendar-weekday' }, label))),
        h('div', { className: 'u-calendar-grid' },
          cells.map((day, index) => day === null
            ? h('span', { key: `blank-${index}`, className: 'u-calendar-blank' })
            : (() => {
              const key = `${year}-${pad2(month + 1)}-${pad2(day)}`
              return h('button', {
                type: 'button',
                key,
                className: 'u-calendar-cell' + (key === value ? ' is-selected' : '') + (key === today ? ' is-today' : ''),
                onClick: () => onPick(key),
              }, day)
            })(),
          ),
        ),
      )
    }

    function RangeMenu({ range, onChange, defaultOpen = false }) {
      const [open, setOpen] = useState(defaultOpen)
      const [startDate, setStartDate] = useState(() => dateTextOf(Number.isFinite(range.from) ? range.from : Date.now() - 6 * 86_400_000))
      const [startTime, setStartTime] = useState(() => timeTextOf(Number.isFinite(range.from) ? range.from : Date.now() - 6 * 86_400_000))
      const [endDate, setEndDate] = useState(() => dateTextOf(Number.isFinite(range.to) ? range.to : Date.now()))
      const [endTime, setEndTime] = useState(() => timeTextOf(Number.isFinite(range.to) ? range.to : Date.now()))
      const [endNow, setEndNow] = useState(false)
      const [calendarField, setCalendarField] = useState('start')
      const [error, setError] = useState('')
      const [placement, setPlacement] = useState(null)
      const rootRef = useRef(null)
      const triggerRef = useRef(null)
      const popRef = useRef(null)
      useEffect(() => {
        if (!open) return undefined
        const onPointer = (event) => {
          const insideTrigger = rootRef.current !== null && rootRef.current.contains(event.target)
          const insidePopover = popRef.current !== null && popRef.current.contains(event.target)
          if (!insideTrigger && !insidePopover) setOpen(false)
        }
        const onKey = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        const onMove = () => place()
        document.addEventListener('pointerdown', onPointer)
        document.addEventListener('keydown', onKey)
        window.addEventListener('resize', onMove)
        window.addEventListener('scroll', onMove, true)
        return () => {
          document.removeEventListener('pointerdown', onPointer)
          document.removeEventListener('keydown', onKey)
          window.removeEventListener('resize', onMove)
          window.removeEventListener('scroll', onMove, true)
        }
      }, [open])
      const place = () => {
        const rect = triggerRef.current?.getBoundingClientRect()
        if (rect === undefined) return
        const width = Math.min(window.innerWidth <= 640 ? 420 : 566, window.innerWidth - 24)
        const height = 356
        let left = rect.right - width
        if (left < 12) left = 12
        if (left + width > window.innerWidth - 12) left = window.innerWidth - 12 - width
        let top = rect.bottom + 8
        if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - height - 8)
        setPlacement({ left, top, width })
      }
      const show = () => {
        const from = range.mode === 'custom' && Number.isFinite(range.from) ? range.from : Date.now() - 6 * 86_400_000
        const to = range.mode === 'custom' && Number.isFinite(range.to) ? range.to : Date.now()
        place()
        setStartDate(dateTextOf(from))
        setStartTime(timeTextOf(from))
        setEndDate(dateTextOf(to))
        setEndTime(timeTextOf(to))
        setEndNow(false)
        setError('')
        setOpen(true)
      }
      const confirm = () => {
        const from = parseLocalDateTime(startDate, startTime)
        const to = endNow ? Date.now() : parseLocalDateTime(endDate, endTime)
        if (from === null || to === null || !(from < to)) {
          setError('开始时间需要早于结束时间')
          return
        }
        onChange({ mode: 'custom', from, to })
        setOpen(false)
      }
      return h('div', { className: 'u-range-wrap', ref: rootRef },
        h('button', {
          type: 'button',
          ref: triggerRef,
          className: 'u-range-trigger' + (open ? ' is-open' : ''),
          onClick: () => (open ? setOpen(false) : show()),
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
        },
          h(IconCalendar, { size: 14 }),
          h('span', null, rangeLabelOf(range)),
          h(IconChevronDown, { size: 10 }),
        ),
        open
          ? createPortal(h('div', {
            ref: popRef,
            className: 'u-range-pop',
            role: 'dialog',
            'aria-label': '时间范围',
            style: placement === null ? undefined : {
              position: 'fixed',
              left: `${placement.left}px`,
              top: `${placement.top}px`,
              width: `${placement.width}px`,
            },
          },
            h('div', { className: 'u-range-presets' },
              h('div', { className: 'u-range-heading' }, '快捷范围'),
              RANGE_PRESETS.map((preset) => h('button', {
                key: preset.id,
                type: 'button',
                className: 'u-range-preset' + (range.mode === preset.id ? ' is-active' : ''),
                onClick: () => {
                  onChange({ mode: preset.id, from: null, to: null })
                  setOpen(false)
                },
              }, preset.label)),
            ),
            h('div', { className: 'u-range-custom' },
              h('div', { className: 'u-range-heading' }, '支持日期与时间'),
              h('div', { className: 'u-range-fields' },
                h('div', { className: 'u-range-field' + (calendarField === 'start' ? ' is-active' : '') },
                  h('span', { className: 'u-range-label' }, '开始时间'),
                  h('div', { className: 'u-range-inputs' },
                    h('input', {
                      className: 'u-range-date',
                      value: startDate,
                      'aria-label': '开始日期',
                      onFocus: () => setCalendarField('start'),
                      onChange: (event) => setStartDate(event.target.value),
                      placeholder: 'YYYY-MM-DD',
                    }),
                    h('input', {
                      className: 'u-range-time',
                      type: 'time',
                      value: startTime,
                      'aria-label': '开始时间',
                      onFocus: () => setCalendarField('start'),
                      onChange: (event) => setStartTime(event.target.value),
                    }),
                  ),
                ),
                h('div', { className: 'u-range-field' + (calendarField === 'end' ? ' is-active' : '') },
                  h('span', { className: 'u-range-label' }, '结束时间'),
                  h('div', { className: 'u-range-inputs' },
                    h('input', {
                      className: 'u-range-date',
                      value: endDate,
                      'aria-label': '结束日期',
                      disabled: endNow,
                      onFocus: () => setCalendarField('end'),
                      onChange: (event) => setEndDate(event.target.value),
                      placeholder: 'YYYY-MM-DD',
                    }),
                    h('input', {
                      className: 'u-range-time',
                      type: 'time',
                      value: endTime,
                      'aria-label': '结束时间',
                      disabled: endNow,
                      onFocus: () => setCalendarField('end'),
                      onChange: (event) => setEndTime(event.target.value),
                    }),
                  ),
                ),
              ),
              h('label', { className: 'u-range-check' },
                h('input', { type: 'checkbox', checked: endNow, onChange: (event) => setEndNow(event.target.checked) }),
                h('span', null, '结束时间跟随当前时刻'),
              ),
              error ? h('div', { className: 'u-range-error' }, error) : null,
            ),
            h('div', { className: 'u-range-calendar' },
              h(Calendar, {
                value: calendarField === 'start' ? startDate : endDate,
                onPick: (date) => (calendarField === 'start' ? setStartDate(date) : setEndDate(date)),
              }),
            ),
            h('div', { className: 'u-range-actions' },
              h('button', { type: 'button', className: 'u-range-cancel', onClick: () => setOpen(false) }, '取消'),
              h('button', { type: 'button', className: 'u-range-confirm', onClick: confirm }, '确定'),
            ),
          ), document.body)
          : null,
      )
    }

    function UsageView({ data, phase, error, range, onRange, onRefresh, filters, onFilters, sort, onSort, search, onSearch, sources = ['dsh-session'], onSources, onActivateProvider, activatingProvider = '', onAddProvider, defaultRangeOpen = false, initialMetric = 'tokens', forecastData = null }) {
      const totals = data?.totals ?? {}
      const hostVersion = data?.version
      const staleHost = data !== null && (typeof hostVersion !== 'string' || /^0\\.[012]\\./.test(hostVersion))
      const parts = costParts(totals)
      const priced = Number(totals.pricedRequests) || 0
      const requestCount = Number(totals.requests) || 0
      const costValue = parts.length > 0
        ? parts.map(([currency, value]) => money(value, currency)).join(' + ')
        : requestCount > 0
          ? '未定价'
          : '—'
      const coverage = priced < requestCount ? `已计价 ${num(priced)} / ${num(requestCount)} 次` : ''
      const costSub = requestCount === 0
        ? '当前筛选范围没有请求'
        : parts.length === 0
          ? '暂无可用的模型价目'
          : '按模型价目表估算'
      const rangeText = rangeLabelOf(range)
      const stats = [
        ['总请求数', num(totals.requests), `${rangeText} · ${num(totals.sessions)} 个会话`],
        ['总 Tokens', compact(totals.tokens), `输入 ${compact(totals.input)} · 缓存 ${compact(totals.cacheRead)}`],
        ['缓存命中率', pct(totals.cacheHitRate), `缓存读取 ${compact(totals.cacheRead)}`],
        ['估算花费', costValue, costSub, coverage],
      ]
      const clearFilters = () => onFilters({ workspace: '', provider: '', model: '', session: '' })
      return h('div', { className: 'dsh-usage', 'data-testid': 'dsh-usage-statistics' },
        h('header', { className: 'u-head' },
          h('div', null,
            h('h2', { className: 'u-title' }, '用量统计'),
            h('p', { className: 'u-sub' },
              data
                ? `本地会话扫描 · ${num(data.scanned?.sessions ?? totals.sessions)} 个会话 · 更新于 ${clockOf(data.generatedAt)}`
                : '读取本地会话日志与当前配置余额'),
          ),
          h('div', { className: 'u-head-actions' },
            h(SourcePicker, {
              sources: Array.isArray(data?.sources) ? data.sources : [],
              selected: sources,
              onChange: onSources,
              align: 'right',
            }),
            h(RangeMenu, { range, onChange: onRange, defaultOpen: defaultRangeOpen }),
            h('button', {
              className: 'u-sync' + (phase === 'refreshing' ? ' is-busy' : ''),
              onClick: onRefresh, title: '立即同步', 'aria-label': '立即同步',
            }, h('span', { className: 'u-sync-icon' }, '↻'), h('span', null, '立即同步')),
          ),
        ),
        error ? h('div', { className: 'u-alert' }, `读取失败：${error}`) : null,
        phase === 'loading' && !data
          ? h('div', { className: 'u-loading' },
            h('div', { className: 'u-skeleton' }),
            h('div', { className: 'u-skeleton tall' }),
            h('div', { className: 'u-skeleton' }),
          )
          : data
            ? h(React.Fragment, null,
              h(FilterBar, {
                data,
                filters,
                onChange: onFilters,
                onClear: clearFilters,
                search,
                onSearch,
              }),
              h(Balances, {
                balance: data.balance,
                providers: data.providers,
                onActivate: onActivateProvider,
                onAdd: onAddProvider,
                activating: activatingProvider,
              }),
              h('div', { className: 'u-stats' },
                stats.map(([label, value, sub, tip]) => h('div', { className: 'u-stat', key: label },
                  h('div', { className: 'u-stat-label' }, label, tip ? h('span', { className: 'u-info', title: tip, 'aria-label': tip }, 'ⓘ') : null),
                  h('div', { className: 'u-stat-value', title: String(value) }, value),
                  h('div', { className: 'u-stat-sub', title: tip || sub }, sub),
                )),
              ),
              h(TrendCard, { data, rangeLabel: rangeText, filters, initialMetric, forecastData }),
              h(BreakdownCard, {
                data,
                filters,
                sort,
                onSort,
                onSelectSession: (id) => onFilters({ ...filters, session: id || '' }),
                onSelectWorkspace: (path) => onFilters({ ...filters, workspace: path || '', session: '' }),
                onSelectModel: (row) => {
                  const selected = filters.provider === row.provider && filters.model === row.model
                  onFilters({
                    ...filters,
                    provider: selected ? '' : row.provider,
                    model: selected ? '' : row.model,
                    session: '',
                  })
                },
              }),
              h(RequestsCard, {
                data,
                filters,
                onClearSession: () => onFilters({ ...filters, session: '' }),
              }),
              h('div', { className: 'u-foot' },
                h('span', null, '数据来自 ~/.dsh/sessions，按会话日志增量扫描'),
                h('span', null, `v${data.version || '?'} · 余额缓存 30 秒${data.scan?.errors?.length ? ` · ${data.scan.errors.length} 个日志读取失败` : ''}`),
              ),
            )
            : h('div', { className: 'u-card' }, h('div', { className: 'u-empty' }, '没有可展示的数据')),
      )
    }

    function UsageSection() {
      const [range, setRange] = useState({ mode: 'all', from: null, to: null })
      const [sort, setSort] = useState('active')
      const [filters, setFilters] = useState({ workspace: '', provider: '', model: '', session: '' })
      const [searchInput, setSearchInput] = useState('')
      const [search, setSearch] = useState('')
      const [sources, setSources] = useState(() => {
        try {
          const saved = JSON.parse(window.localStorage.getItem('dsh-usage-compass.sources') ?? 'null')
          if (Array.isArray(saved) && saved.every((id) => typeof id === 'string')) return saved
        } catch {}
        return ['dsh-session']
      })
      const [state, setState] = useState({ phase: 'loading', data: null, forecast: null, error: '' })
      const [tick, setTick] = useState(0)
      const [activating, setActivating] = useState('')
      const forceRef = useRef(false)

      useEffect(() => {
        try {
          window.localStorage.setItem('dsh-usage-compass.sources', JSON.stringify(sources))
        } catch {}
      }, [sources])

      useEffect(() => {
        const timer = setTimeout(() => setSearch(searchInput.trim()), 250)
        return () => clearTimeout(timer)
      }, [searchInput])

      const changeFilters = useCallback((next) => {
        setFilters(next)
      }, [])

      const refresh = useCallback(() => {
        forceRef.current = true
        setTick((value) => value + 1)
      }, [])

      const activateProvider = useCallback(async (provider) => {
        if (provider === null || typeof provider.id !== 'string' || provider.id === '') return
        setActivating(provider.id)
        try {
          const response = await fetch(ACTIVATE_ENDPOINT, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ provider: provider.id }),
          })
          const result = await response.json().catch(() => null)
          if (!response.ok || result?.ok !== true) {
            throw new Error(result?.message || `HTTP ${response.status}`)
          }
          forceRef.current = true
          setTick((value) => value + 1)
        } catch (error) {
          setState((previous) => ({
            ...previous,
            error: `切换供应商失败：${error instanceof Error ? error.message : String(error)}`,
          }))
        } finally {
          setActivating('')
        }
      }, [])

      const openModelSettings = useCallback(() => {
        const candidates = [...document.querySelectorAll('button, a, [role="tab"]')]
        const exact = candidates.filter((element) => (element.textContent ?? '').trim() === '模型')
        const target = exact.find((element) => element.closest('nav, aside')) ?? exact[0]
        if (target !== undefined) {
          target.click()
          return
        }
        setState((previous) => ({ ...previous, error: '请在 设置 → 模型 中添加供应商' }))
      }, [])

      useEffect(() => {
        let cancelled = false
        let running = false
        const run = async () => {
          if (running) return
          running = true
          const force = forceRef.current
          forceRef.current = false
          setState((previous) => ({ ...previous, phase: previous.data ? 'refreshing' : 'loading', error: '' }))
          try {
            const query = new URLSearchParams({ range: range.mode, sort })
            if (range.mode === 'custom') {
              query.set('from', String(range.from))
              query.set('to', String(range.to))
            }
            for (const key of ['workspace', 'provider', 'model', 'session']) {
              if (filters[key]) query.set(key, filters[key])
            }
            query.set('sources', sources.length === 0 ? 'none' : sources.join(','))
            if (search !== '') query.set('q', search)
            if (force) query.set('force', '1')
            const forecastQuery = new URLSearchParams({ range: '30d', sort })
            for (const key of ['workspace', 'provider', 'model', 'session']) {
              if (filters[key]) forecastQuery.set(key, filters[key])
            }
            forecastQuery.set('sources', sources.length === 0 ? 'none' : sources.join(','))
            if (force) forecastQuery.set('force', '1')
            const forecastRequest = fetch(`${ENDPOINT}?${forecastQuery.toString()}`, { cache: 'no-store' })
              .then((response) => response.ok ? response.json() : null)
              .catch(() => null)
            const [response, forecastPayload] = await Promise.all([
              fetch(`${ENDPOINT}?${query.toString()}`, { cache: 'no-store' }),
              forecastRequest,
            ])
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const payload = await response.json()
            if (payload?.ok !== true) throw new Error(payload?.message || '读取失败')
            const forecast = forecastPayload?.ok === true ? forecastPayload : null
            if (!cancelled) setState({ phase: 'ready', data: payload, forecast, error: '' })
          } catch (failure) {
            if (!cancelled) {
              const message = failure instanceof Error ? failure.message : String(failure)
              setState((previous) => ({ phase: previous.data ? 'ready' : 'error', data: previous.data, forecast: previous.forecast, error: message }))
            }
          } finally {
            running = false
          }
        }
        void run()
        const timer = setInterval(() => {
          if (typeof document !== 'undefined' && document.hidden) return
          void run()
        }, POLL_MS)
        return () => {
          cancelled = true
          clearInterval(timer)
        }
      }, [range.mode, range.from, range.to, sort, filters, search, sources, tick])

      return h(UsageView, {
        data: state.data,
        forecastData: state.forecast,
        sources,
        onSources: setSources,
        phase: state.phase,
        error: state.error,
        range,
        onRange: setRange,
        onRefresh: refresh,
        filters,
        onFilters: changeFilters,
        sort,
        onSort: setSort,
        search: searchInput,
        onSearch: setSearchInput,
        onActivateProvider: activateProvider,
        activatingProvider: activating,
        onAddProvider: openModelSettings,
      })
    }

    function apply(ctx) {
      ensureCss()
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'usage-statistics',
        order: 60,
        label: () => '用量统计',
      }, UsageSection))
    }

    module.exports = {
      name: 'dsh-usage-statistics-client',
      inject: ['slots'],
      apply,
      UsageView,
      UsageSection,
      RangeMenu,
    }
    return module.exports
  },
})

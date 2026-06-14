import{f as i,r as o,h as _,j as l,l as y,k as H,v as h,g as m}from"./index-DD-tGv0B.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ee=i("ArrowLeftRight",[["path",{d:"M8 3 4 7l4 4",key:"9rb6wj"}],["path",{d:"M4 7h16",key:"6tx8e3"}],["path",{d:"m16 21 4-4-4-4",key:"siv7j2"}],["path",{d:"M20 17H4",key:"h6l3hr"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ae=i("BedDouble",[["path",{d:"M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8",key:"1k78r4"}],["path",{d:"M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4",key:"fb3tl2"}],["path",{d:"M12 4v6",key:"1dcgq2"}],["path",{d:"M2 18h20",key:"ajqnye"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const te=i("Cloud",[["path",{d:"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z",key:"p7xjir"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const re=i("DollarSign",[["line",{x1:"12",x2:"12",y1:"2",y2:"22",key:"7eqyqh"}],["path",{d:"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",key:"1b0p4s"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ne=i("FolderOpen",[["path",{d:"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2",key:"usdka0"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const se=i("LogOut",[["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",key:"1uf3rs"}],["polyline",{points:"16 17 21 12 16 7",key:"1gabdz"}],["line",{x1:"21",x2:"9",y1:"12",y2:"12",key:"1uyos4"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oe=i("UtensilsCrossed",[["path",{d:"m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8",key:"n7qcjb"}],["path",{d:"M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7",key:"d0u48b"}],["path",{d:"m2.1 21.8 6.4-6.3",key:"yn04lh"}],["path",{d:"m19 5-7 7",key:"194lzd"}]]);var k={exports:{}},A={};/**
 * @license React
 * use-sync-external-store-shim.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var c=o;function F(e,a){return e===a&&(e!==0||1/e===1/a)||e!==e&&a!==a}var D=typeof Object.is=="function"?Object.is:F,q=c.useState,V=c.useEffect,$=c.useLayoutEffect,O=c.useDebugValue;function B(e,a){var t=a(),s=q({inst:{value:t,getSnapshot:a}}),n=s[0].inst,r=s[1];return $(function(){n.value=t,n.getSnapshot=a,v(n)&&r({inst:n})},[e,t,a]),V(function(){return v(n)&&r({inst:n}),e(function(){v(n)&&r({inst:n})})},[e]),O(t),t}function v(e){var a=e.getSnapshot;e=e.value;try{var t=a();return!D(e,t)}catch{return!0}}function P(e,a){return a()}var U=typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"?P:B;A.useSyncExternalStore=c.useSyncExternalStore!==void 0?c.useSyncExternalStore:U;k.exports=A;var T=k.exports;function z(){return T.useSyncExternalStore(G,()=>!0,()=>!1)}function G(){return()=>{}}var g="Avatar",[Z,ue]=_(g),[K,L]=Z(g),w=o.forwardRef((e,a)=>{const{__scopeAvatar:t,...s}=e,[n,r]=o.useState("idle");return l.jsx(K,{scope:t,imageLoadingStatus:n,onImageLoadingStatusChange:r,children:l.jsx(y.span,{...s,ref:a})})});w.displayName=g;var E="AvatarImage",b=o.forwardRef((e,a)=>{const{__scopeAvatar:t,src:s,onLoadingStatusChange:n=()=>{},...r}=e,f=L(E,t),u=W(s,r),d=H(p=>{n(p),f.onImageLoadingStatusChange(p)});return h(()=>{u!=="idle"&&d(u)},[u,d]),u==="loaded"?l.jsx(y.img,{...r,ref:a,src:s}):null});b.displayName=E;var j="AvatarFallback",R=o.forwardRef((e,a)=>{const{__scopeAvatar:t,delayMs:s,...n}=e,r=L(j,t),[f,u]=o.useState(s===void 0);return o.useEffect(()=>{if(s!==void 0){const d=window.setTimeout(()=>u(!0),s);return()=>window.clearTimeout(d)}},[s]),f&&r.imageLoadingStatus!=="loaded"?l.jsx(y.span,{...n,ref:a}):null});R.displayName=j;function x(e,a){return e?a?(e.src!==a&&(e.src=a),e.complete&&e.naturalWidth>0?"loaded":"loading"):"error":"idle"}function W(e,{referrerPolicy:a,crossOrigin:t}){const s=z(),n=o.useRef(null),r=s?(n.current||(n.current=new window.Image),n.current):null,[f,u]=o.useState(()=>x(r,e));return h(()=>{u(x(r,e))},[r,e]),h(()=>{const d=N=>()=>{u(N)};if(!r)return;const p=d("loaded"),S=d("error");return r.addEventListener("load",p),r.addEventListener("error",S),a&&(r.referrerPolicy=a),typeof t=="string"&&(r.crossOrigin=t),()=>{r.removeEventListener("load",p),r.removeEventListener("error",S)}},[r,t,a]),f}var C=w,M=b,I=R;const J=o.forwardRef(({className:e,...a},t)=>l.jsx(C,{ref:t,className:m("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",e),...a}));J.displayName=C.displayName;const Q=o.forwardRef(({className:e,...a},t)=>l.jsx(M,{ref:t,className:m("aspect-square h-full w-full",e),...a}));Q.displayName=M.displayName;const X=o.forwardRef(({className:e,...a},t)=>l.jsx(I,{ref:t,className:m("flex h-full w-full items-center justify-center rounded-full bg-muted",e),...a}));X.displayName=I.displayName;export{J as A,ae as B,te as C,re as D,ne as F,se as L,oe as U,Q as a,X as b,ee as c};

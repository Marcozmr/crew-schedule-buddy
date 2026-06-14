import{f as $,r as n,M as A,j as w,J as z,K as B,N as F,O as K,Q as V,S as D}from"./index-DD-tGv0B.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const X=$("Bell",[["path",{d:"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9",key:"1qo2s2"}],["path",{d:"M10.3 21a1.94 1.94 0 0 0 3.4 0",key:"qgo35s"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Y=$("ChevronLeft",[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _=$("Settings",[["path",{d:"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",key:"1qme2f"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Z=$("User",[["path",{d:"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",key:"975kel"}],["circle",{cx:"12",cy:"7",r:"4",key:"17ys0d"}]]);function H(e,r){if(typeof e=="function")return e(r);e!=null&&(e.current=r)}function W(...e){return r=>{let t=!1;const o=e.map(c=>{const a=H(c,r);return!t&&typeof a=="function"&&(t=!0),a});if(t)return()=>{for(let c=0;c<o.length;c++){const a=o[c];typeof a=="function"?a():H(e[c],null)}}}}function G(...e){return n.useCallback(W(...e),e)}class J extends n.Component{getSnapshotBeforeUpdate(r){const t=this.props.childRef.current;if(z(t)&&r.isPresent&&!this.props.isPresent&&this.props.pop!==!1){const o=t.offsetParent,c=z(o)&&o.offsetWidth||0,a=z(o)&&o.offsetHeight||0,f=getComputedStyle(t),s=this.props.sizeRef.current;s.height=parseFloat(f.height),s.width=parseFloat(f.width),s.top=t.offsetTop,s.left=t.offsetLeft,s.right=c-s.width-s.left,s.bottom=a-s.height-s.top}return null}componentDidUpdate(){}render(){return this.props.children}}function N({children:e,isPresent:r,anchorX:t,anchorY:o,root:c,pop:a}){var l;const f=n.useId(),s=n.useRef(null),v=n.useRef({width:0,height:0,top:0,left:0,right:0,bottom:0}),{nonce:M}=n.useContext(A),u=((l=e.props)==null?void 0:l.ref)??(e==null?void 0:e.ref),x=G(s,u);return n.useInsertionEffect(()=>{const{width:p,height:d,top:y,left:g,right:P,bottom:b}=v.current;if(r||a===!1||!s.current||!p||!d)return;const j=t==="left"?`left: ${g}`:`right: ${P}`,m=o==="bottom"?`bottom: ${b}`:`top: ${y}`;s.current.dataset.motionPopId=f;const C=document.createElement("style");M&&(C.nonce=M);const R=c??document.head;return R.appendChild(C),C.sheet&&C.sheet.insertRule(`
          [data-motion-pop-id="${f}"] {
            position: absolute !important;
            width: ${p}px !important;
            height: ${d}px !important;
            ${j}px !important;
            ${m}px !important;
          }
        `),()=>{var k;(k=s.current)==null||k.removeAttribute("data-motion-pop-id"),R.contains(C)&&R.removeChild(C)}},[r]),w.jsx(J,{isPresent:r,childRef:s,sizeRef:v,pop:a,children:a===!1?e:n.cloneElement(e,{ref:x})})}const O=({children:e,initial:r,isPresent:t,onExitComplete:o,custom:c,presenceAffectsLayout:a,mode:f,anchorX:s,anchorY:v,root:M})=>{const u=B(Q),x=n.useId();let l=!0,p=n.useMemo(()=>(l=!1,{id:x,initial:r,isPresent:t,custom:c,onExitComplete:d=>{u.set(d,!0);for(const y of u.values())if(!y)return;o&&o()},register:d=>(u.set(d,!1),()=>u.delete(d))}),[t,u,o]);return a&&l&&(p={...p}),n.useMemo(()=>{u.forEach((d,y)=>u.set(y,!1))},[t]),n.useEffect(()=>{!t&&!u.size&&o&&o()},[t]),e=w.jsx(N,{pop:f==="popLayout",isPresent:t,anchorX:s,anchorY:v,root:M,children:e}),w.jsx(F.Provider,{value:p,children:e})};function Q(){return new Map}const S=e=>e.key||"";function U(e){const r=[];return n.Children.forEach(e,t=>{n.isValidElement(t)&&r.push(t)}),r}const ee=({children:e,custom:r,initial:t=!0,onExitComplete:o,presenceAffectsLayout:c=!0,mode:a="sync",propagate:f=!1,anchorX:s="left",anchorY:v="top",root:M})=>{const[u,x]=K(f),l=n.useMemo(()=>U(e),[e]),p=f&&!u?[]:l.map(S),d=n.useRef(!0),y=n.useRef(l),g=B(()=>new Map),P=n.useRef(new Set),[b,j]=n.useState(l),[m,C]=n.useState(l);V(()=>{d.current=!1,y.current=l;for(let h=0;h<m.length;h++){const i=S(m[h]);p.includes(i)?(g.delete(i),P.current.delete(i)):g.get(i)!==!0&&g.set(i,!1)}},[m,p.length,p.join("-")]);const R=[];if(l!==b){let h=[...l];for(let i=0;i<m.length;i++){const E=m[i],L=S(E);p.includes(L)||(h.splice(i,0,E),R.push(E))}return a==="wait"&&R.length&&(h=R),C(U(h)),j(l),null}const{forceRender:k}=n.useContext(D);return w.jsx(w.Fragment,{children:m.map(h=>{const i=S(h),E=f&&!u?!1:l===m||p.includes(i),L=()=>{if(P.current.has(i))return;if(g.has(i))P.current.add(i),g.set(i,!0);else return;let I=!0;g.forEach(q=>{q||(I=!1)}),I&&(k==null||k(),C(y.current),f&&(x==null||x()),o&&o())};return w.jsx(O,{isPresent:E,initial:!d.current||t?void 0:!1,custom:r,presenceAffectsLayout:c,mode:a,root:M,onExitComplete:E?void 0:L,anchorX:s,anchorY:v,children:h},i)})})};export{ee as A,X as B,Y as C,_ as S,Z as U};

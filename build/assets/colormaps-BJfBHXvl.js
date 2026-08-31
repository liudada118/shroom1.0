import{j as L,J as h}from"./jetLadder-DfL1wsW_.js";const f="classic";function u(t){const n=Number(t);return!Number.isFinite(n)||n<0?0:n>1?1:n}function x(t,n){const e=u(n)*(t.length-1),a=Math.floor(e),r=Math.min(t.length-1,a+1),s=e-a,o=t[a],l=t[r],c=i=>Math.round(o[i]+(l[i]-o[i])*s);return[c(0),c(1),c(2)]}function b(t){return`linear-gradient(90deg, ${Array.from({length:6},(e,a)=>t(a/5)).join(", ")})`}function g(t,n,e){const a=s=>x(e,s),r=s=>{const[o,l,c]=a(s);return`rgb(${o} ${l} ${c})`};return{id:t,label:n,sample:r,sampleRgb:a,previewCss:b(r)}}function p(t){const n=u(t);return`hsl(${195-n*195} 88% ${42+n*8}%)`}function I(t){const n=u(t),e=(195-n*195)/360,a=(42+n*8)/100,s=(1-Math.abs(2*a-1))*.88,o=e*6,l=s*(1-Math.abs(o%2-1)),c=a-s/2,i=[[s,l,0],[l,s,0],[0,s,l],[0,l,s],[l,0,s],[s,0,l]],[R,w,S]=i[Math.min(5,Math.floor(o))];return[Math.round((R+c)*255),Math.round((w+c)*255),Math.round((S+c)*255)]}function M(t){const{r:n,g:e,b:a}=L(0,1,u(t));return[Math.round(255*n),Math.round(255*e),Math.round(255*a)]}function $(t){const[n,e,a]=M(t);return`rgb(${n} ${e} ${a})`}const V=[{at:0,rgb:[0,0,0]},{at:.14,rgb:[0,0,255]},{at:.28,rgb:[0,102,255]},{at:.42,rgb:[0,255,0]},{at:.56,rgb:[255,255,0]},{at:.7,rgb:[255,102,0]},{at:.84,rgb:[255,0,0]},{at:1,rgb:[255,0,0]}];function _(t,n){const e=u(n);for(let a=0;a<t.length-1;a+=1){const r=t[a+1];if(e<=r.at){const s=t[a],o=r.at-s.at,l=o>0?(e-s.at)/o:0,c=i=>s.rgb[i]+(r.rgb[i]-s.rgb[i])*l;return[c(0),c(1),c(2)]}}return[...t[t.length-1].rgb]}function v(t){return _(V,t).map(e=>Math.round(255*Math.min(1,Math.pow(e/255*1.5,1/2.2))))}function C(t){const[n,e,a]=v(t);return`rgb(${n} ${e} ${a})`}const j=[{id:f,label:"经典蓝红",sample:p,sampleRgb:I,previewCss:b(p)},g("thermal","热成像",[[8,8,20],[120,20,90],[220,50,40],[250,160,30],[255,255,220]]),g("viridis","Viridis",[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]]),g("inferno","Inferno",[[0,0,4],[87,16,110],[188,55,84],[249,142,9],[252,255,164]]),g("grayscale","灰度",[[24,24,24],[128,128,128],[245,245,245]]),g("iceFire","冰火",[[24,90,190],[130,190,235],[245,245,245],[240,150,80],[200,40,40]]),{id:"jet",label:"彩虹 Jet",sample:$,sampleRgb:M,previewCss:b($)},{id:"heatBlobs",label:"斑点热力",sample:C,sampleRgb:v,previewCss:b(C)}],m=new Map(j.map(t=>[t.id,t])),O=f;function d(t){return m.get(String(t||""))||m.get(f)}function y(t){return m.has(String(t||""))}function D(t){const n=typeof t=="string"?t:t==null?void 0:t.id;return!n||n===f}function J(t,n,e={}){const a=d(t),r=u(n);return a.sample(e!=null&&e.reverse?1-r:r)}function N(t,n,e={}){const a=d(t),r=u(n);return a.sampleRgb(e!=null&&e.reverse?1-r:r)}function P(t,n={}){const e=d(t);return n!=null&&n.reverse?e.previewCss.replace("90deg","270deg"):e.previewCss}function B(t="jet1"){const n=r=>Number.isInteger(r)?`${r}.0`:`${r}`,e=r=>{if(typeof r=="number")return n(r);const s=r.slope>0?0:1;return`${n(s)} + ${n(r.slope)} * (t - ${n(r.from)})`},a=h.map((r,s)=>{const o=`    return vec3(${e(r.r)}, ${e(r.g)}, ${e(r.b)});`;return s===h.length-1?o:`  if (t < ${n(r.until)}) {
${o}
  }`}).join(`
`);return`vec3 ${t}(float minVal, float maxVal, float x) {
  if (x < minVal) x = minVal;
  if (x > maxVal) x = maxVal;
  float dv = maxVal - minVal;
  // dv == 0 时 JS 侧的 g 是 NaN，GLSL 侧历来返回纯蓝；照抄 GLSL，画面零变化。
  if (dv == 0.0) return vec3(0.0, 0.0, 1.0);
  float t = (x - minVal) / dv;
${a}
}`}function E(t,n){const e=s=>{const o=Math.round(s*1e6)/1e6;return Number.isInteger(o)?`${o}.0`:`${o}`},a=s=>`vec3(${s.map(o=>e(o/255)).join(", ")})`,r=n.slice(1).map((s,o)=>{const l=n[o],c=`    float t = (p - ${e(l.at)}) / (${e(s.at)} - ${e(l.at)});
    return mix(${a(l.rgb)}, ${a(s.rgb)}, t);`;return o===n.length-2?`  {
${c}
  }`:`  if (p <= ${e(s.at)}) {
${c}
  } else`}).join(`
`);return`vec3 ${t}(float pct) {
  float p = clamp(pct, 0.0, 1.0);
${r}
}`}export{j as C,O as D,V as H,y as a,J as b,P as c,B as d,E as e,d as g,D as i,N as s};

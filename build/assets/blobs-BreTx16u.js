import{H as R,e as A}from"./colormaps-BJfBHXvl.js";import{b as g,d}from"./glUtil-C1oB9ISX.js";const v=`
attribute vec4 a_Position;
uniform vec2 u_resolution;
uniform float u_maxClick;
uniform float u_minClick;
uniform float u_filterClick;
attribute float a_click;
attribute vec2 a_center;
attribute float a_radius;
varying vec2 v_center;
varying vec2 v_resolution;
varying float v_radius;
varying float v_maxClick;
varying float v_minClick;
varying float v_filterClick;
varying float v_click;
void main() {
  gl_PointSize = a_radius * 2.0;
  vec2 clipspace = a_center / u_resolution * 2.0 - 1.0;
  gl_Position = vec4(clipspace * vec2(1, -1), 0, 1);
  v_center = a_center;
  v_resolution = u_resolution;
  v_radius = a_radius - 1.0;
  v_maxClick = u_maxClick;
  v_minClick = u_minClick;
  v_filterClick = u_filterClick;
  v_click = a_click;
}`,E=`
precision mediump float;
varying vec2 v_center;
varying vec2 v_resolution;
varying float v_radius;
varying float v_maxClick;
varying float v_minClick;
varying float v_filterClick;
varying float v_click;
varying float v_groupIdx;
uniform float u_blurFactor;
void main() {
  vec4 color0 = vec4(0.0, 0.0, 0.0, 0.0);
  float x = gl_FragCoord.x;
  float y = v_resolution[1] - gl_FragCoord.y;
  float dx = v_center[0] - x;
  float dy = v_center[1] - y;
  float distance = sqrt(dx*dx + dy*dy);
  float diff = v_radius-distance;
  float currentPercent=0.95;
  float blurFactory=u_blurFactor;
  float pxAlpha=0.0;
  if(v_maxClick>= v_click && v_click>= v_minClick){
    pxAlpha = (v_click-v_minClick)/(v_maxClick-v_minClick);
  }
  if(v_click>= v_maxClick){
    pxAlpha = 1.0;
  }
  if ( diff >  0.0 ) {
    if(diff > v_radius * blurFactory) {
      gl_FragColor = vec4(0,0,0,pxAlpha);
    } else {
      float p=diff/(v_radius*blurFactory);
      gl_FragColor = vec4(0,0,0,p*pxAlpha);
    }
  } else {
    if ( diff >= 0.0 && diff <= 1.0 ){
    }
    else{
      gl_FragColor = vec4(0,0,0,0);
    }
  }
}`,h=`
attribute vec4 a_Position;
void main(void){
  gl_Position = a_Position;
}`,T=.03;function B(l={}){const t=l.stops||R,o=Number.isFinite(l.alphaCutoff)?l.alphaCutoff:T;return`
precision mediump float;
uniform vec2 u_resolution;
uniform sampler2D u_Sampler;

vec3 linearToSRGB(vec3 color){
  return pow(color * 1.5, vec3(1.0/2.2));
}

${A("getColorByPercent",t)}

void main(void){
  vec2 uv = vec2(gl_FragCoord.x / u_resolution.x, gl_FragCoord.y / u_resolution.y);
  vec4 c = texture2D(u_Sampler, uv);
  float p_alpha = c.a;
  if(p_alpha > ${o.toFixed(4)}){
    vec3 col = getColorByPercent(p_alpha);
    col = linearToSRGB(col);
    gl_FragColor = vec4(col, 1.0);
  }else{
    discard;
  }
}`}const C=B(),p=3e3,s=3;let m=null;function x(){if(m)return m;if(typeof document>"u")throw new Error("[webglHeatmap] 需要 DOM：blobs.js 只能在浏览器里绘制");return m=document.createElement("canvas"),m.className="webgl",m}function y(l){const t=l.glCache;if(!t)return;const{gl:o}=t;d(o,{...t.blob||{},textures:[t.texture].filter(Boolean),buffers:[t.pointBuffer,t.quadBuffer].filter(Boolean)}),d(o,t.composite||{}),t.framebuffer&&o.deleteFramebuffer(t.framebuffer),t.renderbuffer&&o.deleteRenderbuffer(t.renderbuffer),l.glCache=null}function k(l,t,o){if(l.glCache&&l.glCache.width===t&&l.glCache.height===o)return l.glCache;y(l),l.width=t,l.height=o;const e=l.getContext("webgl");if(!e)return null;const r=g(e,v,E),i=g(e,h,C);if(!r||!i)return null;const a=e.createTexture();e.bindTexture(e.TEXTURE_2D,a),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,t,o,0,e.RGBA,e.UNSIGNED_BYTE,null),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR);const n=e.createRenderbuffer();e.bindRenderbuffer(e.RENDERBUFFER,n),e.renderbufferStorage(e.RENDERBUFFER,e.DEPTH_COMPONENT16,t,o);const c=e.createFramebuffer();if(e.bindFramebuffer(e.FRAMEBUFFER,c),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,a,0),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.DEPTH_ATTACHMENT,e.RENDERBUFFER,n),e.checkFramebufferStatus(e.FRAMEBUFFER)!==e.FRAMEBUFFER_COMPLETE)return e.bindFramebuffer(e.FRAMEBUFFER,null),null;e.bindFramebuffer(e.FRAMEBUFFER,null);const u={gl:e,width:t,height:o,blob:r,composite:i,texture:a,renderbuffer:n,framebuffer:c,pointBuffer:e.createBuffer(),quadBuffer:e.createBuffer(),blobUniforms:{resolution:e.getUniformLocation(r.program,"u_resolution"),maxClick:e.getUniformLocation(r.program,"u_maxClick"),minClick:e.getUniformLocation(r.program,"u_minClick"),filterClick:e.getUniformLocation(r.program,"u_filterClick"),blurFactor:e.getUniformLocation(r.program,"u_blurFactor")},blobAttribs:{center:e.getAttribLocation(r.program,"a_center"),radius:e.getAttribLocation(r.program,"a_radius"),click:e.getAttribLocation(r.program,"a_click")},compositeUniforms:{resolution:e.getUniformLocation(i.program,"u_resolution")},compositeAttribs:{position:e.getAttribLocation(i.program,"a_Position")}};return e.bindBuffer(e.ARRAY_BUFFER,u.quadBuffer),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,-1,1,1,-1,1,1]),e.STATIC_DRAW),l.glCache=u,u}class _{constructor(){this.vertexShader=v,this.fragmentShader=E,this.vertexShader1=h,this.fragmentShader1=C}}_.prototype.bufferCuter=function(t){const o=[];let e=t.splice(0,p);for(;e.length>0;)o.push(e),e=t.splice(0,p);return o.map(r=>{const i=new Float32Array(r.length*s);for(let a=0;a<r.length;a+=1)i[a*s]=r[a][0],i[a*s+1]=r[a][1],i[a*s+2]=r[a][2];return i})};_.prototype.dataCuter=function(t,o,e){const r=[];for(let i=0;i<o.length;i+=1)for(let a=0;a<o[i].length;a+=1)o[i][a]=parseInt(o[i][a],10);o.sort((i,a)=>i[1]-a[1]);for(let i=0;i<o.length;i+=1){const[a,n,c]=o[i],u=n%t.height,f=Math.floor(n/t.height);r[f]||(r[f]=[]),r[f].push([a,n-f*t.height,c]),t.height-u<e&&(r[f+1]||(r[f+1]=[]),r[f+1].push([a,n-(f+1)*t.height,c])),u<e&&f-1>=0&&(r[f-1]||(r[f-1]=[]),r[f-1].push([a,t.height+u,c]))}return r};_.prototype.getNearPower=function(t){return t};_.prototype.createTplCanvas=function(t,o){const e=x(),r=t.width||2048,i=t.height||1024,a=k(e,r,i);return a?(e.glObj={canvas:e,data:o,cfg:t,gl:a.gl},e.resetCfg=n=>{e.glObj.cfg=n,F(e,n,e.glObj.data)},F(e,t,o),e):null};function F(l,t,o){const e=l.glCache;if(!e)return;const{gl:r,blob:i,composite:a,blobUniforms:n,blobAttribs:c}=e;r.clearColor(0,0,0,0),r.disable(r.DEPTH_TEST),r.enable(r.BLEND),r.blendEquation(r.FUNC_ADD),r.blendFunc(r.SRC_ALPHA,r.ONE),r.viewport(0,0,e.width,e.height),r.useProgram(i.program),r.uniform2f(n.resolution,e.width,e.height),r.uniform1f(n.maxClick,t.max),r.uniform1f(n.minClick,t.min),r.uniform1f(n.filterClick,t.filter),r.uniform1f(n.blurFactor,t.blurFactor!=null?t.blurFactor:.55),r.vertexAttrib1f(c.radius,t.radius+1),r.bindFramebuffer(r.FRAMEBUFFER,e.framebuffer),r.clear(r.COLOR_BUFFER_BIT);const u=s*Float32Array.BYTES_PER_ELEMENT;r.bindBuffer(r.ARRAY_BUFFER,e.pointBuffer),r.enableVertexAttribArray(c.center),r.enableVertexAttribArray(c.click),r.vertexAttribPointer(c.center,2,r.FLOAT,!1,u,0),r.vertexAttribPointer(c.click,1,r.FLOAT,!1,u,Float32Array.BYTES_PER_ELEMENT*2);for(let f=0;f<o.length;f+=1){const b=o[f];r.bufferData(r.ARRAY_BUFFER,b,r.STATIC_DRAW),r.drawArrays(r.POINTS,0,b.length/s)}r.bindFramebuffer(r.FRAMEBUFFER,null),r.clear(r.COLOR_BUFFER_BIT),r.useProgram(a.program),r.uniform2f(e.compositeUniforms.resolution,e.width,e.height),r.bindBuffer(r.ARRAY_BUFFER,e.quadBuffer),r.enableVertexAttribArray(e.compositeAttribs.position),r.vertexAttribPointer(e.compositeAttribs.position,2,r.FLOAT,!1,0,0),r.drawArrays(r.TRIANGLE_STRIP,0,4)}_.prototype.render=function(t,o){t.width=this.getNearPower(t.width),t.height=this.getNearPower(t.height);const e=[],r=this.dataCuter(t,o,0);for(let i=0;i<r.length;i+=1){if(!r[i])continue;const a=this.createTplCanvas(t,this.bufferCuter(r[i]));a&&e.push(a)}return e};_.prototype.reset=function(t,o){var e,r;for(let i=0;i<o.length;i+=1)(r=(e=o[i])==null?void 0:e.resetCfg)==null||r.call(e,t)};export{_ as W};

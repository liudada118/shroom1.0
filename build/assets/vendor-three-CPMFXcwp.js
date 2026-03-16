/**
 * @license
 * Copyright 2010-2021 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Sa="127",ng={ROTATE:0,DOLLY:1,PAN:2},El=0,Qs=1,Tl=2,Ea=1,Al=2,Kn=3,ur=0,Qt=1,dr=2,Ta=1,ni=0,ii=1,$s=2,Ks=3,to=4,Ll=5,An=100,Rl=101,Cl=102,eo=103,no=104,Pl=200,Dl=201,Il=202,Nl=203,Aa=204,La=205,Fl=206,Bl=207,Ol=208,zl=209,Ul=210,Hl=0,Gl=1,kl=2,is=3,Vl=4,Wl=5,ql=6,Xl=7,fr=0,jl=1,Yl=2,ri=0,Zl=1,Jl=2,Ql=3,$l=4,Kl=5,Ra=300,Ts=301,As=302,io=303,ro=304,Ls=306,Rs=307,rs=1e3,me=1001,ss=1002,ae=1003,so=1004,oo=1005,te=1006,tc=1007,pr=1008,Cs=1009,ec=1010,nc=1011,tr=1012,ic=1013,Ki=1014,Ye=1015,er=1016,rc=1017,sc=1018,oc=1019,si=1020,ac=1021,on=1022,Te=1023,lc=1024,cc=1025,Pn=1026,ci=1027,hc=1028,uc=1029,dc=1030,fc=1031,pc=1032,mc=1033,ao=33776,lo=33777,co=33778,ho=33779,uo=35840,fo=35841,po=35842,mo=35843,gc=36196,go=37492,xo=37496,xc=37808,vc=37809,yc=37810,_c=37811,bc=37812,Mc=37813,wc=37814,Sc=37815,Ec=37816,Tc=37817,Ac=37818,Lc=37819,Rc=37820,Cc=37821,Pc=36492,Dc=37840,Ic=37841,Nc=37842,Fc=37843,Bc=37844,Oc=37845,zc=37846,Uc=37847,Hc=37848,Gc=37849,kc=37850,Vc=37851,Wc=37852,qc=37853,Xc=2200,jc=2201,Yc=2202,nr=2300,ir=2301,Sr=2302,Ln=2400,Rn=2401,rr=2402,Ps=2500,Ca=2501,Zc=0,ig=1,rg=2,yi=3e3,Pa=3001,Jc=3007,Qc=3002,$c=3003,Kc=3004,th=3005,eh=3006,nh=3200,ih=3201,Bn=0,rh=1,Er=7680,sh=519,_i=35044,hi=35048,vo="300 es";function $e(){}Object.assign($e.prototype,{addEventListener:function(n,t){this._listeners===void 0&&(this._listeners={});const e=this._listeners;e[n]===void 0&&(e[n]=[]),e[n].indexOf(t)===-1&&e[n].push(t)},hasEventListener:function(n,t){if(this._listeners===void 0)return!1;const e=this._listeners;return e[n]!==void 0&&e[n].indexOf(t)!==-1},removeEventListener:function(n,t){if(this._listeners===void 0)return;const i=this._listeners[n];if(i!==void 0){const r=i.indexOf(t);r!==-1&&i.splice(r,1)}},dispatchEvent:function(n){if(this._listeners===void 0)return;const e=this._listeners[n.type];if(e!==void 0){n.target=this;const i=e.slice(0);for(let r=0,s=i.length;r<s;r++)i[r].call(this,n);n.target=null}}});const Kt=[];for(let n=0;n<256;n++)Kt[n]=(n<16?"0":"")+n.toString(16);let wi=1234567;const bt={DEG2RAD:Math.PI/180,RAD2DEG:180/Math.PI,generateUUID:function(){const n=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Kt[n&255]+Kt[n>>8&255]+Kt[n>>16&255]+Kt[n>>24&255]+"-"+Kt[t&255]+Kt[t>>8&255]+"-"+Kt[t>>16&15|64]+Kt[t>>24&255]+"-"+Kt[e&63|128]+Kt[e>>8&255]+"-"+Kt[e>>16&255]+Kt[e>>24&255]+Kt[i&255]+Kt[i>>8&255]+Kt[i>>16&255]+Kt[i>>24&255]).toUpperCase()},clamp:function(n,t,e){return Math.max(t,Math.min(e,n))},euclideanModulo:function(n,t){return(n%t+t)%t},mapLinear:function(n,t,e,i,r){return i+(n-t)*(r-i)/(e-t)},inverseLerp:function(n,t,e){return n!==t?(e-n)/(t-n):0},lerp:function(n,t,e){return(1-e)*n+e*t},damp:function(n,t,e,i){return bt.lerp(n,t,1-Math.exp(-e*i))},pingpong:function(n,t=1){return t-Math.abs(bt.euclideanModulo(n,t*2)-t)},smoothstep:function(n,t,e){return n<=t?0:n>=e?1:(n=(n-t)/(e-t),n*n*(3-2*n))},smootherstep:function(n,t,e){return n<=t?0:n>=e?1:(n=(n-t)/(e-t),n*n*n*(n*(n*6-15)+10))},randInt:function(n,t){return n+Math.floor(Math.random()*(t-n+1))},randFloat:function(n,t){return n+Math.random()*(t-n)},randFloatSpread:function(n){return n*(.5-Math.random())},seededRandom:function(n){return n!==void 0&&(wi=n%2147483647),wi=wi*16807%2147483647,(wi-1)/2147483646},degToRad:function(n){return n*bt.DEG2RAD},radToDeg:function(n){return n*bt.RAD2DEG},isPowerOfTwo:function(n){return(n&n-1)===0&&n!==0},ceilPowerOfTwo:function(n){return Math.pow(2,Math.ceil(Math.log(n)/Math.LN2))},floorPowerOfTwo:function(n){return Math.pow(2,Math.floor(Math.log(n)/Math.LN2))},setQuaternionFromProperEuler:function(n,t,e,i,r){const s=Math.cos,o=Math.sin,a=s(e/2),l=o(e/2),c=s((t+i)/2),u=o((t+i)/2),h=s((t-i)/2),d=o((t-i)/2),f=s((i-t)/2),m=o((i-t)/2);switch(r){case"XYX":n.set(a*u,l*h,l*d,a*c);break;case"YZY":n.set(l*d,a*u,l*h,a*c);break;case"ZXZ":n.set(l*h,l*d,a*u,a*c);break;case"XZX":n.set(a*u,l*m,l*f,a*c);break;case"YXY":n.set(l*f,a*u,l*m,a*c);break;case"ZYZ":n.set(l*m,l*f,a*u,a*c);break;default:}}};class Y{constructor(t=0,e=0){this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t,e){return e!==void 0?this.addVectors(t,e):(this.x+=t.x,this.y+=t.y,this)}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t,e){return e!==void 0?this.subVectors(t,e):(this.x-=t.x,this.y-=t.y,this)}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const e=this.x,i=this.y,r=t.elements;return this.x=r[0]*e+r[3]*i+r[6],this.y=r[1]*e+r[4]*i+r[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(t,Math.min(e,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=this.x<0?Math.ceil(this.x):Math.floor(this.x),this.y=this.y<0?Math.ceil(this.y):Math.floor(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,i=this.y-t.y;return e*e+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e,i){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){const i=Math.cos(e),r=Math.sin(e),s=this.x-t.x,o=this.y-t.y;return this.x=s*i-o*r+t.x,this.y=s*r+o*i+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}}Y.prototype.isVector2=!0;class ee{constructor(){this.elements=[1,0,0,0,1,0,0,0,1],arguments.length>0}set(t,e,i,r,s,o,a,l,c){const u=this.elements;return u[0]=t,u[1]=r,u[2]=a,u[3]=e,u[4]=s,u[5]=l,u[6]=i,u[7]=o,u[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const e=this.elements,i=t.elements;return e[0]=i[0],e[1]=i[1],e[2]=i[2],e[3]=i[3],e[4]=i[4],e[5]=i[5],e[6]=i[6],e[7]=i[7],e[8]=i[8],this}extractBasis(t,e,i){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const i=t.elements,r=e.elements,s=this.elements,o=i[0],a=i[3],l=i[6],c=i[1],u=i[4],h=i[7],d=i[2],f=i[5],m=i[8],x=r[0],v=r[3],g=r[6],p=r[1],E=r[4],S=r[7],A=r[2],y=r[5],I=r[8];return s[0]=o*x+a*p+l*A,s[3]=o*v+a*E+l*y,s[6]=o*g+a*S+l*I,s[1]=c*x+u*p+h*A,s[4]=c*v+u*E+h*y,s[7]=c*g+u*S+h*I,s[2]=d*x+f*p+m*A,s[5]=d*v+f*E+m*y,s[8]=d*g+f*S+m*I,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){const t=this.elements,e=t[0],i=t[1],r=t[2],s=t[3],o=t[4],a=t[5],l=t[6],c=t[7],u=t[8];return e*o*u-e*a*c-i*s*u+i*a*l+r*s*c-r*o*l}invert(){const t=this.elements,e=t[0],i=t[1],r=t[2],s=t[3],o=t[4],a=t[5],l=t[6],c=t[7],u=t[8],h=u*o-a*c,d=a*l-u*s,f=c*s-o*l,m=e*h+i*d+r*f;if(m===0)return this.set(0,0,0,0,0,0,0,0,0);const x=1/m;return t[0]=h*x,t[1]=(r*c-u*i)*x,t[2]=(a*i-r*o)*x,t[3]=d*x,t[4]=(u*e-r*l)*x,t[5]=(r*s-a*e)*x,t[6]=f*x,t[7]=(i*l-c*e)*x,t[8]=(o*e-i*s)*x,this}transpose(){let t;const e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,i,r,s,o,a){const l=Math.cos(s),c=Math.sin(s);return this.set(i*l,i*c,-i*(l*o+c*a)+o+t,-r*c,r*l,-r*(-c*o+l*a)+a+e,0,0,1),this}scale(t,e){const i=this.elements;return i[0]*=t,i[3]*=t,i[6]*=t,i[1]*=e,i[4]*=e,i[7]*=e,this}rotate(t){const e=Math.cos(t),i=Math.sin(t),r=this.elements,s=r[0],o=r[3],a=r[6],l=r[1],c=r[4],u=r[7];return r[0]=e*s+i*l,r[3]=e*o+i*c,r[6]=e*a+i*u,r[1]=-i*s+e*l,r[4]=-i*o+e*c,r[7]=-i*a+e*u,this}translate(t,e){const i=this.elements;return i[0]+=t*i[2],i[3]+=t*i[5],i[6]+=t*i[8],i[1]+=e*i[2],i[4]+=e*i[5],i[7]+=e*i[8],this}equals(t){const e=this.elements,i=t.elements;for(let r=0;r<9;r++)if(e[r]!==i[r])return!1;return!0}fromArray(t,e=0){for(let i=0;i<9;i++)this.elements[i]=t[i+e];return this}toArray(t=[],e=0){const i=this.elements;return t[e]=i[0],t[e+1]=i[1],t[e+2]=i[2],t[e+3]=i[3],t[e+4]=i[4],t[e+5]=i[5],t[e+6]=i[6],t[e+7]=i[7],t[e+8]=i[8],t}clone(){return new this.constructor().fromArray(this.elements)}}ee.prototype.isMatrix3=!0;let hn;const On={getDataURL:function(n){if(/^data:/i.test(n.src)||typeof HTMLCanvasElement>"u")return n.src;let t;if(n instanceof HTMLCanvasElement)t=n;else{hn===void 0&&(hn=document.createElementNS("http://www.w3.org/1999/xhtml","canvas")),hn.width=n.width,hn.height=n.height;const e=hn.getContext("2d");n instanceof ImageData?e.putImageData(n,0,0):e.drawImage(n,0,0,n.width,n.height),t=hn}return t.width>2048||t.height>2048?t.toDataURL("image/jpeg",.6):t.toDataURL("image/png")}};let oh=0;class ne extends $e{constructor(t=ne.DEFAULT_IMAGE,e=ne.DEFAULT_MAPPING,i=me,r=me,s=te,o=pr,a=Te,l=Cs,c=1,u=yi){super(),Object.defineProperty(this,"id",{value:oh++}),this.uuid=bt.generateUUID(),this.name="",this.image=t,this.mipmaps=[],this.mapping=e,this.wrapS=i,this.wrapT=r,this.magFilter=s,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new Y(0,0),this.repeat=new Y(1,1),this.center=new Y(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new ee,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.encoding=u,this.version=0,this.onUpdate=null}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.image=t.image,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.encoding=t.encoding,this}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const i={metadata:{version:4.5,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,mapping:this.mapping,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,type:this.type,encoding:this.encoding,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};if(this.image!==void 0){const r=this.image;if(r.uuid===void 0&&(r.uuid=bt.generateUUID()),!e&&t.images[r.uuid]===void 0){let s;if(Array.isArray(r)){s=[];for(let o=0,a=r.length;o<a;o++)r[o].isDataTexture?s.push(Tr(r[o].image)):s.push(Tr(r[o]))}else s=Tr(r);t.images[r.uuid]={uuid:r.uuid,url:s}}i.image=r.uuid}return e||(t.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==Ra)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case rs:t.x=t.x-Math.floor(t.x);break;case me:t.x=t.x<0?0:1;break;case ss:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case rs:t.y=t.y-Math.floor(t.y);break;case me:t.y=t.y<0?0:1;break;case ss:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&this.version++}}ne.DEFAULT_IMAGE=void 0;ne.DEFAULT_MAPPING=Ra;ne.prototype.isTexture=!0;function Tr(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?On.getDataURL(n):n.data?{data:Array.prototype.slice.call(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:{}}class Bt{constructor(t=0,e=0,i=0,r=1){this.x=t,this.y=e,this.z=i,this.w=r}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,i,r){return this.x=t,this.y=e,this.z=i,this.w=r,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t,e){return e!==void 0?this.addVectors(t,e):(this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this)}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t,e){return e!==void 0?this.subVectors(t,e):(this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this)}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const e=this.x,i=this.y,r=this.z,s=this.w,o=t.elements;return this.x=o[0]*e+o[4]*i+o[8]*r+o[12]*s,this.y=o[1]*e+o[5]*i+o[9]*r+o[13]*s,this.z=o[2]*e+o[6]*i+o[10]*r+o[14]*s,this.w=o[3]*e+o[7]*i+o[11]*r+o[15]*s,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,i,r,s;const l=t.elements,c=l[0],u=l[4],h=l[8],d=l[1],f=l[5],m=l[9],x=l[2],v=l[6],g=l[10];if(Math.abs(u-d)<.01&&Math.abs(h-x)<.01&&Math.abs(m-v)<.01){if(Math.abs(u+d)<.1&&Math.abs(h+x)<.1&&Math.abs(m+v)<.1&&Math.abs(c+f+g-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;const E=(c+1)/2,S=(f+1)/2,A=(g+1)/2,y=(u+d)/4,I=(h+x)/4,O=(m+v)/4;return E>S&&E>A?E<.01?(i=0,r=.707106781,s=.707106781):(i=Math.sqrt(E),r=y/i,s=I/i):S>A?S<.01?(i=.707106781,r=0,s=.707106781):(r=Math.sqrt(S),i=y/r,s=O/r):A<.01?(i=.707106781,r=.707106781,s=0):(s=Math.sqrt(A),i=I/s,r=O/s),this.set(i,r,s,e),this}let p=Math.sqrt((v-m)*(v-m)+(h-x)*(h-x)+(d-u)*(d-u));return Math.abs(p)<.001&&(p=1),this.x=(v-m)/p,this.y=(h-x)/p,this.z=(d-u)/p,this.w=Math.acos((c+f+g-1)/2),this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(t,Math.min(e,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=this.x<0?Math.ceil(this.x):Math.floor(this.x),this.y=this.y<0?Math.ceil(this.y):Math.floor(this.y),this.z=this.z<0?Math.ceil(this.z):Math.floor(this.z),this.w=this.w<0?Math.ceil(this.w):Math.floor(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this.z=t.z+(e.z-t.z)*i,this.w=t.w+(e.w-t.w)*i,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e,i){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}}Bt.prototype.isVector4=!0;class an extends $e{constructor(t,e,i){super(),this.width=t,this.height=e,this.depth=1,this.scissor=new Bt(0,0,t,e),this.scissorTest=!1,this.viewport=new Bt(0,0,t,e),i=i||{},this.texture=new ne(void 0,i.mapping,i.wrapS,i.wrapT,i.magFilter,i.minFilter,i.format,i.type,i.anisotropy,i.encoding),this.texture.image={},this.texture.image.width=t,this.texture.image.height=e,this.texture.image.depth=1,this.texture.generateMipmaps=i.generateMipmaps!==void 0?i.generateMipmaps:!1,this.texture.minFilter=i.minFilter!==void 0?i.minFilter:te,this.depthBuffer=i.depthBuffer!==void 0?i.depthBuffer:!0,this.stencilBuffer=i.stencilBuffer!==void 0?i.stencilBuffer:!1,this.depthTexture=i.depthTexture!==void 0?i.depthTexture:null}setTexture(t){t.image={width:this.width,height:this.height,depth:this.depth},this.texture=t}setSize(t,e,i=1){(this.width!==t||this.height!==e||this.depth!==i)&&(this.width=t,this.height=e,this.depth=i,this.texture.image.width=t,this.texture.image.height=e,this.texture.image.depth=i,this.dispose()),this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.width=t.width,this.height=t.height,this.depth=t.depth,this.viewport.copy(t.viewport),this.texture=t.texture.clone(),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.depthTexture=t.depthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}}an.prototype.isWebGLRenderTarget=!0;class ah extends an{constructor(t,e,i){super(t,e,i),this.samples=4}copy(t){return super.copy.call(this,t),this.samples=t.samples,this}}ah.prototype.isWebGLMultisampleRenderTarget=!0;class le{constructor(t=0,e=0,i=0,r=1){this._x=t,this._y=e,this._z=i,this._w=r}static slerp(t,e,i,r){return i.slerpQuaternions(t,e,r)}static slerpFlat(t,e,i,r,s,o,a){let l=i[r+0],c=i[r+1],u=i[r+2],h=i[r+3];const d=s[o+0],f=s[o+1],m=s[o+2],x=s[o+3];if(a===0){t[e+0]=l,t[e+1]=c,t[e+2]=u,t[e+3]=h;return}if(a===1){t[e+0]=d,t[e+1]=f,t[e+2]=m,t[e+3]=x;return}if(h!==x||l!==d||c!==f||u!==m){let v=1-a;const g=l*d+c*f+u*m+h*x,p=g>=0?1:-1,E=1-g*g;if(E>Number.EPSILON){const A=Math.sqrt(E),y=Math.atan2(A,g*p);v=Math.sin(v*y)/A,a=Math.sin(a*y)/A}const S=a*p;if(l=l*v+d*S,c=c*v+f*S,u=u*v+m*S,h=h*v+x*S,v===1-a){const A=1/Math.sqrt(l*l+c*c+u*u+h*h);l*=A,c*=A,u*=A,h*=A}}t[e]=l,t[e+1]=c,t[e+2]=u,t[e+3]=h}static multiplyQuaternionsFlat(t,e,i,r,s,o){const a=i[r],l=i[r+1],c=i[r+2],u=i[r+3],h=s[o],d=s[o+1],f=s[o+2],m=s[o+3];return t[e]=a*m+u*h+l*f-c*d,t[e+1]=l*m+u*d+c*h-a*f,t[e+2]=c*m+u*f+a*d-l*h,t[e+3]=u*m-a*h-l*d-c*f,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,i,r){return this._x=t,this._y=e,this._z=i,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e){if(!(t&&t.isEuler))throw new Error("THREE.Quaternion: .setFromEuler() now expects an Euler rotation rather than a Vector3 and order.");const i=t._x,r=t._y,s=t._z,o=t._order,a=Math.cos,l=Math.sin,c=a(i/2),u=a(r/2),h=a(s/2),d=l(i/2),f=l(r/2),m=l(s/2);switch(o){case"XYZ":this._x=d*u*h+c*f*m,this._y=c*f*h-d*u*m,this._z=c*u*m+d*f*h,this._w=c*u*h-d*f*m;break;case"YXZ":this._x=d*u*h+c*f*m,this._y=c*f*h-d*u*m,this._z=c*u*m-d*f*h,this._w=c*u*h+d*f*m;break;case"ZXY":this._x=d*u*h-c*f*m,this._y=c*f*h+d*u*m,this._z=c*u*m+d*f*h,this._w=c*u*h-d*f*m;break;case"ZYX":this._x=d*u*h-c*f*m,this._y=c*f*h+d*u*m,this._z=c*u*m-d*f*h,this._w=c*u*h+d*f*m;break;case"YZX":this._x=d*u*h+c*f*m,this._y=c*f*h+d*u*m,this._z=c*u*m-d*f*h,this._w=c*u*h-d*f*m;break;case"XZY":this._x=d*u*h-c*f*m,this._y=c*f*h-d*u*m,this._z=c*u*m+d*f*h,this._w=c*u*h+d*f*m;break;default:}return e!==!1&&this._onChangeCallback(),this}setFromAxisAngle(t,e){const i=e/2,r=Math.sin(i);return this._x=t.x*r,this._y=t.y*r,this._z=t.z*r,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(t){const e=t.elements,i=e[0],r=e[4],s=e[8],o=e[1],a=e[5],l=e[9],c=e[2],u=e[6],h=e[10],d=i+a+h;if(d>0){const f=.5/Math.sqrt(d+1);this._w=.25/f,this._x=(u-l)*f,this._y=(s-c)*f,this._z=(o-r)*f}else if(i>a&&i>h){const f=2*Math.sqrt(1+i-a-h);this._w=(u-l)/f,this._x=.25*f,this._y=(r+o)/f,this._z=(s+c)/f}else if(a>h){const f=2*Math.sqrt(1+a-i-h);this._w=(s-c)/f,this._x=(r+o)/f,this._y=.25*f,this._z=(l+u)/f}else{const f=2*Math.sqrt(1+h-i-a);this._w=(o-r)/f,this._x=(s+c)/f,this._y=(l+u)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let i=t.dot(e)+1;return i<Number.EPSILON?(i=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=i):(this._x=0,this._y=-t.z,this._z=t.y,this._w=i)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=i),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(bt.clamp(this.dot(t),-1,1)))}rotateTowards(t,e){const i=this.angleTo(t);if(i===0)return this;const r=Math.min(1,e/i);return this.slerp(t,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t,e){return e!==void 0?this.multiplyQuaternions(t,e):this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){const i=t._x,r=t._y,s=t._z,o=t._w,a=e._x,l=e._y,c=e._z,u=e._w;return this._x=i*u+o*a+r*c-s*l,this._y=r*u+o*l+s*a-i*c,this._z=s*u+o*c+i*l-r*a,this._w=o*u-i*a-r*l-s*c,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);const i=this._x,r=this._y,s=this._z,o=this._w;let a=o*t._w+i*t._x+r*t._y+s*t._z;if(a<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,a=-a):this.copy(t),a>=1)return this._w=o,this._x=i,this._y=r,this._z=s,this;const l=1-a*a;if(l<=Number.EPSILON){const f=1-e;return this._w=f*o+e*this._w,this._x=f*i+e*this._x,this._y=f*r+e*this._y,this._z=f*s+e*this._z,this.normalize(),this._onChangeCallback(),this}const c=Math.sqrt(l),u=Math.atan2(c,a),h=Math.sin((1-e)*u)/c,d=Math.sin(e*u)/c;return this._w=o*h+this._w*d,this._x=i*h+this._x*d,this._y=r*h+this._y*d,this._z=s*h+this._z*d,this._onChangeCallback(),this}slerpQuaternions(t,e,i){this.copy(t).slerp(e,i)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}}le.prototype.isQuaternion=!0;class M{constructor(t=0,e=0,i=0){this.x=t,this.y=e,this.z=i}set(t,e,i){return i===void 0&&(i=this.z),this.x=t,this.y=e,this.z=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t,e){return e!==void 0?this.addVectors(t,e):(this.x+=t.x,this.y+=t.y,this.z+=t.z,this)}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t,e){return e!==void 0?this.subVectors(t,e):(this.x-=t.x,this.y-=t.y,this.z-=t.z,this)}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t,e){return e!==void 0?this.multiplyVectors(t,e):(this.x*=t.x,this.y*=t.y,this.z*=t.z,this)}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return t&&t.isEuler,this.applyQuaternion(yo.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(yo.setFromAxisAngle(t,e))}applyMatrix3(t){const e=this.x,i=this.y,r=this.z,s=t.elements;return this.x=s[0]*e+s[3]*i+s[6]*r,this.y=s[1]*e+s[4]*i+s[7]*r,this.z=s[2]*e+s[5]*i+s[8]*r,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const e=this.x,i=this.y,r=this.z,s=t.elements,o=1/(s[3]*e+s[7]*i+s[11]*r+s[15]);return this.x=(s[0]*e+s[4]*i+s[8]*r+s[12])*o,this.y=(s[1]*e+s[5]*i+s[9]*r+s[13])*o,this.z=(s[2]*e+s[6]*i+s[10]*r+s[14])*o,this}applyQuaternion(t){const e=this.x,i=this.y,r=this.z,s=t.x,o=t.y,a=t.z,l=t.w,c=l*e+o*r-a*i,u=l*i+a*e-s*r,h=l*r+s*i-o*e,d=-s*e-o*i-a*r;return this.x=c*l+d*-s+u*-a-h*-o,this.y=u*l+d*-o+h*-s-c*-a,this.z=h*l+d*-a+c*-o-u*-s,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const e=this.x,i=this.y,r=this.z,s=t.elements;return this.x=s[0]*e+s[4]*i+s[8]*r,this.y=s[1]*e+s[5]*i+s[9]*r,this.z=s[2]*e+s[6]*i+s[10]*r,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(t,Math.min(e,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=this.x<0?Math.ceil(this.x):Math.floor(this.x),this.y=this.y<0?Math.ceil(this.y):Math.floor(this.y),this.z=this.z<0?Math.ceil(this.z):Math.floor(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this.z=t.z+(e.z-t.z)*i,this}cross(t,e){return e!==void 0?this.crossVectors(t,e):this.crossVectors(this,t)}crossVectors(t,e){const i=t.x,r=t.y,s=t.z,o=e.x,a=e.y,l=e.z;return this.x=r*l-s*a,this.y=s*o-i*l,this.z=i*a-r*o,this}projectOnVector(t){const e=t.lengthSq();if(e===0)return this.set(0,0,0);const i=t.dot(this)/e;return this.copy(t).multiplyScalar(i)}projectOnPlane(t){return Ar.copy(this).projectOnVector(t),this.sub(Ar)}reflect(t){return this.sub(Ar.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const i=this.dot(t)/e;return Math.acos(bt.clamp(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,i=this.y-t.y,r=this.z-t.z;return e*e+i*i+r*r}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,i){const r=Math.sin(e)*t;return this.x=r*Math.sin(i),this.y=Math.cos(e)*t,this.z=r*Math.cos(i),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,i){return this.x=t*Math.sin(e),this.y=i,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){const e=this.setFromMatrixColumn(t,0).length(),i=this.setFromMatrixColumn(t,1).length(),r=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=i,this.z=r,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e,i){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}}M.prototype.isVector3=!0;const Ar=new M,yo=new le;class _e{constructor(t=new M(1/0,1/0,1/0),e=new M(-1/0,-1/0,-1/0)){this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){let e=1/0,i=1/0,r=1/0,s=-1/0,o=-1/0,a=-1/0;for(let l=0,c=t.length;l<c;l+=3){const u=t[l],h=t[l+1],d=t[l+2];u<e&&(e=u),h<i&&(i=h),d<r&&(r=d),u>s&&(s=u),h>o&&(o=h),d>a&&(a=d)}return this.min.set(e,i,r),this.max.set(s,o,a),this}setFromBufferAttribute(t){let e=1/0,i=1/0,r=1/0,s=-1/0,o=-1/0,a=-1/0;for(let l=0,c=t.count;l<c;l++){const u=t.getX(l),h=t.getY(l),d=t.getZ(l);u<e&&(e=u),h<i&&(i=h),d<r&&(r=d),u>s&&(s=u),h>o&&(o=h),d>a&&(a=d)}return this.min.set(e,i,r),this.max.set(s,o,a),this}setFromPoints(t){this.makeEmpty();for(let e=0,i=t.length;e<i;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const i=Vn.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(i),this.max.copy(t).add(i),this}setFromObject(t){return this.makeEmpty(),this.expandByObject(t)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return t===void 0&&(t=new M),this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return t===void 0&&(t=new M),this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t){t.updateWorldMatrix(!1,!1);const e=t.geometry;e!==void 0&&(e.boundingBox===null&&e.computeBoundingBox(),Lr.copy(e.boundingBox),Lr.applyMatrix4(t.matrixWorld),this.union(Lr));const i=t.children;for(let r=0,s=i.length;r<s;r++)this.expandByObject(i[r]);return this}containsPoint(t){return!(t.x<this.min.x||t.x>this.max.x||t.y<this.min.y||t.y>this.max.y||t.z<this.min.z||t.z>this.max.z)}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e===void 0&&(e=new M),e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return!(t.max.x<this.min.x||t.min.x>this.max.x||t.max.y<this.min.y||t.min.y>this.max.y||t.max.z<this.min.z||t.min.z>this.max.z)}intersectsSphere(t){return this.clampPoint(t.center,Vn),Vn.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,i;return t.normal.x>0?(e=t.normal.x*this.min.x,i=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,i=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,i+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,i+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,i+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,i+=t.normal.z*this.min.z),e<=-t.constant&&i>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Wn),Si.subVectors(this.max,Wn),un.subVectors(t.a,Wn),dn.subVectors(t.b,Wn),fn.subVectors(t.c,Wn),He.subVectors(dn,un),Ge.subVectors(fn,dn),rn.subVectors(un,fn);let e=[0,-He.z,He.y,0,-Ge.z,Ge.y,0,-rn.z,rn.y,He.z,0,-He.x,Ge.z,0,-Ge.x,rn.z,0,-rn.x,-He.y,He.x,0,-Ge.y,Ge.x,0,-rn.y,rn.x,0];return!Rr(e,un,dn,fn,Si)||(e=[1,0,0,0,1,0,0,0,1],!Rr(e,un,dn,fn,Si))?!1:(Ei.crossVectors(He,Ge),e=[Ei.x,Ei.y,Ei.z],Rr(e,un,dn,fn,Si))}clampPoint(t,e){return e===void 0&&(e=new M),e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return Vn.copy(t).clamp(this.min,this.max).sub(t).length()}getBoundingSphere(t){return this.getCenter(t.center),t.radius=this.getSize(Vn).length()*.5,t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(Fe[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),Fe[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),Fe[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),Fe[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),Fe[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),Fe[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),Fe[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),Fe[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(Fe),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}}_e.prototype.isBox3=!0;const Fe=[new M,new M,new M,new M,new M,new M,new M,new M],Vn=new M,Lr=new _e,un=new M,dn=new M,fn=new M,He=new M,Ge=new M,rn=new M,Wn=new M,Si=new M,Ei=new M,sn=new M;function Rr(n,t,e,i,r){for(let s=0,o=n.length-3;s<=o;s+=3){sn.fromArray(n,s);const a=r.x*Math.abs(sn.x)+r.y*Math.abs(sn.y)+r.z*Math.abs(sn.z),l=t.dot(sn),c=e.dot(sn),u=i.dot(sn);if(Math.max(-Math.max(l,c,u),Math.min(l,c,u))>a)return!1}return!0}const lh=new _e,_o=new M,Cr=new M,Pr=new M;class zn{constructor(t=new M,e=-1){this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){const i=this.center;e!==void 0?i.copy(e):lh.setFromPoints(t).getCenter(i);let r=0;for(let s=0,o=t.length;s<o;s++)r=Math.max(r,i.distanceToSquared(t[s]));return this.radius=Math.sqrt(r),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){const i=this.center.distanceToSquared(t);return e===void 0&&(e=new M),e.copy(t),i>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return t===void 0&&(t=new _e),this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){Pr.subVectors(t,this.center);const e=Pr.lengthSq();if(e>this.radius*this.radius){const i=Math.sqrt(e),r=(i-this.radius)*.5;this.center.add(Pr.multiplyScalar(r/i)),this.radius+=r}return this}union(t){return Cr.subVectors(t.center,this.center).normalize().multiplyScalar(t.radius),this.expandByPoint(_o.copy(t.center).add(Cr)),this.expandByPoint(_o.copy(t.center).sub(Cr)),this}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}}const Be=new M,Dr=new M,Ti=new M,ke=new M,Ir=new M,Ai=new M,Nr=new M;class cn{constructor(t=new M,e=new M(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e===void 0&&(e=new M),e.copy(this.direction).multiplyScalar(t).add(this.origin)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,Be)),this}closestPointToPoint(t,e){e===void 0&&(e=new M),e.subVectors(t,this.origin);const i=e.dot(this.direction);return i<0?e.copy(this.origin):e.copy(this.direction).multiplyScalar(i).add(this.origin)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const e=Be.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(Be.copy(this.direction).multiplyScalar(e).add(this.origin),Be.distanceToSquared(t))}distanceSqToSegment(t,e,i,r){Dr.copy(t).add(e).multiplyScalar(.5),Ti.copy(e).sub(t).normalize(),ke.copy(this.origin).sub(Dr);const s=t.distanceTo(e)*.5,o=-this.direction.dot(Ti),a=ke.dot(this.direction),l=-ke.dot(Ti),c=ke.lengthSq(),u=Math.abs(1-o*o);let h,d,f,m;if(u>0)if(h=o*l-a,d=o*a-l,m=s*u,h>=0)if(d>=-m)if(d<=m){const x=1/u;h*=x,d*=x,f=h*(h+o*d+2*a)+d*(o*h+d+2*l)+c}else d=s,h=Math.max(0,-(o*d+a)),f=-h*h+d*(d+2*l)+c;else d=-s,h=Math.max(0,-(o*d+a)),f=-h*h+d*(d+2*l)+c;else d<=-m?(h=Math.max(0,-(-o*s+a)),d=h>0?-s:Math.min(Math.max(-s,-l),s),f=-h*h+d*(d+2*l)+c):d<=m?(h=0,d=Math.min(Math.max(-s,-l),s),f=d*(d+2*l)+c):(h=Math.max(0,-(o*s+a)),d=h>0?s:Math.min(Math.max(-s,-l),s),f=-h*h+d*(d+2*l)+c);else d=o>0?-s:s,h=Math.max(0,-(o*d+a)),f=-h*h+d*(d+2*l)+c;return i&&i.copy(this.direction).multiplyScalar(h).add(this.origin),r&&r.copy(Ti).multiplyScalar(d).add(Dr),f}intersectSphere(t,e){Be.subVectors(t.center,this.origin);const i=Be.dot(this.direction),r=Be.dot(Be)-i*i,s=t.radius*t.radius;if(r>s)return null;const o=Math.sqrt(s-r),a=i-o,l=i+o;return a<0&&l<0?null:a<0?this.at(l,e):this.at(a,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;const i=-(this.origin.dot(t.normal)+t.constant)/e;return i>=0?i:null}intersectPlane(t,e){const i=this.distanceToPlane(t);return i===null?null:this.at(i,e)}intersectsPlane(t){const e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let i,r,s,o,a,l;const c=1/this.direction.x,u=1/this.direction.y,h=1/this.direction.z,d=this.origin;return c>=0?(i=(t.min.x-d.x)*c,r=(t.max.x-d.x)*c):(i=(t.max.x-d.x)*c,r=(t.min.x-d.x)*c),u>=0?(s=(t.min.y-d.y)*u,o=(t.max.y-d.y)*u):(s=(t.max.y-d.y)*u,o=(t.min.y-d.y)*u),i>o||s>r||((s>i||i!==i)&&(i=s),(o<r||r!==r)&&(r=o),h>=0?(a=(t.min.z-d.z)*h,l=(t.max.z-d.z)*h):(a=(t.max.z-d.z)*h,l=(t.min.z-d.z)*h),i>l||a>r)||((a>i||i!==i)&&(i=a),(l<r||r!==r)&&(r=l),r<0)?null:this.at(i>=0?i:r,e)}intersectsBox(t){return this.intersectBox(t,Be)!==null}intersectTriangle(t,e,i,r,s){Ir.subVectors(e,t),Ai.subVectors(i,t),Nr.crossVectors(Ir,Ai);let o=this.direction.dot(Nr),a;if(o>0){if(r)return null;a=1}else if(o<0)a=-1,o=-o;else return null;ke.subVectors(this.origin,t);const l=a*this.direction.dot(Ai.crossVectors(ke,Ai));if(l<0)return null;const c=a*this.direction.dot(Ir.cross(ke));if(c<0||l+c>o)return null;const u=-a*ke.dot(Nr);return u<0?null:this.at(u/o,s)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class ot{constructor(){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],arguments.length>0}set(t,e,i,r,s,o,a,l,c,u,h,d,f,m,x,v){const g=this.elements;return g[0]=t,g[4]=e,g[8]=i,g[12]=r,g[1]=s,g[5]=o,g[9]=a,g[13]=l,g[2]=c,g[6]=u,g[10]=h,g[14]=d,g[3]=f,g[7]=m,g[11]=x,g[15]=v,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new ot().fromArray(this.elements)}copy(t){const e=this.elements,i=t.elements;return e[0]=i[0],e[1]=i[1],e[2]=i[2],e[3]=i[3],e[4]=i[4],e[5]=i[5],e[6]=i[6],e[7]=i[7],e[8]=i[8],e[9]=i[9],e[10]=i[10],e[11]=i[11],e[12]=i[12],e[13]=i[13],e[14]=i[14],e[15]=i[15],this}copyPosition(t){const e=this.elements,i=t.elements;return e[12]=i[12],e[13]=i[13],e[14]=i[14],this}setFromMatrix3(t){const e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,i){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this}makeBasis(t,e,i){return this.set(t.x,e.x,i.x,0,t.y,e.y,i.y,0,t.z,e.z,i.z,0,0,0,0,1),this}extractRotation(t){const e=this.elements,i=t.elements,r=1/pn.setFromMatrixColumn(t,0).length(),s=1/pn.setFromMatrixColumn(t,1).length(),o=1/pn.setFromMatrixColumn(t,2).length();return e[0]=i[0]*r,e[1]=i[1]*r,e[2]=i[2]*r,e[3]=0,e[4]=i[4]*s,e[5]=i[5]*s,e[6]=i[6]*s,e[7]=0,e[8]=i[8]*o,e[9]=i[9]*o,e[10]=i[10]*o,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){t&&t.isEuler;const e=this.elements,i=t.x,r=t.y,s=t.z,o=Math.cos(i),a=Math.sin(i),l=Math.cos(r),c=Math.sin(r),u=Math.cos(s),h=Math.sin(s);if(t.order==="XYZ"){const d=o*u,f=o*h,m=a*u,x=a*h;e[0]=l*u,e[4]=-l*h,e[8]=c,e[1]=f+m*c,e[5]=d-x*c,e[9]=-a*l,e[2]=x-d*c,e[6]=m+f*c,e[10]=o*l}else if(t.order==="YXZ"){const d=l*u,f=l*h,m=c*u,x=c*h;e[0]=d+x*a,e[4]=m*a-f,e[8]=o*c,e[1]=o*h,e[5]=o*u,e[9]=-a,e[2]=f*a-m,e[6]=x+d*a,e[10]=o*l}else if(t.order==="ZXY"){const d=l*u,f=l*h,m=c*u,x=c*h;e[0]=d-x*a,e[4]=-o*h,e[8]=m+f*a,e[1]=f+m*a,e[5]=o*u,e[9]=x-d*a,e[2]=-o*c,e[6]=a,e[10]=o*l}else if(t.order==="ZYX"){const d=o*u,f=o*h,m=a*u,x=a*h;e[0]=l*u,e[4]=m*c-f,e[8]=d*c+x,e[1]=l*h,e[5]=x*c+d,e[9]=f*c-m,e[2]=-c,e[6]=a*l,e[10]=o*l}else if(t.order==="YZX"){const d=o*l,f=o*c,m=a*l,x=a*c;e[0]=l*u,e[4]=x-d*h,e[8]=m*h+f,e[1]=h,e[5]=o*u,e[9]=-a*u,e[2]=-c*u,e[6]=f*h+m,e[10]=d-x*h}else if(t.order==="XZY"){const d=o*l,f=o*c,m=a*l,x=a*c;e[0]=l*u,e[4]=-h,e[8]=c*u,e[1]=d*h+x,e[5]=o*u,e[9]=f*h-m,e[2]=m*h-f,e[6]=a*u,e[10]=x*h+d}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(ch,t,hh)}lookAt(t,e,i){const r=this.elements;return fe.subVectors(t,e),fe.lengthSq()===0&&(fe.z=1),fe.normalize(),Ve.crossVectors(i,fe),Ve.lengthSq()===0&&(Math.abs(i.z)===1?fe.x+=1e-4:fe.z+=1e-4,fe.normalize(),Ve.crossVectors(i,fe)),Ve.normalize(),Li.crossVectors(fe,Ve),r[0]=Ve.x,r[4]=Li.x,r[8]=fe.x,r[1]=Ve.y,r[5]=Li.y,r[9]=fe.y,r[2]=Ve.z,r[6]=Li.z,r[10]=fe.z,this}multiply(t,e){return e!==void 0?this.multiplyMatrices(t,e):this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const i=t.elements,r=e.elements,s=this.elements,o=i[0],a=i[4],l=i[8],c=i[12],u=i[1],h=i[5],d=i[9],f=i[13],m=i[2],x=i[6],v=i[10],g=i[14],p=i[3],E=i[7],S=i[11],A=i[15],y=r[0],I=r[4],O=r[8],F=r[12],V=r[1],P=r[5],q=r[9],R=r[13],L=r[2],N=r[6],C=r[10],W=r[14],K=r[3],j=r[7],rt=r[11],st=r[15];return s[0]=o*y+a*V+l*L+c*K,s[4]=o*I+a*P+l*N+c*j,s[8]=o*O+a*q+l*C+c*rt,s[12]=o*F+a*R+l*W+c*st,s[1]=u*y+h*V+d*L+f*K,s[5]=u*I+h*P+d*N+f*j,s[9]=u*O+h*q+d*C+f*rt,s[13]=u*F+h*R+d*W+f*st,s[2]=m*y+x*V+v*L+g*K,s[6]=m*I+x*P+v*N+g*j,s[10]=m*O+x*q+v*C+g*rt,s[14]=m*F+x*R+v*W+g*st,s[3]=p*y+E*V+S*L+A*K,s[7]=p*I+E*P+S*N+A*j,s[11]=p*O+E*q+S*C+A*rt,s[15]=p*F+E*R+S*W+A*st,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){const t=this.elements,e=t[0],i=t[4],r=t[8],s=t[12],o=t[1],a=t[5],l=t[9],c=t[13],u=t[2],h=t[6],d=t[10],f=t[14],m=t[3],x=t[7],v=t[11],g=t[15];return m*(+s*l*h-r*c*h-s*a*d+i*c*d+r*a*f-i*l*f)+x*(+e*l*f-e*c*d+s*o*d-r*o*f+r*c*u-s*l*u)+v*(+e*c*h-e*a*f-s*o*h+i*o*f+s*a*u-i*c*u)+g*(-r*a*u-e*l*h+e*a*d+r*o*h-i*o*d+i*l*u)}transpose(){const t=this.elements;let e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,i){const r=this.elements;return t.isVector3?(r[12]=t.x,r[13]=t.y,r[14]=t.z):(r[12]=t,r[13]=e,r[14]=i),this}invert(){const t=this.elements,e=t[0],i=t[1],r=t[2],s=t[3],o=t[4],a=t[5],l=t[6],c=t[7],u=t[8],h=t[9],d=t[10],f=t[11],m=t[12],x=t[13],v=t[14],g=t[15],p=h*v*c-x*d*c+x*l*f-a*v*f-h*l*g+a*d*g,E=m*d*c-u*v*c-m*l*f+o*v*f+u*l*g-o*d*g,S=u*x*c-m*h*c+m*a*f-o*x*f-u*a*g+o*h*g,A=m*h*l-u*x*l-m*a*d+o*x*d+u*a*v-o*h*v,y=e*p+i*E+r*S+s*A;if(y===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const I=1/y;return t[0]=p*I,t[1]=(x*d*s-h*v*s-x*r*f+i*v*f+h*r*g-i*d*g)*I,t[2]=(a*v*s-x*l*s+x*r*c-i*v*c-a*r*g+i*l*g)*I,t[3]=(h*l*s-a*d*s-h*r*c+i*d*c+a*r*f-i*l*f)*I,t[4]=E*I,t[5]=(u*v*s-m*d*s+m*r*f-e*v*f-u*r*g+e*d*g)*I,t[6]=(m*l*s-o*v*s-m*r*c+e*v*c+o*r*g-e*l*g)*I,t[7]=(o*d*s-u*l*s+u*r*c-e*d*c-o*r*f+e*l*f)*I,t[8]=S*I,t[9]=(m*h*s-u*x*s-m*i*f+e*x*f+u*i*g-e*h*g)*I,t[10]=(o*x*s-m*a*s+m*i*c-e*x*c-o*i*g+e*a*g)*I,t[11]=(u*a*s-o*h*s-u*i*c+e*h*c+o*i*f-e*a*f)*I,t[12]=A*I,t[13]=(u*x*r-m*h*r+m*i*d-e*x*d-u*i*v+e*h*v)*I,t[14]=(m*a*r-o*x*r-m*i*l+e*x*l+o*i*v-e*a*v)*I,t[15]=(o*h*r-u*a*r+u*i*l-e*h*l-o*i*d+e*a*d)*I,this}scale(t){const e=this.elements,i=t.x,r=t.y,s=t.z;return e[0]*=i,e[4]*=r,e[8]*=s,e[1]*=i,e[5]*=r,e[9]*=s,e[2]*=i,e[6]*=r,e[10]*=s,e[3]*=i,e[7]*=r,e[11]*=s,this}getMaxScaleOnAxis(){const t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],i=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],r=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,i,r))}makeTranslation(t,e,i){return this.set(1,0,0,t,0,1,0,e,0,0,1,i,0,0,0,1),this}makeRotationX(t){const e=Math.cos(t),i=Math.sin(t);return this.set(1,0,0,0,0,e,-i,0,0,i,e,0,0,0,0,1),this}makeRotationY(t){const e=Math.cos(t),i=Math.sin(t);return this.set(e,0,i,0,0,1,0,0,-i,0,e,0,0,0,0,1),this}makeRotationZ(t){const e=Math.cos(t),i=Math.sin(t);return this.set(e,-i,0,0,i,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){const i=Math.cos(e),r=Math.sin(e),s=1-i,o=t.x,a=t.y,l=t.z,c=s*o,u=s*a;return this.set(c*o+i,c*a-r*l,c*l+r*a,0,c*a+r*l,u*a+i,u*l-r*o,0,c*l-r*a,u*l+r*o,s*l*l+i,0,0,0,0,1),this}makeScale(t,e,i){return this.set(t,0,0,0,0,e,0,0,0,0,i,0,0,0,0,1),this}makeShear(t,e,i){return this.set(1,e,i,0,t,1,i,0,t,e,1,0,0,0,0,1),this}compose(t,e,i){const r=this.elements,s=e._x,o=e._y,a=e._z,l=e._w,c=s+s,u=o+o,h=a+a,d=s*c,f=s*u,m=s*h,x=o*u,v=o*h,g=a*h,p=l*c,E=l*u,S=l*h,A=i.x,y=i.y,I=i.z;return r[0]=(1-(x+g))*A,r[1]=(f+S)*A,r[2]=(m-E)*A,r[3]=0,r[4]=(f-S)*y,r[5]=(1-(d+g))*y,r[6]=(v+p)*y,r[7]=0,r[8]=(m+E)*I,r[9]=(v-p)*I,r[10]=(1-(d+x))*I,r[11]=0,r[12]=t.x,r[13]=t.y,r[14]=t.z,r[15]=1,this}decompose(t,e,i){const r=this.elements;let s=pn.set(r[0],r[1],r[2]).length();const o=pn.set(r[4],r[5],r[6]).length(),a=pn.set(r[8],r[9],r[10]).length();this.determinant()<0&&(s=-s),t.x=r[12],t.y=r[13],t.z=r[14],Me.copy(this);const c=1/s,u=1/o,h=1/a;return Me.elements[0]*=c,Me.elements[1]*=c,Me.elements[2]*=c,Me.elements[4]*=u,Me.elements[5]*=u,Me.elements[6]*=u,Me.elements[8]*=h,Me.elements[9]*=h,Me.elements[10]*=h,e.setFromRotationMatrix(Me),i.x=s,i.y=o,i.z=a,this}makePerspective(t,e,i,r,s,o){const a=this.elements,l=2*s/(e-t),c=2*s/(i-r),u=(e+t)/(e-t),h=(i+r)/(i-r),d=-(o+s)/(o-s),f=-2*o*s/(o-s);return a[0]=l,a[4]=0,a[8]=u,a[12]=0,a[1]=0,a[5]=c,a[9]=h,a[13]=0,a[2]=0,a[6]=0,a[10]=d,a[14]=f,a[3]=0,a[7]=0,a[11]=-1,a[15]=0,this}makeOrthographic(t,e,i,r,s,o){const a=this.elements,l=1/(e-t),c=1/(i-r),u=1/(o-s),h=(e+t)*l,d=(i+r)*c,f=(o+s)*u;return a[0]=2*l,a[4]=0,a[8]=0,a[12]=-h,a[1]=0,a[5]=2*c,a[9]=0,a[13]=-d,a[2]=0,a[6]=0,a[10]=-2*u,a[14]=-f,a[3]=0,a[7]=0,a[11]=0,a[15]=1,this}equals(t){const e=this.elements,i=t.elements;for(let r=0;r<16;r++)if(e[r]!==i[r])return!1;return!0}fromArray(t,e=0){for(let i=0;i<16;i++)this.elements[i]=t[i+e];return this}toArray(t=[],e=0){const i=this.elements;return t[e]=i[0],t[e+1]=i[1],t[e+2]=i[2],t[e+3]=i[3],t[e+4]=i[4],t[e+5]=i[5],t[e+6]=i[6],t[e+7]=i[7],t[e+8]=i[8],t[e+9]=i[9],t[e+10]=i[10],t[e+11]=i[11],t[e+12]=i[12],t[e+13]=i[13],t[e+14]=i[14],t[e+15]=i[15],t}}ot.prototype.isMatrix4=!0;const pn=new M,Me=new ot,ch=new M(0,0,0),hh=new M(1,1,1),Ve=new M,Li=new M,fe=new M,bo=new ot,Mo=new le;class Un{constructor(t=0,e=0,i=0,r=Un.DefaultOrder){this._x=t,this._y=e,this._z=i,this._order=r}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,i,r){return this._x=t,this._y=e,this._z=i,this._order=r||this._order,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e,i){const r=bt.clamp,s=t.elements,o=s[0],a=s[4],l=s[8],c=s[1],u=s[5],h=s[9],d=s[2],f=s[6],m=s[10];switch(e=e||this._order,e){case"XYZ":this._y=Math.asin(r(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,m),this._z=Math.atan2(-a,o)):(this._x=Math.atan2(f,u),this._z=0);break;case"YXZ":this._x=Math.asin(-r(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(l,m),this._z=Math.atan2(c,u)):(this._y=Math.atan2(-d,o),this._z=0);break;case"ZXY":this._x=Math.asin(r(f,-1,1)),Math.abs(f)<.9999999?(this._y=Math.atan2(-d,m),this._z=Math.atan2(-a,u)):(this._y=0,this._z=Math.atan2(c,o));break;case"ZYX":this._y=Math.asin(-r(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(f,m),this._z=Math.atan2(c,o)):(this._x=0,this._z=Math.atan2(-a,u));break;case"YZX":this._z=Math.asin(r(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-h,u),this._y=Math.atan2(-d,o)):(this._x=0,this._y=Math.atan2(l,m));break;case"XZY":this._z=Math.asin(-r(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(f,u),this._y=Math.atan2(l,o)):(this._x=Math.atan2(-h,m),this._y=0);break;default:}return this._order=e,i!==!1&&this._onChangeCallback(),this}setFromQuaternion(t,e,i){return bo.makeRotationFromQuaternion(t),this.setFromRotationMatrix(bo,e,i)}setFromVector3(t,e){return this.set(t.x,t.y,t.z,e||this._order)}reorder(t){return Mo.setFromEuler(this),this.setFromQuaternion(Mo,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}toVector3(t){return t?t.set(this._x,this._y,this._z):new M(this._x,this._y,this._z)}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}}Un.prototype.isEuler=!0;Un.DefaultOrder="XYZ";Un.RotationOrders=["XYZ","YZX","ZXY","XZY","YXZ","ZYX"];class Da{constructor(){this.mask=1}set(t){this.mask=1<<t|0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}}let uh=0;const wo=new M,mn=new le,Oe=new ot,Ri=new M,qn=new M,dh=new M,fh=new le,So=new M(1,0,0),Eo=new M(0,1,0),To=new M(0,0,1),ph={type:"added"},Ao={type:"removed"};function gt(){Object.defineProperty(this,"id",{value:uh++}),this.uuid=bt.generateUUID(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=gt.DefaultUp.clone();const n=new M,t=new Un,e=new le,i=new M(1,1,1);function r(){e.setFromEuler(t,!1)}function s(){t.setFromQuaternion(e,void 0,!1)}t._onChange(r),e._onChange(s),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:n},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:e},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new ot},normalMatrix:{value:new ee}}),this.matrix=new ot,this.matrixWorld=new ot,this.matrixAutoUpdate=gt.DefaultMatrixAutoUpdate,this.matrixWorldNeedsUpdate=!1,this.layers=new Da,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}gt.DefaultUp=new M(0,1,0);gt.DefaultMatrixAutoUpdate=!0;gt.prototype=Object.assign(Object.create($e.prototype),{constructor:gt,isObject3D:!0,onBeforeRender:function(){},onAfterRender:function(){},applyMatrix4:function(n){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(n),this.matrix.decompose(this.position,this.quaternion,this.scale)},applyQuaternion:function(n){return this.quaternion.premultiply(n),this},setRotationFromAxisAngle:function(n,t){this.quaternion.setFromAxisAngle(n,t)},setRotationFromEuler:function(n){this.quaternion.setFromEuler(n,!0)},setRotationFromMatrix:function(n){this.quaternion.setFromRotationMatrix(n)},setRotationFromQuaternion:function(n){this.quaternion.copy(n)},rotateOnAxis:function(n,t){return mn.setFromAxisAngle(n,t),this.quaternion.multiply(mn),this},rotateOnWorldAxis:function(n,t){return mn.setFromAxisAngle(n,t),this.quaternion.premultiply(mn),this},rotateX:function(n){return this.rotateOnAxis(So,n)},rotateY:function(n){return this.rotateOnAxis(Eo,n)},rotateZ:function(n){return this.rotateOnAxis(To,n)},translateOnAxis:function(n,t){return wo.copy(n).applyQuaternion(this.quaternion),this.position.add(wo.multiplyScalar(t)),this},translateX:function(n){return this.translateOnAxis(So,n)},translateY:function(n){return this.translateOnAxis(Eo,n)},translateZ:function(n){return this.translateOnAxis(To,n)},localToWorld:function(n){return n.applyMatrix4(this.matrixWorld)},worldToLocal:function(n){return n.applyMatrix4(Oe.copy(this.matrixWorld).invert())},lookAt:function(n,t,e){n.isVector3?Ri.copy(n):Ri.set(n,t,e);const i=this.parent;this.updateWorldMatrix(!0,!1),qn.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Oe.lookAt(qn,Ri,this.up):Oe.lookAt(Ri,qn,this.up),this.quaternion.setFromRotationMatrix(Oe),i&&(Oe.extractRotation(i.matrixWorld),mn.setFromRotationMatrix(Oe),this.quaternion.premultiply(mn.invert()))},add:function(n){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return n===this?this:(n&&n.isObject3D&&(n.parent!==null&&n.parent.remove(n),n.parent=this,this.children.push(n),n.dispatchEvent(ph)),this)},remove:function(n){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.remove(arguments[e]);return this}const t=this.children.indexOf(n);return t!==-1&&(n.parent=null,this.children.splice(t,1),n.dispatchEvent(Ao)),this},clear:function(){for(let n=0;n<this.children.length;n++){const t=this.children[n];t.parent=null,t.dispatchEvent(Ao)}return this.children.length=0,this},attach:function(n){return this.updateWorldMatrix(!0,!1),Oe.copy(this.matrixWorld).invert(),n.parent!==null&&(n.parent.updateWorldMatrix(!0,!1),Oe.multiply(n.parent.matrixWorld)),n.applyMatrix4(Oe),this.add(n),n.updateWorldMatrix(!1,!0),this},getObjectById:function(n){return this.getObjectByProperty("id",n)},getObjectByName:function(n){return this.getObjectByProperty("name",n)},getObjectByProperty:function(n,t){if(this[n]===t)return this;for(let e=0,i=this.children.length;e<i;e++){const s=this.children[e].getObjectByProperty(n,t);if(s!==void 0)return s}},getWorldPosition:function(n){return n===void 0&&(n=new M),this.updateWorldMatrix(!0,!1),n.setFromMatrixPosition(this.matrixWorld)},getWorldQuaternion:function(n){return n===void 0&&(n=new le),this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(qn,n,dh),n},getWorldScale:function(n){return n===void 0&&(n=new M),this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(qn,fh,n),n},getWorldDirection:function(n){n===void 0&&(n=new M),this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return n.set(t[8],t[9],t[10]).normalize()},raycast:function(){},traverse:function(n){n(this);const t=this.children;for(let e=0,i=t.length;e<i;e++)t[e].traverse(n)},traverseVisible:function(n){if(this.visible===!1)return;n(this);const t=this.children;for(let e=0,i=t.length;e<i;e++)t[e].traverseVisible(n)},traverseAncestors:function(n){const t=this.parent;t!==null&&(n(t),t.traverseAncestors(n))},updateMatrix:function(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0},updateMatrixWorld:function(n){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),this.matrixWorldNeedsUpdate=!1,n=!0);const t=this.children;for(let e=0,i=t.length;e<i;e++)t[e].updateMatrixWorld(n)},updateWorldMatrix:function(n,t){const e=this.parent;if(n===!0&&e!==null&&e.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),t===!0){const i=this.children;for(let r=0,s=i.length;r<s;r++)i[r].updateWorldMatrix(!1,!0)}},toJSON:function(n){const t=n===void 0||typeof n=="string",e={};t&&(n={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{}},e.metadata={version:4.5,type:"Object",generator:"Object3D.toJSON"});const i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),JSON.stringify(this.userData)!=="{}"&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON()));function r(o,a){return o[a.uuid]===void 0&&(o[a.uuid]=a.toJSON(n)),a.uuid}if(this.isMesh||this.isLine||this.isPoints){i.geometry=r(n.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const a=o.shapes;if(Array.isArray(a))for(let l=0,c=a.length;l<c;l++){const u=a[l];r(n.shapes,u)}else r(n.shapes,a)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(n.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let a=0,l=this.material.length;a<l;a++)o.push(r(n.materials,this.material[a]));i.material=o}else i.material=r(n.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(n).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){const a=this.animations[o];i.animations.push(r(n.animations,a))}}if(t){const o=s(n.geometries),a=s(n.materials),l=s(n.textures),c=s(n.images),u=s(n.shapes),h=s(n.skeletons),d=s(n.animations);o.length>0&&(e.geometries=o),a.length>0&&(e.materials=a),l.length>0&&(e.textures=l),c.length>0&&(e.images=c),u.length>0&&(e.shapes=u),h.length>0&&(e.skeletons=h),d.length>0&&(e.animations=d)}return e.object=i,e;function s(o){const a=[];for(const l in o){const c=o[l];delete c.metadata,a.push(c)}return a}},clone:function(n){return new this.constructor().copy(this,n)},copy:function(n,t=!0){if(this.name=n.name,this.up.copy(n.up),this.position.copy(n.position),this.rotation.order=n.rotation.order,this.quaternion.copy(n.quaternion),this.scale.copy(n.scale),this.matrix.copy(n.matrix),this.matrixWorld.copy(n.matrixWorld),this.matrixAutoUpdate=n.matrixAutoUpdate,this.matrixWorldNeedsUpdate=n.matrixWorldNeedsUpdate,this.layers.mask=n.layers.mask,this.visible=n.visible,this.castShadow=n.castShadow,this.receiveShadow=n.receiveShadow,this.frustumCulled=n.frustumCulled,this.renderOrder=n.renderOrder,this.userData=JSON.parse(JSON.stringify(n.userData)),t===!0)for(let e=0;e<n.children.length;e++){const i=n.children[e];this.add(i.clone())}return this}});const Fr=new M,mh=new M,gh=new ee;class Re{constructor(t=new M(1,0,0),e=0){this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,i,r){return this.normal.set(t,e,i),this.constant=r,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,i){const r=Fr.subVectors(i,e).cross(mh.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(r,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e===void 0&&(e=new M),e.copy(this.normal).multiplyScalar(-this.distanceToPoint(t)).add(t)}intersectLine(t,e){e===void 0&&(e=new M);const i=t.delta(Fr),r=this.normal.dot(i);if(r===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const s=-(t.start.dot(this.normal)+this.constant)/r;return s<0||s>1?null:e.copy(i).multiplyScalar(s).add(t.start)}intersectsLine(t){const e=this.distanceToPoint(t.start),i=this.distanceToPoint(t.end);return e<0&&i>0||i<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t===void 0&&(t=new M),t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const i=e||gh.getNormalMatrix(t),r=this.coplanarPoint(Fr).applyMatrix4(t),s=this.normal.applyMatrix3(i).normalize();return this.constant=-r.dot(s),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}Re.prototype.isPlane=!0;const we=new M,ze=new M,Br=new M,Ue=new M,gn=new M,xn=new M,Lo=new M,Or=new M,zr=new M,Ur=new M;class Zt{constructor(t=new M,e=new M,i=new M){this.a=t,this.b=e,this.c=i}static getNormal(t,e,i,r){r===void 0&&(r=new M),r.subVectors(i,e),we.subVectors(t,e),r.cross(we);const s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(t,e,i,r,s){we.subVectors(r,e),ze.subVectors(i,e),Br.subVectors(t,e);const o=we.dot(we),a=we.dot(ze),l=we.dot(Br),c=ze.dot(ze),u=ze.dot(Br),h=o*c-a*a;if(s===void 0&&(s=new M),h===0)return s.set(-2,-1,-1);const d=1/h,f=(c*l-a*u)*d,m=(o*u-a*l)*d;return s.set(1-f-m,m,f)}static containsPoint(t,e,i,r){return this.getBarycoord(t,e,i,r,Ue),Ue.x>=0&&Ue.y>=0&&Ue.x+Ue.y<=1}static getUV(t,e,i,r,s,o,a,l){return this.getBarycoord(t,e,i,r,Ue),l.set(0,0),l.addScaledVector(s,Ue.x),l.addScaledVector(o,Ue.y),l.addScaledVector(a,Ue.z),l}static isFrontFacing(t,e,i,r){return we.subVectors(i,e),ze.subVectors(t,e),we.cross(ze).dot(r)<0}set(t,e,i){return this.a.copy(t),this.b.copy(e),this.c.copy(i),this}setFromPointsAndIndices(t,e,i,r){return this.a.copy(t[e]),this.b.copy(t[i]),this.c.copy(t[r]),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return we.subVectors(this.c,this.b),ze.subVectors(this.a,this.b),we.cross(ze).length()*.5}getMidpoint(t){return t===void 0&&(t=new M),t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return Zt.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t===void 0&&(t=new Re),t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return Zt.getBarycoord(t,this.a,this.b,this.c,e)}getUV(t,e,i,r,s){return Zt.getUV(t,this.a,this.b,this.c,e,i,r,s)}containsPoint(t){return Zt.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return Zt.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){e===void 0&&(e=new M);const i=this.a,r=this.b,s=this.c;let o,a;gn.subVectors(r,i),xn.subVectors(s,i),Or.subVectors(t,i);const l=gn.dot(Or),c=xn.dot(Or);if(l<=0&&c<=0)return e.copy(i);zr.subVectors(t,r);const u=gn.dot(zr),h=xn.dot(zr);if(u>=0&&h<=u)return e.copy(r);const d=l*h-u*c;if(d<=0&&l>=0&&u<=0)return o=l/(l-u),e.copy(i).addScaledVector(gn,o);Ur.subVectors(t,s);const f=gn.dot(Ur),m=xn.dot(Ur);if(m>=0&&f<=m)return e.copy(s);const x=f*c-l*m;if(x<=0&&c>=0&&m<=0)return a=c/(c-m),e.copy(i).addScaledVector(xn,a);const v=u*m-f*h;if(v<=0&&h-u>=0&&f-m>=0)return Lo.subVectors(s,r),a=(h-u)/(h-u+(f-m)),e.copy(r).addScaledVector(Lo,a);const g=1/(v+x+d);return o=x*g,a=d*g,e.copy(i).addScaledVector(gn,o).addScaledVector(xn,a)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}let xh=0;function Vt(){Object.defineProperty(this,"id",{value:xh++}),this.uuid=bt.generateUUID(),this.name="",this.type="Material",this.fog=!0,this.blending=ii,this.side=ur,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.blendSrc=Aa,this.blendDst=La,this.blendEquation=An,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.depthFunc=is,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=sh,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Er,this.stencilZFail=Er,this.stencilZPass=Er,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaTest=0,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0}Vt.prototype=Object.assign(Object.create($e.prototype),{constructor:Vt,isMaterial:!0,onBeforeCompile:function(){},customProgramCacheKey:function(){return this.onBeforeCompile.toString()},setValues:function(n){if(n!==void 0)for(const t in n){const e=n[t];if(e===void 0)continue;if(t==="shading"){this.flatShading=e===Ta;continue}const i=this[t];i!==void 0&&(i&&i.isColor?i.set(e):i&&i.isVector3&&e&&e.isVector3?i.copy(e):this[t]=e)}},toJSON:function(n){const t=n===void 0||typeof n=="string";t&&(n={textures:{},images:{}});const e={metadata:{version:4.5,type:"Material",generator:"Material.toJSON"}};e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),this.color&&this.color.isColor&&(e.color=this.color.getHex()),this.roughness!==void 0&&(e.roughness=this.roughness),this.metalness!==void 0&&(e.metalness=this.metalness),this.sheen&&this.sheen.isColor&&(e.sheen=this.sheen.getHex()),this.emissive&&this.emissive.isColor&&(e.emissive=this.emissive.getHex()),this.emissiveIntensity&&this.emissiveIntensity!==1&&(e.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(e.specular=this.specular.getHex()),this.shininess!==void 0&&(e.shininess=this.shininess),this.clearcoat!==void 0&&(e.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(e.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(e.clearcoatMap=this.clearcoatMap.toJSON(n).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(e.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(n).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(e.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(n).uuid,e.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.map&&this.map.isTexture&&(e.map=this.map.toJSON(n).uuid),this.matcap&&this.matcap.isTexture&&(e.matcap=this.matcap.toJSON(n).uuid),this.alphaMap&&this.alphaMap.isTexture&&(e.alphaMap=this.alphaMap.toJSON(n).uuid),this.lightMap&&this.lightMap.isTexture&&(e.lightMap=this.lightMap.toJSON(n).uuid,e.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(e.aoMap=this.aoMap.toJSON(n).uuid,e.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(e.bumpMap=this.bumpMap.toJSON(n).uuid,e.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(e.normalMap=this.normalMap.toJSON(n).uuid,e.normalMapType=this.normalMapType,e.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(e.displacementMap=this.displacementMap.toJSON(n).uuid,e.displacementScale=this.displacementScale,e.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(e.roughnessMap=this.roughnessMap.toJSON(n).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(e.metalnessMap=this.metalnessMap.toJSON(n).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(e.emissiveMap=this.emissiveMap.toJSON(n).uuid),this.specularMap&&this.specularMap.isTexture&&(e.specularMap=this.specularMap.toJSON(n).uuid),this.envMap&&this.envMap.isTexture&&(e.envMap=this.envMap.toJSON(n).uuid,e.reflectivity=this.reflectivity,e.refractionRatio=this.refractionRatio,this.combine!==void 0&&(e.combine=this.combine),this.envMapIntensity!==void 0&&(e.envMapIntensity=this.envMapIntensity)),this.gradientMap&&this.gradientMap.isTexture&&(e.gradientMap=this.gradientMap.toJSON(n).uuid),this.size!==void 0&&(e.size=this.size),this.shadowSide!==null&&(e.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(e.sizeAttenuation=this.sizeAttenuation),this.blending!==ii&&(e.blending=this.blending),this.side!==ur&&(e.side=this.side),this.vertexColors&&(e.vertexColors=!0),this.opacity<1&&(e.opacity=this.opacity),this.transparent===!0&&(e.transparent=this.transparent),e.depthFunc=this.depthFunc,e.depthTest=this.depthTest,e.depthWrite=this.depthWrite,e.colorWrite=this.colorWrite,e.stencilWrite=this.stencilWrite,e.stencilWriteMask=this.stencilWriteMask,e.stencilFunc=this.stencilFunc,e.stencilRef=this.stencilRef,e.stencilFuncMask=this.stencilFuncMask,e.stencilFail=this.stencilFail,e.stencilZFail=this.stencilZFail,e.stencilZPass=this.stencilZPass,this.rotation&&this.rotation!==0&&(e.rotation=this.rotation),this.polygonOffset===!0&&(e.polygonOffset=!0),this.polygonOffsetFactor!==0&&(e.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(e.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth&&this.linewidth!==1&&(e.linewidth=this.linewidth),this.dashSize!==void 0&&(e.dashSize=this.dashSize),this.gapSize!==void 0&&(e.gapSize=this.gapSize),this.scale!==void 0&&(e.scale=this.scale),this.dithering===!0&&(e.dithering=!0),this.alphaTest>0&&(e.alphaTest=this.alphaTest),this.alphaToCoverage===!0&&(e.alphaToCoverage=this.alphaToCoverage),this.premultipliedAlpha===!0&&(e.premultipliedAlpha=this.premultipliedAlpha),this.wireframe===!0&&(e.wireframe=this.wireframe),this.wireframeLinewidth>1&&(e.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(e.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(e.wireframeLinejoin=this.wireframeLinejoin),this.morphTargets===!0&&(e.morphTargets=!0),this.morphNormals===!0&&(e.morphNormals=!0),this.skinning===!0&&(e.skinning=!0),this.flatShading===!0&&(e.flatShading=this.flatShading),this.visible===!1&&(e.visible=!1),this.toneMapped===!1&&(e.toneMapped=!1),JSON.stringify(this.userData)!=="{}"&&(e.userData=this.userData);function i(r){const s=[];for(const o in r){const a=r[o];delete a.metadata,s.push(a)}return s}if(t){const r=i(n.textures),s=i(n.images);r.length>0&&(e.textures=r),s.length>0&&(e.images=s)}return e},clone:function(){return new this.constructor().copy(this)},copy:function(n){this.name=n.name,this.fog=n.fog,this.blending=n.blending,this.side=n.side,this.vertexColors=n.vertexColors,this.opacity=n.opacity,this.transparent=n.transparent,this.blendSrc=n.blendSrc,this.blendDst=n.blendDst,this.blendEquation=n.blendEquation,this.blendSrcAlpha=n.blendSrcAlpha,this.blendDstAlpha=n.blendDstAlpha,this.blendEquationAlpha=n.blendEquationAlpha,this.depthFunc=n.depthFunc,this.depthTest=n.depthTest,this.depthWrite=n.depthWrite,this.stencilWriteMask=n.stencilWriteMask,this.stencilFunc=n.stencilFunc,this.stencilRef=n.stencilRef,this.stencilFuncMask=n.stencilFuncMask,this.stencilFail=n.stencilFail,this.stencilZFail=n.stencilZFail,this.stencilZPass=n.stencilZPass,this.stencilWrite=n.stencilWrite;const t=n.clippingPlanes;let e=null;if(t!==null){const i=t.length;e=new Array(i);for(let r=0;r!==i;++r)e[r]=t[r].clone()}return this.clippingPlanes=e,this.clipIntersection=n.clipIntersection,this.clipShadows=n.clipShadows,this.shadowSide=n.shadowSide,this.colorWrite=n.colorWrite,this.precision=n.precision,this.polygonOffset=n.polygonOffset,this.polygonOffsetFactor=n.polygonOffsetFactor,this.polygonOffsetUnits=n.polygonOffsetUnits,this.dithering=n.dithering,this.alphaTest=n.alphaTest,this.alphaToCoverage=n.alphaToCoverage,this.premultipliedAlpha=n.premultipliedAlpha,this.visible=n.visible,this.toneMapped=n.toneMapped,this.userData=JSON.parse(JSON.stringify(n.userData)),this},dispose:function(){this.dispatchEvent({type:"dispose"})}});Object.defineProperty(Vt.prototype,"needsUpdate",{set:function(n){n===!0&&this.version++}});const Ia={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Se={h:0,s:0,l:0},Ci={h:0,s:0,l:0};function Hr(n,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?n+(t-n)*6*e:e<1/2?t:e<2/3?n+(t-n)*6*(2/3-e):n}function Gr(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function kr(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}class ht{constructor(t,e,i){return e===void 0&&i===void 0?this.set(t):this.setRGB(t,e,i)}set(t){return t&&t.isColor?this.copy(t):typeof t=="number"?this.setHex(t):typeof t=="string"&&this.setStyle(t),this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,this}setRGB(t,e,i){return this.r=t,this.g=e,this.b=i,this}setHSL(t,e,i){if(t=bt.euclideanModulo(t,1),e=bt.clamp(e,0,1),i=bt.clamp(i,0,1),e===0)this.r=this.g=this.b=i;else{const r=i<=.5?i*(1+e):i+e-i*e,s=2*i-r;this.r=Hr(s,r,t+1/3),this.g=Hr(s,r,t),this.b=Hr(s,r,t-1/3)}return this}setStyle(t){function e(r){r!==void 0&&parseFloat(r)<1}let i;if(i=/^((?:rgb|hsl)a?)\(([^\)]*)\)/.exec(t)){let r;const s=i[1],o=i[2];switch(s){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return this.r=Math.min(255,parseInt(r[1],10))/255,this.g=Math.min(255,parseInt(r[2],10))/255,this.b=Math.min(255,parseInt(r[3],10))/255,e(r[4]),this;if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return this.r=Math.min(100,parseInt(r[1],10))/100,this.g=Math.min(100,parseInt(r[2],10))/100,this.b=Math.min(100,parseInt(r[3],10))/100,e(r[4]),this;break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o)){const a=parseFloat(r[1])/360,l=parseInt(r[2],10)/100,c=parseInt(r[3],10)/100;return e(r[4]),this.setHSL(a,l,c)}break}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(t)){const r=i[1],s=r.length;if(s===3)return this.r=parseInt(r.charAt(0)+r.charAt(0),16)/255,this.g=parseInt(r.charAt(1)+r.charAt(1),16)/255,this.b=parseInt(r.charAt(2)+r.charAt(2),16)/255,this;if(s===6)return this.r=parseInt(r.charAt(0)+r.charAt(1),16)/255,this.g=parseInt(r.charAt(2)+r.charAt(3),16)/255,this.b=parseInt(r.charAt(4)+r.charAt(5),16)/255,this}return t&&t.length>0?this.setColorName(t):this}setColorName(t){const e=Ia[t];return e!==void 0&&this.setHex(e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copyGammaToLinear(t,e=2){return this.r=Math.pow(t.r,e),this.g=Math.pow(t.g,e),this.b=Math.pow(t.b,e),this}copyLinearToGamma(t,e=2){const i=e>0?1/e:1;return this.r=Math.pow(t.r,i),this.g=Math.pow(t.g,i),this.b=Math.pow(t.b,i),this}convertGammaToLinear(t){return this.copyGammaToLinear(this,t),this}convertLinearToGamma(t){return this.copyLinearToGamma(this,t),this}copySRGBToLinear(t){return this.r=Gr(t.r),this.g=Gr(t.g),this.b=Gr(t.b),this}copyLinearToSRGB(t){return this.r=kr(t.r),this.g=kr(t.g),this.b=kr(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(){return this.r*255<<16^this.g*255<<8^this.b*255<<0}getHexString(){return("000000"+this.getHex().toString(16)).slice(-6)}getHSL(t){t===void 0&&(t={h:0,s:0,l:0});const e=this.r,i=this.g,r=this.b,s=Math.max(e,i,r),o=Math.min(e,i,r);let a,l;const c=(o+s)/2;if(o===s)a=0,l=0;else{const u=s-o;switch(l=c<=.5?u/(s+o):u/(2-s-o),s){case e:a=(i-r)/u+(i<r?6:0);break;case i:a=(r-e)/u+2;break;case r:a=(e-i)/u+4;break}a/=6}return t.h=a,t.s=l,t.l=c,t}getStyle(){return"rgb("+(this.r*255|0)+","+(this.g*255|0)+","+(this.b*255|0)+")"}offsetHSL(t,e,i){return this.getHSL(Se),Se.h+=t,Se.s+=e,Se.l+=i,this.setHSL(Se.h,Se.s,Se.l),this}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,i){return this.r=t.r+(e.r-t.r)*i,this.g=t.g+(e.g-t.g)*i,this.b=t.b+(e.b-t.b)*i,this}lerpHSL(t,e){this.getHSL(Se),t.getHSL(Ci);const i=bt.lerp(Se.h,Ci.h,e),r=bt.lerp(Se.s,Ci.s,e),s=bt.lerp(Se.l,Ci.l,e);return this.setHSL(i,r,s),this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),t.normalized===!0&&(this.r/=255,this.g/=255,this.b/=255),this}toJSON(){return this.getHex()}}ht.NAMES=Ia;ht.prototype.isColor=!0;ht.prototype.r=1;ht.prototype.g=1;ht.prototype.b=1;class mr extends Vt{constructor(t){super(),this.type="MeshBasicMaterial",this.color=new ht(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=fr,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.skinning=t.skinning,this.morphTargets=t.morphTargets,this}}mr.prototype.isMeshBasicMaterial=!0;const Ht=new M,Pi=new Y;function St(n,t,e){if(Array.isArray(n))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.name="",this.array=n,this.itemSize=t,this.count=n!==void 0?n.length/t:0,this.normalized=e===!0,this.usage=_i,this.updateRange={offset:0,count:-1},this.version=0}Object.defineProperty(St.prototype,"needsUpdate",{set:function(n){n===!0&&this.version++}});Object.assign(St.prototype,{isBufferAttribute:!0,onUploadCallback:function(){},setUsage:function(n){return this.usage=n,this},copy:function(n){return this.name=n.name,this.array=new n.array.constructor(n.array),this.itemSize=n.itemSize,this.count=n.count,this.normalized=n.normalized,this.usage=n.usage,this},copyAt:function(n,t,e){n*=this.itemSize,e*=t.itemSize;for(let i=0,r=this.itemSize;i<r;i++)this.array[n+i]=t.array[e+i];return this},copyArray:function(n){return this.array.set(n),this},copyColorsArray:function(n){const t=this.array;let e=0;for(let i=0,r=n.length;i<r;i++){let s=n[i];s===void 0&&(s=new ht),t[e++]=s.r,t[e++]=s.g,t[e++]=s.b}return this},copyVector2sArray:function(n){const t=this.array;let e=0;for(let i=0,r=n.length;i<r;i++){let s=n[i];s===void 0&&(s=new Y),t[e++]=s.x,t[e++]=s.y}return this},copyVector3sArray:function(n){const t=this.array;let e=0;for(let i=0,r=n.length;i<r;i++){let s=n[i];s===void 0&&(s=new M),t[e++]=s.x,t[e++]=s.y,t[e++]=s.z}return this},copyVector4sArray:function(n){const t=this.array;let e=0;for(let i=0,r=n.length;i<r;i++){let s=n[i];s===void 0&&(s=new Bt),t[e++]=s.x,t[e++]=s.y,t[e++]=s.z,t[e++]=s.w}return this},applyMatrix3:function(n){if(this.itemSize===2)for(let t=0,e=this.count;t<e;t++)Pi.fromBufferAttribute(this,t),Pi.applyMatrix3(n),this.setXY(t,Pi.x,Pi.y);else if(this.itemSize===3)for(let t=0,e=this.count;t<e;t++)Ht.fromBufferAttribute(this,t),Ht.applyMatrix3(n),this.setXYZ(t,Ht.x,Ht.y,Ht.z);return this},applyMatrix4:function(n){for(let t=0,e=this.count;t<e;t++)Ht.x=this.getX(t),Ht.y=this.getY(t),Ht.z=this.getZ(t),Ht.applyMatrix4(n),this.setXYZ(t,Ht.x,Ht.y,Ht.z);return this},applyNormalMatrix:function(n){for(let t=0,e=this.count;t<e;t++)Ht.x=this.getX(t),Ht.y=this.getY(t),Ht.z=this.getZ(t),Ht.applyNormalMatrix(n),this.setXYZ(t,Ht.x,Ht.y,Ht.z);return this},transformDirection:function(n){for(let t=0,e=this.count;t<e;t++)Ht.x=this.getX(t),Ht.y=this.getY(t),Ht.z=this.getZ(t),Ht.transformDirection(n),this.setXYZ(t,Ht.x,Ht.y,Ht.z);return this},set:function(n,t=0){return this.array.set(n,t),this},getX:function(n){return this.array[n*this.itemSize]},setX:function(n,t){return this.array[n*this.itemSize]=t,this},getY:function(n){return this.array[n*this.itemSize+1]},setY:function(n,t){return this.array[n*this.itemSize+1]=t,this},getZ:function(n){return this.array[n*this.itemSize+2]},setZ:function(n,t){return this.array[n*this.itemSize+2]=t,this},getW:function(n){return this.array[n*this.itemSize+3]},setW:function(n,t){return this.array[n*this.itemSize+3]=t,this},setXY:function(n,t,e){return n*=this.itemSize,this.array[n+0]=t,this.array[n+1]=e,this},setXYZ:function(n,t,e,i){return n*=this.itemSize,this.array[n+0]=t,this.array[n+1]=e,this.array[n+2]=i,this},setXYZW:function(n,t,e,i,r){return n*=this.itemSize,this.array[n+0]=t,this.array[n+1]=e,this.array[n+2]=i,this.array[n+3]=r,this},onUpload:function(n){return this.onUploadCallback=n,this},clone:function(){return new this.constructor(this.array,this.itemSize).copy(this)},toJSON:function(){const n={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.prototype.slice.call(this.array),normalized:this.normalized};return this.name!==""&&(n.name=this.name),this.usage!==_i&&(n.usage=this.usage),(this.updateRange.offset!==0||this.updateRange.count!==-1)&&(n.updateRange=this.updateRange),n}});function os(n,t,e){St.call(this,new Int8Array(n),t,e)}os.prototype=Object.create(St.prototype);os.prototype.constructor=os;function as(n,t,e){St.call(this,new Uint8Array(n),t,e)}as.prototype=Object.create(St.prototype);as.prototype.constructor=as;function ls(n,t,e){St.call(this,new Uint8ClampedArray(n),t,e)}ls.prototype=Object.create(St.prototype);ls.prototype.constructor=ls;function cs(n,t,e){St.call(this,new Int16Array(n),t,e)}cs.prototype=Object.create(St.prototype);cs.prototype.constructor=cs;function ui(n,t,e){St.call(this,new Uint16Array(n),t,e)}ui.prototype=Object.create(St.prototype);ui.prototype.constructor=ui;function hs(n,t,e){St.call(this,new Int32Array(n),t,e)}hs.prototype=Object.create(St.prototype);hs.prototype.constructor=hs;function di(n,t,e){St.call(this,new Uint32Array(n),t,e)}di.prototype=Object.create(St.prototype);di.prototype.constructor=di;function sr(n,t,e){St.call(this,new Uint16Array(n),t,e)}sr.prototype=Object.create(St.prototype);sr.prototype.constructor=sr;sr.prototype.isFloat16BufferAttribute=!0;function zt(n,t,e){St.call(this,new Float32Array(n),t,e)}zt.prototype=Object.create(St.prototype);zt.prototype.constructor=zt;function us(n,t,e){St.call(this,new Float64Array(n),t,e)}us.prototype=Object.create(St.prototype);us.prototype.constructor=us;function Na(n){if(n.length===0)return-1/0;let t=n[0];for(let e=1,i=n.length;e<i;++e)n[e]>t&&(t=n[e]);return t}let vh=0;const Le=new ot,Vr=new gt,vn=new M,pe=new _e,Xn=new _e,Jt=new M;function Ct(){Object.defineProperty(this,"id",{value:vh++}),this.uuid=bt.generateUUID(),this.name="",this.type="BufferGeometry",this.index=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}Ct.prototype=Object.assign(Object.create($e.prototype),{constructor:Ct,isBufferGeometry:!0,getIndex:function(){return this.index},setIndex:function(n){return Array.isArray(n)?this.index=new(Na(n)>65535?di:ui)(n,1):this.index=n,this},getAttribute:function(n){return this.attributes[n]},setAttribute:function(n,t){return this.attributes[n]=t,this},deleteAttribute:function(n){return delete this.attributes[n],this},hasAttribute:function(n){return this.attributes[n]!==void 0},addGroup:function(n,t,e=0){this.groups.push({start:n,count:t,materialIndex:e})},clearGroups:function(){this.groups=[]},setDrawRange:function(n,t){this.drawRange.start=n,this.drawRange.count=t},applyMatrix4:function(n){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(n),t.needsUpdate=!0);const e=this.attributes.normal;if(e!==void 0){const r=new ee().getNormalMatrix(n);e.applyNormalMatrix(r),e.needsUpdate=!0}const i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(n),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this},rotateX:function(n){return Le.makeRotationX(n),this.applyMatrix4(Le),this},rotateY:function(n){return Le.makeRotationY(n),this.applyMatrix4(Le),this},rotateZ:function(n){return Le.makeRotationZ(n),this.applyMatrix4(Le),this},translate:function(n,t,e){return Le.makeTranslation(n,t,e),this.applyMatrix4(Le),this},scale:function(n,t,e){return Le.makeScale(n,t,e),this.applyMatrix4(Le),this},lookAt:function(n){return Vr.lookAt(n),Vr.updateMatrix(),this.applyMatrix4(Vr.matrix),this},center:function(){return this.computeBoundingBox(),this.boundingBox.getCenter(vn).negate(),this.translate(vn.x,vn.y,vn.z),this},setFromPoints:function(n){const t=[];for(let e=0,i=n.length;e<i;e++){const r=n[e];t.push(r.x,r.y,r.z||0)}return this.setAttribute("position",new zt(t,3)),this},computeBoundingBox:function(){this.boundingBox===null&&(this.boundingBox=new _e);const n=this.attributes.position,t=this.morphAttributes.position;if(n&&n.isGLBufferAttribute){this.boundingBox.set(new M(-1/0,-1/0,-1/0),new M(1/0,1/0,1/0));return}if(n!==void 0){if(this.boundingBox.setFromBufferAttribute(n),t)for(let e=0,i=t.length;e<i;e++){const r=t[e];pe.setFromBufferAttribute(r),this.morphTargetsRelative?(Jt.addVectors(this.boundingBox.min,pe.min),this.boundingBox.expandByPoint(Jt),Jt.addVectors(this.boundingBox.max,pe.max),this.boundingBox.expandByPoint(Jt)):(this.boundingBox.expandByPoint(pe.min),this.boundingBox.expandByPoint(pe.max))}}else this.boundingBox.makeEmpty();isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z)},computeBoundingSphere:function(){this.boundingSphere===null&&(this.boundingSphere=new zn);const n=this.attributes.position,t=this.morphAttributes.position;if(n&&n.isGLBufferAttribute){this.boundingSphere.set(new M,1/0);return}if(n){const e=this.boundingSphere.center;if(pe.setFromBufferAttribute(n),t)for(let r=0,s=t.length;r<s;r++){const o=t[r];Xn.setFromBufferAttribute(o),this.morphTargetsRelative?(Jt.addVectors(pe.min,Xn.min),pe.expandByPoint(Jt),Jt.addVectors(pe.max,Xn.max),pe.expandByPoint(Jt)):(pe.expandByPoint(Xn.min),pe.expandByPoint(Xn.max))}pe.getCenter(e);let i=0;for(let r=0,s=n.count;r<s;r++)Jt.fromBufferAttribute(n,r),i=Math.max(i,e.distanceToSquared(Jt));if(t)for(let r=0,s=t.length;r<s;r++){const o=t[r],a=this.morphTargetsRelative;for(let l=0,c=o.count;l<c;l++)Jt.fromBufferAttribute(o,l),a&&(vn.fromBufferAttribute(n,l),Jt.add(vn)),i=Math.max(i,e.distanceToSquared(Jt))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)}},computeFaceNormals:function(){},computeTangents:function(){const n=this.index,t=this.attributes;if(n===null||t.position===void 0||t.normal===void 0||t.uv===void 0)return;const e=n.array,i=t.position.array,r=t.normal.array,s=t.uv.array,o=i.length/3;t.tangent===void 0&&this.setAttribute("tangent",new St(new Float32Array(4*o),4));const a=t.tangent.array,l=[],c=[];for(let F=0;F<o;F++)l[F]=new M,c[F]=new M;const u=new M,h=new M,d=new M,f=new Y,m=new Y,x=new Y,v=new M,g=new M;function p(F,V,P){u.fromArray(i,F*3),h.fromArray(i,V*3),d.fromArray(i,P*3),f.fromArray(s,F*2),m.fromArray(s,V*2),x.fromArray(s,P*2),h.sub(u),d.sub(u),m.sub(f),x.sub(f);const q=1/(m.x*x.y-x.x*m.y);isFinite(q)&&(v.copy(h).multiplyScalar(x.y).addScaledVector(d,-m.y).multiplyScalar(q),g.copy(d).multiplyScalar(m.x).addScaledVector(h,-x.x).multiplyScalar(q),l[F].add(v),l[V].add(v),l[P].add(v),c[F].add(g),c[V].add(g),c[P].add(g))}let E=this.groups;E.length===0&&(E=[{start:0,count:e.length}]);for(let F=0,V=E.length;F<V;++F){const P=E[F],q=P.start,R=P.count;for(let L=q,N=q+R;L<N;L+=3)p(e[L+0],e[L+1],e[L+2])}const S=new M,A=new M,y=new M,I=new M;function O(F){y.fromArray(r,F*3),I.copy(y);const V=l[F];S.copy(V),S.sub(y.multiplyScalar(y.dot(V))).normalize(),A.crossVectors(I,V);const q=A.dot(c[F])<0?-1:1;a[F*4]=S.x,a[F*4+1]=S.y,a[F*4+2]=S.z,a[F*4+3]=q}for(let F=0,V=E.length;F<V;++F){const P=E[F],q=P.start,R=P.count;for(let L=q,N=q+R;L<N;L+=3)O(e[L+0]),O(e[L+1]),O(e[L+2])}},computeVertexNormals:function(){const n=this.index,t=this.getAttribute("position");if(t!==void 0){let e=this.getAttribute("normal");if(e===void 0)e=new St(new Float32Array(t.count*3),3),this.setAttribute("normal",e);else for(let h=0,d=e.count;h<d;h++)e.setXYZ(h,0,0,0);const i=new M,r=new M,s=new M,o=new M,a=new M,l=new M,c=new M,u=new M;if(n)for(let h=0,d=n.count;h<d;h+=3){const f=n.getX(h+0),m=n.getX(h+1),x=n.getX(h+2);i.fromBufferAttribute(t,f),r.fromBufferAttribute(t,m),s.fromBufferAttribute(t,x),c.subVectors(s,r),u.subVectors(i,r),c.cross(u),o.fromBufferAttribute(e,f),a.fromBufferAttribute(e,m),l.fromBufferAttribute(e,x),o.add(c),a.add(c),l.add(c),e.setXYZ(f,o.x,o.y,o.z),e.setXYZ(m,a.x,a.y,a.z),e.setXYZ(x,l.x,l.y,l.z)}else for(let h=0,d=t.count;h<d;h+=3)i.fromBufferAttribute(t,h+0),r.fromBufferAttribute(t,h+1),s.fromBufferAttribute(t,h+2),c.subVectors(s,r),u.subVectors(i,r),c.cross(u),e.setXYZ(h+0,c.x,c.y,c.z),e.setXYZ(h+1,c.x,c.y,c.z),e.setXYZ(h+2,c.x,c.y,c.z);this.normalizeNormals(),e.needsUpdate=!0}},merge:function(n,t){if(!(n&&n.isBufferGeometry))return;t===void 0&&(t=0);const e=this.attributes;for(const i in e){if(n.attributes[i]===void 0)continue;const s=e[i].array,o=n.attributes[i],a=o.array,l=o.itemSize*t,c=Math.min(a.length,s.length-l);for(let u=0,h=l;u<c;u++,h++)s[h]=a[u]}return this},normalizeNormals:function(){const n=this.attributes.normal;for(let t=0,e=n.count;t<e;t++)Jt.fromBufferAttribute(n,t),Jt.normalize(),n.setXYZ(t,Jt.x,Jt.y,Jt.z)},toNonIndexed:function(){function n(o,a){const l=o.array,c=o.itemSize,u=o.normalized,h=new l.constructor(a.length*c);let d=0,f=0;for(let m=0,x=a.length;m<x;m++){d=a[m]*c;for(let v=0;v<c;v++)h[f++]=l[d++]}return new St(h,c,u)}if(this.index===null)return this;const t=new Ct,e=this.index.array,i=this.attributes;for(const o in i){const a=i[o],l=n(a,e);t.setAttribute(o,l)}const r=this.morphAttributes;for(const o in r){const a=[],l=r[o];for(let c=0,u=l.length;c<u;c++){const h=l[c],d=n(h,e);a.push(d)}t.morphAttributes[o]=a}t.morphTargetsRelative=this.morphTargetsRelative;const s=this.groups;for(let o=0,a=s.length;o<a;o++){const l=s[o];t.addGroup(l.start,l.count,l.materialIndex)}return t},toJSON:function(){const n={metadata:{version:4.5,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),Object.keys(this.userData).length>0&&(n.userData=this.userData),this.parameters!==void 0){const a=this.parameters;for(const l in a)a[l]!==void 0&&(n[l]=a[l]);return n}n.data={attributes:{}};const t=this.index;t!==null&&(n.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const e=this.attributes;for(const a in e){const l=e[a];n.data.attributes[a]=l.toJSON(n.data)}const i={};let r=!1;for(const a in this.morphAttributes){const l=this.morphAttributes[a],c=[];for(let u=0,h=l.length;u<h;u++){const d=l[u];c.push(d.toJSON(n.data))}c.length>0&&(i[a]=c,r=!0)}r&&(n.data.morphAttributes=i,n.data.morphTargetsRelative=this.morphTargetsRelative);const s=this.groups;s.length>0&&(n.data.groups=JSON.parse(JSON.stringify(s)));const o=this.boundingSphere;return o!==null&&(n.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),n},clone:function(){return new Ct().copy(this)},copy:function(n){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=n.name;const e=n.index;e!==null&&this.setIndex(e.clone(t));const i=n.attributes;for(const l in i){const c=i[l];this.setAttribute(l,c.clone(t))}const r=n.morphAttributes;for(const l in r){const c=[],u=r[l];for(let h=0,d=u.length;h<d;h++)c.push(u[h].clone(t));this.morphAttributes[l]=c}this.morphTargetsRelative=n.morphTargetsRelative;const s=n.groups;for(let l=0,c=s.length;l<c;l++){const u=s[l];this.addGroup(u.start,u.count,u.materialIndex)}const o=n.boundingBox;o!==null&&(this.boundingBox=o.clone());const a=n.boundingSphere;return a!==null&&(this.boundingSphere=a.clone()),this.drawRange.start=n.drawRange.start,this.drawRange.count=n.drawRange.count,this.userData=n.userData,this},dispose:function(){this.dispatchEvent({type:"dispose"})}});const Ro=new ot,yn=new cn,Wr=new zn,We=new M,qe=new M,Xe=new M,qr=new M,Xr=new M,jr=new M,Di=new M,Ii=new M,Ni=new M,Fi=new Y,Bi=new Y,Oi=new Y,Yr=new M,zi=new M;function $t(n=new Ct,t=new mr){gt.call(this),this.type="Mesh",this.geometry=n,this.material=t,this.updateMorphTargets()}$t.prototype=Object.assign(Object.create(gt.prototype),{constructor:$t,isMesh:!0,copy:function(n){return gt.prototype.copy.call(this,n),n.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=n.morphTargetInfluences.slice()),n.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},n.morphTargetDictionary)),this.material=n.material,this.geometry=n.geometry,this},updateMorphTargets:function(){const n=this.geometry;if(n.isBufferGeometry){const t=n.morphAttributes,e=Object.keys(t);if(e.length>0){const i=t[e[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,s=i.length;r<s;r++){const o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}else{const t=n.morphTargets;t!==void 0&&t.length>0}},raycast:function(n,t){const e=this.geometry,i=this.material,r=this.matrixWorld;if(i===void 0||(e.boundingSphere===null&&e.computeBoundingSphere(),Wr.copy(e.boundingSphere),Wr.applyMatrix4(r),n.ray.intersectsSphere(Wr)===!1)||(Ro.copy(r).invert(),yn.copy(n.ray).applyMatrix4(Ro),e.boundingBox!==null&&yn.intersectsBox(e.boundingBox)===!1))return;let s;if(e.isBufferGeometry){const o=e.index,a=e.attributes.position,l=e.morphAttributes.position,c=e.morphTargetsRelative,u=e.attributes.uv,h=e.attributes.uv2,d=e.groups,f=e.drawRange;if(o!==null)if(Array.isArray(i))for(let m=0,x=d.length;m<x;m++){const v=d[m],g=i[v.materialIndex],p=Math.max(v.start,f.start),E=Math.min(v.start+v.count,f.start+f.count);for(let S=p,A=E;S<A;S+=3){const y=o.getX(S),I=o.getX(S+1),O=o.getX(S+2);s=Ui(this,g,n,yn,a,l,c,u,h,y,I,O),s&&(s.faceIndex=Math.floor(S/3),s.face.materialIndex=v.materialIndex,t.push(s))}}else{const m=Math.max(0,f.start),x=Math.min(o.count,f.start+f.count);for(let v=m,g=x;v<g;v+=3){const p=o.getX(v),E=o.getX(v+1),S=o.getX(v+2);s=Ui(this,i,n,yn,a,l,c,u,h,p,E,S),s&&(s.faceIndex=Math.floor(v/3),t.push(s))}}else if(a!==void 0)if(Array.isArray(i))for(let m=0,x=d.length;m<x;m++){const v=d[m],g=i[v.materialIndex],p=Math.max(v.start,f.start),E=Math.min(v.start+v.count,f.start+f.count);for(let S=p,A=E;S<A;S+=3){const y=S,I=S+1,O=S+2;s=Ui(this,g,n,yn,a,l,c,u,h,y,I,O),s&&(s.faceIndex=Math.floor(S/3),s.face.materialIndex=v.materialIndex,t.push(s))}}else{const m=Math.max(0,f.start),x=Math.min(a.count,f.start+f.count);for(let v=m,g=x;v<g;v+=3){const p=v,E=v+1,S=v+2;s=Ui(this,i,n,yn,a,l,c,u,h,p,E,S),s&&(s.faceIndex=Math.floor(v/3),t.push(s))}}}else e.isGeometry}});function yh(n,t,e,i,r,s,o,a){let l;if(t.side===Qt?l=i.intersectTriangle(o,s,r,!0,a):l=i.intersectTriangle(r,s,o,t.side!==dr,a),l===null)return null;zi.copy(a),zi.applyMatrix4(n.matrixWorld);const c=e.ray.origin.distanceTo(zi);return c<e.near||c>e.far?null:{distance:c,point:zi.clone(),object:n}}function Ui(n,t,e,i,r,s,o,a,l,c,u,h){We.fromBufferAttribute(r,c),qe.fromBufferAttribute(r,u),Xe.fromBufferAttribute(r,h);const d=n.morphTargetInfluences;if(t.morphTargets&&s&&d){Di.set(0,0,0),Ii.set(0,0,0),Ni.set(0,0,0);for(let m=0,x=s.length;m<x;m++){const v=d[m],g=s[m];v!==0&&(qr.fromBufferAttribute(g,c),Xr.fromBufferAttribute(g,u),jr.fromBufferAttribute(g,h),o?(Di.addScaledVector(qr,v),Ii.addScaledVector(Xr,v),Ni.addScaledVector(jr,v)):(Di.addScaledVector(qr.sub(We),v),Ii.addScaledVector(Xr.sub(qe),v),Ni.addScaledVector(jr.sub(Xe),v)))}We.add(Di),qe.add(Ii),Xe.add(Ni)}n.isSkinnedMesh&&t.skinning&&(n.boneTransform(c,We),n.boneTransform(u,qe),n.boneTransform(h,Xe));const f=yh(n,t,e,i,We,qe,Xe,Yr);if(f){a&&(Fi.fromBufferAttribute(a,c),Bi.fromBufferAttribute(a,u),Oi.fromBufferAttribute(a,h),f.uv=Zt.getUV(Yr,We,qe,Xe,Fi,Bi,Oi,new Y)),l&&(Fi.fromBufferAttribute(l,c),Bi.fromBufferAttribute(l,u),Oi.fromBufferAttribute(l,h),f.uv2=Zt.getUV(Yr,We,qe,Xe,Fi,Bi,Oi,new Y));const m={a:c,b:u,c:h,normal:new M,materialIndex:0};Zt.getNormal(We,qe,Xe,m.normal),f.face=m}return f}class Ds extends Ct{constructor(t=1,e=1,i=1,r=1,s=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:i,widthSegments:r,heightSegments:s,depthSegments:o};const a=this;r=Math.floor(r),s=Math.floor(s),o=Math.floor(o);const l=[],c=[],u=[],h=[];let d=0,f=0;m("z","y","x",-1,-1,i,e,t,o,s,0),m("z","y","x",1,-1,i,e,-t,o,s,1),m("x","z","y",1,1,t,i,e,r,o,2),m("x","z","y",1,-1,t,i,-e,r,o,3),m("x","y","z",1,-1,t,e,i,r,s,4),m("x","y","z",-1,-1,t,e,-i,r,s,5),this.setIndex(l),this.setAttribute("position",new zt(c,3)),this.setAttribute("normal",new zt(u,3)),this.setAttribute("uv",new zt(h,2));function m(x,v,g,p,E,S,A,y,I,O,F){const V=S/I,P=A/O,q=S/2,R=A/2,L=y/2,N=I+1,C=O+1;let W=0,K=0;const j=new M;for(let rt=0;rt<C;rt++){const st=rt*P-R;for(let dt=0;dt<N;dt++){const _t=dt*V-q;j[x]=_t*p,j[v]=st*E,j[g]=L,c.push(j.x,j.y,j.z),j[x]=0,j[v]=0,j[g]=y>0?1:-1,u.push(j.x,j.y,j.z),h.push(dt/I),h.push(1-rt/O),W+=1}}for(let rt=0;rt<O;rt++)for(let st=0;st<I;st++){const dt=d+st+N*rt,_t=d+st+N*(rt+1),U=d+(st+1)+N*(rt+1),Dt=d+(st+1)+N*rt;l.push(dt,_t,Dt),l.push(_t,U,Dt),K+=6}a.addGroup(f,K,F),f+=K,d+=W}}}function Dn(n){const t={};for(const e in n){t[e]={};for(const i in n[e]){const r=n[e][i];r&&(r.isColor||r.isMatrix3||r.isMatrix4||r.isVector2||r.isVector3||r.isVector4||r.isTexture||r.isQuaternion)?t[e][i]=r.clone():Array.isArray(r)?t[e][i]=r.slice():t[e][i]=r}}return t}function ie(n){const t={};for(let e=0;e<n.length;e++){const i=Dn(n[e]);for(const r in i)t[r]=i[r]}return t}const _h={clone:Dn,merge:ie};var bh=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Mh=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;function ye(n){Vt.call(this),this.type="ShaderMaterial",this.defines={},this.uniforms={},this.vertexShader=bh,this.fragmentShader=Mh,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.extensions={derivatives:!1,fragDepth:!1,drawBuffers:!1,shaderTextureLOD:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv2:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,n!==void 0&&(n.attributes,this.setValues(n))}ye.prototype=Object.create(Vt.prototype);ye.prototype.constructor=ye;ye.prototype.isShaderMaterial=!0;ye.prototype.copy=function(n){return Vt.prototype.copy.call(this,n),this.fragmentShader=n.fragmentShader,this.vertexShader=n.vertexShader,this.uniforms=Dn(n.uniforms),this.defines=Object.assign({},n.defines),this.wireframe=n.wireframe,this.wireframeLinewidth=n.wireframeLinewidth,this.lights=n.lights,this.clipping=n.clipping,this.skinning=n.skinning,this.morphTargets=n.morphTargets,this.morphNormals=n.morphNormals,this.extensions=Object.assign({},n.extensions),this.glslVersion=n.glslVersion,this};ye.prototype.toJSON=function(n){const t=Vt.prototype.toJSON.call(this,n);t.glslVersion=this.glslVersion,t.uniforms={};for(const i in this.uniforms){const s=this.uniforms[i].value;s&&s.isTexture?t.uniforms[i]={type:"t",value:s.toJSON(n).uuid}:s&&s.isColor?t.uniforms[i]={type:"c",value:s.getHex()}:s&&s.isVector2?t.uniforms[i]={type:"v2",value:s.toArray()}:s&&s.isVector3?t.uniforms[i]={type:"v3",value:s.toArray()}:s&&s.isVector4?t.uniforms[i]={type:"v4",value:s.toArray()}:s&&s.isMatrix3?t.uniforms[i]={type:"m3",value:s.toArray()}:s&&s.isMatrix4?t.uniforms[i]={type:"m4",value:s.toArray()}:t.uniforms[i]={value:s}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader;const e={};for(const i in this.extensions)this.extensions[i]===!0&&(e[i]=!0);return Object.keys(e).length>0&&(t.extensions=e),t};function In(){gt.call(this),this.type="Camera",this.matrixWorldInverse=new ot,this.projectionMatrix=new ot,this.projectionMatrixInverse=new ot}In.prototype=Object.assign(Object.create(gt.prototype),{constructor:In,isCamera:!0,copy:function(n,t){return gt.prototype.copy.call(this,n,t),this.matrixWorldInverse.copy(n.matrixWorldInverse),this.projectionMatrix.copy(n.projectionMatrix),this.projectionMatrixInverse.copy(n.projectionMatrixInverse),this},getWorldDirection:function(n){n===void 0&&(n=new M),this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return n.set(-t[8],-t[9],-t[10]).normalize()},updateMatrixWorld:function(n){gt.prototype.updateMatrixWorld.call(this,n),this.matrixWorldInverse.copy(this.matrixWorld).invert()},updateWorldMatrix:function(n,t){gt.prototype.updateWorldMatrix.call(this,n,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()},clone:function(){return new this.constructor().copy(this)}});function ue(n=50,t=1,e=.1,i=2e3){In.call(this),this.type="PerspectiveCamera",this.fov=n,this.zoom=1,this.near=e,this.far=i,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}ue.prototype=Object.assign(Object.create(In.prototype),{constructor:ue,isPerspectiveCamera:!0,copy:function(n,t){return In.prototype.copy.call(this,n,t),this.fov=n.fov,this.zoom=n.zoom,this.near=n.near,this.far=n.far,this.focus=n.focus,this.aspect=n.aspect,this.view=n.view===null?null:Object.assign({},n.view),this.filmGauge=n.filmGauge,this.filmOffset=n.filmOffset,this},setFocalLength:function(n){const t=.5*this.getFilmHeight()/n;this.fov=bt.RAD2DEG*2*Math.atan(t),this.updateProjectionMatrix()},getFocalLength:function(){const n=Math.tan(bt.DEG2RAD*.5*this.fov);return .5*this.getFilmHeight()/n},getEffectiveFOV:function(){return bt.RAD2DEG*2*Math.atan(Math.tan(bt.DEG2RAD*.5*this.fov)/this.zoom)},getFilmWidth:function(){return this.filmGauge*Math.min(this.aspect,1)},getFilmHeight:function(){return this.filmGauge/Math.max(this.aspect,1)},setViewOffset:function(n,t,e,i,r,s){this.aspect=n/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=n,this.view.fullHeight=t,this.view.offsetX=e,this.view.offsetY=i,this.view.width=r,this.view.height=s,this.updateProjectionMatrix()},clearViewOffset:function(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()},updateProjectionMatrix:function(){const n=this.near;let t=n*Math.tan(bt.DEG2RAD*.5*this.fov)/this.zoom,e=2*t,i=this.aspect*e,r=-.5*i;const s=this.view;if(this.view!==null&&this.view.enabled){const a=s.fullWidth,l=s.fullHeight;r+=s.offsetX*i/a,t-=s.offsetY*e/l,i*=s.width/a,e*=s.height/l}const o=this.filmOffset;o!==0&&(r+=n*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+i,t,t-e,n,this.far),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()},toJSON:function(n){const t=gt.prototype.toJSON.call(this,n);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}});const _n=90,bn=1;class Is extends gt{constructor(t,e,i){if(super(),this.type="CubeCamera",i.isWebGLCubeRenderTarget!==!0)return;this.renderTarget=i;const r=new ue(_n,bn,t,e);r.layers=this.layers,r.up.set(0,-1,0),r.lookAt(new M(1,0,0)),this.add(r);const s=new ue(_n,bn,t,e);s.layers=this.layers,s.up.set(0,-1,0),s.lookAt(new M(-1,0,0)),this.add(s);const o=new ue(_n,bn,t,e);o.layers=this.layers,o.up.set(0,0,1),o.lookAt(new M(0,1,0)),this.add(o);const a=new ue(_n,bn,t,e);a.layers=this.layers,a.up.set(0,0,-1),a.lookAt(new M(0,-1,0)),this.add(a);const l=new ue(_n,bn,t,e);l.layers=this.layers,l.up.set(0,-1,0),l.lookAt(new M(0,0,1)),this.add(l);const c=new ue(_n,bn,t,e);c.layers=this.layers,c.up.set(0,-1,0),c.lookAt(new M(0,0,-1)),this.add(c)}update(t,e){this.parent===null&&this.updateMatrixWorld();const i=this.renderTarget,[r,s,o,a,l,c]=this.children,u=t.xr.enabled,h=t.getRenderTarget();t.xr.enabled=!1;const d=i.texture.generateMipmaps;i.texture.generateMipmaps=!1,t.setRenderTarget(i,0),t.render(e,r),t.setRenderTarget(i,1),t.render(e,s),t.setRenderTarget(i,2),t.render(e,o),t.setRenderTarget(i,3),t.render(e,a),t.setRenderTarget(i,4),t.render(e,l),i.texture.generateMipmaps=d,t.setRenderTarget(i,5),t.render(e,c),t.setRenderTarget(h),t.xr.enabled=u}}class gr extends ne{constructor(t,e,i,r,s,o,a,l,c,u){t=t!==void 0?t:[],e=e!==void 0?e:Ts,a=a!==void 0?a:on,super(t,e,i,r,s,o,a,l,c,u),this._needsFlipEnvMap=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}gr.prototype.isCubeTexture=!0;class Fa extends an{constructor(t,e,i){Number.isInteger(e)&&(e=i),super(t,t,e),e=e||{},this.texture=new gr(void 0,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.encoding),this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:te,this.texture._needsFlipEnvMap=!1}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.format=Te,this.texture.encoding=e.encoding,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const i={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new Ds(5,5,5),s=new ye({name:"CubemapFromEquirect",uniforms:Dn(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:Qt,blending:ni});s.uniforms.tEquirect.value=e;const o=new $t(r,s),a=e.minFilter;return e.minFilter===pr&&(e.minFilter=te),new Is(1,10,this).update(t,o),e.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(t,e,i,r){const s=t.getRenderTarget();for(let o=0;o<6;o++)t.setRenderTarget(this,o),t.clear(e,i,r);t.setRenderTarget(s)}}Fa.prototype.isWebGLCubeRenderTarget=!0;class Ns extends ne{constructor(t,e,i,r,s,o,a,l,c,u,h,d){super(null,o,a,l,c,u,r,s,h,d),this.image={data:t||null,width:e||1,height:i||1},this.magFilter=c!==void 0?c:ae,this.minFilter=u!==void 0?u:ae,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.needsUpdate=!0}}Ns.prototype.isDataTexture=!0;const Mn=new zn,Hi=new M;class xr{constructor(t=new Re,e=new Re,i=new Re,r=new Re,s=new Re,o=new Re){this.planes=[t,e,i,r,s,o]}set(t,e,i,r,s,o){const a=this.planes;return a[0].copy(t),a[1].copy(e),a[2].copy(i),a[3].copy(r),a[4].copy(s),a[5].copy(o),this}copy(t){const e=this.planes;for(let i=0;i<6;i++)e[i].copy(t.planes[i]);return this}setFromProjectionMatrix(t){const e=this.planes,i=t.elements,r=i[0],s=i[1],o=i[2],a=i[3],l=i[4],c=i[5],u=i[6],h=i[7],d=i[8],f=i[9],m=i[10],x=i[11],v=i[12],g=i[13],p=i[14],E=i[15];return e[0].setComponents(a-r,h-l,x-d,E-v).normalize(),e[1].setComponents(a+r,h+l,x+d,E+v).normalize(),e[2].setComponents(a+s,h+c,x+f,E+g).normalize(),e[3].setComponents(a-s,h-c,x-f,E-g).normalize(),e[4].setComponents(a-o,h-u,x-m,E-p).normalize(),e[5].setComponents(a+o,h+u,x+m,E+p).normalize(),this}intersectsObject(t){const e=t.geometry;return e.boundingSphere===null&&e.computeBoundingSphere(),Mn.copy(e.boundingSphere).applyMatrix4(t.matrixWorld),this.intersectsSphere(Mn)}intersectsSprite(t){return Mn.center.set(0,0,0),Mn.radius=.7071067811865476,Mn.applyMatrix4(t.matrixWorld),this.intersectsSphere(Mn)}intersectsSphere(t){const e=this.planes,i=t.center,r=-t.radius;for(let s=0;s<6;s++)if(e[s].distanceToPoint(i)<r)return!1;return!0}intersectsBox(t){const e=this.planes;for(let i=0;i<6;i++){const r=e[i];if(Hi.x=r.normal.x>0?t.max.x:t.min.x,Hi.y=r.normal.y>0?t.max.y:t.min.y,Hi.z=r.normal.z>0?t.max.z:t.min.z,r.distanceToPoint(Hi)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let i=0;i<6;i++)if(e[i].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function Ba(){let n=null,t=!1,e=null,i=null;function r(s,o){e(s,o),i=n.requestAnimationFrame(r)}return{start:function(){t!==!0&&e!==null&&(i=n.requestAnimationFrame(r),t=!0)},stop:function(){n.cancelAnimationFrame(i),t=!1},setAnimationLoop:function(s){e=s},setContext:function(s){n=s}}}function wh(n,t){const e=t.isWebGL2,i=new WeakMap;function r(c,u){const h=c.array,d=c.usage,f=n.createBuffer();n.bindBuffer(u,f),n.bufferData(u,h,d),c.onUploadCallback();let m=5126;return h instanceof Float32Array?m=5126:h instanceof Float64Array||(h instanceof Uint16Array?c.isFloat16BufferAttribute?e&&(m=5131):m=5123:h instanceof Int16Array?m=5122:h instanceof Uint32Array?m=5125:h instanceof Int32Array?m=5124:h instanceof Int8Array?m=5120:h instanceof Uint8Array&&(m=5121)),{buffer:f,type:m,bytesPerElement:h.BYTES_PER_ELEMENT,version:c.version}}function s(c,u,h){const d=u.array,f=u.updateRange;n.bindBuffer(h,c),f.count===-1?n.bufferSubData(h,0,d):(e?n.bufferSubData(h,f.offset*d.BYTES_PER_ELEMENT,d,f.offset,f.count):n.bufferSubData(h,f.offset*d.BYTES_PER_ELEMENT,d.subarray(f.offset,f.offset+f.count)),f.count=-1)}function o(c){return c.isInterleavedBufferAttribute&&(c=c.data),i.get(c)}function a(c){c.isInterleavedBufferAttribute&&(c=c.data);const u=i.get(c);u&&(n.deleteBuffer(u.buffer),i.delete(c))}function l(c,u){if(c.isGLBufferAttribute){const d=i.get(c);(!d||d.version<c.version)&&i.set(c,{buffer:c.buffer,type:c.type,bytesPerElement:c.elementSize,version:c.version});return}c.isInterleavedBufferAttribute&&(c=c.data);const h=i.get(c);h===void 0?i.set(c,r(c,u)):h.version<c.version&&(s(h.buffer,c,u),h.version=c.version)}return{get:o,remove:a,update:l}}class Sh extends Ct{constructor(t=1,e=1,i=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:i,heightSegments:r};const s=t/2,o=e/2,a=Math.floor(i),l=Math.floor(r),c=a+1,u=l+1,h=t/a,d=e/l,f=[],m=[],x=[],v=[];for(let g=0;g<u;g++){const p=g*d-o;for(let E=0;E<c;E++){const S=E*h-s;m.push(S,-p,0),x.push(0,0,1),v.push(E/a),v.push(1-g/l)}}for(let g=0;g<l;g++)for(let p=0;p<a;p++){const E=p+c*g,S=p+c*(g+1),A=p+1+c*(g+1),y=p+1+c*g;f.push(E,S,y),f.push(S,A,y)}this.setIndex(f),this.setAttribute("position",new zt(m,3)),this.setAttribute("normal",new zt(x,3)),this.setAttribute("uv",new zt(v,2))}}var Eh=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vUv ).g;
#endif`,Th=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Ah=`#ifdef ALPHATEST
	if ( diffuseColor.a < ALPHATEST ) discard;
#endif`,Lh=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vUv2 ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.specularRoughness );
	#endif
#endif`,Rh=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Ch="vec3 transformed = vec3( position );",Ph=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Dh=`vec2 integrateSpecularBRDF( const in float dotNV, const in float roughness ) {
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	return vec2( -1.04, 1.04 ) * a004 + r.zw;
}
float punctualLightIntensityToIrradianceFactor( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
#if defined ( PHYSICALLY_CORRECT_LIGHTS )
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
#else
	if( cutoffDistance > 0.0 && decayExponent > 0.0 ) {
		return pow( saturate( -lightDistance / cutoffDistance + 1.0 ), decayExponent );
	}
	return 1.0;
#endif
}
vec3 BRDF_Diffuse_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 specularColor, const in float dotLH ) {
	float fresnel = exp2( ( -5.55473 * dotLH - 6.98316 ) * dotLH );
	return ( 1.0 - specularColor ) * fresnel + specularColor;
}
vec3 F_Schlick_RoughnessDependent( const in vec3 F0, const in float dotNV, const in float roughness ) {
	float fresnel = exp2( ( -5.55473 * dotNV - 6.98316 ) * dotNV );
	vec3 Fr = max( vec3( 1.0 - roughness ), F0 ) - F0;
	return Fr * fresnel + F0;
}
float G_GGX_Smith( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gl = dotNL + sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	float gv = dotNV + sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	return 1.0 / ( gl * gv );
}
float G_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
vec3 BRDF_Specular_GGX( const in IncidentLight incidentLight, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float roughness ) {
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( incidentLight.direction + viewDir );
	float dotNL = saturate( dot( normal, incidentLight.direction ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotLH = saturate( dot( incidentLight.direction, halfDir ) );
	vec3 F = F_Schlick( specularColor, dotLH );
	float G = G_GGX_SmithCorrelated( alpha, dotNL, dotNV );
	float D = D_GGX( alpha, dotNH );
	return F * ( G * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
vec3 BRDF_Specular_GGX_Environment( const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 brdf = integrateSpecularBRDF( dotNV, roughness );
	return specularColor * brdf.x + brdf.y;
}
void BRDF_Specular_Multiscattering_Environment( const in GeometricContext geometry, const in vec3 specularColor, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
	float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );
	vec3 F = F_Schlick_RoughnessDependent( specularColor, dotNV, roughness );
	vec2 brdf = integrateSpecularBRDF( dotNV, roughness );
	vec3 FssEss = F * brdf.x + brdf.y;
	float Ess = brdf.x + brdf.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = specularColor + ( 1.0 - specularColor ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_Specular_BlinnPhong( const in IncidentLight incidentLight, const in GeometricContext geometry, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( incidentLight.direction + geometry.viewDir );
	float dotNH = saturate( dot( geometry.normal, halfDir ) );
	float dotLH = saturate( dot( incidentLight.direction, halfDir ) );
	vec3 F = F_Schlick( specularColor, dotLH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
}
float GGXRoughnessToBlinnExponent( const in float ggxRoughness ) {
	return ( 2.0 / pow2( ggxRoughness + 0.0001 ) - 2.0 );
}
float BlinnExponentToGGXRoughness( const in float blinnExponent ) {
	return sqrt( 2.0 / ( blinnExponent + 2.0 ) );
}
#if defined( USE_SHEEN )
float D_Charlie(float roughness, float NoH) {
	float invAlpha = 1.0 / roughness;
	float cos2h = NoH * NoH;
	float sin2h = max(1.0 - cos2h, 0.0078125);	return (2.0 + invAlpha) * pow(sin2h, invAlpha * 0.5) / (2.0 * PI);
}
float V_Neubelt(float NoV, float NoL) {
	return saturate(1.0 / (4.0 * (NoL + NoV - NoL * NoV)));
}
vec3 BRDF_Specular_Sheen( const in float roughness, const in vec3 L, const in GeometricContext geometry, vec3 specularColor ) {
	vec3 N = geometry.normal;
	vec3 V = geometry.viewDir;
	vec3 H = normalize( V + L );
	float dotNH = saturate( dot( N, H ) );
	return specularColor * D_Charlie( roughness, dotNH ) * V_Neubelt( dot(N, V), dot(N, L) );
}
#endif`,Ih=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vUv );
		vec2 dSTdy = dFdy( vUv );
		float Hll = bumpScale * texture2D( bumpMap, vUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = vec3( dFdx( surf_pos.x ), dFdx( surf_pos.y ), dFdx( surf_pos.z ) );
		vec3 vSigmaY = vec3( dFdy( surf_pos.x ), dFdy( surf_pos.y ), dFdy( surf_pos.z ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Nh=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#pragma unroll_loop_start
	for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
		plane = clippingPlanes[ i ];
		if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
	}
	#pragma unroll_loop_end
	#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
		bool clipped = true;
		#pragma unroll_loop_start
		for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
		}
		#pragma unroll_loop_end
		if ( clipped ) discard;
	#endif
#endif`,Fh=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Bh=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Oh=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,zh=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,Uh=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,Hh=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	varying vec3 vColor;
#endif`,Gh=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif`,kh=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate(a) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement(a) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float average( const in vec3 color ) { return dot( color, vec3( 0.3333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract(sin(sn) * c);
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float max3( vec3 v ) { return max( max( v.x, v.y ), v.z ); }
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
struct GeometricContext {
	vec3 position;
	vec3 normal;
	vec3 viewDir;
#ifdef CLEARCOAT
	vec3 clearcoatNormal;
#endif
};
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
vec3 projectOnPlane(in vec3 point, in vec3 pointOnPlane, in vec3 planeNormal ) {
	float distance = dot( planeNormal, point - pointOnPlane );
	return - distance * planeNormal + point;
}
float sideOfPlane( in vec3 point, in vec3 pointOnPlane, in vec3 planeNormal ) {
	return sign( dot( point - pointOnPlane, planeNormal ) );
}
vec3 linePlaneIntersect( in vec3 pointOnLine, in vec3 lineDirection, in vec3 pointOnPlane, in vec3 planeNormal ) {
	return lineDirection * ( dot( planeNormal, pointOnPlane - pointOnLine ) / dot( planeNormal, lineDirection ) ) + pointOnLine;
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
float linearToRelativeLuminance( const in vec3 color ) {
	vec3 weights = vec3( 0.2126, 0.7152, 0.0722 );
	return dot( weights, color.rgb );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}`,Vh=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_maxMipLevel 8.0
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_maxTileSize 256.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		float texelSize = 1.0 / ( 3.0 * cubeUV_maxTileSize );
		vec2 uv = getUV( direction, face ) * ( faceSize - 1.0 );
		vec2 f = fract( uv );
		uv += 0.5 - f;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		if ( mipInt < cubeUV_maxMipLevel ) {
			uv.y += 2.0 * cubeUV_maxTileSize;
		}
		uv.y += filterInt * 2.0 * cubeUV_minTileSize;
		uv.x += 3.0 * max( 0.0, cubeUV_maxTileSize - 2.0 * faceSize );
		uv *= texelSize;
		vec3 tl = envMapTexelToLinear( texture2D( envMap, uv ) ).rgb;
		uv.x += texelSize;
		vec3 tr = envMapTexelToLinear( texture2D( envMap, uv ) ).rgb;
		uv.y += texelSize;
		vec3 br = envMapTexelToLinear( texture2D( envMap, uv ) ).rgb;
		uv.x -= texelSize;
		vec3 bl = envMapTexelToLinear( texture2D( envMap, uv ) ).rgb;
		vec3 tm = mix( tl, tr, f.x );
		vec3 bm = mix( bl, br, f.x );
		return mix( tm, bm, f.y );
	}
	#define r0 1.0
	#define v0 0.339
	#define m0 - 2.0
	#define r1 0.8
	#define v1 0.276
	#define m1 - 1.0
	#define r4 0.4
	#define v4 0.046
	#define m4 2.0
	#define r5 0.305
	#define v5 0.016
	#define m5 3.0
	#define r6 0.21
	#define v6 0.0038
	#define m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= r1 ) {
			mip = ( r0 - roughness ) * ( m1 - m0 ) / ( r0 - r1 ) + m0;
		} else if ( roughness >= r4 ) {
			mip = ( r1 - roughness ) * ( m4 - m1 ) / ( r1 - r4 ) + m1;
		} else if ( roughness >= r5 ) {
			mip = ( r4 - roughness ) * ( m5 - m4 ) / ( r4 - r5 ) + m4;
		} else if ( roughness >= r6 ) {
			mip = ( r5 - roughness ) * ( m6 - m5 ) / ( r5 - r6 ) + m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), m0, cubeUV_maxMipLevel );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Wh=`vec3 transformedNormal = objectNormal;
#ifdef USE_INSTANCING
	mat3 m = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( m[ 0 ], m[ 0 ] ), dot( m[ 1 ], m[ 1 ] ), dot( m[ 2 ], m[ 2 ] ) );
	transformedNormal = m * transformedNormal;
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	vec3 transformedTangent = ( modelViewMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,qh=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Xh=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vUv ).x * displacementScale + displacementBias );
#endif`,jh=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vUv );
	emissiveColor.rgb = emissiveMapTexelToLinear( emissiveColor ).rgb;
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Yh=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Zh="gl_FragColor = linearToOutputTexel( gl_FragColor );",Jh=`
vec4 LinearToLinear( in vec4 value ) {
	return value;
}
vec4 GammaToLinear( in vec4 value, in float gammaFactor ) {
	return vec4( pow( value.rgb, vec3( gammaFactor ) ), value.a );
}
vec4 LinearToGamma( in vec4 value, in float gammaFactor ) {
	return vec4( pow( value.rgb, vec3( 1.0 / gammaFactor ) ), value.a );
}
vec4 sRGBToLinear( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 LinearTosRGB( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
vec4 RGBEToLinear( in vec4 value ) {
	return vec4( value.rgb * exp2( value.a * 255.0 - 128.0 ), 1.0 );
}
vec4 LinearToRGBE( in vec4 value ) {
	float maxComponent = max( max( value.r, value.g ), value.b );
	float fExp = clamp( ceil( log2( maxComponent ) ), -128.0, 127.0 );
	return vec4( value.rgb / exp2( fExp ), ( fExp + 128.0 ) / 255.0 );
}
vec4 RGBMToLinear( in vec4 value, in float maxRange ) {
	return vec4( value.rgb * value.a * maxRange, 1.0 );
}
vec4 LinearToRGBM( in vec4 value, in float maxRange ) {
	float maxRGB = max( value.r, max( value.g, value.b ) );
	float M = clamp( maxRGB / maxRange, 0.0, 1.0 );
	M = ceil( M * 255.0 ) / 255.0;
	return vec4( value.rgb / ( M * maxRange ), M );
}
vec4 RGBDToLinear( in vec4 value, in float maxRange ) {
	return vec4( value.rgb * ( ( maxRange / 255.0 ) / value.a ), 1.0 );
}
vec4 LinearToRGBD( in vec4 value, in float maxRange ) {
	float maxRGB = max( value.r, max( value.g, value.b ) );
	float D = max( maxRange / maxRGB, 1.0 );
	D = clamp( floor( D ) / 255.0, 0.0, 1.0 );
	return vec4( value.rgb * ( D * ( 255.0 / maxRange ) ), D );
}
const mat3 cLogLuvM = mat3( 0.2209, 0.3390, 0.4184, 0.1138, 0.6780, 0.7319, 0.0102, 0.1130, 0.2969 );
vec4 LinearToLogLuv( in vec4 value ) {
	vec3 Xp_Y_XYZp = cLogLuvM * value.rgb;
	Xp_Y_XYZp = max( Xp_Y_XYZp, vec3( 1e-6, 1e-6, 1e-6 ) );
	vec4 vResult;
	vResult.xy = Xp_Y_XYZp.xy / Xp_Y_XYZp.z;
	float Le = 2.0 * log2(Xp_Y_XYZp.y) + 127.0;
	vResult.w = fract( Le );
	vResult.z = ( Le - ( floor( vResult.w * 255.0 ) ) / 255.0 ) / 255.0;
	return vResult;
}
const mat3 cLogLuvInverseM = mat3( 6.0014, -2.7008, -1.7996, -1.3320, 3.1029, -5.7721, 0.3008, -1.0882, 5.6268 );
vec4 LogLuvToLinear( in vec4 value ) {
	float Le = value.z * 255.0 + value.w;
	vec3 Xp_Y_XYZp;
	Xp_Y_XYZp.y = exp2( ( Le - 127.0 ) / 2.0 );
	Xp_Y_XYZp.z = Xp_Y_XYZp.y / value.y;
	Xp_Y_XYZp.x = value.x * Xp_Y_XYZp.z;
	vec3 vRGB = cLogLuvInverseM * Xp_Y_XYZp.rgb;
	return vec4( max( vRGB, 0.0 ), 1.0 );
}`,Qh=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 envColor = textureCubeUV( envMap, reflectVec, 0.0 );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifndef ENVMAP_TYPE_CUBE_UV
		envColor = envMapTexelToLinear( envColor );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,$h=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform int maxMipLevel;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,Kh=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,tu=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) ||defined( PHONG )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,eu=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,nu=`#ifdef USE_FOG
	fogDepth = - mvPosition.z;
#endif`,iu=`#ifdef USE_FOG
	varying float fogDepth;
#endif`,ru=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogDepth * fogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, fogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,su=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float fogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,ou=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return texture2D( gradientMap, coord ).rgb;
	#else
		return ( coord.x < 0.7 ) ? vec3( 0.7 ) : vec3( 1.0 );
	#endif
}`,au=`#ifdef USE_LIGHTMAP
	vec4 lightMapTexel= texture2D( lightMap, vUv2 );
	reflectedLight.indirectDiffuse += PI * lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;
#endif`,lu=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,cu=`vec3 diffuse = vec3( 1.0 );
GeometricContext geometry;
geometry.position = mvPosition.xyz;
geometry.normal = normalize( transformedNormal );
geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( -mvPosition.xyz );
GeometricContext backGeometry;
backGeometry.position = geometry.position;
backGeometry.normal = -geometry.normal;
backGeometry.viewDir = geometry.viewDir;
vLightFront = vec3( 0.0 );
vIndirectFront = vec3( 0.0 );
#ifdef DOUBLE_SIDED
	vLightBack = vec3( 0.0 );
	vIndirectBack = vec3( 0.0 );
#endif
IncidentLight directLight;
float dotNL;
vec3 directLightColor_Diffuse;
vIndirectFront += getAmbientLightIrradiance( ambientLightColor );
vIndirectFront += getLightProbeIrradiance( lightProbe, geometry );
#ifdef DOUBLE_SIDED
	vIndirectBack += getAmbientLightIrradiance( ambientLightColor );
	vIndirectBack += getLightProbeIrradiance( lightProbe, backGeometry );
#endif
#if NUM_POINT_LIGHTS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		getPointDirectLightIrradiance( pointLights[ i ], geometry, directLight );
		dotNL = dot( geometry.normal, directLight.direction );
		directLightColor_Diffuse = PI * directLight.color;
		vLightFront += saturate( dotNL ) * directLightColor_Diffuse;
		#ifdef DOUBLE_SIDED
			vLightBack += saturate( -dotNL ) * directLightColor_Diffuse;
		#endif
	}
	#pragma unroll_loop_end
#endif
#if NUM_SPOT_LIGHTS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		getSpotDirectLightIrradiance( spotLights[ i ], geometry, directLight );
		dotNL = dot( geometry.normal, directLight.direction );
		directLightColor_Diffuse = PI * directLight.color;
		vLightFront += saturate( dotNL ) * directLightColor_Diffuse;
		#ifdef DOUBLE_SIDED
			vLightBack += saturate( -dotNL ) * directLightColor_Diffuse;
		#endif
	}
	#pragma unroll_loop_end
#endif
#if NUM_DIR_LIGHTS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		getDirectionalDirectLightIrradiance( directionalLights[ i ], geometry, directLight );
		dotNL = dot( geometry.normal, directLight.direction );
		directLightColor_Diffuse = PI * directLight.color;
		vLightFront += saturate( dotNL ) * directLightColor_Diffuse;
		#ifdef DOUBLE_SIDED
			vLightBack += saturate( -dotNL ) * directLightColor_Diffuse;
		#endif
	}
	#pragma unroll_loop_end
#endif
#if NUM_HEMI_LIGHTS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
		vIndirectFront += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );
		#ifdef DOUBLE_SIDED
			vIndirectBack += getHemisphereLightIrradiance( hemisphereLights[ i ], backGeometry );
		#endif
	}
	#pragma unroll_loop_end
#endif`,hu=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
uniform vec3 lightProbe[ 9 ];
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in GeometricContext geometry ) {
	vec3 worldNormal = inverseTransformDirection( geometry.normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	#ifndef PHYSICALLY_CORRECT_LIGHTS
		irradiance *= PI;
	#endif
	return irradiance;
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalDirectLightIrradiance( const in DirectionalLight directionalLight, const in GeometricContext geometry, out IncidentLight directLight ) {
		directLight.color = directionalLight.color;
		directLight.direction = directionalLight.direction;
		directLight.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointDirectLightIrradiance( const in PointLight pointLight, const in GeometricContext geometry, out IncidentLight directLight ) {
		vec3 lVector = pointLight.position - geometry.position;
		directLight.direction = normalize( lVector );
		float lightDistance = length( lVector );
		directLight.color = pointLight.color;
		directLight.color *= punctualLightIntensityToIrradianceFactor( lightDistance, pointLight.distance, pointLight.decay );
		directLight.visible = ( directLight.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotDirectLightIrradiance( const in SpotLight spotLight, const in GeometricContext geometry, out IncidentLight directLight ) {
		vec3 lVector = spotLight.position - geometry.position;
		directLight.direction = normalize( lVector );
		float lightDistance = length( lVector );
		float angleCos = dot( directLight.direction, spotLight.direction );
		if ( angleCos > spotLight.coneCos ) {
			float spotEffect = smoothstep( spotLight.coneCos, spotLight.penumbraCos, angleCos );
			directLight.color = spotLight.color;
			directLight.color *= spotEffect * punctualLightIntensityToIrradianceFactor( lightDistance, spotLight.distance, spotLight.decay );
			directLight.visible = true;
		} else {
			directLight.color = vec3( 0.0 );
			directLight.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in GeometricContext geometry ) {
		float dotNL = dot( geometry.normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		#ifndef PHYSICALLY_CORRECT_LIGHTS
			irradiance *= PI;
		#endif
		return irradiance;
	}
#endif`,uu=`#if defined( USE_ENVMAP )
	#ifdef ENVMAP_MODE_REFRACTION
		uniform float refractionRatio;
	#endif
	vec3 getLightProbeIndirectIrradiance( const in GeometricContext geometry, const in int maxMIPLevel ) {
		vec3 worldNormal = inverseTransformDirection( geometry.normal, viewMatrix );
		#ifdef ENVMAP_TYPE_CUBE
			vec3 queryVec = vec3( flipEnvMap * worldNormal.x, worldNormal.yz );
			#ifdef TEXTURE_LOD_EXT
				vec4 envMapColor = textureCubeLodEXT( envMap, queryVec, float( maxMIPLevel ) );
			#else
				vec4 envMapColor = textureCube( envMap, queryVec, float( maxMIPLevel ) );
			#endif
			envMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;
		#elif defined( ENVMAP_TYPE_CUBE_UV )
			vec4 envMapColor = textureCubeUV( envMap, worldNormal, 1.0 );
		#else
			vec4 envMapColor = vec4( 0.0 );
		#endif
		return PI * envMapColor.rgb * envMapIntensity;
	}
	float getSpecularMIPLevel( const in float roughness, const in int maxMIPLevel ) {
		float maxMIPLevelScalar = float( maxMIPLevel );
		float sigma = PI * roughness * roughness / ( 1.0 + roughness );
		float desiredMIPLevel = maxMIPLevelScalar + log2( sigma );
		return clamp( desiredMIPLevel, 0.0, maxMIPLevelScalar );
	}
	vec3 getLightProbeIndirectRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in int maxMIPLevel ) {
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( -viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
		#else
			vec3 reflectVec = refract( -viewDir, normal, refractionRatio );
		#endif
		reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
		float specularMIPLevel = getSpecularMIPLevel( roughness, maxMIPLevel );
		#ifdef ENVMAP_TYPE_CUBE
			vec3 queryReflectVec = vec3( flipEnvMap * reflectVec.x, reflectVec.yz );
			#ifdef TEXTURE_LOD_EXT
				vec4 envMapColor = textureCubeLodEXT( envMap, queryReflectVec, specularMIPLevel );
			#else
				vec4 envMapColor = textureCube( envMap, queryReflectVec, specularMIPLevel );
			#endif
			envMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;
		#elif defined( ENVMAP_TYPE_CUBE_UV )
			vec4 envMapColor = textureCubeUV( envMap, reflectVec, roughness );
		#endif
		return envMapColor.rgb * envMapIntensity;
	}
#endif`,du=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,fu=`varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in GeometricContext geometry, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometry.normal, directLight.direction ) * directLight.color;
	#ifndef PHYSICALLY_CORRECT_LIGHTS
		irradiance *= PI;
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in GeometricContext geometry, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon
#define Material_LightProbeLOD( material )	(0)`,pu=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,mu=`varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometry.normal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifndef PHYSICALLY_CORRECT_LIGHTS
		irradiance *= PI;
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_Specular_BlinnPhong( directLight, geometry, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong
#define Material_LightProbeLOD( material )	(0)`,gu=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( geometryNormal ) ), abs( dFdy( geometryNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.specularRoughness = max( roughnessFactor, 0.0525 );material.specularRoughness += geometryRoughness;
material.specularRoughness = min( material.specularRoughness, 1.0 );
#ifdef REFLECTIVITY
	material.specularColor = mix( vec3( MAXIMUM_SPECULAR_COEFFICIENT * pow2( reflectivity ) ), diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( DEFAULT_SPECULAR_COEFFICIENT ), diffuseColor.rgb, metalnessFactor );
#endif
#ifdef CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheen;
#endif`,xu=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float specularRoughness;
	vec3 specularColor;
#ifdef CLEARCOAT
	float clearcoat;
	float clearcoatRoughness;
#endif
#ifdef USE_SHEEN
	vec3 sheenColor;
#endif
};
#define MAXIMUM_SPECULAR_COEFFICIENT 0.16
#define DEFAULT_SPECULAR_COEFFICIENT 0.04
float clearcoatDHRApprox( const in float roughness, const in float dotNL ) {
	return DEFAULT_SPECULAR_COEFFICIENT + ( 1.0 - DEFAULT_SPECULAR_COEFFICIENT ) * ( pow( 1.0 - dotNL, 5.0 ) * pow( 1.0 - roughness, 2.0 ) );
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometry.normal;
		vec3 viewDir = geometry.viewDir;
		vec3 position = geometry.position;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.specularRoughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometry.normal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifndef PHYSICALLY_CORRECT_LIGHTS
		irradiance *= PI;
	#endif
	#ifdef CLEARCOAT
		float ccDotNL = saturate( dot( geometry.clearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = ccDotNL * directLight.color;
		#ifndef PHYSICALLY_CORRECT_LIGHTS
			ccIrradiance *= PI;
		#endif
		float clearcoatDHR = material.clearcoat * clearcoatDHRApprox( material.clearcoatRoughness, ccDotNL );
		reflectedLight.directSpecular += ccIrradiance * material.clearcoat * BRDF_Specular_GGX( directLight, geometry.viewDir, geometry.clearcoatNormal, vec3( DEFAULT_SPECULAR_COEFFICIENT ), material.clearcoatRoughness );
	#else
		float clearcoatDHR = 0.0;
	#endif
	#ifdef USE_SHEEN
		reflectedLight.directSpecular += ( 1.0 - clearcoatDHR ) * irradiance * BRDF_Specular_Sheen(
			material.specularRoughness,
			directLight.direction,
			geometry,
			material.sheenColor
		);
	#else
		reflectedLight.directSpecular += ( 1.0 - clearcoatDHR ) * irradiance * BRDF_Specular_GGX( directLight, geometry.viewDir, geometry.normal, material.specularColor, material.specularRoughness);
	#endif
	reflectedLight.directDiffuse += ( 1.0 - clearcoatDHR ) * irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef CLEARCOAT
		float ccDotNV = saturate( dot( geometry.clearcoatNormal, geometry.viewDir ) );
		reflectedLight.indirectSpecular += clearcoatRadiance * material.clearcoat * BRDF_Specular_GGX_Environment( geometry.viewDir, geometry.clearcoatNormal, vec3( DEFAULT_SPECULAR_COEFFICIENT ), material.clearcoatRoughness );
		float ccDotNL = ccDotNV;
		float clearcoatDHR = material.clearcoat * clearcoatDHRApprox( material.clearcoatRoughness, ccDotNL );
	#else
		float clearcoatDHR = 0.0;
	#endif
	float clearcoatInv = 1.0 - clearcoatDHR;
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	BRDF_Specular_Multiscattering_Environment( geometry, material.specularColor, material.specularRoughness, singleScattering, multiScattering );
	vec3 diffuse = material.diffuseColor * ( 1.0 - ( singleScattering + multiScattering ) );
	reflectedLight.indirectSpecular += clearcoatInv * radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,vu=`
GeometricContext geometry;
geometry.position = - vViewPosition;
geometry.normal = normal;
geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
#ifdef CLEARCOAT
	geometry.clearcoatNormal = clearcoatNormal;
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointDirectLightIrradiance( pointLight, geometry, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometry, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotDirectLightIrradiance( spotLight, geometry, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometry, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometry, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometry, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	irradiance += getLightProbeIrradiance( lightProbe, geometry );
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,yu=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel= texture2D( lightMap, vUv2 );
		vec3 lightMapIrradiance = lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;
		#ifndef PHYSICALLY_CORRECT_LIGHTS
			lightMapIrradiance *= PI;
		#endif
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getLightProbeIndirectIrradiance( geometry, maxMipLevel );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	radiance += getLightProbeIndirectRadiance( geometry.viewDir, geometry.normal, material.specularRoughness, maxMipLevel );
	#ifdef CLEARCOAT
		clearcoatRadiance += getLightProbeIndirectRadiance( geometry.viewDir, geometry.clearcoatNormal, material.clearcoatRoughness, maxMipLevel );
	#endif
#endif`,_u=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometry, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometry, material, reflectedLight );
#endif`,bu=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Mu=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,wu=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		varying float vFragDepth;
		varying float vIsPerspective;
	#else
		uniform float logDepthBufFC;
	#endif
#endif`,Su=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		vFragDepth = 1.0 + gl_Position.w;
		vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
	#else
		if ( isPerspectiveMatrix( projectionMatrix ) ) {
			gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;
			gl_Position.z *= gl_Position.w;
		}
	#endif
#endif`,Eu=`#ifdef USE_MAP
	vec4 texelColor = texture2D( map, vUv );
	texelColor = mapTexelToLinear( texelColor );
	diffuseColor *= texelColor;
#endif`,Tu=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Au=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
#endif
#ifdef USE_MAP
	vec4 mapTexel = texture2D( map, uv );
	diffuseColor *= mapTexelToLinear( mapTexel );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Lu=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	uniform mat3 uvTransform;
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Ru=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Cu=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Pu=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];
	objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];
	objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];
	objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];
#endif`,Du=`#ifdef USE_MORPHTARGETS
	uniform float morphTargetBaseInfluence;
	#ifndef USE_MORPHNORMALS
		uniform float morphTargetInfluences[ 8 ];
	#else
		uniform float morphTargetInfluences[ 4 ];
	#endif
#endif`,Iu=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	transformed += morphTarget0 * morphTargetInfluences[ 0 ];
	transformed += morphTarget1 * morphTargetInfluences[ 1 ];
	transformed += morphTarget2 * morphTargetInfluences[ 2 ];
	transformed += morphTarget3 * morphTargetInfluences[ 3 ];
	#ifndef USE_MORPHNORMALS
		transformed += morphTarget4 * morphTargetInfluences[ 4 ];
		transformed += morphTarget5 * morphTargetInfluences[ 5 ];
		transformed += morphTarget6 * morphTargetInfluences[ 6 ];
		transformed += morphTarget7 * morphTargetInfluences[ 7 ];
	#endif
#endif`,Nu=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = vec3( dFdx( vViewPosition.x ), dFdx( vViewPosition.y ), dFdx( vViewPosition.z ) );
	vec3 fdy = vec3( dFdy( vViewPosition.x ), dFdy( vViewPosition.y ), dFdy( vViewPosition.z ) );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	#ifdef USE_TANGENT
		vec3 tangent = normalize( vTangent );
		vec3 bitangent = normalize( vBitangent );
		#ifdef DOUBLE_SIDED
			tangent = tangent * faceDirection;
			bitangent = bitangent * faceDirection;
		#endif
		#if defined( TANGENTSPACE_NORMALMAP ) || defined( USE_CLEARCOAT_NORMALMAP )
			mat3 vTBN = mat3( tangent, bitangent, normal );
		#endif
	#endif
#endif
vec3 geometryNormal = normal;`,Fu=`#ifdef OBJECTSPACE_NORMALMAP
	normal = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( TANGENTSPACE_NORMALMAP )
	vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	#ifdef USE_TANGENT
		normal = normalize( vTBN * mapN );
	#else
		normal = perturbNormal2Arb( -vViewPosition, normal, mapN, faceDirection );
	#endif
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( -vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Bu=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef OBJECTSPACE_NORMALMAP
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( TANGENTSPACE_NORMALMAP ) || defined ( USE_CLEARCOAT_NORMALMAP ) )
	vec3 perturbNormal2Arb( vec3 eye_pos, vec3 surf_norm, vec3 mapN, float faceDirection ) {
		vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );
		vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );
		vec2 st0 = dFdx( vUv.st );
		vec2 st1 = dFdy( vUv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : faceDirection * inversesqrt( det );
		return normalize( T * ( mapN.x * scale ) + B * ( mapN.y * scale ) + N * mapN.z );
	}
#endif`,Ou=`#ifdef CLEARCOAT
	vec3 clearcoatNormal = geometryNormal;
#endif`,zu=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	#ifdef USE_TANGENT
		clearcoatNormal = normalize( vTBN * clearcoatMapN );
	#else
		clearcoatNormal = perturbNormal2Arb( - vViewPosition, clearcoatNormal, clearcoatMapN, faceDirection );
	#endif
#endif`,Uu=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif`,Hu=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;
const vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256., 256. );
const vec4 UnpackFactors = UnpackDownscale / vec4( PackFactors, 1. );
const float ShiftRight8 = 1. / 256.;
vec4 packDepthToRGBA( const in float v ) {
	vec4 r = vec4( fract( v * PackFactors ), v );
	r.yzw -= r.xyz * ShiftRight8;	return r * PackUpscale;
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors );
}
vec4 pack2HalfToRGBA( vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ));
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w);
}
vec2 unpackRGBATo2Half( vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float linearClipZ, const in float near, const in float far ) {
	return linearClipZ * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return (( near + viewZ ) * far ) / (( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float invClipZ, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * invClipZ - far );
}`,Gu=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,ku=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Vu=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Wu=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,qu=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Xu=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,ju=`#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		varying vec4 vSpotShadowCoord[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );
		bool inFrustum = all( inFrustumVec );
		bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );
		bool frustumTest = all( frustumTestVec );
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ), 
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ), 
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ), 
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ), 
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ), 
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ), 
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return shadow;
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
		vec3 lightToPosition = shadowCoord.xyz;
		float dp = ( length( lightToPosition ) - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );		dp += shadowBias;
		vec3 bd3D = normalize( lightToPosition );
		#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
			vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
			return (
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
			) * ( 1.0 / 9.0 );
		#else
			return texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
		#endif
	}
#endif`,Yu=`#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform mat4 spotShadowMatrix[ NUM_SPOT_LIGHT_SHADOWS ];
		varying vec4 vSpotShadowCoord[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Zu=`#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SPOT_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0
		vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		vec4 shadowWorldPosition;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
		vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias, 0 );
		vSpotShadowCoord[ i ] = spotShadowMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
		vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
	#endif
#endif`,Ju=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowBias, spotLight.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Qu=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,$u=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	#ifdef BONE_TEXTURE
		uniform highp sampler2D boneTexture;
		uniform int boneTextureSize;
		mat4 getBoneMatrix( const in float i ) {
			float j = i * 4.0;
			float x = mod( j, float( boneTextureSize ) );
			float y = floor( j / float( boneTextureSize ) );
			float dx = 1.0 / float( boneTextureSize );
			float dy = 1.0 / float( boneTextureSize );
			y = dy * ( y + 0.5 );
			vec4 v1 = texture2D( boneTexture, vec2( dx * ( x + 0.5 ), y ) );
			vec4 v2 = texture2D( boneTexture, vec2( dx * ( x + 1.5 ), y ) );
			vec4 v3 = texture2D( boneTexture, vec2( dx * ( x + 2.5 ), y ) );
			vec4 v4 = texture2D( boneTexture, vec2( dx * ( x + 3.5 ), y ) );
			mat4 bone = mat4( v1, v2, v3, v4 );
			return bone;
		}
	#else
		uniform mat4 boneMatrices[ MAX_BONES ];
		mat4 getBoneMatrix( const in float i ) {
			mat4 bone = boneMatrices[ int(i) ];
			return bone;
		}
	#endif
#endif`,Ku=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,td=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,ed=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,nd=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,id=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,rd=`#ifndef saturate
#define saturate(a) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return toneMappingExposure * color;
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 OptimizedCineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,sd=`#ifdef USE_TRANSMISSIONMAP
	totalTransmission *= texture2D( transmissionMap, vUv ).r;
#endif`,od=`#ifdef USE_TRANSMISSIONMAP
	uniform sampler2D transmissionMap;
#endif`,ad=`#if ( defined( USE_UV ) && ! defined( UVS_VERTEX_ONLY ) )
	varying vec2 vUv;
#endif`,ld=`#ifdef USE_UV
	#ifdef UVS_VERTEX_ONLY
		vec2 vUv;
	#else
		varying vec2 vUv;
	#endif
	uniform mat3 uvTransform;
#endif`,cd=`#ifdef USE_UV
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
#endif`,hd=`#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
	varying vec2 vUv2;
#endif`,ud=`#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
	attribute vec2 uv2;
	varying vec2 vUv2;
	uniform mat3 uv2Transform;
#endif`,dd=`#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
	vUv2 = ( uv2Transform * vec3( uv2, 1 ) ).xy;
#endif`,fd=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP )
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,pd=`uniform sampler2D t2D;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	gl_FragColor = mapTexelToLinear( texColor );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
}`,md=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,gd=`#include <envmap_common_pars_fragment>
uniform float opacity;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	vec3 vReflect = vWorldDirection;
	#include <envmap_fragment>
	gl_FragColor = envColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <encodings_fragment>
}`,xd=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,vd=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#endif
}`,yd=`#include <common>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <skinbase_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,_d=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( 1.0 );
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,bd=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <skinbase_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Md=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	vec4 texColor = texture2D( tEquirect, sampleUV );
	gl_FragColor = mapTexelToLinear( texColor );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
}`,wd=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Sd=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Ed=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <color_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Td=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <uv2_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
	
		vec4 lightMapTexel= texture2D( lightMap, vUv2 );
		reflectedLight.indirectDiffuse += lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ad=`#include <common>
#include <uv_pars_vertex>
#include <uv2_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <uv2_vertex>
	#include <color_vertex>
	#include <skinbase_vertex>
	#ifdef USE_ENVMAP
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Ld=`uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
varying vec3 vLightFront;
varying vec3 vIndirectFront;
#ifdef DOUBLE_SIDED
	varying vec3 vLightBack;
	varying vec3 vIndirectBack;
#endif
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <uv2_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <fog_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <specularmap_fragment>
	#include <emissivemap_fragment>
	#ifdef DOUBLE_SIDED
		reflectedLight.indirectDiffuse += ( gl_FrontFacing ) ? vIndirectFront : vIndirectBack;
	#else
		reflectedLight.indirectDiffuse += vIndirectFront;
	#endif
	#include <lightmap_fragment>
	reflectedLight.indirectDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb );
	#ifdef DOUBLE_SIDED
		reflectedLight.directDiffuse = ( gl_FrontFacing ) ? vLightFront : vLightBack;
	#else
		reflectedLight.directDiffuse = vLightFront;
	#endif
	reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Rd=`#define LAMBERT
varying vec3 vLightFront;
varying vec3 vIndirectFront;
#ifdef DOUBLE_SIDED
	varying vec3 vLightBack;
	varying vec3 vIndirectBack;
#endif
#include <common>
#include <uv_pars_vertex>
#include <uv2_pars_vertex>
#include <envmap_pars_vertex>
#include <bsdfs>
#include <lights_pars_begin>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <uv2_vertex>
	#include <color_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <lights_lambert_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Cd=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <fog_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
		matcapColor = matcapTexelToLinear( matcapColor );
	#else
		vec4 matcapColor = vec4( 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Pd=`#define MATCAP
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#ifndef FLAT_SHADED
		vNormal = normalize( transformedNormal );
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Dd=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <uv2_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Id=`#define TOON
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <uv_pars_vertex>
#include <uv2_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <uv2_vertex>
	#include <color_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Nd=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <uv2_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Fd=`#define PHONG
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <uv_pars_vertex>
#include <uv2_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <uv2_vertex>
	#include <color_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Bd=`#define STANDARD
#ifdef PHYSICAL
	#define REFLECTIVITY
	#define CLEARCOAT
	#define TRANSMISSION
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef TRANSMISSION
	uniform float transmission;
#endif
#ifdef REFLECTIVITY
	uniform float reflectivity;
#endif
#ifdef CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheen;
#endif
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <uv2_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <transmissionmap_pars_fragment>
#include <bsdfs>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <lights_physical_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#ifdef TRANSMISSION
		float totalTransmission = transmission;
	#endif
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <transmissionmap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#ifdef TRANSMISSION
		diffuseColor.a *= mix( saturate( 1. - totalTransmission + linearToRelativeLuminance( reflectedLight.directSpecular + reflectedLight.indirectSpecular ) ), 1.0, metalness );
	#endif
	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Od=`#define STANDARD
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif
#include <common>
#include <uv_pars_vertex>
#include <uv2_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <uv2_vertex>
	#include <color_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,zd=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( TANGENTSPACE_NORMALMAP )
	varying vec3 vViewPosition;
#endif
#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif
#include <packing>
#include <uv_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), opacity );
}`,Ud=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( TANGENTSPACE_NORMALMAP )
	varying vec3 vViewPosition;
#endif
#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif
#include <common>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( TANGENTSPACE_NORMALMAP )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Hd=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	outgoingLight = diffuseColor.rgb;
	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Gd=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <color_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,kd=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
}`,Vd=`#include <common>
#include <fog_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <begin_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Wd=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	outgoingLight = diffuseColor.rgb;
	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
}`,qd=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec2 scale;
	scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );
	scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`;const Et={alphamap_fragment:Eh,alphamap_pars_fragment:Th,alphatest_fragment:Ah,aomap_fragment:Lh,aomap_pars_fragment:Rh,begin_vertex:Ch,beginnormal_vertex:Ph,bsdfs:Dh,bumpmap_pars_fragment:Ih,clipping_planes_fragment:Nh,clipping_planes_pars_fragment:Fh,clipping_planes_pars_vertex:Bh,clipping_planes_vertex:Oh,color_fragment:zh,color_pars_fragment:Uh,color_pars_vertex:Hh,color_vertex:Gh,common:kh,cube_uv_reflection_fragment:Vh,defaultnormal_vertex:Wh,displacementmap_pars_vertex:qh,displacementmap_vertex:Xh,emissivemap_fragment:jh,emissivemap_pars_fragment:Yh,encodings_fragment:Zh,encodings_pars_fragment:Jh,envmap_fragment:Qh,envmap_common_pars_fragment:$h,envmap_pars_fragment:Kh,envmap_pars_vertex:tu,envmap_physical_pars_fragment:uu,envmap_vertex:eu,fog_vertex:nu,fog_pars_vertex:iu,fog_fragment:ru,fog_pars_fragment:su,gradientmap_pars_fragment:ou,lightmap_fragment:au,lightmap_pars_fragment:lu,lights_lambert_vertex:cu,lights_pars_begin:hu,lights_toon_fragment:du,lights_toon_pars_fragment:fu,lights_phong_fragment:pu,lights_phong_pars_fragment:mu,lights_physical_fragment:gu,lights_physical_pars_fragment:xu,lights_fragment_begin:vu,lights_fragment_maps:yu,lights_fragment_end:_u,logdepthbuf_fragment:bu,logdepthbuf_pars_fragment:Mu,logdepthbuf_pars_vertex:wu,logdepthbuf_vertex:Su,map_fragment:Eu,map_pars_fragment:Tu,map_particle_fragment:Au,map_particle_pars_fragment:Lu,metalnessmap_fragment:Ru,metalnessmap_pars_fragment:Cu,morphnormal_vertex:Pu,morphtarget_pars_vertex:Du,morphtarget_vertex:Iu,normal_fragment_begin:Nu,normal_fragment_maps:Fu,normalmap_pars_fragment:Bu,clearcoat_normal_fragment_begin:Ou,clearcoat_normal_fragment_maps:zu,clearcoat_pars_fragment:Uu,packing:Hu,premultiplied_alpha_fragment:Gu,project_vertex:ku,dithering_fragment:Vu,dithering_pars_fragment:Wu,roughnessmap_fragment:qu,roughnessmap_pars_fragment:Xu,shadowmap_pars_fragment:ju,shadowmap_pars_vertex:Yu,shadowmap_vertex:Zu,shadowmask_pars_fragment:Ju,skinbase_vertex:Qu,skinning_pars_vertex:$u,skinning_vertex:Ku,skinnormal_vertex:td,specularmap_fragment:ed,specularmap_pars_fragment:nd,tonemapping_fragment:id,tonemapping_pars_fragment:rd,transmissionmap_fragment:sd,transmissionmap_pars_fragment:od,uv_pars_fragment:ad,uv_pars_vertex:ld,uv_vertex:cd,uv2_pars_fragment:hd,uv2_pars_vertex:ud,uv2_vertex:dd,worldpos_vertex:fd,background_frag:pd,background_vert:md,cube_frag:gd,cube_vert:xd,depth_frag:vd,depth_vert:yd,distanceRGBA_frag:_d,distanceRGBA_vert:bd,equirect_frag:Md,equirect_vert:wd,linedashed_frag:Sd,linedashed_vert:Ed,meshbasic_frag:Td,meshbasic_vert:Ad,meshlambert_frag:Ld,meshlambert_vert:Rd,meshmatcap_frag:Cd,meshmatcap_vert:Pd,meshtoon_frag:Dd,meshtoon_vert:Id,meshphong_frag:Nd,meshphong_vert:Fd,meshphysical_frag:Bd,meshphysical_vert:Od,normal_frag:zd,normal_vert:Ud,points_frag:Hd,points_vert:Gd,shadow_frag:kd,shadow_vert:Vd,sprite_frag:Wd,sprite_vert:qd},$={common:{diffuse:{value:new ht(15658734)},opacity:{value:1},map:{value:null},uvTransform:{value:new ee},uv2Transform:{value:new ee},alphaMap:{value:null}},specularmap:{specularMap:{value:null}},envmap:{envMap:{value:null},flipEnvMap:{value:-1},reflectivity:{value:1},refractionRatio:{value:.98},maxMipLevel:{value:0}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1}},emissivemap:{emissiveMap:{value:null}},bumpmap:{bumpMap:{value:null},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalScale:{value:new Y(1,1)}},displacementmap:{displacementMap:{value:null},displacementScale:{value:1},displacementBias:{value:0}},roughnessmap:{roughnessMap:{value:null}},metalnessmap:{metalnessMap:{value:null}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new ht(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotShadowMap:{value:[]},spotShadowMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new ht(15658734)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},uvTransform:{value:new ee}},sprite:{diffuse:{value:new ht(15658734)},opacity:{value:1},center:{value:new Y(.5,.5)},rotation:{value:0},map:{value:null},alphaMap:{value:null},uvTransform:{value:new ee}}},Ce={basic:{uniforms:ie([$.common,$.specularmap,$.envmap,$.aomap,$.lightmap,$.fog]),vertexShader:Et.meshbasic_vert,fragmentShader:Et.meshbasic_frag},lambert:{uniforms:ie([$.common,$.specularmap,$.envmap,$.aomap,$.lightmap,$.emissivemap,$.fog,$.lights,{emissive:{value:new ht(0)}}]),vertexShader:Et.meshlambert_vert,fragmentShader:Et.meshlambert_frag},phong:{uniforms:ie([$.common,$.specularmap,$.envmap,$.aomap,$.lightmap,$.emissivemap,$.bumpmap,$.normalmap,$.displacementmap,$.fog,$.lights,{emissive:{value:new ht(0)},specular:{value:new ht(1118481)},shininess:{value:30}}]),vertexShader:Et.meshphong_vert,fragmentShader:Et.meshphong_frag},standard:{uniforms:ie([$.common,$.envmap,$.aomap,$.lightmap,$.emissivemap,$.bumpmap,$.normalmap,$.displacementmap,$.roughnessmap,$.metalnessmap,$.fog,$.lights,{emissive:{value:new ht(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Et.meshphysical_vert,fragmentShader:Et.meshphysical_frag},toon:{uniforms:ie([$.common,$.aomap,$.lightmap,$.emissivemap,$.bumpmap,$.normalmap,$.displacementmap,$.gradientmap,$.fog,$.lights,{emissive:{value:new ht(0)}}]),vertexShader:Et.meshtoon_vert,fragmentShader:Et.meshtoon_frag},matcap:{uniforms:ie([$.common,$.bumpmap,$.normalmap,$.displacementmap,$.fog,{matcap:{value:null}}]),vertexShader:Et.meshmatcap_vert,fragmentShader:Et.meshmatcap_frag},points:{uniforms:ie([$.points,$.fog]),vertexShader:Et.points_vert,fragmentShader:Et.points_frag},dashed:{uniforms:ie([$.common,$.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Et.linedashed_vert,fragmentShader:Et.linedashed_frag},depth:{uniforms:ie([$.common,$.displacementmap]),vertexShader:Et.depth_vert,fragmentShader:Et.depth_frag},normal:{uniforms:ie([$.common,$.bumpmap,$.normalmap,$.displacementmap,{opacity:{value:1}}]),vertexShader:Et.normal_vert,fragmentShader:Et.normal_frag},sprite:{uniforms:ie([$.sprite,$.fog]),vertexShader:Et.sprite_vert,fragmentShader:Et.sprite_frag},background:{uniforms:{uvTransform:{value:new ee},t2D:{value:null}},vertexShader:Et.background_vert,fragmentShader:Et.background_frag},cube:{uniforms:ie([$.envmap,{opacity:{value:1}}]),vertexShader:Et.cube_vert,fragmentShader:Et.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Et.equirect_vert,fragmentShader:Et.equirect_frag},distanceRGBA:{uniforms:ie([$.common,$.displacementmap,{referencePosition:{value:new M},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Et.distanceRGBA_vert,fragmentShader:Et.distanceRGBA_frag},shadow:{uniforms:ie([$.lights,$.fog,{color:{value:new ht(0)},opacity:{value:1}}]),vertexShader:Et.shadow_vert,fragmentShader:Et.shadow_frag}};Ce.physical={uniforms:ie([Ce.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatNormalScale:{value:new Y(1,1)},clearcoatNormalMap:{value:null},sheen:{value:new ht(0)},transmission:{value:0},transmissionMap:{value:null}}]),vertexShader:Et.meshphysical_vert,fragmentShader:Et.meshphysical_frag};function Xd(n,t,e,i,r){const s=new ht(0);let o=0,a,l,c=null,u=0,h=null;function d(m,x,v,g){let p=x.isScene===!0?x.background:null;p&&p.isTexture&&(p=t.get(p));const E=n.xr,S=E.getSession&&E.getSession();S&&S.environmentBlendMode==="additive"&&(p=null),p===null?f(s,o):p&&p.isColor&&(f(p,1),g=!0),(n.autoClear||g)&&n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil),p&&(p.isCubeTexture||p.mapping===Ls)?(l===void 0&&(l=new $t(new Ds(1,1,1),new ye({name:"BackgroundCubeMaterial",uniforms:Dn(Ce.cube.uniforms),vertexShader:Ce.cube.vertexShader,fragmentShader:Ce.cube.fragmentShader,side:Qt,depthTest:!1,depthWrite:!1,fog:!1})),l.geometry.deleteAttribute("normal"),l.geometry.deleteAttribute("uv"),l.onBeforeRender=function(A,y,I){this.matrixWorld.copyPosition(I.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(l)),l.material.uniforms.envMap.value=p,l.material.uniforms.flipEnvMap.value=p.isCubeTexture&&p._needsFlipEnvMap?-1:1,(c!==p||u!==p.version||h!==n.toneMapping)&&(l.material.needsUpdate=!0,c=p,u=p.version,h=n.toneMapping),m.unshift(l,l.geometry,l.material,0,0,null)):p&&p.isTexture&&(a===void 0&&(a=new $t(new Sh(2,2),new ye({name:"BackgroundMaterial",uniforms:Dn(Ce.background.uniforms),vertexShader:Ce.background.vertexShader,fragmentShader:Ce.background.fragmentShader,side:ur,depthTest:!1,depthWrite:!1,fog:!1})),a.geometry.deleteAttribute("normal"),Object.defineProperty(a.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(a)),a.material.uniforms.t2D.value=p,p.matrixAutoUpdate===!0&&p.updateMatrix(),a.material.uniforms.uvTransform.value.copy(p.matrix),(c!==p||u!==p.version||h!==n.toneMapping)&&(a.material.needsUpdate=!0,c=p,u=p.version,h=n.toneMapping),m.unshift(a,a.geometry,a.material,0,0,null))}function f(m,x){e.buffers.color.setClear(m.r,m.g,m.b,x,r)}return{getClearColor:function(){return s},setClearColor:function(m,x=1){s.set(m),o=x,f(s,o)},getClearAlpha:function(){return o},setClearAlpha:function(m){o=m,f(s,o)},render:d}}function jd(n,t,e,i){const r=n.getParameter(34921),s=i.isWebGL2?null:t.get("OES_vertex_array_object"),o=i.isWebGL2||s!==null,a={},l=x(null);let c=l;function u(R,L,N,C,W){let K=!1;if(o){const j=m(C,N,L);c!==j&&(c=j,d(c.object)),K=v(C,W),K&&g(C,W)}else{const j=L.wireframe===!0;(c.geometry!==C.id||c.program!==N.id||c.wireframe!==j)&&(c.geometry=C.id,c.program=N.id,c.wireframe=j,K=!0)}R.isInstancedMesh===!0&&(K=!0),W!==null&&e.update(W,34963),K&&(I(R,L,N,C),W!==null&&n.bindBuffer(34963,e.get(W).buffer))}function h(){return i.isWebGL2?n.createVertexArray():s.createVertexArrayOES()}function d(R){return i.isWebGL2?n.bindVertexArray(R):s.bindVertexArrayOES(R)}function f(R){return i.isWebGL2?n.deleteVertexArray(R):s.deleteVertexArrayOES(R)}function m(R,L,N){const C=N.wireframe===!0;let W=a[R.id];W===void 0&&(W={},a[R.id]=W);let K=W[L.id];K===void 0&&(K={},W[L.id]=K);let j=K[C];return j===void 0&&(j=x(h()),K[C]=j),j}function x(R){const L=[],N=[],C=[];for(let W=0;W<r;W++)L[W]=0,N[W]=0,C[W]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:L,enabledAttributes:N,attributeDivisors:C,object:R,attributes:{},index:null}}function v(R,L){const N=c.attributes,C=R.attributes;let W=0;for(const K in C){const j=N[K],rt=C[K];if(j===void 0||j.attribute!==rt||j.data!==rt.data)return!0;W++}return c.attributesNum!==W||c.index!==L}function g(R,L){const N={},C=R.attributes;let W=0;for(const K in C){const j=C[K],rt={};rt.attribute=j,j.data&&(rt.data=j.data),N[K]=rt,W++}c.attributes=N,c.attributesNum=W,c.index=L}function p(){const R=c.newAttributes;for(let L=0,N=R.length;L<N;L++)R[L]=0}function E(R){S(R,0)}function S(R,L){const N=c.newAttributes,C=c.enabledAttributes,W=c.attributeDivisors;N[R]=1,C[R]===0&&(n.enableVertexAttribArray(R),C[R]=1),W[R]!==L&&((i.isWebGL2?n:t.get("ANGLE_instanced_arrays"))[i.isWebGL2?"vertexAttribDivisor":"vertexAttribDivisorANGLE"](R,L),W[R]=L)}function A(){const R=c.newAttributes,L=c.enabledAttributes;for(let N=0,C=L.length;N<C;N++)L[N]!==R[N]&&(n.disableVertexAttribArray(N),L[N]=0)}function y(R,L,N,C,W,K){i.isWebGL2===!0&&(N===5124||N===5125)?n.vertexAttribIPointer(R,L,N,W,K):n.vertexAttribPointer(R,L,N,C,W,K)}function I(R,L,N,C){if(i.isWebGL2===!1&&(R.isInstancedMesh||C.isInstancedBufferGeometry)&&t.get("ANGLE_instanced_arrays")===null)return;p();const W=C.attributes,K=N.getAttributes(),j=L.defaultAttributeValues;for(const rt in K){const st=K[rt];if(st>=0){const dt=W[rt];if(dt!==void 0){const _t=dt.normalized,U=dt.itemSize,Dt=e.get(dt);if(Dt===void 0)continue;const Lt=Dt.buffer,xt=Dt.type,ut=Dt.bytesPerElement;if(dt.isInterleavedBufferAttribute){const It=dt.data,wt=It.stride,Tt=dt.offset;It&&It.isInstancedInterleavedBuffer?(S(st,It.meshPerAttribute),C._maxInstanceCount===void 0&&(C._maxInstanceCount=It.meshPerAttribute*It.count)):E(st),n.bindBuffer(34962,Lt),y(st,U,xt,_t,wt*ut,Tt*ut)}else dt.isInstancedBufferAttribute?(S(st,dt.meshPerAttribute),C._maxInstanceCount===void 0&&(C._maxInstanceCount=dt.meshPerAttribute*dt.count)):E(st),n.bindBuffer(34962,Lt),y(st,U,xt,_t,0,0)}else if(rt==="instanceMatrix"){const _t=e.get(R.instanceMatrix);if(_t===void 0)continue;const U=_t.buffer,Dt=_t.type;S(st+0,1),S(st+1,1),S(st+2,1),S(st+3,1),n.bindBuffer(34962,U),n.vertexAttribPointer(st+0,4,Dt,!1,64,0),n.vertexAttribPointer(st+1,4,Dt,!1,64,16),n.vertexAttribPointer(st+2,4,Dt,!1,64,32),n.vertexAttribPointer(st+3,4,Dt,!1,64,48)}else if(rt==="instanceColor"){const _t=e.get(R.instanceColor);if(_t===void 0)continue;const U=_t.buffer,Dt=_t.type;S(st,1),n.bindBuffer(34962,U),n.vertexAttribPointer(st,3,Dt,!1,12,0)}else if(j!==void 0){const _t=j[rt];if(_t!==void 0)switch(_t.length){case 2:n.vertexAttrib2fv(st,_t);break;case 3:n.vertexAttrib3fv(st,_t);break;case 4:n.vertexAttrib4fv(st,_t);break;default:n.vertexAttrib1fv(st,_t)}}}}A()}function O(){P();for(const R in a){const L=a[R];for(const N in L){const C=L[N];for(const W in C)f(C[W].object),delete C[W];delete L[N]}delete a[R]}}function F(R){if(a[R.id]===void 0)return;const L=a[R.id];for(const N in L){const C=L[N];for(const W in C)f(C[W].object),delete C[W];delete L[N]}delete a[R.id]}function V(R){for(const L in a){const N=a[L];if(N[R.id]===void 0)continue;const C=N[R.id];for(const W in C)f(C[W].object),delete C[W];delete N[R.id]}}function P(){q(),c!==l&&(c=l,d(c.object))}function q(){l.geometry=null,l.program=null,l.wireframe=!1}return{setup:u,reset:P,resetDefaultState:q,dispose:O,releaseStatesOfGeometry:F,releaseStatesOfProgram:V,initAttributes:p,enableAttribute:E,disableUnusedAttributes:A}}function Yd(n,t,e,i){const r=i.isWebGL2;let s;function o(c){s=c}function a(c,u){n.drawArrays(s,c,u),e.update(u,s,1)}function l(c,u,h){if(h===0)return;let d,f;if(r)d=n,f="drawArraysInstanced";else if(d=t.get("ANGLE_instanced_arrays"),f="drawArraysInstancedANGLE",d===null)return;d[f](s,c,u,h),e.update(u,s,h)}this.setMode=o,this.render=a,this.renderInstances=l}function Zd(n,t,e){let i;function r(){if(i!==void 0)return i;if(t.has("EXT_texture_filter_anisotropic")===!0){const y=t.get("EXT_texture_filter_anisotropic");i=n.getParameter(y.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function s(y){if(y==="highp"){if(n.getShaderPrecisionFormat(35633,36338).precision>0&&n.getShaderPrecisionFormat(35632,36338).precision>0)return"highp";y="mediump"}return y==="mediump"&&n.getShaderPrecisionFormat(35633,36337).precision>0&&n.getShaderPrecisionFormat(35632,36337).precision>0?"mediump":"lowp"}const o=typeof WebGL2RenderingContext<"u"&&n instanceof WebGL2RenderingContext||typeof WebGL2ComputeRenderingContext<"u"&&n instanceof WebGL2ComputeRenderingContext;let a=e.precision!==void 0?e.precision:"highp";const l=s(a);l!==a&&(a=l);const c=e.logarithmicDepthBuffer===!0,u=n.getParameter(34930),h=n.getParameter(35660),d=n.getParameter(3379),f=n.getParameter(34076),m=n.getParameter(34921),x=n.getParameter(36347),v=n.getParameter(36348),g=n.getParameter(36349),p=h>0,E=o||t.has("OES_texture_float"),S=p&&E,A=o?n.getParameter(36183):0;return{isWebGL2:o,getMaxAnisotropy:r,getMaxPrecision:s,precision:a,logarithmicDepthBuffer:c,maxTextures:u,maxVertexTextures:h,maxTextureSize:d,maxCubemapSize:f,maxAttributes:m,maxVertexUniforms:x,maxVaryings:v,maxFragmentUniforms:g,vertexTextures:p,floatFragmentTextures:E,floatVertexTextures:S,maxSamples:A}}function Jd(n){const t=this;let e=null,i=0,r=!1,s=!1;const o=new Re,a=new ee,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(h,d,f){const m=h.length!==0||d||i!==0||r;return r=d,e=u(h,f,0),i=h.length,m},this.beginShadows=function(){s=!0,u(null)},this.endShadows=function(){s=!1,c()},this.setState=function(h,d,f){const m=h.clippingPlanes,x=h.clipIntersection,v=h.clipShadows,g=n.get(h);if(!r||m===null||m.length===0||s&&!v)s?u(null):c();else{const p=s?0:i,E=p*4;let S=g.clippingState||null;l.value=S,S=u(m,d,E,f);for(let A=0;A!==E;++A)S[A]=e[A];g.clippingState=S,this.numIntersection=x?this.numPlanes:0,this.numPlanes+=p}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=i>0),t.numPlanes=i,t.numIntersection=0}function u(h,d,f,m){const x=h!==null?h.length:0;let v=null;if(x!==0){if(v=l.value,m!==!0||v===null){const g=f+x*4,p=d.matrixWorldInverse;a.getNormalMatrix(p),(v===null||v.length<g)&&(v=new Float32Array(g));for(let E=0,S=f;E!==x;++E,S+=4)o.copy(h[E]).applyMatrix4(p,a),o.normal.toArray(v,S),v[S+3]=o.constant}l.value=v,l.needsUpdate=!0}return t.numPlanes=x,t.numIntersection=0,v}}function Qd(n){let t=new WeakMap;function e(o,a){return a===io?o.mapping=Ts:a===ro&&(o.mapping=As),o}function i(o){if(o&&o.isTexture){const a=o.mapping;if(a===io||a===ro)if(t.has(o)){const l=t.get(o).texture;return e(l,o.mapping)}else{const l=o.image;if(l&&l.height>0){const c=n.getRenderTarget(),u=new Fa(l.height/2);return u.fromEquirectangularTexture(n,o),t.set(o,u),n.setRenderTarget(c),o.addEventListener("dispose",r),e(u.texture,o.mapping)}else return null}}return o}function r(o){const a=o.target;a.removeEventListener("dispose",r);const l=t.get(a);l!==void 0&&(t.delete(a),l.dispose())}function s(){t=new WeakMap}return{get:i,dispose:s}}function $d(n){const t={};function e(i){if(t[i]!==void 0)return t[i];let r;switch(i){case"WEBGL_depth_texture":r=n.getExtension("WEBGL_depth_texture")||n.getExtension("MOZ_WEBGL_depth_texture")||n.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":r=n.getExtension("EXT_texture_filter_anisotropic")||n.getExtension("MOZ_EXT_texture_filter_anisotropic")||n.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":r=n.getExtension("WEBGL_compressed_texture_s3tc")||n.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":r=n.getExtension("WEBGL_compressed_texture_pvrtc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:r=n.getExtension(i)}return t[i]=r,r}return{has:function(i){return e(i)!==null},init:function(i){i.isWebGL2?e("EXT_color_buffer_float"):(e("WEBGL_depth_texture"),e("OES_texture_float"),e("OES_texture_half_float"),e("OES_texture_half_float_linear"),e("OES_standard_derivatives"),e("OES_element_index_uint"),e("OES_vertex_array_object"),e("ANGLE_instanced_arrays")),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float")},get:function(i){const r=e(i);return r}}}function Kd(n,t,e,i){const r={},s=new WeakMap;function o(h){const d=h.target;d.index!==null&&t.remove(d.index);for(const m in d.attributes)t.remove(d.attributes[m]);d.removeEventListener("dispose",o),delete r[d.id];const f=s.get(d);f&&(t.remove(f),s.delete(d)),i.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,e.memory.geometries--}function a(h,d){return r[d.id]===!0||(d.addEventListener("dispose",o),r[d.id]=!0,e.memory.geometries++),d}function l(h){const d=h.attributes;for(const m in d)t.update(d[m],34962);const f=h.morphAttributes;for(const m in f){const x=f[m];for(let v=0,g=x.length;v<g;v++)t.update(x[v],34962)}}function c(h){const d=[],f=h.index,m=h.attributes.position;let x=0;if(f!==null){const p=f.array;x=f.version;for(let E=0,S=p.length;E<S;E+=3){const A=p[E+0],y=p[E+1],I=p[E+2];d.push(A,y,y,I,I,A)}}else{const p=m.array;x=m.version;for(let E=0,S=p.length/3-1;E<S;E+=3){const A=E+0,y=E+1,I=E+2;d.push(A,y,y,I,I,A)}}const v=new(Na(d)>65535?di:ui)(d,1);v.version=x;const g=s.get(h);g&&t.remove(g),s.set(h,v)}function u(h){const d=s.get(h);if(d){const f=h.index;f!==null&&d.version<f.version&&c(h)}else c(h);return s.get(h)}return{get:a,update:l,getWireframeAttribute:u}}function tf(n,t,e,i){const r=i.isWebGL2;let s;function o(d){s=d}let a,l;function c(d){a=d.type,l=d.bytesPerElement}function u(d,f){n.drawElements(s,f,a,d*l),e.update(f,s,1)}function h(d,f,m){if(m===0)return;let x,v;if(r)x=n,v="drawElementsInstanced";else if(x=t.get("ANGLE_instanced_arrays"),v="drawElementsInstancedANGLE",x===null)return;x[v](s,f,a,d*l,m),e.update(f,s,m)}this.setMode=o,this.setIndex=c,this.render=u,this.renderInstances=h}function ef(n){const t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function i(s,o,a){switch(e.calls++,o){case 4:e.triangles+=a*(s/3);break;case 1:e.lines+=a*(s/2);break;case 3:e.lines+=a*(s-1);break;case 2:e.lines+=a*s;break;case 0:e.points+=a*s;break;default:break}}function r(){e.frame++,e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:r,update:i}}function nf(n,t){return n[0]-t[0]}function rf(n,t){return Math.abs(t[1])-Math.abs(n[1])}function sf(n){const t={},e=new Float32Array(8),i=[];for(let s=0;s<8;s++)i[s]=[s,0];function r(s,o,a,l){const c=s.morphTargetInfluences,u=c===void 0?0:c.length;let h=t[o.id];if(h===void 0){h=[];for(let v=0;v<u;v++)h[v]=[v,0];t[o.id]=h}for(let v=0;v<u;v++){const g=h[v];g[0]=v,g[1]=c[v]}h.sort(rf);for(let v=0;v<8;v++)v<u&&h[v][1]?(i[v][0]=h[v][0],i[v][1]=h[v][1]):(i[v][0]=Number.MAX_SAFE_INTEGER,i[v][1]=0);i.sort(nf);const d=a.morphTargets&&o.morphAttributes.position,f=a.morphNormals&&o.morphAttributes.normal;let m=0;for(let v=0;v<8;v++){const g=i[v],p=g[0],E=g[1];p!==Number.MAX_SAFE_INTEGER&&E?(d&&o.getAttribute("morphTarget"+v)!==d[p]&&o.setAttribute("morphTarget"+v,d[p]),f&&o.getAttribute("morphNormal"+v)!==f[p]&&o.setAttribute("morphNormal"+v,f[p]),e[v]=E,m+=E):(d&&o.hasAttribute("morphTarget"+v)===!0&&o.deleteAttribute("morphTarget"+v),f&&o.hasAttribute("morphNormal"+v)===!0&&o.deleteAttribute("morphNormal"+v),e[v]=0)}const x=o.morphTargetsRelative?1:1-m;l.getUniforms().setValue(n,"morphTargetBaseInfluence",x),l.getUniforms().setValue(n,"morphTargetInfluences",e)}return{update:r}}function of(n,t,e,i){let r=new WeakMap;function s(l){const c=i.render.frame,u=l.geometry,h=t.get(l,u);return r.get(h)!==c&&(t.update(h),r.set(h,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",a)===!1&&l.addEventListener("dispose",a),e.update(l.instanceMatrix,34962),l.instanceColor!==null&&e.update(l.instanceColor,34962)),h}function o(){r=new WeakMap}function a(l){const c=l.target;c.removeEventListener("dispose",a),e.remove(c.instanceMatrix),c.instanceColor!==null&&e.remove(c.instanceColor)}return{update:s,dispose:o}}class Oa extends ne{constructor(t=null,e=1,i=1,r=1){super(null),this.image={data:t,width:e,height:i,depth:r},this.magFilter=ae,this.minFilter=ae,this.wrapR=me,this.generateMipmaps=!1,this.flipY=!1,this.needsUpdate=!0}}Oa.prototype.isDataTexture2DArray=!0;class za extends ne{constructor(t=null,e=1,i=1,r=1){super(null),this.image={data:t,width:e,height:i,depth:r},this.magFilter=ae,this.minFilter=ae,this.wrapR=me,this.generateMipmaps=!1,this.flipY=!1,this.needsUpdate=!0}}za.prototype.isDataTexture3D=!0;const Ua=new ne,af=new Oa,lf=new za,Ha=new gr,Co=[],Po=[],Do=new Float32Array(16),Io=new Float32Array(9),No=new Float32Array(4);function Hn(n,t,e){const i=n[0];if(i<=0||i>0)return n;const r=t*e;let s=Co[r];if(s===void 0&&(s=new Float32Array(r),Co[r]=s),t!==0){i.toArray(s,0);for(let o=1,a=0;o!==t;++o)a+=e,n[o].toArray(s,a)}return s}function ce(n,t){if(n.length!==t.length)return!1;for(let e=0,i=n.length;e<i;e++)if(n[e]!==t[e])return!1;return!0}function re(n,t){for(let e=0,i=t.length;e<i;e++)n[e]=t[e]}function Ga(n,t){let e=Po[t];e===void 0&&(e=new Int32Array(t),Po[t]=e);for(let i=0;i!==t;++i)e[i]=n.allocateTextureUnit();return e}function cf(n,t){const e=this.cache;e[0]!==t&&(n.uniform1f(this.addr,t),e[0]=t)}function hf(n,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(n.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(ce(e,t))return;n.uniform2fv(this.addr,t),re(e,t)}}function uf(n,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(n.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(n.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(ce(e,t))return;n.uniform3fv(this.addr,t),re(e,t)}}function df(n,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(n.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(ce(e,t))return;n.uniform4fv(this.addr,t),re(e,t)}}function ff(n,t){const e=this.cache,i=t.elements;if(i===void 0){if(ce(e,t))return;n.uniformMatrix2fv(this.addr,!1,t),re(e,t)}else{if(ce(e,i))return;No.set(i),n.uniformMatrix2fv(this.addr,!1,No),re(e,i)}}function pf(n,t){const e=this.cache,i=t.elements;if(i===void 0){if(ce(e,t))return;n.uniformMatrix3fv(this.addr,!1,t),re(e,t)}else{if(ce(e,i))return;Io.set(i),n.uniformMatrix3fv(this.addr,!1,Io),re(e,i)}}function mf(n,t){const e=this.cache,i=t.elements;if(i===void 0){if(ce(e,t))return;n.uniformMatrix4fv(this.addr,!1,t),re(e,t)}else{if(ce(e,i))return;Do.set(i),n.uniformMatrix4fv(this.addr,!1,Do),re(e,i)}}function gf(n,t){const e=this.cache;e[0]!==t&&(n.uniform1i(this.addr,t),e[0]=t)}function xf(n,t){const e=this.cache;ce(e,t)||(n.uniform2iv(this.addr,t),re(e,t))}function vf(n,t){const e=this.cache;ce(e,t)||(n.uniform3iv(this.addr,t),re(e,t))}function yf(n,t){const e=this.cache;ce(e,t)||(n.uniform4iv(this.addr,t),re(e,t))}function _f(n,t){const e=this.cache;e[0]!==t&&(n.uniform1ui(this.addr,t),e[0]=t)}function bf(n,t){const e=this.cache;ce(e,t)||(n.uniform2uiv(this.addr,t),re(e,t))}function Mf(n,t){const e=this.cache;ce(e,t)||(n.uniform3uiv(this.addr,t),re(e,t))}function wf(n,t){const e=this.cache;ce(e,t)||(n.uniform4uiv(this.addr,t),re(e,t))}function Sf(n,t,e){const i=this.cache,r=e.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),e.safeSetTexture2D(t||Ua,r)}function Ef(n,t,e){const i=this.cache,r=e.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),e.setTexture3D(t||lf,r)}function Tf(n,t,e){const i=this.cache,r=e.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),e.safeSetTextureCube(t||Ha,r)}function Af(n,t,e){const i=this.cache,r=e.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),e.setTexture2DArray(t||af,r)}function Lf(n){switch(n){case 5126:return cf;case 35664:return hf;case 35665:return uf;case 35666:return df;case 35674:return ff;case 35675:return pf;case 35676:return mf;case 5124:case 35670:return gf;case 35667:case 35671:return xf;case 35668:case 35672:return vf;case 35669:case 35673:return yf;case 5125:return _f;case 36294:return bf;case 36295:return Mf;case 36296:return wf;case 35678:case 36198:case 36298:case 36306:case 35682:return Sf;case 35679:case 36299:case 36307:return Ef;case 35680:case 36300:case 36308:case 36293:return Tf;case 36289:case 36303:case 36311:case 36292:return Af}}function Rf(n,t){n.uniform1fv(this.addr,t)}function Cf(n,t){const e=Hn(t,this.size,2);n.uniform2fv(this.addr,e)}function Pf(n,t){const e=Hn(t,this.size,3);n.uniform3fv(this.addr,e)}function Df(n,t){const e=Hn(t,this.size,4);n.uniform4fv(this.addr,e)}function If(n,t){const e=Hn(t,this.size,4);n.uniformMatrix2fv(this.addr,!1,e)}function Nf(n,t){const e=Hn(t,this.size,9);n.uniformMatrix3fv(this.addr,!1,e)}function Ff(n,t){const e=Hn(t,this.size,16);n.uniformMatrix4fv(this.addr,!1,e)}function Bf(n,t){n.uniform1iv(this.addr,t)}function Of(n,t){n.uniform2iv(this.addr,t)}function zf(n,t){n.uniform3iv(this.addr,t)}function Uf(n,t){n.uniform4iv(this.addr,t)}function Hf(n,t){n.uniform1uiv(this.addr,t)}function Gf(n,t){n.uniform2uiv(this.addr,t)}function kf(n,t){n.uniform3uiv(this.addr,t)}function Vf(n,t){n.uniform4uiv(this.addr,t)}function Wf(n,t,e){const i=t.length,r=Ga(e,i);n.uniform1iv(this.addr,r);for(let s=0;s!==i;++s)e.safeSetTexture2D(t[s]||Ua,r[s])}function qf(n,t,e){const i=t.length,r=Ga(e,i);n.uniform1iv(this.addr,r);for(let s=0;s!==i;++s)e.safeSetTextureCube(t[s]||Ha,r[s])}function Xf(n){switch(n){case 5126:return Rf;case 35664:return Cf;case 35665:return Pf;case 35666:return Df;case 35674:return If;case 35675:return Nf;case 35676:return Ff;case 5124:case 35670:return Bf;case 35667:case 35671:return Of;case 35668:case 35672:return zf;case 35669:case 35673:return Uf;case 5125:return Hf;case 36294:return Gf;case 36295:return kf;case 36296:return Vf;case 35678:case 36198:case 36298:case 36306:case 35682:return Wf;case 35680:case 36300:case 36308:case 36293:return qf}}function jf(n,t,e){this.id=n,this.addr=e,this.cache=[],this.setValue=Lf(t.type)}function ka(n,t,e){this.id=n,this.addr=e,this.cache=[],this.size=t.size,this.setValue=Xf(t.type)}ka.prototype.updateCache=function(n){const t=this.cache;n instanceof Float32Array&&t.length!==n.length&&(this.cache=new Float32Array(n.length)),re(t,n)};function Va(n){this.id=n,this.seq=[],this.map={}}Va.prototype.setValue=function(n,t,e){const i=this.seq;for(let r=0,s=i.length;r!==s;++r){const o=i[r];o.setValue(n,t[o.id],e)}};const Zr=/(\w+)(\])?(\[|\.)?/g;function Fo(n,t){n.seq.push(t),n.map[t.id]=t}function Yf(n,t,e){const i=n.name,r=i.length;for(Zr.lastIndex=0;;){const s=Zr.exec(i),o=Zr.lastIndex;let a=s[1];const l=s[2]==="]",c=s[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===r){Fo(e,c===void 0?new jf(a,n,t):new ka(a,n,t));break}else{let h=e.map[a];h===void 0&&(h=new Va(a),Fo(e,h)),e=h}}}function Ze(n,t){this.seq=[],this.map={};const e=n.getProgramParameter(t,35718);for(let i=0;i<e;++i){const r=n.getActiveUniform(t,i),s=n.getUniformLocation(t,r.name);Yf(r,s,this)}}Ze.prototype.setValue=function(n,t,e,i){const r=this.map[t];r!==void 0&&r.setValue(n,e,i)};Ze.prototype.setOptional=function(n,t,e){const i=t[e];i!==void 0&&this.setValue(n,e,i)};Ze.upload=function(n,t,e,i){for(let r=0,s=t.length;r!==s;++r){const o=t[r],a=e[o.id];a.needsUpdate!==!1&&o.setValue(n,a.value,i)}};Ze.seqWithValue=function(n,t){const e=[];for(let i=0,r=n.length;i!==r;++i){const s=n[i];s.id in t&&e.push(s)}return e};function Bo(n,t,e){const i=n.createShader(t);return n.shaderSource(i,e),n.compileShader(i),i}let Zf=0;function Jf(n){const t=n.split(`
`);for(let e=0;e<t.length;e++)t[e]=e+1+": "+t[e];return t.join(`
`)}function Wa(n){switch(n){case yi:return["Linear","( value )"];case Pa:return["sRGB","( value )"];case Qc:return["RGBE","( value )"];case Kc:return["RGBM","( value, 7.0 )"];case th:return["RGBM","( value, 16.0 )"];case eh:return["RGBD","( value, 256.0 )"];case Jc:return["Gamma","( value, float( GAMMA_FACTOR ) )"];case $c:return["LogLuv","( value )"];default:return["Linear","( value )"]}}function Oo(n,t,e){const i=n.getShaderParameter(t,35713),r=n.getShaderInfoLog(t).trim();if(i&&r==="")return"";const s=n.getShaderSource(t);return"THREE.WebGLShader: gl.getShaderInfoLog() "+e+`
`+r+Jf(s)}function jn(n,t){const e=Wa(t);return"vec4 "+n+"( vec4 value ) { return "+e[0]+"ToLinear"+e[1]+"; }"}function Qf(n,t){const e=Wa(t);return"vec4 "+n+"( vec4 value ) { return LinearTo"+e[0]+e[1]+"; }"}function $f(n,t){let e;switch(t){case Zl:e="Linear";break;case Jl:e="Reinhard";break;case Ql:e="OptimizedCineon";break;case $l:e="ACESFilmic";break;case Kl:e="Custom";break;default:e="Linear"}return"vec3 "+n+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}function Kf(n){return[n.extensionDerivatives||n.envMapCubeUV||n.bumpMap||n.tangentSpaceNormalMap||n.clearcoatNormalMap||n.flatShading||n.shaderID==="physical"?"#extension GL_OES_standard_derivatives : enable":"",(n.extensionFragDepth||n.logarithmicDepthBuffer)&&n.rendererExtensionFragDepth?"#extension GL_EXT_frag_depth : enable":"",n.extensionDrawBuffers&&n.rendererExtensionDrawBuffers?"#extension GL_EXT_draw_buffers : require":"",(n.extensionShaderTextureLOD||n.envMap)&&n.rendererExtensionShaderTextureLod?"#extension GL_EXT_shader_texture_lod : enable":""].filter(ti).join(`
`)}function tp(n){const t=[];for(const e in n){const i=n[e];i!==!1&&t.push("#define "+e+" "+i)}return t.join(`
`)}function ep(n,t){const e={},i=n.getProgramParameter(t,35721);for(let r=0;r<i;r++){const o=n.getActiveAttrib(t,r).name;e[o]=n.getAttribLocation(t,o)}return e}function ti(n){return n!==""}function zo(n,t){return n.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Uo(n,t){return n.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const np=/^[ \t]*#include +<([\w\d./]+)>/gm;function ds(n){return n.replace(np,ip)}function ip(n,t){const e=Et[t];if(e===void 0)throw new Error("Can not resolve #include <"+t+">");return ds(e)}const rp=/#pragma unroll_loop[\s]+?for \( int i \= (\d+)\; i < (\d+)\; i \+\+ \) \{([\s\S]+?)(?=\})\}/g,sp=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Ho(n){return n.replace(sp,qa).replace(rp,op)}function op(n,t,e,i){return qa(n,t,e,i)}function qa(n,t,e,i){let r="";for(let s=parseInt(t);s<parseInt(e);s++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function Go(n){let t="precision "+n.precision+` float;
precision `+n.precision+" int;";return n.precision==="highp"?t+=`
#define HIGH_PRECISION`:n.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:n.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}function ap(n){let t="SHADOWMAP_TYPE_BASIC";return n.shadowMapType===Ea?t="SHADOWMAP_TYPE_PCF":n.shadowMapType===Al?t="SHADOWMAP_TYPE_PCF_SOFT":n.shadowMapType===Kn&&(t="SHADOWMAP_TYPE_VSM"),t}function lp(n){let t="ENVMAP_TYPE_CUBE";if(n.envMap)switch(n.envMapMode){case Ts:case As:t="ENVMAP_TYPE_CUBE";break;case Ls:case Rs:t="ENVMAP_TYPE_CUBE_UV";break}return t}function cp(n){let t="ENVMAP_MODE_REFLECTION";if(n.envMap)switch(n.envMapMode){case As:case Rs:t="ENVMAP_MODE_REFRACTION";break}return t}function hp(n){let t="ENVMAP_BLENDING_NONE";if(n.envMap)switch(n.combine){case fr:t="ENVMAP_BLENDING_MULTIPLY";break;case jl:t="ENVMAP_BLENDING_MIX";break;case Yl:t="ENVMAP_BLENDING_ADD";break}return t}function up(n,t,e,i){const r=n.getContext(),s=e.defines;let o=e.vertexShader,a=e.fragmentShader;const l=ap(e),c=lp(e),u=cp(e),h=hp(e),d=n.gammaFactor>0?n.gammaFactor:1,f=e.isWebGL2?"":Kf(e),m=tp(s),x=r.createProgram();let v,g,p=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(v=[m].filter(ti).join(`
`),v.length>0&&(v+=`
`),g=[f,m].filter(ti).join(`
`),g.length>0&&(g+=`
`)):(v=[Go(e),"#define SHADER_NAME "+e.shaderName,m,e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.supportsVertexTextures?"#define VERTEX_TEXTURES":"","#define GAMMA_FACTOR "+d,"#define MAX_BONES "+e.maxBones,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+u:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMap&&e.objectSpaceNormalMap?"#define OBJECTSPACE_NORMALMAP":"",e.normalMap&&e.tangentSpaceNormalMap?"#define TANGENTSPACE_NORMALMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.displacementMap&&e.supportsVertexTextures?"#define USE_DISPLACEMENTMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.vertexTangents?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUvs?"#define USE_UV":"",e.uvsVertexOnly?"#define UVS_VERTEX_ONLY":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.useVertexTexture?"#define BONE_TEXTURE":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.logarithmicDepthBuffer&&e.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_MORPHTARGETS","	attribute vec3 morphTarget0;","	attribute vec3 morphTarget1;","	attribute vec3 morphTarget2;","	attribute vec3 morphTarget3;","	#ifdef USE_MORPHNORMALS","		attribute vec3 morphNormal0;","		attribute vec3 morphNormal1;","		attribute vec3 morphNormal2;","		attribute vec3 morphNormal3;","	#else","		attribute vec3 morphTarget4;","		attribute vec3 morphTarget5;","		attribute vec3 morphTarget6;","		attribute vec3 morphTarget7;","	#endif","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ti).join(`
`),g=[f,Go(e),"#define SHADER_NAME "+e.shaderName,m,e.alphaTest?"#define ALPHATEST "+e.alphaTest+(e.alphaTest%1?"":".0"):"","#define GAMMA_FACTOR "+d,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+u:"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMap&&e.objectSpaceNormalMap?"#define OBJECTSPACE_NORMALMAP":"",e.normalMap&&e.tangentSpaceNormalMap?"#define TANGENTSPACE_NORMALMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.sheen?"#define USE_SHEEN":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.vertexTangents?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUvs?"#define USE_UV":"",e.uvsVertexOnly?"#define UVS_VERTEX_ONLY":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.physicallyCorrectLights?"#define PHYSICALLY_CORRECT_LIGHTS":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.logarithmicDepthBuffer&&e.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"",(e.extensionShaderTextureLOD||e.envMap)&&e.rendererExtensionShaderTextureLod?"#define TEXTURE_LOD_EXT":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==ri?"#define TONE_MAPPING":"",e.toneMapping!==ri?Et.tonemapping_pars_fragment:"",e.toneMapping!==ri?$f("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",Et.encodings_pars_fragment,e.map?jn("mapTexelToLinear",e.mapEncoding):"",e.matcap?jn("matcapTexelToLinear",e.matcapEncoding):"",e.envMap?jn("envMapTexelToLinear",e.envMapEncoding):"",e.emissiveMap?jn("emissiveMapTexelToLinear",e.emissiveMapEncoding):"",e.lightMap?jn("lightMapTexelToLinear",e.lightMapEncoding):"",Qf("linearToOutputTexel",e.outputEncoding),e.depthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(ti).join(`
`)),o=ds(o),o=zo(o,e),o=Uo(o,e),a=ds(a),a=zo(a,e),a=Uo(a,e),o=Ho(o),a=Ho(a),e.isWebGL2&&e.isRawShaderMaterial!==!0&&(p=`#version 300 es
`,v=["#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+v,g=["#define varying in",e.glslVersion===vo?"":"out highp vec4 pc_fragColor;",e.glslVersion===vo?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+g);const E=p+v+o,S=p+g+a,A=Bo(r,35633,E),y=Bo(r,35632,S);if(r.attachShader(x,A),r.attachShader(x,y),e.index0AttributeName!==void 0?r.bindAttribLocation(x,0,e.index0AttributeName):e.morphTargets===!0&&r.bindAttribLocation(x,0,"position"),r.linkProgram(x),n.debug.checkShaderErrors){const F=r.getProgramInfoLog(x).trim(),V=r.getShaderInfoLog(A).trim(),P=r.getShaderInfoLog(y).trim();let q=!0,R=!0;if(r.getProgramParameter(x,35714)===!1){q=!1;const L=Oo(r,A,"vertex"),N=Oo(r,y,"fragment")}else F!==""||(V===""||P==="")&&(R=!1);R&&(this.diagnostics={runnable:q,programLog:F,vertexShader:{log:V,prefix:v},fragmentShader:{log:P,prefix:g}})}r.deleteShader(A),r.deleteShader(y);let I;this.getUniforms=function(){return I===void 0&&(I=new Ze(r,x)),I};let O;return this.getAttributes=function(){return O===void 0&&(O=ep(r,x)),O},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(x),this.program=void 0},this.name=e.shaderName,this.id=Zf++,this.cacheKey=t,this.usedTimes=1,this.program=x,this.vertexShader=A,this.fragmentShader=y,this}function dp(n,t,e,i,r,s){const o=[],a=i.isWebGL2,l=i.logarithmicDepthBuffer,c=i.floatVertexTextures,u=i.maxVertexUniforms,h=i.vertexTextures;let d=i.precision;const f={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"},m=["precision","isWebGL2","supportsVertexTextures","outputEncoding","instancing","instancingColor","map","mapEncoding","matcap","matcapEncoding","envMap","envMapMode","envMapEncoding","envMapCubeUV","lightMap","lightMapEncoding","aoMap","emissiveMap","emissiveMapEncoding","bumpMap","normalMap","objectSpaceNormalMap","tangentSpaceNormalMap","clearcoatMap","clearcoatRoughnessMap","clearcoatNormalMap","displacementMap","specularMap","roughnessMap","metalnessMap","gradientMap","alphaMap","combine","vertexColors","vertexAlphas","vertexTangents","vertexUvs","uvsVertexOnly","fog","useFog","fogExp2","flatShading","sizeAttenuation","logarithmicDepthBuffer","skinning","maxBones","useVertexTexture","morphTargets","morphNormals","premultipliedAlpha","numDirLights","numPointLights","numSpotLights","numHemiLights","numRectAreaLights","numDirLightShadows","numPointLightShadows","numSpotLightShadows","shadowMapEnabled","shadowMapType","toneMapping","physicallyCorrectLights","alphaTest","doubleSided","flipSided","numClippingPlanes","numClipIntersection","depthPacking","dithering","sheen","transmissionMap"];function x(y){const O=y.skeleton.bones;if(c)return 1024;{const V=Math.floor((u-20)/4),P=Math.min(V,O.length);return P<O.length?0:P}}function v(y){let I;return y&&y.isTexture?I=y.encoding:y&&y.isWebGLRenderTarget?I=y.texture.encoding:I=yi,I}function g(y,I,O,F,V){const P=F.fog,q=y.isMeshStandardMaterial?F.environment:null,R=t.get(y.envMap||q),L=f[y.type],N=V.isSkinnedMesh?x(V):0;y.precision!==null&&(d=i.getMaxPrecision(y.precision),y.precision);let C,W;if(L){const rt=Ce[L];C=rt.vertexShader,W=rt.fragmentShader}else C=y.vertexShader,W=y.fragmentShader;const K=n.getRenderTarget();return{isWebGL2:a,shaderID:L,shaderName:y.type,vertexShader:C,fragmentShader:W,defines:y.defines,isRawShaderMaterial:y.isRawShaderMaterial===!0,glslVersion:y.glslVersion,precision:d,instancing:V.isInstancedMesh===!0,instancingColor:V.isInstancedMesh===!0&&V.instanceColor!==null,supportsVertexTextures:h,outputEncoding:K!==null?v(K.texture):n.outputEncoding,map:!!y.map,mapEncoding:v(y.map),matcap:!!y.matcap,matcapEncoding:v(y.matcap),envMap:!!R,envMapMode:R&&R.mapping,envMapEncoding:v(R),envMapCubeUV:!!R&&(R.mapping===Ls||R.mapping===Rs),lightMap:!!y.lightMap,lightMapEncoding:v(y.lightMap),aoMap:!!y.aoMap,emissiveMap:!!y.emissiveMap,emissiveMapEncoding:v(y.emissiveMap),bumpMap:!!y.bumpMap,normalMap:!!y.normalMap,objectSpaceNormalMap:y.normalMapType===rh,tangentSpaceNormalMap:y.normalMapType===Bn,clearcoatMap:!!y.clearcoatMap,clearcoatRoughnessMap:!!y.clearcoatRoughnessMap,clearcoatNormalMap:!!y.clearcoatNormalMap,displacementMap:!!y.displacementMap,roughnessMap:!!y.roughnessMap,metalnessMap:!!y.metalnessMap,specularMap:!!y.specularMap,alphaMap:!!y.alphaMap,gradientMap:!!y.gradientMap,sheen:!!y.sheen,transmissionMap:!!y.transmissionMap,combine:y.combine,vertexTangents:y.normalMap&&y.vertexTangents,vertexColors:y.vertexColors,vertexAlphas:y.vertexColors===!0&&V.geometry.attributes.color&&V.geometry.attributes.color.itemSize===4,vertexUvs:!!y.map||!!y.bumpMap||!!y.normalMap||!!y.specularMap||!!y.alphaMap||!!y.emissiveMap||!!y.roughnessMap||!!y.metalnessMap||!!y.clearcoatMap||!!y.clearcoatRoughnessMap||!!y.clearcoatNormalMap||!!y.displacementMap||!!y.transmissionMap,uvsVertexOnly:!(y.map||y.bumpMap||y.normalMap||y.specularMap||y.alphaMap||y.emissiveMap||y.roughnessMap||y.metalnessMap||y.clearcoatNormalMap||y.transmissionMap)&&!!y.displacementMap,fog:!!P,useFog:y.fog,fogExp2:P&&P.isFogExp2,flatShading:!!y.flatShading,sizeAttenuation:y.sizeAttenuation,logarithmicDepthBuffer:l,skinning:y.skinning&&N>0,maxBones:N,useVertexTexture:c,morphTargets:y.morphTargets,morphNormals:y.morphNormals,numDirLights:I.directional.length,numPointLights:I.point.length,numSpotLights:I.spot.length,numRectAreaLights:I.rectArea.length,numHemiLights:I.hemi.length,numDirLightShadows:I.directionalShadowMap.length,numPointLightShadows:I.pointShadowMap.length,numSpotLightShadows:I.spotShadowMap.length,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:y.dithering,shadowMapEnabled:n.shadowMap.enabled&&O.length>0,shadowMapType:n.shadowMap.type,toneMapping:y.toneMapped?n.toneMapping:ri,physicallyCorrectLights:n.physicallyCorrectLights,premultipliedAlpha:y.premultipliedAlpha,alphaTest:y.alphaTest,doubleSided:y.side===dr,flipSided:y.side===Qt,depthPacking:y.depthPacking!==void 0?y.depthPacking:!1,index0AttributeName:y.index0AttributeName,extensionDerivatives:y.extensions&&y.extensions.derivatives,extensionFragDepth:y.extensions&&y.extensions.fragDepth,extensionDrawBuffers:y.extensions&&y.extensions.drawBuffers,extensionShaderTextureLOD:y.extensions&&y.extensions.shaderTextureLOD,rendererExtensionFragDepth:a||e.has("EXT_frag_depth"),rendererExtensionDrawBuffers:a||e.has("WEBGL_draw_buffers"),rendererExtensionShaderTextureLod:a||e.has("EXT_shader_texture_lod"),customProgramCacheKey:y.customProgramCacheKey()}}function p(y){const I=[];if(y.shaderID?I.push(y.shaderID):(I.push(y.fragmentShader),I.push(y.vertexShader)),y.defines!==void 0)for(const O in y.defines)I.push(O),I.push(y.defines[O]);if(y.isRawShaderMaterial===!1){for(let O=0;O<m.length;O++)I.push(y[m[O]]);I.push(n.outputEncoding),I.push(n.gammaFactor)}return I.push(y.customProgramCacheKey),I.join()}function E(y){const I=f[y.type];let O;if(I){const F=Ce[I];O=_h.clone(F.uniforms)}else O=y.uniforms;return O}function S(y,I){let O;for(let F=0,V=o.length;F<V;F++){const P=o[F];if(P.cacheKey===I){O=P,++O.usedTimes;break}}return O===void 0&&(O=new up(n,I,y,r),o.push(O)),O}function A(y){if(--y.usedTimes===0){const I=o.indexOf(y);o[I]=o[o.length-1],o.pop(),y.destroy()}}return{getParameters:g,getProgramCacheKey:p,getUniforms:E,acquireProgram:S,releaseProgram:A,programs:o}}function fp(){let n=new WeakMap;function t(s){let o=n.get(s);return o===void 0&&(o={},n.set(s,o)),o}function e(s){n.delete(s)}function i(s,o,a){n.get(s)[o]=a}function r(){n=new WeakMap}return{get:t,remove:e,update:i,dispose:r}}function pp(n,t){return n.groupOrder!==t.groupOrder?n.groupOrder-t.groupOrder:n.renderOrder!==t.renderOrder?n.renderOrder-t.renderOrder:n.program!==t.program?n.program.id-t.program.id:n.material.id!==t.material.id?n.material.id-t.material.id:n.z!==t.z?n.z-t.z:n.id-t.id}function mp(n,t){return n.groupOrder!==t.groupOrder?n.groupOrder-t.groupOrder:n.renderOrder!==t.renderOrder?n.renderOrder-t.renderOrder:n.z!==t.z?t.z-n.z:n.id-t.id}function ko(n){const t=[];let e=0;const i=[],r=[],s={id:-1};function o(){e=0,i.length=0,r.length=0}function a(d,f,m,x,v,g){let p=t[e];const E=n.get(m);return p===void 0?(p={id:d.id,object:d,geometry:f,material:m,program:E.program||s,groupOrder:x,renderOrder:d.renderOrder,z:v,group:g},t[e]=p):(p.id=d.id,p.object=d,p.geometry=f,p.material=m,p.program=E.program||s,p.groupOrder=x,p.renderOrder=d.renderOrder,p.z=v,p.group=g),e++,p}function l(d,f,m,x,v,g){const p=a(d,f,m,x,v,g);(m.transparent===!0?r:i).push(p)}function c(d,f,m,x,v,g){const p=a(d,f,m,x,v,g);(m.transparent===!0?r:i).unshift(p)}function u(d,f){i.length>1&&i.sort(d||pp),r.length>1&&r.sort(f||mp)}function h(){for(let d=e,f=t.length;d<f;d++){const m=t[d];if(m.id===null)break;m.id=null,m.object=null,m.geometry=null,m.material=null,m.program=null,m.group=null}}return{opaque:i,transparent:r,init:o,push:l,unshift:c,finish:h,sort:u}}function gp(n){let t=new WeakMap;function e(r,s){let o;return t.has(r)===!1?(o=new ko(n),t.set(r,[o])):s>=t.get(r).length?(o=new ko(n),t.get(r).push(o)):o=t.get(r)[s],o}function i(){t=new WeakMap}return{get:e,dispose:i}}function xp(){const n={};return{get:function(t){if(n[t.id]!==void 0)return n[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new M,color:new ht};break;case"SpotLight":e={position:new M,direction:new M,color:new ht,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new M,color:new ht,distance:0,decay:0};break;case"HemisphereLight":e={direction:new M,skyColor:new ht,groundColor:new ht};break;case"RectAreaLight":e={color:new ht,position:new M,halfWidth:new M,halfHeight:new M};break}return n[t.id]=e,e}}}function vp(){const n={};return{get:function(t){if(n[t.id]!==void 0)return n[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Y};break;case"SpotLight":e={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Y};break;case"PointLight":e={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Y,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[t.id]=e,e}}}let yp=0;function _p(n,t){return(t.castShadow?1:0)-(n.castShadow?1:0)}function bp(n,t){const e=new xp,i=vp(),r={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotShadow:[],spotShadowMap:[],spotShadowMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[]};for(let u=0;u<9;u++)r.probe.push(new M);const s=new M,o=new ot,a=new ot;function l(u){let h=0,d=0,f=0;for(let I=0;I<9;I++)r.probe[I].set(0,0,0);let m=0,x=0,v=0,g=0,p=0,E=0,S=0,A=0;u.sort(_p);for(let I=0,O=u.length;I<O;I++){const F=u[I],V=F.color,P=F.intensity,q=F.distance,R=F.shadow&&F.shadow.map?F.shadow.map.texture:null;if(F.isAmbientLight)h+=V.r*P,d+=V.g*P,f+=V.b*P;else if(F.isLightProbe)for(let L=0;L<9;L++)r.probe[L].addScaledVector(F.sh.coefficients[L],P);else if(F.isDirectionalLight){const L=e.get(F);if(L.color.copy(F.color).multiplyScalar(F.intensity),F.castShadow){const N=F.shadow,C=i.get(F);C.shadowBias=N.bias,C.shadowNormalBias=N.normalBias,C.shadowRadius=N.radius,C.shadowMapSize=N.mapSize,r.directionalShadow[m]=C,r.directionalShadowMap[m]=R,r.directionalShadowMatrix[m]=F.shadow.matrix,E++}r.directional[m]=L,m++}else if(F.isSpotLight){const L=e.get(F);if(L.position.setFromMatrixPosition(F.matrixWorld),L.color.copy(V).multiplyScalar(P),L.distance=q,L.coneCos=Math.cos(F.angle),L.penumbraCos=Math.cos(F.angle*(1-F.penumbra)),L.decay=F.decay,F.castShadow){const N=F.shadow,C=i.get(F);C.shadowBias=N.bias,C.shadowNormalBias=N.normalBias,C.shadowRadius=N.radius,C.shadowMapSize=N.mapSize,r.spotShadow[v]=C,r.spotShadowMap[v]=R,r.spotShadowMatrix[v]=F.shadow.matrix,A++}r.spot[v]=L,v++}else if(F.isRectAreaLight){const L=e.get(F);L.color.copy(V).multiplyScalar(P),L.halfWidth.set(F.width*.5,0,0),L.halfHeight.set(0,F.height*.5,0),r.rectArea[g]=L,g++}else if(F.isPointLight){const L=e.get(F);if(L.color.copy(F.color).multiplyScalar(F.intensity),L.distance=F.distance,L.decay=F.decay,F.castShadow){const N=F.shadow,C=i.get(F);C.shadowBias=N.bias,C.shadowNormalBias=N.normalBias,C.shadowRadius=N.radius,C.shadowMapSize=N.mapSize,C.shadowCameraNear=N.camera.near,C.shadowCameraFar=N.camera.far,r.pointShadow[x]=C,r.pointShadowMap[x]=R,r.pointShadowMatrix[x]=F.shadow.matrix,S++}r.point[x]=L,x++}else if(F.isHemisphereLight){const L=e.get(F);L.skyColor.copy(F.color).multiplyScalar(P),L.groundColor.copy(F.groundColor).multiplyScalar(P),r.hemi[p]=L,p++}}g>0&&(t.isWebGL2||n.has("OES_texture_float_linear")===!0?(r.rectAreaLTC1=$.LTC_FLOAT_1,r.rectAreaLTC2=$.LTC_FLOAT_2):n.has("OES_texture_half_float_linear")===!0&&(r.rectAreaLTC1=$.LTC_HALF_1,r.rectAreaLTC2=$.LTC_HALF_2)),r.ambient[0]=h,r.ambient[1]=d,r.ambient[2]=f;const y=r.hash;(y.directionalLength!==m||y.pointLength!==x||y.spotLength!==v||y.rectAreaLength!==g||y.hemiLength!==p||y.numDirectionalShadows!==E||y.numPointShadows!==S||y.numSpotShadows!==A)&&(r.directional.length=m,r.spot.length=v,r.rectArea.length=g,r.point.length=x,r.hemi.length=p,r.directionalShadow.length=E,r.directionalShadowMap.length=E,r.pointShadow.length=S,r.pointShadowMap.length=S,r.spotShadow.length=A,r.spotShadowMap.length=A,r.directionalShadowMatrix.length=E,r.pointShadowMatrix.length=S,r.spotShadowMatrix.length=A,y.directionalLength=m,y.pointLength=x,y.spotLength=v,y.rectAreaLength=g,y.hemiLength=p,y.numDirectionalShadows=E,y.numPointShadows=S,y.numSpotShadows=A,r.version=yp++)}function c(u,h){let d=0,f=0,m=0,x=0,v=0;const g=h.matrixWorldInverse;for(let p=0,E=u.length;p<E;p++){const S=u[p];if(S.isDirectionalLight){const A=r.directional[d];A.direction.setFromMatrixPosition(S.matrixWorld),s.setFromMatrixPosition(S.target.matrixWorld),A.direction.sub(s),A.direction.transformDirection(g),d++}else if(S.isSpotLight){const A=r.spot[m];A.position.setFromMatrixPosition(S.matrixWorld),A.position.applyMatrix4(g),A.direction.setFromMatrixPosition(S.matrixWorld),s.setFromMatrixPosition(S.target.matrixWorld),A.direction.sub(s),A.direction.transformDirection(g),m++}else if(S.isRectAreaLight){const A=r.rectArea[x];A.position.setFromMatrixPosition(S.matrixWorld),A.position.applyMatrix4(g),a.identity(),o.copy(S.matrixWorld),o.premultiply(g),a.extractRotation(o),A.halfWidth.set(S.width*.5,0,0),A.halfHeight.set(0,S.height*.5,0),A.halfWidth.applyMatrix4(a),A.halfHeight.applyMatrix4(a),x++}else if(S.isPointLight){const A=r.point[f];A.position.setFromMatrixPosition(S.matrixWorld),A.position.applyMatrix4(g),f++}else if(S.isHemisphereLight){const A=r.hemi[v];A.direction.setFromMatrixPosition(S.matrixWorld),A.direction.transformDirection(g),A.direction.normalize(),v++}}}return{setup:l,setupView:c,state:r}}function Vo(n,t){const e=new bp(n,t),i=[],r=[];function s(){i.length=0,r.length=0}function o(h){i.push(h)}function a(h){r.push(h)}function l(){e.setup(i)}function c(h){e.setupView(i,h)}return{init:s,state:{lightsArray:i,shadowsArray:r,lights:e},setupLights:l,setupLightsView:c,pushLight:o,pushShadow:a}}function Mp(n,t){let e=new WeakMap;function i(s,o=0){let a;return e.has(s)===!1?(a=new Vo(n,t),e.set(s,[a])):o>=e.get(s).length?(a=new Vo(n,t),e.get(s).push(a)):a=e.get(s)[o],a}function r(){e=new WeakMap}return{get:i,dispose:r}}class Xa extends Vt{constructor(t){super(),this.type="MeshDepthMaterial",this.depthPacking=nh,this.skinning=!1,this.morphTargets=!1,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.skinning=t.skinning,this.morphTargets=t.morphTargets,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}Xa.prototype.isMeshDepthMaterial=!0;class ja extends Vt{constructor(t){super(),this.type="MeshDistanceMaterial",this.referencePosition=new M,this.nearDistance=1,this.farDistance=1e3,this.skinning=!1,this.morphTargets=!1,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.fog=!1,this.setValues(t)}copy(t){return super.copy(t),this.referencePosition.copy(t.referencePosition),this.nearDistance=t.nearDistance,this.farDistance=t.farDistance,this.skinning=t.skinning,this.morphTargets=t.morphTargets,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}ja.prototype.isMeshDistanceMaterial=!0;var wp=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	float mean = 0.0;
	float squared_mean = 0.0;
	float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy ) / resolution ) );
	for ( float i = -1.0; i < 1.0 ; i += SAMPLE_RATE) {
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( i, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, i ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean * HALF_SAMPLE_RATE;
	squared_mean = squared_mean * HALF_SAMPLE_RATE;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`,Sp=`void main() {
	gl_Position = vec4( position, 1.0 );
}`;function Ya(n,t,e){let i=new xr;const r=new Y,s=new Y,o=new Bt,a=[],l=[],c={},u=e.maxTextureSize,h={0:Qt,1:ur,2:dr},d=new ye({defines:{SAMPLE_RATE:2/8,HALF_SAMPLE_RATE:1/8},uniforms:{shadow_pass:{value:null},resolution:{value:new Y},radius:{value:4}},vertexShader:Sp,fragmentShader:wp}),f=d.clone();f.defines.HORIZONTAL_PASS=1;const m=new Ct;m.setAttribute("position",new St(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const x=new $t(m,d),v=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Ea,this.render=function(y,I,O){if(v.enabled===!1||v.autoUpdate===!1&&v.needsUpdate===!1||y.length===0)return;const F=n.getRenderTarget(),V=n.getActiveCubeFace(),P=n.getActiveMipmapLevel(),q=n.state;q.setBlending(ni),q.buffers.color.setClear(1,1,1,1),q.buffers.depth.setTest(!0),q.setScissorTest(!1);for(let R=0,L=y.length;R<L;R++){const N=y[R],C=N.shadow;if(C===void 0||C.autoUpdate===!1&&C.needsUpdate===!1)continue;r.copy(C.mapSize);const W=C.getFrameExtents();if(r.multiply(W),s.copy(C.mapSize),(r.x>u||r.y>u)&&(r.x>u&&(s.x=Math.floor(u/W.x),r.x=s.x*W.x,C.mapSize.x=s.x),r.y>u&&(s.y=Math.floor(u/W.y),r.y=s.y*W.y,C.mapSize.y=s.y)),C.map===null&&!C.isPointLightShadow&&this.type===Kn){const j={minFilter:te,magFilter:te,format:Te};C.map=new an(r.x,r.y,j),C.map.texture.name=N.name+".shadowMap",C.mapPass=new an(r.x,r.y,j),C.camera.updateProjectionMatrix()}if(C.map===null){const j={minFilter:ae,magFilter:ae,format:Te};C.map=new an(r.x,r.y,j),C.map.texture.name=N.name+".shadowMap",C.camera.updateProjectionMatrix()}n.setRenderTarget(C.map),n.clear();const K=C.getViewportCount();for(let j=0;j<K;j++){const rt=C.getViewport(j);o.set(s.x*rt.x,s.y*rt.y,s.x*rt.z,s.y*rt.w),q.viewport(o),C.updateMatrices(N,j),i=C.getFrustum(),A(I,O,C.camera,N,this.type)}!C.isPointLightShadow&&this.type===Kn&&g(C,O),C.needsUpdate=!1}v.needsUpdate=!1,n.setRenderTarget(F,V,P)};function g(y,I){const O=t.update(x);d.uniforms.shadow_pass.value=y.map.texture,d.uniforms.resolution.value=y.mapSize,d.uniforms.radius.value=y.radius,n.setRenderTarget(y.mapPass),n.clear(),n.renderBufferDirect(I,null,O,d,x,null),f.uniforms.shadow_pass.value=y.mapPass.texture,f.uniforms.resolution.value=y.mapSize,f.uniforms.radius.value=y.radius,n.setRenderTarget(y.map),n.clear(),n.renderBufferDirect(I,null,O,f,x,null)}function p(y,I,O){const F=y<<0|I<<1|O<<2;let V=a[F];return V===void 0&&(V=new Xa({depthPacking:ih,morphTargets:y,skinning:I}),a[F]=V),V}function E(y,I,O){const F=y<<0|I<<1|O<<2;let V=l[F];return V===void 0&&(V=new ja({morphTargets:y,skinning:I}),l[F]=V),V}function S(y,I,O,F,V,P,q){let R=null,L=p,N=y.customDepthMaterial;if(F.isPointLight===!0&&(L=E,N=y.customDistanceMaterial),N===void 0){let C=!1;O.morphTargets===!0&&(C=I.morphAttributes&&I.morphAttributes.position&&I.morphAttributes.position.length>0);let W=!1;y.isSkinnedMesh===!0&&O.skinning===!0&&(W=!0);const K=y.isInstancedMesh===!0;R=L(C,W,K)}else R=N;if(n.localClippingEnabled&&O.clipShadows===!0&&O.clippingPlanes.length!==0){const C=R.uuid,W=O.uuid;let K=c[C];K===void 0&&(K={},c[C]=K);let j=K[W];j===void 0&&(j=R.clone(),K[W]=j),R=j}return R.visible=O.visible,R.wireframe=O.wireframe,q===Kn?R.side=O.shadowSide!==null?O.shadowSide:O.side:R.side=O.shadowSide!==null?O.shadowSide:h[O.side],R.clipShadows=O.clipShadows,R.clippingPlanes=O.clippingPlanes,R.clipIntersection=O.clipIntersection,R.wireframeLinewidth=O.wireframeLinewidth,R.linewidth=O.linewidth,F.isPointLight===!0&&R.isMeshDistanceMaterial===!0&&(R.referencePosition.setFromMatrixPosition(F.matrixWorld),R.nearDistance=V,R.farDistance=P),R}function A(y,I,O,F,V){if(y.visible===!1)return;if(y.layers.test(I.layers)&&(y.isMesh||y.isLine||y.isPoints)&&(y.castShadow||y.receiveShadow&&V===Kn)&&(!y.frustumCulled||i.intersectsObject(y))){y.modelViewMatrix.multiplyMatrices(O.matrixWorldInverse,y.matrixWorld);const R=t.update(y),L=y.material;if(Array.isArray(L)){const N=R.groups;for(let C=0,W=N.length;C<W;C++){const K=N[C],j=L[K.materialIndex];if(j&&j.visible){const rt=S(y,R,j,F,O.near,O.far,V);n.renderBufferDirect(O,null,R,rt,y,K)}}}else if(L.visible){const N=S(y,R,L,F,O.near,O.far,V);n.renderBufferDirect(O,null,R,N,y,null)}}const q=y.children;for(let R=0,L=q.length;R<L;R++)A(q[R],I,O,F,V)}}function Ep(n,t,e){const i=e.isWebGL2;function r(){let T=!1;const Z=new Bt;let Q=null;const ct=new Bt(0,0,0,0);return{setMask:function(k){Q!==k&&!T&&(n.colorMask(k,k,k,k),Q=k)},setLocked:function(k){T=k},setClear:function(k,ft,Nt,Xt,Ke){Ke===!0&&(k*=Xt,ft*=Xt,Nt*=Xt),Z.set(k,ft,Nt,Xt),ct.equals(Z)===!1&&(n.clearColor(k,ft,Nt,Xt),ct.copy(Z))},reset:function(){T=!1,Q=null,ct.set(-1,0,0,0)}}}function s(){let T=!1,Z=null,Q=null,ct=null;return{setTest:function(k){k?dt(2929):_t(2929)},setMask:function(k){Z!==k&&!T&&(n.depthMask(k),Z=k)},setFunc:function(k){if(Q!==k){if(k)switch(k){case Hl:n.depthFunc(512);break;case Gl:n.depthFunc(519);break;case kl:n.depthFunc(513);break;case is:n.depthFunc(515);break;case Vl:n.depthFunc(514);break;case Wl:n.depthFunc(518);break;case ql:n.depthFunc(516);break;case Xl:n.depthFunc(517);break;default:n.depthFunc(515)}else n.depthFunc(515);Q=k}},setLocked:function(k){T=k},setClear:function(k){ct!==k&&(n.clearDepth(k),ct=k)},reset:function(){T=!1,Z=null,Q=null,ct=null}}}function o(){let T=!1,Z=null,Q=null,ct=null,k=null,ft=null,Nt=null,Xt=null,Ke=null;return{setTest:function(Wt){T||(Wt?dt(2960):_t(2960))},setMask:function(Wt){Z!==Wt&&!T&&(n.stencilMask(Wt),Z=Wt)},setFunc:function(Wt,Ie,be){(Q!==Wt||ct!==Ie||k!==be)&&(n.stencilFunc(Wt,Ie,be),Q=Wt,ct=Ie,k=be)},setOp:function(Wt,Ie,be){(ft!==Wt||Nt!==Ie||Xt!==be)&&(n.stencilOp(Wt,Ie,be),ft=Wt,Nt=Ie,Xt=be)},setLocked:function(Wt){T=Wt},setClear:function(Wt){Ke!==Wt&&(n.clearStencil(Wt),Ke=Wt)},reset:function(){T=!1,Z=null,Q=null,ct=null,k=null,ft=null,Nt=null,Xt=null,Ke=null}}}const a=new r,l=new s,c=new o;let u={},h=null,d={},f=null,m=!1,x=null,v=null,g=null,p=null,E=null,S=null,A=null,y=!1,I=null,O=null,F=null,V=null,P=null;const q=n.getParameter(35661);let R=!1,L=0;const N=n.getParameter(7938);N.indexOf("WebGL")!==-1?(L=parseFloat(/^WebGL (\d)/.exec(N)[1]),R=L>=1):N.indexOf("OpenGL ES")!==-1&&(L=parseFloat(/^OpenGL ES (\d)/.exec(N)[1]),R=L>=2);let C=null,W={};const K=new Bt(0,0,n.canvas.width,n.canvas.height),j=new Bt(0,0,n.canvas.width,n.canvas.height);function rt(T,Z,Q){const ct=new Uint8Array(4),k=n.createTexture();n.bindTexture(T,k),n.texParameteri(T,10241,9728),n.texParameteri(T,10240,9728);for(let ft=0;ft<Q;ft++)n.texImage2D(Z+ft,0,6408,1,1,0,6408,5121,ct);return k}const st={};st[3553]=rt(3553,3553,1),st[34067]=rt(34067,34069,6),a.setClear(0,0,0,1),l.setClear(1),c.setClear(0),dt(2929),l.setFunc(is),Tt(!1),X(Qs),dt(2884),It(ni);function dt(T){u[T]!==!0&&(n.enable(T),u[T]=!0)}function _t(T){u[T]!==!1&&(n.disable(T),u[T]=!1)}function U(T){T!==h&&(n.bindFramebuffer(36160,T),h=T)}function Dt(T,Z){Z===null&&h!==null&&(Z=h),d[T]!==Z&&(n.bindFramebuffer(T,Z),d[T]=Z)}function Lt(T){return f!==T?(n.useProgram(T),f=T,!0):!1}const xt={[An]:32774,[Rl]:32778,[Cl]:32779};if(i)xt[eo]=32775,xt[no]=32776;else{const T=t.get("EXT_blend_minmax");T!==null&&(xt[eo]=T.MIN_EXT,xt[no]=T.MAX_EXT)}const ut={[Pl]:0,[Dl]:1,[Il]:768,[Aa]:770,[Ul]:776,[Ol]:774,[Fl]:772,[Nl]:769,[La]:771,[zl]:775,[Bl]:773};function It(T,Z,Q,ct,k,ft,Nt,Xt){if(T===ni){m===!0&&(_t(3042),m=!1);return}if(m===!1&&(dt(3042),m=!0),T!==Ll){if(T!==x||Xt!==y){if((v!==An||E!==An)&&(n.blendEquation(32774),v=An,E=An),Xt)switch(T){case ii:n.blendFuncSeparate(1,771,1,771);break;case $s:n.blendFunc(1,1);break;case Ks:n.blendFuncSeparate(0,0,769,771);break;case to:n.blendFuncSeparate(0,768,0,770);break;default:break}else switch(T){case ii:n.blendFuncSeparate(770,771,1,771);break;case $s:n.blendFunc(770,1);break;case Ks:n.blendFunc(0,769);break;case to:n.blendFunc(0,768);break;default:break}g=null,p=null,S=null,A=null,x=T,y=Xt}return}k=k||Z,ft=ft||Q,Nt=Nt||ct,(Z!==v||k!==E)&&(n.blendEquationSeparate(xt[Z],xt[k]),v=Z,E=k),(Q!==g||ct!==p||ft!==S||Nt!==A)&&(n.blendFuncSeparate(ut[Q],ut[ct],ut[ft],ut[Nt]),g=Q,p=ct,S=ft,A=Nt),x=T,y=null}function wt(T,Z){T.side===dr?_t(2884):dt(2884);let Q=T.side===Qt;Z&&(Q=!Q),Tt(Q),T.blending===ii&&T.transparent===!1?It(ni):It(T.blending,T.blendEquation,T.blendSrc,T.blendDst,T.blendEquationAlpha,T.blendSrcAlpha,T.blendDstAlpha,T.premultipliedAlpha),l.setFunc(T.depthFunc),l.setTest(T.depthTest),l.setMask(T.depthWrite),a.setMask(T.colorWrite);const ct=T.stencilWrite;c.setTest(ct),ct&&(c.setMask(T.stencilWriteMask),c.setFunc(T.stencilFunc,T.stencilRef,T.stencilFuncMask),c.setOp(T.stencilFail,T.stencilZFail,T.stencilZPass)),tt(T.polygonOffset,T.polygonOffsetFactor,T.polygonOffsetUnits),T.alphaToCoverage===!0?dt(32926):_t(32926)}function Tt(T){I!==T&&(T?n.frontFace(2304):n.frontFace(2305),I=T)}function X(T){T!==El?(dt(2884),T!==O&&(T===Qs?n.cullFace(1029):T===Tl?n.cullFace(1028):n.cullFace(1032))):_t(2884),O=T}function J(T){T!==F&&(R&&n.lineWidth(T),F=T)}function tt(T,Z,Q){T?(dt(32823),(V!==Z||P!==Q)&&(n.polygonOffset(Z,Q),V=Z,P=Q)):_t(32823)}function lt(T){T?dt(3089):_t(3089)}function nt(T){T===void 0&&(T=33984+q-1),C!==T&&(n.activeTexture(T),C=T)}function w(T,Z){C===null&&nt();let Q=W[C];Q===void 0&&(Q={type:void 0,texture:void 0},W[C]=Q),(Q.type!==T||Q.texture!==Z)&&(n.bindTexture(T,Z||st[T]),Q.type=T,Q.texture=Z)}function b(){const T=W[C];T!==void 0&&T.type!==void 0&&(n.bindTexture(T.type,null),T.type=void 0,T.texture=void 0)}function H(){try{n.compressedTexImage2D.apply(n,arguments)}catch{}}function G(){try{n.texImage2D.apply(n,arguments)}catch{}}function it(){try{n.texImage3D.apply(n,arguments)}catch{}}function at(T){K.equals(T)===!1&&(n.scissor(T.x,T.y,T.z,T.w),K.copy(T))}function Pt(T){j.equals(T)===!1&&(n.viewport(T.x,T.y,T.z,T.w),j.copy(T))}function vt(){n.disable(3042),n.disable(2884),n.disable(2929),n.disable(32823),n.disable(3089),n.disable(2960),n.disable(32926),n.blendEquation(32774),n.blendFunc(1,0),n.blendFuncSeparate(1,0,1,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(513),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(519,0,4294967295),n.stencilOp(7680,7680,7680),n.clearStencil(0),n.cullFace(1029),n.frontFace(2305),n.polygonOffset(0,0),n.activeTexture(33984),n.bindFramebuffer(36160,null),i===!0&&(n.bindFramebuffer(36009,null),n.bindFramebuffer(36008,null)),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),u={},C=null,W={},h=null,d={},f=null,m=!1,x=null,v=null,g=null,p=null,E=null,S=null,A=null,y=!1,I=null,O=null,F=null,V=null,P=null,K.set(0,0,n.canvas.width,n.canvas.height),j.set(0,0,n.canvas.width,n.canvas.height),a.reset(),l.reset(),c.reset()}return{buffers:{color:a,depth:l,stencil:c},enable:dt,disable:_t,bindFramebuffer:Dt,bindXRFramebuffer:U,useProgram:Lt,setBlending:It,setMaterial:wt,setFlipSided:Tt,setCullFace:X,setLineWidth:J,setPolygonOffset:tt,setScissorTest:lt,activeTexture:nt,bindTexture:w,unbindTexture:b,compressedTexImage2D:H,texImage2D:G,texImage3D:it,scissor:at,viewport:Pt,reset:vt}}function Tp(n,t,e,i,r,s,o){const a=r.isWebGL2,l=r.maxTextures,c=r.maxCubemapSize,u=r.maxTextureSize,h=r.maxSamples,d=new WeakMap;let f,m=!1;try{m=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function x(w,b){return m?new OffscreenCanvas(w,b):document.createElementNS("http://www.w3.org/1999/xhtml","canvas")}function v(w,b,H,G){let it=1;if((w.width>G||w.height>G)&&(it=G/Math.max(w.width,w.height)),it<1||b===!0)if(typeof HTMLImageElement<"u"&&w instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&w instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&w instanceof ImageBitmap){const at=b?bt.floorPowerOfTwo:Math.floor,Pt=at(it*w.width),vt=at(it*w.height);f===void 0&&(f=x(Pt,vt));const T=H?x(Pt,vt):f;return T.width=Pt,T.height=vt,T.getContext("2d").drawImage(w,0,0,Pt,vt),T}else return"data"in w,w;return w}function g(w){return bt.isPowerOfTwo(w.width)&&bt.isPowerOfTwo(w.height)}function p(w){return a?!1:w.wrapS!==me||w.wrapT!==me||w.minFilter!==ae&&w.minFilter!==te}function E(w,b){return w.generateMipmaps&&b&&w.minFilter!==ae&&w.minFilter!==te}function S(w,b,H,G){n.generateMipmap(w);const it=i.get(b);it.__maxMipLevel=Math.log2(Math.max(H,G))}function A(w,b,H){if(a===!1)return b;if(w!==null&&n[w]!==void 0)return n[w];let G=b;return b===6403&&(H===5126&&(G=33326),H===5131&&(G=33325),H===5121&&(G=33321)),b===6407&&(H===5126&&(G=34837),H===5131&&(G=34843),H===5121&&(G=32849)),b===6408&&(H===5126&&(G=34836),H===5131&&(G=34842),H===5121&&(G=32856)),(G===33325||G===33326||G===34842||G===34836)&&t.get("EXT_color_buffer_float"),G}function y(w){return w===ae||w===so||w===oo?9728:9729}function I(w){const b=w.target;b.removeEventListener("dispose",I),F(b),b.isVideoTexture&&d.delete(b),o.memory.textures--}function O(w){const b=w.target;b.removeEventListener("dispose",O),V(b),o.memory.textures--}function F(w){const b=i.get(w);b.__webglInit!==void 0&&(n.deleteTexture(b.__webglTexture),i.remove(w))}function V(w){const b=w.texture,H=i.get(w),G=i.get(b);if(w){if(G.__webglTexture!==void 0&&n.deleteTexture(G.__webglTexture),w.depthTexture&&w.depthTexture.dispose(),w.isWebGLCubeRenderTarget)for(let it=0;it<6;it++)n.deleteFramebuffer(H.__webglFramebuffer[it]),H.__webglDepthbuffer&&n.deleteRenderbuffer(H.__webglDepthbuffer[it]);else n.deleteFramebuffer(H.__webglFramebuffer),H.__webglDepthbuffer&&n.deleteRenderbuffer(H.__webglDepthbuffer),H.__webglMultisampledFramebuffer&&n.deleteFramebuffer(H.__webglMultisampledFramebuffer),H.__webglColorRenderbuffer&&n.deleteRenderbuffer(H.__webglColorRenderbuffer),H.__webglDepthRenderbuffer&&n.deleteRenderbuffer(H.__webglDepthRenderbuffer);i.remove(b),i.remove(w)}}let P=0;function q(){P=0}function R(){const w=P;return w>=l,P+=1,w}function L(w,b){const H=i.get(w);if(w.isVideoTexture&&X(w),w.version>0&&H.__version!==w.version){const G=w.image;if(G!==void 0){if(G.complete!==!1){dt(H,w,b);return}}}e.activeTexture(33984+b),e.bindTexture(3553,H.__webglTexture)}function N(w,b){const H=i.get(w);if(w.version>0&&H.__version!==w.version){dt(H,w,b);return}e.activeTexture(33984+b),e.bindTexture(35866,H.__webglTexture)}function C(w,b){const H=i.get(w);if(w.version>0&&H.__version!==w.version){dt(H,w,b);return}e.activeTexture(33984+b),e.bindTexture(32879,H.__webglTexture)}function W(w,b){const H=i.get(w);if(w.version>0&&H.__version!==w.version){_t(H,w,b);return}e.activeTexture(33984+b),e.bindTexture(34067,H.__webglTexture)}const K={[rs]:10497,[me]:33071,[ss]:33648},j={[ae]:9728,[so]:9984,[oo]:9986,[te]:9729,[tc]:9985,[pr]:9987};function rt(w,b,H){if(H?(n.texParameteri(w,10242,K[b.wrapS]),n.texParameteri(w,10243,K[b.wrapT]),(w===32879||w===35866)&&n.texParameteri(w,32882,K[b.wrapR]),n.texParameteri(w,10240,j[b.magFilter]),n.texParameteri(w,10241,j[b.minFilter])):(n.texParameteri(w,10242,33071),n.texParameteri(w,10243,33071),(w===32879||w===35866)&&n.texParameteri(w,32882,33071),b.wrapS!==me||b.wrapT,n.texParameteri(w,10240,y(b.magFilter)),n.texParameteri(w,10241,y(b.minFilter)),b.minFilter!==ae&&b.minFilter),t.has("EXT_texture_filter_anisotropic")===!0){const G=t.get("EXT_texture_filter_anisotropic");if(b.type===Ye&&t.has("OES_texture_float_linear")===!1||a===!1&&b.type===er&&t.has("OES_texture_half_float_linear")===!1)return;(b.anisotropy>1||i.get(b).__currentAnisotropy)&&(n.texParameterf(w,G.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(b.anisotropy,r.getMaxAnisotropy())),i.get(b).__currentAnisotropy=b.anisotropy)}}function st(w,b){w.__webglInit===void 0&&(w.__webglInit=!0,b.addEventListener("dispose",I),w.__webglTexture=n.createTexture(),o.memory.textures++)}function dt(w,b,H){let G=3553;b.isDataTexture2DArray&&(G=35866),b.isDataTexture3D&&(G=32879),st(w,b),e.activeTexture(33984+H),e.bindTexture(G,w.__webglTexture),n.pixelStorei(37440,b.flipY),n.pixelStorei(37441,b.premultiplyAlpha),n.pixelStorei(3317,b.unpackAlignment),n.pixelStorei(37443,0);const it=p(b)&&g(b.image)===!1,at=v(b.image,it,!1,u),Pt=g(at)||a,vt=s.convert(b.format);let T=s.convert(b.type),Z=A(b.internalFormat,vt,T);rt(G,b,Pt);let Q;const ct=b.mipmaps;if(b.isDepthTexture)Z=6402,a?b.type===Ye?Z=36012:b.type===Ki?Z=33190:b.type===si?Z=35056:Z=33189:b.type,b.format===Pn&&Z===6402&&b.type!==tr&&b.type!==Ki&&(b.type=tr,T=s.convert(b.type)),b.format===ci&&Z===6402&&(Z=34041,b.type!==si&&(b.type=si,T=s.convert(b.type))),e.texImage2D(3553,0,Z,at.width,at.height,0,vt,T,null);else if(b.isDataTexture)if(ct.length>0&&Pt){for(let k=0,ft=ct.length;k<ft;k++)Q=ct[k],e.texImage2D(3553,k,Z,Q.width,Q.height,0,vt,T,Q.data);b.generateMipmaps=!1,w.__maxMipLevel=ct.length-1}else e.texImage2D(3553,0,Z,at.width,at.height,0,vt,T,at.data),w.__maxMipLevel=0;else if(b.isCompressedTexture){for(let k=0,ft=ct.length;k<ft;k++)Q=ct[k],b.format!==Te&&b.format!==on?vt!==null&&e.compressedTexImage2D(3553,k,Z,Q.width,Q.height,0,Q.data):e.texImage2D(3553,k,Z,Q.width,Q.height,0,vt,T,Q.data);w.__maxMipLevel=ct.length-1}else if(b.isDataTexture2DArray)e.texImage3D(35866,0,Z,at.width,at.height,at.depth,0,vt,T,at.data),w.__maxMipLevel=0;else if(b.isDataTexture3D)e.texImage3D(32879,0,Z,at.width,at.height,at.depth,0,vt,T,at.data),w.__maxMipLevel=0;else if(ct.length>0&&Pt){for(let k=0,ft=ct.length;k<ft;k++)Q=ct[k],e.texImage2D(3553,k,Z,vt,T,Q);b.generateMipmaps=!1,w.__maxMipLevel=ct.length-1}else e.texImage2D(3553,0,Z,vt,T,at),w.__maxMipLevel=0;E(b,Pt)&&S(G,b,at.width,at.height),w.__version=b.version,b.onUpdate&&b.onUpdate(b)}function _t(w,b,H){if(b.image.length!==6)return;st(w,b),e.activeTexture(33984+H),e.bindTexture(34067,w.__webglTexture),n.pixelStorei(37440,b.flipY),n.pixelStorei(37441,b.premultiplyAlpha),n.pixelStorei(3317,b.unpackAlignment),n.pixelStorei(37443,0);const G=b&&(b.isCompressedTexture||b.image[0].isCompressedTexture),it=b.image[0]&&b.image[0].isDataTexture,at=[];for(let k=0;k<6;k++)!G&&!it?at[k]=v(b.image[k],!1,!0,c):at[k]=it?b.image[k].image:b.image[k];const Pt=at[0],vt=g(Pt)||a,T=s.convert(b.format),Z=s.convert(b.type),Q=A(b.internalFormat,T,Z);rt(34067,b,vt);let ct;if(G){for(let k=0;k<6;k++){ct=at[k].mipmaps;for(let ft=0;ft<ct.length;ft++){const Nt=ct[ft];b.format!==Te&&b.format!==on?T!==null&&e.compressedTexImage2D(34069+k,ft,Q,Nt.width,Nt.height,0,Nt.data):e.texImage2D(34069+k,ft,Q,Nt.width,Nt.height,0,T,Z,Nt.data)}}w.__maxMipLevel=ct.length-1}else{ct=b.mipmaps;for(let k=0;k<6;k++)if(it){e.texImage2D(34069+k,0,Q,at[k].width,at[k].height,0,T,Z,at[k].data);for(let ft=0;ft<ct.length;ft++){const Xt=ct[ft].image[k].image;e.texImage2D(34069+k,ft+1,Q,Xt.width,Xt.height,0,T,Z,Xt.data)}}else{e.texImage2D(34069+k,0,Q,T,Z,at[k]);for(let ft=0;ft<ct.length;ft++){const Nt=ct[ft];e.texImage2D(34069+k,ft+1,Q,T,Z,Nt.image[k])}}w.__maxMipLevel=ct.length}E(b,vt)&&S(34067,b,Pt.width,Pt.height),w.__version=b.version,b.onUpdate&&b.onUpdate(b)}function U(w,b,H,G){const it=b.texture,at=s.convert(it.format),Pt=s.convert(it.type),vt=A(it.internalFormat,at,Pt);G===32879||G===35866?e.texImage3D(G,0,vt,b.width,b.height,b.depth,0,at,Pt,null):e.texImage2D(G,0,vt,b.width,b.height,0,at,Pt,null),e.bindFramebuffer(36160,w),n.framebufferTexture2D(36160,H,G,i.get(it).__webglTexture,0),e.bindFramebuffer(36160,null)}function Dt(w,b,H){if(n.bindRenderbuffer(36161,w),b.depthBuffer&&!b.stencilBuffer){let G=33189;if(H){const it=b.depthTexture;it&&it.isDepthTexture&&(it.type===Ye?G=36012:it.type===Ki&&(G=33190));const at=Tt(b);n.renderbufferStorageMultisample(36161,at,G,b.width,b.height)}else n.renderbufferStorage(36161,G,b.width,b.height);n.framebufferRenderbuffer(36160,36096,36161,w)}else if(b.depthBuffer&&b.stencilBuffer){if(H){const G=Tt(b);n.renderbufferStorageMultisample(36161,G,35056,b.width,b.height)}else n.renderbufferStorage(36161,34041,b.width,b.height);n.framebufferRenderbuffer(36160,33306,36161,w)}else{const G=b.texture,it=s.convert(G.format),at=s.convert(G.type),Pt=A(G.internalFormat,it,at);if(H){const vt=Tt(b);n.renderbufferStorageMultisample(36161,vt,Pt,b.width,b.height)}else n.renderbufferStorage(36161,Pt,b.width,b.height)}n.bindRenderbuffer(36161,null)}function Lt(w,b){if(b&&b.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(36160,w),!(b.depthTexture&&b.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");(!i.get(b.depthTexture).__webglTexture||b.depthTexture.image.width!==b.width||b.depthTexture.image.height!==b.height)&&(b.depthTexture.image.width=b.width,b.depthTexture.image.height=b.height,b.depthTexture.needsUpdate=!0),L(b.depthTexture,0);const G=i.get(b.depthTexture).__webglTexture;if(b.depthTexture.format===Pn)n.framebufferTexture2D(36160,36096,3553,G,0);else if(b.depthTexture.format===ci)n.framebufferTexture2D(36160,33306,3553,G,0);else throw new Error("Unknown depthTexture format")}function xt(w){const b=i.get(w),H=w.isWebGLCubeRenderTarget===!0;if(w.depthTexture){if(H)throw new Error("target.depthTexture not supported in Cube render targets");Lt(b.__webglFramebuffer,w)}else if(H){b.__webglDepthbuffer=[];for(let G=0;G<6;G++)e.bindFramebuffer(36160,b.__webglFramebuffer[G]),b.__webglDepthbuffer[G]=n.createRenderbuffer(),Dt(b.__webglDepthbuffer[G],w,!1)}else e.bindFramebuffer(36160,b.__webglFramebuffer),b.__webglDepthbuffer=n.createRenderbuffer(),Dt(b.__webglDepthbuffer,w,!1);e.bindFramebuffer(36160,null)}function ut(w){const b=w.texture,H=i.get(w),G=i.get(b);w.addEventListener("dispose",O),G.__webglTexture=n.createTexture(),G.__version=b.version,o.memory.textures++;const it=w.isWebGLCubeRenderTarget===!0,at=w.isWebGLMultisampleRenderTarget===!0,Pt=b.isDataTexture3D||b.isDataTexture2DArray,vt=g(w)||a;if(a&&b.format===on&&(b.type===Ye||b.type===er)&&(b.format=Te),it){H.__webglFramebuffer=[];for(let T=0;T<6;T++)H.__webglFramebuffer[T]=n.createFramebuffer()}else if(H.__webglFramebuffer=n.createFramebuffer(),at&&a){H.__webglMultisampledFramebuffer=n.createFramebuffer(),H.__webglColorRenderbuffer=n.createRenderbuffer(),n.bindRenderbuffer(36161,H.__webglColorRenderbuffer);const T=s.convert(b.format),Z=s.convert(b.type),Q=A(b.internalFormat,T,Z),ct=Tt(w);n.renderbufferStorageMultisample(36161,ct,Q,w.width,w.height),e.bindFramebuffer(36160,H.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(36160,36064,36161,H.__webglColorRenderbuffer),n.bindRenderbuffer(36161,null),w.depthBuffer&&(H.__webglDepthRenderbuffer=n.createRenderbuffer(),Dt(H.__webglDepthRenderbuffer,w,!0)),e.bindFramebuffer(36160,null)}if(it){e.bindTexture(34067,G.__webglTexture),rt(34067,b,vt);for(let T=0;T<6;T++)U(H.__webglFramebuffer[T],w,36064,34069+T);E(b,vt)&&S(34067,b,w.width,w.height),e.bindTexture(34067,null)}else{let T=3553;Pt&&a&&(T=b.isDataTexture3D?32879:35866),e.bindTexture(T,G.__webglTexture),rt(T,b,vt),U(H.__webglFramebuffer,w,36064,T),E(b,vt)&&S(3553,b,w.width,w.height),e.bindTexture(3553,null)}w.depthBuffer&&xt(w)}function It(w){const b=w.texture,H=g(w)||a;if(E(b,H)){const G=w.isWebGLCubeRenderTarget?34067:3553,it=i.get(b).__webglTexture;e.bindTexture(G,it),S(G,b,w.width,w.height),e.bindTexture(G,null)}}function wt(w){if(w.isWebGLMultisampleRenderTarget&&a){const b=i.get(w);e.bindFramebuffer(36008,b.__webglMultisampledFramebuffer),e.bindFramebuffer(36009,b.__webglFramebuffer);const H=w.width,G=w.height;let it=16384;w.depthBuffer&&(it|=256),w.stencilBuffer&&(it|=1024),n.blitFramebuffer(0,0,H,G,0,0,H,G,it,9728),e.bindFramebuffer(36160,b.__webglMultisampledFramebuffer)}}function Tt(w){return a&&w.isWebGLMultisampleRenderTarget?Math.min(h,w.samples):0}function X(w){const b=o.render.frame;d.get(w)!==b&&(d.set(w,b),w.update())}let J=!1,tt=!1;function lt(w,b){w&&w.isWebGLRenderTarget&&(J===!1&&(J=!0),w=w.texture),L(w,b)}function nt(w,b){w&&w.isWebGLCubeRenderTarget&&(tt===!1&&(tt=!0),w=w.texture),W(w,b)}this.allocateTextureUnit=R,this.resetTextureUnits=q,this.setTexture2D=L,this.setTexture2DArray=N,this.setTexture3D=C,this.setTextureCube=W,this.setupRenderTarget=ut,this.updateRenderTargetMipmap=It,this.updateMultisampleRenderTarget=wt,this.safeSetTexture2D=lt,this.safeSetTextureCube=nt}function Ap(n,t,e){const i=e.isWebGL2;function r(s){let o;if(s===Cs)return 5121;if(s===rc)return 32819;if(s===sc)return 32820;if(s===oc)return 33635;if(s===ec)return 5120;if(s===nc)return 5122;if(s===tr)return 5123;if(s===ic)return 5124;if(s===Ki)return 5125;if(s===Ye)return 5126;if(s===er)return i?5131:(o=t.get("OES_texture_half_float"),o!==null?o.HALF_FLOAT_OES:null);if(s===ac)return 6406;if(s===on)return 6407;if(s===Te)return 6408;if(s===lc)return 6409;if(s===cc)return 6410;if(s===Pn)return 6402;if(s===ci)return 34041;if(s===hc)return 6403;if(s===uc)return 36244;if(s===dc)return 33319;if(s===fc)return 33320;if(s===pc)return 36248;if(s===mc)return 36249;if(s===ao||s===lo||s===co||s===ho)if(o=t.get("WEBGL_compressed_texture_s3tc"),o!==null){if(s===ao)return o.COMPRESSED_RGB_S3TC_DXT1_EXT;if(s===lo)return o.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(s===co)return o.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(s===ho)return o.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(s===uo||s===fo||s===po||s===mo)if(o=t.get("WEBGL_compressed_texture_pvrtc"),o!==null){if(s===uo)return o.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(s===fo)return o.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(s===po)return o.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(s===mo)return o.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(s===gc)return o=t.get("WEBGL_compressed_texture_etc1"),o!==null?o.COMPRESSED_RGB_ETC1_WEBGL:null;if((s===go||s===xo)&&(o=t.get("WEBGL_compressed_texture_etc"),o!==null)){if(s===go)return o.COMPRESSED_RGB8_ETC2;if(s===xo)return o.COMPRESSED_RGBA8_ETC2_EAC}if(s===xc||s===vc||s===yc||s===_c||s===bc||s===Mc||s===wc||s===Sc||s===Ec||s===Tc||s===Ac||s===Lc||s===Rc||s===Cc||s===Dc||s===Ic||s===Nc||s===Fc||s===Bc||s===Oc||s===zc||s===Uc||s===Hc||s===Gc||s===kc||s===Vc||s===Wc||s===qc)return o=t.get("WEBGL_compressed_texture_astc"),o!==null?s:null;if(s===Pc)return o=t.get("EXT_texture_compression_bptc"),o!==null?s:null;if(s===si)return i?34042:(o=t.get("WEBGL_depth_texture"),o!==null?o.UNSIGNED_INT_24_8_WEBGL:null)}return{convert:r}}class Za extends ue{constructor(t=[]){super(),this.cameras=t}}Za.prototype.isArrayCamera=!0;class ei extends gt{constructor(){super(),this.type="Group"}}ei.prototype.isGroup=!0;function oi(){this._targetRay=null,this._grip=null,this._hand=null}Object.assign(oi.prototype,{constructor:oi,getHandSpace:function(){return this._hand===null&&(this._hand=new ei,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand},getTargetRaySpace:function(){return this._targetRay===null&&(this._targetRay=new ei,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1),this._targetRay},getGripSpace:function(){return this._grip===null&&(this._grip=new ei,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1),this._grip},dispatchEvent:function(n){return this._targetRay!==null&&this._targetRay.dispatchEvent(n),this._grip!==null&&this._grip.dispatchEvent(n),this._hand!==null&&this._hand.dispatchEvent(n),this},disconnect:function(n){return this.dispatchEvent({type:"disconnected",data:n}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this},update:function(n,t,e){let i=null,r=null,s=null;const o=this._targetRay,a=this._grip,l=this._hand;if(n&&t.session.visibilityState!=="visible-blurred")if(o!==null&&(i=t.getPose(n.targetRaySpace,e),i!==null&&(o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale))),l&&n.hand){s=!0;for(const m of n.hand.values()){const x=t.getJointPose(m,e);if(l.joints[m.jointName]===void 0){const g=new ei;g.matrixAutoUpdate=!1,g.visible=!1,l.joints[m.jointName]=g,l.add(g)}const v=l.joints[m.jointName];x!==null&&(v.matrix.fromArray(x.transform.matrix),v.matrix.decompose(v.position,v.rotation,v.scale),v.jointRadius=x.radius),v.visible=x!==null}const c=l.joints["index-finger-tip"],u=l.joints["thumb-tip"],h=c.position.distanceTo(u.position),d=.02,f=.005;l.inputState.pinching&&h>d+f?(l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:n.handedness,target:this})):!l.inputState.pinching&&h<=d-f&&(l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:n.handedness,target:this}))}else a!==null&&n.gripSpace&&(r=t.getPose(n.gripSpace,e),r!==null&&(a.matrix.fromArray(r.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale)));return o!==null&&(o.visible=i!==null),a!==null&&(a.visible=r!==null),l!==null&&(l.visible=s!==null),this}});function Ja(n,t){const e=this,i=n.state;let r=null,s=1,o=null,a="local-floor",l=null;const c=[],u=new Map,h=new ue;h.layers.enable(1),h.viewport=new Bt;const d=new ue;d.layers.enable(2),d.viewport=new Bt;const f=[h,d],m=new Za;m.layers.enable(1),m.layers.enable(2);let x=null,v=null;this.enabled=!1,this.isPresenting=!1,this.getController=function(P){let q=c[P];return q===void 0&&(q=new oi,c[P]=q),q.getTargetRaySpace()},this.getControllerGrip=function(P){let q=c[P];return q===void 0&&(q=new oi,c[P]=q),q.getGripSpace()},this.getHand=function(P){let q=c[P];return q===void 0&&(q=new oi,c[P]=q),q.getHandSpace()};function g(P){const q=u.get(P.inputSource);q&&q.dispatchEvent({type:P.type,data:P.inputSource})}function p(){u.forEach(function(P,q){P.disconnect(q)}),u.clear(),x=null,v=null,i.bindXRFramebuffer(null),n.setRenderTarget(n.getRenderTarget()),V.stop(),e.isPresenting=!1,e.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(P){s=P,e.isPresenting},this.setReferenceSpaceType=function(P){a=P,e.isPresenting},this.getReferenceSpace=function(){return o},this.getSession=function(){return r},this.setSession=async function(P){if(r=P,r!==null){r.addEventListener("select",g),r.addEventListener("selectstart",g),r.addEventListener("selectend",g),r.addEventListener("squeeze",g),r.addEventListener("squeezestart",g),r.addEventListener("squeezeend",g),r.addEventListener("end",p),r.addEventListener("inputsourceschange",E);const q=t.getContextAttributes();q.xrCompatible!==!0&&await t.makeXRCompatible();const R={antialias:q.antialias,alpha:q.alpha,depth:q.depth,stencil:q.stencil,framebufferScaleFactor:s},L=new XRWebGLLayer(r,t,R);r.updateRenderState({baseLayer:L}),o=await r.requestReferenceSpace(a),V.setContext(r),V.start(),e.isPresenting=!0,e.dispatchEvent({type:"sessionstart"})}};function E(P){const q=r.inputSources;for(let R=0;R<c.length;R++)u.set(q[R],c[R]);for(let R=0;R<P.removed.length;R++){const L=P.removed[R],N=u.get(L);N&&(N.dispatchEvent({type:"disconnected",data:L}),u.delete(L))}for(let R=0;R<P.added.length;R++){const L=P.added[R],N=u.get(L);N&&N.dispatchEvent({type:"connected",data:L})}}const S=new M,A=new M;function y(P,q,R){S.setFromMatrixPosition(q.matrixWorld),A.setFromMatrixPosition(R.matrixWorld);const L=S.distanceTo(A),N=q.projectionMatrix.elements,C=R.projectionMatrix.elements,W=N[14]/(N[10]-1),K=N[14]/(N[10]+1),j=(N[9]+1)/N[5],rt=(N[9]-1)/N[5],st=(N[8]-1)/N[0],dt=(C[8]+1)/C[0],_t=W*st,U=W*dt,Dt=L/(-st+dt),Lt=Dt*-st;q.matrixWorld.decompose(P.position,P.quaternion,P.scale),P.translateX(Lt),P.translateZ(Dt),P.matrixWorld.compose(P.position,P.quaternion,P.scale),P.matrixWorldInverse.copy(P.matrixWorld).invert();const xt=W+Dt,ut=K+Dt,It=_t-Lt,wt=U+(L-Lt),Tt=j*K/ut*xt,X=rt*K/ut*xt;P.projectionMatrix.makePerspective(It,wt,Tt,X,xt,ut)}function I(P,q){q===null?P.matrixWorld.copy(P.matrix):P.matrixWorld.multiplyMatrices(q.matrixWorld,P.matrix),P.matrixWorldInverse.copy(P.matrixWorld).invert()}this.getCamera=function(P){m.near=d.near=h.near=P.near,m.far=d.far=h.far=P.far,(x!==m.near||v!==m.far)&&(r.updateRenderState({depthNear:m.near,depthFar:m.far}),x=m.near,v=m.far);const q=P.parent,R=m.cameras;I(m,q);for(let N=0;N<R.length;N++)I(R[N],q);P.matrixWorld.copy(m.matrixWorld),P.matrix.copy(m.matrix),P.matrix.decompose(P.position,P.quaternion,P.scale);const L=P.children;for(let N=0,C=L.length;N<C;N++)L[N].updateMatrixWorld(!0);return R.length===2?y(m,h,d):m.projectionMatrix.copy(h.projectionMatrix),m};let O=null;function F(P,q){if(l=q.getViewerPose(o),l!==null){const L=l.views,N=r.renderState.baseLayer;i.bindXRFramebuffer(N.framebuffer);let C=!1;L.length!==m.cameras.length&&(m.cameras.length=0,C=!0);for(let W=0;W<L.length;W++){const K=L[W],j=N.getViewport(K),rt=f[W];rt.matrix.fromArray(K.transform.matrix),rt.projectionMatrix.fromArray(K.projectionMatrix),rt.viewport.set(j.x,j.y,j.width,j.height),W===0&&m.matrix.copy(rt.matrix),C===!0&&m.cameras.push(rt)}}const R=r.inputSources;for(let L=0;L<c.length;L++){const N=c[L],C=R[L];N.update(C,q,o)}O&&O(P,q)}const V=new Ba;V.setAnimationLoop(F),this.setAnimationLoop=function(P){O=P},this.dispose=function(){}}Object.assign(Ja.prototype,$e.prototype);function Lp(n){function t(g,p){g.fogColor.value.copy(p.color),p.isFog?(g.fogNear.value=p.near,g.fogFar.value=p.far):p.isFogExp2&&(g.fogDensity.value=p.density)}function e(g,p,E,S){p.isMeshBasicMaterial?i(g,p):p.isMeshLambertMaterial?(i(g,p),l(g,p)):p.isMeshToonMaterial?(i(g,p),u(g,p)):p.isMeshPhongMaterial?(i(g,p),c(g,p)):p.isMeshStandardMaterial?(i(g,p),p.isMeshPhysicalMaterial?d(g,p):h(g,p)):p.isMeshMatcapMaterial?(i(g,p),f(g,p)):p.isMeshDepthMaterial?(i(g,p),m(g,p)):p.isMeshDistanceMaterial?(i(g,p),x(g,p)):p.isMeshNormalMaterial?(i(g,p),v(g,p)):p.isLineBasicMaterial?(r(g,p),p.isLineDashedMaterial&&s(g,p)):p.isPointsMaterial?o(g,p,E,S):p.isSpriteMaterial?a(g,p):p.isShadowMaterial?(g.color.value.copy(p.color),g.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function i(g,p){g.opacity.value=p.opacity,p.color&&g.diffuse.value.copy(p.color),p.emissive&&g.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(g.map.value=p.map),p.alphaMap&&(g.alphaMap.value=p.alphaMap),p.specularMap&&(g.specularMap.value=p.specularMap);const E=n.get(p).envMap;if(E){g.envMap.value=E,g.flipEnvMap.value=E.isCubeTexture&&E._needsFlipEnvMap?-1:1,g.reflectivity.value=p.reflectivity,g.refractionRatio.value=p.refractionRatio;const y=n.get(E).__maxMipLevel;y!==void 0&&(g.maxMipLevel.value=y)}p.lightMap&&(g.lightMap.value=p.lightMap,g.lightMapIntensity.value=p.lightMapIntensity),p.aoMap&&(g.aoMap.value=p.aoMap,g.aoMapIntensity.value=p.aoMapIntensity);let S;p.map?S=p.map:p.specularMap?S=p.specularMap:p.displacementMap?S=p.displacementMap:p.normalMap?S=p.normalMap:p.bumpMap?S=p.bumpMap:p.roughnessMap?S=p.roughnessMap:p.metalnessMap?S=p.metalnessMap:p.alphaMap?S=p.alphaMap:p.emissiveMap?S=p.emissiveMap:p.clearcoatMap?S=p.clearcoatMap:p.clearcoatNormalMap?S=p.clearcoatNormalMap:p.clearcoatRoughnessMap&&(S=p.clearcoatRoughnessMap),S!==void 0&&(S.isWebGLRenderTarget&&(S=S.texture),S.matrixAutoUpdate===!0&&S.updateMatrix(),g.uvTransform.value.copy(S.matrix));let A;p.aoMap?A=p.aoMap:p.lightMap&&(A=p.lightMap),A!==void 0&&(A.isWebGLRenderTarget&&(A=A.texture),A.matrixAutoUpdate===!0&&A.updateMatrix(),g.uv2Transform.value.copy(A.matrix))}function r(g,p){g.diffuse.value.copy(p.color),g.opacity.value=p.opacity}function s(g,p){g.dashSize.value=p.dashSize,g.totalSize.value=p.dashSize+p.gapSize,g.scale.value=p.scale}function o(g,p,E,S){g.diffuse.value.copy(p.color),g.opacity.value=p.opacity,g.size.value=p.size*E,g.scale.value=S*.5,p.map&&(g.map.value=p.map),p.alphaMap&&(g.alphaMap.value=p.alphaMap);let A;p.map?A=p.map:p.alphaMap&&(A=p.alphaMap),A!==void 0&&(A.matrixAutoUpdate===!0&&A.updateMatrix(),g.uvTransform.value.copy(A.matrix))}function a(g,p){g.diffuse.value.copy(p.color),g.opacity.value=p.opacity,g.rotation.value=p.rotation,p.map&&(g.map.value=p.map),p.alphaMap&&(g.alphaMap.value=p.alphaMap);let E;p.map?E=p.map:p.alphaMap&&(E=p.alphaMap),E!==void 0&&(E.matrixAutoUpdate===!0&&E.updateMatrix(),g.uvTransform.value.copy(E.matrix))}function l(g,p){p.emissiveMap&&(g.emissiveMap.value=p.emissiveMap)}function c(g,p){g.specular.value.copy(p.specular),g.shininess.value=Math.max(p.shininess,1e-4),p.emissiveMap&&(g.emissiveMap.value=p.emissiveMap),p.bumpMap&&(g.bumpMap.value=p.bumpMap,g.bumpScale.value=p.bumpScale,p.side===Qt&&(g.bumpScale.value*=-1)),p.normalMap&&(g.normalMap.value=p.normalMap,g.normalScale.value.copy(p.normalScale),p.side===Qt&&g.normalScale.value.negate()),p.displacementMap&&(g.displacementMap.value=p.displacementMap,g.displacementScale.value=p.displacementScale,g.displacementBias.value=p.displacementBias)}function u(g,p){p.gradientMap&&(g.gradientMap.value=p.gradientMap),p.emissiveMap&&(g.emissiveMap.value=p.emissiveMap),p.bumpMap&&(g.bumpMap.value=p.bumpMap,g.bumpScale.value=p.bumpScale,p.side===Qt&&(g.bumpScale.value*=-1)),p.normalMap&&(g.normalMap.value=p.normalMap,g.normalScale.value.copy(p.normalScale),p.side===Qt&&g.normalScale.value.negate()),p.displacementMap&&(g.displacementMap.value=p.displacementMap,g.displacementScale.value=p.displacementScale,g.displacementBias.value=p.displacementBias)}function h(g,p){g.roughness.value=p.roughness,g.metalness.value=p.metalness,p.roughnessMap&&(g.roughnessMap.value=p.roughnessMap),p.metalnessMap&&(g.metalnessMap.value=p.metalnessMap),p.emissiveMap&&(g.emissiveMap.value=p.emissiveMap),p.bumpMap&&(g.bumpMap.value=p.bumpMap,g.bumpScale.value=p.bumpScale,p.side===Qt&&(g.bumpScale.value*=-1)),p.normalMap&&(g.normalMap.value=p.normalMap,g.normalScale.value.copy(p.normalScale),p.side===Qt&&g.normalScale.value.negate()),p.displacementMap&&(g.displacementMap.value=p.displacementMap,g.displacementScale.value=p.displacementScale,g.displacementBias.value=p.displacementBias),n.get(p).envMap&&(g.envMapIntensity.value=p.envMapIntensity)}function d(g,p){h(g,p),g.reflectivity.value=p.reflectivity,g.clearcoat.value=p.clearcoat,g.clearcoatRoughness.value=p.clearcoatRoughness,p.sheen&&g.sheen.value.copy(p.sheen),p.clearcoatMap&&(g.clearcoatMap.value=p.clearcoatMap),p.clearcoatRoughnessMap&&(g.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap),p.clearcoatNormalMap&&(g.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),g.clearcoatNormalMap.value=p.clearcoatNormalMap,p.side===Qt&&g.clearcoatNormalScale.value.negate()),g.transmission.value=p.transmission,p.transmissionMap&&(g.transmissionMap.value=p.transmissionMap)}function f(g,p){p.matcap&&(g.matcap.value=p.matcap),p.bumpMap&&(g.bumpMap.value=p.bumpMap,g.bumpScale.value=p.bumpScale,p.side===Qt&&(g.bumpScale.value*=-1)),p.normalMap&&(g.normalMap.value=p.normalMap,g.normalScale.value.copy(p.normalScale),p.side===Qt&&g.normalScale.value.negate()),p.displacementMap&&(g.displacementMap.value=p.displacementMap,g.displacementScale.value=p.displacementScale,g.displacementBias.value=p.displacementBias)}function m(g,p){p.displacementMap&&(g.displacementMap.value=p.displacementMap,g.displacementScale.value=p.displacementScale,g.displacementBias.value=p.displacementBias)}function x(g,p){p.displacementMap&&(g.displacementMap.value=p.displacementMap,g.displacementScale.value=p.displacementScale,g.displacementBias.value=p.displacementBias),g.referencePosition.value.copy(p.referencePosition),g.nearDistance.value=p.nearDistance,g.farDistance.value=p.farDistance}function v(g,p){p.bumpMap&&(g.bumpMap.value=p.bumpMap,g.bumpScale.value=p.bumpScale,p.side===Qt&&(g.bumpScale.value*=-1)),p.normalMap&&(g.normalMap.value=p.normalMap,g.normalScale.value.copy(p.normalScale),p.side===Qt&&g.normalScale.value.negate()),p.displacementMap&&(g.displacementMap.value=p.displacementMap,g.displacementScale.value=p.displacementScale,g.displacementBias.value=p.displacementBias)}return{refreshFogUniforms:t,refreshMaterialUniforms:e}}function Rp(){const n=document.createElementNS("http://www.w3.org/1999/xhtml","canvas");return n.style.display="block",n}function Ut(n){n=n||{};const t=n.canvas!==void 0?n.canvas:Rp(),e=n.context!==void 0?n.context:null,i=n.alpha!==void 0?n.alpha:!1,r=n.depth!==void 0?n.depth:!0,s=n.stencil!==void 0?n.stencil:!0,o=n.antialias!==void 0?n.antialias:!1,a=n.premultipliedAlpha!==void 0?n.premultipliedAlpha:!0,l=n.preserveDrawingBuffer!==void 0?n.preserveDrawingBuffer:!1,c=n.powerPreference!==void 0?n.powerPreference:"default",u=n.failIfMajorPerformanceCaveat!==void 0?n.failIfMajorPerformanceCaveat:!1;let h=null,d=null;const f=[],m=[];this.domElement=t,this.debug={checkShaderErrors:!0},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.gammaFactor=2,this.outputEncoding=yi,this.physicallyCorrectLights=!1,this.toneMapping=ri,this.toneMappingExposure=1;const x=this;let v=!1,g=0,p=0,E=null,S=-1,A=null;const y=new Bt,I=new Bt;let O=null,F=t.width,V=t.height,P=1,q=null,R=null;const L=new Bt(0,0,F,V),N=new Bt(0,0,F,V);let C=!1;const W=new xr;let K=!1,j=!1;const rt=new ot,st=new M,dt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};function _t(){return E===null?P:1}let U=e;function Dt(_,B){for(let D=0;D<_.length;D++){const z=_[D],et=t.getContext(z,B);if(et!==null)return et}return null}try{const _={alpha:i,depth:r,stencil:s,antialias:o,premultipliedAlpha:a,preserveDrawingBuffer:l,powerPreference:c,failIfMajorPerformanceCaveat:u};if(t.addEventListener("webglcontextlost",ft,!1),t.addEventListener("webglcontextrestored",Nt,!1),U===null){const B=["webgl2","webgl","experimental-webgl"];if(x.isWebGL1Renderer===!0&&B.shift(),U=Dt(B,_),U===null)throw Dt(B)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}U.getShaderPrecisionFormat===void 0&&(U.getShaderPrecisionFormat=function(){return{rangeMin:1,rangeMax:1,precision:1}})}catch(_){throw _}let Lt,xt,ut,It,wt,Tt,X,J,tt,lt,nt,w,b,H,G,it,at,Pt,vt,T,Z,Q;function ct(){Lt=new $d(U),xt=new Zd(U,Lt,n),Lt.init(xt),Z=new Ap(U,Lt,xt),ut=new Ep(U,Lt,xt),It=new ef,wt=new fp,Tt=new Tp(U,Lt,ut,wt,xt,Z,It),X=new Qd(x),J=new wh(U,xt),Q=new jd(U,Lt,J,xt),tt=new Kd(U,J,It,Q),lt=new of(U,tt,J,It),Pt=new sf(U),G=new Jd(wt),nt=new dp(x,X,Lt,xt,Q,G),w=new Lp(wt),b=new gp(wt),H=new Mp(Lt,xt),at=new Xd(x,X,ut,lt,a),it=new Ya(x,lt,xt),vt=new Yd(U,Lt,It,xt),T=new tf(U,Lt,It,xt),It.programs=nt.programs,x.capabilities=xt,x.extensions=Lt,x.properties=wt,x.renderLists=b,x.shadowMap=it,x.state=ut,x.info=It}ct();const k=new Ja(x,U);this.xr=k,this.getContext=function(){return U},this.getContextAttributes=function(){return U.getContextAttributes()},this.forceContextLoss=function(){const _=Lt.get("WEBGL_lose_context");_&&_.loseContext()},this.forceContextRestore=function(){const _=Lt.get("WEBGL_lose_context");_&&_.restoreContext()},this.getPixelRatio=function(){return P},this.setPixelRatio=function(_){_!==void 0&&(P=_,this.setSize(F,V,!1))},this.getSize=function(_){return _===void 0&&(_=new Y),_.set(F,V)},this.setSize=function(_,B,D){k.isPresenting||(F=_,V=B,t.width=Math.floor(_*P),t.height=Math.floor(B*P),D!==!1&&(t.style.width=_+"px",t.style.height=B+"px"),this.setViewport(0,0,_,B))},this.getDrawingBufferSize=function(_){return _===void 0&&(_=new Y),_.set(F*P,V*P).floor()},this.setDrawingBufferSize=function(_,B,D){F=_,V=B,P=D,t.width=Math.floor(_*D),t.height=Math.floor(B*D),this.setViewport(0,0,_,B)},this.getCurrentViewport=function(_){return _===void 0&&(_=new Bt),_.copy(y)},this.getViewport=function(_){return _.copy(L)},this.setViewport=function(_,B,D,z){_.isVector4?L.set(_.x,_.y,_.z,_.w):L.set(_,B,D,z),ut.viewport(y.copy(L).multiplyScalar(P).floor())},this.getScissor=function(_){return _.copy(N)},this.setScissor=function(_,B,D,z){_.isVector4?N.set(_.x,_.y,_.z,_.w):N.set(_,B,D,z),ut.scissor(I.copy(N).multiplyScalar(P).floor())},this.getScissorTest=function(){return C},this.setScissorTest=function(_){ut.setScissorTest(C=_)},this.setOpaqueSort=function(_){q=_},this.setTransparentSort=function(_){R=_},this.getClearColor=function(_){return _===void 0&&(_=new ht),_.copy(at.getClearColor())},this.setClearColor=function(){at.setClearColor.apply(at,arguments)},this.getClearAlpha=function(){return at.getClearAlpha()},this.setClearAlpha=function(){at.setClearAlpha.apply(at,arguments)},this.clear=function(_,B,D){let z=0;(_===void 0||_)&&(z|=16384),(B===void 0||B)&&(z|=256),(D===void 0||D)&&(z|=1024),U.clear(z)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",ft,!1),t.removeEventListener("webglcontextrestored",Nt,!1),b.dispose(),H.dispose(),wt.dispose(),X.dispose(),lt.dispose(),Q.dispose(),k.dispose(),k.removeEventListener("sessionstart",Ws),k.removeEventListener("sessionend",qs),tn.stop()};function ft(_){_.preventDefault(),v=!0}function Nt(){v=!1;const _=It.autoReset,B=it.enabled,D=it.autoUpdate,z=it.needsUpdate,et=it.type;ct(),It.autoReset=_,it.enabled=B,it.autoUpdate=D,it.needsUpdate=z,it.type=et}function Xt(_){const B=_.target;B.removeEventListener("dispose",Xt),Ke(B)}function Ke(_){Wt(_),wt.remove(_)}function Wt(_){const B=wt.get(_).programs;B!==void 0&&B.forEach(function(D){nt.releaseProgram(D)})}function Ie(_,B){_.render(function(D){x.renderBufferImmediate(D,B)})}this.renderBufferImmediate=function(_,B){Q.initAttributes();const D=wt.get(_);_.hasPositions&&!D.position&&(D.position=U.createBuffer()),_.hasNormals&&!D.normal&&(D.normal=U.createBuffer()),_.hasUvs&&!D.uv&&(D.uv=U.createBuffer()),_.hasColors&&!D.color&&(D.color=U.createBuffer());const z=B.getAttributes();_.hasPositions&&(U.bindBuffer(34962,D.position),U.bufferData(34962,_.positionArray,35048),Q.enableAttribute(z.position),U.vertexAttribPointer(z.position,3,5126,!1,0,0)),_.hasNormals&&(U.bindBuffer(34962,D.normal),U.bufferData(34962,_.normalArray,35048),Q.enableAttribute(z.normal),U.vertexAttribPointer(z.normal,3,5126,!1,0,0)),_.hasUvs&&(U.bindBuffer(34962,D.uv),U.bufferData(34962,_.uvArray,35048),Q.enableAttribute(z.uv),U.vertexAttribPointer(z.uv,2,5126,!1,0,0)),_.hasColors&&(U.bindBuffer(34962,D.color),U.bufferData(34962,_.colorArray,35048),Q.enableAttribute(z.color),U.vertexAttribPointer(z.color,3,5126,!1,0,0)),Q.disableUnusedAttributes(),U.drawArrays(4,0,_.count),_.count=0},this.renderBufferDirect=function(_,B,D,z,et,At){B===null&&(B=dt);const pt=et.isMesh&&et.matrixWorld.determinant()<0,Mt=Js(_,B,z,et);ut.setMaterial(z,pt);let Ot=D.index;const yt=D.attributes.position;if(Ot===null){if(yt===void 0||yt.count===0)return}else if(Ot.count===0)return;let Rt=1;z.wireframe===!0&&(Ot=tt.getWireframeAttribute(D),Rt=2),(z.morphTargets||z.morphNormals)&&Pt.update(et,D,z,Mt),Q.setup(et,z,Mt,D,Ot);let mt,Ft=vt;Ot!==null&&(mt=J.get(Ot),Ft=T,Ft.setIndex(mt));const Ae=Ot!==null?Ot.count:yt.count,oe=D.drawRange.start*Rt,en=D.drawRange.count*Rt,Yt=At!==null?At.start*Rt:0,nn=At!==null?At.count*Rt:1/0,jt=Math.max(oe,Yt),wr=Math.min(Ae,oe+en,Yt+nn)-1,he=Math.max(0,wr-jt+1);if(he!==0){if(et.isMesh)z.wireframe===!0?(ut.setLineWidth(z.wireframeLinewidth*_t()),Ft.setMode(1)):Ft.setMode(4);else if(et.isLine){let Ne=z.linewidth;Ne===void 0&&(Ne=1),ut.setLineWidth(Ne*_t()),et.isLineSegments?Ft.setMode(1):et.isLineLoop?Ft.setMode(2):Ft.setMode(3)}else et.isPoints?Ft.setMode(0):et.isSprite&&Ft.setMode(4);if(et.isInstancedMesh)Ft.renderInstances(jt,he,et.count);else if(D.isInstancedBufferGeometry){const Ne=Math.min(D.instanceCount,D._maxInstanceCount);Ft.renderInstances(jt,he,Ne)}else Ft.render(jt,he)}},this.compile=function(_,B){d=H.get(_),d.init(),_.traverseVisible(function(D){D.isLight&&D.layers.test(B.layers)&&(d.pushLight(D),D.castShadow&&d.pushShadow(D))}),d.setupLights(),_.traverse(function(D){const z=D.material;if(z)if(Array.isArray(z))for(let et=0;et<z.length;et++){const At=z[et];Mr(At,_,D)}else Mr(z,_,D)})};let be=null;function bl(_){be&&be(_)}function Ws(){tn.stop()}function qs(){tn.start()}const tn=new Ba;tn.setAnimationLoop(bl),typeof window<"u"&&tn.setContext(window),this.setAnimationLoop=function(_){be=_,k.setAnimationLoop(_),_===null?tn.stop():tn.start()},k.addEventListener("sessionstart",Ws),k.addEventListener("sessionend",qs),this.render=function(_,B){let D,z;if(arguments[2]!==void 0&&(D=arguments[2]),arguments[3]!==void 0&&(z=arguments[3]),B!==void 0&&B.isCamera!==!0||v===!0)return;_.autoUpdate===!0&&_.updateMatrixWorld(),B.parent===null&&B.updateMatrixWorld(),k.enabled===!0&&k.isPresenting===!0&&(B=k.getCamera(B)),_.isScene===!0&&_.onBeforeRender(x,_,B,D||E),d=H.get(_,m.length),d.init(),m.push(d),rt.multiplyMatrices(B.projectionMatrix,B.matrixWorldInverse),W.setFromProjectionMatrix(rt),j=this.localClippingEnabled,K=G.init(this.clippingPlanes,j,B),h=b.get(_,f.length),h.init(),f.push(h),Xs(_,B,0,x.sortObjects),h.finish(),x.sortObjects===!0&&h.sort(q,R),K===!0&&G.beginShadows();const et=d.state.shadowsArray;it.render(et,_,B),d.setupLights(),d.setupLightsView(B),K===!0&&G.endShadows(),this.info.autoReset===!0&&this.info.reset(),D!==void 0&&this.setRenderTarget(D),at.render(h,_,B,z);const At=h.opaque,pt=h.transparent;At.length>0&&js(At,_,B),pt.length>0&&js(pt,_,B),E!==null&&(Tt.updateRenderTargetMipmap(E),Tt.updateMultisampleRenderTarget(E)),_.isScene===!0&&_.onAfterRender(x,_,B),ut.buffers.depth.setTest(!0),ut.buffers.depth.setMask(!0),ut.buffers.color.setMask(!0),ut.setPolygonOffset(!1),Q.resetDefaultState(),S=-1,A=null,m.pop(),m.length>0?d=m[m.length-1]:d=null,f.pop(),f.length>0?h=f[f.length-1]:h=null};function Xs(_,B,D,z){if(_.visible===!1)return;if(_.layers.test(B.layers)){if(_.isGroup)D=_.renderOrder;else if(_.isLOD)_.autoUpdate===!0&&_.update(B);else if(_.isLight)d.pushLight(_),_.castShadow&&d.pushShadow(_);else if(_.isSprite){if(!_.frustumCulled||W.intersectsSprite(_)){z&&st.setFromMatrixPosition(_.matrixWorld).applyMatrix4(rt);const pt=lt.update(_),Mt=_.material;Mt.visible&&h.push(_,pt,Mt,D,st.z,null)}}else if(_.isImmediateRenderObject)z&&st.setFromMatrixPosition(_.matrixWorld).applyMatrix4(rt),h.push(_,null,_.material,D,st.z,null);else if((_.isMesh||_.isLine||_.isPoints)&&(_.isSkinnedMesh&&_.skeleton.frame!==It.render.frame&&(_.skeleton.update(),_.skeleton.frame=It.render.frame),!_.frustumCulled||W.intersectsObject(_))){z&&st.setFromMatrixPosition(_.matrixWorld).applyMatrix4(rt);const pt=lt.update(_),Mt=_.material;if(Array.isArray(Mt)){const Ot=pt.groups;for(let yt=0,Rt=Ot.length;yt<Rt;yt++){const mt=Ot[yt],Ft=Mt[mt.materialIndex];Ft&&Ft.visible&&h.push(_,pt,Ft,D,st.z,mt)}}else Mt.visible&&h.push(_,pt,Mt,D,st.z,null)}}const At=_.children;for(let pt=0,Mt=At.length;pt<Mt;pt++)Xs(At[pt],B,D,z)}function js(_,B,D){const z=B.isScene===!0?B.overrideMaterial:null;for(let et=0,At=_.length;et<At;et++){const pt=_[et],Mt=pt.object,Ot=pt.geometry,yt=z===null?pt.material:z,Rt=pt.group;if(D.isArrayCamera){const mt=D.cameras;for(let Ft=0,Ae=mt.length;Ft<Ae;Ft++){const oe=mt[Ft];Mt.layers.test(oe.layers)&&(ut.viewport(y.copy(oe.viewport)),d.setupLightsView(oe),Ys(Mt,B,oe,Ot,yt,Rt))}}else Ys(Mt,B,D,Ot,yt,Rt)}}function Ys(_,B,D,z,et,At){if(_.onBeforeRender(x,B,D,z,et,At),_.modelViewMatrix.multiplyMatrices(D.matrixWorldInverse,_.matrixWorld),_.normalMatrix.getNormalMatrix(_.modelViewMatrix),_.isImmediateRenderObject){const pt=Js(D,B,et,_);ut.setMaterial(et),Q.reset(),Ie(_,pt)}else x.renderBufferDirect(D,B,z,et,_,At);_.onAfterRender(x,B,D,z,et,At)}function Mr(_,B,D){B.isScene!==!0&&(B=dt);const z=wt.get(_),et=d.state.lights,At=d.state.shadowsArray,pt=et.state.version,Mt=nt.getParameters(_,et.state,At,B,D),Ot=nt.getProgramCacheKey(Mt);let yt=z.programs;z.environment=_.isMeshStandardMaterial?B.environment:null,z.fog=B.fog,z.envMap=X.get(_.envMap||z.environment),yt===void 0&&(_.addEventListener("dispose",Xt),yt=new Map,z.programs=yt);let Rt=yt.get(Ot);if(Rt!==void 0){if(z.currentProgram===Rt&&z.lightsStateVersion===pt)return Zs(_,Mt),Rt}else Mt.uniforms=nt.getUniforms(_),_.onBeforeCompile(Mt,x),Rt=nt.acquireProgram(Mt,Ot),yt.set(Ot,Rt),z.uniforms=Mt.uniforms;const mt=z.uniforms;(!_.isShaderMaterial&&!_.isRawShaderMaterial||_.clipping===!0)&&(mt.clippingPlanes=G.uniform),Zs(_,Mt),z.needsLights=wl(_),z.lightsStateVersion=pt,z.needsLights&&(mt.ambientLightColor.value=et.state.ambient,mt.lightProbe.value=et.state.probe,mt.directionalLights.value=et.state.directional,mt.directionalLightShadows.value=et.state.directionalShadow,mt.spotLights.value=et.state.spot,mt.spotLightShadows.value=et.state.spotShadow,mt.rectAreaLights.value=et.state.rectArea,mt.ltc_1.value=et.state.rectAreaLTC1,mt.ltc_2.value=et.state.rectAreaLTC2,mt.pointLights.value=et.state.point,mt.pointLightShadows.value=et.state.pointShadow,mt.hemisphereLights.value=et.state.hemi,mt.directionalShadowMap.value=et.state.directionalShadowMap,mt.directionalShadowMatrix.value=et.state.directionalShadowMatrix,mt.spotShadowMap.value=et.state.spotShadowMap,mt.spotShadowMatrix.value=et.state.spotShadowMatrix,mt.pointShadowMap.value=et.state.pointShadowMap,mt.pointShadowMatrix.value=et.state.pointShadowMatrix);const Ft=Rt.getUniforms(),Ae=Ze.seqWithValue(Ft.seq,mt);return z.currentProgram=Rt,z.uniformsList=Ae,Rt}function Zs(_,B){const D=wt.get(_);D.outputEncoding=B.outputEncoding,D.instancing=B.instancing,D.numClippingPlanes=B.numClippingPlanes,D.numIntersection=B.numClipIntersection,D.vertexAlphas=B.vertexAlphas}function Js(_,B,D,z){B.isScene!==!0&&(B=dt),Tt.resetTextureUnits();const et=B.fog,At=D.isMeshStandardMaterial?B.environment:null,pt=E===null?x.outputEncoding:E.texture.encoding,Mt=X.get(D.envMap||At),Ot=D.vertexColors===!0&&z.geometry.attributes.color&&z.geometry.attributes.color.itemSize===4,yt=wt.get(D),Rt=d.state.lights;if(K===!0&&(j===!0||_!==A)){const jt=_===A&&D.id===S;G.setState(D,_,jt)}let mt=!1;D.version===yt.__version?(yt.needsLights&&yt.lightsStateVersion!==Rt.state.version||yt.outputEncoding!==pt||z.isInstancedMesh&&yt.instancing===!1||!z.isInstancedMesh&&yt.instancing===!0||yt.envMap!==Mt||D.fog&&yt.fog!==et||yt.numClippingPlanes!==void 0&&(yt.numClippingPlanes!==G.numPlanes||yt.numIntersection!==G.numIntersection)||yt.vertexAlphas!==Ot)&&(mt=!0):(mt=!0,yt.__version=D.version);let Ft=yt.currentProgram;mt===!0&&(Ft=Mr(D,B,z));let Ae=!1,oe=!1,en=!1;const Yt=Ft.getUniforms(),nn=yt.uniforms;if(ut.useProgram(Ft.program)&&(Ae=!0,oe=!0,en=!0),D.id!==S&&(S=D.id,oe=!0),Ae||A!==_){if(Yt.setValue(U,"projectionMatrix",_.projectionMatrix),xt.logarithmicDepthBuffer&&Yt.setValue(U,"logDepthBufFC",2/(Math.log(_.far+1)/Math.LN2)),A!==_&&(A=_,oe=!0,en=!0),D.isShaderMaterial||D.isMeshPhongMaterial||D.isMeshToonMaterial||D.isMeshStandardMaterial||D.envMap){const jt=Yt.map.cameraPosition;jt!==void 0&&jt.setValue(U,st.setFromMatrixPosition(_.matrixWorld))}(D.isMeshPhongMaterial||D.isMeshToonMaterial||D.isMeshLambertMaterial||D.isMeshBasicMaterial||D.isMeshStandardMaterial||D.isShaderMaterial)&&Yt.setValue(U,"isOrthographic",_.isOrthographicCamera===!0),(D.isMeshPhongMaterial||D.isMeshToonMaterial||D.isMeshLambertMaterial||D.isMeshBasicMaterial||D.isMeshStandardMaterial||D.isShaderMaterial||D.isShadowMaterial||D.skinning)&&Yt.setValue(U,"viewMatrix",_.matrixWorldInverse)}if(D.skinning){Yt.setOptional(U,z,"bindMatrix"),Yt.setOptional(U,z,"bindMatrixInverse");const jt=z.skeleton;if(jt){const wr=jt.bones;if(xt.floatVertexTextures){if(jt.boneTexture===null){let he=Math.sqrt(wr.length*4);he=bt.ceilPowerOfTwo(he),he=Math.max(he,4);const Ne=new Float32Array(he*he*4);Ne.set(jt.boneMatrices);const Sl=new Ns(Ne,he,he,Te,Ye);jt.boneMatrices=Ne,jt.boneTexture=Sl,jt.boneTextureSize=he}Yt.setValue(U,"boneTexture",jt.boneTexture,Tt),Yt.setValue(U,"boneTextureSize",jt.boneTextureSize)}else Yt.setOptional(U,jt,"boneMatrices")}}return(oe||yt.receiveShadow!==z.receiveShadow)&&(yt.receiveShadow=z.receiveShadow,Yt.setValue(U,"receiveShadow",z.receiveShadow)),oe&&(Yt.setValue(U,"toneMappingExposure",x.toneMappingExposure),yt.needsLights&&Ml(nn,en),et&&D.fog&&w.refreshFogUniforms(nn,et),w.refreshMaterialUniforms(nn,D,P,V),Ze.upload(U,yt.uniformsList,nn,Tt)),D.isShaderMaterial&&D.uniformsNeedUpdate===!0&&(Ze.upload(U,yt.uniformsList,nn,Tt),D.uniformsNeedUpdate=!1),D.isSpriteMaterial&&Yt.setValue(U,"center",z.center),Yt.setValue(U,"modelViewMatrix",z.modelViewMatrix),Yt.setValue(U,"normalMatrix",z.normalMatrix),Yt.setValue(U,"modelMatrix",z.matrixWorld),Ft}function Ml(_,B){_.ambientLightColor.needsUpdate=B,_.lightProbe.needsUpdate=B,_.directionalLights.needsUpdate=B,_.directionalLightShadows.needsUpdate=B,_.pointLights.needsUpdate=B,_.pointLightShadows.needsUpdate=B,_.spotLights.needsUpdate=B,_.spotLightShadows.needsUpdate=B,_.rectAreaLights.needsUpdate=B,_.hemisphereLights.needsUpdate=B}function wl(_){return _.isMeshLambertMaterial||_.isMeshToonMaterial||_.isMeshPhongMaterial||_.isMeshStandardMaterial||_.isShadowMaterial||_.isShaderMaterial&&_.lights===!0}this.getActiveCubeFace=function(){return g},this.getActiveMipmapLevel=function(){return p},this.getRenderTarget=function(){return E},this.setRenderTarget=function(_,B=0,D=0){E=_,g=B,p=D,_&&wt.get(_).__webglFramebuffer===void 0&&Tt.setupRenderTarget(_);let z=null,et=!1,At=!1;if(_){const pt=_.texture;(pt.isDataTexture3D||pt.isDataTexture2DArray)&&(At=!0);const Mt=wt.get(_).__webglFramebuffer;_.isWebGLCubeRenderTarget?(z=Mt[B],et=!0):_.isWebGLMultisampleRenderTarget?z=wt.get(_).__webglMultisampledFramebuffer:z=Mt,y.copy(_.viewport),I.copy(_.scissor),O=_.scissorTest}else y.copy(L).multiplyScalar(P).floor(),I.copy(N).multiplyScalar(P).floor(),O=C;if(ut.bindFramebuffer(36160,z),ut.viewport(y),ut.scissor(I),ut.setScissorTest(O),et){const pt=wt.get(_.texture);U.framebufferTexture2D(36160,36064,34069+B,pt.__webglTexture,D)}else if(At){const pt=wt.get(_.texture),Mt=B||0;U.framebufferTextureLayer(36160,36064,pt.__webglTexture,D||0,Mt)}},this.readRenderTargetPixels=function(_,B,D,z,et,At,pt){if(!(_&&_.isWebGLRenderTarget))return;let Mt=wt.get(_).__webglFramebuffer;if(_.isWebGLCubeRenderTarget&&pt!==void 0&&(Mt=Mt[pt]),Mt){ut.bindFramebuffer(36160,Mt);try{const Ot=_.texture,yt=Ot.format,Rt=Ot.type;if(yt!==Te&&Z.convert(yt)!==U.getParameter(35739))return;const mt=Rt===er&&(Lt.has("EXT_color_buffer_half_float")||xt.isWebGL2&&Lt.has("EXT_color_buffer_float"));if(Rt!==Cs&&Z.convert(Rt)!==U.getParameter(35738)&&!(Rt===Ye&&(xt.isWebGL2||Lt.has("OES_texture_float")||Lt.has("WEBGL_color_buffer_float")))&&!mt)return;U.checkFramebufferStatus(36160)===36053&&B>=0&&B<=_.width-z&&D>=0&&D<=_.height-et&&U.readPixels(B,D,z,et,Z.convert(yt),Z.convert(Rt),At)}finally{const Ot=E!==null?wt.get(E).__webglFramebuffer:null;ut.bindFramebuffer(36160,Ot)}}},this.copyFramebufferToTexture=function(_,B,D=0){const z=Math.pow(2,-D),et=Math.floor(B.image.width*z),At=Math.floor(B.image.height*z),pt=Z.convert(B.format);Tt.setTexture2D(B,0),U.copyTexImage2D(3553,D,pt,_.x,_.y,et,At,0),ut.unbindTexture()},this.copyTextureToTexture=function(_,B,D,z=0){const et=B.image.width,At=B.image.height,pt=Z.convert(D.format),Mt=Z.convert(D.type);Tt.setTexture2D(D,0),U.pixelStorei(37440,D.flipY),U.pixelStorei(37441,D.premultiplyAlpha),U.pixelStorei(3317,D.unpackAlignment),B.isDataTexture?U.texSubImage2D(3553,z,_.x,_.y,et,At,pt,Mt,B.image.data):B.isCompressedTexture?U.compressedTexSubImage2D(3553,z,_.x,_.y,B.mipmaps[0].width,B.mipmaps[0].height,pt,B.mipmaps[0].data):U.texSubImage2D(3553,z,_.x,_.y,pt,Mt,B.image),z===0&&D.generateMipmaps&&U.generateMipmap(3553),ut.unbindTexture()},this.copyTextureToTexture3D=function(_,B,D,z,et=0){if(x.isWebGL1Renderer)return;const{width:At,height:pt,data:Mt}=D.image,Ot=Z.convert(z.format),yt=Z.convert(z.type);let Rt;if(z.isDataTexture3D)Tt.setTexture3D(z,0),Rt=32879;else if(z.isDataTexture2DArray)Tt.setTexture2DArray(z,0),Rt=35866;else return;U.pixelStorei(37440,z.flipY),U.pixelStorei(37441,z.premultiplyAlpha),U.pixelStorei(3317,z.unpackAlignment);const mt=U.getParameter(3314),Ft=U.getParameter(32878),Ae=U.getParameter(3316),oe=U.getParameter(3315),en=U.getParameter(32877);U.pixelStorei(3314,At),U.pixelStorei(32878,pt),U.pixelStorei(3316,_.min.x),U.pixelStorei(3315,_.min.y),U.pixelStorei(32877,_.min.z),U.texSubImage3D(Rt,et,B.x,B.y,B.z,_.max.x-_.min.x+1,_.max.y-_.min.y+1,_.max.z-_.min.z+1,Ot,yt,Mt),U.pixelStorei(3314,mt),U.pixelStorei(32878,Ft),U.pixelStorei(3316,Ae),U.pixelStorei(3315,oe),U.pixelStorei(32877,en),et===0&&z.generateMipmaps&&U.generateMipmap(Rt),ut.unbindTexture()},this.initTexture=function(_){Tt.setTexture2D(_,0),ut.unbindTexture()},this.resetState=function(){g=0,p=0,E=null,ut.reset(),Q.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}class Cp extends Ut{}Cp.prototype.isWebGL1Renderer=!0;class Qa extends gt{constructor(){super(),this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.overrideMaterial=null,this.autoUpdate=!0,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.autoUpdate=t.autoUpdate,this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const e=super.toJSON(t);return this.background!==null&&(e.object.background=this.background.toJSON(t)),this.environment!==null&&(e.object.environment=this.environment.toJSON(t)),this.fog!==null&&(e.object.fog=this.fog.toJSON()),e}}Qa.prototype.isScene=!0;function ge(n,t){this.array=n,this.stride=t,this.count=n!==void 0?n.length/t:0,this.usage=_i,this.updateRange={offset:0,count:-1},this.version=0,this.uuid=bt.generateUUID()}Object.defineProperty(ge.prototype,"needsUpdate",{set:function(n){n===!0&&this.version++}});Object.assign(ge.prototype,{isInterleavedBuffer:!0,onUploadCallback:function(){},setUsage:function(n){return this.usage=n,this},copy:function(n){return this.array=new n.array.constructor(n.array),this.count=n.count,this.stride=n.stride,this.usage=n.usage,this},copyAt:function(n,t,e){n*=this.stride,e*=t.stride;for(let i=0,r=this.stride;i<r;i++)this.array[n+i]=t.array[e+i];return this},set:function(n,t=0){return this.array.set(n,t),this},clone:function(n){n.arrayBuffers===void 0&&(n.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=bt.generateUUID()),n.arrayBuffers[this.array.buffer._uuid]===void 0&&(n.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const t=new this.array.constructor(n.arrayBuffers[this.array.buffer._uuid]),e=new ge(t,this.stride);return e.setUsage(this.usage),e},onUpload:function(n){return this.onUploadCallback=n,this},toJSON:function(n){return n.arrayBuffers===void 0&&(n.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=bt.generateUUID()),n.arrayBuffers[this.array.buffer._uuid]===void 0&&(n.arrayBuffers[this.array.buffer._uuid]=Array.prototype.slice.call(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}});const qt=new M;function fi(n,t,e,i){this.name="",this.data=n,this.itemSize=t,this.offset=e,this.normalized=i===!0}Object.defineProperties(fi.prototype,{count:{get:function(){return this.data.count}},array:{get:function(){return this.data.array}},needsUpdate:{set:function(n){this.data.needsUpdate=n}}});Object.assign(fi.prototype,{isInterleavedBufferAttribute:!0,applyMatrix4:function(n){for(let t=0,e=this.data.count;t<e;t++)qt.x=this.getX(t),qt.y=this.getY(t),qt.z=this.getZ(t),qt.applyMatrix4(n),this.setXYZ(t,qt.x,qt.y,qt.z);return this},applyNormalMatrix:function(n){for(let t=0,e=this.count;t<e;t++)qt.x=this.getX(t),qt.y=this.getY(t),qt.z=this.getZ(t),qt.applyNormalMatrix(n),this.setXYZ(t,qt.x,qt.y,qt.z);return this},transformDirection:function(n){for(let t=0,e=this.count;t<e;t++)qt.x=this.getX(t),qt.y=this.getY(t),qt.z=this.getZ(t),qt.transformDirection(n),this.setXYZ(t,qt.x,qt.y,qt.z);return this},setX:function(n,t){return this.data.array[n*this.data.stride+this.offset]=t,this},setY:function(n,t){return this.data.array[n*this.data.stride+this.offset+1]=t,this},setZ:function(n,t){return this.data.array[n*this.data.stride+this.offset+2]=t,this},setW:function(n,t){return this.data.array[n*this.data.stride+this.offset+3]=t,this},getX:function(n){return this.data.array[n*this.data.stride+this.offset]},getY:function(n){return this.data.array[n*this.data.stride+this.offset+1]},getZ:function(n){return this.data.array[n*this.data.stride+this.offset+2]},getW:function(n){return this.data.array[n*this.data.stride+this.offset+3]},setXY:function(n,t,e){return n=n*this.data.stride+this.offset,this.data.array[n+0]=t,this.data.array[n+1]=e,this},setXYZ:function(n,t,e,i){return n=n*this.data.stride+this.offset,this.data.array[n+0]=t,this.data.array[n+1]=e,this.data.array[n+2]=i,this},setXYZW:function(n,t,e,i,r){return n=n*this.data.stride+this.offset,this.data.array[n+0]=t,this.data.array[n+1]=e,this.data.array[n+2]=i,this.data.array[n+3]=r,this},clone:function(n){if(n===void 0){const t=[];for(let e=0;e<this.count;e++){const i=e*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[i+r])}return new St(new this.array.constructor(t),this.itemSize,this.normalized)}else return n.interleavedBuffers===void 0&&(n.interleavedBuffers={}),n.interleavedBuffers[this.data.uuid]===void 0&&(n.interleavedBuffers[this.data.uuid]=this.data.clone(n)),new fi(n.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)},toJSON:function(n){if(n===void 0){const t=[];for(let e=0;e<this.count;e++){const i=e*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[i+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return n.interleavedBuffers===void 0&&(n.interleavedBuffers={}),n.interleavedBuffers[this.data.uuid]===void 0&&(n.interleavedBuffers[this.data.uuid]=this.data.toJSON(n)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}});class $a extends Vt{constructor(t){super(),this.type="SpriteMaterial",this.color=new ht(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.rotation=t.rotation,this.sizeAttenuation=t.sizeAttenuation,this}}$a.prototype.isSpriteMaterial=!0;let wn;const Yn=new M,Sn=new M,En=new M,Tn=new Y,Zn=new Y,Ka=new ot,Gi=new M,Jn=new M,ki=new M,Wo=new Y,Jr=new Y,qo=new Y;class Pp extends gt{constructor(t){if(super(),this.type="Sprite",wn===void 0){wn=new Ct;const e=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),i=new ge(e,5);wn.setIndex([0,1,2,0,2,3]),wn.setAttribute("position",new fi(i,3,0,!1)),wn.setAttribute("uv",new fi(i,2,3,!1))}this.geometry=wn,this.material=t!==void 0?t:new $a,this.center=new Y(.5,.5)}raycast(t,e){t.camera,Sn.setFromMatrixScale(this.matrixWorld),Ka.copy(t.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(t.camera.matrixWorldInverse,this.matrixWorld),En.setFromMatrixPosition(this.modelViewMatrix),t.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&Sn.multiplyScalar(-En.z);const i=this.material.rotation;let r,s;i!==0&&(s=Math.cos(i),r=Math.sin(i));const o=this.center;Vi(Gi.set(-.5,-.5,0),En,o,Sn,r,s),Vi(Jn.set(.5,-.5,0),En,o,Sn,r,s),Vi(ki.set(.5,.5,0),En,o,Sn,r,s),Wo.set(0,0),Jr.set(1,0),qo.set(1,1);let a=t.ray.intersectTriangle(Gi,Jn,ki,!1,Yn);if(a===null&&(Vi(Jn.set(-.5,.5,0),En,o,Sn,r,s),Jr.set(0,1),a=t.ray.intersectTriangle(Gi,ki,Jn,!1,Yn),a===null))return;const l=t.ray.origin.distanceTo(Yn);l<t.near||l>t.far||e.push({distance:l,point:Yn.clone(),uv:Zt.getUV(Yn,Gi,Jn,ki,Wo,Jr,qo,new Y),face:null,object:this})}copy(t){return super.copy(t),t.center!==void 0&&this.center.copy(t.center),this.material=t.material,this}}Pp.prototype.isSprite=!0;function Vi(n,t,e,i,r,s){Tn.subVectors(n,e).addScalar(.5).multiply(i),r!==void 0?(Zn.x=s*Tn.x-r*Tn.y,Zn.y=r*Tn.x+s*Tn.y):Zn.copy(Tn),n.copy(t),n.x+=Zn.x,n.y+=Zn.y,n.applyMatrix4(Ka)}const Xo=new M,jo=new Bt,Yo=new Bt,Dp=new M,Zo=new ot;function fs(n,t){$t.call(this,n,t),this.type="SkinnedMesh",this.bindMode="attached",this.bindMatrix=new ot,this.bindMatrixInverse=new ot}fs.prototype=Object.assign(Object.create($t.prototype),{constructor:fs,isSkinnedMesh:!0,copy:function(n){return $t.prototype.copy.call(this,n),this.bindMode=n.bindMode,this.bindMatrix.copy(n.bindMatrix),this.bindMatrixInverse.copy(n.bindMatrixInverse),this.skeleton=n.skeleton,this},bind:function(n,t){this.skeleton=n,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()},pose:function(){this.skeleton.pose()},normalizeSkinWeights:function(){const n=new Bt,t=this.geometry.attributes.skinWeight;for(let e=0,i=t.count;e<i;e++){n.x=t.getX(e),n.y=t.getY(e),n.z=t.getZ(e),n.w=t.getW(e);const r=1/n.manhattanLength();r!==1/0?n.multiplyScalar(r):n.set(1,0,0,0),t.setXYZW(e,n.x,n.y,n.z,n.w)}},updateMatrixWorld:function(n){$t.prototype.updateMatrixWorld.call(this,n),this.bindMode==="attached"?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode==="detached"&&this.bindMatrixInverse.copy(this.bindMatrix).invert()},boneTransform:function(n,t){const e=this.skeleton,i=this.geometry;jo.fromBufferAttribute(i.attributes.skinIndex,n),Yo.fromBufferAttribute(i.attributes.skinWeight,n),Xo.fromBufferAttribute(i.attributes.position,n).applyMatrix4(this.bindMatrix),t.set(0,0,0);for(let r=0;r<4;r++){const s=Yo.getComponent(r);if(s!==0){const o=jo.getComponent(r);Zo.multiplyMatrices(e.bones[o].matrixWorld,e.boneInverses[o]),t.addScaledVector(Dp.copy(Xo).applyMatrix4(Zo),s)}}return t.applyMatrix4(this.bindMatrixInverse)}});function ps(){gt.call(this),this.type="Bone"}ps.prototype=Object.assign(Object.create(gt.prototype),{constructor:ps,isBone:!0});const Jo=new ot,Ip=new ot;class tl{constructor(t=[],e=[]){this.uuid=bt.generateUUID(),this.bones=t.slice(0),this.boneInverses=e,this.boneMatrices=null,this.boneTexture=null,this.boneTextureSize=0,this.frame=-1,this.init()}init(){const t=this.bones,e=this.boneInverses;if(this.boneMatrices=new Float32Array(t.length*16),e.length===0)this.calculateInverses();else if(t.length!==e.length){this.boneInverses=[];for(let i=0,r=this.bones.length;i<r;i++)this.boneInverses.push(new ot)}}calculateInverses(){this.boneInverses.length=0;for(let t=0,e=this.bones.length;t<e;t++){const i=new ot;this.bones[t]&&i.copy(this.bones[t].matrixWorld).invert(),this.boneInverses.push(i)}}pose(){for(let t=0,e=this.bones.length;t<e;t++){const i=this.bones[t];i&&i.matrixWorld.copy(this.boneInverses[t]).invert()}for(let t=0,e=this.bones.length;t<e;t++){const i=this.bones[t];i&&(i.parent&&i.parent.isBone?(i.matrix.copy(i.parent.matrixWorld).invert(),i.matrix.multiply(i.matrixWorld)):i.matrix.copy(i.matrixWorld),i.matrix.decompose(i.position,i.quaternion,i.scale))}}update(){const t=this.bones,e=this.boneInverses,i=this.boneMatrices,r=this.boneTexture;for(let s=0,o=t.length;s<o;s++){const a=t[s]?t[s].matrixWorld:Ip;Jo.multiplyMatrices(a,e[s]),Jo.toArray(i,s*16)}r!==null&&(r.needsUpdate=!0)}clone(){return new tl(this.bones,this.boneInverses)}getBoneByName(t){for(let e=0,i=this.bones.length;e<i;e++){const r=this.bones[e];if(r.name===t)return r}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(t,e){this.uuid=t.uuid;for(let i=0,r=t.bones.length;i<r;i++){const s=t.bones[i];let o=e[s];o===void 0&&(o=new ps),this.bones.push(o),this.boneInverses.push(new ot().fromArray(t.boneInverses[i]))}return this.init(),this}toJSON(){const t={metadata:{version:4.5,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};t.uuid=this.uuid;const e=this.bones,i=this.boneInverses;for(let r=0,s=e.length;r<s;r++){const o=e[r];t.bones.push(o.uuid);const a=i[r];t.boneInverses.push(a.toArray())}return t}}const Qo=new ot,$o=new ot,Wi=[],Qn=new $t;function Ko(n,t,e){$t.call(this,n,t),this.instanceMatrix=new St(new Float32Array(e*16),16),this.instanceColor=null,this.count=e,this.frustumCulled=!1}Ko.prototype=Object.assign(Object.create($t.prototype),{constructor:Ko,isInstancedMesh:!0,copy:function(n){return $t.prototype.copy.call(this,n),this.instanceMatrix.copy(n.instanceMatrix),n.instanceColor!==null&&(this.instanceColor=n.instanceColor.clone()),this.count=n.count,this},getColorAt:function(n,t){t.fromArray(this.instanceColor.array,n*3)},getMatrixAt:function(n,t){t.fromArray(this.instanceMatrix.array,n*16)},raycast:function(n,t){const e=this.matrixWorld,i=this.count;if(Qn.geometry=this.geometry,Qn.material=this.material,Qn.material!==void 0)for(let r=0;r<i;r++){this.getMatrixAt(r,Qo),$o.multiplyMatrices(e,Qo),Qn.matrixWorld=$o,Qn.raycast(n,Wi);for(let s=0,o=Wi.length;s<o;s++){const a=Wi[s];a.instanceId=r,a.object=this,t.push(a)}Wi.length=0}},setColorAt:function(n,t){this.instanceColor===null&&(this.instanceColor=new St(new Float32Array(this.count*3),3)),t.toArray(this.instanceColor.array,n*3)},setMatrixAt:function(n,t){t.toArray(this.instanceMatrix.array,n*16)},updateMorphTargets:function(){},dispose:function(){this.dispatchEvent({type:"dispose"})}});class bi extends Vt{constructor(t){super(),this.type="LineBasicMaterial",this.color=new ht(16777215),this.linewidth=1,this.linecap="round",this.linejoin="round",this.morphTargets=!1,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.morphTargets=t.morphTargets,this}}bi.prototype.isLineBasicMaterial=!0;const ta=new M,ea=new M,na=new ot,Qr=new cn,qi=new zn;function pi(n=new Ct,t=new bi){gt.call(this),this.type="Line",this.geometry=n,this.material=t,this.updateMorphTargets()}pi.prototype=Object.assign(Object.create(gt.prototype),{constructor:pi,isLine:!0,copy:function(n){return gt.prototype.copy.call(this,n),this.material=n.material,this.geometry=n.geometry,this},computeLineDistances:function(){const n=this.geometry;if(n.isBufferGeometry){if(n.index===null){const t=n.attributes.position,e=[0];for(let i=1,r=t.count;i<r;i++)ta.fromBufferAttribute(t,i-1),ea.fromBufferAttribute(t,i),e[i]=e[i-1],e[i]+=ta.distanceTo(ea);n.setAttribute("lineDistance",new zt(e,1))}}else n.isGeometry;return this},raycast:function(n,t){const e=this.geometry,i=this.matrixWorld,r=n.params.Line.threshold,s=e.drawRange;if(e.boundingSphere===null&&e.computeBoundingSphere(),qi.copy(e.boundingSphere),qi.applyMatrix4(i),qi.radius+=r,n.ray.intersectsSphere(qi)===!1)return;na.copy(i).invert(),Qr.copy(n.ray).applyMatrix4(na);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),a=o*o,l=new M,c=new M,u=new M,h=new M,d=this.isLineSegments?2:1;if(e.isBufferGeometry){const f=e.index,x=e.attributes.position;if(f!==null){const v=Math.max(0,s.start),g=Math.min(f.count,s.start+s.count);for(let p=v,E=g-1;p<E;p+=d){const S=f.getX(p),A=f.getX(p+1);if(l.fromBufferAttribute(x,S),c.fromBufferAttribute(x,A),Qr.distanceSqToSegment(l,c,h,u)>a)continue;h.applyMatrix4(this.matrixWorld);const I=n.ray.origin.distanceTo(h);I<n.near||I>n.far||t.push({distance:I,point:u.clone().applyMatrix4(this.matrixWorld),index:p,face:null,faceIndex:null,object:this})}}else{const v=Math.max(0,s.start),g=Math.min(x.count,s.start+s.count);for(let p=v,E=g-1;p<E;p+=d){if(l.fromBufferAttribute(x,p),c.fromBufferAttribute(x,p+1),Qr.distanceSqToSegment(l,c,h,u)>a)continue;h.applyMatrix4(this.matrixWorld);const A=n.ray.origin.distanceTo(h);A<n.near||A>n.far||t.push({distance:A,point:u.clone().applyMatrix4(this.matrixWorld),index:p,face:null,faceIndex:null,object:this})}}}else e.isGeometry},updateMorphTargets:function(){const n=this.geometry;if(n.isBufferGeometry){const t=n.morphAttributes,e=Object.keys(t);if(e.length>0){const i=t[e[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,s=i.length;r<s;r++){const o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}else{const t=n.morphTargets;t!==void 0&&t.length>0}}});const ia=new M,ra=new M;function or(n,t){pi.call(this,n,t),this.type="LineSegments"}or.prototype=Object.assign(Object.create(pi.prototype),{constructor:or,isLineSegments:!0,computeLineDistances:function(){const n=this.geometry;if(n.isBufferGeometry){if(n.index===null){const t=n.attributes.position,e=[];for(let i=0,r=t.count;i<r;i+=2)ia.fromBufferAttribute(t,i),ra.fromBufferAttribute(t,i+1),e[i]=i===0?0:e[i-1],e[i+1]=e[i]+ia.distanceTo(ra);n.setAttribute("lineDistance",new zt(e,1))}}else n.isGeometry;return this}});class Np extends pi{constructor(t,e){super(t,e),this.type="LineLoop"}}Np.prototype.isLineLoop=!0;class el extends Vt{constructor(t){super(),this.type="PointsMaterial",this.color=new ht(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.morphTargets=!1,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.size=t.size,this.sizeAttenuation=t.sizeAttenuation,this.morphTargets=t.morphTargets,this}}el.prototype.isPointsMaterial=!0;const sa=new ot,ms=new cn,Xi=new zn,ji=new M;function oa(n=new Ct,t=new el){gt.call(this),this.type="Points",this.geometry=n,this.material=t,this.updateMorphTargets()}oa.prototype=Object.assign(Object.create(gt.prototype),{constructor:oa,isPoints:!0,copy:function(n){return gt.prototype.copy.call(this,n),this.material=n.material,this.geometry=n.geometry,this},raycast:function(n,t){const e=this.geometry,i=this.matrixWorld,r=n.params.Points.threshold,s=e.drawRange;if(e.boundingSphere===null&&e.computeBoundingSphere(),Xi.copy(e.boundingSphere),Xi.applyMatrix4(i),Xi.radius+=r,n.ray.intersectsSphere(Xi)===!1)return;sa.copy(i).invert(),ms.copy(n.ray).applyMatrix4(sa);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),a=o*o;if(e.isBufferGeometry){const l=e.index,u=e.attributes.position;if(l!==null){const h=Math.max(0,s.start),d=Math.min(l.count,s.start+s.count);for(let f=h,m=d;f<m;f++){const x=l.getX(f);ji.fromBufferAttribute(u,x),aa(ji,x,a,i,n,t,this)}}else{const h=Math.max(0,s.start),d=Math.min(u.count,s.start+s.count);for(let f=h,m=d;f<m;f++)ji.fromBufferAttribute(u,f),aa(ji,f,a,i,n,t,this)}}},updateMorphTargets:function(){const n=this.geometry;if(n.isBufferGeometry){const t=n.morphAttributes,e=Object.keys(t);if(e.length>0){const i=t[e[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,s=i.length;r<s;r++){const o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}else{const t=n.morphTargets;t!==void 0&&t.length>0}}});function aa(n,t,e,i,r,s,o){const a=ms.distanceSqToPoint(n);if(a<e){const l=new M;ms.closestPointToPoint(n,l),l.applyMatrix4(i);const c=r.ray.origin.distanceTo(l);if(c<r.near||c>r.far)return;s.push({distance:c,distanceToRay:Math.sqrt(a),point:l,index:t,face:null,object:o})}}class Fp extends ne{constructor(t,e,i,r,s,o,a,l,c){super(t,e,i,r,s,o,a,l,c),this.format=a!==void 0?a:on,this.minFilter=o!==void 0?o:te,this.magFilter=s!==void 0?s:te,this.generateMipmaps=!1;const u=this;function h(){u.needsUpdate=!0,t.requestVideoFrameCallback(h)}"requestVideoFrameCallback"in t&&t.requestVideoFrameCallback(h)}clone(){return new this.constructor(this.image).copy(this)}update(){const t=this.image;"requestVideoFrameCallback"in t===!1&&t.readyState>=t.HAVE_CURRENT_DATA&&(this.needsUpdate=!0)}}Fp.prototype.isVideoTexture=!0;class nl extends ne{constructor(t,e,i,r,s,o,a,l,c,u,h,d){super(null,o,a,l,c,u,r,s,h,d),this.image={width:e,height:i},this.mipmaps=t,this.flipY=!1,this.generateMipmaps=!1}}nl.prototype.isCompressedTexture=!0;class Bp extends ne{constructor(t,e,i,r,s,o,a,l,c){super(t,e,i,r,s,o,a,l,c),this.needsUpdate=!0}}Bp.prototype.isCanvasTexture=!0;class Op extends ne{constructor(t,e,i,r,s,o,a,l,c,u){if(u=u!==void 0?u:Pn,u!==Pn&&u!==ci)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");i===void 0&&u===Pn&&(i=tr),i===void 0&&u===ci&&(i=si),super(null,r,s,o,a,l,u,i,c),this.image={width:t,height:e},this.magFilter=a!==void 0?a:ae,this.minFilter=l!==void 0?l:ae,this.flipY=!1,this.generateMipmaps=!1}}Op.prototype.isDepthTexture=!0;const zp={triangulate:function(n,t,e){e=e||2;const i=t&&t.length,r=i?t[0]*e:n.length;let s=il(n,0,r,e,!0);const o=[];if(!s||s.next===s.prev)return o;let a,l,c,u,h,d,f;if(i&&(s=Vp(n,t,s,e)),n.length>80*e){a=c=n[0],l=u=n[1];for(let m=e;m<r;m+=e)h=n[m],d=n[m+1],h<a&&(a=h),d<l&&(l=d),h>c&&(c=h),d>u&&(u=d);f=Math.max(c-a,u-l),f=f!==0?1/f:0}return mi(s,o,e,a,l,f),o}};function il(n,t,e,i,r){let s,o;if(r===tm(n,t,e,i)>0)for(s=t;s<e;s+=i)o=la(s,n[s],n[s+1],o);else for(s=e-i;s>=t;s-=i)o=la(s,n[s],n[s+1],o);return o&&vr(o,o.next)&&(xi(o),o=o.next),o}function Je(n,t){if(!n)return n;t||(t=n);let e=n,i;do if(i=!1,!e.steiner&&(vr(e,e.next)||kt(e.prev,e,e.next)===0)){if(xi(e),e=t=e.prev,e===e.next)break;i=!0}else e=e.next;while(i||e!==t);return t}function mi(n,t,e,i,r,s,o){if(!n)return;!o&&s&&Yp(n,i,r,s);let a=n,l,c;for(;n.prev!==n.next;){if(l=n.prev,c=n.next,s?Hp(n,i,r,s):Up(n)){t.push(l.i/e),t.push(n.i/e),t.push(c.i/e),xi(n),n=c.next,a=c.next;continue}if(n=c,n===a){o?o===1?(n=Gp(Je(n),t,e),mi(n,t,e,i,r,s,2)):o===2&&kp(n,t,e,i,r,s):mi(Je(n),t,e,i,r,s,1);break}}}function Up(n){const t=n.prev,e=n,i=n.next;if(kt(t,e,i)>=0)return!1;let r=n.next.next;for(;r!==n.prev;){if(Cn(t.x,t.y,e.x,e.y,i.x,i.y,r.x,r.y)&&kt(r.prev,r,r.next)>=0)return!1;r=r.next}return!0}function Hp(n,t,e,i){const r=n.prev,s=n,o=n.next;if(kt(r,s,o)>=0)return!1;const a=r.x<s.x?r.x<o.x?r.x:o.x:s.x<o.x?s.x:o.x,l=r.y<s.y?r.y<o.y?r.y:o.y:s.y<o.y?s.y:o.y,c=r.x>s.x?r.x>o.x?r.x:o.x:s.x>o.x?s.x:o.x,u=r.y>s.y?r.y>o.y?r.y:o.y:s.y>o.y?s.y:o.y,h=gs(a,l,t,e,i),d=gs(c,u,t,e,i);let f=n.prevZ,m=n.nextZ;for(;f&&f.z>=h&&m&&m.z<=d;){if(f!==n.prev&&f!==n.next&&Cn(r.x,r.y,s.x,s.y,o.x,o.y,f.x,f.y)&&kt(f.prev,f,f.next)>=0||(f=f.prevZ,m!==n.prev&&m!==n.next&&Cn(r.x,r.y,s.x,s.y,o.x,o.y,m.x,m.y)&&kt(m.prev,m,m.next)>=0))return!1;m=m.nextZ}for(;f&&f.z>=h;){if(f!==n.prev&&f!==n.next&&Cn(r.x,r.y,s.x,s.y,o.x,o.y,f.x,f.y)&&kt(f.prev,f,f.next)>=0)return!1;f=f.prevZ}for(;m&&m.z<=d;){if(m!==n.prev&&m!==n.next&&Cn(r.x,r.y,s.x,s.y,o.x,o.y,m.x,m.y)&&kt(m.prev,m,m.next)>=0)return!1;m=m.nextZ}return!0}function Gp(n,t,e){let i=n;do{const r=i.prev,s=i.next.next;!vr(r,s)&&rl(r,i,i.next,s)&&gi(r,s)&&gi(s,r)&&(t.push(r.i/e),t.push(i.i/e),t.push(s.i/e),xi(i),xi(i.next),i=n=s),i=i.next}while(i!==n);return Je(i)}function kp(n,t,e,i,r,s){let o=n;do{let a=o.next.next;for(;a!==o.prev;){if(o.i!==a.i&&Qp(o,a)){let l=sl(o,a);o=Je(o,o.next),l=Je(l,l.next),mi(o,t,e,i,r,s),mi(l,t,e,i,r,s);return}a=a.next}o=o.next}while(o!==n)}function Vp(n,t,e,i){const r=[];let s,o,a,l,c;for(s=0,o=t.length;s<o;s++)a=t[s]*i,l=s<o-1?t[s+1]*i:n.length,c=il(n,a,l,i,!1),c===c.next&&(c.steiner=!0),r.push(Jp(c));for(r.sort(Wp),s=0;s<r.length;s++)qp(r[s],e),e=Je(e,e.next);return e}function Wp(n,t){return n.x-t.x}function qp(n,t){if(t=Xp(n,t),t){const e=sl(t,n);Je(t,t.next),Je(e,e.next)}}function Xp(n,t){let e=t;const i=n.x,r=n.y;let s=-1/0,o;do{if(r<=e.y&&r>=e.next.y&&e.next.y!==e.y){const d=e.x+(r-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(d<=i&&d>s){if(s=d,d===i){if(r===e.y)return e;if(r===e.next.y)return e.next}o=e.x<e.next.x?e:e.next}}e=e.next}while(e!==t);if(!o)return null;if(i===s)return o;const a=o,l=o.x,c=o.y;let u=1/0,h;e=o;do i>=e.x&&e.x>=l&&i!==e.x&&Cn(r<c?i:s,r,l,c,r<c?s:i,r,e.x,e.y)&&(h=Math.abs(r-e.y)/(i-e.x),gi(e,n)&&(h<u||h===u&&(e.x>o.x||e.x===o.x&&jp(o,e)))&&(o=e,u=h)),e=e.next;while(e!==a);return o}function jp(n,t){return kt(n.prev,n,t.prev)<0&&kt(t.next,n,n.next)<0}function Yp(n,t,e,i){let r=n;do r.z===null&&(r.z=gs(r.x,r.y,t,e,i)),r.prevZ=r.prev,r.nextZ=r.next,r=r.next;while(r!==n);r.prevZ.nextZ=null,r.prevZ=null,Zp(r)}function Zp(n){let t,e,i,r,s,o,a,l,c=1;do{for(e=n,n=null,s=null,o=0;e;){for(o++,i=e,a=0,t=0;t<c&&(a++,i=i.nextZ,!!i);t++);for(l=c;a>0||l>0&&i;)a!==0&&(l===0||!i||e.z<=i.z)?(r=e,e=e.nextZ,a--):(r=i,i=i.nextZ,l--),s?s.nextZ=r:n=r,r.prevZ=s,s=r;e=i}s.nextZ=null,c*=2}while(o>1);return n}function gs(n,t,e,i,r){return n=32767*(n-e)*r,t=32767*(t-i)*r,n=(n|n<<8)&16711935,n=(n|n<<4)&252645135,n=(n|n<<2)&858993459,n=(n|n<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,n|t<<1}function Jp(n){let t=n,e=n;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==n);return e}function Cn(n,t,e,i,r,s,o,a){return(r-o)*(t-a)-(n-o)*(s-a)>=0&&(n-o)*(i-a)-(e-o)*(t-a)>=0&&(e-o)*(s-a)-(r-o)*(i-a)>=0}function Qp(n,t){return n.next.i!==t.i&&n.prev.i!==t.i&&!$p(n,t)&&(gi(n,t)&&gi(t,n)&&Kp(n,t)&&(kt(n.prev,n,t.prev)||kt(n,t.prev,t))||vr(n,t)&&kt(n.prev,n,n.next)>0&&kt(t.prev,t,t.next)>0)}function kt(n,t,e){return(t.y-n.y)*(e.x-t.x)-(t.x-n.x)*(e.y-t.y)}function vr(n,t){return n.x===t.x&&n.y===t.y}function rl(n,t,e,i){const r=Zi(kt(n,t,e)),s=Zi(kt(n,t,i)),o=Zi(kt(e,i,n)),a=Zi(kt(e,i,t));return!!(r!==s&&o!==a||r===0&&Yi(n,e,t)||s===0&&Yi(n,i,t)||o===0&&Yi(e,n,i)||a===0&&Yi(e,t,i))}function Yi(n,t,e){return t.x<=Math.max(n.x,e.x)&&t.x>=Math.min(n.x,e.x)&&t.y<=Math.max(n.y,e.y)&&t.y>=Math.min(n.y,e.y)}function Zi(n){return n>0?1:n<0?-1:0}function $p(n,t){let e=n;do{if(e.i!==n.i&&e.next.i!==n.i&&e.i!==t.i&&e.next.i!==t.i&&rl(e,e.next,n,t))return!0;e=e.next}while(e!==n);return!1}function gi(n,t){return kt(n.prev,n,n.next)<0?kt(n,t,n.next)>=0&&kt(n,n.prev,t)>=0:kt(n,t,n.prev)<0||kt(n,n.next,t)<0}function Kp(n,t){let e=n,i=!1;const r=(n.x+t.x)/2,s=(n.y+t.y)/2;do e.y>s!=e.next.y>s&&e.next.y!==e.y&&r<(e.next.x-e.x)*(s-e.y)/(e.next.y-e.y)+e.x&&(i=!i),e=e.next;while(e!==n);return i}function sl(n,t){const e=new xs(n.i,n.x,n.y),i=new xs(t.i,t.x,t.y),r=n.next,s=t.prev;return n.next=t,t.prev=n,e.next=r,r.prev=e,i.next=e,e.prev=i,s.next=i,i.prev=s,i}function la(n,t,e,i){const r=new xs(n,t,e);return i?(r.next=i.next,r.prev=i,i.next.prev=r,i.next=r):(r.prev=r,r.next=r),r}function xi(n){n.next.prev=n.prev,n.prev.next=n.next,n.prevZ&&(n.prevZ.nextZ=n.nextZ),n.nextZ&&(n.nextZ.prevZ=n.prevZ)}function xs(n,t,e){this.i=n,this.x=t,this.y=e,this.prev=null,this.next=null,this.z=null,this.prevZ=null,this.nextZ=null,this.steiner=!1}function tm(n,t,e,i){let r=0;for(let s=t,o=e-i;s<e;s+=i)r+=(n[o]-n[s])*(n[s+1]+n[o+1]),o=s;return r}const ln={area:function(n){const t=n.length;let e=0;for(let i=t-1,r=0;r<t;i=r++)e+=n[i].x*n[r].y-n[r].x*n[i].y;return e*.5},isClockWise:function(n){return ln.area(n)<0},triangulateShape:function(n,t){const e=[],i=[],r=[];ca(n),ha(e,n);let s=n.length;t.forEach(ca);for(let a=0;a<t.length;a++)i.push(s),s+=t[a].length,ha(e,t[a]);const o=zp.triangulate(e,i);for(let a=0;a<o.length;a+=3)r.push(o.slice(a,a+3));return r}};function ca(n){const t=n.length;t>2&&n[t-1].equals(n[0])&&n.pop()}function ha(n,t){for(let e=0;e<t.length;e++)n.push(t[e].x),n.push(t[e].y)}class yr extends Ct{constructor(t,e){super(),this.type="ExtrudeGeometry",this.parameters={shapes:t,options:e},t=Array.isArray(t)?t:[t];const i=this,r=[],s=[];for(let a=0,l=t.length;a<l;a++){const c=t[a];o(c)}this.setAttribute("position",new zt(r,3)),this.setAttribute("uv",new zt(s,2)),this.computeVertexNormals();function o(a){const l=[],c=e.curveSegments!==void 0?e.curveSegments:12,u=e.steps!==void 0?e.steps:1;let h=e.depth!==void 0?e.depth:100,d=e.bevelEnabled!==void 0?e.bevelEnabled:!0,f=e.bevelThickness!==void 0?e.bevelThickness:6,m=e.bevelSize!==void 0?e.bevelSize:f-2,x=e.bevelOffset!==void 0?e.bevelOffset:0,v=e.bevelSegments!==void 0?e.bevelSegments:3;const g=e.extrudePath,p=e.UVGenerator!==void 0?e.UVGenerator:em;e.amount!==void 0&&(h=e.amount);let E,S=!1,A,y,I,O;g&&(E=g.getSpacedPoints(u),S=!0,d=!1,A=g.computeFrenetFrames(u,!1),y=new M,I=new M,O=new M),d||(v=0,f=0,m=0,x=0);const F=a.extractPoints(c);let V=F.shape;const P=F.holes;if(!ln.isClockWise(V)){V=V.reverse();for(let X=0,J=P.length;X<J;X++){const tt=P[X];ln.isClockWise(tt)&&(P[X]=tt.reverse())}}const R=ln.triangulateShape(V,P),L=V;for(let X=0,J=P.length;X<J;X++){const tt=P[X];V=V.concat(tt)}function N(X,J,tt){return J.clone().multiplyScalar(tt).add(X)}const C=V.length,W=R.length;function K(X,J,tt){let lt,nt,w;const b=X.x-J.x,H=X.y-J.y,G=tt.x-X.x,it=tt.y-X.y,at=b*b+H*H,Pt=b*it-H*G;if(Math.abs(Pt)>Number.EPSILON){const vt=Math.sqrt(at),T=Math.sqrt(G*G+it*it),Z=J.x-H/vt,Q=J.y+b/vt,ct=tt.x-it/T,k=tt.y+G/T,ft=((ct-Z)*it-(k-Q)*G)/(b*it-H*G);lt=Z+b*ft-X.x,nt=Q+H*ft-X.y;const Nt=lt*lt+nt*nt;if(Nt<=2)return new Y(lt,nt);w=Math.sqrt(Nt/2)}else{let vt=!1;b>Number.EPSILON?G>Number.EPSILON&&(vt=!0):b<-Number.EPSILON?G<-Number.EPSILON&&(vt=!0):Math.sign(H)===Math.sign(it)&&(vt=!0),vt?(lt=-H,nt=b,w=Math.sqrt(at)):(lt=b,nt=H,w=Math.sqrt(at/2))}return new Y(lt/w,nt/w)}const j=[];for(let X=0,J=L.length,tt=J-1,lt=X+1;X<J;X++,tt++,lt++)tt===J&&(tt=0),lt===J&&(lt=0),j[X]=K(L[X],L[tt],L[lt]);const rt=[];let st,dt=j.concat();for(let X=0,J=P.length;X<J;X++){const tt=P[X];st=[];for(let lt=0,nt=tt.length,w=nt-1,b=lt+1;lt<nt;lt++,w++,b++)w===nt&&(w=0),b===nt&&(b=0),st[lt]=K(tt[lt],tt[w],tt[b]);rt.push(st),dt=dt.concat(st)}for(let X=0;X<v;X++){const J=X/v,tt=f*Math.cos(J*Math.PI/2),lt=m*Math.sin(J*Math.PI/2)+x;for(let nt=0,w=L.length;nt<w;nt++){const b=N(L[nt],j[nt],lt);xt(b.x,b.y,-tt)}for(let nt=0,w=P.length;nt<w;nt++){const b=P[nt];st=rt[nt];for(let H=0,G=b.length;H<G;H++){const it=N(b[H],st[H],lt);xt(it.x,it.y,-tt)}}}const _t=m+x;for(let X=0;X<C;X++){const J=d?N(V[X],dt[X],_t):V[X];S?(I.copy(A.normals[0]).multiplyScalar(J.x),y.copy(A.binormals[0]).multiplyScalar(J.y),O.copy(E[0]).add(I).add(y),xt(O.x,O.y,O.z)):xt(J.x,J.y,0)}for(let X=1;X<=u;X++)for(let J=0;J<C;J++){const tt=d?N(V[J],dt[J],_t):V[J];S?(I.copy(A.normals[X]).multiplyScalar(tt.x),y.copy(A.binormals[X]).multiplyScalar(tt.y),O.copy(E[X]).add(I).add(y),xt(O.x,O.y,O.z)):xt(tt.x,tt.y,h/u*X)}for(let X=v-1;X>=0;X--){const J=X/v,tt=f*Math.cos(J*Math.PI/2),lt=m*Math.sin(J*Math.PI/2)+x;for(let nt=0,w=L.length;nt<w;nt++){const b=N(L[nt],j[nt],lt);xt(b.x,b.y,h+tt)}for(let nt=0,w=P.length;nt<w;nt++){const b=P[nt];st=rt[nt];for(let H=0,G=b.length;H<G;H++){const it=N(b[H],st[H],lt);S?xt(it.x,it.y+E[u-1].y,E[u-1].x+tt):xt(it.x,it.y,h+tt)}}}U(),Dt();function U(){const X=r.length/3;if(d){let J=0,tt=C*J;for(let lt=0;lt<W;lt++){const nt=R[lt];ut(nt[2]+tt,nt[1]+tt,nt[0]+tt)}J=u+v*2,tt=C*J;for(let lt=0;lt<W;lt++){const nt=R[lt];ut(nt[0]+tt,nt[1]+tt,nt[2]+tt)}}else{for(let J=0;J<W;J++){const tt=R[J];ut(tt[2],tt[1],tt[0])}for(let J=0;J<W;J++){const tt=R[J];ut(tt[0]+C*u,tt[1]+C*u,tt[2]+C*u)}}i.addGroup(X,r.length/3-X,0)}function Dt(){const X=r.length/3;let J=0;Lt(L,J),J+=L.length;for(let tt=0,lt=P.length;tt<lt;tt++){const nt=P[tt];Lt(nt,J),J+=nt.length}i.addGroup(X,r.length/3-X,1)}function Lt(X,J){let tt=X.length;for(;--tt>=0;){const lt=tt;let nt=tt-1;nt<0&&(nt=X.length-1);for(let w=0,b=u+v*2;w<b;w++){const H=C*w,G=C*(w+1),it=J+lt+H,at=J+nt+H,Pt=J+nt+G,vt=J+lt+G;It(it,at,Pt,vt)}}}function xt(X,J,tt){l.push(X),l.push(J),l.push(tt)}function ut(X,J,tt){wt(X),wt(J),wt(tt);const lt=r.length/3,nt=p.generateTopUV(i,r,lt-3,lt-2,lt-1);Tt(nt[0]),Tt(nt[1]),Tt(nt[2])}function It(X,J,tt,lt){wt(X),wt(J),wt(lt),wt(J),wt(tt),wt(lt);const nt=r.length/3,w=p.generateSideWallUV(i,r,nt-6,nt-3,nt-2,nt-1);Tt(w[0]),Tt(w[1]),Tt(w[3]),Tt(w[1]),Tt(w[2]),Tt(w[3])}function wt(X){r.push(l[X*3+0]),r.push(l[X*3+1]),r.push(l[X*3+2])}function Tt(X){s.push(X.x),s.push(X.y)}}}toJSON(){const t=Ct.prototype.toJSON.call(this),e=this.parameters.shapes,i=this.parameters.options;return nm(e,i,t)}}const em={generateTopUV:function(n,t,e,i,r){const s=t[e*3],o=t[e*3+1],a=t[i*3],l=t[i*3+1],c=t[r*3],u=t[r*3+1];return[new Y(s,o),new Y(a,l),new Y(c,u)]},generateSideWallUV:function(n,t,e,i,r,s){const o=t[e*3],a=t[e*3+1],l=t[e*3+2],c=t[i*3],u=t[i*3+1],h=t[i*3+2],d=t[r*3],f=t[r*3+1],m=t[r*3+2],x=t[s*3],v=t[s*3+1],g=t[s*3+2];return Math.abs(a-u)<.01?[new Y(o,1-l),new Y(c,1-h),new Y(d,1-m),new Y(x,1-g)]:[new Y(a,1-l),new Y(u,1-h),new Y(f,1-m),new Y(v,1-g)]}};function nm(n,t,e){if(e.shapes=[],Array.isArray(n))for(let i=0,r=n.length;i<r;i++){const s=n[i];e.shapes.push(s.uuid)}else e.shapes.push(n.uuid);return t.extrudePath!==void 0&&(e.options.extrudePath=t.extrudePath.toJSON()),e}function vs(n,t,e){Ct.call(this),this.type="ParametricGeometry",this.parameters={func:n,slices:t,stacks:e};const i=[],r=[],s=[],o=[],a=1e-5,l=new M,c=new M,u=new M,h=new M,d=new M;n.length<3;const f=t+1;for(let m=0;m<=e;m++){const x=m/e;for(let v=0;v<=t;v++){const g=v/t;n(g,x,c),r.push(c.x,c.y,c.z),g-a>=0?(n(g-a,x,u),h.subVectors(c,u)):(n(g+a,x,u),h.subVectors(u,c)),x-a>=0?(n(g,x-a,u),d.subVectors(c,u)):(n(g,x+a,u),d.subVectors(u,c)),l.crossVectors(h,d).normalize(),s.push(l.x,l.y,l.z),o.push(g,x)}}for(let m=0;m<e;m++)for(let x=0;x<t;x++){const v=m*f+x,g=m*f+x+1,p=(m+1)*f+x+1,E=(m+1)*f+x;i.push(v,g,E),i.push(g,p,E)}this.setIndex(i),this.setAttribute("position",new zt(r,3)),this.setAttribute("normal",new zt(s,3)),this.setAttribute("uv",new zt(o,2))}vs.prototype=Object.create(Ct.prototype);vs.prototype.constructor=vs;class im extends Ct{constructor(t,e=12){super(),this.type="ShapeGeometry",this.parameters={shapes:t,curveSegments:e};const i=[],r=[],s=[],o=[];let a=0,l=0;if(Array.isArray(t)===!1)c(t);else for(let u=0;u<t.length;u++)c(t[u]),this.addGroup(a,l,u),a+=l,l=0;this.setIndex(i),this.setAttribute("position",new zt(r,3)),this.setAttribute("normal",new zt(s,3)),this.setAttribute("uv",new zt(o,2));function c(u){const h=r.length/3,d=u.extractPoints(e);let f=d.shape;const m=d.holes;ln.isClockWise(f)===!1&&(f=f.reverse());for(let v=0,g=m.length;v<g;v++){const p=m[v];ln.isClockWise(p)===!0&&(m[v]=p.reverse())}const x=ln.triangulateShape(f,m);for(let v=0,g=m.length;v<g;v++){const p=m[v];f=f.concat(p)}for(let v=0,g=f.length;v<g;v++){const p=f[v];r.push(p.x,p.y,0),s.push(0,0,1),o.push(p.x,p.y)}for(let v=0,g=x.length;v<g;v++){const p=x[v],E=p[0]+h,S=p[1]+h,A=p[2]+h;i.push(E,S,A),l+=3}}}toJSON(){const t=Ct.prototype.toJSON.call(this),e=this.parameters.shapes;return rm(e,t)}}function rm(n,t){if(t.shapes=[],Array.isArray(n))for(let e=0,i=n.length;e<i;e++){const r=n[e];t.shapes.push(r.uuid)}else t.shapes.push(n.uuid);return t}class sm extends Ct{constructor(t=1,e=8,i=6,r=0,s=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:i,phiStart:r,phiLength:s,thetaStart:o,thetaLength:a},e=Math.max(3,Math.floor(e)),i=Math.max(2,Math.floor(i));const l=Math.min(o+a,Math.PI);let c=0;const u=[],h=new M,d=new M,f=[],m=[],x=[],v=[];for(let g=0;g<=i;g++){const p=[],E=g/i;let S=0;g==0&&o==0?S=.5/e:g==i&&l==Math.PI&&(S=-.5/e);for(let A=0;A<=e;A++){const y=A/e;h.x=-t*Math.cos(r+y*s)*Math.sin(o+E*a),h.y=t*Math.cos(o+E*a),h.z=t*Math.sin(r+y*s)*Math.sin(o+E*a),m.push(h.x,h.y,h.z),d.copy(h).normalize(),x.push(d.x,d.y,d.z),v.push(y+S,1-E),p.push(c++)}u.push(p)}for(let g=0;g<i;g++)for(let p=0;p<e;p++){const E=u[g][p+1],S=u[g][p],A=u[g+1][p],y=u[g+1][p+1];(g!==0||o>0)&&f.push(E,S,y),(g!==i-1||l<Math.PI)&&f.push(S,A,y)}this.setIndex(f),this.setAttribute("position",new zt(m,3)),this.setAttribute("normal",new zt(x,3)),this.setAttribute("uv",new zt(v,2))}}class om extends Vt{constructor(t){super(),this.type="ShadowMaterial",this.color=new ht(0),this.transparent=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this}}om.prototype.isShadowMaterial=!0;class am extends ye{constructor(t){super(t),this.type="RawShaderMaterial"}}am.prototype.isRawShaderMaterial=!0;function Qe(n){Vt.call(this),this.defines={STANDARD:""},this.type="MeshStandardMaterial",this.color=new ht(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ht(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Bn,this.normalScale=new Y(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.flatShading=!1,this.vertexTangents=!1,this.setValues(n)}Qe.prototype=Object.create(Vt.prototype);Qe.prototype.constructor=Qe;Qe.prototype.isMeshStandardMaterial=!0;Qe.prototype.copy=function(n){return Vt.prototype.copy.call(this,n),this.defines={STANDARD:""},this.color.copy(n.color),this.roughness=n.roughness,this.metalness=n.metalness,this.map=n.map,this.lightMap=n.lightMap,this.lightMapIntensity=n.lightMapIntensity,this.aoMap=n.aoMap,this.aoMapIntensity=n.aoMapIntensity,this.emissive.copy(n.emissive),this.emissiveMap=n.emissiveMap,this.emissiveIntensity=n.emissiveIntensity,this.bumpMap=n.bumpMap,this.bumpScale=n.bumpScale,this.normalMap=n.normalMap,this.normalMapType=n.normalMapType,this.normalScale.copy(n.normalScale),this.displacementMap=n.displacementMap,this.displacementScale=n.displacementScale,this.displacementBias=n.displacementBias,this.roughnessMap=n.roughnessMap,this.metalnessMap=n.metalnessMap,this.alphaMap=n.alphaMap,this.envMap=n.envMap,this.envMapIntensity=n.envMapIntensity,this.refractionRatio=n.refractionRatio,this.wireframe=n.wireframe,this.wireframeLinewidth=n.wireframeLinewidth,this.wireframeLinecap=n.wireframeLinecap,this.wireframeLinejoin=n.wireframeLinejoin,this.skinning=n.skinning,this.morphTargets=n.morphTargets,this.morphNormals=n.morphNormals,this.flatShading=n.flatShading,this.vertexTangents=n.vertexTangents,this};function Nn(n){Qe.call(this),this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.clearcoat=0,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new Y(1,1),this.clearcoatNormalMap=null,this.reflectivity=.5,Object.defineProperty(this,"ior",{get:function(){return(1+.4*this.reflectivity)/(1-.4*this.reflectivity)},set:function(t){this.reflectivity=bt.clamp(2.5*(t-1)/(t+1),0,1)}}),this.sheen=null,this.transmission=0,this.transmissionMap=null,this.setValues(n)}Nn.prototype=Object.create(Qe.prototype);Nn.prototype.constructor=Nn;Nn.prototype.isMeshPhysicalMaterial=!0;Nn.prototype.copy=function(n){return Qe.prototype.copy.call(this,n),this.defines={STANDARD:"",PHYSICAL:""},this.clearcoat=n.clearcoat,this.clearcoatMap=n.clearcoatMap,this.clearcoatRoughness=n.clearcoatRoughness,this.clearcoatRoughnessMap=n.clearcoatRoughnessMap,this.clearcoatNormalMap=n.clearcoatNormalMap,this.clearcoatNormalScale.copy(n.clearcoatNormalScale),this.reflectivity=n.reflectivity,n.sheen?this.sheen=(this.sheen||new ht).copy(n.sheen):this.sheen=null,this.transmission=n.transmission,this.transmissionMap=n.transmissionMap,this};class lm extends Vt{constructor(t){super(),this.type="MeshPhongMaterial",this.color=new ht(16777215),this.specular=new ht(1118481),this.shininess=30,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ht(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Bn,this.normalScale=new Y(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=fr,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.flatShading=!1,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.specular.copy(t.specular),this.shininess=t.shininess,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.skinning=t.skinning,this.morphTargets=t.morphTargets,this.morphNormals=t.morphNormals,this.flatShading=t.flatShading,this}}lm.prototype.isMeshPhongMaterial=!0;class cm extends Vt{constructor(t){super(),this.defines={TOON:""},this.type="MeshToonMaterial",this.color=new ht(16777215),this.map=null,this.gradientMap=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ht(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Bn,this.normalScale=new Y(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.gradientMap=t.gradientMap,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.alphaMap=t.alphaMap,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.skinning=t.skinning,this.morphTargets=t.morphTargets,this.morphNormals=t.morphNormals,this}}cm.prototype.isMeshToonMaterial=!0;class hm extends Vt{constructor(t){super(),this.type="MeshNormalMaterial",this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Bn,this.normalScale=new Y(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.flatShading=!1,this.setValues(t)}copy(t){return super.copy(t),this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.skinning=t.skinning,this.morphTargets=t.morphTargets,this.morphNormals=t.morphNormals,this.flatShading=t.flatShading,this}}hm.prototype.isMeshNormalMaterial=!0;class um extends Vt{constructor(t){super(),this.type="MeshLambertMaterial",this.color=new ht(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ht(0),this.emissiveIntensity=1,this.emissiveMap=null,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=fr,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.skinning=t.skinning,this.morphTargets=t.morphTargets,this.morphNormals=t.morphNormals,this}}um.prototype.isMeshLambertMaterial=!0;class dm extends Vt{constructor(t){super(),this.defines={MATCAP:""},this.type="MeshMatcapMaterial",this.color=new ht(16777215),this.matcap=null,this.map=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Bn,this.normalScale=new Y(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.flatShading=!1,this.setValues(t)}copy(t){return super.copy(t),this.defines={MATCAP:""},this.color.copy(t.color),this.matcap=t.matcap,this.map=t.map,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.alphaMap=t.alphaMap,this.skinning=t.skinning,this.morphTargets=t.morphTargets,this.morphNormals=t.morphNormals,this.flatShading=t.flatShading,this}}dm.prototype.isMeshMatcapMaterial=!0;class fm extends bi{constructor(t){super(),this.type="LineDashedMaterial",this.scale=1,this.dashSize=3,this.gapSize=1,this.setValues(t)}copy(t){return super.copy(t),this.scale=t.scale,this.dashSize=t.dashSize,this.gapSize=t.gapSize,this}}fm.prototype.isLineDashedMaterial=!0;const Gt={arraySlice:function(n,t,e){return Gt.isTypedArray(n)?new n.constructor(n.subarray(t,e!==void 0?e:n.length)):n.slice(t,e)},convertArray:function(n,t,e){return!n||!e&&n.constructor===t?n:typeof t.BYTES_PER_ELEMENT=="number"?new t(n):Array.prototype.slice.call(n)},isTypedArray:function(n){return ArrayBuffer.isView(n)&&!(n instanceof DataView)},getKeyframeOrder:function(n){function t(r,s){return n[r]-n[s]}const e=n.length,i=new Array(e);for(let r=0;r!==e;++r)i[r]=r;return i.sort(t),i},sortedArray:function(n,t,e){const i=n.length,r=new n.constructor(i);for(let s=0,o=0;o!==i;++s){const a=e[s]*t;for(let l=0;l!==t;++l)r[o++]=n[a+l]}return r},flattenJSON:function(n,t,e,i){let r=1,s=n[0];for(;s!==void 0&&s[i]===void 0;)s=n[r++];if(s===void 0)return;let o=s[i];if(o!==void 0)if(Array.isArray(o))do o=s[i],o!==void 0&&(t.push(s.time),e.push.apply(e,o)),s=n[r++];while(s!==void 0);else if(o.toArray!==void 0)do o=s[i],o!==void 0&&(t.push(s.time),o.toArray(e,e.length)),s=n[r++];while(s!==void 0);else do o=s[i],o!==void 0&&(t.push(s.time),e.push(o)),s=n[r++];while(s!==void 0)},subclip:function(n,t,e,i,r=30){const s=n.clone();s.name=t;const o=[];for(let l=0;l<s.tracks.length;++l){const c=s.tracks[l],u=c.getValueSize(),h=[],d=[];for(let f=0;f<c.times.length;++f){const m=c.times[f]*r;if(!(m<e||m>=i)){h.push(c.times[f]);for(let x=0;x<u;++x)d.push(c.values[f*u+x])}}h.length!==0&&(c.times=Gt.convertArray(h,c.times.constructor),c.values=Gt.convertArray(d,c.values.constructor),o.push(c))}s.tracks=o;let a=1/0;for(let l=0;l<s.tracks.length;++l)a>s.tracks[l].times[0]&&(a=s.tracks[l].times[0]);for(let l=0;l<s.tracks.length;++l)s.tracks[l].shift(-1*a);return s.resetDuration(),s},makeClipAdditive:function(n,t=0,e=n,i=30){i<=0&&(i=30);const r=e.tracks.length,s=t/i;for(let o=0;o<r;++o){const a=e.tracks[o],l=a.ValueTypeName;if(l==="bool"||l==="string")continue;const c=n.tracks.find(function(g){return g.name===a.name&&g.ValueTypeName===l});if(c===void 0)continue;let u=0;const h=a.getValueSize();a.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline&&(u=h/3);let d=0;const f=c.getValueSize();c.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline&&(d=f/3);const m=a.times.length-1;let x;if(s<=a.times[0]){const g=u,p=h-u;x=Gt.arraySlice(a.values,g,p)}else if(s>=a.times[m]){const g=m*h+u,p=g+h-u;x=Gt.arraySlice(a.values,g,p)}else{const g=a.createInterpolant(),p=u,E=h-u;g.evaluate(s),x=Gt.arraySlice(g.resultBuffer,p,E)}l==="quaternion"&&new le().fromArray(x).normalize().conjugate().toArray(x);const v=c.times.length;for(let g=0;g<v;++g){const p=g*f+d;if(l==="quaternion")le.multiplyQuaternionsFlat(c.values,p,x,0,c.values,p);else{const E=f-d*2;for(let S=0;S<E;++S)c.values[p+S]-=x[S]}}}return n.blendMode=Ca,n}};function xe(n,t,e,i){this.parameterPositions=n,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new t.constructor(e),this.sampleValues=t,this.valueSize=e}Object.assign(xe.prototype,{evaluate:function(n){const t=this.parameterPositions;let e=this._cachedIndex,i=t[e],r=t[e-1];t:{e:{let s;n:{i:if(!(n<i)){for(let o=e+2;;){if(i===void 0){if(n<r)break i;return e=t.length,this._cachedIndex=e,this.afterEnd_(e-1,n,r)}if(e===o)break;if(r=i,i=t[++e],n<i)break e}s=t.length;break n}if(!(n>=r)){const o=t[1];n<o&&(e=2,r=o);for(let a=e-2;;){if(r===void 0)return this._cachedIndex=0,this.beforeStart_(0,n,i);if(e===a)break;if(i=r,r=t[--e-1],n>=r)break e}s=e,e=0;break n}break t}for(;e<s;){const o=e+s>>>1;n<t[o]?s=o:e=o+1}if(i=t[e],r=t[e-1],r===void 0)return this._cachedIndex=0,this.beforeStart_(0,n,i);if(i===void 0)return e=t.length,this._cachedIndex=e,this.afterEnd_(e-1,r,n)}this._cachedIndex=e,this.intervalChanged_(e,r,i)}return this.interpolate_(e,r,n,i)},settings:null,DefaultSettings_:{},getSettings_:function(){return this.settings||this.DefaultSettings_},copySampleValue_:function(n){const t=this.resultBuffer,e=this.sampleValues,i=this.valueSize,r=n*i;for(let s=0;s!==i;++s)t[s]=e[r+s];return t},interpolate_:function(){throw new Error("call to abstract method")},intervalChanged_:function(){}});Object.assign(xe.prototype,{beforeStart_:xe.prototype.copySampleValue_,afterEnd_:xe.prototype.copySampleValue_});function ys(n,t,e,i){xe.call(this,n,t,e,i),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0}ys.prototype=Object.assign(Object.create(xe.prototype),{constructor:ys,DefaultSettings_:{endingStart:Ln,endingEnd:Ln},intervalChanged_:function(n,t,e){const i=this.parameterPositions;let r=n-2,s=n+1,o=i[r],a=i[s];if(o===void 0)switch(this.getSettings_().endingStart){case Rn:r=n,o=2*t-e;break;case rr:r=i.length-2,o=t+i[r]-i[r+1];break;default:r=n,o=e}if(a===void 0)switch(this.getSettings_().endingEnd){case Rn:s=n,a=2*e-t;break;case rr:s=1,a=e+i[1]-i[0];break;default:s=n-1,a=t}const l=(e-t)*.5,c=this.valueSize;this._weightPrev=l/(t-o),this._weightNext=l/(a-e),this._offsetPrev=r*c,this._offsetNext=s*c},interpolate_:function(n,t,e,i){const r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=n*o,l=a-o,c=this._offsetPrev,u=this._offsetNext,h=this._weightPrev,d=this._weightNext,f=(e-t)/(i-t),m=f*f,x=m*f,v=-h*x+2*h*m-h*f,g=(1+h)*x+(-1.5-2*h)*m+(-.5+h)*f+1,p=(-1-d)*x+(1.5+d)*m+.5*f,E=d*x-d*m;for(let S=0;S!==o;++S)r[S]=v*s[c+S]+g*s[l+S]+p*s[a+S]+E*s[u+S];return r}});function ar(n,t,e,i){xe.call(this,n,t,e,i)}ar.prototype=Object.assign(Object.create(xe.prototype),{constructor:ar,interpolate_:function(n,t,e,i){const r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=n*o,l=a-o,c=(e-t)/(i-t),u=1-c;for(let h=0;h!==o;++h)r[h]=s[l+h]*u+s[a+h]*c;return r}});function _s(n,t,e,i){xe.call(this,n,t,e,i)}_s.prototype=Object.assign(Object.create(xe.prototype),{constructor:_s,interpolate_:function(n){return this.copySampleValue_(n-1)}});class De{constructor(t,e,i,r){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(e===void 0||e.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=Gt.convertArray(e,this.TimeBufferType),this.values=Gt.convertArray(i,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(t){const e=t.constructor;let i;if(e.toJSON!==this.toJSON)i=e.toJSON(t);else{i={name:t.name,times:Gt.convertArray(t.times,Array),values:Gt.convertArray(t.values,Array)};const r=t.getInterpolation();r!==t.DefaultInterpolation&&(i.interpolation=r)}return i.type=t.ValueTypeName,i}InterpolantFactoryMethodDiscrete(t){return new _s(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new ar(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new ys(this.times,this.values,this.getValueSize(),t)}setInterpolation(t){let e;switch(t){case nr:e=this.InterpolantFactoryMethodDiscrete;break;case ir:e=this.InterpolantFactoryMethodLinear;break;case Sr:e=this.InterpolantFactoryMethodSmooth;break}if(e===void 0){const i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return this}return this.createInterpolant=e,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return nr;case this.InterpolantFactoryMethodLinear:return ir;case this.InterpolantFactoryMethodSmooth:return Sr}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){const e=this.times;for(let i=0,r=e.length;i!==r;++i)e[i]+=t}return this}scale(t){if(t!==1){const e=this.times;for(let i=0,r=e.length;i!==r;++i)e[i]*=t}return this}trim(t,e){const i=this.times,r=i.length;let s=0,o=r-1;for(;s!==r&&i[s]<t;)++s;for(;o!==-1&&i[o]>e;)--o;if(++o,s!==0||o!==r){s>=o&&(o=Math.max(o,1),s=o-1);const a=this.getValueSize();this.times=Gt.arraySlice(i,s,o),this.values=Gt.arraySlice(this.values,s*a,o*a)}return this}validate(){let t=!0;const e=this.getValueSize();e-Math.floor(e)!==0&&(t=!1);const i=this.times,r=this.values,s=i.length;s===0&&(t=!1);let o=null;for(let a=0;a!==s;a++){const l=i[a];if(typeof l=="number"&&isNaN(l)){t=!1;break}if(o!==null&&o>l){t=!1;break}o=l}if(r!==void 0&&Gt.isTypedArray(r))for(let a=0,l=r.length;a!==l;++a){const c=r[a];if(isNaN(c)){t=!1;break}}return t}optimize(){const t=Gt.arraySlice(this.times),e=Gt.arraySlice(this.values),i=this.getValueSize(),r=this.getInterpolation()===Sr,s=t.length-1;let o=1;for(let a=1;a<s;++a){let l=!1;const c=t[a],u=t[a+1];if(c!==u&&(a!==1||c!==t[0]))if(r)l=!0;else{const h=a*i,d=h-i,f=h+i;for(let m=0;m!==i;++m){const x=e[h+m];if(x!==e[d+m]||x!==e[f+m]){l=!0;break}}}if(l){if(a!==o){t[o]=t[a];const h=a*i,d=o*i;for(let f=0;f!==i;++f)e[d+f]=e[h+f]}++o}}if(s>0){t[o]=t[s];for(let a=s*i,l=o*i,c=0;c!==i;++c)e[l+c]=e[a+c];++o}return o!==t.length?(this.times=Gt.arraySlice(t,0,o),this.values=Gt.arraySlice(e,0,o*i)):(this.times=t,this.values=e),this}clone(){const t=Gt.arraySlice(this.times,0),e=Gt.arraySlice(this.values,0),i=this.constructor,r=new i(this.name,t,e);return r.createInterpolant=this.createInterpolant,r}}De.prototype.TimeBufferType=Float32Array;De.prototype.ValueBufferType=Float32Array;De.prototype.DefaultInterpolation=ir;class Gn extends De{}Gn.prototype.ValueTypeName="bool";Gn.prototype.ValueBufferType=Array;Gn.prototype.DefaultInterpolation=nr;Gn.prototype.InterpolantFactoryMethodLinear=void 0;Gn.prototype.InterpolantFactoryMethodSmooth=void 0;class ol extends De{}ol.prototype.ValueTypeName="color";class lr extends De{}lr.prototype.ValueTypeName="number";function bs(n,t,e,i){xe.call(this,n,t,e,i)}bs.prototype=Object.assign(Object.create(xe.prototype),{constructor:bs,interpolate_:function(n,t,e,i){const r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=(e-t)/(i-t);let l=n*o;for(let c=l+o;l!==c;l+=4)le.slerpFlat(r,0,s,l-o,s,l,a);return r}});class Mi extends De{InterpolantFactoryMethodLinear(t){return new bs(this.times,this.values,this.getValueSize(),t)}}Mi.prototype.ValueTypeName="quaternion";Mi.prototype.DefaultInterpolation=ir;Mi.prototype.InterpolantFactoryMethodSmooth=void 0;class kn extends De{}kn.prototype.ValueTypeName="string";kn.prototype.ValueBufferType=Array;kn.prototype.DefaultInterpolation=nr;kn.prototype.InterpolantFactoryMethodLinear=void 0;kn.prototype.InterpolantFactoryMethodSmooth=void 0;class cr extends De{}cr.prototype.ValueTypeName="vector";class ua{constructor(t,e=-1,i,r=Ps){this.name=t,this.tracks=i,this.duration=e,this.blendMode=r,this.uuid=bt.generateUUID(),this.duration<0&&this.resetDuration()}static parse(t){const e=[],i=t.tracks,r=1/(t.fps||1);for(let o=0,a=i.length;o!==a;++o)e.push(mm(i[o]).scale(r));const s=new this(t.name,t.duration,e,t.blendMode);return s.uuid=t.uuid,s}static toJSON(t){const e=[],i=t.tracks,r={name:t.name,duration:t.duration,tracks:e,uuid:t.uuid,blendMode:t.blendMode};for(let s=0,o=i.length;s!==o;++s)e.push(De.toJSON(i[s]));return r}static CreateFromMorphTargetSequence(t,e,i,r){const s=e.length,o=[];for(let a=0;a<s;a++){let l=[],c=[];l.push((a+s-1)%s,a,(a+1)%s),c.push(0,1,0);const u=Gt.getKeyframeOrder(l);l=Gt.sortedArray(l,1,u),c=Gt.sortedArray(c,1,u),!r&&l[0]===0&&(l.push(s),c.push(c[0])),o.push(new lr(".morphTargetInfluences["+e[a].name+"]",l,c).scale(1/i))}return new this(t,-1,o)}static findByName(t,e){let i=t;if(!Array.isArray(t)){const r=t;i=r.geometry&&r.geometry.animations||r.animations}for(let r=0;r<i.length;r++)if(i[r].name===e)return i[r];return null}static CreateClipsFromMorphTargetSequences(t,e,i){const r={},s=/^([\w-]*?)([\d]+)$/;for(let a=0,l=t.length;a<l;a++){const c=t[a],u=c.name.match(s);if(u&&u.length>1){const h=u[1];let d=r[h];d||(r[h]=d=[]),d.push(c)}}const o=[];for(const a in r)o.push(this.CreateFromMorphTargetSequence(a,r[a],e,i));return o}static parseAnimation(t,e){if(!t)return null;const i=function(h,d,f,m,x){if(f.length!==0){const v=[],g=[];Gt.flattenJSON(f,v,g,m),v.length!==0&&x.push(new h(d,v,g))}},r=[],s=t.name||"default",o=t.fps||30,a=t.blendMode;let l=t.length||-1;const c=t.hierarchy||[];for(let h=0;h<c.length;h++){const d=c[h].keys;if(!(!d||d.length===0))if(d[0].morphTargets){const f={};let m;for(m=0;m<d.length;m++)if(d[m].morphTargets)for(let x=0;x<d[m].morphTargets.length;x++)f[d[m].morphTargets[x]]=-1;for(const x in f){const v=[],g=[];for(let p=0;p!==d[m].morphTargets.length;++p){const E=d[m];v.push(E.time),g.push(E.morphTarget===x?1:0)}r.push(new lr(".morphTargetInfluence["+x+"]",v,g))}l=f.length*o}else{const f=".bones["+e[h].name+"]";i(cr,f+".position",d,"pos",r),i(Mi,f+".quaternion",d,"rot",r),i(cr,f+".scale",d,"scl",r)}}return r.length===0?null:new this(s,l,r,a)}resetDuration(){const t=this.tracks;let e=0;for(let i=0,r=t.length;i!==r;++i){const s=this.tracks[i];e=Math.max(e,s.times[s.times.length-1])}return this.duration=e,this}trim(){for(let t=0;t<this.tracks.length;t++)this.tracks[t].trim(0,this.duration);return this}validate(){let t=!0;for(let e=0;e<this.tracks.length;e++)t=t&&this.tracks[e].validate();return t}optimize(){for(let t=0;t<this.tracks.length;t++)this.tracks[t].optimize();return this}clone(){const t=[];for(let e=0;e<this.tracks.length;e++)t.push(this.tracks[e].clone());return new this.constructor(this.name,this.duration,t,this.blendMode)}toJSON(){return this.constructor.toJSON(this)}}function pm(n){switch(n.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return lr;case"vector":case"vector2":case"vector3":case"vector4":return cr;case"color":return ol;case"quaternion":return Mi;case"bool":case"boolean":return Gn;case"string":return kn}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+n)}function mm(n){if(n.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");const t=pm(n.type);if(n.times===void 0){const e=[],i=[];Gt.flattenJSON(n.keys,e,i,"value"),n.times=e,n.values=i}return t.parse!==void 0?t.parse(n):new t(n.name,n.times,n.values,n.interpolation)}const Fn={enabled:!1,files:{},add:function(n,t){this.enabled!==!1&&(this.files[n]=t)},get:function(n){if(this.enabled!==!1)return this.files[n]},remove:function(n){delete this.files[n]},clear:function(){this.files={}}};function gm(n,t,e){const i=this;let r=!1,s=0,o=0,a;const l=[];this.onStart=void 0,this.onLoad=n,this.onProgress=t,this.onError=e,this.itemStart=function(c){o++,r===!1&&i.onStart!==void 0&&i.onStart(c,s,o),r=!0},this.itemEnd=function(c){s++,i.onProgress!==void 0&&i.onProgress(c,s,o),s===o&&(r=!1,i.onLoad!==void 0&&i.onLoad())},this.itemError=function(c){i.onError!==void 0&&i.onError(c)},this.resolveURL=function(c){return a?a(c):c},this.setURLModifier=function(c){return a=c,this},this.addHandler=function(c,u){return l.push(c,u),this},this.removeHandler=function(c){const u=l.indexOf(c);return u!==-1&&l.splice(u,2),this},this.getHandler=function(c){for(let u=0,h=l.length;u<h;u+=2){const d=l[u],f=l[u+1];if(d.global&&(d.lastIndex=0),d.test(c))return f}return null}}const xm=new gm;function se(n){this.manager=n!==void 0?n:xm,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}Object.assign(se.prototype,{load:function(){},loadAsync:function(n,t){const e=this;return new Promise(function(i,r){e.load(n,i,t,r)})},parse:function(){},setCrossOrigin:function(n){return this.crossOrigin=n,this},setWithCredentials:function(n){return this.withCredentials=n,this},setPath:function(n){return this.path=n,this},setResourcePath:function(n){return this.resourcePath=n,this},setRequestHeader:function(n){return this.requestHeader=n,this}});const Ee={};function vi(n){se.call(this,n)}vi.prototype=Object.assign(Object.create(se.prototype),{constructor:vi,load:function(n,t,e,i){n===void 0&&(n=""),this.path!==void 0&&(n=this.path+n),n=this.manager.resolveURL(n);const r=this,s=Fn.get(n);if(s!==void 0)return r.manager.itemStart(n),setTimeout(function(){t&&t(s),r.manager.itemEnd(n)},0),s;if(Ee[n]!==void 0){Ee[n].push({onLoad:t,onProgress:e,onError:i});return}const o=/^data:(.*?)(;base64)?,(.*)$/,a=n.match(o);let l;if(a){const c=a[1],u=!!a[2];let h=a[3];h=decodeURIComponent(h),u&&(h=atob(h));try{let d;const f=(this.responseType||"").toLowerCase();switch(f){case"arraybuffer":case"blob":const m=new Uint8Array(h.length);for(let v=0;v<h.length;v++)m[v]=h.charCodeAt(v);f==="blob"?d=new Blob([m.buffer],{type:c}):d=m.buffer;break;case"document":d=new DOMParser().parseFromString(h,c);break;case"json":d=JSON.parse(h);break;default:d=h;break}setTimeout(function(){t&&t(d),r.manager.itemEnd(n)},0)}catch(d){setTimeout(function(){i&&i(d),r.manager.itemError(n),r.manager.itemEnd(n)},0)}}else{Ee[n]=[],Ee[n].push({onLoad:t,onProgress:e,onError:i}),l=new XMLHttpRequest,l.open("GET",n,!0),l.addEventListener("load",function(c){const u=this.response,h=Ee[n];if(delete Ee[n],this.status===200||this.status===0){this.status,Fn.add(n,u);for(let d=0,f=h.length;d<f;d++){const m=h[d];m.onLoad&&m.onLoad(u)}r.manager.itemEnd(n)}else{for(let d=0,f=h.length;d<f;d++){const m=h[d];m.onError&&m.onError(c)}r.manager.itemError(n),r.manager.itemEnd(n)}},!1),l.addEventListener("progress",function(c){const u=Ee[n];for(let h=0,d=u.length;h<d;h++){const f=u[h];f.onProgress&&f.onProgress(c)}},!1),l.addEventListener("error",function(c){const u=Ee[n];delete Ee[n];for(let h=0,d=u.length;h<d;h++){const f=u[h];f.onError&&f.onError(c)}r.manager.itemError(n),r.manager.itemEnd(n)},!1),l.addEventListener("abort",function(c){const u=Ee[n];delete Ee[n];for(let h=0,d=u.length;h<d;h++){const f=u[h];f.onError&&f.onError(c)}r.manager.itemError(n),r.manager.itemEnd(n)},!1),this.responseType!==void 0&&(l.responseType=this.responseType),this.withCredentials!==void 0&&(l.withCredentials=this.withCredentials),l.overrideMimeType&&l.overrideMimeType(this.mimeType!==void 0?this.mimeType:"text/plain");for(const c in this.requestHeader)l.setRequestHeader(c,this.requestHeader[c]);l.send(null)}return r.manager.itemStart(n),l},setResponseType:function(n){return this.responseType=n,this},setMimeType:function(n){return this.mimeType=n,this}});function da(n){se.call(this,n)}da.prototype=Object.assign(Object.create(se.prototype),{constructor:da,load:function(n,t,e,i){const r=this,s=[],o=new nl,a=new vi(this.manager);a.setPath(this.path),a.setResponseType("arraybuffer"),a.setRequestHeader(this.requestHeader),a.setWithCredentials(r.withCredentials);let l=0;function c(u){a.load(n[u],function(h){const d=r.parse(h,!0);s[u]={width:d.width,height:d.height,format:d.format,mipmaps:d.mipmaps},l+=1,l===6&&(d.mipmapCount===1&&(o.minFilter=te),o.image=s,o.format=d.format,o.needsUpdate=!0,t&&t(o))},e,i)}if(Array.isArray(n))for(let u=0,h=n.length;u<h;++u)c(u);else a.load(n,function(u){const h=r.parse(u,!0);if(h.isCubemap){const d=h.mipmaps.length/h.mipmapCount;for(let f=0;f<d;f++){s[f]={mipmaps:[]};for(let m=0;m<h.mipmapCount;m++)s[f].mipmaps.push(h.mipmaps[f*h.mipmapCount+m]),s[f].format=h.format,s[f].width=h.width,s[f].height=h.height}o.image=s}else o.image.width=h.width,o.image.height=h.height,o.mipmaps=h.mipmaps;h.mipmapCount===1&&(o.minFilter=te),o.format=h.format,o.needsUpdate=!0,t&&t(o)},e,i);return o}});class al extends se{constructor(t){super(t)}load(t,e,i,r){this.path!==void 0&&(t=this.path+t),t=this.manager.resolveURL(t);const s=this,o=Fn.get(t);if(o!==void 0)return s.manager.itemStart(t),setTimeout(function(){e&&e(o),s.manager.itemEnd(t)},0),o;const a=document.createElementNS("http://www.w3.org/1999/xhtml","img");function l(){a.removeEventListener("load",l,!1),a.removeEventListener("error",c,!1),Fn.add(t,this),e&&e(this),s.manager.itemEnd(t)}function c(u){a.removeEventListener("load",l,!1),a.removeEventListener("error",c,!1),r&&r(u),s.manager.itemError(t),s.manager.itemEnd(t)}return a.addEventListener("load",l,!1),a.addEventListener("error",c,!1),t.substr(0,5)!=="data:"&&this.crossOrigin!==void 0&&(a.crossOrigin=this.crossOrigin),s.manager.itemStart(t),a.src=t,a}}class vm extends se{constructor(t){super(t)}load(t,e,i,r){const s=new gr,o=new al(this.manager);o.setCrossOrigin(this.crossOrigin),o.setPath(this.path);let a=0;function l(c){o.load(t[c],function(u){s.images[c]=u,a++,a===6&&(s.needsUpdate=!0,e&&e(s))},void 0,r)}for(let c=0;c<t.length;++c)l(c);return s}}function fa(n){se.call(this,n)}fa.prototype=Object.assign(Object.create(se.prototype),{constructor:fa,load:function(n,t,e,i){const r=this,s=new Ns,o=new vi(this.manager);return o.setResponseType("arraybuffer"),o.setRequestHeader(this.requestHeader),o.setPath(this.path),o.setWithCredentials(r.withCredentials),o.load(n,function(a){const l=r.parse(a);l&&(l.image!==void 0?s.image=l.image:l.data!==void 0&&(s.image.width=l.width,s.image.height=l.height,s.image.data=l.data),s.wrapS=l.wrapS!==void 0?l.wrapS:me,s.wrapT=l.wrapT!==void 0?l.wrapT:me,s.magFilter=l.magFilter!==void 0?l.magFilter:te,s.minFilter=l.minFilter!==void 0?l.minFilter:te,s.anisotropy=l.anisotropy!==void 0?l.anisotropy:1,l.encoding!==void 0&&(s.encoding=l.encoding),l.flipY!==void 0&&(s.flipY=l.flipY),l.format!==void 0&&(s.format=l.format),l.type!==void 0&&(s.type=l.type),l.mipmaps!==void 0&&(s.mipmaps=l.mipmaps,s.minFilter=pr),l.mipmapCount===1&&(s.minFilter=te),l.generateMipmaps!==void 0&&(s.generateMipmaps=l.generateMipmaps),s.needsUpdate=!0,t&&t(s,l))},e,i),s}});function Ms(n){se.call(this,n)}Ms.prototype=Object.assign(Object.create(se.prototype),{constructor:Ms,load:function(n,t,e,i){const r=new ne,s=new al(this.manager);return s.setCrossOrigin(this.crossOrigin),s.setPath(this.path),s.load(n,function(o){r.image=o;const a=n.search(/\.jpe?g($|\?)/i)>0||n.search(/^data\:image\/jpeg/)===0;r.format=a?on:Te,r.needsUpdate=!0,t!==void 0&&t(r)},e,i),r}});function de(){this.type="Curve",this.arcLengthDivisions=200}Object.assign(de.prototype,{getPoint:function(){return null},getPointAt:function(n,t){const e=this.getUtoTmapping(n);return this.getPoint(e,t)},getPoints:function(n=5){const t=[];for(let e=0;e<=n;e++)t.push(this.getPoint(e/n));return t},getSpacedPoints:function(n=5){const t=[];for(let e=0;e<=n;e++)t.push(this.getPointAt(e/n));return t},getLength:function(){const n=this.getLengths();return n[n.length-1]},getLengths:function(n){if(n===void 0&&(n=this.arcLengthDivisions),this.cacheArcLengths&&this.cacheArcLengths.length===n+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const t=[];let e,i=this.getPoint(0),r=0;t.push(0);for(let s=1;s<=n;s++)e=this.getPoint(s/n),r+=e.distanceTo(i),t.push(r),i=e;return this.cacheArcLengths=t,t},updateArcLengths:function(){this.needsUpdate=!0,this.getLengths()},getUtoTmapping:function(n,t){const e=this.getLengths();let i=0;const r=e.length;let s;t?s=t:s=n*e[r-1];let o=0,a=r-1,l;for(;o<=a;)if(i=Math.floor(o+(a-o)/2),l=e[i]-s,l<0)o=i+1;else if(l>0)a=i-1;else{a=i;break}if(i=a,e[i]===s)return i/(r-1);const c=e[i],h=e[i+1]-c,d=(s-c)/h;return(i+d)/(r-1)},getTangent:function(n,t){let i=n-1e-4,r=n+1e-4;i<0&&(i=0),r>1&&(r=1);const s=this.getPoint(i),o=this.getPoint(r),a=t||(s.isVector2?new Y:new M);return a.copy(o).sub(s).normalize(),a},getTangentAt:function(n,t){const e=this.getUtoTmapping(n);return this.getTangent(e,t)},computeFrenetFrames:function(n,t){const e=new M,i=[],r=[],s=[],o=new M,a=new ot;for(let d=0;d<=n;d++){const f=d/n;i[d]=this.getTangentAt(f,new M),i[d].normalize()}r[0]=new M,s[0]=new M;let l=Number.MAX_VALUE;const c=Math.abs(i[0].x),u=Math.abs(i[0].y),h=Math.abs(i[0].z);c<=l&&(l=c,e.set(1,0,0)),u<=l&&(l=u,e.set(0,1,0)),h<=l&&e.set(0,0,1),o.crossVectors(i[0],e).normalize(),r[0].crossVectors(i[0],o),s[0].crossVectors(i[0],r[0]);for(let d=1;d<=n;d++){if(r[d]=r[d-1].clone(),s[d]=s[d-1].clone(),o.crossVectors(i[d-1],i[d]),o.length()>Number.EPSILON){o.normalize();const f=Math.acos(bt.clamp(i[d-1].dot(i[d]),-1,1));r[d].applyMatrix4(a.makeRotationAxis(o,f))}s[d].crossVectors(i[d],r[d])}if(t===!0){let d=Math.acos(bt.clamp(r[0].dot(r[n]),-1,1));d/=n,i[0].dot(o.crossVectors(r[0],r[n]))>0&&(d=-d);for(let f=1;f<=n;f++)r[f].applyMatrix4(a.makeRotationAxis(i[f],d*f)),s[f].crossVectors(i[f],r[f])}return{tangents:i,normals:r,binormals:s}},clone:function(){return new this.constructor().copy(this)},copy:function(n){return this.arcLengthDivisions=n.arcLengthDivisions,this},toJSON:function(){const n={metadata:{version:4.5,type:"Curve",generator:"Curve.toJSON"}};return n.arcLengthDivisions=this.arcLengthDivisions,n.type=this.type,n},fromJSON:function(n){return this.arcLengthDivisions=n.arcLengthDivisions,this}});class _r extends de{constructor(t=0,e=0,i=1,r=1,s=0,o=Math.PI*2,a=!1,l=0){super(),this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=i,this.yRadius=r,this.aStartAngle=s,this.aEndAngle=o,this.aClockwise=a,this.aRotation=l}getPoint(t,e){const i=e||new Y,r=Math.PI*2;let s=this.aEndAngle-this.aStartAngle;const o=Math.abs(s)<Number.EPSILON;for(;s<0;)s+=r;for(;s>r;)s-=r;s<Number.EPSILON&&(o?s=0:s=r),this.aClockwise===!0&&!o&&(s===r?s=-r:s=s-r);const a=this.aStartAngle+t*s;let l=this.aX+this.xRadius*Math.cos(a),c=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){const u=Math.cos(this.aRotation),h=Math.sin(this.aRotation),d=l-this.aX,f=c-this.aY;l=d*u-f*h+this.aX,c=d*h+f*u+this.aY}return i.set(l,c)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){const t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}}_r.prototype.isEllipseCurve=!0;class ll extends _r{constructor(t,e,i,r,s,o){super(t,e,i,i,r,s,o),this.type="ArcCurve"}}ll.prototype.isArcCurve=!0;function Fs(){let n=0,t=0,e=0,i=0;function r(s,o,a,l){n=s,t=a,e=-3*s+3*o-2*a-l,i=2*s-2*o+a+l}return{initCatmullRom:function(s,o,a,l,c){r(o,a,c*(a-s),c*(l-o))},initNonuniformCatmullRom:function(s,o,a,l,c,u,h){let d=(o-s)/c-(a-s)/(c+u)+(a-o)/u,f=(a-o)/u-(l-o)/(u+h)+(l-a)/h;d*=u,f*=u,r(o,a,d,f)},calc:function(s){const o=s*s,a=o*s;return n+t*s+e*o+i*a}}}const Ji=new M,$r=new Fs,Kr=new Fs,ts=new Fs;class cl extends de{constructor(t=[],e=!1,i="centripetal",r=.5){super(),this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=i,this.tension=r}getPoint(t,e=new M){const i=e,r=this.points,s=r.length,o=(s-(this.closed?0:1))*t;let a=Math.floor(o),l=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/s)+1)*s:l===0&&a===s-1&&(a=s-2,l=1);let c,u;this.closed||a>0?c=r[(a-1)%s]:(Ji.subVectors(r[0],r[1]).add(r[0]),c=Ji);const h=r[a%s],d=r[(a+1)%s];if(this.closed||a+2<s?u=r[(a+2)%s]:(Ji.subVectors(r[s-1],r[s-2]).add(r[s-1]),u=Ji),this.curveType==="centripetal"||this.curveType==="chordal"){const f=this.curveType==="chordal"?.5:.25;let m=Math.pow(c.distanceToSquared(h),f),x=Math.pow(h.distanceToSquared(d),f),v=Math.pow(d.distanceToSquared(u),f);x<1e-4&&(x=1),m<1e-4&&(m=x),v<1e-4&&(v=x),$r.initNonuniformCatmullRom(c.x,h.x,d.x,u.x,m,x,v),Kr.initNonuniformCatmullRom(c.y,h.y,d.y,u.y,m,x,v),ts.initNonuniformCatmullRom(c.z,h.z,d.z,u.z,m,x,v)}else this.curveType==="catmullrom"&&($r.initCatmullRom(c.x,h.x,d.x,u.x,this.tension),Kr.initCatmullRom(c.y,h.y,d.y,u.y,this.tension),ts.initCatmullRom(c.z,h.z,d.z,u.z,this.tension));return i.set($r.calc(l),Kr.calc(l),ts.calc(l)),i}copy(t){super.copy(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){const r=t.points[e];this.points.push(r.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,i=this.points.length;e<i;e++){const r=this.points[e];t.points.push(r.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){const r=t.points[e];this.points.push(new M().fromArray(r))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}}cl.prototype.isCatmullRomCurve3=!0;function pa(n,t,e,i,r){const s=(i-t)*.5,o=(r-e)*.5,a=n*n,l=n*a;return(2*e-2*i+s+o)*l+(-3*e+3*i-2*s-o)*a+s*n+e}function ym(n,t){const e=1-n;return e*e*t}function _m(n,t){return 2*(1-n)*n*t}function bm(n,t){return n*n*t}function ai(n,t,e,i){return ym(n,t)+_m(n,e)+bm(n,i)}function Mm(n,t){const e=1-n;return e*e*e*t}function wm(n,t){const e=1-n;return 3*e*e*n*t}function Sm(n,t){return 3*(1-n)*n*n*t}function Em(n,t){return n*n*n*t}function li(n,t,e,i,r){return Mm(n,t)+wm(n,e)+Sm(n,i)+Em(n,r)}class Bs extends de{constructor(t=new Y,e=new Y,i=new Y,r=new Y){super(),this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=i,this.v3=r}getPoint(t,e=new Y){const i=e,r=this.v0,s=this.v1,o=this.v2,a=this.v3;return i.set(li(t,r.x,s.x,o.x,a.x),li(t,r.y,s.y,o.y,a.y)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}Bs.prototype.isCubicBezierCurve=!0;class hl extends de{constructor(t=new M,e=new M,i=new M,r=new M){super(),this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=i,this.v3=r}getPoint(t,e=new M){const i=e,r=this.v0,s=this.v1,o=this.v2,a=this.v3;return i.set(li(t,r.x,s.x,o.x,a.x),li(t,r.y,s.y,o.y,a.y),li(t,r.z,s.z,o.z,a.z)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}hl.prototype.isCubicBezierCurve3=!0;class br extends de{constructor(t=new Y,e=new Y){super(),this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new Y){const i=e;return t===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(t).add(this.v1)),i}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e){const i=e||new Y;return i.copy(this.v2).sub(this.v1).normalize(),i}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}br.prototype.isLineCurve=!0;class Tm extends de{constructor(t=new M,e=new M){super(),this.type="LineCurve3",this.isLineCurve3=!0,this.v1=t,this.v2=e}getPoint(t,e=new M){const i=e;return t===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(t).add(this.v1)),i}getPointAt(t,e){return this.getPoint(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Os extends de{constructor(t=new Y,e=new Y,i=new Y){super(),this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=i}getPoint(t,e=new Y){const i=e,r=this.v0,s=this.v1,o=this.v2;return i.set(ai(t,r.x,s.x,o.x),ai(t,r.y,s.y,o.y)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}Os.prototype.isQuadraticBezierCurve=!0;class ul extends de{constructor(t=new M,e=new M,i=new M){super(),this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=i}getPoint(t,e=new M){const i=e,r=this.v0,s=this.v1,o=this.v2;return i.set(ai(t,r.x,s.x,o.x),ai(t,r.y,s.y,o.y),ai(t,r.z,s.z,o.z)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}ul.prototype.isQuadraticBezierCurve3=!0;class zs extends de{constructor(t=[]){super(),this.type="SplineCurve",this.points=t}getPoint(t,e=new Y){const i=e,r=this.points,s=(r.length-1)*t,o=Math.floor(s),a=s-o,l=r[o===0?o:o-1],c=r[o],u=r[o>r.length-2?r.length-1:o+1],h=r[o>r.length-3?r.length-1:o+2];return i.set(pa(a,l.x,c.x,u.x,h.x),pa(a,l.y,c.y,u.y,h.y)),i}copy(t){super.copy(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){const r=t.points[e];this.points.push(r.clone())}return this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,i=this.points.length;e<i;e++){const r=this.points[e];t.points.push(r.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){const r=t.points[e];this.points.push(new Y().fromArray(r))}return this}}zs.prototype.isSplineCurve=!0;var Am=Object.freeze({__proto__:null,ArcCurve:ll,CatmullRomCurve3:cl,CubicBezierCurve:Bs,CubicBezierCurve3:hl,EllipseCurve:_r,LineCurve:br,LineCurve3:Tm,QuadraticBezierCurve:Os,QuadraticBezierCurve3:ul,SplineCurve:zs});class Lm extends de{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){const t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);t.equals(e)||this.curves.push(new br(e,t))}getPoint(t){const e=t*this.getLength(),i=this.getCurveLengths();let r=0;for(;r<i.length;){if(i[r]>=e){const s=i[r]-e,o=this.curves[r],a=o.getLength(),l=a===0?0:1-s/a;return o.getPointAt(l)}r++}return null}getLength(){const t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;const t=[];let e=0;for(let i=0,r=this.curves.length;i<r;i++)e+=this.curves[i].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){const e=[];for(let i=0;i<=t;i++)e.push(this.getPoint(i/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){const e=[];let i;for(let r=0,s=this.curves;r<s.length;r++){const o=s[r],a=o&&o.isEllipseCurve?t*2:o&&(o.isLineCurve||o.isLineCurve3)?1:o&&o.isSplineCurve?t*o.points.length:t,l=o.getPoints(a);for(let c=0;c<l.length;c++){const u=l[c];i&&i.equals(u)||(e.push(u),i=u)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,i=t.curves.length;e<i;e++){const r=t.curves[e];this.curves.push(r.clone())}return this.autoClose=t.autoClose,this}toJSON(){const t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,i=this.curves.length;e<i;e++){const r=this.curves[e];t.curves.push(r.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,i=t.curves.length;e<i;e++){const r=t.curves[e];this.curves.push(new Am[r.type]().fromJSON(r))}return this}}class ws extends Lm{constructor(t){super(),this.type="Path",this.currentPoint=new Y,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,i=t.length;e<i;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){const i=new br(this.currentPoint.clone(),new Y(t,e));return this.curves.push(i),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,i,r){const s=new Os(this.currentPoint.clone(),new Y(t,e),new Y(i,r));return this.curves.push(s),this.currentPoint.set(i,r),this}bezierCurveTo(t,e,i,r,s,o){const a=new Bs(this.currentPoint.clone(),new Y(t,e),new Y(i,r),new Y(s,o));return this.curves.push(a),this.currentPoint.set(s,o),this}splineThru(t){const e=[this.currentPoint.clone()].concat(t),i=new zs(e);return this.curves.push(i),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,i,r,s,o){const a=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(t+a,e+l,i,r,s,o),this}absarc(t,e,i,r,s,o){return this.absellipse(t,e,i,i,r,s,o),this}ellipse(t,e,i,r,s,o,a,l){const c=this.currentPoint.x,u=this.currentPoint.y;return this.absellipse(t+c,e+u,i,r,s,o,a,l),this}absellipse(t,e,i,r,s,o,a,l){const c=new _r(t,e,i,r,s,o,a,l);if(this.curves.length>0){const h=c.getPoint(0);h.equals(this.currentPoint)||this.lineTo(h.x,h.y)}this.curves.push(c);const u=c.getPoint(1);return this.currentPoint.copy(u),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){const t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}}class Us extends ws{constructor(t){super(t),this.uuid=bt.generateUUID(),this.type="Shape",this.holes=[]}getPointsHoles(t){const e=[];for(let i=0,r=this.holes.length;i<r;i++)e[i]=this.holes[i].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,i=t.holes.length;e<i;e++){const r=t.holes[e];this.holes.push(r.clone())}return this}toJSON(){const t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,i=this.holes.length;e<i;e++){const r=this.holes[e];t.holes.push(r.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,i=t.holes.length;e<i;e++){const r=t.holes[e];this.holes.push(new ws().fromJSON(r))}return this}}class Pe extends gt{constructor(t,e=1){super(),this.type="Light",this.color=new ht(t),this.intensity=e}copy(t){return super.copy(t),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){const e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),e}}Pe.prototype.isLight=!0;class Rm extends Pe{constructor(t,e,i){super(t,i),this.type="HemisphereLight",this.position.copy(gt.DefaultUp),this.updateMatrix(),this.groundColor=new ht(e)}copy(t){return Pe.prototype.copy.call(this,t),this.groundColor.copy(t.groundColor),this}}Rm.prototype.isHemisphereLight=!0;const ma=new ot,ga=new M,xa=new M;class Hs{constructor(t){this.camera=t,this.bias=0,this.normalBias=0,this.radius=1,this.mapSize=new Y(512,512),this.map=null,this.mapPass=null,this.matrix=new ot,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new xr,this._frameExtents=new Y(1,1),this._viewportCount=1,this._viewports=[new Bt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){const e=this.camera,i=this.matrix;ga.setFromMatrixPosition(t.matrixWorld),e.position.copy(ga),xa.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(xa),e.updateMatrixWorld(),ma.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(ma),i.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),i.multiply(e.projectionMatrix),i.multiply(e.matrixWorldInverse)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}copy(t){return this.camera=t.camera.clone(),this.bias=t.bias,this.radius=t.radius,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const t={};return this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}}class dl extends Hs{constructor(){super(new ue(50,1,.5,500)),this.focus=1}updateMatrices(t){const e=this.camera,i=bt.RAD2DEG*2*t.angle*this.focus,r=this.mapSize.width/this.mapSize.height,s=t.distance||e.far;(i!==e.fov||r!==e.aspect||s!==e.far)&&(e.fov=i,e.aspect=r,e.far=s,e.updateProjectionMatrix()),super.updateMatrices(t)}copy(t){return super.copy(t),this.focus=t.focus,this}}dl.prototype.isSpotLightShadow=!0;class Cm extends Pe{constructor(t,e,i=0,r=Math.PI/3,s=0,o=1){super(t,e),this.type="SpotLight",this.position.copy(gt.DefaultUp),this.updateMatrix(),this.target=new gt,this.distance=i,this.angle=r,this.penumbra=s,this.decay=o,this.shadow=new dl}get power(){return this.intensity*Math.PI}set power(t){this.intensity=t/Math.PI}copy(t){return super.copy(t),this.distance=t.distance,this.angle=t.angle,this.penumbra=t.penumbra,this.decay=t.decay,this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}}Cm.prototype.isSpotLight=!0;const va=new ot,$n=new M,es=new M;class fl extends Hs{constructor(){super(new ue(90,1,.5,500)),this._frameExtents=new Y(4,2),this._viewportCount=6,this._viewports=[new Bt(2,1,1,1),new Bt(0,1,1,1),new Bt(3,1,1,1),new Bt(1,1,1,1),new Bt(3,0,1,1),new Bt(1,0,1,1)],this._cubeDirections=[new M(1,0,0),new M(-1,0,0),new M(0,0,1),new M(0,0,-1),new M(0,1,0),new M(0,-1,0)],this._cubeUps=[new M(0,1,0),new M(0,1,0),new M(0,1,0),new M(0,1,0),new M(0,0,1),new M(0,0,-1)]}updateMatrices(t,e=0){const i=this.camera,r=this.matrix,s=t.distance||i.far;s!==i.far&&(i.far=s,i.updateProjectionMatrix()),$n.setFromMatrixPosition(t.matrixWorld),i.position.copy($n),es.copy(i.position),es.add(this._cubeDirections[e]),i.up.copy(this._cubeUps[e]),i.lookAt(es),i.updateMatrixWorld(),r.makeTranslation(-$n.x,-$n.y,-$n.z),va.multiplyMatrices(i.projectionMatrix,i.matrixWorldInverse),this._frustum.setFromProjectionMatrix(va)}}fl.prototype.isPointLightShadow=!0;class Pm extends Pe{constructor(t,e,i=0,r=1){super(t,e),this.type="PointLight",this.distance=i,this.decay=r,this.shadow=new fl}get power(){return this.intensity*4*Math.PI}set power(t){this.intensity=t/(4*Math.PI)}copy(t){return super.copy(t),this.distance=t.distance,this.decay=t.decay,this.shadow=t.shadow.clone(),this}}Pm.prototype.isPointLight=!0;class pl extends In{constructor(t=-1,e=1,i=1,r=-1,s=.1,o=2e3){super(),this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=i,this.bottom=r,this.near=s,this.far=o,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,i,r,s,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,r=(this.top+this.bottom)/2;let s=i-t,o=i+t,a=r+e,l=r-e;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,o=s+c*this.view.width,a-=u*this.view.offsetY,l=a-u*this.view.height}this.projectionMatrix.makeOrthographic(s,o,a,l,this.near,this.far),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=gt.prototype.toJSON.call(this,t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}}pl.prototype.isOrthographicCamera=!0;class ml extends Hs{constructor(){super(new pl(-5,5,5,-5,.5,500))}}ml.prototype.isDirectionalLightShadow=!0;class Dm extends Pe{constructor(t,e){super(t,e),this.type="DirectionalLight",this.position.copy(gt.DefaultUp),this.updateMatrix(),this.target=new gt,this.shadow=new ml}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}}Dm.prototype.isDirectionalLight=!0;class Im extends Pe{constructor(t,e){super(t,e),this.type="AmbientLight"}}Im.prototype.isAmbientLight=!0;class Nm extends Pe{constructor(t,e,i=10,r=10){super(t,e),this.type="RectAreaLight",this.width=i,this.height=r}copy(t){return super.copy(t),this.width=t.width,this.height=t.height,this}toJSON(t){const e=super.toJSON(t);return e.object.width=this.width,e.object.height=this.height,e}}Nm.prototype.isRectAreaLight=!0;class gl{constructor(){this.coefficients=[];for(let t=0;t<9;t++)this.coefficients.push(new M)}set(t){for(let e=0;e<9;e++)this.coefficients[e].copy(t[e]);return this}zero(){for(let t=0;t<9;t++)this.coefficients[t].set(0,0,0);return this}getAt(t,e){const i=t.x,r=t.y,s=t.z,o=this.coefficients;return e.copy(o[0]).multiplyScalar(.282095),e.addScaledVector(o[1],.488603*r),e.addScaledVector(o[2],.488603*s),e.addScaledVector(o[3],.488603*i),e.addScaledVector(o[4],1.092548*(i*r)),e.addScaledVector(o[5],1.092548*(r*s)),e.addScaledVector(o[6],.315392*(3*s*s-1)),e.addScaledVector(o[7],1.092548*(i*s)),e.addScaledVector(o[8],.546274*(i*i-r*r)),e}getIrradianceAt(t,e){const i=t.x,r=t.y,s=t.z,o=this.coefficients;return e.copy(o[0]).multiplyScalar(.886227),e.addScaledVector(o[1],2*.511664*r),e.addScaledVector(o[2],2*.511664*s),e.addScaledVector(o[3],2*.511664*i),e.addScaledVector(o[4],2*.429043*i*r),e.addScaledVector(o[5],2*.429043*r*s),e.addScaledVector(o[6],.743125*s*s-.247708),e.addScaledVector(o[7],2*.429043*i*s),e.addScaledVector(o[8],.429043*(i*i-r*r)),e}add(t){for(let e=0;e<9;e++)this.coefficients[e].add(t.coefficients[e]);return this}addScaledSH(t,e){for(let i=0;i<9;i++)this.coefficients[i].addScaledVector(t.coefficients[i],e);return this}scale(t){for(let e=0;e<9;e++)this.coefficients[e].multiplyScalar(t);return this}lerp(t,e){for(let i=0;i<9;i++)this.coefficients[i].lerp(t.coefficients[i],e);return this}equals(t){for(let e=0;e<9;e++)if(!this.coefficients[e].equals(t.coefficients[e]))return!1;return!0}copy(t){return this.set(t.coefficients)}clone(){return new this.constructor().copy(this)}fromArray(t,e=0){const i=this.coefficients;for(let r=0;r<9;r++)i[r].fromArray(t,e+r*3);return this}toArray(t=[],e=0){const i=this.coefficients;for(let r=0;r<9;r++)i[r].toArray(t,e+r*3);return t}static getBasisAt(t,e){const i=t.x,r=t.y,s=t.z;e[0]=.282095,e[1]=.488603*r,e[2]=.488603*s,e[3]=.488603*i,e[4]=1.092548*i*r,e[5]=1.092548*r*s,e[6]=.315392*(3*s*s-1),e[7]=1.092548*i*s,e[8]=.546274*(i*i-r*r)}}gl.prototype.isSphericalHarmonics3=!0;class Gs extends Pe{constructor(t=new gl,e=1){super(void 0,e),this.sh=t}copy(t){return super.copy(t),this.sh.copy(t.sh),this}fromJSON(t){return this.intensity=t.intensity,this.sh.fromArray(t.sh),this}toJSON(t){const e=super.toJSON(t);return e.object.sh=this.sh.toArray(),e}}Gs.prototype.isLightProbe=!0;const Fm={decodeText:function(n){if(typeof TextDecoder<"u")return new TextDecoder().decode(n);let t="";for(let e=0,i=n.length;e<i;e++)t+=String.fromCharCode(n[e]);try{return decodeURIComponent(escape(t))}catch{return t}},extractUrlBase:function(n){const t=n.lastIndexOf("/");return t===-1?"./":n.substr(0,t+1)}};function Ss(){Ct.call(this),this.type="InstancedBufferGeometry",this.instanceCount=1/0}Ss.prototype=Object.assign(Object.create(Ct.prototype),{constructor:Ss,isInstancedBufferGeometry:!0,copy:function(n){return Ct.prototype.copy.call(this,n),this.instanceCount=n.instanceCount,this},clone:function(){return new this.constructor().copy(this)},toJSON:function(){const n=Ct.prototype.toJSON.call(this);return n.instanceCount=this.instanceCount,n.isInstancedBufferGeometry=!0,n}});function ya(n,t,e,i){typeof e=="number"&&(i=e,e=!1),St.call(this,n,t,e),this.meshPerAttribute=i||1}ya.prototype=Object.assign(Object.create(St.prototype),{constructor:ya,isInstancedBufferAttribute:!0,copy:function(n){return St.prototype.copy.call(this,n),this.meshPerAttribute=n.meshPerAttribute,this},toJSON:function(){const n=St.prototype.toJSON.call(this);return n.meshPerAttribute=this.meshPerAttribute,n.isInstancedBufferAttribute=!0,n}});function _a(n){se.call(this,n),this.options={premultiplyAlpha:"none"}}_a.prototype=Object.assign(Object.create(se.prototype),{constructor:_a,isImageBitmapLoader:!0,setOptions:function(t){return this.options=t,this},load:function(n,t,e,i){n===void 0&&(n=""),this.path!==void 0&&(n=this.path+n),n=this.manager.resolveURL(n);const r=this,s=Fn.get(n);if(s!==void 0)return r.manager.itemStart(n),setTimeout(function(){t&&t(s),r.manager.itemEnd(n)},0),s;const o={};o.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",o.headers=this.requestHeader,fetch(n,o).then(function(a){return a.blob()}).then(function(a){return createImageBitmap(a,Object.assign(r.options,{colorSpaceConversion:"none"}))}).then(function(a){Fn.add(n,a),t&&t(a),r.manager.itemEnd(n)}).catch(function(a){i&&i(a),r.manager.itemError(n),r.manager.itemEnd(n)}),r.manager.itemStart(n)}});let Qi;const Bm={getContext:function(){return Qi===void 0&&(Qi=new(window.AudioContext||window.webkitAudioContext)),Qi},setContext:function(n){Qi=n}};class Om extends se{constructor(t){super(t)}load(t,e,i,r){const s=this,o=new vi(this.manager);o.setResponseType("arraybuffer"),o.setPath(this.path),o.setRequestHeader(this.requestHeader),o.setWithCredentials(this.withCredentials),o.load(t,function(a){try{const l=a.slice(0);Bm.getContext().decodeAudioData(l,function(u){e(u)})}catch(l){r&&r(l),s.manager.itemError(t)}},i,r)}}class zm extends Gs{constructor(t,e,i=1){super(void 0,i);const r=new ht().set(t),s=new ht().set(e),o=new M(r.r,r.g,r.b),a=new M(s.r,s.g,s.b),l=Math.sqrt(Math.PI),c=l*Math.sqrt(.75);this.sh.coefficients[0].copy(o).add(a).multiplyScalar(l),this.sh.coefficients[1].copy(o).sub(a).multiplyScalar(c)}}zm.prototype.isHemisphereLightProbe=!0;class Um extends Gs{constructor(t,e=1){super(void 0,e);const i=new ht().set(t);this.sh.coefficients[0].set(i.r,i.g,i.b).multiplyScalar(2*Math.sqrt(Math.PI))}}Um.prototype.isAmbientLightProbe=!0;new ot;new ot;class sg{constructor(t){this.autoStart=t!==void 0?t:!0,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1}start(){this.startTime=ba(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let t=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){const e=ba();t=(e-this.oldTime)/1e3,this.oldTime=e,this.elapsedTime+=t}return t}}function ba(){return(typeof performance>"u"?Date:performance).now()}class Hm extends gt{constructor(t){super(),this.type="Audio",this.listener=t,this.context=t.context,this.gain=this.context.createGain(),this.gain.connect(t.getInput()),this.autoplay=!1,this.buffer=null,this.detune=0,this.loop=!1,this.loopStart=0,this.loopEnd=0,this.offset=0,this.duration=void 0,this.playbackRate=1,this.isPlaying=!1,this.hasPlaybackControl=!0,this.source=null,this.sourceType="empty",this._startedAt=0,this._progress=0,this._connected=!1,this.filters=[]}getOutput(){return this.gain}setNodeSource(t){return this.hasPlaybackControl=!1,this.sourceType="audioNode",this.source=t,this.connect(),this}setMediaElementSource(t){return this.hasPlaybackControl=!1,this.sourceType="mediaNode",this.source=this.context.createMediaElementSource(t),this.connect(),this}setMediaStreamSource(t){return this.hasPlaybackControl=!1,this.sourceType="mediaStreamNode",this.source=this.context.createMediaStreamSource(t),this.connect(),this}setBuffer(t){return this.buffer=t,this.sourceType="buffer",this.autoplay&&this.play(),this}play(t=0){if(this.isPlaying===!0||this.hasPlaybackControl===!1)return;this._startedAt=this.context.currentTime+t;const e=this.context.createBufferSource();return e.buffer=this.buffer,e.loop=this.loop,e.loopStart=this.loopStart,e.loopEnd=this.loopEnd,e.onended=this.onEnded.bind(this),e.start(this._startedAt,this._progress+this.offset,this.duration),this.isPlaying=!0,this.source=e,this.setDetune(this.detune),this.setPlaybackRate(this.playbackRate),this.connect()}pause(){if(this.hasPlaybackControl!==!1)return this.isPlaying===!0&&(this._progress+=Math.max(this.context.currentTime-this._startedAt,0)*this.playbackRate,this.loop===!0&&(this._progress=this._progress%(this.duration||this.buffer.duration)),this.source.stop(),this.source.onended=null,this.isPlaying=!1),this}stop(){if(this.hasPlaybackControl!==!1)return this._progress=0,this.source.stop(),this.source.onended=null,this.isPlaying=!1,this}connect(){if(this.filters.length>0){this.source.connect(this.filters[0]);for(let t=1,e=this.filters.length;t<e;t++)this.filters[t-1].connect(this.filters[t]);this.filters[this.filters.length-1].connect(this.getOutput())}else this.source.connect(this.getOutput());return this._connected=!0,this}disconnect(){if(this.filters.length>0){this.source.disconnect(this.filters[0]);for(let t=1,e=this.filters.length;t<e;t++)this.filters[t-1].disconnect(this.filters[t]);this.filters[this.filters.length-1].disconnect(this.getOutput())}else this.source.disconnect(this.getOutput());return this._connected=!1,this}getFilters(){return this.filters}setFilters(t){return t||(t=[]),this._connected===!0?(this.disconnect(),this.filters=t.slice(),this.connect()):this.filters=t.slice(),this}setDetune(t){if(this.detune=t,this.source.detune!==void 0)return this.isPlaying===!0&&this.source.detune.setTargetAtTime(this.detune,this.context.currentTime,.01),this}getDetune(){return this.detune}getFilter(){return this.getFilters()[0]}setFilter(t){return this.setFilters(t?[t]:[])}setPlaybackRate(t){if(this.hasPlaybackControl!==!1)return this.playbackRate=t,this.isPlaying===!0&&this.source.playbackRate.setTargetAtTime(this.playbackRate,this.context.currentTime,.01),this}getPlaybackRate(){return this.playbackRate}onEnded(){this.isPlaying=!1}getLoop(){return this.hasPlaybackControl===!1?!1:this.loop}setLoop(t){if(this.hasPlaybackControl!==!1)return this.loop=t,this.isPlaying===!0&&(this.source.loop=this.loop),this}setLoopStart(t){return this.loopStart=t,this}setLoopEnd(t){return this.loopEnd=t,this}getVolume(){return this.gain.gain.value}setVolume(t){return this.gain.gain.setTargetAtTime(t,this.context.currentTime,.01),this}}class Gm{constructor(t,e,i){this.binding=t,this.valueSize=i;let r,s,o;switch(e){case"quaternion":r=this._slerp,s=this._slerpAdditive,o=this._setAdditiveIdentityQuaternion,this.buffer=new Float64Array(i*6),this._workIndex=5;break;case"string":case"bool":r=this._select,s=this._select,o=this._setAdditiveIdentityOther,this.buffer=new Array(i*5);break;default:r=this._lerp,s=this._lerpAdditive,o=this._setAdditiveIdentityNumeric,this.buffer=new Float64Array(i*5)}this._mixBufferRegion=r,this._mixBufferRegionAdditive=s,this._setIdentity=o,this._origIndex=3,this._addIndex=4,this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,this.useCount=0,this.referenceCount=0}accumulate(t,e){const i=this.buffer,r=this.valueSize,s=t*r+r;let o=this.cumulativeWeight;if(o===0){for(let a=0;a!==r;++a)i[s+a]=i[a];o=e}else{o+=e;const a=e/o;this._mixBufferRegion(i,s,0,a,r)}this.cumulativeWeight=o}accumulateAdditive(t){const e=this.buffer,i=this.valueSize,r=i*this._addIndex;this.cumulativeWeightAdditive===0&&this._setIdentity(),this._mixBufferRegionAdditive(e,r,0,t,i),this.cumulativeWeightAdditive+=t}apply(t){const e=this.valueSize,i=this.buffer,r=t*e+e,s=this.cumulativeWeight,o=this.cumulativeWeightAdditive,a=this.binding;if(this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,s<1){const l=e*this._origIndex;this._mixBufferRegion(i,r,l,1-s,e)}o>0&&this._mixBufferRegionAdditive(i,r,this._addIndex*e,1,e);for(let l=e,c=e+e;l!==c;++l)if(i[l]!==i[l+e]){a.setValue(i,r);break}}saveOriginalState(){const t=this.binding,e=this.buffer,i=this.valueSize,r=i*this._origIndex;t.getValue(e,r);for(let s=i,o=r;s!==o;++s)e[s]=e[r+s%i];this._setIdentity(),this.cumulativeWeight=0,this.cumulativeWeightAdditive=0}restoreOriginalState(){const t=this.valueSize*3;this.binding.setValue(this.buffer,t)}_setAdditiveIdentityNumeric(){const t=this._addIndex*this.valueSize,e=t+this.valueSize;for(let i=t;i<e;i++)this.buffer[i]=0}_setAdditiveIdentityQuaternion(){this._setAdditiveIdentityNumeric(),this.buffer[this._addIndex*this.valueSize+3]=1}_setAdditiveIdentityOther(){const t=this._origIndex*this.valueSize,e=this._addIndex*this.valueSize;for(let i=0;i<this.valueSize;i++)this.buffer[e+i]=this.buffer[t+i]}_select(t,e,i,r,s){if(r>=.5)for(let o=0;o!==s;++o)t[e+o]=t[i+o]}_slerp(t,e,i,r){le.slerpFlat(t,e,t,e,t,i,r)}_slerpAdditive(t,e,i,r,s){const o=this._workIndex*s;le.multiplyQuaternionsFlat(t,o,t,e,t,i),le.slerpFlat(t,e,t,e,t,o,r)}_lerp(t,e,i,r,s){const o=1-r;for(let a=0;a!==s;++a){const l=e+a;t[l]=t[l]*o+t[i+a]*r}}_lerpAdditive(t,e,i,r,s){for(let o=0;o!==s;++o){const a=e+o;t[a]=t[a]+t[i+o]*r}}}const ks="\\[\\]\\.:\\/",km=new RegExp("["+ks+"]","g"),Vs="[^"+ks+"]",Vm="[^"+ks.replace("\\.","")+"]",Wm=/((?:WC+[\/:])*)/.source.replace("WC",Vs),qm=/(WCOD+)?/.source.replace("WCOD",Vm),Xm=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Vs),jm=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Vs),Ym=new RegExp("^"+Wm+qm+Xm+jm+"$"),Zm=["material","materials","bones"];function xl(n,t,e){const i=e||ve.parseTrackName(t);this._targetGroup=n,this._bindings=n.subscribe_(t,i)}Object.assign(xl.prototype,{getValue:function(n,t){this.bind();const e=this._targetGroup.nCachedObjects_,i=this._bindings[e];i!==void 0&&i.getValue(n,t)},setValue:function(n,t){const e=this._bindings;for(let i=this._targetGroup.nCachedObjects_,r=e.length;i!==r;++i)e[i].setValue(n,t)},bind:function(){const n=this._bindings;for(let t=this._targetGroup.nCachedObjects_,e=n.length;t!==e;++t)n[t].bind()},unbind:function(){const n=this._bindings;for(let t=this._targetGroup.nCachedObjects_,e=n.length;t!==e;++t)n[t].unbind()}});function ve(n,t,e){this.path=t,this.parsedPath=e||ve.parseTrackName(t),this.node=ve.findNode(n,this.parsedPath.nodeName)||n,this.rootNode=n}Object.assign(ve,{Composite:xl,create:function(n,t,e){return n&&n.isAnimationObjectGroup?new ve.Composite(n,t,e):new ve(n,t,e)},sanitizeNodeName:function(n){return n.replace(/\s/g,"_").replace(km,"")},parseTrackName:function(n){const t=Ym.exec(n);if(!t)throw new Error("PropertyBinding: Cannot parse trackName: "+n);const e={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},i=e.nodeName&&e.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){const r=e.nodeName.substring(i+1);Zm.indexOf(r)!==-1&&(e.nodeName=e.nodeName.substring(0,i),e.objectName=r)}if(e.propertyName===null||e.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+n);return e},findNode:function(n,t){if(!t||t===""||t==="."||t===-1||t===n.name||t===n.uuid)return n;if(n.skeleton){const e=n.skeleton.getBoneByName(t);if(e!==void 0)return e}if(n.children){const e=function(r){for(let s=0;s<r.length;s++){const o=r[s];if(o.name===t||o.uuid===t)return o;const a=e(o.children);if(a)return a}return null},i=e(n.children);if(i)return i}return null}});Object.assign(ve.prototype,{_getValue_unavailable:function(){},_setValue_unavailable:function(){},BindingType:{Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3},Versioning:{None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2},GetterByBindingType:[function(t,e){t[e]=this.node[this.propertyName]},function(t,e){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)t[e++]=i[r]},function(t,e){t[e]=this.resolvedProperty[this.propertyIndex]},function(t,e){this.resolvedProperty.toArray(t,e)}],SetterByBindingTypeAndVersioning:[[function(t,e){this.targetObject[this.propertyName]=t[e]},function(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.needsUpdate=!0},function(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}],[function(t,e){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=t[e++]},function(t,e){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=t[e++];this.targetObject.needsUpdate=!0},function(t,e){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=t[e++];this.targetObject.matrixWorldNeedsUpdate=!0}],[function(t,e){this.resolvedProperty[this.propertyIndex]=t[e]},function(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.needsUpdate=!0},function(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}],[function(t,e){this.resolvedProperty.fromArray(t,e)},function(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.needsUpdate=!0},function(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.matrixWorldNeedsUpdate=!0}]],getValue:function(t,e){this.bind(),this.getValue(t,e)},setValue:function(t,e){this.bind(),this.setValue(t,e)},bind:function(){let n=this.node;const t=this.parsedPath,e=t.objectName,i=t.propertyName;let r=t.propertyIndex;if(n||(n=ve.findNode(this.rootNode,t.nodeName)||this.rootNode,this.node=n),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!n)return;if(e){let l=t.objectIndex;switch(e){case"materials":if(!n.material||!n.material.materials)return;n=n.material.materials;break;case"bones":if(!n.skeleton)return;n=n.skeleton.bones;for(let c=0;c<n.length;c++)if(n[c].name===l){l=c;break}break;default:if(n[e]===void 0)return;n=n[e]}if(l!==void 0){if(n[l]===void 0)return;n=n[l]}}const s=n[i];if(s===void 0){const l=t.nodeName;return}let o=this.Versioning.None;this.targetObject=n,n.needsUpdate!==void 0?o=this.Versioning.NeedsUpdate:n.matrixWorldNeedsUpdate!==void 0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let a=this.BindingType.Direct;if(r!==void 0){if(i==="morphTargetInfluences"){if(!n.geometry)return;if(n.geometry.isBufferGeometry){if(!n.geometry.morphAttributes)return;n.morphTargetDictionary[r]!==void 0&&(r=n.morphTargetDictionary[r])}else return}a=this.BindingType.ArrayElement,this.resolvedProperty=s,this.propertyIndex=r}else s.fromArray!==void 0&&s.toArray!==void 0?(a=this.BindingType.HasFromToArray,this.resolvedProperty=s):Array.isArray(s)?(a=this.BindingType.EntireArray,this.resolvedProperty=s):this.propertyName=i;this.getValue=this.GetterByBindingType[a],this.setValue=this.SetterByBindingTypeAndVersioning[a][o]},unbind:function(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}});Object.assign(ve.prototype,{_getValue_unbound:ve.prototype.getValue,_setValue_unbound:ve.prototype.setValue});class Jm{constructor(t,e,i=null,r=e.blendMode){this._mixer=t,this._clip=e,this._localRoot=i,this.blendMode=r;const s=e.tracks,o=s.length,a=new Array(o),l={endingStart:Ln,endingEnd:Ln};for(let c=0;c!==o;++c){const u=s[c].createInterpolant(null);a[c]=u,u.settings=l}this._interpolantSettings=l,this._interpolants=a,this._propertyBindings=new Array(o),this._cacheIndex=null,this._byClipCacheIndex=null,this._timeScaleInterpolant=null,this._weightInterpolant=null,this.loop=jc,this._loopCount=-1,this._startTime=null,this.time=0,this.timeScale=1,this._effectiveTimeScale=1,this.weight=1,this._effectiveWeight=1,this.repetitions=1/0,this.paused=!1,this.enabled=!0,this.clampWhenFinished=!1,this.zeroSlopeAtStart=!0,this.zeroSlopeAtEnd=!0}play(){return this._mixer._activateAction(this),this}stop(){return this._mixer._deactivateAction(this),this.reset()}reset(){return this.paused=!1,this.enabled=!0,this.time=0,this._loopCount=-1,this._startTime=null,this.stopFading().stopWarping()}isRunning(){return this.enabled&&!this.paused&&this.timeScale!==0&&this._startTime===null&&this._mixer._isActiveAction(this)}isScheduled(){return this._mixer._isActiveAction(this)}startAt(t){return this._startTime=t,this}setLoop(t,e){return this.loop=t,this.repetitions=e,this}setEffectiveWeight(t){return this.weight=t,this._effectiveWeight=this.enabled?t:0,this.stopFading()}getEffectiveWeight(){return this._effectiveWeight}fadeIn(t){return this._scheduleFading(t,0,1)}fadeOut(t){return this._scheduleFading(t,1,0)}crossFadeFrom(t,e,i){if(t.fadeOut(e),this.fadeIn(e),i){const r=this._clip.duration,s=t._clip.duration,o=s/r,a=r/s;t.warp(1,o,e),this.warp(a,1,e)}return this}crossFadeTo(t,e,i){return t.crossFadeFrom(this,e,i)}stopFading(){const t=this._weightInterpolant;return t!==null&&(this._weightInterpolant=null,this._mixer._takeBackControlInterpolant(t)),this}setEffectiveTimeScale(t){return this.timeScale=t,this._effectiveTimeScale=this.paused?0:t,this.stopWarping()}getEffectiveTimeScale(){return this._effectiveTimeScale}setDuration(t){return this.timeScale=this._clip.duration/t,this.stopWarping()}syncWith(t){return this.time=t.time,this.timeScale=t.timeScale,this.stopWarping()}halt(t){return this.warp(this._effectiveTimeScale,0,t)}warp(t,e,i){const r=this._mixer,s=r.time,o=this.timeScale;let a=this._timeScaleInterpolant;a===null&&(a=r._lendControlInterpolant(),this._timeScaleInterpolant=a);const l=a.parameterPositions,c=a.sampleValues;return l[0]=s,l[1]=s+i,c[0]=t/o,c[1]=e/o,this}stopWarping(){const t=this._timeScaleInterpolant;return t!==null&&(this._timeScaleInterpolant=null,this._mixer._takeBackControlInterpolant(t)),this}getMixer(){return this._mixer}getClip(){return this._clip}getRoot(){return this._localRoot||this._mixer._root}_update(t,e,i,r){if(!this.enabled){this._updateWeight(t);return}const s=this._startTime;if(s!==null){const l=(t-s)*i;if(l<0||i===0)return;this._startTime=null,e=i*l}e*=this._updateTimeScale(t);const o=this._updateTime(e),a=this._updateWeight(t);if(a>0){const l=this._interpolants,c=this._propertyBindings;switch(this.blendMode){case Ca:for(let u=0,h=l.length;u!==h;++u)l[u].evaluate(o),c[u].accumulateAdditive(a);break;case Ps:default:for(let u=0,h=l.length;u!==h;++u)l[u].evaluate(o),c[u].accumulate(r,a)}}}_updateWeight(t){let e=0;if(this.enabled){e=this.weight;const i=this._weightInterpolant;if(i!==null){const r=i.evaluate(t)[0];e*=r,t>i.parameterPositions[1]&&(this.stopFading(),r===0&&(this.enabled=!1))}}return this._effectiveWeight=e,e}_updateTimeScale(t){let e=0;if(!this.paused){e=this.timeScale;const i=this._timeScaleInterpolant;if(i!==null){const r=i.evaluate(t)[0];e*=r,t>i.parameterPositions[1]&&(this.stopWarping(),e===0?this.paused=!0:this.timeScale=e)}}return this._effectiveTimeScale=e,e}_updateTime(t){const e=this._clip.duration,i=this.loop;let r=this.time+t,s=this._loopCount;const o=i===Yc;if(t===0)return s===-1?r:o&&(s&1)===1?e-r:r;if(i===Xc){s===-1&&(this._loopCount=0,this._setEndings(!0,!0,!1));t:{if(r>=e)r=e;else if(r<0)r=0;else{this.time=r;break t}this.clampWhenFinished?this.paused=!0:this.enabled=!1,this.time=r,this._mixer.dispatchEvent({type:"finished",action:this,direction:t<0?-1:1})}}else{if(s===-1&&(t>=0?(s=0,this._setEndings(!0,this.repetitions===0,o)):this._setEndings(this.repetitions===0,!0,o)),r>=e||r<0){const a=Math.floor(r/e);r-=e*a,s+=Math.abs(a);const l=this.repetitions-s;if(l<=0)this.clampWhenFinished?this.paused=!0:this.enabled=!1,r=t>0?e:0,this.time=r,this._mixer.dispatchEvent({type:"finished",action:this,direction:t>0?1:-1});else{if(l===1){const c=t<0;this._setEndings(c,!c,o)}else this._setEndings(!1,!1,o);this._loopCount=s,this.time=r,this._mixer.dispatchEvent({type:"loop",action:this,loopDelta:a})}}else this.time=r;if(o&&(s&1)===1)return e-r}return r}_setEndings(t,e,i){const r=this._interpolantSettings;i?(r.endingStart=Rn,r.endingEnd=Rn):(t?r.endingStart=this.zeroSlopeAtStart?Rn:Ln:r.endingStart=rr,e?r.endingEnd=this.zeroSlopeAtEnd?Rn:Ln:r.endingEnd=rr)}_scheduleFading(t,e,i){const r=this._mixer,s=r.time;let o=this._weightInterpolant;o===null&&(o=r._lendControlInterpolant(),this._weightInterpolant=o);const a=o.parameterPositions,l=o.sampleValues;return a[0]=s,l[0]=e,a[1]=s+t,l[1]=i,this}}class Qm extends $e{constructor(t){super(),this._root=t,this._initMemoryManager(),this._accuIndex=0,this.time=0,this.timeScale=1}_bindAction(t,e){const i=t._localRoot||this._root,r=t._clip.tracks,s=r.length,o=t._propertyBindings,a=t._interpolants,l=i.uuid,c=this._bindingsByRootAndName;let u=c[l];u===void 0&&(u={},c[l]=u);for(let h=0;h!==s;++h){const d=r[h],f=d.name;let m=u[f];if(m!==void 0)o[h]=m;else{if(m=o[h],m!==void 0){m._cacheIndex===null&&(++m.referenceCount,this._addInactiveBinding(m,l,f));continue}const x=e&&e._propertyBindings[h].binding.parsedPath;m=new Gm(ve.create(i,f,x),d.ValueTypeName,d.getValueSize()),++m.referenceCount,this._addInactiveBinding(m,l,f),o[h]=m}a[h].resultBuffer=m.buffer}}_activateAction(t){if(!this._isActiveAction(t)){if(t._cacheIndex===null){const i=(t._localRoot||this._root).uuid,r=t._clip.uuid,s=this._actionsByClip[r];this._bindAction(t,s&&s.knownActions[0]),this._addInactiveAction(t,r,i)}const e=t._propertyBindings;for(let i=0,r=e.length;i!==r;++i){const s=e[i];s.useCount++===0&&(this._lendBinding(s),s.saveOriginalState())}this._lendAction(t)}}_deactivateAction(t){if(this._isActiveAction(t)){const e=t._propertyBindings;for(let i=0,r=e.length;i!==r;++i){const s=e[i];--s.useCount===0&&(s.restoreOriginalState(),this._takeBackBinding(s))}this._takeBackAction(t)}}_initMemoryManager(){this._actions=[],this._nActiveActions=0,this._actionsByClip={},this._bindings=[],this._nActiveBindings=0,this._bindingsByRootAndName={},this._controlInterpolants=[],this._nActiveControlInterpolants=0;const t=this;this.stats={actions:{get total(){return t._actions.length},get inUse(){return t._nActiveActions}},bindings:{get total(){return t._bindings.length},get inUse(){return t._nActiveBindings}},controlInterpolants:{get total(){return t._controlInterpolants.length},get inUse(){return t._nActiveControlInterpolants}}}}_isActiveAction(t){const e=t._cacheIndex;return e!==null&&e<this._nActiveActions}_addInactiveAction(t,e,i){const r=this._actions,s=this._actionsByClip;let o=s[e];if(o===void 0)o={knownActions:[t],actionByRoot:{}},t._byClipCacheIndex=0,s[e]=o;else{const a=o.knownActions;t._byClipCacheIndex=a.length,a.push(t)}t._cacheIndex=r.length,r.push(t),o.actionByRoot[i]=t}_removeInactiveAction(t){const e=this._actions,i=e[e.length-1],r=t._cacheIndex;i._cacheIndex=r,e[r]=i,e.pop(),t._cacheIndex=null;const s=t._clip.uuid,o=this._actionsByClip,a=o[s],l=a.knownActions,c=l[l.length-1],u=t._byClipCacheIndex;c._byClipCacheIndex=u,l[u]=c,l.pop(),t._byClipCacheIndex=null;const h=a.actionByRoot,d=(t._localRoot||this._root).uuid;delete h[d],l.length===0&&delete o[s],this._removeInactiveBindingsForAction(t)}_removeInactiveBindingsForAction(t){const e=t._propertyBindings;for(let i=0,r=e.length;i!==r;++i){const s=e[i];--s.referenceCount===0&&this._removeInactiveBinding(s)}}_lendAction(t){const e=this._actions,i=t._cacheIndex,r=this._nActiveActions++,s=e[r];t._cacheIndex=r,e[r]=t,s._cacheIndex=i,e[i]=s}_takeBackAction(t){const e=this._actions,i=t._cacheIndex,r=--this._nActiveActions,s=e[r];t._cacheIndex=r,e[r]=t,s._cacheIndex=i,e[i]=s}_addInactiveBinding(t,e,i){const r=this._bindingsByRootAndName,s=this._bindings;let o=r[e];o===void 0&&(o={},r[e]=o),o[i]=t,t._cacheIndex=s.length,s.push(t)}_removeInactiveBinding(t){const e=this._bindings,i=t.binding,r=i.rootNode.uuid,s=i.path,o=this._bindingsByRootAndName,a=o[r],l=e[e.length-1],c=t._cacheIndex;l._cacheIndex=c,e[c]=l,e.pop(),delete a[s],Object.keys(a).length===0&&delete o[r]}_lendBinding(t){const e=this._bindings,i=t._cacheIndex,r=this._nActiveBindings++,s=e[r];t._cacheIndex=r,e[r]=t,s._cacheIndex=i,e[i]=s}_takeBackBinding(t){const e=this._bindings,i=t._cacheIndex,r=--this._nActiveBindings,s=e[r];t._cacheIndex=r,e[r]=t,s._cacheIndex=i,e[i]=s}_lendControlInterpolant(){const t=this._controlInterpolants,e=this._nActiveControlInterpolants++;let i=t[e];return i===void 0&&(i=new ar(new Float32Array(2),new Float32Array(2),1,this._controlInterpolantsResultBuffer),i.__cacheIndex=e,t[e]=i),i}_takeBackControlInterpolant(t){const e=this._controlInterpolants,i=t.__cacheIndex,r=--this._nActiveControlInterpolants,s=e[r];t.__cacheIndex=r,e[r]=t,s.__cacheIndex=i,e[i]=s}clipAction(t,e,i){const r=e||this._root,s=r.uuid;let o=typeof t=="string"?ua.findByName(r,t):t;const a=o!==null?o.uuid:t,l=this._actionsByClip[a];let c=null;if(i===void 0&&(o!==null?i=o.blendMode:i=Ps),l!==void 0){const h=l.actionByRoot[s];if(h!==void 0&&h.blendMode===i)return h;c=l.knownActions[0],o===null&&(o=c._clip)}if(o===null)return null;const u=new Jm(this,o,e,i);return this._bindAction(u,c),this._addInactiveAction(u,a,s),u}existingAction(t,e){const i=e||this._root,r=i.uuid,s=typeof t=="string"?ua.findByName(i,t):t,o=s?s.uuid:t,a=this._actionsByClip[o];return a!==void 0&&a.actionByRoot[r]||null}stopAllAction(){const t=this._actions,e=this._nActiveActions;for(let i=e-1;i>=0;--i)t[i].stop();return this}update(t){t*=this.timeScale;const e=this._actions,i=this._nActiveActions,r=this.time+=t,s=Math.sign(t),o=this._accuIndex^=1;for(let c=0;c!==i;++c)e[c]._update(r,t,s,o);const a=this._bindings,l=this._nActiveBindings;for(let c=0;c!==l;++c)a[c].apply(o);return this}setTime(t){this.time=0;for(let e=0;e<this._actions.length;e++)this._actions[e].time=0;return this.update(t)}getRoot(){return this._root}uncacheClip(t){const e=this._actions,i=t.uuid,r=this._actionsByClip,s=r[i];if(s!==void 0){const o=s.knownActions;for(let a=0,l=o.length;a!==l;++a){const c=o[a];this._deactivateAction(c);const u=c._cacheIndex,h=e[e.length-1];c._cacheIndex=null,c._byClipCacheIndex=null,h._cacheIndex=u,e[u]=h,e.pop(),this._removeInactiveBindingsForAction(c)}delete r[i]}}uncacheRoot(t){const e=t.uuid,i=this._actionsByClip;for(const o in i){const a=i[o].actionByRoot,l=a[e];l!==void 0&&(this._deactivateAction(l),this._removeInactiveAction(l))}const r=this._bindingsByRootAndName,s=r[e];if(s!==void 0)for(const o in s){const a=s[o];a.restoreOriginalState(),this._removeInactiveBinding(a)}}uncacheAction(t,e){const i=this.existingAction(t,e);i!==null&&(this._deactivateAction(i),this._removeInactiveAction(i))}}Qm.prototype._controlInterpolantsResultBuffer=new Float32Array(1);function Ma(n,t,e){ge.call(this,n,t),this.meshPerAttribute=e||1}Ma.prototype=Object.assign(Object.create(ge.prototype),{constructor:Ma,isInstancedInterleavedBuffer:!0,copy:function(n){return ge.prototype.copy.call(this,n),this.meshPerAttribute=n.meshPerAttribute,this},clone:function(n){const t=ge.prototype.clone.call(this,n);return t.meshPerAttribute=this.meshPerAttribute,t},toJSON:function(n){const t=ge.prototype.toJSON.call(this,n);return t.isInstancedInterleavedBuffer=!0,t.meshPerAttribute=this.meshPerAttribute,t}});function vl(n,t,e,i,r){this.buffer=n,this.type=t,this.itemSize=e,this.elementSize=i,this.count=r,this.version=0}Object.defineProperty(vl.prototype,"needsUpdate",{set:function(n){n===!0&&this.version++}});Object.assign(vl.prototype,{isGLBufferAttribute:!0,setBuffer:function(n){return this.buffer=n,this},setType:function(n,t){return this.type=n,this.elementSize=t,this},setItemSize:function(n){return this.itemSize=n,this},setCount:function(n){return this.count=n,this}});function yl(n,t,e=0,i=1/0){this.ray=new cn(n,t),this.near=e,this.far=i,this.camera=null,this.layers=new Da,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}},Object.defineProperties(this.params,{PointCloud:{get:function(){return this.Points}}})}function wa(n,t){return n.distance-t.distance}function Es(n,t,e,i){if(n.layers.test(t.layers)&&n.raycast(t,e),i===!0){const r=n.children;for(let s=0,o=r.length;s<o;s++)Es(r[s],t,e,!0)}}Object.assign(yl.prototype,{set:function(n,t){this.ray.set(n,t)},setFromCamera:function(n,t){t&&t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(n.x,n.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t&&t.isOrthographicCamera&&(this.ray.origin.set(n.x,n.y,(t.near+t.far)/(t.near-t.far)).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t)},intersectObject:function(n,t=!1,e=[]){return Es(n,this,e,t),e.sort(wa),e},intersectObjects:function(n,t=!1,e=[]){for(let i=0,r=n.length;i<r;i++)Es(n[i],this,e,t);return e.sort(wa),e}});function hr(n){gt.call(this),this.material=n,this.render=function(){},this.hasPositions=!1,this.hasNormals=!1,this.hasColors=!1,this.hasUvs=!1,this.positionArray=null,this.normalArray=null,this.colorArray=null,this.uvArray=null,this.count=0}hr.prototype=Object.create(gt.prototype);hr.prototype.constructor=hr;hr.prototype.isImmediateRenderObject=!0;const je=new M,$i=new ot,ns=new ot;class $m extends or{constructor(t){const e=_l(t),i=new Ct,r=[],s=[],o=new ht(0,0,1),a=new ht(0,1,0);for(let c=0;c<e.length;c++){const u=e[c];u.parent&&u.parent.isBone&&(r.push(0,0,0),r.push(0,0,0),s.push(o.r,o.g,o.b),s.push(a.r,a.g,a.b))}i.setAttribute("position",new zt(r,3)),i.setAttribute("color",new zt(s,3));const l=new bi({vertexColors:!0,depthTest:!1,depthWrite:!1,toneMapped:!1,transparent:!0});super(i,l),this.type="SkeletonHelper",this.isSkeletonHelper=!0,this.root=t,this.bones=e,this.matrix=t.matrixWorld,this.matrixAutoUpdate=!1}updateMatrixWorld(t){const e=this.bones,i=this.geometry,r=i.getAttribute("position");ns.copy(this.root.matrixWorld).invert();for(let s=0,o=0;s<e.length;s++){const a=e[s];a.parent&&a.parent.isBone&&($i.multiplyMatrices(ns,a.matrixWorld),je.setFromMatrixPosition($i),r.setXYZ(o,je.x,je.y,je.z),$i.multiplyMatrices(ns,a.parent.matrixWorld),je.setFromMatrixPosition($i),r.setXYZ(o+1,je.x,je.y,je.z),o+=2)}i.getAttribute("position").needsUpdate=!0,super.updateMatrixWorld(t)}}function _l(n){const t=[];n&&n.isBone&&t.push(n);for(let e=0;e<n.children.length;e++)t.push.apply(t,_l(n.children[e]));return t}class og extends $t{constructor(t,e,i){const r=new sm(e,4,2),s=new mr({wireframe:!0,fog:!1,toneMapped:!1});super(r,s),this.light=t,this.light.updateMatrixWorld(),this.color=i,this.type="PointLightHelper",this.matrix=this.light.matrixWorld,this.matrixAutoUpdate=!1,this.update()}dispose(){this.geometry.dispose(),this.material.dispose()}update(){this.color!==void 0?this.material.color.set(this.color):this.material.color.copy(this.light.color)}}class Km extends or{constructor(t=10,e=10,i=4473924,r=8947848){i=new ht(i),r=new ht(r);const s=e/2,o=t/e,a=t/2,l=[],c=[];for(let d=0,f=0,m=-a;d<=e;d++,m+=o){l.push(-a,0,m,a,0,m),l.push(m,0,-a,m,0,a);const x=d===s?i:r;x.toArray(c,f),f+=3,x.toArray(c,f),f+=3,x.toArray(c,f),f+=3,x.toArray(c,f),f+=3}const u=new Ct;u.setAttribute("position",new zt(l,3)),u.setAttribute("color",new zt(c,3));const h=new bi({vertexColors:!0,toneMapped:!1});super(u,h),this.type="GridHelper"}}const tg=new Float32Array(1);new Int32Array(tg.buffer);const eg=new mr({side:Qt,depthWrite:!1,depthTest:!1});new $t(new Ds,eg);de.create=function(n,t){return n.prototype=Object.create(de.prototype),n.prototype.constructor=n,n.prototype.getPoint=t,n};ws.prototype.fromPoints=function(n){return this.setFromPoints(n)};Km.prototype.setColors=function(){};$m.prototype.update=function(){};se.prototype.extractUrlBase=function(n){return Fm.extractUrlBase(n)};se.Handlers={add:function(){},get:function(){}};_e.prototype.center=function(n){return this.getCenter(n)};_e.prototype.empty=function(){return this.isEmpty()};_e.prototype.isIntersectionBox=function(n){return this.intersectsBox(n)};_e.prototype.isIntersectionSphere=function(n){return this.intersectsSphere(n)};_e.prototype.size=function(n){return this.getSize(n)};zn.prototype.empty=function(){return this.isEmpty()};xr.prototype.setFromMatrix=function(n){return this.setFromProjectionMatrix(n)};bt.random16=function(){return Math.random()};bt.nearestPowerOfTwo=function(n){return bt.floorPowerOfTwo(n)};bt.nextPowerOfTwo=function(n){return bt.ceilPowerOfTwo(n)};ee.prototype.flattenToArrayOffset=function(n,t){return this.toArray(n,t)};ee.prototype.multiplyVector3=function(n){return n.applyMatrix3(this)};ee.prototype.multiplyVector3Array=function(){};ee.prototype.applyToBufferAttribute=function(n){return n.applyMatrix3(this)};ee.prototype.applyToVector3Array=function(){};ee.prototype.getInverse=function(n){return this.copy(n).invert()};ot.prototype.extractPosition=function(n){return this.copyPosition(n)};ot.prototype.flattenToArrayOffset=function(n,t){return this.toArray(n,t)};ot.prototype.getPosition=function(){return new M().setFromMatrixColumn(this,3)};ot.prototype.setRotationFromQuaternion=function(n){return this.makeRotationFromQuaternion(n)};ot.prototype.multiplyToArray=function(){};ot.prototype.multiplyVector3=function(n){return n.applyMatrix4(this)};ot.prototype.multiplyVector4=function(n){return n.applyMatrix4(this)};ot.prototype.multiplyVector3Array=function(){};ot.prototype.rotateAxis=function(n){n.transformDirection(this)};ot.prototype.crossVector=function(n){return n.applyMatrix4(this)};ot.prototype.translate=function(){};ot.prototype.rotateX=function(){};ot.prototype.rotateY=function(){};ot.prototype.rotateZ=function(){};ot.prototype.rotateByAxis=function(){};ot.prototype.applyToBufferAttribute=function(n){return n.applyMatrix4(this)};ot.prototype.applyToVector3Array=function(){};ot.prototype.makeFrustum=function(n,t,e,i,r,s){return this.makePerspective(n,t,i,e,r,s)};ot.prototype.getInverse=function(n){return this.copy(n).invert()};Re.prototype.isIntersectionLine=function(n){return this.intersectsLine(n)};le.prototype.multiplyVector3=function(n){return n.applyQuaternion(this)};le.prototype.inverse=function(){return this.invert()};cn.prototype.isIntersectionBox=function(n){return this.intersectsBox(n)};cn.prototype.isIntersectionPlane=function(n){return this.intersectsPlane(n)};cn.prototype.isIntersectionSphere=function(n){return this.intersectsSphere(n)};Zt.prototype.area=function(){return this.getArea()};Zt.prototype.barycoordFromPoint=function(n,t){return this.getBarycoord(n,t)};Zt.prototype.midpoint=function(n){return this.getMidpoint(n)};Zt.prototypenormal=function(n){return this.getNormal(n)};Zt.prototype.plane=function(n){return this.getPlane(n)};Zt.barycoordFromPoint=function(n,t,e,i,r){return Zt.getBarycoord(n,t,e,i,r)};Zt.normal=function(n,t,e,i){return Zt.getNormal(n,t,e,i)};Us.prototype.extractAllPoints=function(n){return this.extractPoints(n)};Us.prototype.extrude=function(n){return new yr(this,n)};Us.prototype.makeGeometry=function(n){return new im(this,n)};Y.prototype.fromAttribute=function(n,t,e){return this.fromBufferAttribute(n,t,e)};Y.prototype.distanceToManhattan=function(n){return this.manhattanDistanceTo(n)};Y.prototype.lengthManhattan=function(){return this.manhattanLength()};M.prototype.setEulerFromRotationMatrix=function(){};M.prototype.setEulerFromQuaternion=function(){};M.prototype.getPositionFromMatrix=function(n){return this.setFromMatrixPosition(n)};M.prototype.getScaleFromMatrix=function(n){return this.setFromMatrixScale(n)};M.prototype.getColumnFromMatrix=function(n,t){return this.setFromMatrixColumn(t,n)};M.prototype.applyProjection=function(n){return this.applyMatrix4(n)};M.prototype.fromAttribute=function(n,t,e){return this.fromBufferAttribute(n,t,e)};M.prototype.distanceToManhattan=function(n){return this.manhattanDistanceTo(n)};M.prototype.lengthManhattan=function(){return this.manhattanLength()};Bt.prototype.fromAttribute=function(n,t,e){return this.fromBufferAttribute(n,t,e)};Bt.prototype.lengthManhattan=function(){return this.manhattanLength()};gt.prototype.getChildByName=function(n){return this.getObjectByName(n)};gt.prototype.renderDepth=function(){};gt.prototype.translate=function(n,t){return this.translateOnAxis(t,n)};gt.prototype.getWorldRotation=function(){};gt.prototype.applyMatrix=function(n){return this.applyMatrix4(n)};Object.defineProperties(gt.prototype,{eulerOrder:{get:function(){return this.rotation.order},set:function(n){this.rotation.order=n}},useQuaternion:{get:function(){},set:function(){}}});$t.prototype.setDrawMode=function(){};Object.defineProperties($t.prototype,{drawMode:{get:function(){return Zc},set:function(){}}});fs.prototype.initBones=function(){};Object.defineProperty(de.prototype,"__arcLengthDivisions",{get:function(){return this.arcLengthDivisions},set:function(n){this.arcLengthDivisions=n}});ue.prototype.setLens=function(n,t){t!==void 0&&(this.filmGauge=t),this.setFocalLength(n)};Object.defineProperties(Pe.prototype,{onlyShadow:{set:function(){}},shadowCameraFov:{set:function(n){this.shadow.camera.fov=n}},shadowCameraLeft:{set:function(n){this.shadow.camera.left=n}},shadowCameraRight:{set:function(n){this.shadow.camera.right=n}},shadowCameraTop:{set:function(n){this.shadow.camera.top=n}},shadowCameraBottom:{set:function(n){this.shadow.camera.bottom=n}},shadowCameraNear:{set:function(n){this.shadow.camera.near=n}},shadowCameraFar:{set:function(n){this.shadow.camera.far=n}},shadowCameraVisible:{set:function(){}},shadowBias:{set:function(n){this.shadow.bias=n}},shadowDarkness:{set:function(){}},shadowMapWidth:{set:function(n){this.shadow.mapSize.width=n}},shadowMapHeight:{set:function(n){this.shadow.mapSize.height=n}}});Object.defineProperties(St.prototype,{length:{get:function(){return this.array.length}},dynamic:{get:function(){return this.usage===hi},set:function(){this.setUsage(hi)}}});St.prototype.setDynamic=function(n){return this.setUsage(n===!0?hi:_i),this};St.prototype.copyIndicesArray=function(){},St.prototype.setArray=function(){};Ct.prototype.addIndex=function(n){this.setIndex(n)};Ct.prototype.addAttribute=function(n,t){return!(t&&t.isBufferAttribute)&&!(t&&t.isInterleavedBufferAttribute)?this.setAttribute(n,new St(arguments[1],arguments[2])):n==="index"?(this.setIndex(t),this):this.setAttribute(n,t)};Ct.prototype.addDrawCall=function(n,t,e){this.addGroup(n,t)};Ct.prototype.clearDrawCalls=function(){this.clearGroups()};Ct.prototype.computeOffsets=function(){};Ct.prototype.removeAttribute=function(n){return this.deleteAttribute(n)};Ct.prototype.applyMatrix=function(n){return this.applyMatrix4(n)};Object.defineProperties(Ct.prototype,{drawcalls:{get:function(){return this.groups}},offsets:{get:function(){return this.groups}}});Object.defineProperties(Ss.prototype,{maxInstancedCount:{get:function(){return this.instanceCount},set:function(n){this.instanceCount=n}}});Object.defineProperties(yl.prototype,{linePrecision:{get:function(){return this.params.Line.threshold},set:function(n){this.params.Line.threshold=n}}});Object.defineProperties(ge.prototype,{dynamic:{get:function(){return this.usage===hi},set:function(n){this.setUsage(n)}}});ge.prototype.setDynamic=function(n){return this.setUsage(n===!0?hi:_i),this};ge.prototype.setArray=function(){};yr.prototype.getArrays=function(){};yr.prototype.addShapeList=function(){};yr.prototype.addShape=function(){};Qa.prototype.dispose=function(){};Object.defineProperties(Vt.prototype,{wrapAround:{get:function(){},set:function(){}},overdraw:{get:function(){},set:function(){}},wrapRGB:{get:function(){return new ht}},shading:{get:function(){},set:function(n){this.flatShading=n===Ta}},stencilMask:{get:function(){return this.stencilFuncMask},set:function(n){this.stencilFuncMask=n}}});Object.defineProperties(Nn.prototype,{transparency:{get:function(){return this.transmission},set:function(n){this.transmission=n}}});Object.defineProperties(ye.prototype,{derivatives:{get:function(){return this.extensions.derivatives},set:function(n){this.extensions.derivatives=n}}});Ut.prototype.clearTarget=function(n,t,e,i){this.setRenderTarget(n),this.clear(t,e,i)};Ut.prototype.animate=function(n){this.setAnimationLoop(n)};Ut.prototype.getCurrentRenderTarget=function(){return this.getRenderTarget()};Ut.prototype.getMaxAnisotropy=function(){return this.capabilities.getMaxAnisotropy()};Ut.prototype.getPrecision=function(){return this.capabilities.precision};Ut.prototype.resetGLState=function(){return this.state.reset()};Ut.prototype.supportsFloatTextures=function(){return this.extensions.get("OES_texture_float")};Ut.prototype.supportsHalfFloatTextures=function(){return this.extensions.get("OES_texture_half_float")};Ut.prototype.supportsStandardDerivatives=function(){return this.extensions.get("OES_standard_derivatives")};Ut.prototype.supportsCompressedTextureS3TC=function(){return this.extensions.get("WEBGL_compressed_texture_s3tc")};Ut.prototype.supportsCompressedTexturePVRTC=function(){return this.extensions.get("WEBGL_compressed_texture_pvrtc")};Ut.prototype.supportsBlendMinMax=function(){return this.extensions.get("EXT_blend_minmax")};Ut.prototype.supportsVertexTextures=function(){return this.capabilities.vertexTextures};Ut.prototype.supportsInstancedArrays=function(){return this.extensions.get("ANGLE_instanced_arrays")};Ut.prototype.enableScissorTest=function(n){this.setScissorTest(n)};Ut.prototype.initMaterial=function(){};Ut.prototype.addPrePlugin=function(){};Ut.prototype.addPostPlugin=function(){};Ut.prototype.updateShadowMap=function(){};Ut.prototype.setFaceCulling=function(){};Ut.prototype.allocTextureUnit=function(){};Ut.prototype.setTexture=function(){};Ut.prototype.setTexture2D=function(){};Ut.prototype.setTextureCube=function(){};Ut.prototype.getActiveMipMapLevel=function(){return this.getActiveMipmapLevel()};Object.defineProperties(Ut.prototype,{shadowMapEnabled:{get:function(){return this.shadowMap.enabled},set:function(n){this.shadowMap.enabled=n}},shadowMapType:{get:function(){return this.shadowMap.type},set:function(n){this.shadowMap.type=n}},shadowMapCullFace:{get:function(){},set:function(){}},context:{get:function(){return this.getContext()}},vr:{get:function(){return this.xr}},gammaInput:{get:function(){return!1},set:function(){}},gammaOutput:{get:function(){return!1},set:function(n){this.outputEncoding=n===!0?Pa:yi}},toneMappingWhitePoint:{get:function(){return 1},set:function(){}}});Object.defineProperties(Ya.prototype,{cullFace:{get:function(){},set:function(){}},renderReverseSided:{get:function(){},set:function(){}},renderSingleSided:{get:function(){},set:function(){}}});Object.defineProperties(an.prototype,{wrapS:{get:function(){return this.texture.wrapS},set:function(n){this.texture.wrapS=n}},wrapT:{get:function(){return this.texture.wrapT},set:function(n){this.texture.wrapT=n}},magFilter:{get:function(){return this.texture.magFilter},set:function(n){this.texture.magFilter=n}},minFilter:{get:function(){return this.texture.minFilter},set:function(n){this.texture.minFilter=n}},anisotropy:{get:function(){return this.texture.anisotropy},set:function(n){this.texture.anisotropy=n}},offset:{get:function(){return this.texture.offset},set:function(n){this.texture.offset=n}},repeat:{get:function(){return this.texture.repeat},set:function(n){this.texture.repeat=n}},format:{get:function(){return this.texture.format},set:function(n){this.texture.format=n}},type:{get:function(){return this.texture.type},set:function(n){this.texture.type=n}},generateMipmaps:{get:function(){return this.texture.generateMipmaps},set:function(n){this.texture.generateMipmaps=n}}});Hm.prototype.load=function(n){const t=this;return new Om().load(n,function(i){t.setBuffer(i)}),this};Is.prototype.updateCubeMap=function(n,t){return this.update(n,t)};Is.prototype.clear=function(n,t,e,i){return this.renderTarget.clear(n,t,e,i)};On.crossOrigin=void 0;On.loadTexture=function(n,t,e,i){const r=new Ms;r.setCrossOrigin(this.crossOrigin);const s=r.load(n,e,void 0,i);return t&&(s.mapping=t),s};On.loadTextureCube=function(n,t,e,i){const r=new vm;r.setCrossOrigin(this.crossOrigin);const s=r.load(n,e,void 0,i);return t&&(s.mapping=t),s};On.loadCompressedTexture=function(){};On.loadCompressedTextureCube=function(){};typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Sa}}));typeof window<"u"&&(window.__THREE__||(window.__THREE__=Sa));export{Pm as $,ua as A,St as B,ht as C,dr as D,ps as E,vi as F,ei as G,gt as H,_a as I,ot as J,xe as K,se as L,mr as M,oo as N,pl as O,el as P,ur as Q,on as R,fs as S,Bn as T,rg as U,Y as V,tl as W,_e as X,M as Y,zn as Z,Cm as _,Fm as a,Dm as a0,Nn as a1,fi as a2,Bp as a3,ig as a4,cr as a5,Mi as a6,lr as a7,ng as a8,le as a9,$e as aa,Qa as ab,Km as ac,Rm as ad,Ut as ae,zt as af,lm as ag,Im as ah,Sh as ai,sg as aj,yl as ak,ye as al,Ko as am,ya as an,ri as ao,Re as ap,og as aq,Bt as ar,de as as,io as at,um as au,ne as av,ui as aw,ee as ax,Un as ay,Qe as b,Ms as c,ge as d,pr as e,tc as f,so as g,te as h,ae as i,rs as j,ss as k,me as l,Vt as m,bi as n,ve as o,Ct as p,$t as q,or as r,Pa as s,pi as t,Np as u,oa as v,ue as w,bt as x,nr as y,ir as z};

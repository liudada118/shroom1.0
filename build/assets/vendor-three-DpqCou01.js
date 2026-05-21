/**
 * @license
 * Copyright 2010-2021 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Pa="127",Pd={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},Id={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},Kl=0,sa=1,eh=2,Dd=3,Fd=0,Ia=1,th=2,xi=3,Li=0,Ke=1,Ir=2,Da=1,Bd=2,Qt=0,_i=1,oa=2,aa=3,ca=4,nh=5,Nn=100,ih=101,rh=102,la=103,ha=104,sh=200,oh=201,ah=202,ch=203,Fa=204,Ba=205,lh=206,hh=207,uh=208,dh=209,fh=210,ph=0,mh=1,gh=2,Fs=3,yh=4,xh=5,vh=6,_h=7,Dr=0,bh=1,wh=2,Hn=0,Mh=1,Sh=2,Th=3,Eh=4,Ah=5,io=300,Fr=301,Br=302,Bs=303,Ns=304,Ri=306,Nr=307,nr=1e3,mt=1001,ir=1002,nt=1003,zs=1004,Nd=1004,Os=1005,zd=1005,it=1006,Na=1007,Od=1007,Ci=1008,Ud=1008,Pi=1009,Lh=1010,Rh=1011,rr=1012,Ch=1013,Qi=1014,$t=1015,sr=1016,Ph=1017,Ih=1018,Dh=1019,bi=1020,Fh=1021,fn=1022,Et=1023,Bh=1024,Nh=1025,zh=Et,Gn=1026,Mi=1027,Oh=1028,Uh=1029,Hh=1030,Gh=1031,kh=1032,Vh=1033,ua=33776,da=33777,fa=33778,pa=33779,ma=35840,ga=35841,ya=35842,xa=35843,Wh=36196,va=37492,_a=37496,qh=37808,Xh=37809,Yh=37810,jh=37811,Zh=37812,Jh=37813,$h=37814,Qh=37815,Kh=37816,eu=37817,tu=37818,nu=37819,iu=37820,ru=37821,su=36492,ou=37840,au=37841,cu=37842,lu=37843,hu=37844,uu=37845,du=37846,fu=37847,pu=37848,mu=37849,gu=37850,yu=37851,xu=37852,vu=37853,_u=2200,bu=2201,wu=2202,or=2300,ar=2301,Is=2302,zn=2400,On=2401,cr=2402,ro=2500,za=2501,Mu=0,Hd=1,Gd=2,gt=3e3,zr=3001,so=3007,oo=3002,Su=3003,Oa=3004,Ua=3005,Ha=3006,Tu=3200,Eu=3201,jn=0,Au=1,kd=0,Ds=7680,Vd=7681,Wd=7682,qd=7683,Xd=34055,Yd=34056,jd=5386,Zd=512,Jd=513,$d=514,Qd=515,Kd=516,ef=517,tf=518,Lu=519,Ii=35044,kn=35048,nf=35040,rf=35045,sf=35049,of=35041,af=35046,cf=35050,lf=35042,hf="100",ba="300 es";function nn(){}Object.assign(nn.prototype,{addEventListener:function(n,e){this._listeners===void 0&&(this._listeners={});const t=this._listeners;t[n]===void 0&&(t[n]=[]),t[n].indexOf(e)===-1&&t[n].push(e)},hasEventListener:function(n,e){if(this._listeners===void 0)return!1;const t=this._listeners;return t[n]!==void 0&&t[n].indexOf(e)!==-1},removeEventListener:function(n,e){if(this._listeners===void 0)return;const i=this._listeners[n];if(i!==void 0){const r=i.indexOf(e);r!==-1&&i.splice(r,1)}},dispatchEvent:function(n){if(this._listeners===void 0)return;const t=this._listeners[n.type];if(t!==void 0){n.target=this;const i=t.slice(0);for(let r=0,s=i.length;r<s;r++)i[r].call(this,n);n.target=null}}});const lt=[];for(let n=0;n<256;n++)lt[n]=(n<16?"0":"")+n.toString(16);let qr=1234567;const me={DEG2RAD:Math.PI/180,RAD2DEG:180/Math.PI,generateUUID:function(){const n=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(lt[n&255]+lt[n>>8&255]+lt[n>>16&255]+lt[n>>24&255]+"-"+lt[e&255]+lt[e>>8&255]+"-"+lt[e>>16&15|64]+lt[e>>24&255]+"-"+lt[t&63|128]+lt[t>>8&255]+"-"+lt[t>>16&255]+lt[t>>24&255]+lt[i&255]+lt[i>>8&255]+lt[i>>16&255]+lt[i>>24&255]).toUpperCase()},clamp:function(n,e,t){return Math.max(e,Math.min(t,n))},euclideanModulo:function(n,e){return(n%e+e)%e},mapLinear:function(n,e,t,i,r){return i+(n-e)*(r-i)/(t-e)},inverseLerp:function(n,e,t){return n!==e?(t-n)/(e-n):0},lerp:function(n,e,t){return(1-t)*n+t*e},damp:function(n,e,t,i){return me.lerp(n,e,1-Math.exp(-t*i))},pingpong:function(n,e=1){return e-Math.abs(me.euclideanModulo(n,e*2)-e)},smoothstep:function(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*(3-2*n))},smootherstep:function(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*n*(n*(n*6-15)+10))},randInt:function(n,e){return n+Math.floor(Math.random()*(e-n+1))},randFloat:function(n,e){return n+Math.random()*(e-n)},randFloatSpread:function(n){return n*(.5-Math.random())},seededRandom:function(n){return n!==void 0&&(qr=n%2147483647),qr=qr*16807%2147483647,(qr-1)/2147483646},degToRad:function(n){return n*me.DEG2RAD},radToDeg:function(n){return n*me.RAD2DEG},isPowerOfTwo:function(n){return(n&n-1)===0&&n!==0},ceilPowerOfTwo:function(n){return Math.pow(2,Math.ceil(Math.log(n)/Math.LN2))},floorPowerOfTwo:function(n){return Math.pow(2,Math.floor(Math.log(n)/Math.LN2))},setQuaternionFromProperEuler:function(n,e,t,i,r){const s=Math.cos,o=Math.sin,a=s(t/2),c=o(t/2),l=s((e+i)/2),u=o((e+i)/2),h=s((e-i)/2),d=o((e-i)/2),f=s((i-e)/2),p=o((i-e)/2);switch(r){case"XYX":n.set(a*u,c*h,c*d,a*l);break;case"YZY":n.set(c*d,a*u,c*h,a*l);break;case"ZXZ":n.set(c*h,c*d,a*u,a*l);break;case"XZX":n.set(a*u,c*p,c*f,a*l);break;case"YXY":n.set(c*f,a*u,c*p,a*l);break;case"ZYZ":n.set(c*p,c*f,a*u,a*l);break;default:}}};class W{constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e,t){return t!==void 0?this.addVectors(e,t):(this.x+=e.x,this.y+=e.y,this)}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e,t){return t!==void 0?this.subVectors(e,t):(this.x-=e.x,this.y-=e.y,this)}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,i=this.y,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6],this.y=r[1]*t+r[4]*i+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(e,Math.min(t,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=this.x<0?Math.ceil(this.x):Math.floor(this.x),this.y=this.y<0?Math.ceil(this.y):Math.floor(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,i=this.y-e.y;return t*t+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t,i){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const i=Math.cos(t),r=Math.sin(t),s=this.x-e.x,o=this.y-e.y;return this.x=s*i-o*r+e.x,this.y=s*r+o*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}}W.prototype.isVector2=!0;class rt{constructor(){this.elements=[1,0,0,0,1,0,0,0,1],arguments.length>0}set(e,t,i,r,s,o,a,c,l){const u=this.elements;return u[0]=e,u[1]=r,u[2]=a,u[3]=t,u[4]=s,u[5]=c,u[6]=i,u[7]=o,u[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this}extractBasis(e,t,i){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const i=e.elements,r=t.elements,s=this.elements,o=i[0],a=i[3],c=i[6],l=i[1],u=i[4],h=i[7],d=i[2],f=i[5],p=i[8],y=r[0],x=r[3],g=r[6],m=r[1],b=r[4],_=r[7],T=r[2],v=r[5],A=r[8];return s[0]=o*y+a*m+c*T,s[3]=o*x+a*b+c*v,s[6]=o*g+a*_+c*A,s[1]=l*y+u*m+h*T,s[4]=l*x+u*b+h*v,s[7]=l*g+u*_+h*A,s[2]=d*y+f*m+p*T,s[5]=d*x+f*b+p*v,s[8]=d*g+f*_+p*A,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],c=e[6],l=e[7],u=e[8];return t*o*u-t*a*l-i*s*u+i*a*c+r*s*l-r*o*c}invert(){const e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],c=e[6],l=e[7],u=e[8],h=u*o-a*l,d=a*c-u*s,f=l*s-o*c,p=t*h+i*d+r*f;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);const y=1/p;return e[0]=h*y,e[1]=(r*l-u*i)*y,e[2]=(a*i-r*o)*y,e[3]=d*y,e[4]=(u*t-r*c)*y,e[5]=(r*s-a*t)*y,e[6]=f*y,e[7]=(i*c-l*t)*y,e[8]=(o*t-i*s)*y,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,i,r,s,o,a){const c=Math.cos(s),l=Math.sin(s);return this.set(i*c,i*l,-i*(c*o+l*a)+o+e,-r*l,r*c,-r*(-l*o+c*a)+a+t,0,0,1),this}scale(e,t){const i=this.elements;return i[0]*=e,i[3]*=e,i[6]*=e,i[1]*=t,i[4]*=t,i[7]*=t,this}rotate(e){const t=Math.cos(e),i=Math.sin(e),r=this.elements,s=r[0],o=r[3],a=r[6],c=r[1],l=r[4],u=r[7];return r[0]=t*s+i*c,r[3]=t*o+i*l,r[6]=t*a+i*u,r[1]=-i*s+t*c,r[4]=-i*o+t*l,r[7]=-i*a+t*u,this}translate(e,t){const i=this.elements;return i[0]+=e*i[2],i[3]+=e*i[5],i[6]+=e*i[8],i[1]+=t*i[2],i[4]+=t*i[5],i[7]+=t*i[8],this}equals(e){const t=this.elements,i=e.elements;for(let r=0;r<9;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<9;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){const i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}}rt.prototype.isMatrix3=!0;let ei;const Zn={getDataURL:function(n){if(/^data:/i.test(n.src)||typeof HTMLCanvasElement>"u")return n.src;let e;if(n instanceof HTMLCanvasElement)e=n;else{ei===void 0&&(ei=document.createElementNS("http://www.w3.org/1999/xhtml","canvas")),ei.width=n.width,ei.height=n.height;const t=ei.getContext("2d");n instanceof ImageData?t.putImageData(n,0,0):t.drawImage(n,0,0,n.width,n.height),e=ei}return e.width>2048||e.height>2048?e.toDataURL("image/jpeg",.6):e.toDataURL("image/png")}};let uf=0;class st extends nn{constructor(e=st.DEFAULT_IMAGE,t=st.DEFAULT_MAPPING,i=mt,r=mt,s=it,o=Ci,a=Et,c=Pi,l=1,u=gt){super(),Object.defineProperty(this,"id",{value:uf++}),this.uuid=me.generateUUID(),this.name="",this.image=e,this.mipmaps=[],this.mapping=t,this.wrapS=i,this.wrapT=r,this.magFilter=s,this.minFilter=o,this.anisotropy=l,this.format=a,this.internalFormat=null,this.type=c,this.offset=new W(0,0),this.repeat=new W(1,1),this.center=new W(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new rt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.encoding=u,this.version=0,this.onUpdate=null}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.image=e.image,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.encoding=e.encoding,this}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const i={metadata:{version:4.5,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,mapping:this.mapping,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,type:this.type,encoding:this.encoding,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};if(this.image!==void 0){const r=this.image;if(r.uuid===void 0&&(r.uuid=me.generateUUID()),!t&&e.images[r.uuid]===void 0){let s;if(Array.isArray(r)){s=[];for(let o=0,a=r.length;o<a;o++)r[o].isDataTexture?s.push(So(r[o].image)):s.push(So(r[o]))}else s=So(r);e.images[r.uuid]={uuid:r.uuid,url:s}}i.image=r.uuid}return t||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==io)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case nr:e.x=e.x-Math.floor(e.x);break;case mt:e.x=e.x<0?0:1;break;case ir:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case nr:e.y=e.y-Math.floor(e.y);break;case mt:e.y=e.y<0?0:1;break;case ir:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&this.version++}}st.DEFAULT_IMAGE=void 0;st.DEFAULT_MAPPING=io;st.prototype.isTexture=!0;function So(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?Zn.getDataURL(n):n.data?{data:Array.prototype.slice.call(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:{}}class Be{constructor(e=0,t=0,i=0,r=1){this.x=e,this.y=t,this.z=i,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,i,r){return this.x=e,this.y=t,this.z=i,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e,t){return t!==void 0?this.addVectors(e,t):(this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this)}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e,t){return t!==void 0?this.subVectors(e,t):(this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this)}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,i=this.y,r=this.z,s=this.w,o=e.elements;return this.x=o[0]*t+o[4]*i+o[8]*r+o[12]*s,this.y=o[1]*t+o[5]*i+o[9]*r+o[13]*s,this.z=o[2]*t+o[6]*i+o[10]*r+o[14]*s,this.w=o[3]*t+o[7]*i+o[11]*r+o[15]*s,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,i,r,s;const c=e.elements,l=c[0],u=c[4],h=c[8],d=c[1],f=c[5],p=c[9],y=c[2],x=c[6],g=c[10];if(Math.abs(u-d)<.01&&Math.abs(h-y)<.01&&Math.abs(p-x)<.01){if(Math.abs(u+d)<.1&&Math.abs(h+y)<.1&&Math.abs(p+x)<.1&&Math.abs(l+f+g-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const b=(l+1)/2,_=(f+1)/2,T=(g+1)/2,v=(u+d)/4,A=(h+y)/4,L=(p+x)/4;return b>_&&b>T?b<.01?(i=0,r=.707106781,s=.707106781):(i=Math.sqrt(b),r=v/i,s=A/i):_>T?_<.01?(i=.707106781,r=0,s=.707106781):(r=Math.sqrt(_),i=v/r,s=L/r):T<.01?(i=.707106781,r=.707106781,s=0):(s=Math.sqrt(T),i=A/s,r=L/s),this.set(i,r,s,t),this}let m=Math.sqrt((x-p)*(x-p)+(h-y)*(h-y)+(d-u)*(d-u));return Math.abs(m)<.001&&(m=1),this.x=(x-p)/m,this.y=(h-y)/m,this.z=(d-u)/m,this.w=Math.acos((l+f+g-1)/2),this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this.w=Math.max(e.w,Math.min(t.w,this.w)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this.w=Math.max(e,Math.min(t,this.w)),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(e,Math.min(t,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=this.x<0?Math.ceil(this.x):Math.floor(this.x),this.y=this.y<0?Math.ceil(this.y):Math.floor(this.y),this.z=this.z<0?Math.ceil(this.z):Math.floor(this.z),this.w=this.w<0?Math.ceil(this.w):Math.floor(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this.w=e.w+(t.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t,i){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}}Be.prototype.isVector4=!0;class Kt extends nn{constructor(e,t,i){super(),this.width=e,this.height=t,this.depth=1,this.scissor=new Be(0,0,e,t),this.scissorTest=!1,this.viewport=new Be(0,0,e,t),i=i||{},this.texture=new st(void 0,i.mapping,i.wrapS,i.wrapT,i.magFilter,i.minFilter,i.format,i.type,i.anisotropy,i.encoding),this.texture.image={},this.texture.image.width=e,this.texture.image.height=t,this.texture.image.depth=1,this.texture.generateMipmaps=i.generateMipmaps!==void 0?i.generateMipmaps:!1,this.texture.minFilter=i.minFilter!==void 0?i.minFilter:it,this.depthBuffer=i.depthBuffer!==void 0?i.depthBuffer:!0,this.stencilBuffer=i.stencilBuffer!==void 0?i.stencilBuffer:!1,this.depthTexture=i.depthTexture!==void 0?i.depthTexture:null}setTexture(e){e.image={width:this.width,height:this.height,depth:this.depth},this.texture=e}setSize(e,t,i=1){(this.width!==e||this.height!==t||this.depth!==i)&&(this.width=e,this.height=t,this.depth=i,this.texture.image.width=e,this.texture.image.height=t,this.texture.image.depth=i,this.dispose()),this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.width=e.width,this.height=e.height,this.depth=e.depth,this.viewport.copy(e.viewport),this.texture=e.texture.clone(),this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.depthTexture=e.depthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}}Kt.prototype.isWebGLRenderTarget=!0;class Ru extends Kt{constructor(e,t,i){super(e,t,i),this.samples=4}copy(e){return super.copy.call(this,e),this.samples=e.samples,this}}Ru.prototype.isWebGLMultisampleRenderTarget=!0;class at{constructor(e=0,t=0,i=0,r=1){this._x=e,this._y=t,this._z=i,this._w=r}static slerp(e,t,i,r){return i.slerpQuaternions(e,t,r)}static slerpFlat(e,t,i,r,s,o,a){let c=i[r+0],l=i[r+1],u=i[r+2],h=i[r+3];const d=s[o+0],f=s[o+1],p=s[o+2],y=s[o+3];if(a===0){e[t+0]=c,e[t+1]=l,e[t+2]=u,e[t+3]=h;return}if(a===1){e[t+0]=d,e[t+1]=f,e[t+2]=p,e[t+3]=y;return}if(h!==y||c!==d||l!==f||u!==p){let x=1-a;const g=c*d+l*f+u*p+h*y,m=g>=0?1:-1,b=1-g*g;if(b>Number.EPSILON){const T=Math.sqrt(b),v=Math.atan2(T,g*m);x=Math.sin(x*v)/T,a=Math.sin(a*v)/T}const _=a*m;if(c=c*x+d*_,l=l*x+f*_,u=u*x+p*_,h=h*x+y*_,x===1-a){const T=1/Math.sqrt(c*c+l*l+u*u+h*h);c*=T,l*=T,u*=T,h*=T}}e[t]=c,e[t+1]=l,e[t+2]=u,e[t+3]=h}static multiplyQuaternionsFlat(e,t,i,r,s,o){const a=i[r],c=i[r+1],l=i[r+2],u=i[r+3],h=s[o],d=s[o+1],f=s[o+2],p=s[o+3];return e[t]=a*p+u*h+c*f-l*d,e[t+1]=c*p+u*d+l*h-a*f,e[t+2]=l*p+u*f+a*d-c*h,e[t+3]=u*p-a*h-c*d-l*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,i,r){return this._x=e,this._y=t,this._z=i,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t){if(!(e&&e.isEuler))throw new Error("THREE.Quaternion: .setFromEuler() now expects an Euler rotation rather than a Vector3 and order.");const i=e._x,r=e._y,s=e._z,o=e._order,a=Math.cos,c=Math.sin,l=a(i/2),u=a(r/2),h=a(s/2),d=c(i/2),f=c(r/2),p=c(s/2);switch(o){case"XYZ":this._x=d*u*h+l*f*p,this._y=l*f*h-d*u*p,this._z=l*u*p+d*f*h,this._w=l*u*h-d*f*p;break;case"YXZ":this._x=d*u*h+l*f*p,this._y=l*f*h-d*u*p,this._z=l*u*p-d*f*h,this._w=l*u*h+d*f*p;break;case"ZXY":this._x=d*u*h-l*f*p,this._y=l*f*h+d*u*p,this._z=l*u*p+d*f*h,this._w=l*u*h-d*f*p;break;case"ZYX":this._x=d*u*h-l*f*p,this._y=l*f*h+d*u*p,this._z=l*u*p-d*f*h,this._w=l*u*h+d*f*p;break;case"YZX":this._x=d*u*h+l*f*p,this._y=l*f*h+d*u*p,this._z=l*u*p-d*f*h,this._w=l*u*h-d*f*p;break;case"XZY":this._x=d*u*h-l*f*p,this._y=l*f*h-d*u*p,this._z=l*u*p+d*f*h,this._w=l*u*h+d*f*p;break;default:}return t!==!1&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const i=t/2,r=Math.sin(i);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,i=t[0],r=t[4],s=t[8],o=t[1],a=t[5],c=t[9],l=t[2],u=t[6],h=t[10],d=i+a+h;if(d>0){const f=.5/Math.sqrt(d+1);this._w=.25/f,this._x=(u-c)*f,this._y=(s-l)*f,this._z=(o-r)*f}else if(i>a&&i>h){const f=2*Math.sqrt(1+i-a-h);this._w=(u-c)/f,this._x=.25*f,this._y=(r+o)/f,this._z=(s+l)/f}else if(a>h){const f=2*Math.sqrt(1+a-i-h);this._w=(s-l)/f,this._x=(r+o)/f,this._y=.25*f,this._z=(c+u)/f}else{const f=2*Math.sqrt(1+h-i-a);this._w=(o-r)/f,this._x=(s+l)/f,this._y=(c+u)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let i=e.dot(t)+1;return i<Number.EPSILON?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(me.clamp(this.dot(e),-1,1)))}rotateTowards(e,t){const i=this.angleTo(e);if(i===0)return this;const r=Math.min(1,t/i);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e,t){return t!==void 0?this.multiplyQuaternions(e,t):this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const i=e._x,r=e._y,s=e._z,o=e._w,a=t._x,c=t._y,l=t._z,u=t._w;return this._x=i*u+o*a+r*l-s*c,this._y=r*u+o*c+s*a-i*l,this._z=s*u+o*l+i*c-r*a,this._w=o*u-i*a-r*c-s*l,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);const i=this._x,r=this._y,s=this._z,o=this._w;let a=o*e._w+i*e._x+r*e._y+s*e._z;if(a<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,a=-a):this.copy(e),a>=1)return this._w=o,this._x=i,this._y=r,this._z=s,this;const c=1-a*a;if(c<=Number.EPSILON){const f=1-t;return this._w=f*o+t*this._w,this._x=f*i+t*this._x,this._y=f*r+t*this._y,this._z=f*s+t*this._z,this.normalize(),this._onChangeCallback(),this}const l=Math.sqrt(c),u=Math.atan2(l,a),h=Math.sin((1-t)*u)/l,d=Math.sin(t*u)/l;return this._w=o*h+this._w*d,this._x=i*h+this._x*d,this._y=r*h+this._y*d,this._z=s*h+this._z*d,this._onChangeCallback(),this}slerpQuaternions(e,t,i){this.copy(e).slerp(t,i)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}}at.prototype.isQuaternion=!0;class w{constructor(e=0,t=0,i=0){this.x=e,this.y=t,this.z=i}set(e,t,i){return i===void 0&&(i=this.z),this.x=e,this.y=t,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e,t){return t!==void 0?this.addVectors(e,t):(this.x+=e.x,this.y+=e.y,this.z+=e.z,this)}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e,t){return t!==void 0?this.subVectors(e,t):(this.x-=e.x,this.y-=e.y,this.z-=e.z,this)}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e,t){return t!==void 0?this.multiplyVectors(e,t):(this.x*=e.x,this.y*=e.y,this.z*=e.z,this)}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return e&&e.isEuler,this.applyQuaternion(Fc.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Fc.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[3]*i+s[6]*r,this.y=s[1]*t+s[4]*i+s[7]*r,this.z=s[2]*t+s[5]*i+s[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,i=this.y,r=this.z,s=e.elements,o=1/(s[3]*t+s[7]*i+s[11]*r+s[15]);return this.x=(s[0]*t+s[4]*i+s[8]*r+s[12])*o,this.y=(s[1]*t+s[5]*i+s[9]*r+s[13])*o,this.z=(s[2]*t+s[6]*i+s[10]*r+s[14])*o,this}applyQuaternion(e){const t=this.x,i=this.y,r=this.z,s=e.x,o=e.y,a=e.z,c=e.w,l=c*t+o*r-a*i,u=c*i+a*t-s*r,h=c*r+s*i-o*t,d=-s*t-o*i-a*r;return this.x=l*c+d*-s+u*-a-h*-o,this.y=u*c+d*-o+h*-s-l*-a,this.z=h*c+d*-a+l*-o-u*-s,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,i=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[4]*i+s[8]*r,this.y=s[1]*t+s[5]*i+s[9]*r,this.z=s[2]*t+s[6]*i+s[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Math.max(e.x,Math.min(t.x,this.x)),this.y=Math.max(e.y,Math.min(t.y,this.y)),this.z=Math.max(e.z,Math.min(t.z,this.z)),this}clampScalar(e,t){return this.x=Math.max(e,Math.min(t,this.x)),this.y=Math.max(e,Math.min(t,this.y)),this.z=Math.max(e,Math.min(t,this.z)),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(e,Math.min(t,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=this.x<0?Math.ceil(this.x):Math.floor(this.x),this.y=this.y<0?Math.ceil(this.y):Math.floor(this.y),this.z=this.z<0?Math.ceil(this.z):Math.floor(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this}cross(e,t){return t!==void 0?this.crossVectors(e,t):this.crossVectors(this,e)}crossVectors(e,t){const i=e.x,r=e.y,s=e.z,o=t.x,a=t.y,c=t.z;return this.x=r*c-s*a,this.y=s*o-i*c,this.z=i*a-r*o,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const i=e.dot(this)/t;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return To.copy(this).projectOnVector(e),this.sub(To)}reflect(e){return this.sub(To.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const i=this.dot(e)/t;return Math.acos(me.clamp(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,i=this.y-e.y,r=this.z-e.z;return t*t+i*i+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,i){const r=Math.sin(t)*e;return this.x=r*Math.sin(i),this.y=Math.cos(t)*e,this.z=r*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,i){return this.x=e*Math.sin(t),this.y=i,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t,i){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}}w.prototype.isVector3=!0;const To=new w,Fc=new at;class Mt{constructor(e=new w(1/0,1/0,1/0),t=new w(-1/0,-1/0,-1/0)){this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){let t=1/0,i=1/0,r=1/0,s=-1/0,o=-1/0,a=-1/0;for(let c=0,l=e.length;c<l;c+=3){const u=e[c],h=e[c+1],d=e[c+2];u<t&&(t=u),h<i&&(i=h),d<r&&(r=d),u>s&&(s=u),h>o&&(o=h),d>a&&(a=d)}return this.min.set(t,i,r),this.max.set(s,o,a),this}setFromBufferAttribute(e){let t=1/0,i=1/0,r=1/0,s=-1/0,o=-1/0,a=-1/0;for(let c=0,l=e.count;c<l;c++){const u=e.getX(c),h=e.getY(c),d=e.getZ(c);u<t&&(t=u),h<i&&(i=h),d<r&&(r=d),u>s&&(s=u),h>o&&(o=h),d>a&&(a=d)}return this.min.set(t,i,r),this.max.set(s,o,a),this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const i=Oi.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e){return this.makeEmpty(),this.expandByObject(e)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return e===void 0&&(e=new w),this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return e===void 0&&(e=new w),this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e){e.updateWorldMatrix(!1,!1);const t=e.geometry;t!==void 0&&(t.boundingBox===null&&t.computeBoundingBox(),Eo.copy(t.boundingBox),Eo.applyMatrix4(e.matrixWorld),this.union(Eo));const i=e.children;for(let r=0,s=i.length;r<s;r++)this.expandByObject(i[r]);return this}containsPoint(e){return!(e.x<this.min.x||e.x>this.max.x||e.y<this.min.y||e.y>this.max.y||e.z<this.min.z||e.z>this.max.z)}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t===void 0&&(t=new w),t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return!(e.max.x<this.min.x||e.min.x>this.max.x||e.max.y<this.min.y||e.min.y>this.max.y||e.max.z<this.min.z||e.min.z>this.max.z)}intersectsSphere(e){return this.clampPoint(e.center,Oi),Oi.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,i;return e.normal.x>0?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Ui),Xr.subVectors(this.max,Ui),ti.subVectors(e.a,Ui),ni.subVectors(e.b,Ui),ii.subVectors(e.c,Ui),sn.subVectors(ni,ti),on.subVectors(ii,ni),Ln.subVectors(ti,ii);let t=[0,-sn.z,sn.y,0,-on.z,on.y,0,-Ln.z,Ln.y,sn.z,0,-sn.x,on.z,0,-on.x,Ln.z,0,-Ln.x,-sn.y,sn.x,0,-on.y,on.x,0,-Ln.y,Ln.x,0];return!Ao(t,ti,ni,ii,Xr)||(t=[1,0,0,0,1,0,0,0,1],!Ao(t,ti,ni,ii,Xr))?!1:(Yr.crossVectors(sn,on),t=[Yr.x,Yr.y,Yr.z],Ao(t,ti,ni,ii,Xr))}clampPoint(e,t){return t===void 0&&(t=new w),t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return Oi.copy(e).clamp(this.min,this.max).sub(e).length()}getBoundingSphere(e){return this.getCenter(e.center),e.radius=this.getSize(Oi).length()*.5,e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Xt[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Xt[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Xt[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Xt[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Xt[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Xt[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Xt[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Xt[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Xt),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}}Mt.prototype.isBox3=!0;const Xt=[new w,new w,new w,new w,new w,new w,new w,new w],Oi=new w,Eo=new Mt,ti=new w,ni=new w,ii=new w,sn=new w,on=new w,Ln=new w,Ui=new w,Xr=new w,Yr=new w,Rn=new w;function Ao(n,e,t,i,r){for(let s=0,o=n.length-3;s<=o;s+=3){Rn.fromArray(n,s);const a=r.x*Math.abs(Rn.x)+r.y*Math.abs(Rn.y)+r.z*Math.abs(Rn.z),c=e.dot(Rn),l=t.dot(Rn),u=i.dot(Rn);if(Math.max(-Math.max(c,l,u),Math.min(c,l,u))>a)return!1}return!0}const df=new Mt,Bc=new w,Lo=new w,Ro=new w;class wn{constructor(e=new w,t=-1){this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const i=this.center;t!==void 0?i.copy(t):df.setFromPoints(e).getCenter(i);let r=0;for(let s=0,o=e.length;s<o;s++)r=Math.max(r,i.distanceToSquared(e[s]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const i=this.center.distanceToSquared(e);return t===void 0&&(t=new w),t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return e===void 0&&(e=new Mt),this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){Ro.subVectors(e,this.center);const t=Ro.lengthSq();if(t>this.radius*this.radius){const i=Math.sqrt(t),r=(i-this.radius)*.5;this.center.add(Ro.multiplyScalar(r/i)),this.radius+=r}return this}union(e){return Lo.subVectors(e.center,this.center).normalize().multiplyScalar(e.radius),this.expandByPoint(Bc.copy(e.center).add(Lo)),this.expandByPoint(Bc.copy(e.center).sub(Lo)),this}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}}const Yt=new w,Co=new w,jr=new w,an=new w,Po=new w,Zr=new w,Io=new w;class Mn{constructor(e=new w,t=new w(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t===void 0&&(t=new w),t.copy(this.direction).multiplyScalar(e).add(this.origin)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Yt)),this}closestPointToPoint(e,t){t===void 0&&(t=new w),t.subVectors(e,this.origin);const i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.direction).multiplyScalar(i).add(this.origin)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=Yt.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Yt.copy(this.direction).multiplyScalar(t).add(this.origin),Yt.distanceToSquared(e))}distanceSqToSegment(e,t,i,r){Co.copy(e).add(t).multiplyScalar(.5),jr.copy(t).sub(e).normalize(),an.copy(this.origin).sub(Co);const s=e.distanceTo(t)*.5,o=-this.direction.dot(jr),a=an.dot(this.direction),c=-an.dot(jr),l=an.lengthSq(),u=Math.abs(1-o*o);let h,d,f,p;if(u>0)if(h=o*c-a,d=o*a-c,p=s*u,h>=0)if(d>=-p)if(d<=p){const y=1/u;h*=y,d*=y,f=h*(h+o*d+2*a)+d*(o*h+d+2*c)+l}else d=s,h=Math.max(0,-(o*d+a)),f=-h*h+d*(d+2*c)+l;else d=-s,h=Math.max(0,-(o*d+a)),f=-h*h+d*(d+2*c)+l;else d<=-p?(h=Math.max(0,-(-o*s+a)),d=h>0?-s:Math.min(Math.max(-s,-c),s),f=-h*h+d*(d+2*c)+l):d<=p?(h=0,d=Math.min(Math.max(-s,-c),s),f=d*(d+2*c)+l):(h=Math.max(0,-(o*s+a)),d=h>0?s:Math.min(Math.max(-s,-c),s),f=-h*h+d*(d+2*c)+l);else d=o>0?-s:s,h=Math.max(0,-(o*d+a)),f=-h*h+d*(d+2*c)+l;return i&&i.copy(this.direction).multiplyScalar(h).add(this.origin),r&&r.copy(jr).multiplyScalar(d).add(Co),f}intersectSphere(e,t){Yt.subVectors(e.center,this.origin);const i=Yt.dot(this.direction),r=Yt.dot(Yt)-i*i,s=e.radius*e.radius;if(r>s)return null;const o=Math.sqrt(s-r),a=i-o,c=i+o;return a<0&&c<0?null:a<0?this.at(c,t):this.at(a,t)}intersectsSphere(e){return this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const i=-(this.origin.dot(e.normal)+e.constant)/t;return i>=0?i:null}intersectPlane(e,t){const i=this.distanceToPlane(e);return i===null?null:this.at(i,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let i,r,s,o,a,c;const l=1/this.direction.x,u=1/this.direction.y,h=1/this.direction.z,d=this.origin;return l>=0?(i=(e.min.x-d.x)*l,r=(e.max.x-d.x)*l):(i=(e.max.x-d.x)*l,r=(e.min.x-d.x)*l),u>=0?(s=(e.min.y-d.y)*u,o=(e.max.y-d.y)*u):(s=(e.max.y-d.y)*u,o=(e.min.y-d.y)*u),i>o||s>r||((s>i||i!==i)&&(i=s),(o<r||r!==r)&&(r=o),h>=0?(a=(e.min.z-d.z)*h,c=(e.max.z-d.z)*h):(a=(e.max.z-d.z)*h,c=(e.min.z-d.z)*h),i>c||a>r)||((a>i||i!==i)&&(i=a),(c<r||r!==r)&&(r=c),r<0)?null:this.at(i>=0?i:r,t)}intersectsBox(e){return this.intersectBox(e,Yt)!==null}intersectTriangle(e,t,i,r,s){Po.subVectors(t,e),Zr.subVectors(i,e),Io.crossVectors(Po,Zr);let o=this.direction.dot(Io),a;if(o>0){if(r)return null;a=1}else if(o<0)a=-1,o=-o;else return null;an.subVectors(this.origin,e);const c=a*this.direction.dot(Zr.crossVectors(an,Zr));if(c<0)return null;const l=a*this.direction.dot(Po.cross(an));if(l<0||c+l>o)return null;const u=-a*an.dot(Io);return u<0?null:this.at(u/o,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class ce{constructor(){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],arguments.length>0}set(e,t,i,r,s,o,a,c,l,u,h,d,f,p,y,x){const g=this.elements;return g[0]=e,g[4]=t,g[8]=i,g[12]=r,g[1]=s,g[5]=o,g[9]=a,g[13]=c,g[2]=l,g[6]=u,g[10]=h,g[14]=d,g[3]=f,g[7]=p,g[11]=y,g[15]=x,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new ce().fromArray(this.elements)}copy(e){const t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this}copyPosition(e){const t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,i){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this}makeBasis(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this}extractRotation(e){const t=this.elements,i=e.elements,r=1/ri.setFromMatrixColumn(e,0).length(),s=1/ri.setFromMatrixColumn(e,1).length(),o=1/ri.setFromMatrixColumn(e,2).length();return t[0]=i[0]*r,t[1]=i[1]*r,t[2]=i[2]*r,t[3]=0,t[4]=i[4]*s,t[5]=i[5]*s,t[6]=i[6]*s,t[7]=0,t[8]=i[8]*o,t[9]=i[9]*o,t[10]=i[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){e&&e.isEuler;const t=this.elements,i=e.x,r=e.y,s=e.z,o=Math.cos(i),a=Math.sin(i),c=Math.cos(r),l=Math.sin(r),u=Math.cos(s),h=Math.sin(s);if(e.order==="XYZ"){const d=o*u,f=o*h,p=a*u,y=a*h;t[0]=c*u,t[4]=-c*h,t[8]=l,t[1]=f+p*l,t[5]=d-y*l,t[9]=-a*c,t[2]=y-d*l,t[6]=p+f*l,t[10]=o*c}else if(e.order==="YXZ"){const d=c*u,f=c*h,p=l*u,y=l*h;t[0]=d+y*a,t[4]=p*a-f,t[8]=o*l,t[1]=o*h,t[5]=o*u,t[9]=-a,t[2]=f*a-p,t[6]=y+d*a,t[10]=o*c}else if(e.order==="ZXY"){const d=c*u,f=c*h,p=l*u,y=l*h;t[0]=d-y*a,t[4]=-o*h,t[8]=p+f*a,t[1]=f+p*a,t[5]=o*u,t[9]=y-d*a,t[2]=-o*l,t[6]=a,t[10]=o*c}else if(e.order==="ZYX"){const d=o*u,f=o*h,p=a*u,y=a*h;t[0]=c*u,t[4]=p*l-f,t[8]=d*l+y,t[1]=c*h,t[5]=y*l+d,t[9]=f*l-p,t[2]=-l,t[6]=a*c,t[10]=o*c}else if(e.order==="YZX"){const d=o*c,f=o*l,p=a*c,y=a*l;t[0]=c*u,t[4]=y-d*h,t[8]=p*h+f,t[1]=h,t[5]=o*u,t[9]=-a*u,t[2]=-l*u,t[6]=f*h+p,t[10]=d-y*h}else if(e.order==="XZY"){const d=o*c,f=o*l,p=a*c,y=a*l;t[0]=c*u,t[4]=-h,t[8]=l*u,t[1]=d*h+y,t[5]=o*u,t[9]=f*h-p,t[2]=p*h-f,t[6]=a*u,t[10]=y*h+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(ff,e,pf)}lookAt(e,t,i){const r=this.elements;return St.subVectors(e,t),St.lengthSq()===0&&(St.z=1),St.normalize(),cn.crossVectors(i,St),cn.lengthSq()===0&&(Math.abs(i.z)===1?St.x+=1e-4:St.z+=1e-4,St.normalize(),cn.crossVectors(i,St)),cn.normalize(),Jr.crossVectors(St,cn),r[0]=cn.x,r[4]=Jr.x,r[8]=St.x,r[1]=cn.y,r[5]=Jr.y,r[9]=St.y,r[2]=cn.z,r[6]=Jr.z,r[10]=St.z,this}multiply(e,t){return t!==void 0?this.multiplyMatrices(e,t):this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const i=e.elements,r=t.elements,s=this.elements,o=i[0],a=i[4],c=i[8],l=i[12],u=i[1],h=i[5],d=i[9],f=i[13],p=i[2],y=i[6],x=i[10],g=i[14],m=i[3],b=i[7],_=i[11],T=i[15],v=r[0],A=r[4],L=r[8],R=r[12],z=r[1],P=r[5],U=r[9],D=r[13],I=r[2],B=r[6],F=r[10],X=r[14],K=r[3],j=r[7],oe=r[11],ae=r[15];return s[0]=o*v+a*z+c*I+l*K,s[4]=o*A+a*P+c*B+l*j,s[8]=o*L+a*U+c*F+l*oe,s[12]=o*R+a*D+c*X+l*ae,s[1]=u*v+h*z+d*I+f*K,s[5]=u*A+h*P+d*B+f*j,s[9]=u*L+h*U+d*F+f*oe,s[13]=u*R+h*D+d*X+f*ae,s[2]=p*v+y*z+x*I+g*K,s[6]=p*A+y*P+x*B+g*j,s[10]=p*L+y*U+x*F+g*oe,s[14]=p*R+y*D+x*X+g*ae,s[3]=m*v+b*z+_*I+T*K,s[7]=m*A+b*P+_*B+T*j,s[11]=m*L+b*U+_*F+T*oe,s[15]=m*R+b*D+_*X+T*ae,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],i=e[4],r=e[8],s=e[12],o=e[1],a=e[5],c=e[9],l=e[13],u=e[2],h=e[6],d=e[10],f=e[14],p=e[3],y=e[7],x=e[11],g=e[15];return p*(+s*c*h-r*l*h-s*a*d+i*l*d+r*a*f-i*c*f)+y*(+t*c*f-t*l*d+s*o*d-r*o*f+r*l*u-s*c*u)+x*(+t*l*h-t*a*f-s*o*h+i*o*f+s*a*u-i*l*u)+g*(-r*a*u-t*c*h+t*a*d+r*o*h-i*o*d+i*c*u)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,i){const r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=i),this}invert(){const e=this.elements,t=e[0],i=e[1],r=e[2],s=e[3],o=e[4],a=e[5],c=e[6],l=e[7],u=e[8],h=e[9],d=e[10],f=e[11],p=e[12],y=e[13],x=e[14],g=e[15],m=h*x*l-y*d*l+y*c*f-a*x*f-h*c*g+a*d*g,b=p*d*l-u*x*l-p*c*f+o*x*f+u*c*g-o*d*g,_=u*y*l-p*h*l+p*a*f-o*y*f-u*a*g+o*h*g,T=p*h*c-u*y*c-p*a*d+o*y*d+u*a*x-o*h*x,v=t*m+i*b+r*_+s*T;if(v===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const A=1/v;return e[0]=m*A,e[1]=(y*d*s-h*x*s-y*r*f+i*x*f+h*r*g-i*d*g)*A,e[2]=(a*x*s-y*c*s+y*r*l-i*x*l-a*r*g+i*c*g)*A,e[3]=(h*c*s-a*d*s-h*r*l+i*d*l+a*r*f-i*c*f)*A,e[4]=b*A,e[5]=(u*x*s-p*d*s+p*r*f-t*x*f-u*r*g+t*d*g)*A,e[6]=(p*c*s-o*x*s-p*r*l+t*x*l+o*r*g-t*c*g)*A,e[7]=(o*d*s-u*c*s+u*r*l-t*d*l-o*r*f+t*c*f)*A,e[8]=_*A,e[9]=(p*h*s-u*y*s-p*i*f+t*y*f+u*i*g-t*h*g)*A,e[10]=(o*y*s-p*a*s+p*i*l-t*y*l-o*i*g+t*a*g)*A,e[11]=(u*a*s-o*h*s-u*i*l+t*h*l+o*i*f-t*a*f)*A,e[12]=T*A,e[13]=(u*y*r-p*h*r+p*i*d-t*y*d-u*i*x+t*h*x)*A,e[14]=(p*a*r-o*y*r-p*i*c+t*y*c+o*i*x-t*a*x)*A,e[15]=(o*h*r-u*a*r+u*i*c-t*h*c-o*i*d+t*a*d)*A,this}scale(e){const t=this.elements,i=e.x,r=e.y,s=e.z;return t[0]*=i,t[4]*=r,t[8]*=s,t[1]*=i,t[5]*=r,t[9]*=s,t[2]*=i,t[6]*=r,t[10]*=s,t[3]*=i,t[7]*=r,t[11]*=s,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,r))}makeTranslation(e,t,i){return this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const i=Math.cos(t),r=Math.sin(t),s=1-i,o=e.x,a=e.y,c=e.z,l=s*o,u=s*a;return this.set(l*o+i,l*a-r*c,l*c+r*a,0,l*a+r*c,u*a+i,u*c-r*o,0,l*c-r*a,u*c+r*o,s*c*c+i,0,0,0,0,1),this}makeScale(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,t,i){return this.set(1,t,i,0,e,1,i,0,e,t,1,0,0,0,0,1),this}compose(e,t,i){const r=this.elements,s=t._x,o=t._y,a=t._z,c=t._w,l=s+s,u=o+o,h=a+a,d=s*l,f=s*u,p=s*h,y=o*u,x=o*h,g=a*h,m=c*l,b=c*u,_=c*h,T=i.x,v=i.y,A=i.z;return r[0]=(1-(y+g))*T,r[1]=(f+_)*T,r[2]=(p-b)*T,r[3]=0,r[4]=(f-_)*v,r[5]=(1-(d+g))*v,r[6]=(x+m)*v,r[7]=0,r[8]=(p+b)*A,r[9]=(x-m)*A,r[10]=(1-(d+y))*A,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,i){const r=this.elements;let s=ri.set(r[0],r[1],r[2]).length();const o=ri.set(r[4],r[5],r[6]).length(),a=ri.set(r[8],r[9],r[10]).length();this.determinant()<0&&(s=-s),e.x=r[12],e.y=r[13],e.z=r[14],Ct.copy(this);const l=1/s,u=1/o,h=1/a;return Ct.elements[0]*=l,Ct.elements[1]*=l,Ct.elements[2]*=l,Ct.elements[4]*=u,Ct.elements[5]*=u,Ct.elements[6]*=u,Ct.elements[8]*=h,Ct.elements[9]*=h,Ct.elements[10]*=h,t.setFromRotationMatrix(Ct),i.x=s,i.y=o,i.z=a,this}makePerspective(e,t,i,r,s,o){const a=this.elements,c=2*s/(t-e),l=2*s/(i-r),u=(t+e)/(t-e),h=(i+r)/(i-r),d=-(o+s)/(o-s),f=-2*o*s/(o-s);return a[0]=c,a[4]=0,a[8]=u,a[12]=0,a[1]=0,a[5]=l,a[9]=h,a[13]=0,a[2]=0,a[6]=0,a[10]=d,a[14]=f,a[3]=0,a[7]=0,a[11]=-1,a[15]=0,this}makeOrthographic(e,t,i,r,s,o){const a=this.elements,c=1/(t-e),l=1/(i-r),u=1/(o-s),h=(t+e)*c,d=(i+r)*l,f=(o+s)*u;return a[0]=2*c,a[4]=0,a[8]=0,a[12]=-h,a[1]=0,a[5]=2*l,a[9]=0,a[13]=-d,a[2]=0,a[6]=0,a[10]=-2*u,a[14]=-f,a[3]=0,a[7]=0,a[11]=0,a[15]=1,this}equals(e){const t=this.elements,i=e.elements;for(let r=0;r<16;r++)if(t[r]!==i[r])return!1;return!0}fromArray(e,t=0){for(let i=0;i<16;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){const i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}}ce.prototype.isMatrix4=!0;const ri=new w,Ct=new ce,ff=new w(0,0,0),pf=new w(1,1,1),cn=new w,Jr=new w,St=new w,Nc=new ce,zc=new at;class Jn{constructor(e=0,t=0,i=0,r=Jn.DefaultOrder){this._x=e,this._y=t,this._z=i,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,i,r){return this._x=e,this._y=t,this._z=i,this._order=r||this._order,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t,i){const r=me.clamp,s=e.elements,o=s[0],a=s[4],c=s[8],l=s[1],u=s[5],h=s[9],d=s[2],f=s[6],p=s[10];switch(t=t||this._order,t){case"XYZ":this._y=Math.asin(r(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-h,p),this._z=Math.atan2(-a,o)):(this._x=Math.atan2(f,u),this._z=0);break;case"YXZ":this._x=Math.asin(-r(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(c,p),this._z=Math.atan2(l,u)):(this._y=Math.atan2(-d,o),this._z=0);break;case"ZXY":this._x=Math.asin(r(f,-1,1)),Math.abs(f)<.9999999?(this._y=Math.atan2(-d,p),this._z=Math.atan2(-a,u)):(this._y=0,this._z=Math.atan2(l,o));break;case"ZYX":this._y=Math.asin(-r(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(f,p),this._z=Math.atan2(l,o)):(this._x=0,this._z=Math.atan2(-a,u));break;case"YZX":this._z=Math.asin(r(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,u),this._y=Math.atan2(-d,o)):(this._x=0,this._y=Math.atan2(c,p));break;case"XZY":this._z=Math.asin(-r(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(f,u),this._y=Math.atan2(c,o)):(this._x=Math.atan2(-h,p),this._y=0);break;default:}return this._order=t,i!==!1&&this._onChangeCallback(),this}setFromQuaternion(e,t,i){return Nc.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Nc,t,i)}setFromVector3(e,t){return this.set(e.x,e.y,e.z,t||this._order)}reorder(e){return zc.setFromEuler(this),this.setFromQuaternion(zc,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}toVector3(e){return e?e.set(this._x,this._y,this._z):new w(this._x,this._y,this._z)}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}}Jn.prototype.isEuler=!0;Jn.DefaultOrder="XYZ";Jn.RotationOrders=["XYZ","YZX","ZXY","XZY","YXZ","ZYX"];class Ga{constructor(){this.mask=1}set(e){this.mask=1<<e|0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}}let mf=0;const Oc=new w,si=new at,jt=new ce,$r=new w,Hi=new w,gf=new w,yf=new at,Uc=new w(1,0,0),Hc=new w(0,1,0),Gc=new w(0,0,1),xf={type:"added"},kc={type:"removed"};function de(){Object.defineProperty(this,"id",{value:mf++}),this.uuid=me.generateUUID(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=de.DefaultUp.clone();const n=new w,e=new Jn,t=new at,i=new w(1,1,1);function r(){t.setFromEuler(e,!1)}function s(){e.setFromQuaternion(t,void 0,!1)}e._onChange(r),t._onChange(s),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:n},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:t},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new ce},normalMatrix:{value:new rt}}),this.matrix=new ce,this.matrixWorld=new ce,this.matrixAutoUpdate=de.DefaultMatrixAutoUpdate,this.matrixWorldNeedsUpdate=!1,this.layers=new Ga,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}de.DefaultUp=new w(0,1,0);de.DefaultMatrixAutoUpdate=!0;de.prototype=Object.assign(Object.create(nn.prototype),{constructor:de,isObject3D:!0,onBeforeRender:function(){},onAfterRender:function(){},applyMatrix4:function(n){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(n),this.matrix.decompose(this.position,this.quaternion,this.scale)},applyQuaternion:function(n){return this.quaternion.premultiply(n),this},setRotationFromAxisAngle:function(n,e){this.quaternion.setFromAxisAngle(n,e)},setRotationFromEuler:function(n){this.quaternion.setFromEuler(n,!0)},setRotationFromMatrix:function(n){this.quaternion.setFromRotationMatrix(n)},setRotationFromQuaternion:function(n){this.quaternion.copy(n)},rotateOnAxis:function(n,e){return si.setFromAxisAngle(n,e),this.quaternion.multiply(si),this},rotateOnWorldAxis:function(n,e){return si.setFromAxisAngle(n,e),this.quaternion.premultiply(si),this},rotateX:function(n){return this.rotateOnAxis(Uc,n)},rotateY:function(n){return this.rotateOnAxis(Hc,n)},rotateZ:function(n){return this.rotateOnAxis(Gc,n)},translateOnAxis:function(n,e){return Oc.copy(n).applyQuaternion(this.quaternion),this.position.add(Oc.multiplyScalar(e)),this},translateX:function(n){return this.translateOnAxis(Uc,n)},translateY:function(n){return this.translateOnAxis(Hc,n)},translateZ:function(n){return this.translateOnAxis(Gc,n)},localToWorld:function(n){return n.applyMatrix4(this.matrixWorld)},worldToLocal:function(n){return n.applyMatrix4(jt.copy(this.matrixWorld).invert())},lookAt:function(n,e,t){n.isVector3?$r.copy(n):$r.set(n,e,t);const i=this.parent;this.updateWorldMatrix(!0,!1),Hi.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?jt.lookAt(Hi,$r,this.up):jt.lookAt($r,Hi,this.up),this.quaternion.setFromRotationMatrix(jt),i&&(jt.extractRotation(i.matrixWorld),si.setFromRotationMatrix(jt),this.quaternion.premultiply(si.invert()))},add:function(n){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return n===this?this:(n&&n.isObject3D&&(n.parent!==null&&n.parent.remove(n),n.parent=this,this.children.push(n),n.dispatchEvent(xf)),this)},remove:function(n){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.remove(arguments[t]);return this}const e=this.children.indexOf(n);return e!==-1&&(n.parent=null,this.children.splice(e,1),n.dispatchEvent(kc)),this},clear:function(){for(let n=0;n<this.children.length;n++){const e=this.children[n];e.parent=null,e.dispatchEvent(kc)}return this.children.length=0,this},attach:function(n){return this.updateWorldMatrix(!0,!1),jt.copy(this.matrixWorld).invert(),n.parent!==null&&(n.parent.updateWorldMatrix(!0,!1),jt.multiply(n.parent.matrixWorld)),n.applyMatrix4(jt),this.add(n),n.updateWorldMatrix(!1,!0),this},getObjectById:function(n){return this.getObjectByProperty("id",n)},getObjectByName:function(n){return this.getObjectByProperty("name",n)},getObjectByProperty:function(n,e){if(this[n]===e)return this;for(let t=0,i=this.children.length;t<i;t++){const s=this.children[t].getObjectByProperty(n,e);if(s!==void 0)return s}},getWorldPosition:function(n){return n===void 0&&(n=new w),this.updateWorldMatrix(!0,!1),n.setFromMatrixPosition(this.matrixWorld)},getWorldQuaternion:function(n){return n===void 0&&(n=new at),this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Hi,n,gf),n},getWorldScale:function(n){return n===void 0&&(n=new w),this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Hi,yf,n),n},getWorldDirection:function(n){n===void 0&&(n=new w),this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return n.set(e[8],e[9],e[10]).normalize()},raycast:function(){},traverse:function(n){n(this);const e=this.children;for(let t=0,i=e.length;t<i;t++)e[t].traverse(n)},traverseVisible:function(n){if(this.visible===!1)return;n(this);const e=this.children;for(let t=0,i=e.length;t<i;t++)e[t].traverseVisible(n)},traverseAncestors:function(n){const e=this.parent;e!==null&&(n(e),e.traverseAncestors(n))},updateMatrix:function(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0},updateMatrixWorld:function(n){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),this.matrixWorldNeedsUpdate=!1,n=!0);const e=this.children;for(let t=0,i=e.length;t<i;t++)e[t].updateMatrixWorld(n)},updateWorldMatrix:function(n,e){const t=this.parent;if(n===!0&&t!==null&&t.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix),e===!0){const i=this.children;for(let r=0,s=i.length;r<s;r++)i[r].updateWorldMatrix(!1,!0)}},toJSON:function(n){const e=n===void 0||typeof n=="string",t={};e&&(n={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{}},t.metadata={version:4.5,type:"Object",generator:"Object3D.toJSON"});const i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),JSON.stringify(this.userData)!=="{}"&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON()));function r(o,a){return o[a.uuid]===void 0&&(o[a.uuid]=a.toJSON(n)),a.uuid}if(this.isMesh||this.isLine||this.isPoints){i.geometry=r(n.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const a=o.shapes;if(Array.isArray(a))for(let c=0,l=a.length;c<l;c++){const u=a[c];r(n.shapes,u)}else r(n.shapes,a)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(n.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let a=0,c=this.material.length;a<c;a++)o.push(r(n.materials,this.material[a]));i.material=o}else i.material=r(n.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(n).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){const a=this.animations[o];i.animations.push(r(n.animations,a))}}if(e){const o=s(n.geometries),a=s(n.materials),c=s(n.textures),l=s(n.images),u=s(n.shapes),h=s(n.skeletons),d=s(n.animations);o.length>0&&(t.geometries=o),a.length>0&&(t.materials=a),c.length>0&&(t.textures=c),l.length>0&&(t.images=l),u.length>0&&(t.shapes=u),h.length>0&&(t.skeletons=h),d.length>0&&(t.animations=d)}return t.object=i,t;function s(o){const a=[];for(const c in o){const l=o[c];delete l.metadata,a.push(l)}return a}},clone:function(n){return new this.constructor().copy(this,n)},copy:function(n,e=!0){if(this.name=n.name,this.up.copy(n.up),this.position.copy(n.position),this.rotation.order=n.rotation.order,this.quaternion.copy(n.quaternion),this.scale.copy(n.scale),this.matrix.copy(n.matrix),this.matrixWorld.copy(n.matrixWorld),this.matrixAutoUpdate=n.matrixAutoUpdate,this.matrixWorldNeedsUpdate=n.matrixWorldNeedsUpdate,this.layers.mask=n.layers.mask,this.visible=n.visible,this.castShadow=n.castShadow,this.receiveShadow=n.receiveShadow,this.frustumCulled=n.frustumCulled,this.renderOrder=n.renderOrder,this.userData=JSON.parse(JSON.stringify(n.userData)),e===!0)for(let t=0;t<n.children.length;t++){const i=n.children[t];this.add(i.clone())}return this}});const Do=new w,vf=new w,_f=new rt;class Ft{constructor(e=new w(1,0,0),t=0){this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,i,r){return this.normal.set(e,t,i),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,i){const r=Do.subVectors(i,t).cross(vf.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t===void 0&&(t=new w),t.copy(this.normal).multiplyScalar(-this.distanceToPoint(e)).add(e)}intersectLine(e,t){t===void 0&&(t=new w);const i=e.delta(Do),r=this.normal.dot(i);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const s=-(e.start.dot(this.normal)+this.constant)/r;return s<0||s>1?null:t.copy(i).multiplyScalar(s).add(e.start)}intersectsLine(e){const t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&i>0||i<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e===void 0&&(e=new w),e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const i=t||_f.getNormalMatrix(e),r=this.coplanarPoint(Do).applyMatrix4(e),s=this.normal.applyMatrix3(i).normalize();return this.constant=-r.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}Ft.prototype.isPlane=!0;const Pt=new w,Zt=new w,Fo=new w,Jt=new w,oi=new w,ai=new w,Vc=new w,Bo=new w,No=new w,zo=new w;class Je{constructor(e=new w,t=new w,i=new w){this.a=e,this.b=t,this.c=i}static getNormal(e,t,i,r){r===void 0&&(r=new w),r.subVectors(i,t),Pt.subVectors(e,t),r.cross(Pt);const s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(e,t,i,r,s){Pt.subVectors(r,t),Zt.subVectors(i,t),Fo.subVectors(e,t);const o=Pt.dot(Pt),a=Pt.dot(Zt),c=Pt.dot(Fo),l=Zt.dot(Zt),u=Zt.dot(Fo),h=o*l-a*a;if(s===void 0&&(s=new w),h===0)return s.set(-2,-1,-1);const d=1/h,f=(l*c-a*u)*d,p=(o*u-a*c)*d;return s.set(1-f-p,p,f)}static containsPoint(e,t,i,r){return this.getBarycoord(e,t,i,r,Jt),Jt.x>=0&&Jt.y>=0&&Jt.x+Jt.y<=1}static getUV(e,t,i,r,s,o,a,c){return this.getBarycoord(e,t,i,r,Jt),c.set(0,0),c.addScaledVector(s,Jt.x),c.addScaledVector(o,Jt.y),c.addScaledVector(a,Jt.z),c}static isFrontFacing(e,t,i,r){return Pt.subVectors(i,t),Zt.subVectors(e,t),Pt.cross(Zt).dot(r)<0}set(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this}setFromPointsAndIndices(e,t,i,r){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[r]),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Pt.subVectors(this.c,this.b),Zt.subVectors(this.a,this.b),Pt.cross(Zt).length()*.5}getMidpoint(e){return e===void 0&&(e=new w),e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return Je.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e===void 0&&(e=new Ft),e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return Je.getBarycoord(e,this.a,this.b,this.c,t)}getUV(e,t,i,r,s){return Je.getUV(e,this.a,this.b,this.c,t,i,r,s)}containsPoint(e){return Je.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return Je.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){t===void 0&&(t=new w);const i=this.a,r=this.b,s=this.c;let o,a;oi.subVectors(r,i),ai.subVectors(s,i),Bo.subVectors(e,i);const c=oi.dot(Bo),l=ai.dot(Bo);if(c<=0&&l<=0)return t.copy(i);No.subVectors(e,r);const u=oi.dot(No),h=ai.dot(No);if(u>=0&&h<=u)return t.copy(r);const d=c*h-u*l;if(d<=0&&c>=0&&u<=0)return o=c/(c-u),t.copy(i).addScaledVector(oi,o);zo.subVectors(e,s);const f=oi.dot(zo),p=ai.dot(zo);if(p>=0&&f<=p)return t.copy(s);const y=f*l-c*p;if(y<=0&&l>=0&&p<=0)return a=l/(l-p),t.copy(i).addScaledVector(ai,a);const x=u*p-f*h;if(x<=0&&h-u>=0&&f-p>=0)return Vc.subVectors(s,r),a=(h-u)/(h-u+(f-p)),t.copy(r).addScaledVector(Vc,a);const g=1/(x+y+d);return o=y*g,a=d*g,t.copy(i).addScaledVector(oi,o).addScaledVector(ai,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}let bf=0;function Ve(){Object.defineProperty(this,"id",{value:bf++}),this.uuid=me.generateUUID(),this.name="",this.type="Material",this.fog=!0,this.blending=_i,this.side=Li,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.blendSrc=Fa,this.blendDst=Ba,this.blendEquation=Nn,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.depthFunc=Fs,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Lu,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Ds,this.stencilZFail=Ds,this.stencilZPass=Ds,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaTest=0,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0}Ve.prototype=Object.assign(Object.create(nn.prototype),{constructor:Ve,isMaterial:!0,onBeforeCompile:function(){},customProgramCacheKey:function(){return this.onBeforeCompile.toString()},setValues:function(n){if(n!==void 0)for(const e in n){const t=n[e];if(t===void 0)continue;if(e==="shading"){this.flatShading=t===Da;continue}const i=this[e];i!==void 0&&(i&&i.isColor?i.set(t):i&&i.isVector3&&t&&t.isVector3?i.copy(t):this[e]=t)}},toJSON:function(n){const e=n===void 0||typeof n=="string";e&&(n={textures:{},images:{}});const t={metadata:{version:4.5,type:"Material",generator:"Material.toJSON"}};t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),this.color&&this.color.isColor&&(t.color=this.color.getHex()),this.roughness!==void 0&&(t.roughness=this.roughness),this.metalness!==void 0&&(t.metalness=this.metalness),this.sheen&&this.sheen.isColor&&(t.sheen=this.sheen.getHex()),this.emissive&&this.emissive.isColor&&(t.emissive=this.emissive.getHex()),this.emissiveIntensity&&this.emissiveIntensity!==1&&(t.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(t.specular=this.specular.getHex()),this.shininess!==void 0&&(t.shininess=this.shininess),this.clearcoat!==void 0&&(t.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(t.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(t.clearcoatMap=this.clearcoatMap.toJSON(n).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(t.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(n).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(t.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(n).uuid,t.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.map&&this.map.isTexture&&(t.map=this.map.toJSON(n).uuid),this.matcap&&this.matcap.isTexture&&(t.matcap=this.matcap.toJSON(n).uuid),this.alphaMap&&this.alphaMap.isTexture&&(t.alphaMap=this.alphaMap.toJSON(n).uuid),this.lightMap&&this.lightMap.isTexture&&(t.lightMap=this.lightMap.toJSON(n).uuid,t.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(t.aoMap=this.aoMap.toJSON(n).uuid,t.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(t.bumpMap=this.bumpMap.toJSON(n).uuid,t.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(t.normalMap=this.normalMap.toJSON(n).uuid,t.normalMapType=this.normalMapType,t.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(t.displacementMap=this.displacementMap.toJSON(n).uuid,t.displacementScale=this.displacementScale,t.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(t.roughnessMap=this.roughnessMap.toJSON(n).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(t.metalnessMap=this.metalnessMap.toJSON(n).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(t.emissiveMap=this.emissiveMap.toJSON(n).uuid),this.specularMap&&this.specularMap.isTexture&&(t.specularMap=this.specularMap.toJSON(n).uuid),this.envMap&&this.envMap.isTexture&&(t.envMap=this.envMap.toJSON(n).uuid,t.reflectivity=this.reflectivity,t.refractionRatio=this.refractionRatio,this.combine!==void 0&&(t.combine=this.combine),this.envMapIntensity!==void 0&&(t.envMapIntensity=this.envMapIntensity)),this.gradientMap&&this.gradientMap.isTexture&&(t.gradientMap=this.gradientMap.toJSON(n).uuid),this.size!==void 0&&(t.size=this.size),this.shadowSide!==null&&(t.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(t.sizeAttenuation=this.sizeAttenuation),this.blending!==_i&&(t.blending=this.blending),this.side!==Li&&(t.side=this.side),this.vertexColors&&(t.vertexColors=!0),this.opacity<1&&(t.opacity=this.opacity),this.transparent===!0&&(t.transparent=this.transparent),t.depthFunc=this.depthFunc,t.depthTest=this.depthTest,t.depthWrite=this.depthWrite,t.colorWrite=this.colorWrite,t.stencilWrite=this.stencilWrite,t.stencilWriteMask=this.stencilWriteMask,t.stencilFunc=this.stencilFunc,t.stencilRef=this.stencilRef,t.stencilFuncMask=this.stencilFuncMask,t.stencilFail=this.stencilFail,t.stencilZFail=this.stencilZFail,t.stencilZPass=this.stencilZPass,this.rotation&&this.rotation!==0&&(t.rotation=this.rotation),this.polygonOffset===!0&&(t.polygonOffset=!0),this.polygonOffsetFactor!==0&&(t.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(t.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth&&this.linewidth!==1&&(t.linewidth=this.linewidth),this.dashSize!==void 0&&(t.dashSize=this.dashSize),this.gapSize!==void 0&&(t.gapSize=this.gapSize),this.scale!==void 0&&(t.scale=this.scale),this.dithering===!0&&(t.dithering=!0),this.alphaTest>0&&(t.alphaTest=this.alphaTest),this.alphaToCoverage===!0&&(t.alphaToCoverage=this.alphaToCoverage),this.premultipliedAlpha===!0&&(t.premultipliedAlpha=this.premultipliedAlpha),this.wireframe===!0&&(t.wireframe=this.wireframe),this.wireframeLinewidth>1&&(t.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(t.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(t.wireframeLinejoin=this.wireframeLinejoin),this.morphTargets===!0&&(t.morphTargets=!0),this.morphNormals===!0&&(t.morphNormals=!0),this.skinning===!0&&(t.skinning=!0),this.flatShading===!0&&(t.flatShading=this.flatShading),this.visible===!1&&(t.visible=!1),this.toneMapped===!1&&(t.toneMapped=!1),JSON.stringify(this.userData)!=="{}"&&(t.userData=this.userData);function i(r){const s=[];for(const o in r){const a=r[o];delete a.metadata,s.push(a)}return s}if(e){const r=i(n.textures),s=i(n.images);r.length>0&&(t.textures=r),s.length>0&&(t.images=s)}return t},clone:function(){return new this.constructor().copy(this)},copy:function(n){this.name=n.name,this.fog=n.fog,this.blending=n.blending,this.side=n.side,this.vertexColors=n.vertexColors,this.opacity=n.opacity,this.transparent=n.transparent,this.blendSrc=n.blendSrc,this.blendDst=n.blendDst,this.blendEquation=n.blendEquation,this.blendSrcAlpha=n.blendSrcAlpha,this.blendDstAlpha=n.blendDstAlpha,this.blendEquationAlpha=n.blendEquationAlpha,this.depthFunc=n.depthFunc,this.depthTest=n.depthTest,this.depthWrite=n.depthWrite,this.stencilWriteMask=n.stencilWriteMask,this.stencilFunc=n.stencilFunc,this.stencilRef=n.stencilRef,this.stencilFuncMask=n.stencilFuncMask,this.stencilFail=n.stencilFail,this.stencilZFail=n.stencilZFail,this.stencilZPass=n.stencilZPass,this.stencilWrite=n.stencilWrite;const e=n.clippingPlanes;let t=null;if(e!==null){const i=e.length;t=new Array(i);for(let r=0;r!==i;++r)t[r]=e[r].clone()}return this.clippingPlanes=t,this.clipIntersection=n.clipIntersection,this.clipShadows=n.clipShadows,this.shadowSide=n.shadowSide,this.colorWrite=n.colorWrite,this.precision=n.precision,this.polygonOffset=n.polygonOffset,this.polygonOffsetFactor=n.polygonOffsetFactor,this.polygonOffsetUnits=n.polygonOffsetUnits,this.dithering=n.dithering,this.alphaTest=n.alphaTest,this.alphaToCoverage=n.alphaToCoverage,this.premultipliedAlpha=n.premultipliedAlpha,this.visible=n.visible,this.toneMapped=n.toneMapped,this.userData=JSON.parse(JSON.stringify(n.userData)),this},dispose:function(){this.dispatchEvent({type:"dispose"})}});Object.defineProperty(Ve.prototype,"needsUpdate",{set:function(n){n===!0&&this.version++}});const Cu={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},It={h:0,s:0,l:0},Qr={h:0,s:0,l:0};function Oo(n,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?n+(e-n)*6*t:t<1/2?e:t<2/3?n+(e-n)*6*(2/3-t):n}function Uo(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function Ho(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}class re{constructor(e,t,i){return t===void 0&&i===void 0?this.set(e):this.setRGB(e,t,i)}set(e){return e&&e.isColor?this.copy(e):typeof e=="number"?this.setHex(e):typeof e=="string"&&this.setStyle(e),this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,this}setRGB(e,t,i){return this.r=e,this.g=t,this.b=i,this}setHSL(e,t,i){if(e=me.euclideanModulo(e,1),t=me.clamp(t,0,1),i=me.clamp(i,0,1),t===0)this.r=this.g=this.b=i;else{const r=i<=.5?i*(1+t):i+t-i*t,s=2*i-r;this.r=Oo(s,r,e+1/3),this.g=Oo(s,r,e),this.b=Oo(s,r,e-1/3)}return this}setStyle(e){function t(r){r!==void 0&&parseFloat(r)<1}let i;if(i=/^((?:rgb|hsl)a?)\(([^\)]*)\)/.exec(e)){let r;const s=i[1],o=i[2];switch(s){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return this.r=Math.min(255,parseInt(r[1],10))/255,this.g=Math.min(255,parseInt(r[2],10))/255,this.b=Math.min(255,parseInt(r[3],10))/255,t(r[4]),this;if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return this.r=Math.min(100,parseInt(r[1],10))/100,this.g=Math.min(100,parseInt(r[2],10))/100,this.b=Math.min(100,parseInt(r[3],10))/100,t(r[4]),this;break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o)){const a=parseFloat(r[1])/360,c=parseInt(r[2],10)/100,l=parseInt(r[3],10)/100;return t(r[4]),this.setHSL(a,c,l)}break}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(e)){const r=i[1],s=r.length;if(s===3)return this.r=parseInt(r.charAt(0)+r.charAt(0),16)/255,this.g=parseInt(r.charAt(1)+r.charAt(1),16)/255,this.b=parseInt(r.charAt(2)+r.charAt(2),16)/255,this;if(s===6)return this.r=parseInt(r.charAt(0)+r.charAt(1),16)/255,this.g=parseInt(r.charAt(2)+r.charAt(3),16)/255,this.b=parseInt(r.charAt(4)+r.charAt(5),16)/255,this}return e&&e.length>0?this.setColorName(e):this}setColorName(e){const t=Cu[e];return t!==void 0&&this.setHex(t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copyGammaToLinear(e,t=2){return this.r=Math.pow(e.r,t),this.g=Math.pow(e.g,t),this.b=Math.pow(e.b,t),this}copyLinearToGamma(e,t=2){const i=t>0?1/t:1;return this.r=Math.pow(e.r,i),this.g=Math.pow(e.g,i),this.b=Math.pow(e.b,i),this}convertGammaToLinear(e){return this.copyGammaToLinear(this,e),this}convertLinearToGamma(e){return this.copyLinearToGamma(this,e),this}copySRGBToLinear(e){return this.r=Uo(e.r),this.g=Uo(e.g),this.b=Uo(e.b),this}copyLinearToSRGB(e){return this.r=Ho(e.r),this.g=Ho(e.g),this.b=Ho(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(){return this.r*255<<16^this.g*255<<8^this.b*255<<0}getHexString(){return("000000"+this.getHex().toString(16)).slice(-6)}getHSL(e){e===void 0&&(e={h:0,s:0,l:0});const t=this.r,i=this.g,r=this.b,s=Math.max(t,i,r),o=Math.min(t,i,r);let a,c;const l=(o+s)/2;if(o===s)a=0,c=0;else{const u=s-o;switch(c=l<=.5?u/(s+o):u/(2-s-o),s){case t:a=(i-r)/u+(i<r?6:0);break;case i:a=(r-t)/u+2;break;case r:a=(t-i)/u+4;break}a/=6}return e.h=a,e.s=c,e.l=l,e}getStyle(){return"rgb("+(this.r*255|0)+","+(this.g*255|0)+","+(this.b*255|0)+")"}offsetHSL(e,t,i){return this.getHSL(It),It.h+=e,It.s+=t,It.l+=i,this.setHSL(It.h,It.s,It.l),this}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,i){return this.r=e.r+(t.r-e.r)*i,this.g=e.g+(t.g-e.g)*i,this.b=e.b+(t.b-e.b)*i,this}lerpHSL(e,t){this.getHSL(It),e.getHSL(Qr);const i=me.lerp(It.h,Qr.h,t),r=me.lerp(It.s,Qr.s,t),s=me.lerp(It.l,Qr.l,t);return this.setHSL(i,r,s),this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),e.normalized===!0&&(this.r/=255,this.g/=255,this.b/=255),this}toJSON(){return this.getHex()}}re.NAMES=Cu;re.prototype.isColor=!0;re.prototype.r=1;re.prototype.g=1;re.prototype.b=1;class rn extends Ve{constructor(e){super(),this.type="MeshBasicMaterial",this.color=new re(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=Dr,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this}}rn.prototype.isMeshBasicMaterial=!0;const He=new w,Kr=new W;function fe(n,e,t){if(Array.isArray(n))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.name="",this.array=n,this.itemSize=e,this.count=n!==void 0?n.length/e:0,this.normalized=t===!0,this.usage=Ii,this.updateRange={offset:0,count:-1},this.version=0}Object.defineProperty(fe.prototype,"needsUpdate",{set:function(n){n===!0&&this.version++}});Object.assign(fe.prototype,{isBufferAttribute:!0,onUploadCallback:function(){},setUsage:function(n){return this.usage=n,this},copy:function(n){return this.name=n.name,this.array=new n.array.constructor(n.array),this.itemSize=n.itemSize,this.count=n.count,this.normalized=n.normalized,this.usage=n.usage,this},copyAt:function(n,e,t){n*=this.itemSize,t*=e.itemSize;for(let i=0,r=this.itemSize;i<r;i++)this.array[n+i]=e.array[t+i];return this},copyArray:function(n){return this.array.set(n),this},copyColorsArray:function(n){const e=this.array;let t=0;for(let i=0,r=n.length;i<r;i++){let s=n[i];s===void 0&&(s=new re),e[t++]=s.r,e[t++]=s.g,e[t++]=s.b}return this},copyVector2sArray:function(n){const e=this.array;let t=0;for(let i=0,r=n.length;i<r;i++){let s=n[i];s===void 0&&(s=new W),e[t++]=s.x,e[t++]=s.y}return this},copyVector3sArray:function(n){const e=this.array;let t=0;for(let i=0,r=n.length;i<r;i++){let s=n[i];s===void 0&&(s=new w),e[t++]=s.x,e[t++]=s.y,e[t++]=s.z}return this},copyVector4sArray:function(n){const e=this.array;let t=0;for(let i=0,r=n.length;i<r;i++){let s=n[i];s===void 0&&(s=new Be),e[t++]=s.x,e[t++]=s.y,e[t++]=s.z,e[t++]=s.w}return this},applyMatrix3:function(n){if(this.itemSize===2)for(let e=0,t=this.count;e<t;e++)Kr.fromBufferAttribute(this,e),Kr.applyMatrix3(n),this.setXY(e,Kr.x,Kr.y);else if(this.itemSize===3)for(let e=0,t=this.count;e<t;e++)He.fromBufferAttribute(this,e),He.applyMatrix3(n),this.setXYZ(e,He.x,He.y,He.z);return this},applyMatrix4:function(n){for(let e=0,t=this.count;e<t;e++)He.x=this.getX(e),He.y=this.getY(e),He.z=this.getZ(e),He.applyMatrix4(n),this.setXYZ(e,He.x,He.y,He.z);return this},applyNormalMatrix:function(n){for(let e=0,t=this.count;e<t;e++)He.x=this.getX(e),He.y=this.getY(e),He.z=this.getZ(e),He.applyNormalMatrix(n),this.setXYZ(e,He.x,He.y,He.z);return this},transformDirection:function(n){for(let e=0,t=this.count;e<t;e++)He.x=this.getX(e),He.y=this.getY(e),He.z=this.getZ(e),He.transformDirection(n),this.setXYZ(e,He.x,He.y,He.z);return this},set:function(n,e=0){return this.array.set(n,e),this},getX:function(n){return this.array[n*this.itemSize]},setX:function(n,e){return this.array[n*this.itemSize]=e,this},getY:function(n){return this.array[n*this.itemSize+1]},setY:function(n,e){return this.array[n*this.itemSize+1]=e,this},getZ:function(n){return this.array[n*this.itemSize+2]},setZ:function(n,e){return this.array[n*this.itemSize+2]=e,this},getW:function(n){return this.array[n*this.itemSize+3]},setW:function(n,e){return this.array[n*this.itemSize+3]=e,this},setXY:function(n,e,t){return n*=this.itemSize,this.array[n+0]=e,this.array[n+1]=t,this},setXYZ:function(n,e,t,i){return n*=this.itemSize,this.array[n+0]=e,this.array[n+1]=t,this.array[n+2]=i,this},setXYZW:function(n,e,t,i,r){return n*=this.itemSize,this.array[n+0]=e,this.array[n+1]=t,this.array[n+2]=i,this.array[n+3]=r,this},onUpload:function(n){return this.onUploadCallback=n,this},clone:function(){return new this.constructor(this.array,this.itemSize).copy(this)},toJSON:function(){const n={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.prototype.slice.call(this.array),normalized:this.normalized};return this.name!==""&&(n.name=this.name),this.usage!==Ii&&(n.usage=this.usage),(this.updateRange.offset!==0||this.updateRange.count!==-1)&&(n.updateRange=this.updateRange),n}});function lr(n,e,t){fe.call(this,new Int8Array(n),e,t)}lr.prototype=Object.create(fe.prototype);lr.prototype.constructor=lr;function hr(n,e,t){fe.call(this,new Uint8Array(n),e,t)}hr.prototype=Object.create(fe.prototype);hr.prototype.constructor=hr;function ur(n,e,t){fe.call(this,new Uint8ClampedArray(n),e,t)}ur.prototype=Object.create(fe.prototype);ur.prototype.constructor=ur;function dr(n,e,t){fe.call(this,new Int16Array(n),e,t)}dr.prototype=Object.create(fe.prototype);dr.prototype.constructor=dr;function Vn(n,e,t){fe.call(this,new Uint16Array(n),e,t)}Vn.prototype=Object.create(fe.prototype);Vn.prototype.constructor=Vn;function fr(n,e,t){fe.call(this,new Int32Array(n),e,t)}fr.prototype=Object.create(fe.prototype);fr.prototype.constructor=fr;function Wn(n,e,t){fe.call(this,new Uint32Array(n),e,t)}Wn.prototype=Object.create(fe.prototype);Wn.prototype.constructor=Wn;function pr(n,e,t){fe.call(this,new Uint16Array(n),e,t)}pr.prototype=Object.create(fe.prototype);pr.prototype.constructor=pr;pr.prototype.isFloat16BufferAttribute=!0;function se(n,e,t){fe.call(this,new Float32Array(n),e,t)}se.prototype=Object.create(fe.prototype);se.prototype.constructor=se;function mr(n,e,t){fe.call(this,new Float64Array(n),e,t)}mr.prototype=Object.create(fe.prototype);mr.prototype.constructor=mr;function Pu(n){if(n.length===0)return-1/0;let e=n[0];for(let t=1,i=n.length;t<i;++t)n[t]>e&&(e=n[t]);return e}const wf={Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array};function Ji(n,e){return new wf[n](e)}let Mf=0;const Ht=new ce,Go=new de,ci=new w,Tt=new Mt,Gi=new Mt,ot=new w;function le(){Object.defineProperty(this,"id",{value:Mf++}),this.uuid=me.generateUUID(),this.name="",this.type="BufferGeometry",this.index=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}le.prototype=Object.assign(Object.create(nn.prototype),{constructor:le,isBufferGeometry:!0,getIndex:function(){return this.index},setIndex:function(n){return Array.isArray(n)?this.index=new(Pu(n)>65535?Wn:Vn)(n,1):this.index=n,this},getAttribute:function(n){return this.attributes[n]},setAttribute:function(n,e){return this.attributes[n]=e,this},deleteAttribute:function(n){return delete this.attributes[n],this},hasAttribute:function(n){return this.attributes[n]!==void 0},addGroup:function(n,e,t=0){this.groups.push({start:n,count:e,materialIndex:t})},clearGroups:function(){this.groups=[]},setDrawRange:function(n,e){this.drawRange.start=n,this.drawRange.count=e},applyMatrix4:function(n){const e=this.attributes.position;e!==void 0&&(e.applyMatrix4(n),e.needsUpdate=!0);const t=this.attributes.normal;if(t!==void 0){const r=new rt().getNormalMatrix(n);t.applyNormalMatrix(r),t.needsUpdate=!0}const i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(n),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this},rotateX:function(n){return Ht.makeRotationX(n),this.applyMatrix4(Ht),this},rotateY:function(n){return Ht.makeRotationY(n),this.applyMatrix4(Ht),this},rotateZ:function(n){return Ht.makeRotationZ(n),this.applyMatrix4(Ht),this},translate:function(n,e,t){return Ht.makeTranslation(n,e,t),this.applyMatrix4(Ht),this},scale:function(n,e,t){return Ht.makeScale(n,e,t),this.applyMatrix4(Ht),this},lookAt:function(n){return Go.lookAt(n),Go.updateMatrix(),this.applyMatrix4(Go.matrix),this},center:function(){return this.computeBoundingBox(),this.boundingBox.getCenter(ci).negate(),this.translate(ci.x,ci.y,ci.z),this},setFromPoints:function(n){const e=[];for(let t=0,i=n.length;t<i;t++){const r=n[t];e.push(r.x,r.y,r.z||0)}return this.setAttribute("position",new se(e,3)),this},computeBoundingBox:function(){this.boundingBox===null&&(this.boundingBox=new Mt);const n=this.attributes.position,e=this.morphAttributes.position;if(n&&n.isGLBufferAttribute){this.boundingBox.set(new w(-1/0,-1/0,-1/0),new w(1/0,1/0,1/0));return}if(n!==void 0){if(this.boundingBox.setFromBufferAttribute(n),e)for(let t=0,i=e.length;t<i;t++){const r=e[t];Tt.setFromBufferAttribute(r),this.morphTargetsRelative?(ot.addVectors(this.boundingBox.min,Tt.min),this.boundingBox.expandByPoint(ot),ot.addVectors(this.boundingBox.max,Tt.max),this.boundingBox.expandByPoint(ot)):(this.boundingBox.expandByPoint(Tt.min),this.boundingBox.expandByPoint(Tt.max))}}else this.boundingBox.makeEmpty();isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z)},computeBoundingSphere:function(){this.boundingSphere===null&&(this.boundingSphere=new wn);const n=this.attributes.position,e=this.morphAttributes.position;if(n&&n.isGLBufferAttribute){this.boundingSphere.set(new w,1/0);return}if(n){const t=this.boundingSphere.center;if(Tt.setFromBufferAttribute(n),e)for(let r=0,s=e.length;r<s;r++){const o=e[r];Gi.setFromBufferAttribute(o),this.morphTargetsRelative?(ot.addVectors(Tt.min,Gi.min),Tt.expandByPoint(ot),ot.addVectors(Tt.max,Gi.max),Tt.expandByPoint(ot)):(Tt.expandByPoint(Gi.min),Tt.expandByPoint(Gi.max))}Tt.getCenter(t);let i=0;for(let r=0,s=n.count;r<s;r++)ot.fromBufferAttribute(n,r),i=Math.max(i,t.distanceToSquared(ot));if(e)for(let r=0,s=e.length;r<s;r++){const o=e[r],a=this.morphTargetsRelative;for(let c=0,l=o.count;c<l;c++)ot.fromBufferAttribute(o,c),a&&(ci.fromBufferAttribute(n,c),ot.add(ci)),i=Math.max(i,t.distanceToSquared(ot))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)}},computeFaceNormals:function(){},computeTangents:function(){const n=this.index,e=this.attributes;if(n===null||e.position===void 0||e.normal===void 0||e.uv===void 0)return;const t=n.array,i=e.position.array,r=e.normal.array,s=e.uv.array,o=i.length/3;e.tangent===void 0&&this.setAttribute("tangent",new fe(new Float32Array(4*o),4));const a=e.tangent.array,c=[],l=[];for(let R=0;R<o;R++)c[R]=new w,l[R]=new w;const u=new w,h=new w,d=new w,f=new W,p=new W,y=new W,x=new w,g=new w;function m(R,z,P){u.fromArray(i,R*3),h.fromArray(i,z*3),d.fromArray(i,P*3),f.fromArray(s,R*2),p.fromArray(s,z*2),y.fromArray(s,P*2),h.sub(u),d.sub(u),p.sub(f),y.sub(f);const U=1/(p.x*y.y-y.x*p.y);isFinite(U)&&(x.copy(h).multiplyScalar(y.y).addScaledVector(d,-p.y).multiplyScalar(U),g.copy(d).multiplyScalar(p.x).addScaledVector(h,-y.x).multiplyScalar(U),c[R].add(x),c[z].add(x),c[P].add(x),l[R].add(g),l[z].add(g),l[P].add(g))}let b=this.groups;b.length===0&&(b=[{start:0,count:t.length}]);for(let R=0,z=b.length;R<z;++R){const P=b[R],U=P.start,D=P.count;for(let I=U,B=U+D;I<B;I+=3)m(t[I+0],t[I+1],t[I+2])}const _=new w,T=new w,v=new w,A=new w;function L(R){v.fromArray(r,R*3),A.copy(v);const z=c[R];_.copy(z),_.sub(v.multiplyScalar(v.dot(z))).normalize(),T.crossVectors(A,z);const U=T.dot(l[R])<0?-1:1;a[R*4]=_.x,a[R*4+1]=_.y,a[R*4+2]=_.z,a[R*4+3]=U}for(let R=0,z=b.length;R<z;++R){const P=b[R],U=P.start,D=P.count;for(let I=U,B=U+D;I<B;I+=3)L(t[I+0]),L(t[I+1]),L(t[I+2])}},computeVertexNormals:function(){const n=this.index,e=this.getAttribute("position");if(e!==void 0){let t=this.getAttribute("normal");if(t===void 0)t=new fe(new Float32Array(e.count*3),3),this.setAttribute("normal",t);else for(let h=0,d=t.count;h<d;h++)t.setXYZ(h,0,0,0);const i=new w,r=new w,s=new w,o=new w,a=new w,c=new w,l=new w,u=new w;if(n)for(let h=0,d=n.count;h<d;h+=3){const f=n.getX(h+0),p=n.getX(h+1),y=n.getX(h+2);i.fromBufferAttribute(e,f),r.fromBufferAttribute(e,p),s.fromBufferAttribute(e,y),l.subVectors(s,r),u.subVectors(i,r),l.cross(u),o.fromBufferAttribute(t,f),a.fromBufferAttribute(t,p),c.fromBufferAttribute(t,y),o.add(l),a.add(l),c.add(l),t.setXYZ(f,o.x,o.y,o.z),t.setXYZ(p,a.x,a.y,a.z),t.setXYZ(y,c.x,c.y,c.z)}else for(let h=0,d=e.count;h<d;h+=3)i.fromBufferAttribute(e,h+0),r.fromBufferAttribute(e,h+1),s.fromBufferAttribute(e,h+2),l.subVectors(s,r),u.subVectors(i,r),l.cross(u),t.setXYZ(h+0,l.x,l.y,l.z),t.setXYZ(h+1,l.x,l.y,l.z),t.setXYZ(h+2,l.x,l.y,l.z);this.normalizeNormals(),t.needsUpdate=!0}},merge:function(n,e){if(!(n&&n.isBufferGeometry))return;e===void 0&&(e=0);const t=this.attributes;for(const i in t){if(n.attributes[i]===void 0)continue;const s=t[i].array,o=n.attributes[i],a=o.array,c=o.itemSize*e,l=Math.min(a.length,s.length-c);for(let u=0,h=c;u<l;u++,h++)s[h]=a[u]}return this},normalizeNormals:function(){const n=this.attributes.normal;for(let e=0,t=n.count;e<t;e++)ot.fromBufferAttribute(n,e),ot.normalize(),n.setXYZ(e,ot.x,ot.y,ot.z)},toNonIndexed:function(){function n(o,a){const c=o.array,l=o.itemSize,u=o.normalized,h=new c.constructor(a.length*l);let d=0,f=0;for(let p=0,y=a.length;p<y;p++){d=a[p]*l;for(let x=0;x<l;x++)h[f++]=c[d++]}return new fe(h,l,u)}if(this.index===null)return this;const e=new le,t=this.index.array,i=this.attributes;for(const o in i){const a=i[o],c=n(a,t);e.setAttribute(o,c)}const r=this.morphAttributes;for(const o in r){const a=[],c=r[o];for(let l=0,u=c.length;l<u;l++){const h=c[l],d=n(h,t);a.push(d)}e.morphAttributes[o]=a}e.morphTargetsRelative=this.morphTargetsRelative;const s=this.groups;for(let o=0,a=s.length;o<a;o++){const c=s[o];e.addGroup(c.start,c.count,c.materialIndex)}return e},toJSON:function(){const n={metadata:{version:4.5,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),Object.keys(this.userData).length>0&&(n.userData=this.userData),this.parameters!==void 0){const a=this.parameters;for(const c in a)a[c]!==void 0&&(n[c]=a[c]);return n}n.data={attributes:{}};const e=this.index;e!==null&&(n.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});const t=this.attributes;for(const a in t){const c=t[a];n.data.attributes[a]=c.toJSON(n.data)}const i={};let r=!1;for(const a in this.morphAttributes){const c=this.morphAttributes[a],l=[];for(let u=0,h=c.length;u<h;u++){const d=c[u];l.push(d.toJSON(n.data))}l.length>0&&(i[a]=l,r=!0)}r&&(n.data.morphAttributes=i,n.data.morphTargetsRelative=this.morphTargetsRelative);const s=this.groups;s.length>0&&(n.data.groups=JSON.parse(JSON.stringify(s)));const o=this.boundingSphere;return o!==null&&(n.data.boundingSphere={center:o.center.toArray(),radius:o.radius}),n},clone:function(){return new le().copy(this)},copy:function(n){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const e={};this.name=n.name;const t=n.index;t!==null&&this.setIndex(t.clone(e));const i=n.attributes;for(const c in i){const l=i[c];this.setAttribute(c,l.clone(e))}const r=n.morphAttributes;for(const c in r){const l=[],u=r[c];for(let h=0,d=u.length;h<d;h++)l.push(u[h].clone(e));this.morphAttributes[c]=l}this.morphTargetsRelative=n.morphTargetsRelative;const s=n.groups;for(let c=0,l=s.length;c<l;c++){const u=s[c];this.addGroup(u.start,u.count,u.materialIndex)}const o=n.boundingBox;o!==null&&(this.boundingBox=o.clone());const a=n.boundingSphere;return a!==null&&(this.boundingSphere=a.clone()),this.drawRange.start=n.drawRange.start,this.drawRange.count=n.drawRange.count,this.userData=n.userData,this},dispose:function(){this.dispatchEvent({type:"dispose"})}});const Wc=new ce,li=new Mn,ko=new wn,ln=new w,hn=new w,un=new w,Vo=new w,Wo=new w,qo=new w,es=new w,ts=new w,ns=new w,is=new W,rs=new W,ss=new W,Xo=new w,os=new w;function Ge(n=new le,e=new rn){de.call(this),this.type="Mesh",this.geometry=n,this.material=e,this.updateMorphTargets()}Ge.prototype=Object.assign(Object.create(de.prototype),{constructor:Ge,isMesh:!0,copy:function(n){return de.prototype.copy.call(this,n),n.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=n.morphTargetInfluences.slice()),n.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},n.morphTargetDictionary)),this.material=n.material,this.geometry=n.geometry,this},updateMorphTargets:function(){const n=this.geometry;if(n.isBufferGeometry){const e=n.morphAttributes,t=Object.keys(e);if(t.length>0){const i=e[t[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,s=i.length;r<s;r++){const o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}else{const e=n.morphTargets;e!==void 0&&e.length>0}},raycast:function(n,e){const t=this.geometry,i=this.material,r=this.matrixWorld;if(i===void 0||(t.boundingSphere===null&&t.computeBoundingSphere(),ko.copy(t.boundingSphere),ko.applyMatrix4(r),n.ray.intersectsSphere(ko)===!1)||(Wc.copy(r).invert(),li.copy(n.ray).applyMatrix4(Wc),t.boundingBox!==null&&li.intersectsBox(t.boundingBox)===!1))return;let s;if(t.isBufferGeometry){const o=t.index,a=t.attributes.position,c=t.morphAttributes.position,l=t.morphTargetsRelative,u=t.attributes.uv,h=t.attributes.uv2,d=t.groups,f=t.drawRange;if(o!==null)if(Array.isArray(i))for(let p=0,y=d.length;p<y;p++){const x=d[p],g=i[x.materialIndex],m=Math.max(x.start,f.start),b=Math.min(x.start+x.count,f.start+f.count);for(let _=m,T=b;_<T;_+=3){const v=o.getX(_),A=o.getX(_+1),L=o.getX(_+2);s=as(this,g,n,li,a,c,l,u,h,v,A,L),s&&(s.faceIndex=Math.floor(_/3),s.face.materialIndex=x.materialIndex,e.push(s))}}else{const p=Math.max(0,f.start),y=Math.min(o.count,f.start+f.count);for(let x=p,g=y;x<g;x+=3){const m=o.getX(x),b=o.getX(x+1),_=o.getX(x+2);s=as(this,i,n,li,a,c,l,u,h,m,b,_),s&&(s.faceIndex=Math.floor(x/3),e.push(s))}}else if(a!==void 0)if(Array.isArray(i))for(let p=0,y=d.length;p<y;p++){const x=d[p],g=i[x.materialIndex],m=Math.max(x.start,f.start),b=Math.min(x.start+x.count,f.start+f.count);for(let _=m,T=b;_<T;_+=3){const v=_,A=_+1,L=_+2;s=as(this,g,n,li,a,c,l,u,h,v,A,L),s&&(s.faceIndex=Math.floor(_/3),s.face.materialIndex=x.materialIndex,e.push(s))}}else{const p=Math.max(0,f.start),y=Math.min(a.count,f.start+f.count);for(let x=p,g=y;x<g;x+=3){const m=x,b=x+1,_=x+2;s=as(this,i,n,li,a,c,l,u,h,m,b,_),s&&(s.faceIndex=Math.floor(x/3),e.push(s))}}}else t.isGeometry}});function Sf(n,e,t,i,r,s,o,a){let c;if(e.side===Ke?c=i.intersectTriangle(o,s,r,!0,a):c=i.intersectTriangle(r,s,o,e.side!==Ir,a),c===null)return null;os.copy(a),os.applyMatrix4(n.matrixWorld);const l=t.ray.origin.distanceTo(os);return l<t.near||l>t.far?null:{distance:l,point:os.clone(),object:n}}function as(n,e,t,i,r,s,o,a,c,l,u,h){ln.fromBufferAttribute(r,l),hn.fromBufferAttribute(r,u),un.fromBufferAttribute(r,h);const d=n.morphTargetInfluences;if(e.morphTargets&&s&&d){es.set(0,0,0),ts.set(0,0,0),ns.set(0,0,0);for(let p=0,y=s.length;p<y;p++){const x=d[p],g=s[p];x!==0&&(Vo.fromBufferAttribute(g,l),Wo.fromBufferAttribute(g,u),qo.fromBufferAttribute(g,h),o?(es.addScaledVector(Vo,x),ts.addScaledVector(Wo,x),ns.addScaledVector(qo,x)):(es.addScaledVector(Vo.sub(ln),x),ts.addScaledVector(Wo.sub(hn),x),ns.addScaledVector(qo.sub(un),x)))}ln.add(es),hn.add(ts),un.add(ns)}n.isSkinnedMesh&&e.skinning&&(n.boneTransform(l,ln),n.boneTransform(u,hn),n.boneTransform(h,un));const f=Sf(n,e,t,i,ln,hn,un,Xo);if(f){a&&(is.fromBufferAttribute(a,l),rs.fromBufferAttribute(a,u),ss.fromBufferAttribute(a,h),f.uv=Je.getUV(Xo,ln,hn,un,is,rs,ss,new W)),c&&(is.fromBufferAttribute(c,l),rs.fromBufferAttribute(c,u),ss.fromBufferAttribute(c,h),f.uv2=Je.getUV(Xo,ln,hn,un,is,rs,ss,new W));const p={a:l,b:u,c:h,normal:new w,materialIndex:0};Je.getNormal(ln,hn,un,p.normal),f.face=p}return f}class qn extends le{constructor(e=1,t=1,i=1,r=1,s=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:r,heightSegments:s,depthSegments:o};const a=this;r=Math.floor(r),s=Math.floor(s),o=Math.floor(o);const c=[],l=[],u=[],h=[];let d=0,f=0;p("z","y","x",-1,-1,i,t,e,o,s,0),p("z","y","x",1,-1,i,t,-e,o,s,1),p("x","z","y",1,1,e,i,t,r,o,2),p("x","z","y",1,-1,e,i,-t,r,o,3),p("x","y","z",1,-1,e,t,i,r,s,4),p("x","y","z",-1,-1,e,t,-i,r,s,5),this.setIndex(c),this.setAttribute("position",new se(l,3)),this.setAttribute("normal",new se(u,3)),this.setAttribute("uv",new se(h,2));function p(y,x,g,m,b,_,T,v,A,L,R){const z=_/A,P=T/L,U=_/2,D=T/2,I=v/2,B=A+1,F=L+1;let X=0,K=0;const j=new w;for(let oe=0;oe<F;oe++){const ae=oe*P-D;for(let ye=0;ye<B;ye++){const Se=ye*z-U;j[y]=Se*m,j[x]=ae*b,j[g]=I,l.push(j.x,j.y,j.z),j[y]=0,j[x]=0,j[g]=v>0?1:-1,u.push(j.x,j.y,j.z),h.push(ye/A),h.push(1-oe/L),X+=1}}for(let oe=0;oe<L;oe++)for(let ae=0;ae<A;ae++){const ye=d+ae+B*oe,Se=d+ae+B*(oe+1),G=d+(ae+1)+B*(oe+1),De=d+(ae+1)+B*oe;c.push(ye,Se,De),c.push(Se,G,De),K+=6}a.addGroup(f,K,R),f+=K,d+=X}}}function Si(n){const e={};for(const t in n){e[t]={};for(const i in n[t]){const r=n[t][i];r&&(r.isColor||r.isMatrix3||r.isMatrix4||r.isVector2||r.isVector3||r.isVector4||r.isTexture||r.isQuaternion)?e[t][i]=r.clone():Array.isArray(r)?e[t][i]=r.slice():e[t][i]=r}}return e}function ht(n){const e={};for(let t=0;t<n.length;t++){const i=Si(n[t]);for(const r in i)e[r]=i[r]}return e}const Iu={clone:Si,merge:ht};var Tf=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Ef=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;function wt(n){Ve.call(this),this.type="ShaderMaterial",this.defines={},this.uniforms={},this.vertexShader=Tf,this.fragmentShader=Ef,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.extensions={derivatives:!1,fragDepth:!1,drawBuffers:!1,shaderTextureLOD:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv2:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,n!==void 0&&(n.attributes,this.setValues(n))}wt.prototype=Object.create(Ve.prototype);wt.prototype.constructor=wt;wt.prototype.isShaderMaterial=!0;wt.prototype.copy=function(n){return Ve.prototype.copy.call(this,n),this.fragmentShader=n.fragmentShader,this.vertexShader=n.vertexShader,this.uniforms=Si(n.uniforms),this.defines=Object.assign({},n.defines),this.wireframe=n.wireframe,this.wireframeLinewidth=n.wireframeLinewidth,this.lights=n.lights,this.clipping=n.clipping,this.skinning=n.skinning,this.morphTargets=n.morphTargets,this.morphNormals=n.morphNormals,this.extensions=Object.assign({},n.extensions),this.glslVersion=n.glslVersion,this};wt.prototype.toJSON=function(n){const e=Ve.prototype.toJSON.call(this,n);e.glslVersion=this.glslVersion,e.uniforms={};for(const i in this.uniforms){const s=this.uniforms[i].value;s&&s.isTexture?e.uniforms[i]={type:"t",value:s.toJSON(n).uuid}:s&&s.isColor?e.uniforms[i]={type:"c",value:s.getHex()}:s&&s.isVector2?e.uniforms[i]={type:"v2",value:s.toArray()}:s&&s.isVector3?e.uniforms[i]={type:"v3",value:s.toArray()}:s&&s.isVector4?e.uniforms[i]={type:"v4",value:s.toArray()}:s&&s.isMatrix3?e.uniforms[i]={type:"m3",value:s.toArray()}:s&&s.isMatrix4?e.uniforms[i]={type:"m4",value:s.toArray()}:e.uniforms[i]={value:s}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader;const t={};for(const i in this.extensions)this.extensions[i]===!0&&(t[i]=!0);return Object.keys(t).length>0&&(e.extensions=t),e};function yn(){de.call(this),this.type="Camera",this.matrixWorldInverse=new ce,this.projectionMatrix=new ce,this.projectionMatrixInverse=new ce}yn.prototype=Object.assign(Object.create(de.prototype),{constructor:yn,isCamera:!0,copy:function(n,e){return de.prototype.copy.call(this,n,e),this.matrixWorldInverse.copy(n.matrixWorldInverse),this.projectionMatrix.copy(n.projectionMatrix),this.projectionMatrixInverse.copy(n.projectionMatrixInverse),this},getWorldDirection:function(n){n===void 0&&(n=new w),this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return n.set(-e[8],-e[9],-e[10]).normalize()},updateMatrixWorld:function(n){de.prototype.updateMatrixWorld.call(this,n),this.matrixWorldInverse.copy(this.matrixWorld).invert()},updateWorldMatrix:function(n,e){de.prototype.updateWorldMatrix.call(this,n,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()},clone:function(){return new this.constructor().copy(this)}});function tt(n=50,e=1,t=.1,i=2e3){yn.call(this),this.type="PerspectiveCamera",this.fov=n,this.zoom=1,this.near=t,this.far=i,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}tt.prototype=Object.assign(Object.create(yn.prototype),{constructor:tt,isPerspectiveCamera:!0,copy:function(n,e){return yn.prototype.copy.call(this,n,e),this.fov=n.fov,this.zoom=n.zoom,this.near=n.near,this.far=n.far,this.focus=n.focus,this.aspect=n.aspect,this.view=n.view===null?null:Object.assign({},n.view),this.filmGauge=n.filmGauge,this.filmOffset=n.filmOffset,this},setFocalLength:function(n){const e=.5*this.getFilmHeight()/n;this.fov=me.RAD2DEG*2*Math.atan(e),this.updateProjectionMatrix()},getFocalLength:function(){const n=Math.tan(me.DEG2RAD*.5*this.fov);return .5*this.getFilmHeight()/n},getEffectiveFOV:function(){return me.RAD2DEG*2*Math.atan(Math.tan(me.DEG2RAD*.5*this.fov)/this.zoom)},getFilmWidth:function(){return this.filmGauge*Math.min(this.aspect,1)},getFilmHeight:function(){return this.filmGauge/Math.max(this.aspect,1)},setViewOffset:function(n,e,t,i,r,s){this.aspect=n/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=n,this.view.fullHeight=e,this.view.offsetX=t,this.view.offsetY=i,this.view.width=r,this.view.height=s,this.updateProjectionMatrix()},clearViewOffset:function(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()},updateProjectionMatrix:function(){const n=this.near;let e=n*Math.tan(me.DEG2RAD*.5*this.fov)/this.zoom,t=2*e,i=this.aspect*t,r=-.5*i;const s=this.view;if(this.view!==null&&this.view.enabled){const a=s.fullWidth,c=s.fullHeight;r+=s.offsetX*i/a,e-=s.offsetY*t/c,i*=s.width/a,t*=s.height/c}const o=this.filmOffset;o!==0&&(r+=n*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+i,e,e-t,n,this.far),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()},toJSON:function(n){const e=de.prototype.toJSON.call(this,n);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}});const hi=90,ui=1;class ao extends de{constructor(e,t,i){if(super(),this.type="CubeCamera",i.isWebGLCubeRenderTarget!==!0)return;this.renderTarget=i;const r=new tt(hi,ui,e,t);r.layers=this.layers,r.up.set(0,-1,0),r.lookAt(new w(1,0,0)),this.add(r);const s=new tt(hi,ui,e,t);s.layers=this.layers,s.up.set(0,-1,0),s.lookAt(new w(-1,0,0)),this.add(s);const o=new tt(hi,ui,e,t);o.layers=this.layers,o.up.set(0,0,1),o.lookAt(new w(0,1,0)),this.add(o);const a=new tt(hi,ui,e,t);a.layers=this.layers,a.up.set(0,0,-1),a.lookAt(new w(0,-1,0)),this.add(a);const c=new tt(hi,ui,e,t);c.layers=this.layers,c.up.set(0,-1,0),c.lookAt(new w(0,0,1)),this.add(c);const l=new tt(hi,ui,e,t);l.layers=this.layers,l.up.set(0,-1,0),l.lookAt(new w(0,0,-1)),this.add(l)}update(e,t){this.parent===null&&this.updateMatrixWorld();const i=this.renderTarget,[r,s,o,a,c,l]=this.children,u=e.xr.enabled,h=e.getRenderTarget();e.xr.enabled=!1;const d=i.texture.generateMipmaps;i.texture.generateMipmaps=!1,e.setRenderTarget(i,0),e.render(t,r),e.setRenderTarget(i,1),e.render(t,s),e.setRenderTarget(i,2),e.render(t,o),e.setRenderTarget(i,3),e.render(t,a),e.setRenderTarget(i,4),e.render(t,c),i.texture.generateMipmaps=d,e.setRenderTarget(i,5),e.render(t,l),e.setRenderTarget(h),e.xr.enabled=u}}class Di extends st{constructor(e,t,i,r,s,o,a,c,l,u){e=e!==void 0?e:[],t=t!==void 0?t:Fr,a=a!==void 0?a:fn,super(e,t,i,r,s,o,a,c,l,u),this._needsFlipEnvMap=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}Di.prototype.isCubeTexture=!0;class co extends Kt{constructor(e,t,i){Number.isInteger(t)&&(t=i),super(e,e,t),t=t||{},this.texture=new Di(void 0,t.mapping,t.wrapS,t.wrapT,t.magFilter,t.minFilter,t.format,t.type,t.anisotropy,t.encoding),this.texture.generateMipmaps=t.generateMipmaps!==void 0?t.generateMipmaps:!1,this.texture.minFilter=t.minFilter!==void 0?t.minFilter:it,this.texture._needsFlipEnvMap=!1}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.format=Et,this.texture.encoding=t.encoding,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const i={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},r=new qn(5,5,5),s=new wt({name:"CubemapFromEquirect",uniforms:Si(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:Ke,blending:Qt});s.uniforms.tEquirect.value=t;const o=new Ge(r,s),a=t.minFilter;return t.minFilter===Ci&&(t.minFilter=it),new ao(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t,i,r){const s=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,i,r);e.setRenderTarget(s)}}co.prototype.isWebGLCubeRenderTarget=!0;class Ti extends st{constructor(e,t,i,r,s,o,a,c,l,u,h,d){super(null,o,a,c,l,u,r,s,h,d),this.image={data:e||null,width:t||1,height:i||1},this.magFilter=l!==void 0?l:nt,this.minFilter=u!==void 0?u:nt,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.needsUpdate=!0}}Ti.prototype.isDataTexture=!0;const di=new wn,cs=new w;class Or{constructor(e=new Ft,t=new Ft,i=new Ft,r=new Ft,s=new Ft,o=new Ft){this.planes=[e,t,i,r,s,o]}set(e,t,i,r,s,o){const a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(i),a[3].copy(r),a[4].copy(s),a[5].copy(o),this}copy(e){const t=this.planes;for(let i=0;i<6;i++)t[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e){const t=this.planes,i=e.elements,r=i[0],s=i[1],o=i[2],a=i[3],c=i[4],l=i[5],u=i[6],h=i[7],d=i[8],f=i[9],p=i[10],y=i[11],x=i[12],g=i[13],m=i[14],b=i[15];return t[0].setComponents(a-r,h-c,y-d,b-x).normalize(),t[1].setComponents(a+r,h+c,y+d,b+x).normalize(),t[2].setComponents(a+s,h+l,y+f,b+g).normalize(),t[3].setComponents(a-s,h-l,y-f,b-g).normalize(),t[4].setComponents(a-o,h-u,y-p,b-m).normalize(),t[5].setComponents(a+o,h+u,y+p,b+m).normalize(),this}intersectsObject(e){const t=e.geometry;return t.boundingSphere===null&&t.computeBoundingSphere(),di.copy(t.boundingSphere).applyMatrix4(e.matrixWorld),this.intersectsSphere(di)}intersectsSprite(e){return di.center.set(0,0,0),di.radius=.7071067811865476,di.applyMatrix4(e.matrixWorld),this.intersectsSphere(di)}intersectsSphere(e){const t=this.planes,i=e.center,r=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(i)<r)return!1;return!0}intersectsBox(e){const t=this.planes;for(let i=0;i<6;i++){const r=t[i];if(cs.x=r.normal.x>0?e.max.x:e.min.x,cs.y=r.normal.y>0?e.max.y:e.min.y,cs.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(cs)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function Du(){let n=null,e=!1,t=null,i=null;function r(s,o){t(s,o),i=n.requestAnimationFrame(r)}return{start:function(){e!==!0&&t!==null&&(i=n.requestAnimationFrame(r),e=!0)},stop:function(){n.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){n=s}}}function Af(n,e){const t=e.isWebGL2,i=new WeakMap;function r(l,u){const h=l.array,d=l.usage,f=n.createBuffer();n.bindBuffer(u,f),n.bufferData(u,h,d),l.onUploadCallback();let p=5126;return h instanceof Float32Array?p=5126:h instanceof Float64Array||(h instanceof Uint16Array?l.isFloat16BufferAttribute?t&&(p=5131):p=5123:h instanceof Int16Array?p=5122:h instanceof Uint32Array?p=5125:h instanceof Int32Array?p=5124:h instanceof Int8Array?p=5120:h instanceof Uint8Array&&(p=5121)),{buffer:f,type:p,bytesPerElement:h.BYTES_PER_ELEMENT,version:l.version}}function s(l,u,h){const d=u.array,f=u.updateRange;n.bindBuffer(h,l),f.count===-1?n.bufferSubData(h,0,d):(t?n.bufferSubData(h,f.offset*d.BYTES_PER_ELEMENT,d,f.offset,f.count):n.bufferSubData(h,f.offset*d.BYTES_PER_ELEMENT,d.subarray(f.offset,f.offset+f.count)),f.count=-1)}function o(l){return l.isInterleavedBufferAttribute&&(l=l.data),i.get(l)}function a(l){l.isInterleavedBufferAttribute&&(l=l.data);const u=i.get(l);u&&(n.deleteBuffer(u.buffer),i.delete(l))}function c(l,u){if(l.isGLBufferAttribute){const d=i.get(l);(!d||d.version<l.version)&&i.set(l,{buffer:l.buffer,type:l.type,bytesPerElement:l.elementSize,version:l.version});return}l.isInterleavedBufferAttribute&&(l=l.data);const h=i.get(l);h===void 0?i.set(l,r(l,u)):h.version<l.version&&(s(h.buffer,l,u),h.version=l.version)}return{get:o,remove:a,update:c}}class gr extends le{constructor(e=1,t=1,i=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:r};const s=e/2,o=t/2,a=Math.floor(i),c=Math.floor(r),l=a+1,u=c+1,h=e/a,d=t/c,f=[],p=[],y=[],x=[];for(let g=0;g<u;g++){const m=g*d-o;for(let b=0;b<l;b++){const _=b*h-s;p.push(_,-m,0),y.push(0,0,1),x.push(b/a),x.push(1-g/c)}}for(let g=0;g<c;g++)for(let m=0;m<a;m++){const b=m+l*g,_=m+l*(g+1),T=m+1+l*(g+1),v=m+1+l*g;f.push(b,_,v),f.push(_,T,v)}this.setIndex(f),this.setAttribute("position",new se(p,3)),this.setAttribute("normal",new se(y,3)),this.setAttribute("uv",new se(x,2))}}var Lf=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vUv ).g;
#endif`,Rf=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Cf=`#ifdef ALPHATEST
	if ( diffuseColor.a < ALPHATEST ) discard;
#endif`,Pf=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vUv2 ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.specularRoughness );
	#endif
#endif`,If=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Df="vec3 transformed = vec3( position );",Ff=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Bf=`vec2 integrateSpecularBRDF( const in float dotNV, const in float roughness ) {
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
#endif`,Nf=`#ifdef USE_BUMPMAP
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
#endif`,zf=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,Of=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Uf=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Hf=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Gf=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,kf=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,Vf=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	varying vec3 vColor;
#endif`,Wf=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif`,qf=`#define PI 3.141592653589793
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
}`,Xf=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,Yf=`vec3 transformedNormal = objectNormal;
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
#endif`,jf=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Zf=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vUv ).x * displacementScale + displacementBias );
#endif`,Jf=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vUv );
	emissiveColor.rgb = emissiveMapTexelToLinear( emissiveColor ).rgb;
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,$f=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Qf="gl_FragColor = linearToOutputTexel( gl_FragColor );",Kf=`
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
}`,ep=`#ifdef USE_ENVMAP
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
#endif`,tp=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform int maxMipLevel;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,np=`#ifdef USE_ENVMAP
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
#endif`,ip=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) ||defined( PHONG )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,rp=`#ifdef USE_ENVMAP
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
#endif`,sp=`#ifdef USE_FOG
	fogDepth = - mvPosition.z;
#endif`,op=`#ifdef USE_FOG
	varying float fogDepth;
#endif`,ap=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogDepth * fogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, fogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,cp=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float fogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,lp=`#ifdef USE_GRADIENTMAP
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
}`,hp=`#ifdef USE_LIGHTMAP
	vec4 lightMapTexel= texture2D( lightMap, vUv2 );
	reflectedLight.indirectDiffuse += PI * lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;
#endif`,up=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,dp=`vec3 diffuse = vec3( 1.0 );
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
#endif`,fp=`uniform bool receiveShadow;
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
#endif`,pp=`#if defined( USE_ENVMAP )
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
#endif`,mp=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,gp=`varying vec3 vViewPosition;
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
#define Material_LightProbeLOD( material )	(0)`,yp=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,xp=`varying vec3 vViewPosition;
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
#define Material_LightProbeLOD( material )	(0)`,vp=`PhysicalMaterial material;
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
#endif`,_p=`struct PhysicalMaterial {
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
}`,bp=`
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
#endif`,wp=`#if defined( RE_IndirectDiffuse )
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
#endif`,Mp=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometry, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometry, material, reflectedLight );
#endif`,Sp=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Tp=`#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Ep=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		varying float vFragDepth;
		varying float vIsPerspective;
	#else
		uniform float logDepthBufFC;
	#endif
#endif`,Ap=`#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		vFragDepth = 1.0 + gl_Position.w;
		vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
	#else
		if ( isPerspectiveMatrix( projectionMatrix ) ) {
			gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;
			gl_Position.z *= gl_Position.w;
		}
	#endif
#endif`,Lp=`#ifdef USE_MAP
	vec4 texelColor = texture2D( map, vUv );
	texelColor = mapTexelToLinear( texelColor );
	diffuseColor *= texelColor;
#endif`,Rp=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Cp=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
#endif
#ifdef USE_MAP
	vec4 mapTexel = texture2D( map, uv );
	diffuseColor *= mapTexelToLinear( mapTexel );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Pp=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	uniform mat3 uvTransform;
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Ip=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Dp=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Fp=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];
	objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];
	objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];
	objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];
#endif`,Bp=`#ifdef USE_MORPHTARGETS
	uniform float morphTargetBaseInfluence;
	#ifndef USE_MORPHNORMALS
		uniform float morphTargetInfluences[ 8 ];
	#else
		uniform float morphTargetInfluences[ 4 ];
	#endif
#endif`,Np=`#ifdef USE_MORPHTARGETS
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
#endif`,zp=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 geometryNormal = normal;`,Op=`#ifdef OBJECTSPACE_NORMALMAP
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
#endif`,Up=`#ifdef USE_NORMALMAP
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
#endif`,Hp=`#ifdef CLEARCOAT
	vec3 clearcoatNormal = geometryNormal;
#endif`,Gp=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	#ifdef USE_TANGENT
		clearcoatNormal = normalize( vTBN * clearcoatMapN );
	#else
		clearcoatNormal = perturbNormal2Arb( - vViewPosition, clearcoatNormal, clearcoatMapN, faceDirection );
	#endif
#endif`,kp=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif`,Vp=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,Wp=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,qp=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Xp=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Yp=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,jp=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Zp=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Jp=`#ifdef USE_SHADOWMAP
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
#endif`,$p=`#ifdef USE_SHADOWMAP
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
#endif`,Qp=`#ifdef USE_SHADOWMAP
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
#endif`,Kp=`float getShadowMask() {
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
}`,em=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,tm=`#ifdef USE_SKINNING
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
#endif`,nm=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,im=`#ifdef USE_SKINNING
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
#endif`,rm=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,sm=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,om=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,am=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,cm=`#ifdef USE_TRANSMISSIONMAP
	totalTransmission *= texture2D( transmissionMap, vUv ).r;
#endif`,lm=`#ifdef USE_TRANSMISSIONMAP
	uniform sampler2D transmissionMap;
#endif`,hm=`#if ( defined( USE_UV ) && ! defined( UVS_VERTEX_ONLY ) )
	varying vec2 vUv;
#endif`,um=`#ifdef USE_UV
	#ifdef UVS_VERTEX_ONLY
		vec2 vUv;
	#else
		varying vec2 vUv;
	#endif
	uniform mat3 uvTransform;
#endif`,dm=`#ifdef USE_UV
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
#endif`,fm=`#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
	varying vec2 vUv2;
#endif`,pm=`#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
	attribute vec2 uv2;
	varying vec2 vUv2;
	uniform mat3 uv2Transform;
#endif`,mm=`#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
	vUv2 = ( uv2Transform * vec3( uv2, 1 ) ).xy;
#endif`,gm=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP )
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,ym=`uniform sampler2D t2D;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	gl_FragColor = mapTexelToLinear( texColor );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
}`,xm=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,vm=`#include <envmap_common_pars_fragment>
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
}`,_m=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,bm=`#if DEPTH_PACKING == 3200
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
}`,wm=`#include <common>
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
}`,Mm=`#define DISTANCE
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
}`,Sm=`#define DISTANCE
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
}`,Tm=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	vec4 texColor = texture2D( tEquirect, sampleUV );
	gl_FragColor = mapTexelToLinear( texColor );
	#include <tonemapping_fragment>
	#include <encodings_fragment>
}`,Em=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Am=`uniform vec3 diffuse;
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
}`,Lm=`uniform float scale;
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
}`,Rm=`uniform vec3 diffuse;
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
}`,Cm=`#include <common>
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
}`,Pm=`uniform vec3 diffuse;
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
}`,Im=`#define LAMBERT
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
}`,Dm=`#define MATCAP
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
}`,Fm=`#define MATCAP
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
}`,Bm=`#define TOON
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
}`,Nm=`#define TOON
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
}`,zm=`#define PHONG
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
}`,Om=`#define PHONG
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
}`,Um=`#define STANDARD
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
}`,Hm=`#define STANDARD
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
}`,Gm=`#define NORMAL
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
}`,km=`#define NORMAL
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
}`,Vm=`uniform vec3 diffuse;
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
}`,Wm=`uniform float size;
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
}`,qm=`uniform vec3 color;
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
}`,Xm=`#include <common>
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
}`,Ym=`uniform vec3 diffuse;
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
}`,jm=`uniform float rotation;
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
}`;const Ae={alphamap_fragment:Lf,alphamap_pars_fragment:Rf,alphatest_fragment:Cf,aomap_fragment:Pf,aomap_pars_fragment:If,begin_vertex:Df,beginnormal_vertex:Ff,bsdfs:Bf,bumpmap_pars_fragment:Nf,clipping_planes_fragment:zf,clipping_planes_pars_fragment:Of,clipping_planes_pars_vertex:Uf,clipping_planes_vertex:Hf,color_fragment:Gf,color_pars_fragment:kf,color_pars_vertex:Vf,color_vertex:Wf,common:qf,cube_uv_reflection_fragment:Xf,defaultnormal_vertex:Yf,displacementmap_pars_vertex:jf,displacementmap_vertex:Zf,emissivemap_fragment:Jf,emissivemap_pars_fragment:$f,encodings_fragment:Qf,encodings_pars_fragment:Kf,envmap_fragment:ep,envmap_common_pars_fragment:tp,envmap_pars_fragment:np,envmap_pars_vertex:ip,envmap_physical_pars_fragment:pp,envmap_vertex:rp,fog_vertex:sp,fog_pars_vertex:op,fog_fragment:ap,fog_pars_fragment:cp,gradientmap_pars_fragment:lp,lightmap_fragment:hp,lightmap_pars_fragment:up,lights_lambert_vertex:dp,lights_pars_begin:fp,lights_toon_fragment:mp,lights_toon_pars_fragment:gp,lights_phong_fragment:yp,lights_phong_pars_fragment:xp,lights_physical_fragment:vp,lights_physical_pars_fragment:_p,lights_fragment_begin:bp,lights_fragment_maps:wp,lights_fragment_end:Mp,logdepthbuf_fragment:Sp,logdepthbuf_pars_fragment:Tp,logdepthbuf_pars_vertex:Ep,logdepthbuf_vertex:Ap,map_fragment:Lp,map_pars_fragment:Rp,map_particle_fragment:Cp,map_particle_pars_fragment:Pp,metalnessmap_fragment:Ip,metalnessmap_pars_fragment:Dp,morphnormal_vertex:Fp,morphtarget_pars_vertex:Bp,morphtarget_vertex:Np,normal_fragment_begin:zp,normal_fragment_maps:Op,normalmap_pars_fragment:Up,clearcoat_normal_fragment_begin:Hp,clearcoat_normal_fragment_maps:Gp,clearcoat_pars_fragment:kp,packing:Vp,premultiplied_alpha_fragment:Wp,project_vertex:qp,dithering_fragment:Xp,dithering_pars_fragment:Yp,roughnessmap_fragment:jp,roughnessmap_pars_fragment:Zp,shadowmap_pars_fragment:Jp,shadowmap_pars_vertex:$p,shadowmap_vertex:Qp,shadowmask_pars_fragment:Kp,skinbase_vertex:em,skinning_pars_vertex:tm,skinning_vertex:nm,skinnormal_vertex:im,specularmap_fragment:rm,specularmap_pars_fragment:sm,tonemapping_fragment:om,tonemapping_pars_fragment:am,transmissionmap_fragment:cm,transmissionmap_pars_fragment:lm,uv_pars_fragment:hm,uv_pars_vertex:um,uv_vertex:dm,uv2_pars_fragment:fm,uv2_pars_vertex:pm,uv2_vertex:mm,worldpos_vertex:gm,background_frag:ym,background_vert:xm,cube_frag:vm,cube_vert:_m,depth_frag:bm,depth_vert:wm,distanceRGBA_frag:Mm,distanceRGBA_vert:Sm,equirect_frag:Tm,equirect_vert:Em,linedashed_frag:Am,linedashed_vert:Lm,meshbasic_frag:Rm,meshbasic_vert:Cm,meshlambert_frag:Pm,meshlambert_vert:Im,meshmatcap_frag:Dm,meshmatcap_vert:Fm,meshtoon_frag:Bm,meshtoon_vert:Nm,meshphong_frag:zm,meshphong_vert:Om,meshphysical_frag:Um,meshphysical_vert:Hm,normal_frag:Gm,normal_vert:km,points_frag:Vm,points_vert:Wm,shadow_frag:qm,shadow_vert:Xm,sprite_frag:Ym,sprite_vert:jm},J={common:{diffuse:{value:new re(15658734)},opacity:{value:1},map:{value:null},uvTransform:{value:new rt},uv2Transform:{value:new rt},alphaMap:{value:null}},specularmap:{specularMap:{value:null}},envmap:{envMap:{value:null},flipEnvMap:{value:-1},reflectivity:{value:1},refractionRatio:{value:.98},maxMipLevel:{value:0}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1}},emissivemap:{emissiveMap:{value:null}},bumpmap:{bumpMap:{value:null},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalScale:{value:new W(1,1)}},displacementmap:{displacementMap:{value:null},displacementScale:{value:1},displacementBias:{value:0}},roughnessmap:{roughnessMap:{value:null}},metalnessmap:{metalnessMap:{value:null}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new re(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotShadowMap:{value:[]},spotShadowMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new re(15658734)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},uvTransform:{value:new rt}},sprite:{diffuse:{value:new re(15658734)},opacity:{value:1},center:{value:new W(.5,.5)},rotation:{value:0},map:{value:null},alphaMap:{value:null},uvTransform:{value:new rt}}},Bt={basic:{uniforms:ht([J.common,J.specularmap,J.envmap,J.aomap,J.lightmap,J.fog]),vertexShader:Ae.meshbasic_vert,fragmentShader:Ae.meshbasic_frag},lambert:{uniforms:ht([J.common,J.specularmap,J.envmap,J.aomap,J.lightmap,J.emissivemap,J.fog,J.lights,{emissive:{value:new re(0)}}]),vertexShader:Ae.meshlambert_vert,fragmentShader:Ae.meshlambert_frag},phong:{uniforms:ht([J.common,J.specularmap,J.envmap,J.aomap,J.lightmap,J.emissivemap,J.bumpmap,J.normalmap,J.displacementmap,J.fog,J.lights,{emissive:{value:new re(0)},specular:{value:new re(1118481)},shininess:{value:30}}]),vertexShader:Ae.meshphong_vert,fragmentShader:Ae.meshphong_frag},standard:{uniforms:ht([J.common,J.envmap,J.aomap,J.lightmap,J.emissivemap,J.bumpmap,J.normalmap,J.displacementmap,J.roughnessmap,J.metalnessmap,J.fog,J.lights,{emissive:{value:new re(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ae.meshphysical_vert,fragmentShader:Ae.meshphysical_frag},toon:{uniforms:ht([J.common,J.aomap,J.lightmap,J.emissivemap,J.bumpmap,J.normalmap,J.displacementmap,J.gradientmap,J.fog,J.lights,{emissive:{value:new re(0)}}]),vertexShader:Ae.meshtoon_vert,fragmentShader:Ae.meshtoon_frag},matcap:{uniforms:ht([J.common,J.bumpmap,J.normalmap,J.displacementmap,J.fog,{matcap:{value:null}}]),vertexShader:Ae.meshmatcap_vert,fragmentShader:Ae.meshmatcap_frag},points:{uniforms:ht([J.points,J.fog]),vertexShader:Ae.points_vert,fragmentShader:Ae.points_frag},dashed:{uniforms:ht([J.common,J.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ae.linedashed_vert,fragmentShader:Ae.linedashed_frag},depth:{uniforms:ht([J.common,J.displacementmap]),vertexShader:Ae.depth_vert,fragmentShader:Ae.depth_frag},normal:{uniforms:ht([J.common,J.bumpmap,J.normalmap,J.displacementmap,{opacity:{value:1}}]),vertexShader:Ae.normal_vert,fragmentShader:Ae.normal_frag},sprite:{uniforms:ht([J.sprite,J.fog]),vertexShader:Ae.sprite_vert,fragmentShader:Ae.sprite_frag},background:{uniforms:{uvTransform:{value:new rt},t2D:{value:null}},vertexShader:Ae.background_vert,fragmentShader:Ae.background_frag},cube:{uniforms:ht([J.envmap,{opacity:{value:1}}]),vertexShader:Ae.cube_vert,fragmentShader:Ae.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ae.equirect_vert,fragmentShader:Ae.equirect_frag},distanceRGBA:{uniforms:ht([J.common,J.displacementmap,{referencePosition:{value:new w},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ae.distanceRGBA_vert,fragmentShader:Ae.distanceRGBA_frag},shadow:{uniforms:ht([J.lights,J.fog,{color:{value:new re(0)},opacity:{value:1}}]),vertexShader:Ae.shadow_vert,fragmentShader:Ae.shadow_frag}};Bt.physical={uniforms:ht([Bt.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatNormalScale:{value:new W(1,1)},clearcoatNormalMap:{value:null},sheen:{value:new re(0)},transmission:{value:0},transmissionMap:{value:null}}]),vertexShader:Ae.meshphysical_vert,fragmentShader:Ae.meshphysical_frag};function Zm(n,e,t,i,r){const s=new re(0);let o=0,a,c,l=null,u=0,h=null;function d(p,y,x,g){let m=y.isScene===!0?y.background:null;m&&m.isTexture&&(m=e.get(m));const b=n.xr,_=b.getSession&&b.getSession();_&&_.environmentBlendMode==="additive"&&(m=null),m===null?f(s,o):m&&m.isColor&&(f(m,1),g=!0),(n.autoClear||g)&&n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil),m&&(m.isCubeTexture||m.mapping===Ri)?(c===void 0&&(c=new Ge(new qn(1,1,1),new wt({name:"BackgroundCubeMaterial",uniforms:Si(Bt.cube.uniforms),vertexShader:Bt.cube.vertexShader,fragmentShader:Bt.cube.fragmentShader,side:Ke,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(T,v,A){this.matrixWorld.copyPosition(A.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c)),c.material.uniforms.envMap.value=m,c.material.uniforms.flipEnvMap.value=m.isCubeTexture&&m._needsFlipEnvMap?-1:1,(l!==m||u!==m.version||h!==n.toneMapping)&&(c.material.needsUpdate=!0,l=m,u=m.version,h=n.toneMapping),p.unshift(c,c.geometry,c.material,0,0,null)):m&&m.isTexture&&(a===void 0&&(a=new Ge(new gr(2,2),new wt({name:"BackgroundMaterial",uniforms:Si(Bt.background.uniforms),vertexShader:Bt.background.vertexShader,fragmentShader:Bt.background.fragmentShader,side:Li,depthTest:!1,depthWrite:!1,fog:!1})),a.geometry.deleteAttribute("normal"),Object.defineProperty(a.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(a)),a.material.uniforms.t2D.value=m,m.matrixAutoUpdate===!0&&m.updateMatrix(),a.material.uniforms.uvTransform.value.copy(m.matrix),(l!==m||u!==m.version||h!==n.toneMapping)&&(a.material.needsUpdate=!0,l=m,u=m.version,h=n.toneMapping),p.unshift(a,a.geometry,a.material,0,0,null))}function f(p,y){t.buffers.color.setClear(p.r,p.g,p.b,y,r)}return{getClearColor:function(){return s},setClearColor:function(p,y=1){s.set(p),o=y,f(s,o)},getClearAlpha:function(){return o},setClearAlpha:function(p){o=p,f(s,o)},render:d}}function Jm(n,e,t,i){const r=n.getParameter(34921),s=i.isWebGL2?null:e.get("OES_vertex_array_object"),o=i.isWebGL2||s!==null,a={},c=y(null);let l=c;function u(D,I,B,F,X){let K=!1;if(o){const j=p(F,B,I);l!==j&&(l=j,d(l.object)),K=x(F,X),K&&g(F,X)}else{const j=I.wireframe===!0;(l.geometry!==F.id||l.program!==B.id||l.wireframe!==j)&&(l.geometry=F.id,l.program=B.id,l.wireframe=j,K=!0)}D.isInstancedMesh===!0&&(K=!0),X!==null&&t.update(X,34963),K&&(A(D,I,B,F),X!==null&&n.bindBuffer(34963,t.get(X).buffer))}function h(){return i.isWebGL2?n.createVertexArray():s.createVertexArrayOES()}function d(D){return i.isWebGL2?n.bindVertexArray(D):s.bindVertexArrayOES(D)}function f(D){return i.isWebGL2?n.deleteVertexArray(D):s.deleteVertexArrayOES(D)}function p(D,I,B){const F=B.wireframe===!0;let X=a[D.id];X===void 0&&(X={},a[D.id]=X);let K=X[I.id];K===void 0&&(K={},X[I.id]=K);let j=K[F];return j===void 0&&(j=y(h()),K[F]=j),j}function y(D){const I=[],B=[],F=[];for(let X=0;X<r;X++)I[X]=0,B[X]=0,F[X]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:I,enabledAttributes:B,attributeDivisors:F,object:D,attributes:{},index:null}}function x(D,I){const B=l.attributes,F=D.attributes;let X=0;for(const K in F){const j=B[K],oe=F[K];if(j===void 0||j.attribute!==oe||j.data!==oe.data)return!0;X++}return l.attributesNum!==X||l.index!==I}function g(D,I){const B={},F=D.attributes;let X=0;for(const K in F){const j=F[K],oe={};oe.attribute=j,j.data&&(oe.data=j.data),B[K]=oe,X++}l.attributes=B,l.attributesNum=X,l.index=I}function m(){const D=l.newAttributes;for(let I=0,B=D.length;I<B;I++)D[I]=0}function b(D){_(D,0)}function _(D,I){const B=l.newAttributes,F=l.enabledAttributes,X=l.attributeDivisors;B[D]=1,F[D]===0&&(n.enableVertexAttribArray(D),F[D]=1),X[D]!==I&&((i.isWebGL2?n:e.get("ANGLE_instanced_arrays"))[i.isWebGL2?"vertexAttribDivisor":"vertexAttribDivisorANGLE"](D,I),X[D]=I)}function T(){const D=l.newAttributes,I=l.enabledAttributes;for(let B=0,F=I.length;B<F;B++)I[B]!==D[B]&&(n.disableVertexAttribArray(B),I[B]=0)}function v(D,I,B,F,X,K){i.isWebGL2===!0&&(B===5124||B===5125)?n.vertexAttribIPointer(D,I,B,X,K):n.vertexAttribPointer(D,I,B,F,X,K)}function A(D,I,B,F){if(i.isWebGL2===!1&&(D.isInstancedMesh||F.isInstancedBufferGeometry)&&e.get("ANGLE_instanced_arrays")===null)return;m();const X=F.attributes,K=B.getAttributes(),j=I.defaultAttributeValues;for(const oe in K){const ae=K[oe];if(ae>=0){const ye=X[oe];if(ye!==void 0){const Se=ye.normalized,G=ye.itemSize,De=t.get(ye);if(De===void 0)continue;const Ce=De.buffer,be=De.type,ge=De.bytesPerElement;if(ye.isInterleavedBufferAttribute){const Fe=ye.data,Ee=Fe.stride,Le=ye.offset;Fe&&Fe.isInstancedInterleavedBuffer?(_(ae,Fe.meshPerAttribute),F._maxInstanceCount===void 0&&(F._maxInstanceCount=Fe.meshPerAttribute*Fe.count)):b(ae),n.bindBuffer(34962,Ce),v(ae,G,be,Se,Ee*ge,Le*ge)}else ye.isInstancedBufferAttribute?(_(ae,ye.meshPerAttribute),F._maxInstanceCount===void 0&&(F._maxInstanceCount=ye.meshPerAttribute*ye.count)):b(ae),n.bindBuffer(34962,Ce),v(ae,G,be,Se,0,0)}else if(oe==="instanceMatrix"){const Se=t.get(D.instanceMatrix);if(Se===void 0)continue;const G=Se.buffer,De=Se.type;_(ae+0,1),_(ae+1,1),_(ae+2,1),_(ae+3,1),n.bindBuffer(34962,G),n.vertexAttribPointer(ae+0,4,De,!1,64,0),n.vertexAttribPointer(ae+1,4,De,!1,64,16),n.vertexAttribPointer(ae+2,4,De,!1,64,32),n.vertexAttribPointer(ae+3,4,De,!1,64,48)}else if(oe==="instanceColor"){const Se=t.get(D.instanceColor);if(Se===void 0)continue;const G=Se.buffer,De=Se.type;_(ae,1),n.bindBuffer(34962,G),n.vertexAttribPointer(ae,3,De,!1,12,0)}else if(j!==void 0){const Se=j[oe];if(Se!==void 0)switch(Se.length){case 2:n.vertexAttrib2fv(ae,Se);break;case 3:n.vertexAttrib3fv(ae,Se);break;case 4:n.vertexAttrib4fv(ae,Se);break;default:n.vertexAttrib1fv(ae,Se)}}}}T()}function L(){P();for(const D in a){const I=a[D];for(const B in I){const F=I[B];for(const X in F)f(F[X].object),delete F[X];delete I[B]}delete a[D]}}function R(D){if(a[D.id]===void 0)return;const I=a[D.id];for(const B in I){const F=I[B];for(const X in F)f(F[X].object),delete F[X];delete I[B]}delete a[D.id]}function z(D){for(const I in a){const B=a[I];if(B[D.id]===void 0)continue;const F=B[D.id];for(const X in F)f(F[X].object),delete F[X];delete B[D.id]}}function P(){U(),l!==c&&(l=c,d(l.object))}function U(){c.geometry=null,c.program=null,c.wireframe=!1}return{setup:u,reset:P,resetDefaultState:U,dispose:L,releaseStatesOfGeometry:R,releaseStatesOfProgram:z,initAttributes:m,enableAttribute:b,disableUnusedAttributes:T}}function $m(n,e,t,i){const r=i.isWebGL2;let s;function o(l){s=l}function a(l,u){n.drawArrays(s,l,u),t.update(u,s,1)}function c(l,u,h){if(h===0)return;let d,f;if(r)d=n,f="drawArraysInstanced";else if(d=e.get("ANGLE_instanced_arrays"),f="drawArraysInstancedANGLE",d===null)return;d[f](s,l,u,h),t.update(u,s,h)}this.setMode=o,this.render=a,this.renderInstances=c}function Qm(n,e,t){let i;function r(){if(i!==void 0)return i;if(e.has("EXT_texture_filter_anisotropic")===!0){const v=e.get("EXT_texture_filter_anisotropic");i=n.getParameter(v.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function s(v){if(v==="highp"){if(n.getShaderPrecisionFormat(35633,36338).precision>0&&n.getShaderPrecisionFormat(35632,36338).precision>0)return"highp";v="mediump"}return v==="mediump"&&n.getShaderPrecisionFormat(35633,36337).precision>0&&n.getShaderPrecisionFormat(35632,36337).precision>0?"mediump":"lowp"}const o=typeof WebGL2RenderingContext<"u"&&n instanceof WebGL2RenderingContext||typeof WebGL2ComputeRenderingContext<"u"&&n instanceof WebGL2ComputeRenderingContext;let a=t.precision!==void 0?t.precision:"highp";const c=s(a);c!==a&&(a=c);const l=t.logarithmicDepthBuffer===!0,u=n.getParameter(34930),h=n.getParameter(35660),d=n.getParameter(3379),f=n.getParameter(34076),p=n.getParameter(34921),y=n.getParameter(36347),x=n.getParameter(36348),g=n.getParameter(36349),m=h>0,b=o||e.has("OES_texture_float"),_=m&&b,T=o?n.getParameter(36183):0;return{isWebGL2:o,getMaxAnisotropy:r,getMaxPrecision:s,precision:a,logarithmicDepthBuffer:l,maxTextures:u,maxVertexTextures:h,maxTextureSize:d,maxCubemapSize:f,maxAttributes:p,maxVertexUniforms:y,maxVaryings:x,maxFragmentUniforms:g,vertexTextures:m,floatFragmentTextures:b,floatVertexTextures:_,maxSamples:T}}function Km(n){const e=this;let t=null,i=0,r=!1,s=!1;const o=new Ft,a=new rt,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(h,d,f){const p=h.length!==0||d||i!==0||r;return r=d,t=u(h,f,0),i=h.length,p},this.beginShadows=function(){s=!0,u(null)},this.endShadows=function(){s=!1,l()},this.setState=function(h,d,f){const p=h.clippingPlanes,y=h.clipIntersection,x=h.clipShadows,g=n.get(h);if(!r||p===null||p.length===0||s&&!x)s?u(null):l();else{const m=s?0:i,b=m*4;let _=g.clippingState||null;c.value=_,_=u(p,d,b,f);for(let T=0;T!==b;++T)_[T]=t[T];g.clippingState=_,this.numIntersection=y?this.numPlanes:0,this.numPlanes+=m}};function l(){c.value!==t&&(c.value=t,c.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function u(h,d,f,p){const y=h!==null?h.length:0;let x=null;if(y!==0){if(x=c.value,p!==!0||x===null){const g=f+y*4,m=d.matrixWorldInverse;a.getNormalMatrix(m),(x===null||x.length<g)&&(x=new Float32Array(g));for(let b=0,_=f;b!==y;++b,_+=4)o.copy(h[b]).applyMatrix4(m,a),o.normal.toArray(x,_),x[_+3]=o.constant}c.value=x,c.needsUpdate=!0}return e.numPlanes=y,e.numIntersection=0,x}}function eg(n){let e=new WeakMap;function t(o,a){return a===Bs?o.mapping=Fr:a===Ns&&(o.mapping=Br),o}function i(o){if(o&&o.isTexture){const a=o.mapping;if(a===Bs||a===Ns)if(e.has(o)){const c=e.get(o).texture;return t(c,o.mapping)}else{const c=o.image;if(c&&c.height>0){const l=n.getRenderTarget(),u=new co(c.height/2);return u.fromEquirectangularTexture(n,o),e.set(o,u),n.setRenderTarget(l),o.addEventListener("dispose",r),t(u.texture,o.mapping)}else return null}}return o}function r(o){const a=o.target;a.removeEventListener("dispose",r);const c=e.get(a);c!==void 0&&(e.delete(a),c.dispose())}function s(){e=new WeakMap}return{get:i,dispose:s}}function tg(n){const e={};function t(i){if(e[i]!==void 0)return e[i];let r;switch(i){case"WEBGL_depth_texture":r=n.getExtension("WEBGL_depth_texture")||n.getExtension("MOZ_WEBGL_depth_texture")||n.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":r=n.getExtension("EXT_texture_filter_anisotropic")||n.getExtension("MOZ_EXT_texture_filter_anisotropic")||n.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":r=n.getExtension("WEBGL_compressed_texture_s3tc")||n.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":r=n.getExtension("WEBGL_compressed_texture_pvrtc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:r=n.getExtension(i)}return e[i]=r,r}return{has:function(i){return t(i)!==null},init:function(i){i.isWebGL2?t("EXT_color_buffer_float"):(t("WEBGL_depth_texture"),t("OES_texture_float"),t("OES_texture_half_float"),t("OES_texture_half_float_linear"),t("OES_standard_derivatives"),t("OES_element_index_uint"),t("OES_vertex_array_object"),t("ANGLE_instanced_arrays")),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float")},get:function(i){const r=t(i);return r}}}function ng(n,e,t,i){const r={},s=new WeakMap;function o(h){const d=h.target;d.index!==null&&e.remove(d.index);for(const p in d.attributes)e.remove(d.attributes[p]);d.removeEventListener("dispose",o),delete r[d.id];const f=s.get(d);f&&(e.remove(f),s.delete(d)),i.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function a(h,d){return r[d.id]===!0||(d.addEventListener("dispose",o),r[d.id]=!0,t.memory.geometries++),d}function c(h){const d=h.attributes;for(const p in d)e.update(d[p],34962);const f=h.morphAttributes;for(const p in f){const y=f[p];for(let x=0,g=y.length;x<g;x++)e.update(y[x],34962)}}function l(h){const d=[],f=h.index,p=h.attributes.position;let y=0;if(f!==null){const m=f.array;y=f.version;for(let b=0,_=m.length;b<_;b+=3){const T=m[b+0],v=m[b+1],A=m[b+2];d.push(T,v,v,A,A,T)}}else{const m=p.array;y=p.version;for(let b=0,_=m.length/3-1;b<_;b+=3){const T=b+0,v=b+1,A=b+2;d.push(T,v,v,A,A,T)}}const x=new(Pu(d)>65535?Wn:Vn)(d,1);x.version=y;const g=s.get(h);g&&e.remove(g),s.set(h,x)}function u(h){const d=s.get(h);if(d){const f=h.index;f!==null&&d.version<f.version&&l(h)}else l(h);return s.get(h)}return{get:a,update:c,getWireframeAttribute:u}}function ig(n,e,t,i){const r=i.isWebGL2;let s;function o(d){s=d}let a,c;function l(d){a=d.type,c=d.bytesPerElement}function u(d,f){n.drawElements(s,f,a,d*c),t.update(f,s,1)}function h(d,f,p){if(p===0)return;let y,x;if(r)y=n,x="drawElementsInstanced";else if(y=e.get("ANGLE_instanced_arrays"),x="drawElementsInstancedANGLE",y===null)return;y[x](s,f,a,d*c,p),t.update(f,s,p)}this.setMode=o,this.setIndex=l,this.render=u,this.renderInstances=h}function rg(n){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(s,o,a){switch(t.calls++,o){case 4:t.triangles+=a*(s/3);break;case 1:t.lines+=a*(s/2);break;case 3:t.lines+=a*(s-1);break;case 2:t.lines+=a*s;break;case 0:t.points+=a*s;break;default:break}}function r(){t.frame++,t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:r,update:i}}function sg(n,e){return n[0]-e[0]}function og(n,e){return Math.abs(e[1])-Math.abs(n[1])}function ag(n){const e={},t=new Float32Array(8),i=[];for(let s=0;s<8;s++)i[s]=[s,0];function r(s,o,a,c){const l=s.morphTargetInfluences,u=l===void 0?0:l.length;let h=e[o.id];if(h===void 0){h=[];for(let x=0;x<u;x++)h[x]=[x,0];e[o.id]=h}for(let x=0;x<u;x++){const g=h[x];g[0]=x,g[1]=l[x]}h.sort(og);for(let x=0;x<8;x++)x<u&&h[x][1]?(i[x][0]=h[x][0],i[x][1]=h[x][1]):(i[x][0]=Number.MAX_SAFE_INTEGER,i[x][1]=0);i.sort(sg);const d=a.morphTargets&&o.morphAttributes.position,f=a.morphNormals&&o.morphAttributes.normal;let p=0;for(let x=0;x<8;x++){const g=i[x],m=g[0],b=g[1];m!==Number.MAX_SAFE_INTEGER&&b?(d&&o.getAttribute("morphTarget"+x)!==d[m]&&o.setAttribute("morphTarget"+x,d[m]),f&&o.getAttribute("morphNormal"+x)!==f[m]&&o.setAttribute("morphNormal"+x,f[m]),t[x]=b,p+=b):(d&&o.hasAttribute("morphTarget"+x)===!0&&o.deleteAttribute("morphTarget"+x),f&&o.hasAttribute("morphNormal"+x)===!0&&o.deleteAttribute("morphNormal"+x),t[x]=0)}const y=o.morphTargetsRelative?1:1-p;c.getUniforms().setValue(n,"morphTargetBaseInfluence",y),c.getUniforms().setValue(n,"morphTargetInfluences",t)}return{update:r}}function cg(n,e,t,i){let r=new WeakMap;function s(c){const l=i.render.frame,u=c.geometry,h=e.get(c,u);return r.get(h)!==l&&(e.update(h),r.set(h,l)),c.isInstancedMesh&&(c.hasEventListener("dispose",a)===!1&&c.addEventListener("dispose",a),t.update(c.instanceMatrix,34962),c.instanceColor!==null&&t.update(c.instanceColor,34962)),h}function o(){r=new WeakMap}function a(c){const l=c.target;l.removeEventListener("dispose",a),t.remove(l.instanceMatrix),l.instanceColor!==null&&t.remove(l.instanceColor)}return{update:s,dispose:o}}class ka extends st{constructor(e=null,t=1,i=1,r=1){super(null),this.image={data:e,width:t,height:i,depth:r},this.magFilter=nt,this.minFilter=nt,this.wrapR=mt,this.generateMipmaps=!1,this.flipY=!1,this.needsUpdate=!0}}ka.prototype.isDataTexture2DArray=!0;class Va extends st{constructor(e=null,t=1,i=1,r=1){super(null),this.image={data:e,width:t,height:i,depth:r},this.magFilter=nt,this.minFilter=nt,this.wrapR=mt,this.generateMipmaps=!1,this.flipY=!1,this.needsUpdate=!0}}Va.prototype.isDataTexture3D=!0;const Fu=new st,lg=new ka,hg=new Va,Bu=new Di,qc=[],Xc=[],Yc=new Float32Array(16),jc=new Float32Array(9),Zc=new Float32Array(4);function Fi(n,e,t){const i=n[0];if(i<=0||i>0)return n;const r=e*t;let s=qc[r];if(s===void 0&&(s=new Float32Array(r),qc[r]=s),e!==0){i.toArray(s,0);for(let o=1,a=0;o!==e;++o)a+=t,n[o].toArray(s,a)}return s}function yt(n,e){if(n.length!==e.length)return!1;for(let t=0,i=n.length;t<i;t++)if(n[t]!==e[t])return!1;return!0}function dt(n,e){for(let t=0,i=e.length;t<i;t++)n[t]=e[t]}function Nu(n,e){let t=Xc[e];t===void 0&&(t=new Int32Array(e),Xc[e]=t);for(let i=0;i!==e;++i)t[i]=n.allocateTextureUnit();return t}function ug(n,e){const t=this.cache;t[0]!==e&&(n.uniform1f(this.addr,e),t[0]=e)}function dg(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(yt(t,e))return;n.uniform2fv(this.addr,e),dt(t,e)}}function fg(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(n.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(yt(t,e))return;n.uniform3fv(this.addr,e),dt(t,e)}}function pg(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(yt(t,e))return;n.uniform4fv(this.addr,e),dt(t,e)}}function mg(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(yt(t,e))return;n.uniformMatrix2fv(this.addr,!1,e),dt(t,e)}else{if(yt(t,i))return;Zc.set(i),n.uniformMatrix2fv(this.addr,!1,Zc),dt(t,i)}}function gg(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(yt(t,e))return;n.uniformMatrix3fv(this.addr,!1,e),dt(t,e)}else{if(yt(t,i))return;jc.set(i),n.uniformMatrix3fv(this.addr,!1,jc),dt(t,i)}}function yg(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(yt(t,e))return;n.uniformMatrix4fv(this.addr,!1,e),dt(t,e)}else{if(yt(t,i))return;Yc.set(i),n.uniformMatrix4fv(this.addr,!1,Yc),dt(t,i)}}function xg(n,e){const t=this.cache;t[0]!==e&&(n.uniform1i(this.addr,e),t[0]=e)}function vg(n,e){const t=this.cache;yt(t,e)||(n.uniform2iv(this.addr,e),dt(t,e))}function _g(n,e){const t=this.cache;yt(t,e)||(n.uniform3iv(this.addr,e),dt(t,e))}function bg(n,e){const t=this.cache;yt(t,e)||(n.uniform4iv(this.addr,e),dt(t,e))}function wg(n,e){const t=this.cache;t[0]!==e&&(n.uniform1ui(this.addr,e),t[0]=e)}function Mg(n,e){const t=this.cache;yt(t,e)||(n.uniform2uiv(this.addr,e),dt(t,e))}function Sg(n,e){const t=this.cache;yt(t,e)||(n.uniform3uiv(this.addr,e),dt(t,e))}function Tg(n,e){const t=this.cache;yt(t,e)||(n.uniform4uiv(this.addr,e),dt(t,e))}function Eg(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.safeSetTexture2D(e||Fu,r)}function Ag(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture3D(e||hg,r)}function Lg(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.safeSetTextureCube(e||Bu,r)}function Rg(n,e,t){const i=this.cache,r=t.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),t.setTexture2DArray(e||lg,r)}function Cg(n){switch(n){case 5126:return ug;case 35664:return dg;case 35665:return fg;case 35666:return pg;case 35674:return mg;case 35675:return gg;case 35676:return yg;case 5124:case 35670:return xg;case 35667:case 35671:return vg;case 35668:case 35672:return _g;case 35669:case 35673:return bg;case 5125:return wg;case 36294:return Mg;case 36295:return Sg;case 36296:return Tg;case 35678:case 36198:case 36298:case 36306:case 35682:return Eg;case 35679:case 36299:case 36307:return Ag;case 35680:case 36300:case 36308:case 36293:return Lg;case 36289:case 36303:case 36311:case 36292:return Rg}}function Pg(n,e){n.uniform1fv(this.addr,e)}function Ig(n,e){const t=Fi(e,this.size,2);n.uniform2fv(this.addr,t)}function Dg(n,e){const t=Fi(e,this.size,3);n.uniform3fv(this.addr,t)}function Fg(n,e){const t=Fi(e,this.size,4);n.uniform4fv(this.addr,t)}function Bg(n,e){const t=Fi(e,this.size,4);n.uniformMatrix2fv(this.addr,!1,t)}function Ng(n,e){const t=Fi(e,this.size,9);n.uniformMatrix3fv(this.addr,!1,t)}function zg(n,e){const t=Fi(e,this.size,16);n.uniformMatrix4fv(this.addr,!1,t)}function Og(n,e){n.uniform1iv(this.addr,e)}function Ug(n,e){n.uniform2iv(this.addr,e)}function Hg(n,e){n.uniform3iv(this.addr,e)}function Gg(n,e){n.uniform4iv(this.addr,e)}function kg(n,e){n.uniform1uiv(this.addr,e)}function Vg(n,e){n.uniform2uiv(this.addr,e)}function Wg(n,e){n.uniform3uiv(this.addr,e)}function qg(n,e){n.uniform4uiv(this.addr,e)}function Xg(n,e,t){const i=e.length,r=Nu(t,i);n.uniform1iv(this.addr,r);for(let s=0;s!==i;++s)t.safeSetTexture2D(e[s]||Fu,r[s])}function Yg(n,e,t){const i=e.length,r=Nu(t,i);n.uniform1iv(this.addr,r);for(let s=0;s!==i;++s)t.safeSetTextureCube(e[s]||Bu,r[s])}function jg(n){switch(n){case 5126:return Pg;case 35664:return Ig;case 35665:return Dg;case 35666:return Fg;case 35674:return Bg;case 35675:return Ng;case 35676:return zg;case 5124:case 35670:return Og;case 35667:case 35671:return Ug;case 35668:case 35672:return Hg;case 35669:case 35673:return Gg;case 5125:return kg;case 36294:return Vg;case 36295:return Wg;case 36296:return qg;case 35678:case 36198:case 36298:case 36306:case 35682:return Xg;case 35680:case 36300:case 36308:case 36293:return Yg}}function Zg(n,e,t){this.id=n,this.addr=t,this.cache=[],this.setValue=Cg(e.type)}function zu(n,e,t){this.id=n,this.addr=t,this.cache=[],this.size=e.size,this.setValue=jg(e.type)}zu.prototype.updateCache=function(n){const e=this.cache;n instanceof Float32Array&&e.length!==n.length&&(this.cache=new Float32Array(n.length)),dt(e,n)};function Ou(n){this.id=n,this.seq=[],this.map={}}Ou.prototype.setValue=function(n,e,t){const i=this.seq;for(let r=0,s=i.length;r!==s;++r){const o=i[r];o.setValue(n,e[o.id],t)}};const Yo=/(\w+)(\])?(\[|\.)?/g;function Jc(n,e){n.seq.push(e),n.map[e.id]=e}function Jg(n,e,t){const i=n.name,r=i.length;for(Yo.lastIndex=0;;){const s=Yo.exec(i),o=Yo.lastIndex;let a=s[1];const c=s[2]==="]",l=s[3];if(c&&(a=a|0),l===void 0||l==="["&&o+2===r){Jc(t,l===void 0?new Zg(a,n,e):new zu(a,n,e));break}else{let h=t.map[a];h===void 0&&(h=new Ou(a),Jc(t,h)),t=h}}}function pn(n,e){this.seq=[],this.map={};const t=n.getProgramParameter(e,35718);for(let i=0;i<t;++i){const r=n.getActiveUniform(e,i),s=n.getUniformLocation(e,r.name);Jg(r,s,this)}}pn.prototype.setValue=function(n,e,t,i){const r=this.map[e];r!==void 0&&r.setValue(n,t,i)};pn.prototype.setOptional=function(n,e,t){const i=e[t];i!==void 0&&this.setValue(n,t,i)};pn.upload=function(n,e,t,i){for(let r=0,s=e.length;r!==s;++r){const o=e[r],a=t[o.id];a.needsUpdate!==!1&&o.setValue(n,a.value,i)}};pn.seqWithValue=function(n,e){const t=[];for(let i=0,r=n.length;i!==r;++i){const s=n[i];s.id in e&&t.push(s)}return t};function $c(n,e,t){const i=n.createShader(e);return n.shaderSource(i,t),n.compileShader(i),i}let $g=0;function Qg(n){const e=n.split(`
`);for(let t=0;t<e.length;t++)e[t]=t+1+": "+e[t];return e.join(`
`)}function Uu(n){switch(n){case gt:return["Linear","( value )"];case zr:return["sRGB","( value )"];case oo:return["RGBE","( value )"];case Oa:return["RGBM","( value, 7.0 )"];case Ua:return["RGBM","( value, 16.0 )"];case Ha:return["RGBD","( value, 256.0 )"];case so:return["Gamma","( value, float( GAMMA_FACTOR ) )"];case Su:return["LogLuv","( value )"];default:return["Linear","( value )"]}}function Qc(n,e,t){const i=n.getShaderParameter(e,35713),r=n.getShaderInfoLog(e).trim();if(i&&r==="")return"";const s=n.getShaderSource(e);return"THREE.WebGLShader: gl.getShaderInfoLog() "+t+`
`+r+Qg(s)}function ki(n,e){const t=Uu(e);return"vec4 "+n+"( vec4 value ) { return "+t[0]+"ToLinear"+t[1]+"; }"}function Kg(n,e){const t=Uu(e);return"vec4 "+n+"( vec4 value ) { return LinearTo"+t[0]+t[1]+"; }"}function ey(n,e){let t;switch(e){case Mh:t="Linear";break;case Sh:t="Reinhard";break;case Th:t="OptimizedCineon";break;case Eh:t="ACESFilmic";break;case Ah:t="Custom";break;default:t="Linear"}return"vec3 "+n+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}function ty(n){return[n.extensionDerivatives||n.envMapCubeUV||n.bumpMap||n.tangentSpaceNormalMap||n.clearcoatNormalMap||n.flatShading||n.shaderID==="physical"?"#extension GL_OES_standard_derivatives : enable":"",(n.extensionFragDepth||n.logarithmicDepthBuffer)&&n.rendererExtensionFragDepth?"#extension GL_EXT_frag_depth : enable":"",n.extensionDrawBuffers&&n.rendererExtensionDrawBuffers?"#extension GL_EXT_draw_buffers : require":"",(n.extensionShaderTextureLOD||n.envMap)&&n.rendererExtensionShaderTextureLod?"#extension GL_EXT_shader_texture_lod : enable":""].filter($i).join(`
`)}function ny(n){const e=[];for(const t in n){const i=n[t];i!==!1&&e.push("#define "+t+" "+i)}return e.join(`
`)}function iy(n,e){const t={},i=n.getProgramParameter(e,35721);for(let r=0;r<i;r++){const o=n.getActiveAttrib(e,r).name;t[o]=n.getAttribLocation(e,o)}return t}function $i(n){return n!==""}function Kc(n,e){return n.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function el(n,e){return n.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const ry=/^[ \t]*#include +<([\w\d./]+)>/gm;function wa(n){return n.replace(ry,sy)}function sy(n,e){const t=Ae[e];if(t===void 0)throw new Error("Can not resolve #include <"+e+">");return wa(t)}const oy=/#pragma unroll_loop[\s]+?for \( int i \= (\d+)\; i < (\d+)\; i \+\+ \) \{([\s\S]+?)(?=\})\}/g,ay=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function tl(n){return n.replace(ay,Hu).replace(oy,cy)}function cy(n,e,t,i){return Hu(n,e,t,i)}function Hu(n,e,t,i){let r="";for(let s=parseInt(e);s<parseInt(t);s++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function nl(n){let e="precision "+n.precision+` float;
precision `+n.precision+" int;";return n.precision==="highp"?e+=`
#define HIGH_PRECISION`:n.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:n.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function ly(n){let e="SHADOWMAP_TYPE_BASIC";return n.shadowMapType===Ia?e="SHADOWMAP_TYPE_PCF":n.shadowMapType===th?e="SHADOWMAP_TYPE_PCF_SOFT":n.shadowMapType===xi&&(e="SHADOWMAP_TYPE_VSM"),e}function hy(n){let e="ENVMAP_TYPE_CUBE";if(n.envMap)switch(n.envMapMode){case Fr:case Br:e="ENVMAP_TYPE_CUBE";break;case Ri:case Nr:e="ENVMAP_TYPE_CUBE_UV";break}return e}function uy(n){let e="ENVMAP_MODE_REFLECTION";if(n.envMap)switch(n.envMapMode){case Br:case Nr:e="ENVMAP_MODE_REFRACTION";break}return e}function dy(n){let e="ENVMAP_BLENDING_NONE";if(n.envMap)switch(n.combine){case Dr:e="ENVMAP_BLENDING_MULTIPLY";break;case bh:e="ENVMAP_BLENDING_MIX";break;case wh:e="ENVMAP_BLENDING_ADD";break}return e}function fy(n,e,t,i){const r=n.getContext(),s=t.defines;let o=t.vertexShader,a=t.fragmentShader;const c=ly(t),l=hy(t),u=uy(t),h=dy(t),d=n.gammaFactor>0?n.gammaFactor:1,f=t.isWebGL2?"":ty(t),p=ny(s),y=r.createProgram();let x,g,m=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(x=[p].filter($i).join(`
`),x.length>0&&(x+=`
`),g=[f,p].filter($i).join(`
`),g.length>0&&(g+=`
`)):(x=[nl(t),"#define SHADER_NAME "+t.shaderName,p,t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.supportsVertexTextures?"#define VERTEX_TEXTURES":"","#define GAMMA_FACTOR "+d,"#define MAX_BONES "+t.maxBones,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+u:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMap&&t.objectSpaceNormalMap?"#define OBJECTSPACE_NORMALMAP":"",t.normalMap&&t.tangentSpaceNormalMap?"#define TANGENTSPACE_NORMALMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.displacementMap&&t.supportsVertexTextures?"#define USE_DISPLACEMENTMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.vertexTangents?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUvs?"#define USE_UV":"",t.uvsVertexOnly?"#define UVS_VERTEX_ONLY":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.useVertexTexture?"#define BONE_TEXTURE":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.logarithmicDepthBuffer&&t.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_MORPHTARGETS","	attribute vec3 morphTarget0;","	attribute vec3 morphTarget1;","	attribute vec3 morphTarget2;","	attribute vec3 morphTarget3;","	#ifdef USE_MORPHNORMALS","		attribute vec3 morphNormal0;","		attribute vec3 morphNormal1;","		attribute vec3 morphNormal2;","		attribute vec3 morphNormal3;","	#else","		attribute vec3 morphTarget4;","		attribute vec3 morphTarget5;","		attribute vec3 morphTarget6;","		attribute vec3 morphTarget7;","	#endif","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter($i).join(`
`),g=[f,nl(t),"#define SHADER_NAME "+t.shaderName,p,t.alphaTest?"#define ALPHATEST "+t.alphaTest+(t.alphaTest%1?"":".0"):"","#define GAMMA_FACTOR "+d,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+l:"",t.envMap?"#define "+u:"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMap&&t.objectSpaceNormalMap?"#define OBJECTSPACE_NORMALMAP":"",t.normalMap&&t.tangentSpaceNormalMap?"#define TANGENTSPACE_NORMALMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.sheen?"#define USE_SHEEN":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.vertexTangents?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUvs?"#define USE_UV":"",t.uvsVertexOnly?"#define UVS_VERTEX_ONLY":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.physicallyCorrectLights?"#define PHYSICALLY_CORRECT_LIGHTS":"",t.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",t.logarithmicDepthBuffer&&t.rendererExtensionFragDepth?"#define USE_LOGDEPTHBUF_EXT":"",(t.extensionShaderTextureLOD||t.envMap)&&t.rendererExtensionShaderTextureLod?"#define TEXTURE_LOD_EXT":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Hn?"#define TONE_MAPPING":"",t.toneMapping!==Hn?Ae.tonemapping_pars_fragment:"",t.toneMapping!==Hn?ey("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",Ae.encodings_pars_fragment,t.map?ki("mapTexelToLinear",t.mapEncoding):"",t.matcap?ki("matcapTexelToLinear",t.matcapEncoding):"",t.envMap?ki("envMapTexelToLinear",t.envMapEncoding):"",t.emissiveMap?ki("emissiveMapTexelToLinear",t.emissiveMapEncoding):"",t.lightMap?ki("lightMapTexelToLinear",t.lightMapEncoding):"",Kg("linearToOutputTexel",t.outputEncoding),t.depthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter($i).join(`
`)),o=wa(o),o=Kc(o,t),o=el(o,t),a=wa(a),a=Kc(a,t),a=el(a,t),o=tl(o),a=tl(a),t.isWebGL2&&t.isRawShaderMaterial!==!0&&(m=`#version 300 es
`,x=["#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+x,g=["#define varying in",t.glslVersion===ba?"":"out highp vec4 pc_fragColor;",t.glslVersion===ba?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+g);const b=m+x+o,_=m+g+a,T=$c(r,35633,b),v=$c(r,35632,_);if(r.attachShader(y,T),r.attachShader(y,v),t.index0AttributeName!==void 0?r.bindAttribLocation(y,0,t.index0AttributeName):t.morphTargets===!0&&r.bindAttribLocation(y,0,"position"),r.linkProgram(y),n.debug.checkShaderErrors){const R=r.getProgramInfoLog(y).trim(),z=r.getShaderInfoLog(T).trim(),P=r.getShaderInfoLog(v).trim();let U=!0,D=!0;if(r.getProgramParameter(y,35714)===!1){U=!1;const I=Qc(r,T,"vertex"),B=Qc(r,v,"fragment")}else R!==""||(z===""||P==="")&&(D=!1);D&&(this.diagnostics={runnable:U,programLog:R,vertexShader:{log:z,prefix:x},fragmentShader:{log:P,prefix:g}})}r.deleteShader(T),r.deleteShader(v);let A;this.getUniforms=function(){return A===void 0&&(A=new pn(r,y)),A};let L;return this.getAttributes=function(){return L===void 0&&(L=iy(r,y)),L},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(y),this.program=void 0},this.name=t.shaderName,this.id=$g++,this.cacheKey=e,this.usedTimes=1,this.program=y,this.vertexShader=T,this.fragmentShader=v,this}function py(n,e,t,i,r,s){const o=[],a=i.isWebGL2,c=i.logarithmicDepthBuffer,l=i.floatVertexTextures,u=i.maxVertexUniforms,h=i.vertexTextures;let d=i.precision;const f={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"},p=["precision","isWebGL2","supportsVertexTextures","outputEncoding","instancing","instancingColor","map","mapEncoding","matcap","matcapEncoding","envMap","envMapMode","envMapEncoding","envMapCubeUV","lightMap","lightMapEncoding","aoMap","emissiveMap","emissiveMapEncoding","bumpMap","normalMap","objectSpaceNormalMap","tangentSpaceNormalMap","clearcoatMap","clearcoatRoughnessMap","clearcoatNormalMap","displacementMap","specularMap","roughnessMap","metalnessMap","gradientMap","alphaMap","combine","vertexColors","vertexAlphas","vertexTangents","vertexUvs","uvsVertexOnly","fog","useFog","fogExp2","flatShading","sizeAttenuation","logarithmicDepthBuffer","skinning","maxBones","useVertexTexture","morphTargets","morphNormals","premultipliedAlpha","numDirLights","numPointLights","numSpotLights","numHemiLights","numRectAreaLights","numDirLightShadows","numPointLightShadows","numSpotLightShadows","shadowMapEnabled","shadowMapType","toneMapping","physicallyCorrectLights","alphaTest","doubleSided","flipSided","numClippingPlanes","numClipIntersection","depthPacking","dithering","sheen","transmissionMap"];function y(v){const L=v.skeleton.bones;if(l)return 1024;{const z=Math.floor((u-20)/4),P=Math.min(z,L.length);return P<L.length?0:P}}function x(v){let A;return v&&v.isTexture?A=v.encoding:v&&v.isWebGLRenderTarget?A=v.texture.encoding:A=gt,A}function g(v,A,L,R,z){const P=R.fog,U=v.isMeshStandardMaterial?R.environment:null,D=e.get(v.envMap||U),I=f[v.type],B=z.isSkinnedMesh?y(z):0;v.precision!==null&&(d=i.getMaxPrecision(v.precision),v.precision);let F,X;if(I){const oe=Bt[I];F=oe.vertexShader,X=oe.fragmentShader}else F=v.vertexShader,X=v.fragmentShader;const K=n.getRenderTarget();return{isWebGL2:a,shaderID:I,shaderName:v.type,vertexShader:F,fragmentShader:X,defines:v.defines,isRawShaderMaterial:v.isRawShaderMaterial===!0,glslVersion:v.glslVersion,precision:d,instancing:z.isInstancedMesh===!0,instancingColor:z.isInstancedMesh===!0&&z.instanceColor!==null,supportsVertexTextures:h,outputEncoding:K!==null?x(K.texture):n.outputEncoding,map:!!v.map,mapEncoding:x(v.map),matcap:!!v.matcap,matcapEncoding:x(v.matcap),envMap:!!D,envMapMode:D&&D.mapping,envMapEncoding:x(D),envMapCubeUV:!!D&&(D.mapping===Ri||D.mapping===Nr),lightMap:!!v.lightMap,lightMapEncoding:x(v.lightMap),aoMap:!!v.aoMap,emissiveMap:!!v.emissiveMap,emissiveMapEncoding:x(v.emissiveMap),bumpMap:!!v.bumpMap,normalMap:!!v.normalMap,objectSpaceNormalMap:v.normalMapType===Au,tangentSpaceNormalMap:v.normalMapType===jn,clearcoatMap:!!v.clearcoatMap,clearcoatRoughnessMap:!!v.clearcoatRoughnessMap,clearcoatNormalMap:!!v.clearcoatNormalMap,displacementMap:!!v.displacementMap,roughnessMap:!!v.roughnessMap,metalnessMap:!!v.metalnessMap,specularMap:!!v.specularMap,alphaMap:!!v.alphaMap,gradientMap:!!v.gradientMap,sheen:!!v.sheen,transmissionMap:!!v.transmissionMap,combine:v.combine,vertexTangents:v.normalMap&&v.vertexTangents,vertexColors:v.vertexColors,vertexAlphas:v.vertexColors===!0&&z.geometry.attributes.color&&z.geometry.attributes.color.itemSize===4,vertexUvs:!!v.map||!!v.bumpMap||!!v.normalMap||!!v.specularMap||!!v.alphaMap||!!v.emissiveMap||!!v.roughnessMap||!!v.metalnessMap||!!v.clearcoatMap||!!v.clearcoatRoughnessMap||!!v.clearcoatNormalMap||!!v.displacementMap||!!v.transmissionMap,uvsVertexOnly:!(v.map||v.bumpMap||v.normalMap||v.specularMap||v.alphaMap||v.emissiveMap||v.roughnessMap||v.metalnessMap||v.clearcoatNormalMap||v.transmissionMap)&&!!v.displacementMap,fog:!!P,useFog:v.fog,fogExp2:P&&P.isFogExp2,flatShading:!!v.flatShading,sizeAttenuation:v.sizeAttenuation,logarithmicDepthBuffer:c,skinning:v.skinning&&B>0,maxBones:B,useVertexTexture:l,morphTargets:v.morphTargets,morphNormals:v.morphNormals,numDirLights:A.directional.length,numPointLights:A.point.length,numSpotLights:A.spot.length,numRectAreaLights:A.rectArea.length,numHemiLights:A.hemi.length,numDirLightShadows:A.directionalShadowMap.length,numPointLightShadows:A.pointShadowMap.length,numSpotLightShadows:A.spotShadowMap.length,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:v.dithering,shadowMapEnabled:n.shadowMap.enabled&&L.length>0,shadowMapType:n.shadowMap.type,toneMapping:v.toneMapped?n.toneMapping:Hn,physicallyCorrectLights:n.physicallyCorrectLights,premultipliedAlpha:v.premultipliedAlpha,alphaTest:v.alphaTest,doubleSided:v.side===Ir,flipSided:v.side===Ke,depthPacking:v.depthPacking!==void 0?v.depthPacking:!1,index0AttributeName:v.index0AttributeName,extensionDerivatives:v.extensions&&v.extensions.derivatives,extensionFragDepth:v.extensions&&v.extensions.fragDepth,extensionDrawBuffers:v.extensions&&v.extensions.drawBuffers,extensionShaderTextureLOD:v.extensions&&v.extensions.shaderTextureLOD,rendererExtensionFragDepth:a||t.has("EXT_frag_depth"),rendererExtensionDrawBuffers:a||t.has("WEBGL_draw_buffers"),rendererExtensionShaderTextureLod:a||t.has("EXT_shader_texture_lod"),customProgramCacheKey:v.customProgramCacheKey()}}function m(v){const A=[];if(v.shaderID?A.push(v.shaderID):(A.push(v.fragmentShader),A.push(v.vertexShader)),v.defines!==void 0)for(const L in v.defines)A.push(L),A.push(v.defines[L]);if(v.isRawShaderMaterial===!1){for(let L=0;L<p.length;L++)A.push(v[p[L]]);A.push(n.outputEncoding),A.push(n.gammaFactor)}return A.push(v.customProgramCacheKey),A.join()}function b(v){const A=f[v.type];let L;if(A){const R=Bt[A];L=Iu.clone(R.uniforms)}else L=v.uniforms;return L}function _(v,A){let L;for(let R=0,z=o.length;R<z;R++){const P=o[R];if(P.cacheKey===A){L=P,++L.usedTimes;break}}return L===void 0&&(L=new fy(n,A,v,r),o.push(L)),L}function T(v){if(--v.usedTimes===0){const A=o.indexOf(v);o[A]=o[o.length-1],o.pop(),v.destroy()}}return{getParameters:g,getProgramCacheKey:m,getUniforms:b,acquireProgram:_,releaseProgram:T,programs:o}}function my(){let n=new WeakMap;function e(s){let o=n.get(s);return o===void 0&&(o={},n.set(s,o)),o}function t(s){n.delete(s)}function i(s,o,a){n.get(s)[o]=a}function r(){n=new WeakMap}return{get:e,remove:t,update:i,dispose:r}}function gy(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.program!==e.program?n.program.id-e.program.id:n.material.id!==e.material.id?n.material.id-e.material.id:n.z!==e.z?n.z-e.z:n.id-e.id}function yy(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.z!==e.z?e.z-n.z:n.id-e.id}function il(n){const e=[];let t=0;const i=[],r=[],s={id:-1};function o(){t=0,i.length=0,r.length=0}function a(d,f,p,y,x,g){let m=e[t];const b=n.get(p);return m===void 0?(m={id:d.id,object:d,geometry:f,material:p,program:b.program||s,groupOrder:y,renderOrder:d.renderOrder,z:x,group:g},e[t]=m):(m.id=d.id,m.object=d,m.geometry=f,m.material=p,m.program=b.program||s,m.groupOrder=y,m.renderOrder=d.renderOrder,m.z=x,m.group=g),t++,m}function c(d,f,p,y,x,g){const m=a(d,f,p,y,x,g);(p.transparent===!0?r:i).push(m)}function l(d,f,p,y,x,g){const m=a(d,f,p,y,x,g);(p.transparent===!0?r:i).unshift(m)}function u(d,f){i.length>1&&i.sort(d||gy),r.length>1&&r.sort(f||yy)}function h(){for(let d=t,f=e.length;d<f;d++){const p=e[d];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.program=null,p.group=null}}return{opaque:i,transparent:r,init:o,push:c,unshift:l,finish:h,sort:u}}function xy(n){let e=new WeakMap;function t(r,s){let o;return e.has(r)===!1?(o=new il(n),e.set(r,[o])):s>=e.get(r).length?(o=new il(n),e.get(r).push(o)):o=e.get(r)[s],o}function i(){e=new WeakMap}return{get:t,dispose:i}}function vy(){const n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new w,color:new re};break;case"SpotLight":t={position:new w,direction:new w,color:new re,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new w,color:new re,distance:0,decay:0};break;case"HemisphereLight":t={direction:new w,skyColor:new re,groundColor:new re};break;case"RectAreaLight":t={color:new re,position:new w,halfWidth:new w,halfHeight:new w};break}return n[e.id]=t,t}}}function _y(){const n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new W};break;case"SpotLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new W};break;case"PointLight":t={shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new W,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[e.id]=t,t}}}let by=0;function wy(n,e){return(e.castShadow?1:0)-(n.castShadow?1:0)}function My(n,e){const t=new vy,i=_y(),r={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotShadow:[],spotShadowMap:[],spotShadowMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[]};for(let u=0;u<9;u++)r.probe.push(new w);const s=new w,o=new ce,a=new ce;function c(u){let h=0,d=0,f=0;for(let A=0;A<9;A++)r.probe[A].set(0,0,0);let p=0,y=0,x=0,g=0,m=0,b=0,_=0,T=0;u.sort(wy);for(let A=0,L=u.length;A<L;A++){const R=u[A],z=R.color,P=R.intensity,U=R.distance,D=R.shadow&&R.shadow.map?R.shadow.map.texture:null;if(R.isAmbientLight)h+=z.r*P,d+=z.g*P,f+=z.b*P;else if(R.isLightProbe)for(let I=0;I<9;I++)r.probe[I].addScaledVector(R.sh.coefficients[I],P);else if(R.isDirectionalLight){const I=t.get(R);if(I.color.copy(R.color).multiplyScalar(R.intensity),R.castShadow){const B=R.shadow,F=i.get(R);F.shadowBias=B.bias,F.shadowNormalBias=B.normalBias,F.shadowRadius=B.radius,F.shadowMapSize=B.mapSize,r.directionalShadow[p]=F,r.directionalShadowMap[p]=D,r.directionalShadowMatrix[p]=R.shadow.matrix,b++}r.directional[p]=I,p++}else if(R.isSpotLight){const I=t.get(R);if(I.position.setFromMatrixPosition(R.matrixWorld),I.color.copy(z).multiplyScalar(P),I.distance=U,I.coneCos=Math.cos(R.angle),I.penumbraCos=Math.cos(R.angle*(1-R.penumbra)),I.decay=R.decay,R.castShadow){const B=R.shadow,F=i.get(R);F.shadowBias=B.bias,F.shadowNormalBias=B.normalBias,F.shadowRadius=B.radius,F.shadowMapSize=B.mapSize,r.spotShadow[x]=F,r.spotShadowMap[x]=D,r.spotShadowMatrix[x]=R.shadow.matrix,T++}r.spot[x]=I,x++}else if(R.isRectAreaLight){const I=t.get(R);I.color.copy(z).multiplyScalar(P),I.halfWidth.set(R.width*.5,0,0),I.halfHeight.set(0,R.height*.5,0),r.rectArea[g]=I,g++}else if(R.isPointLight){const I=t.get(R);if(I.color.copy(R.color).multiplyScalar(R.intensity),I.distance=R.distance,I.decay=R.decay,R.castShadow){const B=R.shadow,F=i.get(R);F.shadowBias=B.bias,F.shadowNormalBias=B.normalBias,F.shadowRadius=B.radius,F.shadowMapSize=B.mapSize,F.shadowCameraNear=B.camera.near,F.shadowCameraFar=B.camera.far,r.pointShadow[y]=F,r.pointShadowMap[y]=D,r.pointShadowMatrix[y]=R.shadow.matrix,_++}r.point[y]=I,y++}else if(R.isHemisphereLight){const I=t.get(R);I.skyColor.copy(R.color).multiplyScalar(P),I.groundColor.copy(R.groundColor).multiplyScalar(P),r.hemi[m]=I,m++}}g>0&&(e.isWebGL2||n.has("OES_texture_float_linear")===!0?(r.rectAreaLTC1=J.LTC_FLOAT_1,r.rectAreaLTC2=J.LTC_FLOAT_2):n.has("OES_texture_half_float_linear")===!0&&(r.rectAreaLTC1=J.LTC_HALF_1,r.rectAreaLTC2=J.LTC_HALF_2)),r.ambient[0]=h,r.ambient[1]=d,r.ambient[2]=f;const v=r.hash;(v.directionalLength!==p||v.pointLength!==y||v.spotLength!==x||v.rectAreaLength!==g||v.hemiLength!==m||v.numDirectionalShadows!==b||v.numPointShadows!==_||v.numSpotShadows!==T)&&(r.directional.length=p,r.spot.length=x,r.rectArea.length=g,r.point.length=y,r.hemi.length=m,r.directionalShadow.length=b,r.directionalShadowMap.length=b,r.pointShadow.length=_,r.pointShadowMap.length=_,r.spotShadow.length=T,r.spotShadowMap.length=T,r.directionalShadowMatrix.length=b,r.pointShadowMatrix.length=_,r.spotShadowMatrix.length=T,v.directionalLength=p,v.pointLength=y,v.spotLength=x,v.rectAreaLength=g,v.hemiLength=m,v.numDirectionalShadows=b,v.numPointShadows=_,v.numSpotShadows=T,r.version=by++)}function l(u,h){let d=0,f=0,p=0,y=0,x=0;const g=h.matrixWorldInverse;for(let m=0,b=u.length;m<b;m++){const _=u[m];if(_.isDirectionalLight){const T=r.directional[d];T.direction.setFromMatrixPosition(_.matrixWorld),s.setFromMatrixPosition(_.target.matrixWorld),T.direction.sub(s),T.direction.transformDirection(g),d++}else if(_.isSpotLight){const T=r.spot[p];T.position.setFromMatrixPosition(_.matrixWorld),T.position.applyMatrix4(g),T.direction.setFromMatrixPosition(_.matrixWorld),s.setFromMatrixPosition(_.target.matrixWorld),T.direction.sub(s),T.direction.transformDirection(g),p++}else if(_.isRectAreaLight){const T=r.rectArea[y];T.position.setFromMatrixPosition(_.matrixWorld),T.position.applyMatrix4(g),a.identity(),o.copy(_.matrixWorld),o.premultiply(g),a.extractRotation(o),T.halfWidth.set(_.width*.5,0,0),T.halfHeight.set(0,_.height*.5,0),T.halfWidth.applyMatrix4(a),T.halfHeight.applyMatrix4(a),y++}else if(_.isPointLight){const T=r.point[f];T.position.setFromMatrixPosition(_.matrixWorld),T.position.applyMatrix4(g),f++}else if(_.isHemisphereLight){const T=r.hemi[x];T.direction.setFromMatrixPosition(_.matrixWorld),T.direction.transformDirection(g),T.direction.normalize(),x++}}}return{setup:c,setupView:l,state:r}}function rl(n,e){const t=new My(n,e),i=[],r=[];function s(){i.length=0,r.length=0}function o(h){i.push(h)}function a(h){r.push(h)}function c(){t.setup(i)}function l(h){t.setupView(i,h)}return{init:s,state:{lightsArray:i,shadowsArray:r,lights:t},setupLights:c,setupLightsView:l,pushLight:o,pushShadow:a}}function Sy(n,e){let t=new WeakMap;function i(s,o=0){let a;return t.has(s)===!1?(a=new rl(n,e),t.set(s,[a])):o>=t.get(s).length?(a=new rl(n,e),t.get(s).push(a)):a=t.get(s)[o],a}function r(){t=new WeakMap}return{get:i,dispose:r}}class lo extends Ve{constructor(e){super(),this.type="MeshDepthMaterial",this.depthPacking=Tu,this.skinning=!1,this.morphTargets=!1,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}lo.prototype.isMeshDepthMaterial=!0;class ho extends Ve{constructor(e){super(),this.type="MeshDistanceMaterial",this.referencePosition=new w,this.nearDistance=1,this.farDistance=1e3,this.skinning=!1,this.morphTargets=!1,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.fog=!1,this.setValues(e)}copy(e){return super.copy(e),this.referencePosition.copy(e.referencePosition),this.nearDistance=e.nearDistance,this.farDistance=e.farDistance,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}ho.prototype.isMeshDistanceMaterial=!0;var Ty=`uniform sampler2D shadow_pass;
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
}`,Ey=`void main() {
	gl_Position = vec4( position, 1.0 );
}`;function Gu(n,e,t){let i=new Or;const r=new W,s=new W,o=new Be,a=[],c=[],l={},u=t.maxTextureSize,h={0:Ke,1:Li,2:Ir},d=new wt({defines:{SAMPLE_RATE:2/8,HALF_SAMPLE_RATE:1/8},uniforms:{shadow_pass:{value:null},resolution:{value:new W},radius:{value:4}},vertexShader:Ey,fragmentShader:Ty}),f=d.clone();f.defines.HORIZONTAL_PASS=1;const p=new le;p.setAttribute("position",new fe(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const y=new Ge(p,d),x=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Ia,this.render=function(v,A,L){if(x.enabled===!1||x.autoUpdate===!1&&x.needsUpdate===!1||v.length===0)return;const R=n.getRenderTarget(),z=n.getActiveCubeFace(),P=n.getActiveMipmapLevel(),U=n.state;U.setBlending(Qt),U.buffers.color.setClear(1,1,1,1),U.buffers.depth.setTest(!0),U.setScissorTest(!1);for(let D=0,I=v.length;D<I;D++){const B=v[D],F=B.shadow;if(F===void 0||F.autoUpdate===!1&&F.needsUpdate===!1)continue;r.copy(F.mapSize);const X=F.getFrameExtents();if(r.multiply(X),s.copy(F.mapSize),(r.x>u||r.y>u)&&(r.x>u&&(s.x=Math.floor(u/X.x),r.x=s.x*X.x,F.mapSize.x=s.x),r.y>u&&(s.y=Math.floor(u/X.y),r.y=s.y*X.y,F.mapSize.y=s.y)),F.map===null&&!F.isPointLightShadow&&this.type===xi){const j={minFilter:it,magFilter:it,format:Et};F.map=new Kt(r.x,r.y,j),F.map.texture.name=B.name+".shadowMap",F.mapPass=new Kt(r.x,r.y,j),F.camera.updateProjectionMatrix()}if(F.map===null){const j={minFilter:nt,magFilter:nt,format:Et};F.map=new Kt(r.x,r.y,j),F.map.texture.name=B.name+".shadowMap",F.camera.updateProjectionMatrix()}n.setRenderTarget(F.map),n.clear();const K=F.getViewportCount();for(let j=0;j<K;j++){const oe=F.getViewport(j);o.set(s.x*oe.x,s.y*oe.y,s.x*oe.z,s.y*oe.w),U.viewport(o),F.updateMatrices(B,j),i=F.getFrustum(),T(A,L,F.camera,B,this.type)}!F.isPointLightShadow&&this.type===xi&&g(F,L),F.needsUpdate=!1}x.needsUpdate=!1,n.setRenderTarget(R,z,P)};function g(v,A){const L=e.update(y);d.uniforms.shadow_pass.value=v.map.texture,d.uniforms.resolution.value=v.mapSize,d.uniforms.radius.value=v.radius,n.setRenderTarget(v.mapPass),n.clear(),n.renderBufferDirect(A,null,L,d,y,null),f.uniforms.shadow_pass.value=v.mapPass.texture,f.uniforms.resolution.value=v.mapSize,f.uniforms.radius.value=v.radius,n.setRenderTarget(v.map),n.clear(),n.renderBufferDirect(A,null,L,f,y,null)}function m(v,A,L){const R=v<<0|A<<1|L<<2;let z=a[R];return z===void 0&&(z=new lo({depthPacking:Eu,morphTargets:v,skinning:A}),a[R]=z),z}function b(v,A,L){const R=v<<0|A<<1|L<<2;let z=c[R];return z===void 0&&(z=new ho({morphTargets:v,skinning:A}),c[R]=z),z}function _(v,A,L,R,z,P,U){let D=null,I=m,B=v.customDepthMaterial;if(R.isPointLight===!0&&(I=b,B=v.customDistanceMaterial),B===void 0){let F=!1;L.morphTargets===!0&&(F=A.morphAttributes&&A.morphAttributes.position&&A.morphAttributes.position.length>0);let X=!1;v.isSkinnedMesh===!0&&L.skinning===!0&&(X=!0);const K=v.isInstancedMesh===!0;D=I(F,X,K)}else D=B;if(n.localClippingEnabled&&L.clipShadows===!0&&L.clippingPlanes.length!==0){const F=D.uuid,X=L.uuid;let K=l[F];K===void 0&&(K={},l[F]=K);let j=K[X];j===void 0&&(j=D.clone(),K[X]=j),D=j}return D.visible=L.visible,D.wireframe=L.wireframe,U===xi?D.side=L.shadowSide!==null?L.shadowSide:L.side:D.side=L.shadowSide!==null?L.shadowSide:h[L.side],D.clipShadows=L.clipShadows,D.clippingPlanes=L.clippingPlanes,D.clipIntersection=L.clipIntersection,D.wireframeLinewidth=L.wireframeLinewidth,D.linewidth=L.linewidth,R.isPointLight===!0&&D.isMeshDistanceMaterial===!0&&(D.referencePosition.setFromMatrixPosition(R.matrixWorld),D.nearDistance=z,D.farDistance=P),D}function T(v,A,L,R,z){if(v.visible===!1)return;if(v.layers.test(A.layers)&&(v.isMesh||v.isLine||v.isPoints)&&(v.castShadow||v.receiveShadow&&z===xi)&&(!v.frustumCulled||i.intersectsObject(v))){v.modelViewMatrix.multiplyMatrices(L.matrixWorldInverse,v.matrixWorld);const D=e.update(v),I=v.material;if(Array.isArray(I)){const B=D.groups;for(let F=0,X=B.length;F<X;F++){const K=B[F],j=I[K.materialIndex];if(j&&j.visible){const oe=_(v,D,j,R,L.near,L.far,z);n.renderBufferDirect(L,null,D,oe,v,K)}}}else if(I.visible){const B=_(v,D,I,R,L.near,L.far,z);n.renderBufferDirect(L,null,D,B,v,null)}}const U=v.children;for(let D=0,I=U.length;D<I;D++)T(U[D],A,L,R,z)}}function Ay(n,e,t){const i=t.isWebGL2;function r(){let C=!1;const Z=new Be;let Q=null;const pe=new Be(0,0,0,0);return{setMask:function(q){Q!==q&&!C&&(n.colorMask(q,q,q,q),Q=q)},setLocked:function(q){C=q},setClear:function(q,xe,Ne,$e,Sn){Sn===!0&&(q*=$e,xe*=$e,Ne*=$e),Z.set(q,xe,Ne,$e),pe.equals(Z)===!1&&(n.clearColor(q,xe,Ne,$e),pe.copy(Z))},reset:function(){C=!1,Q=null,pe.set(-1,0,0,0)}}}function s(){let C=!1,Z=null,Q=null,pe=null;return{setTest:function(q){q?ye(2929):Se(2929)},setMask:function(q){Z!==q&&!C&&(n.depthMask(q),Z=q)},setFunc:function(q){if(Q!==q){if(q)switch(q){case ph:n.depthFunc(512);break;case mh:n.depthFunc(519);break;case gh:n.depthFunc(513);break;case Fs:n.depthFunc(515);break;case yh:n.depthFunc(514);break;case xh:n.depthFunc(518);break;case vh:n.depthFunc(516);break;case _h:n.depthFunc(517);break;default:n.depthFunc(515)}else n.depthFunc(515);Q=q}},setLocked:function(q){C=q},setClear:function(q){pe!==q&&(n.clearDepth(q),pe=q)},reset:function(){C=!1,Z=null,Q=null,pe=null}}}function o(){let C=!1,Z=null,Q=null,pe=null,q=null,xe=null,Ne=null,$e=null,Sn=null;return{setTest:function(Ye){C||(Ye?ye(2960):Se(2960))},setMask:function(Ye){Z!==Ye&&!C&&(n.stencilMask(Ye),Z=Ye)},setFunc:function(Ye,Wt,Rt){(Q!==Ye||pe!==Wt||q!==Rt)&&(n.stencilFunc(Ye,Wt,Rt),Q=Ye,pe=Wt,q=Rt)},setOp:function(Ye,Wt,Rt){(xe!==Ye||Ne!==Wt||$e!==Rt)&&(n.stencilOp(Ye,Wt,Rt),xe=Ye,Ne=Wt,$e=Rt)},setLocked:function(Ye){C=Ye},setClear:function(Ye){Sn!==Ye&&(n.clearStencil(Ye),Sn=Ye)},reset:function(){C=!1,Z=null,Q=null,pe=null,q=null,xe=null,Ne=null,$e=null,Sn=null}}}const a=new r,c=new s,l=new o;let u={},h=null,d={},f=null,p=!1,y=null,x=null,g=null,m=null,b=null,_=null,T=null,v=!1,A=null,L=null,R=null,z=null,P=null;const U=n.getParameter(35661);let D=!1,I=0;const B=n.getParameter(7938);B.indexOf("WebGL")!==-1?(I=parseFloat(/^WebGL (\d)/.exec(B)[1]),D=I>=1):B.indexOf("OpenGL ES")!==-1&&(I=parseFloat(/^OpenGL ES (\d)/.exec(B)[1]),D=I>=2);let F=null,X={};const K=new Be(0,0,n.canvas.width,n.canvas.height),j=new Be(0,0,n.canvas.width,n.canvas.height);function oe(C,Z,Q){const pe=new Uint8Array(4),q=n.createTexture();n.bindTexture(C,q),n.texParameteri(C,10241,9728),n.texParameteri(C,10240,9728);for(let xe=0;xe<Q;xe++)n.texImage2D(Z+xe,0,6408,1,1,0,6408,5121,pe);return q}const ae={};ae[3553]=oe(3553,3553,1),ae[34067]=oe(34067,34069,6),a.setClear(0,0,0,1),c.setClear(1),l.setClear(0),ye(2929),c.setFunc(Fs),Le(!1),Y(sa),ye(2884),Fe(Qt);function ye(C){u[C]!==!0&&(n.enable(C),u[C]=!0)}function Se(C){u[C]!==!1&&(n.disable(C),u[C]=!1)}function G(C){C!==h&&(n.bindFramebuffer(36160,C),h=C)}function De(C,Z){Z===null&&h!==null&&(Z=h),d[C]!==Z&&(n.bindFramebuffer(C,Z),d[C]=Z)}function Ce(C){return f!==C?(n.useProgram(C),f=C,!0):!1}const be={[Nn]:32774,[ih]:32778,[rh]:32779};if(i)be[la]=32775,be[ha]=32776;else{const C=e.get("EXT_blend_minmax");C!==null&&(be[la]=C.MIN_EXT,be[ha]=C.MAX_EXT)}const ge={[sh]:0,[oh]:1,[ah]:768,[Fa]:770,[fh]:776,[uh]:774,[lh]:772,[ch]:769,[Ba]:771,[dh]:775,[hh]:773};function Fe(C,Z,Q,pe,q,xe,Ne,$e){if(C===Qt){p===!0&&(Se(3042),p=!1);return}if(p===!1&&(ye(3042),p=!0),C!==nh){if(C!==y||$e!==v){if((x!==Nn||b!==Nn)&&(n.blendEquation(32774),x=Nn,b=Nn),$e)switch(C){case _i:n.blendFuncSeparate(1,771,1,771);break;case oa:n.blendFunc(1,1);break;case aa:n.blendFuncSeparate(0,0,769,771);break;case ca:n.blendFuncSeparate(0,768,0,770);break;default:break}else switch(C){case _i:n.blendFuncSeparate(770,771,1,771);break;case oa:n.blendFunc(770,1);break;case aa:n.blendFunc(0,769);break;case ca:n.blendFunc(0,768);break;default:break}g=null,m=null,_=null,T=null,y=C,v=$e}return}q=q||Z,xe=xe||Q,Ne=Ne||pe,(Z!==x||q!==b)&&(n.blendEquationSeparate(be[Z],be[q]),x=Z,b=q),(Q!==g||pe!==m||xe!==_||Ne!==T)&&(n.blendFuncSeparate(ge[Q],ge[pe],ge[xe],ge[Ne]),g=Q,m=pe,_=xe,T=Ne),y=C,v=null}function Ee(C,Z){C.side===Ir?Se(2884):ye(2884);let Q=C.side===Ke;Z&&(Q=!Q),Le(Q),C.blending===_i&&C.transparent===!1?Fe(Qt):Fe(C.blending,C.blendEquation,C.blendSrc,C.blendDst,C.blendEquationAlpha,C.blendSrcAlpha,C.blendDstAlpha,C.premultipliedAlpha),c.setFunc(C.depthFunc),c.setTest(C.depthTest),c.setMask(C.depthWrite),a.setMask(C.colorWrite);const pe=C.stencilWrite;l.setTest(pe),pe&&(l.setMask(C.stencilWriteMask),l.setFunc(C.stencilFunc,C.stencilRef,C.stencilFuncMask),l.setOp(C.stencilFail,C.stencilZFail,C.stencilZPass)),ee(C.polygonOffset,C.polygonOffsetFactor,C.polygonOffsetUnits),C.alphaToCoverage===!0?ye(32926):Se(32926)}function Le(C){A!==C&&(C?n.frontFace(2304):n.frontFace(2305),A=C)}function Y(C){C!==Kl?(ye(2884),C!==L&&(C===sa?n.cullFace(1029):C===eh?n.cullFace(1028):n.cullFace(1032))):Se(2884),L=C}function $(C){C!==R&&(D&&n.lineWidth(C),R=C)}function ee(C,Z,Q){C?(ye(32823),(z!==Z||P!==Q)&&(n.polygonOffset(Z,Q),z=Z,P=Q)):Se(32823)}function ue(C){C?ye(3089):Se(3089)}function ne(C){C===void 0&&(C=33984+U-1),F!==C&&(n.activeTexture(C),F=C)}function E(C,Z){F===null&&ne();let Q=X[F];Q===void 0&&(Q={type:void 0,texture:void 0},X[F]=Q),(Q.type!==C||Q.texture!==Z)&&(n.bindTexture(C,Z||ae[C]),Q.type=C,Q.texture=Z)}function S(){const C=X[F];C!==void 0&&C.type!==void 0&&(n.bindTexture(C.type,null),C.type=void 0,C.texture=void 0)}function k(){try{n.compressedTexImage2D.apply(n,arguments)}catch{}}function V(){try{n.texImage2D.apply(n,arguments)}catch{}}function ie(){try{n.texImage3D.apply(n,arguments)}catch{}}function he(C){K.equals(C)===!1&&(n.scissor(C.x,C.y,C.z,C.w),K.copy(C))}function Ie(C){j.equals(C)===!1&&(n.viewport(C.x,C.y,C.z,C.w),j.copy(C))}function we(){n.disable(3042),n.disable(2884),n.disable(2929),n.disable(32823),n.disable(3089),n.disable(2960),n.disable(32926),n.blendEquation(32774),n.blendFunc(1,0),n.blendFuncSeparate(1,0,1,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(513),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(519,0,4294967295),n.stencilOp(7680,7680,7680),n.clearStencil(0),n.cullFace(1029),n.frontFace(2305),n.polygonOffset(0,0),n.activeTexture(33984),n.bindFramebuffer(36160,null),i===!0&&(n.bindFramebuffer(36009,null),n.bindFramebuffer(36008,null)),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),u={},F=null,X={},h=null,d={},f=null,p=!1,y=null,x=null,g=null,m=null,b=null,_=null,T=null,v=!1,A=null,L=null,R=null,z=null,P=null,K.set(0,0,n.canvas.width,n.canvas.height),j.set(0,0,n.canvas.width,n.canvas.height),a.reset(),c.reset(),l.reset()}return{buffers:{color:a,depth:c,stencil:l},enable:ye,disable:Se,bindFramebuffer:De,bindXRFramebuffer:G,useProgram:Ce,setBlending:Fe,setMaterial:Ee,setFlipSided:Le,setCullFace:Y,setLineWidth:$,setPolygonOffset:ee,setScissorTest:ue,activeTexture:ne,bindTexture:E,unbindTexture:S,compressedTexImage2D:k,texImage2D:V,texImage3D:ie,scissor:he,viewport:Ie,reset:we}}function Ly(n,e,t,i,r,s,o){const a=r.isWebGL2,c=r.maxTextures,l=r.maxCubemapSize,u=r.maxTextureSize,h=r.maxSamples,d=new WeakMap;let f,p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function y(E,S){return p?new OffscreenCanvas(E,S):document.createElementNS("http://www.w3.org/1999/xhtml","canvas")}function x(E,S,k,V){let ie=1;if((E.width>V||E.height>V)&&(ie=V/Math.max(E.width,E.height)),ie<1||S===!0)if(typeof HTMLImageElement<"u"&&E instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&E instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&E instanceof ImageBitmap){const he=S?me.floorPowerOfTwo:Math.floor,Ie=he(ie*E.width),we=he(ie*E.height);f===void 0&&(f=y(Ie,we));const C=k?y(Ie,we):f;return C.width=Ie,C.height=we,C.getContext("2d").drawImage(E,0,0,Ie,we),C}else return"data"in E,E;return E}function g(E){return me.isPowerOfTwo(E.width)&&me.isPowerOfTwo(E.height)}function m(E){return a?!1:E.wrapS!==mt||E.wrapT!==mt||E.minFilter!==nt&&E.minFilter!==it}function b(E,S){return E.generateMipmaps&&S&&E.minFilter!==nt&&E.minFilter!==it}function _(E,S,k,V){n.generateMipmap(E);const ie=i.get(S);ie.__maxMipLevel=Math.log2(Math.max(k,V))}function T(E,S,k){if(a===!1)return S;if(E!==null&&n[E]!==void 0)return n[E];let V=S;return S===6403&&(k===5126&&(V=33326),k===5131&&(V=33325),k===5121&&(V=33321)),S===6407&&(k===5126&&(V=34837),k===5131&&(V=34843),k===5121&&(V=32849)),S===6408&&(k===5126&&(V=34836),k===5131&&(V=34842),k===5121&&(V=32856)),(V===33325||V===33326||V===34842||V===34836)&&e.get("EXT_color_buffer_float"),V}function v(E){return E===nt||E===zs||E===Os?9728:9729}function A(E){const S=E.target;S.removeEventListener("dispose",A),R(S),S.isVideoTexture&&d.delete(S),o.memory.textures--}function L(E){const S=E.target;S.removeEventListener("dispose",L),z(S),o.memory.textures--}function R(E){const S=i.get(E);S.__webglInit!==void 0&&(n.deleteTexture(S.__webglTexture),i.remove(E))}function z(E){const S=E.texture,k=i.get(E),V=i.get(S);if(E){if(V.__webglTexture!==void 0&&n.deleteTexture(V.__webglTexture),E.depthTexture&&E.depthTexture.dispose(),E.isWebGLCubeRenderTarget)for(let ie=0;ie<6;ie++)n.deleteFramebuffer(k.__webglFramebuffer[ie]),k.__webglDepthbuffer&&n.deleteRenderbuffer(k.__webglDepthbuffer[ie]);else n.deleteFramebuffer(k.__webglFramebuffer),k.__webglDepthbuffer&&n.deleteRenderbuffer(k.__webglDepthbuffer),k.__webglMultisampledFramebuffer&&n.deleteFramebuffer(k.__webglMultisampledFramebuffer),k.__webglColorRenderbuffer&&n.deleteRenderbuffer(k.__webglColorRenderbuffer),k.__webglDepthRenderbuffer&&n.deleteRenderbuffer(k.__webglDepthRenderbuffer);i.remove(S),i.remove(E)}}let P=0;function U(){P=0}function D(){const E=P;return E>=c,P+=1,E}function I(E,S){const k=i.get(E);if(E.isVideoTexture&&Y(E),E.version>0&&k.__version!==E.version){const V=E.image;if(V!==void 0){if(V.complete!==!1){ye(k,E,S);return}}}t.activeTexture(33984+S),t.bindTexture(3553,k.__webglTexture)}function B(E,S){const k=i.get(E);if(E.version>0&&k.__version!==E.version){ye(k,E,S);return}t.activeTexture(33984+S),t.bindTexture(35866,k.__webglTexture)}function F(E,S){const k=i.get(E);if(E.version>0&&k.__version!==E.version){ye(k,E,S);return}t.activeTexture(33984+S),t.bindTexture(32879,k.__webglTexture)}function X(E,S){const k=i.get(E);if(E.version>0&&k.__version!==E.version){Se(k,E,S);return}t.activeTexture(33984+S),t.bindTexture(34067,k.__webglTexture)}const K={[nr]:10497,[mt]:33071,[ir]:33648},j={[nt]:9728,[zs]:9984,[Os]:9986,[it]:9729,[Na]:9985,[Ci]:9987};function oe(E,S,k){if(k?(n.texParameteri(E,10242,K[S.wrapS]),n.texParameteri(E,10243,K[S.wrapT]),(E===32879||E===35866)&&n.texParameteri(E,32882,K[S.wrapR]),n.texParameteri(E,10240,j[S.magFilter]),n.texParameteri(E,10241,j[S.minFilter])):(n.texParameteri(E,10242,33071),n.texParameteri(E,10243,33071),(E===32879||E===35866)&&n.texParameteri(E,32882,33071),S.wrapS!==mt||S.wrapT,n.texParameteri(E,10240,v(S.magFilter)),n.texParameteri(E,10241,v(S.minFilter)),S.minFilter!==nt&&S.minFilter),e.has("EXT_texture_filter_anisotropic")===!0){const V=e.get("EXT_texture_filter_anisotropic");if(S.type===$t&&e.has("OES_texture_float_linear")===!1||a===!1&&S.type===sr&&e.has("OES_texture_half_float_linear")===!1)return;(S.anisotropy>1||i.get(S).__currentAnisotropy)&&(n.texParameterf(E,V.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(S.anisotropy,r.getMaxAnisotropy())),i.get(S).__currentAnisotropy=S.anisotropy)}}function ae(E,S){E.__webglInit===void 0&&(E.__webglInit=!0,S.addEventListener("dispose",A),E.__webglTexture=n.createTexture(),o.memory.textures++)}function ye(E,S,k){let V=3553;S.isDataTexture2DArray&&(V=35866),S.isDataTexture3D&&(V=32879),ae(E,S),t.activeTexture(33984+k),t.bindTexture(V,E.__webglTexture),n.pixelStorei(37440,S.flipY),n.pixelStorei(37441,S.premultiplyAlpha),n.pixelStorei(3317,S.unpackAlignment),n.pixelStorei(37443,0);const ie=m(S)&&g(S.image)===!1,he=x(S.image,ie,!1,u),Ie=g(he)||a,we=s.convert(S.format);let C=s.convert(S.type),Z=T(S.internalFormat,we,C);oe(V,S,Ie);let Q;const pe=S.mipmaps;if(S.isDepthTexture)Z=6402,a?S.type===$t?Z=36012:S.type===Qi?Z=33190:S.type===bi?Z=35056:Z=33189:S.type,S.format===Gn&&Z===6402&&S.type!==rr&&S.type!==Qi&&(S.type=rr,C=s.convert(S.type)),S.format===Mi&&Z===6402&&(Z=34041,S.type!==bi&&(S.type=bi,C=s.convert(S.type))),t.texImage2D(3553,0,Z,he.width,he.height,0,we,C,null);else if(S.isDataTexture)if(pe.length>0&&Ie){for(let q=0,xe=pe.length;q<xe;q++)Q=pe[q],t.texImage2D(3553,q,Z,Q.width,Q.height,0,we,C,Q.data);S.generateMipmaps=!1,E.__maxMipLevel=pe.length-1}else t.texImage2D(3553,0,Z,he.width,he.height,0,we,C,he.data),E.__maxMipLevel=0;else if(S.isCompressedTexture){for(let q=0,xe=pe.length;q<xe;q++)Q=pe[q],S.format!==Et&&S.format!==fn?we!==null&&t.compressedTexImage2D(3553,q,Z,Q.width,Q.height,0,Q.data):t.texImage2D(3553,q,Z,Q.width,Q.height,0,we,C,Q.data);E.__maxMipLevel=pe.length-1}else if(S.isDataTexture2DArray)t.texImage3D(35866,0,Z,he.width,he.height,he.depth,0,we,C,he.data),E.__maxMipLevel=0;else if(S.isDataTexture3D)t.texImage3D(32879,0,Z,he.width,he.height,he.depth,0,we,C,he.data),E.__maxMipLevel=0;else if(pe.length>0&&Ie){for(let q=0,xe=pe.length;q<xe;q++)Q=pe[q],t.texImage2D(3553,q,Z,we,C,Q);S.generateMipmaps=!1,E.__maxMipLevel=pe.length-1}else t.texImage2D(3553,0,Z,we,C,he),E.__maxMipLevel=0;b(S,Ie)&&_(V,S,he.width,he.height),E.__version=S.version,S.onUpdate&&S.onUpdate(S)}function Se(E,S,k){if(S.image.length!==6)return;ae(E,S),t.activeTexture(33984+k),t.bindTexture(34067,E.__webglTexture),n.pixelStorei(37440,S.flipY),n.pixelStorei(37441,S.premultiplyAlpha),n.pixelStorei(3317,S.unpackAlignment),n.pixelStorei(37443,0);const V=S&&(S.isCompressedTexture||S.image[0].isCompressedTexture),ie=S.image[0]&&S.image[0].isDataTexture,he=[];for(let q=0;q<6;q++)!V&&!ie?he[q]=x(S.image[q],!1,!0,l):he[q]=ie?S.image[q].image:S.image[q];const Ie=he[0],we=g(Ie)||a,C=s.convert(S.format),Z=s.convert(S.type),Q=T(S.internalFormat,C,Z);oe(34067,S,we);let pe;if(V){for(let q=0;q<6;q++){pe=he[q].mipmaps;for(let xe=0;xe<pe.length;xe++){const Ne=pe[xe];S.format!==Et&&S.format!==fn?C!==null&&t.compressedTexImage2D(34069+q,xe,Q,Ne.width,Ne.height,0,Ne.data):t.texImage2D(34069+q,xe,Q,Ne.width,Ne.height,0,C,Z,Ne.data)}}E.__maxMipLevel=pe.length-1}else{pe=S.mipmaps;for(let q=0;q<6;q++)if(ie){t.texImage2D(34069+q,0,Q,he[q].width,he[q].height,0,C,Z,he[q].data);for(let xe=0;xe<pe.length;xe++){const $e=pe[xe].image[q].image;t.texImage2D(34069+q,xe+1,Q,$e.width,$e.height,0,C,Z,$e.data)}}else{t.texImage2D(34069+q,0,Q,C,Z,he[q]);for(let xe=0;xe<pe.length;xe++){const Ne=pe[xe];t.texImage2D(34069+q,xe+1,Q,C,Z,Ne.image[q])}}E.__maxMipLevel=pe.length}b(S,we)&&_(34067,S,Ie.width,Ie.height),E.__version=S.version,S.onUpdate&&S.onUpdate(S)}function G(E,S,k,V){const ie=S.texture,he=s.convert(ie.format),Ie=s.convert(ie.type),we=T(ie.internalFormat,he,Ie);V===32879||V===35866?t.texImage3D(V,0,we,S.width,S.height,S.depth,0,he,Ie,null):t.texImage2D(V,0,we,S.width,S.height,0,he,Ie,null),t.bindFramebuffer(36160,E),n.framebufferTexture2D(36160,k,V,i.get(ie).__webglTexture,0),t.bindFramebuffer(36160,null)}function De(E,S,k){if(n.bindRenderbuffer(36161,E),S.depthBuffer&&!S.stencilBuffer){let V=33189;if(k){const ie=S.depthTexture;ie&&ie.isDepthTexture&&(ie.type===$t?V=36012:ie.type===Qi&&(V=33190));const he=Le(S);n.renderbufferStorageMultisample(36161,he,V,S.width,S.height)}else n.renderbufferStorage(36161,V,S.width,S.height);n.framebufferRenderbuffer(36160,36096,36161,E)}else if(S.depthBuffer&&S.stencilBuffer){if(k){const V=Le(S);n.renderbufferStorageMultisample(36161,V,35056,S.width,S.height)}else n.renderbufferStorage(36161,34041,S.width,S.height);n.framebufferRenderbuffer(36160,33306,36161,E)}else{const V=S.texture,ie=s.convert(V.format),he=s.convert(V.type),Ie=T(V.internalFormat,ie,he);if(k){const we=Le(S);n.renderbufferStorageMultisample(36161,we,Ie,S.width,S.height)}else n.renderbufferStorage(36161,Ie,S.width,S.height)}n.bindRenderbuffer(36161,null)}function Ce(E,S){if(S&&S.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(36160,E),!(S.depthTexture&&S.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");(!i.get(S.depthTexture).__webglTexture||S.depthTexture.image.width!==S.width||S.depthTexture.image.height!==S.height)&&(S.depthTexture.image.width=S.width,S.depthTexture.image.height=S.height,S.depthTexture.needsUpdate=!0),I(S.depthTexture,0);const V=i.get(S.depthTexture).__webglTexture;if(S.depthTexture.format===Gn)n.framebufferTexture2D(36160,36096,3553,V,0);else if(S.depthTexture.format===Mi)n.framebufferTexture2D(36160,33306,3553,V,0);else throw new Error("Unknown depthTexture format")}function be(E){const S=i.get(E),k=E.isWebGLCubeRenderTarget===!0;if(E.depthTexture){if(k)throw new Error("target.depthTexture not supported in Cube render targets");Ce(S.__webglFramebuffer,E)}else if(k){S.__webglDepthbuffer=[];for(let V=0;V<6;V++)t.bindFramebuffer(36160,S.__webglFramebuffer[V]),S.__webglDepthbuffer[V]=n.createRenderbuffer(),De(S.__webglDepthbuffer[V],E,!1)}else t.bindFramebuffer(36160,S.__webglFramebuffer),S.__webglDepthbuffer=n.createRenderbuffer(),De(S.__webglDepthbuffer,E,!1);t.bindFramebuffer(36160,null)}function ge(E){const S=E.texture,k=i.get(E),V=i.get(S);E.addEventListener("dispose",L),V.__webglTexture=n.createTexture(),V.__version=S.version,o.memory.textures++;const ie=E.isWebGLCubeRenderTarget===!0,he=E.isWebGLMultisampleRenderTarget===!0,Ie=S.isDataTexture3D||S.isDataTexture2DArray,we=g(E)||a;if(a&&S.format===fn&&(S.type===$t||S.type===sr)&&(S.format=Et),ie){k.__webglFramebuffer=[];for(let C=0;C<6;C++)k.__webglFramebuffer[C]=n.createFramebuffer()}else if(k.__webglFramebuffer=n.createFramebuffer(),he&&a){k.__webglMultisampledFramebuffer=n.createFramebuffer(),k.__webglColorRenderbuffer=n.createRenderbuffer(),n.bindRenderbuffer(36161,k.__webglColorRenderbuffer);const C=s.convert(S.format),Z=s.convert(S.type),Q=T(S.internalFormat,C,Z),pe=Le(E);n.renderbufferStorageMultisample(36161,pe,Q,E.width,E.height),t.bindFramebuffer(36160,k.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(36160,36064,36161,k.__webglColorRenderbuffer),n.bindRenderbuffer(36161,null),E.depthBuffer&&(k.__webglDepthRenderbuffer=n.createRenderbuffer(),De(k.__webglDepthRenderbuffer,E,!0)),t.bindFramebuffer(36160,null)}if(ie){t.bindTexture(34067,V.__webglTexture),oe(34067,S,we);for(let C=0;C<6;C++)G(k.__webglFramebuffer[C],E,36064,34069+C);b(S,we)&&_(34067,S,E.width,E.height),t.bindTexture(34067,null)}else{let C=3553;Ie&&a&&(C=S.isDataTexture3D?32879:35866),t.bindTexture(C,V.__webglTexture),oe(C,S,we),G(k.__webglFramebuffer,E,36064,C),b(S,we)&&_(3553,S,E.width,E.height),t.bindTexture(3553,null)}E.depthBuffer&&be(E)}function Fe(E){const S=E.texture,k=g(E)||a;if(b(S,k)){const V=E.isWebGLCubeRenderTarget?34067:3553,ie=i.get(S).__webglTexture;t.bindTexture(V,ie),_(V,S,E.width,E.height),t.bindTexture(V,null)}}function Ee(E){if(E.isWebGLMultisampleRenderTarget&&a){const S=i.get(E);t.bindFramebuffer(36008,S.__webglMultisampledFramebuffer),t.bindFramebuffer(36009,S.__webglFramebuffer);const k=E.width,V=E.height;let ie=16384;E.depthBuffer&&(ie|=256),E.stencilBuffer&&(ie|=1024),n.blitFramebuffer(0,0,k,V,0,0,k,V,ie,9728),t.bindFramebuffer(36160,S.__webglMultisampledFramebuffer)}}function Le(E){return a&&E.isWebGLMultisampleRenderTarget?Math.min(h,E.samples):0}function Y(E){const S=o.render.frame;d.get(E)!==S&&(d.set(E,S),E.update())}let $=!1,ee=!1;function ue(E,S){E&&E.isWebGLRenderTarget&&($===!1&&($=!0),E=E.texture),I(E,S)}function ne(E,S){E&&E.isWebGLCubeRenderTarget&&(ee===!1&&(ee=!0),E=E.texture),X(E,S)}this.allocateTextureUnit=D,this.resetTextureUnits=U,this.setTexture2D=I,this.setTexture2DArray=B,this.setTexture3D=F,this.setTextureCube=X,this.setupRenderTarget=ge,this.updateRenderTargetMipmap=Fe,this.updateMultisampleRenderTarget=Ee,this.safeSetTexture2D=ue,this.safeSetTextureCube=ne}function ku(n,e,t){const i=t.isWebGL2;function r(s){let o;if(s===Pi)return 5121;if(s===Ph)return 32819;if(s===Ih)return 32820;if(s===Dh)return 33635;if(s===Lh)return 5120;if(s===Rh)return 5122;if(s===rr)return 5123;if(s===Ch)return 5124;if(s===Qi)return 5125;if(s===$t)return 5126;if(s===sr)return i?5131:(o=e.get("OES_texture_half_float"),o!==null?o.HALF_FLOAT_OES:null);if(s===Fh)return 6406;if(s===fn)return 6407;if(s===Et)return 6408;if(s===Bh)return 6409;if(s===Nh)return 6410;if(s===Gn)return 6402;if(s===Mi)return 34041;if(s===Oh)return 6403;if(s===Uh)return 36244;if(s===Hh)return 33319;if(s===Gh)return 33320;if(s===kh)return 36248;if(s===Vh)return 36249;if(s===ua||s===da||s===fa||s===pa)if(o=e.get("WEBGL_compressed_texture_s3tc"),o!==null){if(s===ua)return o.COMPRESSED_RGB_S3TC_DXT1_EXT;if(s===da)return o.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(s===fa)return o.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(s===pa)return o.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(s===ma||s===ga||s===ya||s===xa)if(o=e.get("WEBGL_compressed_texture_pvrtc"),o!==null){if(s===ma)return o.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(s===ga)return o.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(s===ya)return o.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(s===xa)return o.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(s===Wh)return o=e.get("WEBGL_compressed_texture_etc1"),o!==null?o.COMPRESSED_RGB_ETC1_WEBGL:null;if((s===va||s===_a)&&(o=e.get("WEBGL_compressed_texture_etc"),o!==null)){if(s===va)return o.COMPRESSED_RGB8_ETC2;if(s===_a)return o.COMPRESSED_RGBA8_ETC2_EAC}if(s===qh||s===Xh||s===Yh||s===jh||s===Zh||s===Jh||s===$h||s===Qh||s===Kh||s===eu||s===tu||s===nu||s===iu||s===ru||s===ou||s===au||s===cu||s===lu||s===hu||s===uu||s===du||s===fu||s===pu||s===mu||s===gu||s===yu||s===xu||s===vu)return o=e.get("WEBGL_compressed_texture_astc"),o!==null?s:null;if(s===su)return o=e.get("EXT_texture_compression_bptc"),o!==null?s:null;if(s===bi)return i?34042:(o=e.get("WEBGL_depth_texture"),o!==null?o.UNSIGNED_INT_24_8_WEBGL:null)}return{convert:r}}class Wa extends tt{constructor(e=[]){super(),this.cameras=e}}Wa.prototype.isArrayCamera=!0;class Un extends de{constructor(){super(),this.type="Group"}}Un.prototype.isGroup=!0;function Ki(){this._targetRay=null,this._grip=null,this._hand=null}Object.assign(Ki.prototype,{constructor:Ki,getHandSpace:function(){return this._hand===null&&(this._hand=new Un,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand},getTargetRaySpace:function(){return this._targetRay===null&&(this._targetRay=new Un,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1),this._targetRay},getGripSpace:function(){return this._grip===null&&(this._grip=new Un,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1),this._grip},dispatchEvent:function(n){return this._targetRay!==null&&this._targetRay.dispatchEvent(n),this._grip!==null&&this._grip.dispatchEvent(n),this._hand!==null&&this._hand.dispatchEvent(n),this},disconnect:function(n){return this.dispatchEvent({type:"disconnected",data:n}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this},update:function(n,e,t){let i=null,r=null,s=null;const o=this._targetRay,a=this._grip,c=this._hand;if(n&&e.session.visibilityState!=="visible-blurred")if(o!==null&&(i=e.getPose(n.targetRaySpace,t),i!==null&&(o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale))),c&&n.hand){s=!0;for(const p of n.hand.values()){const y=e.getJointPose(p,t);if(c.joints[p.jointName]===void 0){const g=new Un;g.matrixAutoUpdate=!1,g.visible=!1,c.joints[p.jointName]=g,c.add(g)}const x=c.joints[p.jointName];y!==null&&(x.matrix.fromArray(y.transform.matrix),x.matrix.decompose(x.position,x.rotation,x.scale),x.jointRadius=y.radius),x.visible=y!==null}const l=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],h=l.position.distanceTo(u.position),d=.02,f=.005;c.inputState.pinching&&h>d+f?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:n.handedness,target:this})):!c.inputState.pinching&&h<=d-f&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:n.handedness,target:this}))}else a!==null&&n.gripSpace&&(r=e.getPose(n.gripSpace,t),r!==null&&(a.matrix.fromArray(r.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale)));return o!==null&&(o.visible=i!==null),a!==null&&(a.visible=r!==null),c!==null&&(c.visible=s!==null),this}});function Vu(n,e){const t=this,i=n.state;let r=null,s=1,o=null,a="local-floor",c=null;const l=[],u=new Map,h=new tt;h.layers.enable(1),h.viewport=new Be;const d=new tt;d.layers.enable(2),d.viewport=new Be;const f=[h,d],p=new Wa;p.layers.enable(1),p.layers.enable(2);let y=null,x=null;this.enabled=!1,this.isPresenting=!1,this.getController=function(P){let U=l[P];return U===void 0&&(U=new Ki,l[P]=U),U.getTargetRaySpace()},this.getControllerGrip=function(P){let U=l[P];return U===void 0&&(U=new Ki,l[P]=U),U.getGripSpace()},this.getHand=function(P){let U=l[P];return U===void 0&&(U=new Ki,l[P]=U),U.getHandSpace()};function g(P){const U=u.get(P.inputSource);U&&U.dispatchEvent({type:P.type,data:P.inputSource})}function m(){u.forEach(function(P,U){P.disconnect(U)}),u.clear(),y=null,x=null,i.bindXRFramebuffer(null),n.setRenderTarget(n.getRenderTarget()),z.stop(),t.isPresenting=!1,t.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(P){s=P,t.isPresenting},this.setReferenceSpaceType=function(P){a=P,t.isPresenting},this.getReferenceSpace=function(){return o},this.getSession=function(){return r},this.setSession=async function(P){if(r=P,r!==null){r.addEventListener("select",g),r.addEventListener("selectstart",g),r.addEventListener("selectend",g),r.addEventListener("squeeze",g),r.addEventListener("squeezestart",g),r.addEventListener("squeezeend",g),r.addEventListener("end",m),r.addEventListener("inputsourceschange",b);const U=e.getContextAttributes();U.xrCompatible!==!0&&await e.makeXRCompatible();const D={antialias:U.antialias,alpha:U.alpha,depth:U.depth,stencil:U.stencil,framebufferScaleFactor:s},I=new XRWebGLLayer(r,e,D);r.updateRenderState({baseLayer:I}),o=await r.requestReferenceSpace(a),z.setContext(r),z.start(),t.isPresenting=!0,t.dispatchEvent({type:"sessionstart"})}};function b(P){const U=r.inputSources;for(let D=0;D<l.length;D++)u.set(U[D],l[D]);for(let D=0;D<P.removed.length;D++){const I=P.removed[D],B=u.get(I);B&&(B.dispatchEvent({type:"disconnected",data:I}),u.delete(I))}for(let D=0;D<P.added.length;D++){const I=P.added[D],B=u.get(I);B&&B.dispatchEvent({type:"connected",data:I})}}const _=new w,T=new w;function v(P,U,D){_.setFromMatrixPosition(U.matrixWorld),T.setFromMatrixPosition(D.matrixWorld);const I=_.distanceTo(T),B=U.projectionMatrix.elements,F=D.projectionMatrix.elements,X=B[14]/(B[10]-1),K=B[14]/(B[10]+1),j=(B[9]+1)/B[5],oe=(B[9]-1)/B[5],ae=(B[8]-1)/B[0],ye=(F[8]+1)/F[0],Se=X*ae,G=X*ye,De=I/(-ae+ye),Ce=De*-ae;U.matrixWorld.decompose(P.position,P.quaternion,P.scale),P.translateX(Ce),P.translateZ(De),P.matrixWorld.compose(P.position,P.quaternion,P.scale),P.matrixWorldInverse.copy(P.matrixWorld).invert();const be=X+De,ge=K+De,Fe=Se-Ce,Ee=G+(I-Ce),Le=j*K/ge*be,Y=oe*K/ge*be;P.projectionMatrix.makePerspective(Fe,Ee,Le,Y,be,ge)}function A(P,U){U===null?P.matrixWorld.copy(P.matrix):P.matrixWorld.multiplyMatrices(U.matrixWorld,P.matrix),P.matrixWorldInverse.copy(P.matrixWorld).invert()}this.getCamera=function(P){p.near=d.near=h.near=P.near,p.far=d.far=h.far=P.far,(y!==p.near||x!==p.far)&&(r.updateRenderState({depthNear:p.near,depthFar:p.far}),y=p.near,x=p.far);const U=P.parent,D=p.cameras;A(p,U);for(let B=0;B<D.length;B++)A(D[B],U);P.matrixWorld.copy(p.matrixWorld),P.matrix.copy(p.matrix),P.matrix.decompose(P.position,P.quaternion,P.scale);const I=P.children;for(let B=0,F=I.length;B<F;B++)I[B].updateMatrixWorld(!0);return D.length===2?v(p,h,d):p.projectionMatrix.copy(h.projectionMatrix),p};let L=null;function R(P,U){if(c=U.getViewerPose(o),c!==null){const I=c.views,B=r.renderState.baseLayer;i.bindXRFramebuffer(B.framebuffer);let F=!1;I.length!==p.cameras.length&&(p.cameras.length=0,F=!0);for(let X=0;X<I.length;X++){const K=I[X],j=B.getViewport(K),oe=f[X];oe.matrix.fromArray(K.transform.matrix),oe.projectionMatrix.fromArray(K.projectionMatrix),oe.viewport.set(j.x,j.y,j.width,j.height),X===0&&p.matrix.copy(oe.matrix),F===!0&&p.cameras.push(oe)}}const D=r.inputSources;for(let I=0;I<l.length;I++){const B=l[I],F=D[I];B.update(F,U,o)}L&&L(P,U)}const z=new Du;z.setAnimationLoop(R),this.setAnimationLoop=function(P){L=P},this.dispose=function(){}}Object.assign(Vu.prototype,nn.prototype);function Ry(n){function e(g,m){g.fogColor.value.copy(m.color),m.isFog?(g.fogNear.value=m.near,g.fogFar.value=m.far):m.isFogExp2&&(g.fogDensity.value=m.density)}function t(g,m,b,_){m.isMeshBasicMaterial?i(g,m):m.isMeshLambertMaterial?(i(g,m),c(g,m)):m.isMeshToonMaterial?(i(g,m),u(g,m)):m.isMeshPhongMaterial?(i(g,m),l(g,m)):m.isMeshStandardMaterial?(i(g,m),m.isMeshPhysicalMaterial?d(g,m):h(g,m)):m.isMeshMatcapMaterial?(i(g,m),f(g,m)):m.isMeshDepthMaterial?(i(g,m),p(g,m)):m.isMeshDistanceMaterial?(i(g,m),y(g,m)):m.isMeshNormalMaterial?(i(g,m),x(g,m)):m.isLineBasicMaterial?(r(g,m),m.isLineDashedMaterial&&s(g,m)):m.isPointsMaterial?o(g,m,b,_):m.isSpriteMaterial?a(g,m):m.isShadowMaterial?(g.color.value.copy(m.color),g.opacity.value=m.opacity):m.isShaderMaterial&&(m.uniformsNeedUpdate=!1)}function i(g,m){g.opacity.value=m.opacity,m.color&&g.diffuse.value.copy(m.color),m.emissive&&g.emissive.value.copy(m.emissive).multiplyScalar(m.emissiveIntensity),m.map&&(g.map.value=m.map),m.alphaMap&&(g.alphaMap.value=m.alphaMap),m.specularMap&&(g.specularMap.value=m.specularMap);const b=n.get(m).envMap;if(b){g.envMap.value=b,g.flipEnvMap.value=b.isCubeTexture&&b._needsFlipEnvMap?-1:1,g.reflectivity.value=m.reflectivity,g.refractionRatio.value=m.refractionRatio;const v=n.get(b).__maxMipLevel;v!==void 0&&(g.maxMipLevel.value=v)}m.lightMap&&(g.lightMap.value=m.lightMap,g.lightMapIntensity.value=m.lightMapIntensity),m.aoMap&&(g.aoMap.value=m.aoMap,g.aoMapIntensity.value=m.aoMapIntensity);let _;m.map?_=m.map:m.specularMap?_=m.specularMap:m.displacementMap?_=m.displacementMap:m.normalMap?_=m.normalMap:m.bumpMap?_=m.bumpMap:m.roughnessMap?_=m.roughnessMap:m.metalnessMap?_=m.metalnessMap:m.alphaMap?_=m.alphaMap:m.emissiveMap?_=m.emissiveMap:m.clearcoatMap?_=m.clearcoatMap:m.clearcoatNormalMap?_=m.clearcoatNormalMap:m.clearcoatRoughnessMap&&(_=m.clearcoatRoughnessMap),_!==void 0&&(_.isWebGLRenderTarget&&(_=_.texture),_.matrixAutoUpdate===!0&&_.updateMatrix(),g.uvTransform.value.copy(_.matrix));let T;m.aoMap?T=m.aoMap:m.lightMap&&(T=m.lightMap),T!==void 0&&(T.isWebGLRenderTarget&&(T=T.texture),T.matrixAutoUpdate===!0&&T.updateMatrix(),g.uv2Transform.value.copy(T.matrix))}function r(g,m){g.diffuse.value.copy(m.color),g.opacity.value=m.opacity}function s(g,m){g.dashSize.value=m.dashSize,g.totalSize.value=m.dashSize+m.gapSize,g.scale.value=m.scale}function o(g,m,b,_){g.diffuse.value.copy(m.color),g.opacity.value=m.opacity,g.size.value=m.size*b,g.scale.value=_*.5,m.map&&(g.map.value=m.map),m.alphaMap&&(g.alphaMap.value=m.alphaMap);let T;m.map?T=m.map:m.alphaMap&&(T=m.alphaMap),T!==void 0&&(T.matrixAutoUpdate===!0&&T.updateMatrix(),g.uvTransform.value.copy(T.matrix))}function a(g,m){g.diffuse.value.copy(m.color),g.opacity.value=m.opacity,g.rotation.value=m.rotation,m.map&&(g.map.value=m.map),m.alphaMap&&(g.alphaMap.value=m.alphaMap);let b;m.map?b=m.map:m.alphaMap&&(b=m.alphaMap),b!==void 0&&(b.matrixAutoUpdate===!0&&b.updateMatrix(),g.uvTransform.value.copy(b.matrix))}function c(g,m){m.emissiveMap&&(g.emissiveMap.value=m.emissiveMap)}function l(g,m){g.specular.value.copy(m.specular),g.shininess.value=Math.max(m.shininess,1e-4),m.emissiveMap&&(g.emissiveMap.value=m.emissiveMap),m.bumpMap&&(g.bumpMap.value=m.bumpMap,g.bumpScale.value=m.bumpScale,m.side===Ke&&(g.bumpScale.value*=-1)),m.normalMap&&(g.normalMap.value=m.normalMap,g.normalScale.value.copy(m.normalScale),m.side===Ke&&g.normalScale.value.negate()),m.displacementMap&&(g.displacementMap.value=m.displacementMap,g.displacementScale.value=m.displacementScale,g.displacementBias.value=m.displacementBias)}function u(g,m){m.gradientMap&&(g.gradientMap.value=m.gradientMap),m.emissiveMap&&(g.emissiveMap.value=m.emissiveMap),m.bumpMap&&(g.bumpMap.value=m.bumpMap,g.bumpScale.value=m.bumpScale,m.side===Ke&&(g.bumpScale.value*=-1)),m.normalMap&&(g.normalMap.value=m.normalMap,g.normalScale.value.copy(m.normalScale),m.side===Ke&&g.normalScale.value.negate()),m.displacementMap&&(g.displacementMap.value=m.displacementMap,g.displacementScale.value=m.displacementScale,g.displacementBias.value=m.displacementBias)}function h(g,m){g.roughness.value=m.roughness,g.metalness.value=m.metalness,m.roughnessMap&&(g.roughnessMap.value=m.roughnessMap),m.metalnessMap&&(g.metalnessMap.value=m.metalnessMap),m.emissiveMap&&(g.emissiveMap.value=m.emissiveMap),m.bumpMap&&(g.bumpMap.value=m.bumpMap,g.bumpScale.value=m.bumpScale,m.side===Ke&&(g.bumpScale.value*=-1)),m.normalMap&&(g.normalMap.value=m.normalMap,g.normalScale.value.copy(m.normalScale),m.side===Ke&&g.normalScale.value.negate()),m.displacementMap&&(g.displacementMap.value=m.displacementMap,g.displacementScale.value=m.displacementScale,g.displacementBias.value=m.displacementBias),n.get(m).envMap&&(g.envMapIntensity.value=m.envMapIntensity)}function d(g,m){h(g,m),g.reflectivity.value=m.reflectivity,g.clearcoat.value=m.clearcoat,g.clearcoatRoughness.value=m.clearcoatRoughness,m.sheen&&g.sheen.value.copy(m.sheen),m.clearcoatMap&&(g.clearcoatMap.value=m.clearcoatMap),m.clearcoatRoughnessMap&&(g.clearcoatRoughnessMap.value=m.clearcoatRoughnessMap),m.clearcoatNormalMap&&(g.clearcoatNormalScale.value.copy(m.clearcoatNormalScale),g.clearcoatNormalMap.value=m.clearcoatNormalMap,m.side===Ke&&g.clearcoatNormalScale.value.negate()),g.transmission.value=m.transmission,m.transmissionMap&&(g.transmissionMap.value=m.transmissionMap)}function f(g,m){m.matcap&&(g.matcap.value=m.matcap),m.bumpMap&&(g.bumpMap.value=m.bumpMap,g.bumpScale.value=m.bumpScale,m.side===Ke&&(g.bumpScale.value*=-1)),m.normalMap&&(g.normalMap.value=m.normalMap,g.normalScale.value.copy(m.normalScale),m.side===Ke&&g.normalScale.value.negate()),m.displacementMap&&(g.displacementMap.value=m.displacementMap,g.displacementScale.value=m.displacementScale,g.displacementBias.value=m.displacementBias)}function p(g,m){m.displacementMap&&(g.displacementMap.value=m.displacementMap,g.displacementScale.value=m.displacementScale,g.displacementBias.value=m.displacementBias)}function y(g,m){m.displacementMap&&(g.displacementMap.value=m.displacementMap,g.displacementScale.value=m.displacementScale,g.displacementBias.value=m.displacementBias),g.referencePosition.value.copy(m.referencePosition),g.nearDistance.value=m.nearDistance,g.farDistance.value=m.farDistance}function x(g,m){m.bumpMap&&(g.bumpMap.value=m.bumpMap,g.bumpScale.value=m.bumpScale,m.side===Ke&&(g.bumpScale.value*=-1)),m.normalMap&&(g.normalMap.value=m.normalMap,g.normalScale.value.copy(m.normalScale),m.side===Ke&&g.normalScale.value.negate()),m.displacementMap&&(g.displacementMap.value=m.displacementMap,g.displacementScale.value=m.displacementScale,g.displacementBias.value=m.displacementBias)}return{refreshFogUniforms:e,refreshMaterialUniforms:t}}function Cy(){const n=document.createElementNS("http://www.w3.org/1999/xhtml","canvas");return n.style.display="block",n}function Oe(n){n=n||{};const e=n.canvas!==void 0?n.canvas:Cy(),t=n.context!==void 0?n.context:null,i=n.alpha!==void 0?n.alpha:!1,r=n.depth!==void 0?n.depth:!0,s=n.stencil!==void 0?n.stencil:!0,o=n.antialias!==void 0?n.antialias:!1,a=n.premultipliedAlpha!==void 0?n.premultipliedAlpha:!0,c=n.preserveDrawingBuffer!==void 0?n.preserveDrawingBuffer:!1,l=n.powerPreference!==void 0?n.powerPreference:"default",u=n.failIfMajorPerformanceCaveat!==void 0?n.failIfMajorPerformanceCaveat:!1;let h=null,d=null;const f=[],p=[];this.domElement=e,this.debug={checkShaderErrors:!0},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.gammaFactor=2,this.outputEncoding=gt,this.physicallyCorrectLights=!1,this.toneMapping=Hn,this.toneMappingExposure=1;const y=this;let x=!1,g=0,m=0,b=null,_=-1,T=null;const v=new Be,A=new Be;let L=null,R=e.width,z=e.height,P=1,U=null,D=null;const I=new Be(0,0,R,z),B=new Be(0,0,R,z);let F=!1;const X=new Or;let K=!1,j=!1;const oe=new ce,ae=new w,ye={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};function Se(){return b===null?P:1}let G=t;function De(M,O){for(let N=0;N<M.length;N++){const H=M[N],te=e.getContext(H,O);if(te!==null)return te}return null}try{const M={alpha:i,depth:r,stencil:s,antialias:o,premultipliedAlpha:a,preserveDrawingBuffer:c,powerPreference:l,failIfMajorPerformanceCaveat:u};if(e.addEventListener("webglcontextlost",xe,!1),e.addEventListener("webglcontextrestored",Ne,!1),G===null){const O=["webgl2","webgl","experimental-webgl"];if(y.isWebGL1Renderer===!0&&O.shift(),G=De(O,M),G===null)throw De(O)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}G.getShaderPrecisionFormat===void 0&&(G.getShaderPrecisionFormat=function(){return{rangeMin:1,rangeMax:1,precision:1}})}catch(M){throw M}let Ce,be,ge,Fe,Ee,Le,Y,$,ee,ue,ne,E,S,k,V,ie,he,Ie,we,C,Z,Q;function pe(){Ce=new tg(G),be=new Qm(G,Ce,n),Ce.init(be),Z=new ku(G,Ce,be),ge=new Ay(G,Ce,be),Fe=new rg,Ee=new my,Le=new Ly(G,Ce,ge,Ee,be,Z,Fe),Y=new eg(y),$=new Af(G,be),Q=new Jm(G,Ce,$,be),ee=new ng(G,$,Fe,Q),ue=new cg(G,ee,$,Fe),Ie=new ag(G),V=new Km(Ee),ne=new py(y,Y,Ce,be,Q,V),E=new Ry(Ee),S=new xy(Ee),k=new Sy(Ce,be),he=new Zm(y,Y,ge,ue,a),ie=new Gu(y,ue,be),we=new $m(G,Ce,Fe,be),C=new ig(G,Ce,Fe,be),Fe.programs=ne.programs,y.capabilities=be,y.extensions=Ce,y.properties=Ee,y.renderLists=S,y.shadowMap=ie,y.state=ge,y.info=Fe}pe();const q=new Vu(y,G);this.xr=q,this.getContext=function(){return G},this.getContextAttributes=function(){return G.getContextAttributes()},this.forceContextLoss=function(){const M=Ce.get("WEBGL_lose_context");M&&M.loseContext()},this.forceContextRestore=function(){const M=Ce.get("WEBGL_lose_context");M&&M.restoreContext()},this.getPixelRatio=function(){return P},this.setPixelRatio=function(M){M!==void 0&&(P=M,this.setSize(R,z,!1))},this.getSize=function(M){return M===void 0&&(M=new W),M.set(R,z)},this.setSize=function(M,O,N){q.isPresenting||(R=M,z=O,e.width=Math.floor(M*P),e.height=Math.floor(O*P),N!==!1&&(e.style.width=M+"px",e.style.height=O+"px"),this.setViewport(0,0,M,O))},this.getDrawingBufferSize=function(M){return M===void 0&&(M=new W),M.set(R*P,z*P).floor()},this.setDrawingBufferSize=function(M,O,N){R=M,z=O,P=N,e.width=Math.floor(M*N),e.height=Math.floor(O*N),this.setViewport(0,0,M,O)},this.getCurrentViewport=function(M){return M===void 0&&(M=new Be),M.copy(v)},this.getViewport=function(M){return M.copy(I)},this.setViewport=function(M,O,N,H){M.isVector4?I.set(M.x,M.y,M.z,M.w):I.set(M,O,N,H),ge.viewport(v.copy(I).multiplyScalar(P).floor())},this.getScissor=function(M){return M.copy(B)},this.setScissor=function(M,O,N,H){M.isVector4?B.set(M.x,M.y,M.z,M.w):B.set(M,O,N,H),ge.scissor(A.copy(B).multiplyScalar(P).floor())},this.getScissorTest=function(){return F},this.setScissorTest=function(M){ge.setScissorTest(F=M)},this.setOpaqueSort=function(M){U=M},this.setTransparentSort=function(M){D=M},this.getClearColor=function(M){return M===void 0&&(M=new re),M.copy(he.getClearColor())},this.setClearColor=function(){he.setClearColor.apply(he,arguments)},this.getClearAlpha=function(){return he.getClearAlpha()},this.setClearAlpha=function(){he.setClearAlpha.apply(he,arguments)},this.clear=function(M,O,N){let H=0;(M===void 0||M)&&(H|=16384),(O===void 0||O)&&(H|=256),(N===void 0||N)&&(H|=1024),G.clear(H)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",xe,!1),e.removeEventListener("webglcontextrestored",Ne,!1),S.dispose(),k.dispose(),Ee.dispose(),Y.dispose(),ue.dispose(),Q.dispose(),q.dispose(),q.removeEventListener("sessionstart",Ac),q.removeEventListener("sessionend",Lc),Tn.stop()};function xe(M){M.preventDefault(),x=!0}function Ne(){x=!1;const M=Fe.autoReset,O=ie.enabled,N=ie.autoUpdate,H=ie.needsUpdate,te=ie.type;pe(),Fe.autoReset=M,ie.enabled=O,ie.autoUpdate=N,ie.needsUpdate=H,ie.type=te}function $e(M){const O=M.target;O.removeEventListener("dispose",$e),Sn(O)}function Sn(M){Ye(M),Ee.remove(M)}function Ye(M){const O=Ee.get(M).programs;O!==void 0&&O.forEach(function(N){ne.releaseProgram(N)})}function Wt(M,O){M.render(function(N){y.renderBufferImmediate(N,O)})}this.renderBufferImmediate=function(M,O){Q.initAttributes();const N=Ee.get(M);M.hasPositions&&!N.position&&(N.position=G.createBuffer()),M.hasNormals&&!N.normal&&(N.normal=G.createBuffer()),M.hasUvs&&!N.uv&&(N.uv=G.createBuffer()),M.hasColors&&!N.color&&(N.color=G.createBuffer());const H=O.getAttributes();M.hasPositions&&(G.bindBuffer(34962,N.position),G.bufferData(34962,M.positionArray,35048),Q.enableAttribute(H.position),G.vertexAttribPointer(H.position,3,5126,!1,0,0)),M.hasNormals&&(G.bindBuffer(34962,N.normal),G.bufferData(34962,M.normalArray,35048),Q.enableAttribute(H.normal),G.vertexAttribPointer(H.normal,3,5126,!1,0,0)),M.hasUvs&&(G.bindBuffer(34962,N.uv),G.bufferData(34962,M.uvArray,35048),Q.enableAttribute(H.uv),G.vertexAttribPointer(H.uv,2,5126,!1,0,0)),M.hasColors&&(G.bindBuffer(34962,N.color),G.bufferData(34962,M.colorArray,35048),Q.enableAttribute(H.color),G.vertexAttribPointer(H.color,3,5126,!1,0,0)),Q.disableUnusedAttributes(),G.drawArrays(4,0,M.count),M.count=0},this.renderBufferDirect=function(M,O,N,H,te,Re){O===null&&(O=ye);const ve=te.isMesh&&te.matrixWorld.determinant()<0,Te=Dc(M,O,H,te);ge.setMaterial(H,ve);let Ue=N.index;const Me=N.attributes.position;if(Ue===null){if(Me===void 0||Me.count===0)return}else if(Ue.count===0)return;let Pe=1;H.wireframe===!0&&(Ue=ee.getWireframeAttribute(N),Pe=2),(H.morphTargets||H.morphNormals)&&Ie.update(te,N,H,Te),Q.setup(te,H,Te,N,Ue);let _e,ze=we;Ue!==null&&(_e=$.get(Ue),ze=C,ze.setIndex(_e));const Ut=Ue!==null?Ue.count:Me.count,ft=N.drawRange.start*Pe,En=N.drawRange.count*Pe,et=Re!==null?Re.start*Pe:0,An=Re!==null?Re.count*Pe:1/0,Qe=Math.max(ft,et),Mo=Math.min(Ut,ft+En,et+An)-1,_t=Math.max(0,Mo-Qe+1);if(_t!==0){if(te.isMesh)H.wireframe===!0?(ge.setLineWidth(H.wireframeLinewidth*Se()),ze.setMode(1)):ze.setMode(4);else if(te.isLine){let qt=H.linewidth;qt===void 0&&(qt=1),ge.setLineWidth(qt*Se()),te.isLineSegments?ze.setMode(1):te.isLineLoop?ze.setMode(2):ze.setMode(3)}else te.isPoints?ze.setMode(0):te.isSprite&&ze.setMode(4);if(te.isInstancedMesh)ze.renderInstances(Qe,_t,te.count);else if(N.isInstancedBufferGeometry){const qt=Math.min(N.instanceCount,N._maxInstanceCount);ze.renderInstances(Qe,_t,qt)}else ze.render(Qe,_t)}},this.compile=function(M,O){d=k.get(M),d.init(),M.traverseVisible(function(N){N.isLight&&N.layers.test(O.layers)&&(d.pushLight(N),N.castShadow&&d.pushShadow(N))}),d.setupLights(),M.traverse(function(N){const H=N.material;if(H)if(Array.isArray(H))for(let te=0;te<H.length;te++){const Re=H[te];wo(Re,M,N)}else wo(H,M,N)})};let Rt=null;function Ad(M){Rt&&Rt(M)}function Ac(){Tn.stop()}function Lc(){Tn.start()}const Tn=new Du;Tn.setAnimationLoop(Ad),typeof window<"u"&&Tn.setContext(window),this.setAnimationLoop=function(M){Rt=M,q.setAnimationLoop(M),M===null?Tn.stop():Tn.start()},q.addEventListener("sessionstart",Ac),q.addEventListener("sessionend",Lc),this.render=function(M,O){let N,H;if(arguments[2]!==void 0&&(N=arguments[2]),arguments[3]!==void 0&&(H=arguments[3]),O!==void 0&&O.isCamera!==!0||x===!0)return;M.autoUpdate===!0&&M.updateMatrixWorld(),O.parent===null&&O.updateMatrixWorld(),q.enabled===!0&&q.isPresenting===!0&&(O=q.getCamera(O)),M.isScene===!0&&M.onBeforeRender(y,M,O,N||b),d=k.get(M,p.length),d.init(),p.push(d),oe.multiplyMatrices(O.projectionMatrix,O.matrixWorldInverse),X.setFromProjectionMatrix(oe),j=this.localClippingEnabled,K=V.init(this.clippingPlanes,j,O),h=S.get(M,f.length),h.init(),f.push(h),Rc(M,O,0,y.sortObjects),h.finish(),y.sortObjects===!0&&h.sort(U,D),K===!0&&V.beginShadows();const te=d.state.shadowsArray;ie.render(te,M,O),d.setupLights(),d.setupLightsView(O),K===!0&&V.endShadows(),this.info.autoReset===!0&&this.info.reset(),N!==void 0&&this.setRenderTarget(N),he.render(h,M,O,H);const Re=h.opaque,ve=h.transparent;Re.length>0&&Cc(Re,M,O),ve.length>0&&Cc(ve,M,O),b!==null&&(Le.updateRenderTargetMipmap(b),Le.updateMultisampleRenderTarget(b)),M.isScene===!0&&M.onAfterRender(y,M,O),ge.buffers.depth.setTest(!0),ge.buffers.depth.setMask(!0),ge.buffers.color.setMask(!0),ge.setPolygonOffset(!1),Q.resetDefaultState(),_=-1,T=null,p.pop(),p.length>0?d=p[p.length-1]:d=null,f.pop(),f.length>0?h=f[f.length-1]:h=null};function Rc(M,O,N,H){if(M.visible===!1)return;if(M.layers.test(O.layers)){if(M.isGroup)N=M.renderOrder;else if(M.isLOD)M.autoUpdate===!0&&M.update(O);else if(M.isLight)d.pushLight(M),M.castShadow&&d.pushShadow(M);else if(M.isSprite){if(!M.frustumCulled||X.intersectsSprite(M)){H&&ae.setFromMatrixPosition(M.matrixWorld).applyMatrix4(oe);const ve=ue.update(M),Te=M.material;Te.visible&&h.push(M,ve,Te,N,ae.z,null)}}else if(M.isImmediateRenderObject)H&&ae.setFromMatrixPosition(M.matrixWorld).applyMatrix4(oe),h.push(M,null,M.material,N,ae.z,null);else if((M.isMesh||M.isLine||M.isPoints)&&(M.isSkinnedMesh&&M.skeleton.frame!==Fe.render.frame&&(M.skeleton.update(),M.skeleton.frame=Fe.render.frame),!M.frustumCulled||X.intersectsObject(M))){H&&ae.setFromMatrixPosition(M.matrixWorld).applyMatrix4(oe);const ve=ue.update(M),Te=M.material;if(Array.isArray(Te)){const Ue=ve.groups;for(let Me=0,Pe=Ue.length;Me<Pe;Me++){const _e=Ue[Me],ze=Te[_e.materialIndex];ze&&ze.visible&&h.push(M,ve,ze,N,ae.z,_e)}}else Te.visible&&h.push(M,ve,Te,N,ae.z,null)}}const Re=M.children;for(let ve=0,Te=Re.length;ve<Te;ve++)Rc(Re[ve],O,N,H)}function Cc(M,O,N){const H=O.isScene===!0?O.overrideMaterial:null;for(let te=0,Re=M.length;te<Re;te++){const ve=M[te],Te=ve.object,Ue=ve.geometry,Me=H===null?ve.material:H,Pe=ve.group;if(N.isArrayCamera){const _e=N.cameras;for(let ze=0,Ut=_e.length;ze<Ut;ze++){const ft=_e[ze];Te.layers.test(ft.layers)&&(ge.viewport(v.copy(ft.viewport)),d.setupLightsView(ft),Pc(Te,O,ft,Ue,Me,Pe))}}else Pc(Te,O,N,Ue,Me,Pe)}}function Pc(M,O,N,H,te,Re){if(M.onBeforeRender(y,O,N,H,te,Re),M.modelViewMatrix.multiplyMatrices(N.matrixWorldInverse,M.matrixWorld),M.normalMatrix.getNormalMatrix(M.modelViewMatrix),M.isImmediateRenderObject){const ve=Dc(N,O,te,M);ge.setMaterial(te),Q.reset(),Wt(M,ve)}else y.renderBufferDirect(N,O,H,te,M,Re);M.onAfterRender(y,O,N,H,te,Re)}function wo(M,O,N){O.isScene!==!0&&(O=ye);const H=Ee.get(M),te=d.state.lights,Re=d.state.shadowsArray,ve=te.state.version,Te=ne.getParameters(M,te.state,Re,O,N),Ue=ne.getProgramCacheKey(Te);let Me=H.programs;H.environment=M.isMeshStandardMaterial?O.environment:null,H.fog=O.fog,H.envMap=Y.get(M.envMap||H.environment),Me===void 0&&(M.addEventListener("dispose",$e),Me=new Map,H.programs=Me);let Pe=Me.get(Ue);if(Pe!==void 0){if(H.currentProgram===Pe&&H.lightsStateVersion===ve)return Ic(M,Te),Pe}else Te.uniforms=ne.getUniforms(M),M.onBeforeCompile(Te,y),Pe=ne.acquireProgram(Te,Ue),Me.set(Ue,Pe),H.uniforms=Te.uniforms;const _e=H.uniforms;(!M.isShaderMaterial&&!M.isRawShaderMaterial||M.clipping===!0)&&(_e.clippingPlanes=V.uniform),Ic(M,Te),H.needsLights=Rd(M),H.lightsStateVersion=ve,H.needsLights&&(_e.ambientLightColor.value=te.state.ambient,_e.lightProbe.value=te.state.probe,_e.directionalLights.value=te.state.directional,_e.directionalLightShadows.value=te.state.directionalShadow,_e.spotLights.value=te.state.spot,_e.spotLightShadows.value=te.state.spotShadow,_e.rectAreaLights.value=te.state.rectArea,_e.ltc_1.value=te.state.rectAreaLTC1,_e.ltc_2.value=te.state.rectAreaLTC2,_e.pointLights.value=te.state.point,_e.pointLightShadows.value=te.state.pointShadow,_e.hemisphereLights.value=te.state.hemi,_e.directionalShadowMap.value=te.state.directionalShadowMap,_e.directionalShadowMatrix.value=te.state.directionalShadowMatrix,_e.spotShadowMap.value=te.state.spotShadowMap,_e.spotShadowMatrix.value=te.state.spotShadowMatrix,_e.pointShadowMap.value=te.state.pointShadowMap,_e.pointShadowMatrix.value=te.state.pointShadowMatrix);const ze=Pe.getUniforms(),Ut=pn.seqWithValue(ze.seq,_e);return H.currentProgram=Pe,H.uniformsList=Ut,Pe}function Ic(M,O){const N=Ee.get(M);N.outputEncoding=O.outputEncoding,N.instancing=O.instancing,N.numClippingPlanes=O.numClippingPlanes,N.numIntersection=O.numClipIntersection,N.vertexAlphas=O.vertexAlphas}function Dc(M,O,N,H){O.isScene!==!0&&(O=ye),Le.resetTextureUnits();const te=O.fog,Re=N.isMeshStandardMaterial?O.environment:null,ve=b===null?y.outputEncoding:b.texture.encoding,Te=Y.get(N.envMap||Re),Ue=N.vertexColors===!0&&H.geometry.attributes.color&&H.geometry.attributes.color.itemSize===4,Me=Ee.get(N),Pe=d.state.lights;if(K===!0&&(j===!0||M!==T)){const Qe=M===T&&N.id===_;V.setState(N,M,Qe)}let _e=!1;N.version===Me.__version?(Me.needsLights&&Me.lightsStateVersion!==Pe.state.version||Me.outputEncoding!==ve||H.isInstancedMesh&&Me.instancing===!1||!H.isInstancedMesh&&Me.instancing===!0||Me.envMap!==Te||N.fog&&Me.fog!==te||Me.numClippingPlanes!==void 0&&(Me.numClippingPlanes!==V.numPlanes||Me.numIntersection!==V.numIntersection)||Me.vertexAlphas!==Ue)&&(_e=!0):(_e=!0,Me.__version=N.version);let ze=Me.currentProgram;_e===!0&&(ze=wo(N,O,H));let Ut=!1,ft=!1,En=!1;const et=ze.getUniforms(),An=Me.uniforms;if(ge.useProgram(ze.program)&&(Ut=!0,ft=!0,En=!0),N.id!==_&&(_=N.id,ft=!0),Ut||T!==M){if(et.setValue(G,"projectionMatrix",M.projectionMatrix),be.logarithmicDepthBuffer&&et.setValue(G,"logDepthBufFC",2/(Math.log(M.far+1)/Math.LN2)),T!==M&&(T=M,ft=!0,En=!0),N.isShaderMaterial||N.isMeshPhongMaterial||N.isMeshToonMaterial||N.isMeshStandardMaterial||N.envMap){const Qe=et.map.cameraPosition;Qe!==void 0&&Qe.setValue(G,ae.setFromMatrixPosition(M.matrixWorld))}(N.isMeshPhongMaterial||N.isMeshToonMaterial||N.isMeshLambertMaterial||N.isMeshBasicMaterial||N.isMeshStandardMaterial||N.isShaderMaterial)&&et.setValue(G,"isOrthographic",M.isOrthographicCamera===!0),(N.isMeshPhongMaterial||N.isMeshToonMaterial||N.isMeshLambertMaterial||N.isMeshBasicMaterial||N.isMeshStandardMaterial||N.isShaderMaterial||N.isShadowMaterial||N.skinning)&&et.setValue(G,"viewMatrix",M.matrixWorldInverse)}if(N.skinning){et.setOptional(G,H,"bindMatrix"),et.setOptional(G,H,"bindMatrixInverse");const Qe=H.skeleton;if(Qe){const Mo=Qe.bones;if(be.floatVertexTextures){if(Qe.boneTexture===null){let _t=Math.sqrt(Mo.length*4);_t=me.ceilPowerOfTwo(_t),_t=Math.max(_t,4);const qt=new Float32Array(_t*_t*4);qt.set(Qe.boneMatrices);const Cd=new Ti(qt,_t,_t,Et,$t);Qe.boneMatrices=qt,Qe.boneTexture=Cd,Qe.boneTextureSize=_t}et.setValue(G,"boneTexture",Qe.boneTexture,Le),et.setValue(G,"boneTextureSize",Qe.boneTextureSize)}else et.setOptional(G,Qe,"boneMatrices")}}return(ft||Me.receiveShadow!==H.receiveShadow)&&(Me.receiveShadow=H.receiveShadow,et.setValue(G,"receiveShadow",H.receiveShadow)),ft&&(et.setValue(G,"toneMappingExposure",y.toneMappingExposure),Me.needsLights&&Ld(An,En),te&&N.fog&&E.refreshFogUniforms(An,te),E.refreshMaterialUniforms(An,N,P,z),pn.upload(G,Me.uniformsList,An,Le)),N.isShaderMaterial&&N.uniformsNeedUpdate===!0&&(pn.upload(G,Me.uniformsList,An,Le),N.uniformsNeedUpdate=!1),N.isSpriteMaterial&&et.setValue(G,"center",H.center),et.setValue(G,"modelViewMatrix",H.modelViewMatrix),et.setValue(G,"normalMatrix",H.normalMatrix),et.setValue(G,"modelMatrix",H.matrixWorld),ze}function Ld(M,O){M.ambientLightColor.needsUpdate=O,M.lightProbe.needsUpdate=O,M.directionalLights.needsUpdate=O,M.directionalLightShadows.needsUpdate=O,M.pointLights.needsUpdate=O,M.pointLightShadows.needsUpdate=O,M.spotLights.needsUpdate=O,M.spotLightShadows.needsUpdate=O,M.rectAreaLights.needsUpdate=O,M.hemisphereLights.needsUpdate=O}function Rd(M){return M.isMeshLambertMaterial||M.isMeshToonMaterial||M.isMeshPhongMaterial||M.isMeshStandardMaterial||M.isShadowMaterial||M.isShaderMaterial&&M.lights===!0}this.getActiveCubeFace=function(){return g},this.getActiveMipmapLevel=function(){return m},this.getRenderTarget=function(){return b},this.setRenderTarget=function(M,O=0,N=0){b=M,g=O,m=N,M&&Ee.get(M).__webglFramebuffer===void 0&&Le.setupRenderTarget(M);let H=null,te=!1,Re=!1;if(M){const ve=M.texture;(ve.isDataTexture3D||ve.isDataTexture2DArray)&&(Re=!0);const Te=Ee.get(M).__webglFramebuffer;M.isWebGLCubeRenderTarget?(H=Te[O],te=!0):M.isWebGLMultisampleRenderTarget?H=Ee.get(M).__webglMultisampledFramebuffer:H=Te,v.copy(M.viewport),A.copy(M.scissor),L=M.scissorTest}else v.copy(I).multiplyScalar(P).floor(),A.copy(B).multiplyScalar(P).floor(),L=F;if(ge.bindFramebuffer(36160,H),ge.viewport(v),ge.scissor(A),ge.setScissorTest(L),te){const ve=Ee.get(M.texture);G.framebufferTexture2D(36160,36064,34069+O,ve.__webglTexture,N)}else if(Re){const ve=Ee.get(M.texture),Te=O||0;G.framebufferTextureLayer(36160,36064,ve.__webglTexture,N||0,Te)}},this.readRenderTargetPixels=function(M,O,N,H,te,Re,ve){if(!(M&&M.isWebGLRenderTarget))return;let Te=Ee.get(M).__webglFramebuffer;if(M.isWebGLCubeRenderTarget&&ve!==void 0&&(Te=Te[ve]),Te){ge.bindFramebuffer(36160,Te);try{const Ue=M.texture,Me=Ue.format,Pe=Ue.type;if(Me!==Et&&Z.convert(Me)!==G.getParameter(35739))return;const _e=Pe===sr&&(Ce.has("EXT_color_buffer_half_float")||be.isWebGL2&&Ce.has("EXT_color_buffer_float"));if(Pe!==Pi&&Z.convert(Pe)!==G.getParameter(35738)&&!(Pe===$t&&(be.isWebGL2||Ce.has("OES_texture_float")||Ce.has("WEBGL_color_buffer_float")))&&!_e)return;G.checkFramebufferStatus(36160)===36053&&O>=0&&O<=M.width-H&&N>=0&&N<=M.height-te&&G.readPixels(O,N,H,te,Z.convert(Me),Z.convert(Pe),Re)}finally{const Ue=b!==null?Ee.get(b).__webglFramebuffer:null;ge.bindFramebuffer(36160,Ue)}}},this.copyFramebufferToTexture=function(M,O,N=0){const H=Math.pow(2,-N),te=Math.floor(O.image.width*H),Re=Math.floor(O.image.height*H),ve=Z.convert(O.format);Le.setTexture2D(O,0),G.copyTexImage2D(3553,N,ve,M.x,M.y,te,Re,0),ge.unbindTexture()},this.copyTextureToTexture=function(M,O,N,H=0){const te=O.image.width,Re=O.image.height,ve=Z.convert(N.format),Te=Z.convert(N.type);Le.setTexture2D(N,0),G.pixelStorei(37440,N.flipY),G.pixelStorei(37441,N.premultiplyAlpha),G.pixelStorei(3317,N.unpackAlignment),O.isDataTexture?G.texSubImage2D(3553,H,M.x,M.y,te,Re,ve,Te,O.image.data):O.isCompressedTexture?G.compressedTexSubImage2D(3553,H,M.x,M.y,O.mipmaps[0].width,O.mipmaps[0].height,ve,O.mipmaps[0].data):G.texSubImage2D(3553,H,M.x,M.y,ve,Te,O.image),H===0&&N.generateMipmaps&&G.generateMipmap(3553),ge.unbindTexture()},this.copyTextureToTexture3D=function(M,O,N,H,te=0){if(y.isWebGL1Renderer)return;const{width:Re,height:ve,data:Te}=N.image,Ue=Z.convert(H.format),Me=Z.convert(H.type);let Pe;if(H.isDataTexture3D)Le.setTexture3D(H,0),Pe=32879;else if(H.isDataTexture2DArray)Le.setTexture2DArray(H,0),Pe=35866;else return;G.pixelStorei(37440,H.flipY),G.pixelStorei(37441,H.premultiplyAlpha),G.pixelStorei(3317,H.unpackAlignment);const _e=G.getParameter(3314),ze=G.getParameter(32878),Ut=G.getParameter(3316),ft=G.getParameter(3315),En=G.getParameter(32877);G.pixelStorei(3314,Re),G.pixelStorei(32878,ve),G.pixelStorei(3316,M.min.x),G.pixelStorei(3315,M.min.y),G.pixelStorei(32877,M.min.z),G.texSubImage3D(Pe,te,O.x,O.y,O.z,M.max.x-M.min.x+1,M.max.y-M.min.y+1,M.max.z-M.min.z+1,Ue,Me,Te),G.pixelStorei(3314,_e),G.pixelStorei(32878,ze),G.pixelStorei(3316,Ut),G.pixelStorei(3315,ft),G.pixelStorei(32877,En),te===0&&H.generateMipmaps&&G.generateMipmap(Pe),ge.unbindTexture()},this.initTexture=function(M){Le.setTexture2D(M,0),ge.unbindTexture()},this.resetState=function(){g=0,m=0,b=null,ge.reset(),Q.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}class Wu extends Oe{}Wu.prototype.isWebGL1Renderer=!0;class Ur{constructor(e,t=25e-5){this.name="",this.color=new re(e),this.density=t}clone(){return new Ur(this.color,this.density)}toJSON(){return{type:"FogExp2",color:this.color.getHex(),density:this.density}}}Ur.prototype.isFogExp2=!0;class Hr{constructor(e,t=1,i=1e3){this.name="",this.color=new re(e),this.near=t,this.far=i}clone(){return new Hr(this.color,this.near,this.far)}toJSON(){return{type:"Fog",color:this.color.getHex(),near:this.near,far:this.far}}}Hr.prototype.isFog=!0;class uo extends de{constructor(){super(),this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.overrideMaterial=null,this.autoUpdate=!0,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.autoUpdate=e.autoUpdate,this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.background!==null&&(t.object.background=this.background.toJSON(e)),this.environment!==null&&(t.object.environment=this.environment.toJSON(e)),this.fog!==null&&(t.object.fog=this.fog.toJSON()),t}}uo.prototype.isScene=!0;function bt(n,e){this.array=n,this.stride=e,this.count=n!==void 0?n.length/e:0,this.usage=Ii,this.updateRange={offset:0,count:-1},this.version=0,this.uuid=me.generateUUID()}Object.defineProperty(bt.prototype,"needsUpdate",{set:function(n){n===!0&&this.version++}});Object.assign(bt.prototype,{isInterleavedBuffer:!0,onUploadCallback:function(){},setUsage:function(n){return this.usage=n,this},copy:function(n){return this.array=new n.array.constructor(n.array),this.count=n.count,this.stride=n.stride,this.usage=n.usage,this},copyAt:function(n,e,t){n*=this.stride,t*=e.stride;for(let i=0,r=this.stride;i<r;i++)this.array[n+i]=e.array[t+i];return this},set:function(n,e=0){return this.array.set(n,e),this},clone:function(n){n.arrayBuffers===void 0&&(n.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=me.generateUUID()),n.arrayBuffers[this.array.buffer._uuid]===void 0&&(n.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const e=new this.array.constructor(n.arrayBuffers[this.array.buffer._uuid]),t=new bt(e,this.stride);return t.setUsage(this.usage),t},onUpload:function(n){return this.onUploadCallback=n,this},toJSON:function(n){return n.arrayBuffers===void 0&&(n.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=me.generateUUID()),n.arrayBuffers[this.array.buffer._uuid]===void 0&&(n.arrayBuffers[this.array.buffer._uuid]=Array.prototype.slice.call(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}});const je=new w;function xn(n,e,t,i){this.name="",this.data=n,this.itemSize=e,this.offset=t,this.normalized=i===!0}Object.defineProperties(xn.prototype,{count:{get:function(){return this.data.count}},array:{get:function(){return this.data.array}},needsUpdate:{set:function(n){this.data.needsUpdate=n}}});Object.assign(xn.prototype,{isInterleavedBufferAttribute:!0,applyMatrix4:function(n){for(let e=0,t=this.data.count;e<t;e++)je.x=this.getX(e),je.y=this.getY(e),je.z=this.getZ(e),je.applyMatrix4(n),this.setXYZ(e,je.x,je.y,je.z);return this},applyNormalMatrix:function(n){for(let e=0,t=this.count;e<t;e++)je.x=this.getX(e),je.y=this.getY(e),je.z=this.getZ(e),je.applyNormalMatrix(n),this.setXYZ(e,je.x,je.y,je.z);return this},transformDirection:function(n){for(let e=0,t=this.count;e<t;e++)je.x=this.getX(e),je.y=this.getY(e),je.z=this.getZ(e),je.transformDirection(n),this.setXYZ(e,je.x,je.y,je.z);return this},setX:function(n,e){return this.data.array[n*this.data.stride+this.offset]=e,this},setY:function(n,e){return this.data.array[n*this.data.stride+this.offset+1]=e,this},setZ:function(n,e){return this.data.array[n*this.data.stride+this.offset+2]=e,this},setW:function(n,e){return this.data.array[n*this.data.stride+this.offset+3]=e,this},getX:function(n){return this.data.array[n*this.data.stride+this.offset]},getY:function(n){return this.data.array[n*this.data.stride+this.offset+1]},getZ:function(n){return this.data.array[n*this.data.stride+this.offset+2]},getW:function(n){return this.data.array[n*this.data.stride+this.offset+3]},setXY:function(n,e,t){return n=n*this.data.stride+this.offset,this.data.array[n+0]=e,this.data.array[n+1]=t,this},setXYZ:function(n,e,t,i){return n=n*this.data.stride+this.offset,this.data.array[n+0]=e,this.data.array[n+1]=t,this.data.array[n+2]=i,this},setXYZW:function(n,e,t,i,r){return n=n*this.data.stride+this.offset,this.data.array[n+0]=e,this.data.array[n+1]=t,this.data.array[n+2]=i,this.data.array[n+3]=r,this},clone:function(n){if(n===void 0){const e=[];for(let t=0;t<this.count;t++){const i=t*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[i+r])}return new fe(new this.array.constructor(e),this.itemSize,this.normalized)}else return n.interleavedBuffers===void 0&&(n.interleavedBuffers={}),n.interleavedBuffers[this.data.uuid]===void 0&&(n.interleavedBuffers[this.data.uuid]=this.data.clone(n)),new xn(n.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)},toJSON:function(n){if(n===void 0){const e=[];for(let t=0;t<this.count;t++){const i=t*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[i+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}else return n.interleavedBuffers===void 0&&(n.interleavedBuffers={}),n.interleavedBuffers[this.data.uuid]===void 0&&(n.interleavedBuffers[this.data.uuid]=this.data.toJSON(n)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}});class fo extends Ve{constructor(e){super(),this.type="SpriteMaterial",this.color=new re(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this}}fo.prototype.isSpriteMaterial=!0;let fi;const Vi=new w,pi=new w,mi=new w,gi=new W,Wi=new W,qu=new ce,ls=new w,qi=new w,hs=new w,sl=new W,jo=new W,ol=new W;class po extends de{constructor(e){if(super(),this.type="Sprite",fi===void 0){fi=new le;const t=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),i=new bt(t,5);fi.setIndex([0,1,2,0,2,3]),fi.setAttribute("position",new xn(i,3,0,!1)),fi.setAttribute("uv",new xn(i,2,3,!1))}this.geometry=fi,this.material=e!==void 0?e:new fo,this.center=new W(.5,.5)}raycast(e,t){e.camera,pi.setFromMatrixScale(this.matrixWorld),qu.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),mi.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&pi.multiplyScalar(-mi.z);const i=this.material.rotation;let r,s;i!==0&&(s=Math.cos(i),r=Math.sin(i));const o=this.center;us(ls.set(-.5,-.5,0),mi,o,pi,r,s),us(qi.set(.5,-.5,0),mi,o,pi,r,s),us(hs.set(.5,.5,0),mi,o,pi,r,s),sl.set(0,0),jo.set(1,0),ol.set(1,1);let a=e.ray.intersectTriangle(ls,qi,hs,!1,Vi);if(a===null&&(us(qi.set(-.5,.5,0),mi,o,pi,r,s),jo.set(0,1),a=e.ray.intersectTriangle(ls,hs,qi,!1,Vi),a===null))return;const c=e.ray.origin.distanceTo(Vi);c<e.near||c>e.far||t.push({distance:c,point:Vi.clone(),uv:Je.getUV(Vi,ls,qi,hs,sl,jo,ol,new W),face:null,object:this})}copy(e){return super.copy(e),e.center!==void 0&&this.center.copy(e.center),this.material=e.material,this}}po.prototype.isSprite=!0;function us(n,e,t,i,r,s){gi.subVectors(n,t).addScalar(.5).multiply(i),r!==void 0?(Wi.x=s*gi.x-r*gi.y,Wi.y=r*gi.x+s*gi.y):Wi.copy(gi),n.copy(e),n.x+=Wi.x,n.y+=Wi.y,n.applyMatrix4(qu)}const ds=new w,al=new w;class Xu extends de{constructor(){super(),this._currentLevel=0,this.type="LOD",Object.defineProperties(this,{levels:{enumerable:!0,value:[]},isLOD:{value:!0}}),this.autoUpdate=!0}copy(e){super.copy(e,!1);const t=e.levels;for(let i=0,r=t.length;i<r;i++){const s=t[i];this.addLevel(s.object.clone(),s.distance)}return this.autoUpdate=e.autoUpdate,this}addLevel(e,t=0){t=Math.abs(t);const i=this.levels;let r;for(r=0;r<i.length&&!(t<i[r].distance);r++);return i.splice(r,0,{distance:t,object:e}),this.add(e),this}getCurrentLevel(){return this._currentLevel}getObjectForDistance(e){const t=this.levels;if(t.length>0){let i,r;for(i=1,r=t.length;i<r&&!(e<t[i].distance);i++);return t[i-1].object}return null}raycast(e,t){if(this.levels.length>0){ds.setFromMatrixPosition(this.matrixWorld);const r=e.ray.origin.distanceTo(ds);this.getObjectForDistance(r).raycast(e,t)}}update(e){const t=this.levels;if(t.length>1){ds.setFromMatrixPosition(e.matrixWorld),al.setFromMatrixPosition(this.matrixWorld);const i=ds.distanceTo(al)/e.zoom;t[0].object.visible=!0;let r,s;for(r=1,s=t.length;r<s&&i>=t[r].distance;r++)t[r-1].object.visible=!1,t[r].object.visible=!0;for(this._currentLevel=r-1;r<s;r++)t[r].object.visible=!1}}toJSON(e){const t=super.toJSON(e);this.autoUpdate===!1&&(t.object.autoUpdate=!1),t.object.levels=[];const i=this.levels;for(let r=0,s=i.length;r<s;r++){const o=i[r];t.object.levels.push({object:o.object.uuid,distance:o.distance})}return t}}const cl=new w,ll=new Be,hl=new Be,Py=new w,ul=new ce;function yr(n,e){Ge.call(this,n,e),this.type="SkinnedMesh",this.bindMode="attached",this.bindMatrix=new ce,this.bindMatrixInverse=new ce}yr.prototype=Object.assign(Object.create(Ge.prototype),{constructor:yr,isSkinnedMesh:!0,copy:function(n){return Ge.prototype.copy.call(this,n),this.bindMode=n.bindMode,this.bindMatrix.copy(n.bindMatrix),this.bindMatrixInverse.copy(n.bindMatrixInverse),this.skeleton=n.skeleton,this},bind:function(n,e){this.skeleton=n,e===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),e=this.matrixWorld),this.bindMatrix.copy(e),this.bindMatrixInverse.copy(e).invert()},pose:function(){this.skeleton.pose()},normalizeSkinWeights:function(){const n=new Be,e=this.geometry.attributes.skinWeight;for(let t=0,i=e.count;t<i;t++){n.x=e.getX(t),n.y=e.getY(t),n.z=e.getZ(t),n.w=e.getW(t);const r=1/n.manhattanLength();r!==1/0?n.multiplyScalar(r):n.set(1,0,0,0),e.setXYZW(t,n.x,n.y,n.z,n.w)}},updateMatrixWorld:function(n){Ge.prototype.updateMatrixWorld.call(this,n),this.bindMode==="attached"?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode==="detached"&&this.bindMatrixInverse.copy(this.bindMatrix).invert()},boneTransform:function(n,e){const t=this.skeleton,i=this.geometry;ll.fromBufferAttribute(i.attributes.skinIndex,n),hl.fromBufferAttribute(i.attributes.skinWeight,n),cl.fromBufferAttribute(i.attributes.position,n).applyMatrix4(this.bindMatrix),e.set(0,0,0);for(let r=0;r<4;r++){const s=hl.getComponent(r);if(s!==0){const o=ll.getComponent(r);ul.multiplyMatrices(t.bones[o].matrixWorld,t.boneInverses[o]),e.addScaledVector(Py.copy(cl).applyMatrix4(ul),s)}}return e.applyMatrix4(this.bindMatrixInverse)}});function xr(){de.call(this),this.type="Bone"}xr.prototype=Object.assign(Object.create(de.prototype),{constructor:xr,isBone:!0});const dl=new ce,Iy=new ce;class mo{constructor(e=[],t=[]){this.uuid=me.generateUUID(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.boneTexture=null,this.boneTextureSize=0,this.frame=-1,this.init()}init(){const e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(e.length*16),t.length===0)this.calculateInverses();else if(e.length!==t.length){this.boneInverses=[];for(let i=0,r=this.bones.length;i<r;i++)this.boneInverses.push(new ce)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){const i=new ce;this.bones[e]&&i.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(i)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){const i=this.bones[e];i&&i.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){const i=this.bones[e];i&&(i.parent&&i.parent.isBone?(i.matrix.copy(i.parent.matrixWorld).invert(),i.matrix.multiply(i.matrixWorld)):i.matrix.copy(i.matrixWorld),i.matrix.decompose(i.position,i.quaternion,i.scale))}}update(){const e=this.bones,t=this.boneInverses,i=this.boneMatrices,r=this.boneTexture;for(let s=0,o=e.length;s<o;s++){const a=e[s]?e[s].matrixWorld:Iy;dl.multiplyMatrices(a,t[s]),dl.toArray(i,s*16)}r!==null&&(r.needsUpdate=!0)}clone(){return new mo(this.bones,this.boneInverses)}getBoneByName(e){for(let t=0,i=this.bones.length;t<i;t++){const r=this.bones[t];if(r.name===e)return r}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let i=0,r=e.bones.length;i<r;i++){const s=e.bones[i];let o=t[s];o===void 0&&(o=new xr),this.bones.push(o),this.boneInverses.push(new ce().fromArray(e.boneInverses[i]))}return this.init(),this}toJSON(){const e={metadata:{version:4.5,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;const t=this.bones,i=this.boneInverses;for(let r=0,s=t.length;r<s;r++){const o=t[r];e.bones.push(o.uuid);const a=i[r];e.boneInverses.push(a.toArray())}return e}}const fl=new ce,pl=new ce,fs=[],Xi=new Ge;function Us(n,e,t){Ge.call(this,n,e),this.instanceMatrix=new fe(new Float32Array(t*16),16),this.instanceColor=null,this.count=t,this.frustumCulled=!1}Us.prototype=Object.assign(Object.create(Ge.prototype),{constructor:Us,isInstancedMesh:!0,copy:function(n){return Ge.prototype.copy.call(this,n),this.instanceMatrix.copy(n.instanceMatrix),n.instanceColor!==null&&(this.instanceColor=n.instanceColor.clone()),this.count=n.count,this},getColorAt:function(n,e){e.fromArray(this.instanceColor.array,n*3)},getMatrixAt:function(n,e){e.fromArray(this.instanceMatrix.array,n*16)},raycast:function(n,e){const t=this.matrixWorld,i=this.count;if(Xi.geometry=this.geometry,Xi.material=this.material,Xi.material!==void 0)for(let r=0;r<i;r++){this.getMatrixAt(r,fl),pl.multiplyMatrices(t,fl),Xi.matrixWorld=pl,Xi.raycast(n,fs);for(let s=0,o=fs.length;s<o;s++){const a=fs[s];a.instanceId=r,a.object=this,e.push(a)}fs.length=0}},setColorAt:function(n,e){this.instanceColor===null&&(this.instanceColor=new fe(new Float32Array(this.count*3),3)),e.toArray(this.instanceColor.array,n*3)},setMatrixAt:function(n,e){e.toArray(this.instanceMatrix.array,n*16)},updateMorphTargets:function(){},dispose:function(){this.dispatchEvent({type:"dispose"})}});class ct extends Ve{constructor(e){super(),this.type="LineBasicMaterial",this.color=new re(16777215),this.linewidth=1,this.linecap="round",this.linejoin="round",this.morphTargets=!1,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.morphTargets=e.morphTargets,this}}ct.prototype.isLineBasicMaterial=!0;const ml=new w,gl=new w,yl=new ce,Zo=new Mn,ps=new wn;function Nt(n=new le,e=new ct){de.call(this),this.type="Line",this.geometry=n,this.material=e,this.updateMorphTargets()}Nt.prototype=Object.assign(Object.create(de.prototype),{constructor:Nt,isLine:!0,copy:function(n){return de.prototype.copy.call(this,n),this.material=n.material,this.geometry=n.geometry,this},computeLineDistances:function(){const n=this.geometry;if(n.isBufferGeometry){if(n.index===null){const e=n.attributes.position,t=[0];for(let i=1,r=e.count;i<r;i++)ml.fromBufferAttribute(e,i-1),gl.fromBufferAttribute(e,i),t[i]=t[i-1],t[i]+=ml.distanceTo(gl);n.setAttribute("lineDistance",new se(t,1))}}else n.isGeometry;return this},raycast:function(n,e){const t=this.geometry,i=this.matrixWorld,r=n.params.Line.threshold,s=t.drawRange;if(t.boundingSphere===null&&t.computeBoundingSphere(),ps.copy(t.boundingSphere),ps.applyMatrix4(i),ps.radius+=r,n.ray.intersectsSphere(ps)===!1)return;yl.copy(i).invert(),Zo.copy(n.ray).applyMatrix4(yl);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),a=o*o,c=new w,l=new w,u=new w,h=new w,d=this.isLineSegments?2:1;if(t.isBufferGeometry){const f=t.index,y=t.attributes.position;if(f!==null){const x=Math.max(0,s.start),g=Math.min(f.count,s.start+s.count);for(let m=x,b=g-1;m<b;m+=d){const _=f.getX(m),T=f.getX(m+1);if(c.fromBufferAttribute(y,_),l.fromBufferAttribute(y,T),Zo.distanceSqToSegment(c,l,h,u)>a)continue;h.applyMatrix4(this.matrixWorld);const A=n.ray.origin.distanceTo(h);A<n.near||A>n.far||e.push({distance:A,point:u.clone().applyMatrix4(this.matrixWorld),index:m,face:null,faceIndex:null,object:this})}}else{const x=Math.max(0,s.start),g=Math.min(y.count,s.start+s.count);for(let m=x,b=g-1;m<b;m+=d){if(c.fromBufferAttribute(y,m),l.fromBufferAttribute(y,m+1),Zo.distanceSqToSegment(c,l,h,u)>a)continue;h.applyMatrix4(this.matrixWorld);const T=n.ray.origin.distanceTo(h);T<n.near||T>n.far||e.push({distance:T,point:u.clone().applyMatrix4(this.matrixWorld),index:m,face:null,faceIndex:null,object:this})}}}else t.isGeometry},updateMorphTargets:function(){const n=this.geometry;if(n.isBufferGeometry){const e=n.morphAttributes,t=Object.keys(e);if(t.length>0){const i=e[t[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,s=i.length;r<s;r++){const o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}else{const e=n.morphTargets;e!==void 0&&e.length>0}}});const xl=new w,vl=new w;function xt(n,e){Nt.call(this,n,e),this.type="LineSegments"}xt.prototype=Object.assign(Object.create(Nt.prototype),{constructor:xt,isLineSegments:!0,computeLineDistances:function(){const n=this.geometry;if(n.isBufferGeometry){if(n.index===null){const e=n.attributes.position,t=[];for(let i=0,r=e.count;i<r;i+=2)xl.fromBufferAttribute(e,i),vl.fromBufferAttribute(e,i+1),t[i]=i===0?0:t[i-1],t[i+1]=t[i]+xl.distanceTo(vl);n.setAttribute("lineDistance",new se(t,1))}}else n.isGeometry;return this}});class qa extends Nt{constructor(e,t){super(e,t),this.type="LineLoop"}}qa.prototype.isLineLoop=!0;class $n extends Ve{constructor(e){super(),this.type="PointsMaterial",this.color=new re(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.morphTargets=!1,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.morphTargets=e.morphTargets,this}}$n.prototype.isPointsMaterial=!0;const _l=new ce,Ma=new Mn,ms=new wn,gs=new w;function Ei(n=new le,e=new $n){de.call(this),this.type="Points",this.geometry=n,this.material=e,this.updateMorphTargets()}Ei.prototype=Object.assign(Object.create(de.prototype),{constructor:Ei,isPoints:!0,copy:function(n){return de.prototype.copy.call(this,n),this.material=n.material,this.geometry=n.geometry,this},raycast:function(n,e){const t=this.geometry,i=this.matrixWorld,r=n.params.Points.threshold,s=t.drawRange;if(t.boundingSphere===null&&t.computeBoundingSphere(),ms.copy(t.boundingSphere),ms.applyMatrix4(i),ms.radius+=r,n.ray.intersectsSphere(ms)===!1)return;_l.copy(i).invert(),Ma.copy(n.ray).applyMatrix4(_l);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),a=o*o;if(t.isBufferGeometry){const c=t.index,u=t.attributes.position;if(c!==null){const h=Math.max(0,s.start),d=Math.min(c.count,s.start+s.count);for(let f=h,p=d;f<p;f++){const y=c.getX(f);gs.fromBufferAttribute(u,y),bl(gs,y,a,i,n,e,this)}}else{const h=Math.max(0,s.start),d=Math.min(u.count,s.start+s.count);for(let f=h,p=d;f<p;f++)gs.fromBufferAttribute(u,f),bl(gs,f,a,i,n,e,this)}}},updateMorphTargets:function(){const n=this.geometry;if(n.isBufferGeometry){const e=n.morphAttributes,t=Object.keys(e);if(t.length>0){const i=e[t[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,s=i.length;r<s;r++){const o=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}else{const e=n.morphTargets;e!==void 0&&e.length>0}}});function bl(n,e,t,i,r,s,o){const a=Ma.distanceSqToPoint(n);if(a<t){const c=new w;Ma.closestPointToPoint(n,c),c.applyMatrix4(i);const l=r.ray.origin.distanceTo(c);if(l<r.near||l>r.far)return;s.push({distance:l,distanceToRay:Math.sqrt(a),point:c,index:e,face:null,object:o})}}class Yu extends st{constructor(e,t,i,r,s,o,a,c,l){super(e,t,i,r,s,o,a,c,l),this.format=a!==void 0?a:fn,this.minFilter=o!==void 0?o:it,this.magFilter=s!==void 0?s:it,this.generateMipmaps=!1;const u=this;function h(){u.needsUpdate=!0,e.requestVideoFrameCallback(h)}"requestVideoFrameCallback"in e&&e.requestVideoFrameCallback(h)}clone(){return new this.constructor(this.image).copy(this)}update(){const e=this.image;"requestVideoFrameCallback"in e===!1&&e.readyState>=e.HAVE_CURRENT_DATA&&(this.needsUpdate=!0)}}Yu.prototype.isVideoTexture=!0;class Xa extends st{constructor(e,t,i,r,s,o,a,c,l,u,h,d){super(null,o,a,c,l,u,r,s,h,d),this.image={width:t,height:i},this.mipmaps=e,this.flipY=!1,this.generateMipmaps=!1}}Xa.prototype.isCompressedTexture=!0;class ju extends st{constructor(e,t,i,r,s,o,a,c,l){super(e,t,i,r,s,o,a,c,l),this.needsUpdate=!0}}ju.prototype.isCanvasTexture=!0;class Zu extends st{constructor(e,t,i,r,s,o,a,c,l,u){if(u=u!==void 0?u:Gn,u!==Gn&&u!==Mi)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");i===void 0&&u===Gn&&(i=rr),i===void 0&&u===Mi&&(i=bi),super(null,r,s,o,a,c,u,i,l),this.image={width:e,height:t},this.magFilter=a!==void 0?a:nt,this.minFilter=c!==void 0?c:nt,this.flipY=!1,this.generateMipmaps=!1}}Zu.prototype.isDepthTexture=!0;class Hs extends le{constructor(e=1,t=8,i=0,r=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:i,thetaLength:r},t=Math.max(3,t);const s=[],o=[],a=[],c=[],l=new w,u=new W;o.push(0,0,0),a.push(0,0,1),c.push(.5,.5);for(let h=0,d=3;h<=t;h++,d+=3){const f=i+h/t*r;l.x=e*Math.cos(f),l.y=e*Math.sin(f),o.push(l.x,l.y,l.z),a.push(0,0,1),u.x=(o[d]/e+1)/2,u.y=(o[d+1]/e+1)/2,c.push(u.x,u.y)}for(let h=1;h<=t;h++)s.push(h,h+1,0);this.setIndex(s),this.setAttribute("position",new se(o,3)),this.setAttribute("normal",new se(a,3)),this.setAttribute("uv",new se(c,2))}}class Ai extends le{constructor(e=1,t=1,i=1,r=8,s=1,o=!1,a=0,c=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:i,radialSegments:r,heightSegments:s,openEnded:o,thetaStart:a,thetaLength:c};const l=this;r=Math.floor(r),s=Math.floor(s);const u=[],h=[],d=[],f=[];let p=0;const y=[],x=i/2;let g=0;m(),o===!1&&(e>0&&b(!0),t>0&&b(!1)),this.setIndex(u),this.setAttribute("position",new se(h,3)),this.setAttribute("normal",new se(d,3)),this.setAttribute("uv",new se(f,2));function m(){const _=new w,T=new w;let v=0;const A=(t-e)/i;for(let L=0;L<=s;L++){const R=[],z=L/s,P=z*(t-e)+e;for(let U=0;U<=r;U++){const D=U/r,I=D*c+a,B=Math.sin(I),F=Math.cos(I);T.x=P*B,T.y=-z*i+x,T.z=P*F,h.push(T.x,T.y,T.z),_.set(B,A,F).normalize(),d.push(_.x,_.y,_.z),f.push(D,1-z),R.push(p++)}y.push(R)}for(let L=0;L<r;L++)for(let R=0;R<s;R++){const z=y[R][L],P=y[R+1][L],U=y[R+1][L+1],D=y[R][L+1];u.push(z,P,D),u.push(P,U,D),v+=6}l.addGroup(g,v,0),g+=v}function b(_){const T=p,v=new W,A=new w;let L=0;const R=_===!0?e:t,z=_===!0?1:-1;for(let U=1;U<=r;U++)h.push(0,x*z,0),d.push(0,z,0),f.push(.5,.5),p++;const P=p;for(let U=0;U<=r;U++){const I=U/r*c+a,B=Math.cos(I),F=Math.sin(I);A.x=R*F,A.y=x*z,A.z=R*B,h.push(A.x,A.y,A.z),d.push(0,z,0),v.x=B*.5+.5,v.y=F*.5*z+.5,f.push(v.x,v.y),p++}for(let U=0;U<r;U++){const D=T+U,I=P+U;_===!0?u.push(I,I+1,D):u.push(I+1,I,D),L+=3}l.addGroup(g,L,_===!0?1:2),g+=L}}}class Gs extends Ai{constructor(e=1,t=1,i=8,r=1,s=!1,o=0,a=Math.PI*2){super(0,e,t,i,r,s,o,a),this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:i,heightSegments:r,openEnded:s,thetaStart:o,thetaLength:a}}}class vn extends le{constructor(e,t,i=1,r=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:i,detail:r};const s=[],o=[];a(r),l(i),u(),this.setAttribute("position",new se(s,3)),this.setAttribute("normal",new se(s.slice(),3)),this.setAttribute("uv",new se(o,2)),r===0?this.computeVertexNormals():this.normalizeNormals();function a(m){const b=new w,_=new w,T=new w;for(let v=0;v<t.length;v+=3)f(t[v+0],b),f(t[v+1],_),f(t[v+2],T),c(b,_,T,m)}function c(m,b,_,T){const v=T+1,A=[];for(let L=0;L<=v;L++){A[L]=[];const R=m.clone().lerp(_,L/v),z=b.clone().lerp(_,L/v),P=v-L;for(let U=0;U<=P;U++)U===0&&L===v?A[L][U]=R:A[L][U]=R.clone().lerp(z,U/P)}for(let L=0;L<v;L++)for(let R=0;R<2*(v-L)-1;R++){const z=Math.floor(R/2);R%2===0?(d(A[L][z+1]),d(A[L+1][z]),d(A[L][z])):(d(A[L][z+1]),d(A[L+1][z+1]),d(A[L+1][z]))}}function l(m){const b=new w;for(let _=0;_<s.length;_+=3)b.x=s[_+0],b.y=s[_+1],b.z=s[_+2],b.normalize().multiplyScalar(m),s[_+0]=b.x,s[_+1]=b.y,s[_+2]=b.z}function u(){const m=new w;for(let b=0;b<s.length;b+=3){m.x=s[b+0],m.y=s[b+1],m.z=s[b+2];const _=x(m)/2/Math.PI+.5,T=g(m)/Math.PI+.5;o.push(_,1-T)}p(),h()}function h(){for(let m=0;m<o.length;m+=6){const b=o[m+0],_=o[m+2],T=o[m+4],v=Math.max(b,_,T),A=Math.min(b,_,T);v>.9&&A<.1&&(b<.2&&(o[m+0]+=1),_<.2&&(o[m+2]+=1),T<.2&&(o[m+4]+=1))}}function d(m){s.push(m.x,m.y,m.z)}function f(m,b){const _=m*3;b.x=e[_+0],b.y=e[_+1],b.z=e[_+2]}function p(){const m=new w,b=new w,_=new w,T=new w,v=new W,A=new W,L=new W;for(let R=0,z=0;R<s.length;R+=9,z+=6){m.set(s[R+0],s[R+1],s[R+2]),b.set(s[R+3],s[R+4],s[R+5]),_.set(s[R+6],s[R+7],s[R+8]),v.set(o[z+0],o[z+1]),A.set(o[z+2],o[z+3]),L.set(o[z+4],o[z+5]),T.copy(m).add(b).add(_).divideScalar(3);const P=x(T);y(v,z+0,m,P),y(A,z+2,b,P),y(L,z+4,_,P)}}function y(m,b,_,T){T<0&&m.x===1&&(o[b]=m.x-1),_.x===0&&_.z===0&&(o[b]=T/2/Math.PI+.5)}function x(m){return Math.atan2(m.z,-m.x)}function g(m){return Math.atan2(-m.y,Math.sqrt(m.x*m.x+m.z*m.z))}}}class ks extends vn{constructor(e=1,t=0){const i=(1+Math.sqrt(5))/2,r=1/i,s=[-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-r,-i,0,-r,i,0,r,-i,0,r,i,-r,-i,0,-r,i,0,r,-i,0,r,i,0,-i,0,-r,i,0,-r,-i,0,r,i,0,r],o=[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9];super(s,o,e,t),this.type="DodecahedronGeometry",this.parameters={radius:e,detail:t}}}const ys=new w,xs=new w,Jo=new w,vs=new Je;class Ya extends le{constructor(e,t){if(super(),this.type="EdgesGeometry",this.parameters={thresholdAngle:t},t=t!==void 0?t:1,e.isGeometry===!0)return;const r=Math.pow(10,4),s=Math.cos(me.DEG2RAD*t),o=e.getIndex(),a=e.getAttribute("position"),c=o?o.count:a.count,l=[0,0,0],u=["a","b","c"],h=new Array(3),d={},f=[];for(let p=0;p<c;p+=3){o?(l[0]=o.getX(p),l[1]=o.getX(p+1),l[2]=o.getX(p+2)):(l[0]=p,l[1]=p+1,l[2]=p+2);const{a:y,b:x,c:g}=vs;if(y.fromBufferAttribute(a,l[0]),x.fromBufferAttribute(a,l[1]),g.fromBufferAttribute(a,l[2]),vs.getNormal(Jo),h[0]=`${Math.round(y.x*r)},${Math.round(y.y*r)},${Math.round(y.z*r)}`,h[1]=`${Math.round(x.x*r)},${Math.round(x.y*r)},${Math.round(x.z*r)}`,h[2]=`${Math.round(g.x*r)},${Math.round(g.y*r)},${Math.round(g.z*r)}`,!(h[0]===h[1]||h[1]===h[2]||h[2]===h[0]))for(let m=0;m<3;m++){const b=(m+1)%3,_=h[m],T=h[b],v=vs[u[m]],A=vs[u[b]],L=`${_}_${T}`,R=`${T}_${_}`;R in d&&d[R]?(Jo.dot(d[R].normal)<=s&&(f.push(v.x,v.y,v.z),f.push(A.x,A.y,A.z)),d[R]=null):L in d||(d[L]={index0:l[m],index1:l[b],normal:Jo.clone()})}}for(const p in d)if(d[p]){const{index0:y,index1:x}=d[p];ys.fromBufferAttribute(a,y),xs.fromBufferAttribute(a,x),f.push(ys.x,ys.y,ys.z),f.push(xs.x,xs.y,xs.z)}this.setAttribute("position",new se(f,3))}}const Dy={triangulate:function(n,e,t){t=t||2;const i=e&&e.length,r=i?e[0]*t:n.length;let s=Ju(n,0,r,t,!0);const o=[];if(!s||s.next===s.prev)return o;let a,c,l,u,h,d,f;if(i&&(s=Oy(n,e,s,t)),n.length>80*t){a=l=n[0],c=u=n[1];for(let p=t;p<r;p+=t)h=n[p],d=n[p+1],h<a&&(a=h),d<c&&(c=d),h>l&&(l=h),d>u&&(u=d);f=Math.max(l-a,u-c),f=f!==0?1/f:0}return vr(s,o,t,a,c,f),o}};function Ju(n,e,t,i,r){let s,o;if(r===Zy(n,e,t,i)>0)for(s=e;s<t;s+=i)o=wl(s,n[s],n[s+1],o);else for(s=t-i;s>=e;s-=i)o=wl(s,n[s],n[s+1],o);return o&&go(o,o.next)&&(br(o),o=o.next),o}function _n(n,e){if(!n)return n;e||(e=n);let t=n,i;do if(i=!1,!t.steiner&&(go(t,t.next)||We(t.prev,t,t.next)===0)){if(br(t),t=e=t.prev,t===t.next)break;i=!0}else t=t.next;while(i||t!==e);return e}function vr(n,e,t,i,r,s,o){if(!n)return;!o&&s&&Vy(n,i,r,s);let a=n,c,l;for(;n.prev!==n.next;){if(c=n.prev,l=n.next,s?By(n,i,r,s):Fy(n)){e.push(c.i/t),e.push(n.i/t),e.push(l.i/t),br(n),n=l.next,a=l.next;continue}if(n=l,n===a){o?o===1?(n=Ny(_n(n),e,t),vr(n,e,t,i,r,s,2)):o===2&&zy(n,e,t,i,r,s):vr(_n(n),e,t,i,r,s,1);break}}}function Fy(n){const e=n.prev,t=n,i=n.next;if(We(e,t,i)>=0)return!1;let r=n.next.next;for(;r!==n.prev;){if(vi(e.x,e.y,t.x,t.y,i.x,i.y,r.x,r.y)&&We(r.prev,r,r.next)>=0)return!1;r=r.next}return!0}function By(n,e,t,i){const r=n.prev,s=n,o=n.next;if(We(r,s,o)>=0)return!1;const a=r.x<s.x?r.x<o.x?r.x:o.x:s.x<o.x?s.x:o.x,c=r.y<s.y?r.y<o.y?r.y:o.y:s.y<o.y?s.y:o.y,l=r.x>s.x?r.x>o.x?r.x:o.x:s.x>o.x?s.x:o.x,u=r.y>s.y?r.y>o.y?r.y:o.y:s.y>o.y?s.y:o.y,h=Sa(a,c,e,t,i),d=Sa(l,u,e,t,i);let f=n.prevZ,p=n.nextZ;for(;f&&f.z>=h&&p&&p.z<=d;){if(f!==n.prev&&f!==n.next&&vi(r.x,r.y,s.x,s.y,o.x,o.y,f.x,f.y)&&We(f.prev,f,f.next)>=0||(f=f.prevZ,p!==n.prev&&p!==n.next&&vi(r.x,r.y,s.x,s.y,o.x,o.y,p.x,p.y)&&We(p.prev,p,p.next)>=0))return!1;p=p.nextZ}for(;f&&f.z>=h;){if(f!==n.prev&&f!==n.next&&vi(r.x,r.y,s.x,s.y,o.x,o.y,f.x,f.y)&&We(f.prev,f,f.next)>=0)return!1;f=f.prevZ}for(;p&&p.z<=d;){if(p!==n.prev&&p!==n.next&&vi(r.x,r.y,s.x,s.y,o.x,o.y,p.x,p.y)&&We(p.prev,p,p.next)>=0)return!1;p=p.nextZ}return!0}function Ny(n,e,t){let i=n;do{const r=i.prev,s=i.next.next;!go(r,s)&&$u(r,i,i.next,s)&&_r(r,s)&&_r(s,r)&&(e.push(r.i/t),e.push(i.i/t),e.push(s.i/t),br(i),br(i.next),i=n=s),i=i.next}while(i!==n);return _n(i)}function zy(n,e,t,i,r,s){let o=n;do{let a=o.next.next;for(;a!==o.prev;){if(o.i!==a.i&&Xy(o,a)){let c=Qu(o,a);o=_n(o,o.next),c=_n(c,c.next),vr(o,e,t,i,r,s),vr(c,e,t,i,r,s);return}a=a.next}o=o.next}while(o!==n)}function Oy(n,e,t,i){const r=[];let s,o,a,c,l;for(s=0,o=e.length;s<o;s++)a=e[s]*i,c=s<o-1?e[s+1]*i:n.length,l=Ju(n,a,c,i,!1),l===l.next&&(l.steiner=!0),r.push(qy(l));for(r.sort(Uy),s=0;s<r.length;s++)Hy(r[s],t),t=_n(t,t.next);return t}function Uy(n,e){return n.x-e.x}function Hy(n,e){if(e=Gy(n,e),e){const t=Qu(e,n);_n(e,e.next),_n(t,t.next)}}function Gy(n,e){let t=e;const i=n.x,r=n.y;let s=-1/0,o;do{if(r<=t.y&&r>=t.next.y&&t.next.y!==t.y){const d=t.x+(r-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(d<=i&&d>s){if(s=d,d===i){if(r===t.y)return t;if(r===t.next.y)return t.next}o=t.x<t.next.x?t:t.next}}t=t.next}while(t!==e);if(!o)return null;if(i===s)return o;const a=o,c=o.x,l=o.y;let u=1/0,h;t=o;do i>=t.x&&t.x>=c&&i!==t.x&&vi(r<l?i:s,r,c,l,r<l?s:i,r,t.x,t.y)&&(h=Math.abs(r-t.y)/(i-t.x),_r(t,n)&&(h<u||h===u&&(t.x>o.x||t.x===o.x&&ky(o,t)))&&(o=t,u=h)),t=t.next;while(t!==a);return o}function ky(n,e){return We(n.prev,n,e.prev)<0&&We(e.next,n,n.next)<0}function Vy(n,e,t,i){let r=n;do r.z===null&&(r.z=Sa(r.x,r.y,e,t,i)),r.prevZ=r.prev,r.nextZ=r.next,r=r.next;while(r!==n);r.prevZ.nextZ=null,r.prevZ=null,Wy(r)}function Wy(n){let e,t,i,r,s,o,a,c,l=1;do{for(t=n,n=null,s=null,o=0;t;){for(o++,i=t,a=0,e=0;e<l&&(a++,i=i.nextZ,!!i);e++);for(c=l;a>0||c>0&&i;)a!==0&&(c===0||!i||t.z<=i.z)?(r=t,t=t.nextZ,a--):(r=i,i=i.nextZ,c--),s?s.nextZ=r:n=r,r.prevZ=s,s=r;t=i}s.nextZ=null,l*=2}while(o>1);return n}function Sa(n,e,t,i,r){return n=32767*(n-t)*r,e=32767*(e-i)*r,n=(n|n<<8)&16711935,n=(n|n<<4)&252645135,n=(n|n<<2)&858993459,n=(n|n<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,n|e<<1}function qy(n){let e=n,t=n;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==n);return t}function vi(n,e,t,i,r,s,o,a){return(r-o)*(e-a)-(n-o)*(s-a)>=0&&(n-o)*(i-a)-(t-o)*(e-a)>=0&&(t-o)*(s-a)-(r-o)*(i-a)>=0}function Xy(n,e){return n.next.i!==e.i&&n.prev.i!==e.i&&!Yy(n,e)&&(_r(n,e)&&_r(e,n)&&jy(n,e)&&(We(n.prev,n,e.prev)||We(n,e.prev,e))||go(n,e)&&We(n.prev,n,n.next)>0&&We(e.prev,e,e.next)>0)}function We(n,e,t){return(e.y-n.y)*(t.x-e.x)-(e.x-n.x)*(t.y-e.y)}function go(n,e){return n.x===e.x&&n.y===e.y}function $u(n,e,t,i){const r=bs(We(n,e,t)),s=bs(We(n,e,i)),o=bs(We(t,i,n)),a=bs(We(t,i,e));return!!(r!==s&&o!==a||r===0&&_s(n,t,e)||s===0&&_s(n,i,e)||o===0&&_s(t,n,i)||a===0&&_s(t,e,i))}function _s(n,e,t){return e.x<=Math.max(n.x,t.x)&&e.x>=Math.min(n.x,t.x)&&e.y<=Math.max(n.y,t.y)&&e.y>=Math.min(n.y,t.y)}function bs(n){return n>0?1:n<0?-1:0}function Yy(n,e){let t=n;do{if(t.i!==n.i&&t.next.i!==n.i&&t.i!==e.i&&t.next.i!==e.i&&$u(t,t.next,n,e))return!0;t=t.next}while(t!==n);return!1}function _r(n,e){return We(n.prev,n,n.next)<0?We(n,e,n.next)>=0&&We(n,n.prev,e)>=0:We(n,e,n.prev)<0||We(n,n.next,e)<0}function jy(n,e){let t=n,i=!1;const r=(n.x+e.x)/2,s=(n.y+e.y)/2;do t.y>s!=t.next.y>s&&t.next.y!==t.y&&r<(t.next.x-t.x)*(s-t.y)/(t.next.y-t.y)+t.x&&(i=!i),t=t.next;while(t!==n);return i}function Qu(n,e){const t=new Ta(n.i,n.x,n.y),i=new Ta(e.i,e.x,e.y),r=n.next,s=e.prev;return n.next=e,e.prev=n,t.next=r,r.prev=t,i.next=t,t.prev=i,s.next=i,i.prev=s,i}function wl(n,e,t,i){const r=new Ta(n,e,t);return i?(r.next=i.next,r.prev=i,i.next.prev=r,i.next=r):(r.prev=r,r.next=r),r}function br(n){n.next.prev=n.prev,n.prev.next=n.next,n.prevZ&&(n.prevZ.nextZ=n.nextZ),n.nextZ&&(n.nextZ.prevZ=n.prevZ)}function Ta(n,e,t){this.i=n,this.x=e,this.y=t,this.prev=null,this.next=null,this.z=null,this.prevZ=null,this.nextZ=null,this.steiner=!1}function Zy(n,e,t,i){let r=0;for(let s=e,o=t-i;s<t;s+=i)r+=(n[o]-n[s])*(n[s+1]+n[o+1]),o=s;return r}const en={area:function(n){const e=n.length;let t=0;for(let i=e-1,r=0;r<e;i=r++)t+=n[i].x*n[r].y-n[r].x*n[i].y;return t*.5},isClockWise:function(n){return en.area(n)<0},triangulateShape:function(n,e){const t=[],i=[],r=[];Ml(n),Sl(t,n);let s=n.length;e.forEach(Ml);for(let a=0;a<e.length;a++)i.push(s),s+=e[a].length,Sl(t,e[a]);const o=Dy.triangulate(t,i);for(let a=0;a<o.length;a+=3)r.push(o.slice(a,a+3));return r}};function Ml(n){const e=n.length;e>2&&n[e-1].equals(n[0])&&n.pop()}function Sl(n,e){for(let t=0;t<e.length;t++)n.push(e[t].x),n.push(e[t].y)}class tn extends le{constructor(e,t){super(),this.type="ExtrudeGeometry",this.parameters={shapes:e,options:t},e=Array.isArray(e)?e:[e];const i=this,r=[],s=[];for(let a=0,c=e.length;a<c;a++){const l=e[a];o(l)}this.setAttribute("position",new se(r,3)),this.setAttribute("uv",new se(s,2)),this.computeVertexNormals();function o(a){const c=[],l=t.curveSegments!==void 0?t.curveSegments:12,u=t.steps!==void 0?t.steps:1;let h=t.depth!==void 0?t.depth:100,d=t.bevelEnabled!==void 0?t.bevelEnabled:!0,f=t.bevelThickness!==void 0?t.bevelThickness:6,p=t.bevelSize!==void 0?t.bevelSize:f-2,y=t.bevelOffset!==void 0?t.bevelOffset:0,x=t.bevelSegments!==void 0?t.bevelSegments:3;const g=t.extrudePath,m=t.UVGenerator!==void 0?t.UVGenerator:Jy;t.amount!==void 0&&(h=t.amount);let b,_=!1,T,v,A,L;g&&(b=g.getSpacedPoints(u),_=!0,d=!1,T=g.computeFrenetFrames(u,!1),v=new w,A=new w,L=new w),d||(x=0,f=0,p=0,y=0);const R=a.extractPoints(l);let z=R.shape;const P=R.holes;if(!en.isClockWise(z)){z=z.reverse();for(let Y=0,$=P.length;Y<$;Y++){const ee=P[Y];en.isClockWise(ee)&&(P[Y]=ee.reverse())}}const D=en.triangulateShape(z,P),I=z;for(let Y=0,$=P.length;Y<$;Y++){const ee=P[Y];z=z.concat(ee)}function B(Y,$,ee){return $.clone().multiplyScalar(ee).add(Y)}const F=z.length,X=D.length;function K(Y,$,ee){let ue,ne,E;const S=Y.x-$.x,k=Y.y-$.y,V=ee.x-Y.x,ie=ee.y-Y.y,he=S*S+k*k,Ie=S*ie-k*V;if(Math.abs(Ie)>Number.EPSILON){const we=Math.sqrt(he),C=Math.sqrt(V*V+ie*ie),Z=$.x-k/we,Q=$.y+S/we,pe=ee.x-ie/C,q=ee.y+V/C,xe=((pe-Z)*ie-(q-Q)*V)/(S*ie-k*V);ue=Z+S*xe-Y.x,ne=Q+k*xe-Y.y;const Ne=ue*ue+ne*ne;if(Ne<=2)return new W(ue,ne);E=Math.sqrt(Ne/2)}else{let we=!1;S>Number.EPSILON?V>Number.EPSILON&&(we=!0):S<-Number.EPSILON?V<-Number.EPSILON&&(we=!0):Math.sign(k)===Math.sign(ie)&&(we=!0),we?(ue=-k,ne=S,E=Math.sqrt(he)):(ue=S,ne=k,E=Math.sqrt(he/2))}return new W(ue/E,ne/E)}const j=[];for(let Y=0,$=I.length,ee=$-1,ue=Y+1;Y<$;Y++,ee++,ue++)ee===$&&(ee=0),ue===$&&(ue=0),j[Y]=K(I[Y],I[ee],I[ue]);const oe=[];let ae,ye=j.concat();for(let Y=0,$=P.length;Y<$;Y++){const ee=P[Y];ae=[];for(let ue=0,ne=ee.length,E=ne-1,S=ue+1;ue<ne;ue++,E++,S++)E===ne&&(E=0),S===ne&&(S=0),ae[ue]=K(ee[ue],ee[E],ee[S]);oe.push(ae),ye=ye.concat(ae)}for(let Y=0;Y<x;Y++){const $=Y/x,ee=f*Math.cos($*Math.PI/2),ue=p*Math.sin($*Math.PI/2)+y;for(let ne=0,E=I.length;ne<E;ne++){const S=B(I[ne],j[ne],ue);be(S.x,S.y,-ee)}for(let ne=0,E=P.length;ne<E;ne++){const S=P[ne];ae=oe[ne];for(let k=0,V=S.length;k<V;k++){const ie=B(S[k],ae[k],ue);be(ie.x,ie.y,-ee)}}}const Se=p+y;for(let Y=0;Y<F;Y++){const $=d?B(z[Y],ye[Y],Se):z[Y];_?(A.copy(T.normals[0]).multiplyScalar($.x),v.copy(T.binormals[0]).multiplyScalar($.y),L.copy(b[0]).add(A).add(v),be(L.x,L.y,L.z)):be($.x,$.y,0)}for(let Y=1;Y<=u;Y++)for(let $=0;$<F;$++){const ee=d?B(z[$],ye[$],Se):z[$];_?(A.copy(T.normals[Y]).multiplyScalar(ee.x),v.copy(T.binormals[Y]).multiplyScalar(ee.y),L.copy(b[Y]).add(A).add(v),be(L.x,L.y,L.z)):be(ee.x,ee.y,h/u*Y)}for(let Y=x-1;Y>=0;Y--){const $=Y/x,ee=f*Math.cos($*Math.PI/2),ue=p*Math.sin($*Math.PI/2)+y;for(let ne=0,E=I.length;ne<E;ne++){const S=B(I[ne],j[ne],ue);be(S.x,S.y,h+ee)}for(let ne=0,E=P.length;ne<E;ne++){const S=P[ne];ae=oe[ne];for(let k=0,V=S.length;k<V;k++){const ie=B(S[k],ae[k],ue);_?be(ie.x,ie.y+b[u-1].y,b[u-1].x+ee):be(ie.x,ie.y,h+ee)}}}G(),De();function G(){const Y=r.length/3;if(d){let $=0,ee=F*$;for(let ue=0;ue<X;ue++){const ne=D[ue];ge(ne[2]+ee,ne[1]+ee,ne[0]+ee)}$=u+x*2,ee=F*$;for(let ue=0;ue<X;ue++){const ne=D[ue];ge(ne[0]+ee,ne[1]+ee,ne[2]+ee)}}else{for(let $=0;$<X;$++){const ee=D[$];ge(ee[2],ee[1],ee[0])}for(let $=0;$<X;$++){const ee=D[$];ge(ee[0]+F*u,ee[1]+F*u,ee[2]+F*u)}}i.addGroup(Y,r.length/3-Y,0)}function De(){const Y=r.length/3;let $=0;Ce(I,$),$+=I.length;for(let ee=0,ue=P.length;ee<ue;ee++){const ne=P[ee];Ce(ne,$),$+=ne.length}i.addGroup(Y,r.length/3-Y,1)}function Ce(Y,$){let ee=Y.length;for(;--ee>=0;){const ue=ee;let ne=ee-1;ne<0&&(ne=Y.length-1);for(let E=0,S=u+x*2;E<S;E++){const k=F*E,V=F*(E+1),ie=$+ue+k,he=$+ne+k,Ie=$+ne+V,we=$+ue+V;Fe(ie,he,Ie,we)}}}function be(Y,$,ee){c.push(Y),c.push($),c.push(ee)}function ge(Y,$,ee){Ee(Y),Ee($),Ee(ee);const ue=r.length/3,ne=m.generateTopUV(i,r,ue-3,ue-2,ue-1);Le(ne[0]),Le(ne[1]),Le(ne[2])}function Fe(Y,$,ee,ue){Ee(Y),Ee($),Ee(ue),Ee($),Ee(ee),Ee(ue);const ne=r.length/3,E=m.generateSideWallUV(i,r,ne-6,ne-3,ne-2,ne-1);Le(E[0]),Le(E[1]),Le(E[3]),Le(E[1]),Le(E[2]),Le(E[3])}function Ee(Y){r.push(c[Y*3+0]),r.push(c[Y*3+1]),r.push(c[Y*3+2])}function Le(Y){s.push(Y.x),s.push(Y.y)}}}toJSON(){const e=le.prototype.toJSON.call(this),t=this.parameters.shapes,i=this.parameters.options;return $y(t,i,e)}}const Jy={generateTopUV:function(n,e,t,i,r){const s=e[t*3],o=e[t*3+1],a=e[i*3],c=e[i*3+1],l=e[r*3],u=e[r*3+1];return[new W(s,o),new W(a,c),new W(l,u)]},generateSideWallUV:function(n,e,t,i,r,s){const o=e[t*3],a=e[t*3+1],c=e[t*3+2],l=e[i*3],u=e[i*3+1],h=e[i*3+2],d=e[r*3],f=e[r*3+1],p=e[r*3+2],y=e[s*3],x=e[s*3+1],g=e[s*3+2];return Math.abs(a-u)<.01?[new W(o,1-c),new W(l,1-h),new W(d,1-p),new W(y,1-g)]:[new W(a,1-c),new W(u,1-h),new W(f,1-p),new W(x,1-g)]}};function $y(n,e,t){if(t.shapes=[],Array.isArray(n))for(let i=0,r=n.length;i<r;i++){const s=n[i];t.shapes.push(s.uuid)}else t.shapes.push(n.uuid);return e.extrudePath!==void 0&&(t.options.extrudePath=e.extrudePath.toJSON()),t}class Vs extends vn{constructor(e=1,t=0){const i=(1+Math.sqrt(5))/2,r=[-1,i,0,1,i,0,-1,-i,0,1,-i,0,0,-1,i,0,1,i,0,-1,-i,0,1,-i,i,0,-1,i,0,1,-i,0,-1,-i,0,1],s=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(r,s,e,t),this.type="IcosahedronGeometry",this.parameters={radius:e,detail:t}}}class Ws extends le{constructor(e,t=12,i=0,r=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:e,segments:t,phiStart:i,phiLength:r},t=Math.floor(t),r=me.clamp(r,0,Math.PI*2);const s=[],o=[],a=[],c=1/t,l=new w,u=new W;for(let h=0;h<=t;h++){const d=i+h*c*r,f=Math.sin(d),p=Math.cos(d);for(let y=0;y<=e.length-1;y++)l.x=e[y].x*f,l.y=e[y].y,l.z=e[y].x*p,o.push(l.x,l.y,l.z),u.x=h/t,u.y=y/(e.length-1),a.push(u.x,u.y)}for(let h=0;h<t;h++)for(let d=0;d<e.length-1;d++){const f=d+h*e.length,p=f,y=f+e.length,x=f+e.length+1,g=f+1;s.push(p,y,g),s.push(y,x,g)}if(this.setIndex(s),this.setAttribute("position",new se(o,3)),this.setAttribute("uv",new se(a,2)),this.computeVertexNormals(),r===Math.PI*2){const h=this.attributes.normal.array,d=new w,f=new w,p=new w,y=t*e.length*3;for(let x=0,g=0;x<e.length;x++,g+=3)d.x=h[g+0],d.y=h[g+1],d.z=h[g+2],f.x=h[y+g+0],f.y=h[y+g+1],f.z=h[y+g+2],p.addVectors(d,f).normalize(),h[g+0]=h[y+g+0]=p.x,h[g+1]=h[y+g+1]=p.y,h[g+2]=h[y+g+2]=p.z}}}class wr extends vn{constructor(e=1,t=0){const i=[1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],r=[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2];super(i,r,e,t),this.type="OctahedronGeometry",this.parameters={radius:e,detail:t}}}function Xn(n,e,t){le.call(this),this.type="ParametricGeometry",this.parameters={func:n,slices:e,stacks:t};const i=[],r=[],s=[],o=[],a=1e-5,c=new w,l=new w,u=new w,h=new w,d=new w;n.length<3;const f=e+1;for(let p=0;p<=t;p++){const y=p/t;for(let x=0;x<=e;x++){const g=x/e;n(g,y,l),r.push(l.x,l.y,l.z),g-a>=0?(n(g-a,y,u),h.subVectors(l,u)):(n(g+a,y,u),h.subVectors(u,l)),y-a>=0?(n(g,y-a,u),d.subVectors(l,u)):(n(g,y+a,u),d.subVectors(u,l)),c.crossVectors(h,d).normalize(),s.push(c.x,c.y,c.z),o.push(g,y)}}for(let p=0;p<t;p++)for(let y=0;y<e;y++){const x=p*f+y,g=p*f+y+1,m=(p+1)*f+y+1,b=(p+1)*f+y;i.push(x,g,b),i.push(g,m,b)}this.setIndex(i),this.setAttribute("position",new se(r,3)),this.setAttribute("normal",new se(s,3)),this.setAttribute("uv",new se(o,2))}Xn.prototype=Object.create(le.prototype);Xn.prototype.constructor=Xn;class qs extends le{constructor(e=.5,t=1,i=8,r=1,s=0,o=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:e,outerRadius:t,thetaSegments:i,phiSegments:r,thetaStart:s,thetaLength:o},i=Math.max(3,i),r=Math.max(1,r);const a=[],c=[],l=[],u=[];let h=e;const d=(t-e)/r,f=new w,p=new W;for(let y=0;y<=r;y++){for(let x=0;x<=i;x++){const g=s+x/i*o;f.x=h*Math.cos(g),f.y=h*Math.sin(g),c.push(f.x,f.y,f.z),l.push(0,0,1),p.x=(f.x/t+1)/2,p.y=(f.y/t+1)/2,u.push(p.x,p.y)}h+=d}for(let y=0;y<r;y++){const x=y*(i+1);for(let g=0;g<i;g++){const m=g+x,b=m,_=m+i+1,T=m+i+2,v=m+1;a.push(b,_,v),a.push(_,T,v)}}this.setIndex(a),this.setAttribute("position",new se(c,3)),this.setAttribute("normal",new se(l,3)),this.setAttribute("uv",new se(u,2))}}class Mr extends le{constructor(e,t=12){super(),this.type="ShapeGeometry",this.parameters={shapes:e,curveSegments:t};const i=[],r=[],s=[],o=[];let a=0,c=0;if(Array.isArray(e)===!1)l(e);else for(let u=0;u<e.length;u++)l(e[u]),this.addGroup(a,c,u),a+=c,c=0;this.setIndex(i),this.setAttribute("position",new se(r,3)),this.setAttribute("normal",new se(s,3)),this.setAttribute("uv",new se(o,2));function l(u){const h=r.length/3,d=u.extractPoints(t);let f=d.shape;const p=d.holes;en.isClockWise(f)===!1&&(f=f.reverse());for(let x=0,g=p.length;x<g;x++){const m=p[x];en.isClockWise(m)===!0&&(p[x]=m.reverse())}const y=en.triangulateShape(f,p);for(let x=0,g=p.length;x<g;x++){const m=p[x];f=f.concat(m)}for(let x=0,g=f.length;x<g;x++){const m=f[x];r.push(m.x,m.y,0),s.push(0,0,1),o.push(m.x,m.y)}for(let x=0,g=y.length;x<g;x++){const m=y[x],b=m[0]+h,_=m[1]+h,T=m[2]+h;i.push(b,_,T),c+=3}}}toJSON(){const e=le.prototype.toJSON.call(this),t=this.parameters.shapes;return Qy(t,e)}}function Qy(n,e){if(e.shapes=[],Array.isArray(n))for(let t=0,i=n.length;t<i;t++){const r=n[t];e.shapes.push(r.uuid)}else e.shapes.push(n.uuid);return e}class Sr extends le{constructor(e=1,t=8,i=6,r=0,s=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:i,phiStart:r,phiLength:s,thetaStart:o,thetaLength:a},t=Math.max(3,Math.floor(t)),i=Math.max(2,Math.floor(i));const c=Math.min(o+a,Math.PI);let l=0;const u=[],h=new w,d=new w,f=[],p=[],y=[],x=[];for(let g=0;g<=i;g++){const m=[],b=g/i;let _=0;g==0&&o==0?_=.5/t:g==i&&c==Math.PI&&(_=-.5/t);for(let T=0;T<=t;T++){const v=T/t;h.x=-e*Math.cos(r+v*s)*Math.sin(o+b*a),h.y=e*Math.cos(o+b*a),h.z=e*Math.sin(r+v*s)*Math.sin(o+b*a),p.push(h.x,h.y,h.z),d.copy(h).normalize(),y.push(d.x,d.y,d.z),x.push(v+_,1-b),m.push(l++)}u.push(m)}for(let g=0;g<i;g++)for(let m=0;m<t;m++){const b=u[g][m+1],_=u[g][m],T=u[g+1][m],v=u[g+1][m+1];(g!==0||o>0)&&f.push(b,_,v),(g!==i-1||c<Math.PI)&&f.push(_,T,v)}this.setIndex(f),this.setAttribute("position",new se(p,3)),this.setAttribute("normal",new se(y,3)),this.setAttribute("uv",new se(x,2))}}class Xs extends vn{constructor(e=1,t=0){const i=[1,1,1,-1,-1,1,-1,1,-1,1,-1,-1],r=[2,1,0,0,3,2,1,3,0,2,3,1];super(i,r,e,t),this.type="TetrahedronGeometry",this.parameters={radius:e,detail:t}}}class Ys extends tn{constructor(e,t={}){const i=t.font;if(!(i&&i.isFont))return new le;const r=i.generateShapes(e,t.size);t.depth=t.height!==void 0?t.height:50,t.bevelThickness===void 0&&(t.bevelThickness=10),t.bevelSize===void 0&&(t.bevelSize=8),t.bevelEnabled===void 0&&(t.bevelEnabled=!1),super(r,t),this.type="TextGeometry"}}class js extends le{constructor(e=1,t=.4,i=8,r=6,s=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:i,tubularSegments:r,arc:s},i=Math.floor(i),r=Math.floor(r);const o=[],a=[],c=[],l=[],u=new w,h=new w,d=new w;for(let f=0;f<=i;f++)for(let p=0;p<=r;p++){const y=p/r*s,x=f/i*Math.PI*2;h.x=(e+t*Math.cos(x))*Math.cos(y),h.y=(e+t*Math.cos(x))*Math.sin(y),h.z=t*Math.sin(x),a.push(h.x,h.y,h.z),u.x=e*Math.cos(y),u.y=e*Math.sin(y),d.subVectors(h,u).normalize(),c.push(d.x,d.y,d.z),l.push(p/r),l.push(f/i)}for(let f=1;f<=i;f++)for(let p=1;p<=r;p++){const y=(r+1)*f+p-1,x=(r+1)*(f-1)+p-1,g=(r+1)*(f-1)+p,m=(r+1)*f+p;o.push(y,x,m),o.push(x,g,m)}this.setIndex(o),this.setAttribute("position",new se(a,3)),this.setAttribute("normal",new se(c,3)),this.setAttribute("uv",new se(l,2))}}class Zs extends le{constructor(e=1,t=.4,i=64,r=8,s=2,o=3){super(),this.type="TorusKnotGeometry",this.parameters={radius:e,tube:t,tubularSegments:i,radialSegments:r,p:s,q:o},i=Math.floor(i),r=Math.floor(r);const a=[],c=[],l=[],u=[],h=new w,d=new w,f=new w,p=new w,y=new w,x=new w,g=new w;for(let b=0;b<=i;++b){const _=b/i*s*Math.PI*2;m(_,s,o,e,f),m(_+.01,s,o,e,p),x.subVectors(p,f),g.addVectors(p,f),y.crossVectors(x,g),g.crossVectors(y,x),y.normalize(),g.normalize();for(let T=0;T<=r;++T){const v=T/r*Math.PI*2,A=-t*Math.cos(v),L=t*Math.sin(v);h.x=f.x+(A*g.x+L*y.x),h.y=f.y+(A*g.y+L*y.y),h.z=f.z+(A*g.z+L*y.z),c.push(h.x,h.y,h.z),d.subVectors(h,f).normalize(),l.push(d.x,d.y,d.z),u.push(b/i),u.push(T/r)}}for(let b=1;b<=i;b++)for(let _=1;_<=r;_++){const T=(r+1)*(b-1)+(_-1),v=(r+1)*b+(_-1),A=(r+1)*b+_,L=(r+1)*(b-1)+_;a.push(T,v,L),a.push(v,A,L)}this.setIndex(a),this.setAttribute("position",new se(c,3)),this.setAttribute("normal",new se(l,3)),this.setAttribute("uv",new se(u,2));function m(b,_,T,v,A){const L=Math.cos(b),R=Math.sin(b),z=T/_*b,P=Math.cos(z);A.x=v*(2+P)*.5*L,A.y=v*(2+P)*R*.5,A.z=v*Math.sin(z)*.5}}}class Js extends le{constructor(e,t=64,i=1,r=8,s=!1){super(),this.type="TubeGeometry",this.parameters={path:e,tubularSegments:t,radius:i,radialSegments:r,closed:s};const o=e.computeFrenetFrames(t,s);this.tangents=o.tangents,this.normals=o.normals,this.binormals=o.binormals;const a=new w,c=new w,l=new W;let u=new w;const h=[],d=[],f=[],p=[];y(),this.setIndex(p),this.setAttribute("position",new se(h,3)),this.setAttribute("normal",new se(d,3)),this.setAttribute("uv",new se(f,2));function y(){for(let b=0;b<t;b++)x(b);x(s===!1?t:0),m(),g()}function x(b){u=e.getPointAt(b/t,u);const _=o.normals[b],T=o.binormals[b];for(let v=0;v<=r;v++){const A=v/r*Math.PI*2,L=Math.sin(A),R=-Math.cos(A);c.x=R*_.x+L*T.x,c.y=R*_.y+L*T.y,c.z=R*_.z+L*T.z,c.normalize(),d.push(c.x,c.y,c.z),a.x=u.x+i*c.x,a.y=u.y+i*c.y,a.z=u.z+i*c.z,h.push(a.x,a.y,a.z)}}function g(){for(let b=1;b<=t;b++)for(let _=1;_<=r;_++){const T=(r+1)*(b-1)+(_-1),v=(r+1)*b+(_-1),A=(r+1)*b+_,L=(r+1)*(b-1)+_;p.push(T,v,L),p.push(v,A,L)}}function m(){for(let b=0;b<=t;b++)for(let _=0;_<=r;_++)l.x=b/t,l.y=_/r,f.push(l.x,l.y)}}toJSON(){const e=le.prototype.toJSON.call(this);return e.path=this.parameters.path.toJSON(),e}}class ja extends le{constructor(e){if(super(),this.type="WireframeGeometry",e.isGeometry===!0)return;const t=[],i=[0,0],r={},s=new w;if(e.index!==null){const o=e.attributes.position,a=e.index;let c=e.groups;c.length===0&&(c=[{start:0,count:a.count,materialIndex:0}]);for(let l=0,u=c.length;l<u;++l){const h=c[l],d=h.start,f=h.count;for(let p=d,y=d+f;p<y;p+=3)for(let x=0;x<3;x++){const g=a.getX(p+x),m=a.getX(p+(x+1)%3);i[0]=Math.min(g,m),i[1]=Math.max(g,m);const b=i[0]+","+i[1];r[b]===void 0&&(r[b]={index1:i[0],index2:i[1]})}}for(const l in r){const u=r[l];s.fromBufferAttribute(o,u.index1),t.push(s.x,s.y,s.z),s.fromBufferAttribute(o,u.index2),t.push(s.x,s.y,s.z)}}else{const o=e.attributes.position;for(let a=0,c=o.count/3;a<c;a++)for(let l=0;l<3;l++){const u=3*a+l;s.fromBufferAttribute(o,u),t.push(s.x,s.y,s.z);const h=3*a+(l+1)%3;s.fromBufferAttribute(o,h),t.push(s.x,s.y,s.z)}}this.setAttribute("position",new se(t,3))}}var pt=Object.freeze({__proto__:null,BoxGeometry:qn,BoxBufferGeometry:qn,CircleGeometry:Hs,CircleBufferGeometry:Hs,ConeGeometry:Gs,ConeBufferGeometry:Gs,CylinderGeometry:Ai,CylinderBufferGeometry:Ai,DodecahedronGeometry:ks,DodecahedronBufferGeometry:ks,EdgesGeometry:Ya,ExtrudeGeometry:tn,ExtrudeBufferGeometry:tn,IcosahedronGeometry:Vs,IcosahedronBufferGeometry:Vs,LatheGeometry:Ws,LatheBufferGeometry:Ws,OctahedronGeometry:wr,OctahedronBufferGeometry:wr,ParametricGeometry:Xn,ParametricBufferGeometry:Xn,PlaneGeometry:gr,PlaneBufferGeometry:gr,PolyhedronGeometry:vn,PolyhedronBufferGeometry:vn,RingGeometry:qs,RingBufferGeometry:qs,ShapeGeometry:Mr,ShapeBufferGeometry:Mr,SphereGeometry:Sr,SphereBufferGeometry:Sr,TetrahedronGeometry:Xs,TetrahedronBufferGeometry:Xs,TextGeometry:Ys,TextBufferGeometry:Ys,TorusGeometry:js,TorusBufferGeometry:js,TorusKnotGeometry:Zs,TorusKnotBufferGeometry:Zs,TubeGeometry:Js,TubeBufferGeometry:Js,WireframeGeometry:ja});class Za extends Ve{constructor(e){super(),this.type="ShadowMaterial",this.color=new re(0),this.transparent=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this}}Za.prototype.isShadowMaterial=!0;class Bi extends wt{constructor(e){super(e),this.type="RawShaderMaterial"}}Bi.prototype.isRawShaderMaterial=!0;function Vt(n){Ve.call(this),this.defines={STANDARD:""},this.type="MeshStandardMaterial",this.color=new re(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new re(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=jn,this.normalScale=new W(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.flatShading=!1,this.vertexTangents=!1,this.setValues(n)}Vt.prototype=Object.create(Ve.prototype);Vt.prototype.constructor=Vt;Vt.prototype.isMeshStandardMaterial=!0;Vt.prototype.copy=function(n){return Ve.prototype.copy.call(this,n),this.defines={STANDARD:""},this.color.copy(n.color),this.roughness=n.roughness,this.metalness=n.metalness,this.map=n.map,this.lightMap=n.lightMap,this.lightMapIntensity=n.lightMapIntensity,this.aoMap=n.aoMap,this.aoMapIntensity=n.aoMapIntensity,this.emissive.copy(n.emissive),this.emissiveMap=n.emissiveMap,this.emissiveIntensity=n.emissiveIntensity,this.bumpMap=n.bumpMap,this.bumpScale=n.bumpScale,this.normalMap=n.normalMap,this.normalMapType=n.normalMapType,this.normalScale.copy(n.normalScale),this.displacementMap=n.displacementMap,this.displacementScale=n.displacementScale,this.displacementBias=n.displacementBias,this.roughnessMap=n.roughnessMap,this.metalnessMap=n.metalnessMap,this.alphaMap=n.alphaMap,this.envMap=n.envMap,this.envMapIntensity=n.envMapIntensity,this.refractionRatio=n.refractionRatio,this.wireframe=n.wireframe,this.wireframeLinewidth=n.wireframeLinewidth,this.wireframeLinecap=n.wireframeLinecap,this.wireframeLinejoin=n.wireframeLinejoin,this.skinning=n.skinning,this.morphTargets=n.morphTargets,this.morphNormals=n.morphNormals,this.flatShading=n.flatShading,this.vertexTangents=n.vertexTangents,this};function bn(n){Vt.call(this),this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.clearcoat=0,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new W(1,1),this.clearcoatNormalMap=null,this.reflectivity=.5,Object.defineProperty(this,"ior",{get:function(){return(1+.4*this.reflectivity)/(1-.4*this.reflectivity)},set:function(e){this.reflectivity=me.clamp(2.5*(e-1)/(e+1),0,1)}}),this.sheen=null,this.transmission=0,this.transmissionMap=null,this.setValues(n)}bn.prototype=Object.create(Vt.prototype);bn.prototype.constructor=bn;bn.prototype.isMeshPhysicalMaterial=!0;bn.prototype.copy=function(n){return Vt.prototype.copy.call(this,n),this.defines={STANDARD:"",PHYSICAL:""},this.clearcoat=n.clearcoat,this.clearcoatMap=n.clearcoatMap,this.clearcoatRoughness=n.clearcoatRoughness,this.clearcoatRoughnessMap=n.clearcoatRoughnessMap,this.clearcoatNormalMap=n.clearcoatNormalMap,this.clearcoatNormalScale.copy(n.clearcoatNormalScale),this.reflectivity=n.reflectivity,n.sheen?this.sheen=(this.sheen||new re).copy(n.sheen):this.sheen=null,this.transmission=n.transmission,this.transmissionMap=n.transmissionMap,this};class Ja extends Ve{constructor(e){super(),this.type="MeshPhongMaterial",this.color=new re(16777215),this.specular=new re(1118481),this.shininess=30,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new re(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=jn,this.normalScale=new W(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=Dr,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.flatShading=!1,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.specular.copy(e.specular),this.shininess=e.shininess,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this.flatShading=e.flatShading,this}}Ja.prototype.isMeshPhongMaterial=!0;class $a extends Ve{constructor(e){super(),this.defines={TOON:""},this.type="MeshToonMaterial",this.color=new re(16777215),this.map=null,this.gradientMap=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new re(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=jn,this.normalScale=new W(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.gradientMap=e.gradientMap,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.alphaMap=e.alphaMap,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this}}$a.prototype.isMeshToonMaterial=!0;class Qa extends Ve{constructor(e){super(),this.type="MeshNormalMaterial",this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=jn,this.normalScale=new W(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.flatShading=!1,this.setValues(e)}copy(e){return super.copy(e),this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this.flatShading=e.flatShading,this}}Qa.prototype.isMeshNormalMaterial=!0;class Ka extends Ve{constructor(e){super(),this.type="MeshLambertMaterial",this.color=new re(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new re(0),this.emissiveIntensity=1,this.emissiveMap=null,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.combine=Dr,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this}}Ka.prototype.isMeshLambertMaterial=!0;class ec extends Ve{constructor(e){super(),this.defines={MATCAP:""},this.type="MeshMatcapMaterial",this.color=new re(16777215),this.matcap=null,this.map=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=jn,this.normalScale=new W(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.skinning=!1,this.morphTargets=!1,this.morphNormals=!1,this.flatShading=!1,this.setValues(e)}copy(e){return super.copy(e),this.defines={MATCAP:""},this.color.copy(e.color),this.matcap=e.matcap,this.map=e.map,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.alphaMap=e.alphaMap,this.skinning=e.skinning,this.morphTargets=e.morphTargets,this.morphNormals=e.morphNormals,this.flatShading=e.flatShading,this}}ec.prototype.isMeshMatcapMaterial=!0;class tc extends ct{constructor(e){super(),this.type="LineDashedMaterial",this.scale=1,this.dashSize=3,this.gapSize=1,this.setValues(e)}copy(e){return super.copy(e),this.scale=e.scale,this.dashSize=e.dashSize,this.gapSize=e.gapSize,this}}tc.prototype.isLineDashedMaterial=!0;var Ky=Object.freeze({__proto__:null,ShadowMaterial:Za,SpriteMaterial:fo,RawShaderMaterial:Bi,ShaderMaterial:wt,PointsMaterial:$n,MeshPhysicalMaterial:bn,MeshStandardMaterial:Vt,MeshPhongMaterial:Ja,MeshToonMaterial:$a,MeshNormalMaterial:Qa,MeshLambertMaterial:Ka,MeshDepthMaterial:lo,MeshDistanceMaterial:ho,MeshBasicMaterial:rn,MeshMatcapMaterial:ec,LineDashedMaterial:tc,LineBasicMaterial:ct,Material:Ve});const ke={arraySlice:function(n,e,t){return ke.isTypedArray(n)?new n.constructor(n.subarray(e,t!==void 0?t:n.length)):n.slice(e,t)},convertArray:function(n,e,t){return!n||!t&&n.constructor===e?n:typeof e.BYTES_PER_ELEMENT=="number"?new e(n):Array.prototype.slice.call(n)},isTypedArray:function(n){return ArrayBuffer.isView(n)&&!(n instanceof DataView)},getKeyframeOrder:function(n){function e(r,s){return n[r]-n[s]}const t=n.length,i=new Array(t);for(let r=0;r!==t;++r)i[r]=r;return i.sort(e),i},sortedArray:function(n,e,t){const i=n.length,r=new n.constructor(i);for(let s=0,o=0;o!==i;++s){const a=t[s]*e;for(let c=0;c!==e;++c)r[o++]=n[a+c]}return r},flattenJSON:function(n,e,t,i){let r=1,s=n[0];for(;s!==void 0&&s[i]===void 0;)s=n[r++];if(s===void 0)return;let o=s[i];if(o!==void 0)if(Array.isArray(o))do o=s[i],o!==void 0&&(e.push(s.time),t.push.apply(t,o)),s=n[r++];while(s!==void 0);else if(o.toArray!==void 0)do o=s[i],o!==void 0&&(e.push(s.time),o.toArray(t,t.length)),s=n[r++];while(s!==void 0);else do o=s[i],o!==void 0&&(e.push(s.time),t.push(o)),s=n[r++];while(s!==void 0)},subclip:function(n,e,t,i,r=30){const s=n.clone();s.name=e;const o=[];for(let c=0;c<s.tracks.length;++c){const l=s.tracks[c],u=l.getValueSize(),h=[],d=[];for(let f=0;f<l.times.length;++f){const p=l.times[f]*r;if(!(p<t||p>=i)){h.push(l.times[f]);for(let y=0;y<u;++y)d.push(l.values[f*u+y])}}h.length!==0&&(l.times=ke.convertArray(h,l.times.constructor),l.values=ke.convertArray(d,l.values.constructor),o.push(l))}s.tracks=o;let a=1/0;for(let c=0;c<s.tracks.length;++c)a>s.tracks[c].times[0]&&(a=s.tracks[c].times[0]);for(let c=0;c<s.tracks.length;++c)s.tracks[c].shift(-1*a);return s.resetDuration(),s},makeClipAdditive:function(n,e=0,t=n,i=30){i<=0&&(i=30);const r=t.tracks.length,s=e/i;for(let o=0;o<r;++o){const a=t.tracks[o],c=a.ValueTypeName;if(c==="bool"||c==="string")continue;const l=n.tracks.find(function(g){return g.name===a.name&&g.ValueTypeName===c});if(l===void 0)continue;let u=0;const h=a.getValueSize();a.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline&&(u=h/3);let d=0;const f=l.getValueSize();l.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline&&(d=f/3);const p=a.times.length-1;let y;if(s<=a.times[0]){const g=u,m=h-u;y=ke.arraySlice(a.values,g,m)}else if(s>=a.times[p]){const g=p*h+u,m=g+h-u;y=ke.arraySlice(a.values,g,m)}else{const g=a.createInterpolant(),m=u,b=h-u;g.evaluate(s),y=ke.arraySlice(g.resultBuffer,m,b)}c==="quaternion"&&new at().fromArray(y).normalize().conjugate().toArray(y);const x=l.times.length;for(let g=0;g<x;++g){const m=g*f+d;if(c==="quaternion")at.multiplyQuaternionsFlat(l.values,m,y,0,l.values,m);else{const b=f-d*2;for(let _=0;_<b;++_)l.values[m+_]-=y[_]}}}return n.blendMode=za,n}};function At(n,e,t,i){this.parameterPositions=n,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new e.constructor(t),this.sampleValues=e,this.valueSize=t}Object.assign(At.prototype,{evaluate:function(n){const e=this.parameterPositions;let t=this._cachedIndex,i=e[t],r=e[t-1];e:{t:{let s;n:{i:if(!(n<i)){for(let o=t+2;;){if(i===void 0){if(n<r)break i;return t=e.length,this._cachedIndex=t,this.afterEnd_(t-1,n,r)}if(t===o)break;if(r=i,i=e[++t],n<i)break t}s=e.length;break n}if(!(n>=r)){const o=e[1];n<o&&(t=2,r=o);for(let a=t-2;;){if(r===void 0)return this._cachedIndex=0,this.beforeStart_(0,n,i);if(t===a)break;if(i=r,r=e[--t-1],n>=r)break t}s=t,t=0;break n}break e}for(;t<s;){const o=t+s>>>1;n<e[o]?s=o:t=o+1}if(i=e[t],r=e[t-1],r===void 0)return this._cachedIndex=0,this.beforeStart_(0,n,i);if(i===void 0)return t=e.length,this._cachedIndex=t,this.afterEnd_(t-1,r,n)}this._cachedIndex=t,this.intervalChanged_(t,r,i)}return this.interpolate_(t,r,n,i)},settings:null,DefaultSettings_:{},getSettings_:function(){return this.settings||this.DefaultSettings_},copySampleValue_:function(n){const e=this.resultBuffer,t=this.sampleValues,i=this.valueSize,r=n*i;for(let s=0;s!==i;++s)e[s]=t[r+s];return e},interpolate_:function(){throw new Error("call to abstract method")},intervalChanged_:function(){}});Object.assign(At.prototype,{beforeStart_:At.prototype.copySampleValue_,afterEnd_:At.prototype.copySampleValue_});function $s(n,e,t,i){At.call(this,n,e,t,i),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0}$s.prototype=Object.assign(Object.create(At.prototype),{constructor:$s,DefaultSettings_:{endingStart:zn,endingEnd:zn},intervalChanged_:function(n,e,t){const i=this.parameterPositions;let r=n-2,s=n+1,o=i[r],a=i[s];if(o===void 0)switch(this.getSettings_().endingStart){case On:r=n,o=2*e-t;break;case cr:r=i.length-2,o=e+i[r]-i[r+1];break;default:r=n,o=t}if(a===void 0)switch(this.getSettings_().endingEnd){case On:s=n,a=2*t-e;break;case cr:s=1,a=t+i[1]-i[0];break;default:s=n-1,a=e}const c=(t-e)*.5,l=this.valueSize;this._weightPrev=c/(e-o),this._weightNext=c/(a-t),this._offsetPrev=r*l,this._offsetNext=s*l},interpolate_:function(n,e,t,i){const r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=n*o,c=a-o,l=this._offsetPrev,u=this._offsetNext,h=this._weightPrev,d=this._weightNext,f=(t-e)/(i-e),p=f*f,y=p*f,x=-h*y+2*h*p-h*f,g=(1+h)*y+(-1.5-2*h)*p+(-.5+h)*f+1,m=(-1-d)*y+(1.5+d)*p+.5*f,b=d*y-d*p;for(let _=0;_!==o;++_)r[_]=x*s[l+_]+g*s[c+_]+m*s[a+_]+b*s[u+_];return r}});function Tr(n,e,t,i){At.call(this,n,e,t,i)}Tr.prototype=Object.assign(Object.create(At.prototype),{constructor:Tr,interpolate_:function(n,e,t,i){const r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=n*o,c=a-o,l=(t-e)/(i-e),u=1-l;for(let h=0;h!==o;++h)r[h]=s[c+h]*u+s[a+h]*l;return r}});function Qs(n,e,t,i){At.call(this,n,e,t,i)}Qs.prototype=Object.assign(Object.create(At.prototype),{constructor:Qs,interpolate_:function(n){return this.copySampleValue_(n-1)}});class Ot{constructor(e,t,i,r){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=ke.convertArray(t,this.TimeBufferType),this.values=ke.convertArray(i,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){const t=e.constructor;let i;if(t.toJSON!==this.toJSON)i=t.toJSON(e);else{i={name:e.name,times:ke.convertArray(e.times,Array),values:ke.convertArray(e.values,Array)};const r=e.getInterpolation();r!==e.DefaultInterpolation&&(i.interpolation=r)}return i.type=e.ValueTypeName,i}InterpolantFactoryMethodDiscrete(e){return new Qs(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Tr(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new $s(this.times,this.values,this.getValueSize(),e)}setInterpolation(e){let t;switch(e){case or:t=this.InterpolantFactoryMethodDiscrete;break;case ar:t=this.InterpolantFactoryMethodLinear;break;case Is:t=this.InterpolantFactoryMethodSmooth;break}if(t===void 0){const i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return or;case this.InterpolantFactoryMethodLinear:return ar;case this.InterpolantFactoryMethodSmooth:return Is}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){const t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]+=e}return this}scale(e){if(e!==1){const t=this.times;for(let i=0,r=t.length;i!==r;++i)t[i]*=e}return this}trim(e,t){const i=this.times,r=i.length;let s=0,o=r-1;for(;s!==r&&i[s]<e;)++s;for(;o!==-1&&i[o]>t;)--o;if(++o,s!==0||o!==r){s>=o&&(o=Math.max(o,1),s=o-1);const a=this.getValueSize();this.times=ke.arraySlice(i,s,o),this.values=ke.arraySlice(this.values,s*a,o*a)}return this}validate(){let e=!0;const t=this.getValueSize();t-Math.floor(t)!==0&&(e=!1);const i=this.times,r=this.values,s=i.length;s===0&&(e=!1);let o=null;for(let a=0;a!==s;a++){const c=i[a];if(typeof c=="number"&&isNaN(c)){e=!1;break}if(o!==null&&o>c){e=!1;break}o=c}if(r!==void 0&&ke.isTypedArray(r))for(let a=0,c=r.length;a!==c;++a){const l=r[a];if(isNaN(l)){e=!1;break}}return e}optimize(){const e=ke.arraySlice(this.times),t=ke.arraySlice(this.values),i=this.getValueSize(),r=this.getInterpolation()===Is,s=e.length-1;let o=1;for(let a=1;a<s;++a){let c=!1;const l=e[a],u=e[a+1];if(l!==u&&(a!==1||l!==e[0]))if(r)c=!0;else{const h=a*i,d=h-i,f=h+i;for(let p=0;p!==i;++p){const y=t[h+p];if(y!==t[d+p]||y!==t[f+p]){c=!0;break}}}if(c){if(a!==o){e[o]=e[a];const h=a*i,d=o*i;for(let f=0;f!==i;++f)t[d+f]=t[h+f]}++o}}if(s>0){e[o]=e[s];for(let a=s*i,c=o*i,l=0;l!==i;++l)t[c+l]=t[a+l];++o}return o!==e.length?(this.times=ke.arraySlice(e,0,o),this.values=ke.arraySlice(t,0,o*i)):(this.times=e,this.values=t),this}clone(){const e=ke.arraySlice(this.times,0),t=ke.arraySlice(this.values,0),i=this.constructor,r=new i(this.name,e,t);return r.createInterpolant=this.createInterpolant,r}}Ot.prototype.TimeBufferType=Float32Array;Ot.prototype.ValueBufferType=Float32Array;Ot.prototype.DefaultInterpolation=ar;class Qn extends Ot{}Qn.prototype.ValueTypeName="bool";Qn.prototype.ValueBufferType=Array;Qn.prototype.DefaultInterpolation=or;Qn.prototype.InterpolantFactoryMethodLinear=void 0;Qn.prototype.InterpolantFactoryMethodSmooth=void 0;class nc extends Ot{}nc.prototype.ValueTypeName="color";class Er extends Ot{}Er.prototype.ValueTypeName="number";function Ks(n,e,t,i){At.call(this,n,e,t,i)}Ks.prototype=Object.assign(Object.create(At.prototype),{constructor:Ks,interpolate_:function(n,e,t,i){const r=this.resultBuffer,s=this.sampleValues,o=this.valueSize,a=(t-e)/(i-e);let c=n*o;for(let l=c+o;c!==l;c+=4)at.slerpFlat(r,0,s,c-o,s,c,a);return r}});class Ni extends Ot{InterpolantFactoryMethodLinear(e){return new Ks(this.times,this.values,this.getValueSize(),e)}}Ni.prototype.ValueTypeName="quaternion";Ni.prototype.DefaultInterpolation=ar;Ni.prototype.InterpolantFactoryMethodSmooth=void 0;class Kn extends Ot{}Kn.prototype.ValueTypeName="string";Kn.prototype.ValueBufferType=Array;Kn.prototype.DefaultInterpolation=or;Kn.prototype.InterpolantFactoryMethodLinear=void 0;Kn.prototype.InterpolantFactoryMethodSmooth=void 0;class Ar extends Ot{}Ar.prototype.ValueTypeName="vector";class Lr{constructor(e,t=-1,i,r=ro){this.name=e,this.tracks=i,this.duration=t,this.blendMode=r,this.uuid=me.generateUUID(),this.duration<0&&this.resetDuration()}static parse(e){const t=[],i=e.tracks,r=1/(e.fps||1);for(let o=0,a=i.length;o!==a;++o)t.push(tx(i[o]).scale(r));const s=new this(e.name,e.duration,t,e.blendMode);return s.uuid=e.uuid,s}static toJSON(e){const t=[],i=e.tracks,r={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode};for(let s=0,o=i.length;s!==o;++s)t.push(Ot.toJSON(i[s]));return r}static CreateFromMorphTargetSequence(e,t,i,r){const s=t.length,o=[];for(let a=0;a<s;a++){let c=[],l=[];c.push((a+s-1)%s,a,(a+1)%s),l.push(0,1,0);const u=ke.getKeyframeOrder(c);c=ke.sortedArray(c,1,u),l=ke.sortedArray(l,1,u),!r&&c[0]===0&&(c.push(s),l.push(l[0])),o.push(new Er(".morphTargetInfluences["+t[a].name+"]",c,l).scale(1/i))}return new this(e,-1,o)}static findByName(e,t){let i=e;if(!Array.isArray(e)){const r=e;i=r.geometry&&r.geometry.animations||r.animations}for(let r=0;r<i.length;r++)if(i[r].name===t)return i[r];return null}static CreateClipsFromMorphTargetSequences(e,t,i){const r={},s=/^([\w-]*?)([\d]+)$/;for(let a=0,c=e.length;a<c;a++){const l=e[a],u=l.name.match(s);if(u&&u.length>1){const h=u[1];let d=r[h];d||(r[h]=d=[]),d.push(l)}}const o=[];for(const a in r)o.push(this.CreateFromMorphTargetSequence(a,r[a],t,i));return o}static parseAnimation(e,t){if(!e)return null;const i=function(h,d,f,p,y){if(f.length!==0){const x=[],g=[];ke.flattenJSON(f,x,g,p),x.length!==0&&y.push(new h(d,x,g))}},r=[],s=e.name||"default",o=e.fps||30,a=e.blendMode;let c=e.length||-1;const l=e.hierarchy||[];for(let h=0;h<l.length;h++){const d=l[h].keys;if(!(!d||d.length===0))if(d[0].morphTargets){const f={};let p;for(p=0;p<d.length;p++)if(d[p].morphTargets)for(let y=0;y<d[p].morphTargets.length;y++)f[d[p].morphTargets[y]]=-1;for(const y in f){const x=[],g=[];for(let m=0;m!==d[p].morphTargets.length;++m){const b=d[p];x.push(b.time),g.push(b.morphTarget===y?1:0)}r.push(new Er(".morphTargetInfluence["+y+"]",x,g))}c=f.length*o}else{const f=".bones["+t[h].name+"]";i(Ar,f+".position",d,"pos",r),i(Ni,f+".quaternion",d,"rot",r),i(Ar,f+".scale",d,"scl",r)}}return r.length===0?null:new this(s,c,r,a)}resetDuration(){const e=this.tracks;let t=0;for(let i=0,r=e.length;i!==r;++i){const s=this.tracks[i];t=Math.max(t,s.times[s.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){const e=[];for(let t=0;t<this.tracks.length;t++)e.push(this.tracks[t].clone());return new this.constructor(this.name,this.duration,e,this.blendMode)}toJSON(){return this.constructor.toJSON(this)}}function ex(n){switch(n.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return Er;case"vector":case"vector2":case"vector3":case"vector4":return Ar;case"color":return nc;case"quaternion":return Ni;case"bool":case"boolean":return Qn;case"string":return Kn}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+n)}function tx(n){if(n.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");const e=ex(n.type);if(n.times===void 0){const t=[],i=[];ke.flattenJSON(n.keys,t,i,"value"),n.times=t,n.values=i}return e.parse!==void 0?e.parse(n):new e(n.name,n.times,n.values,n.interpolation)}const Yn={enabled:!1,files:{},add:function(n,e){this.enabled!==!1&&(this.files[n]=e)},get:function(n){if(this.enabled!==!1)return this.files[n]},remove:function(n){delete this.files[n]},clear:function(){this.files={}}};function ic(n,e,t){const i=this;let r=!1,s=0,o=0,a;const c=[];this.onStart=void 0,this.onLoad=n,this.onProgress=e,this.onError=t,this.itemStart=function(l){o++,r===!1&&i.onStart!==void 0&&i.onStart(l,s,o),r=!0},this.itemEnd=function(l){s++,i.onProgress!==void 0&&i.onProgress(l,s,o),s===o&&(r=!1,i.onLoad!==void 0&&i.onLoad())},this.itemError=function(l){i.onError!==void 0&&i.onError(l)},this.resolveURL=function(l){return a?a(l):l},this.setURLModifier=function(l){return a=l,this},this.addHandler=function(l,u){return c.push(l,u),this},this.removeHandler=function(l){const u=c.indexOf(l);return u!==-1&&c.splice(u,2),this},this.getHandler=function(l){for(let u=0,h=c.length;u<h;u+=2){const d=c[u],f=c[u+1];if(d.global&&(d.lastIndex=0),d.test(l))return f}return null}}const Ku=new ic;function Xe(n){this.manager=n!==void 0?n:Ku,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}Object.assign(Xe.prototype,{load:function(){},loadAsync:function(n,e){const t=this;return new Promise(function(i,r){t.load(n,i,e,r)})},parse:function(){},setCrossOrigin:function(n){return this.crossOrigin=n,this},setWithCredentials:function(n){return this.withCredentials=n,this},setPath:function(n){return this.path=n,this},setResourcePath:function(n){return this.resourcePath=n,this},setRequestHeader:function(n){return this.requestHeader=n,this}});const Dt={};function Lt(n){Xe.call(this,n)}Lt.prototype=Object.assign(Object.create(Xe.prototype),{constructor:Lt,load:function(n,e,t,i){n===void 0&&(n=""),this.path!==void 0&&(n=this.path+n),n=this.manager.resolveURL(n);const r=this,s=Yn.get(n);if(s!==void 0)return r.manager.itemStart(n),setTimeout(function(){e&&e(s),r.manager.itemEnd(n)},0),s;if(Dt[n]!==void 0){Dt[n].push({onLoad:e,onProgress:t,onError:i});return}const o=/^data:(.*?)(;base64)?,(.*)$/,a=n.match(o);let c;if(a){const l=a[1],u=!!a[2];let h=a[3];h=decodeURIComponent(h),u&&(h=atob(h));try{let d;const f=(this.responseType||"").toLowerCase();switch(f){case"arraybuffer":case"blob":const p=new Uint8Array(h.length);for(let x=0;x<h.length;x++)p[x]=h.charCodeAt(x);f==="blob"?d=new Blob([p.buffer],{type:l}):d=p.buffer;break;case"document":d=new DOMParser().parseFromString(h,l);break;case"json":d=JSON.parse(h);break;default:d=h;break}setTimeout(function(){e&&e(d),r.manager.itemEnd(n)},0)}catch(d){setTimeout(function(){i&&i(d),r.manager.itemError(n),r.manager.itemEnd(n)},0)}}else{Dt[n]=[],Dt[n].push({onLoad:e,onProgress:t,onError:i}),c=new XMLHttpRequest,c.open("GET",n,!0),c.addEventListener("load",function(l){const u=this.response,h=Dt[n];if(delete Dt[n],this.status===200||this.status===0){this.status,Yn.add(n,u);for(let d=0,f=h.length;d<f;d++){const p=h[d];p.onLoad&&p.onLoad(u)}r.manager.itemEnd(n)}else{for(let d=0,f=h.length;d<f;d++){const p=h[d];p.onError&&p.onError(l)}r.manager.itemError(n),r.manager.itemEnd(n)}},!1),c.addEventListener("progress",function(l){const u=Dt[n];for(let h=0,d=u.length;h<d;h++){const f=u[h];f.onProgress&&f.onProgress(l)}},!1),c.addEventListener("error",function(l){const u=Dt[n];delete Dt[n];for(let h=0,d=u.length;h<d;h++){const f=u[h];f.onError&&f.onError(l)}r.manager.itemError(n),r.manager.itemEnd(n)},!1),c.addEventListener("abort",function(l){const u=Dt[n];delete Dt[n];for(let h=0,d=u.length;h<d;h++){const f=u[h];f.onError&&f.onError(l)}r.manager.itemError(n),r.manager.itemEnd(n)},!1),this.responseType!==void 0&&(c.responseType=this.responseType),this.withCredentials!==void 0&&(c.withCredentials=this.withCredentials),c.overrideMimeType&&c.overrideMimeType(this.mimeType!==void 0?this.mimeType:"text/plain");for(const l in this.requestHeader)c.setRequestHeader(l,this.requestHeader[l]);c.send(null)}return r.manager.itemStart(n),c},setResponseType:function(n){return this.responseType=n,this},setMimeType:function(n){return this.mimeType=n,this}});class nx extends Xe{constructor(e){super(e)}load(e,t,i,r){const s=this,o=new Lt(this.manager);o.setPath(this.path),o.setRequestHeader(this.requestHeader),o.setWithCredentials(this.withCredentials),o.load(e,function(a){try{t(s.parse(JSON.parse(a)))}catch(c){r&&r(c),s.manager.itemError(e)}},i,r)}parse(e){const t=[];for(let i=0;i<e.length;i++){const r=Lr.parse(e[i]);t.push(r)}return t}}function Ea(n){Xe.call(this,n)}Ea.prototype=Object.assign(Object.create(Xe.prototype),{constructor:Ea,load:function(n,e,t,i){const r=this,s=[],o=new Xa,a=new Lt(this.manager);a.setPath(this.path),a.setResponseType("arraybuffer"),a.setRequestHeader(this.requestHeader),a.setWithCredentials(r.withCredentials);let c=0;function l(u){a.load(n[u],function(h){const d=r.parse(h,!0);s[u]={width:d.width,height:d.height,format:d.format,mipmaps:d.mipmaps},c+=1,c===6&&(d.mipmapCount===1&&(o.minFilter=it),o.image=s,o.format=d.format,o.needsUpdate=!0,e&&e(o))},t,i)}if(Array.isArray(n))for(let u=0,h=n.length;u<h;++u)l(u);else a.load(n,function(u){const h=r.parse(u,!0);if(h.isCubemap){const d=h.mipmaps.length/h.mipmapCount;for(let f=0;f<d;f++){s[f]={mipmaps:[]};for(let p=0;p<h.mipmapCount;p++)s[f].mipmaps.push(h.mipmaps[f*h.mipmapCount+p]),s[f].format=h.format,s[f].width=h.width,s[f].height=h.height}o.image=s}else o.image.width=h.width,o.image.height=h.height,o.mipmaps=h.mipmaps;h.mipmapCount===1&&(o.minFilter=it),o.format=h.format,o.needsUpdate=!0,e&&e(o)},t,i);return o}});class yo extends Xe{constructor(e){super(e)}load(e,t,i,r){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const s=this,o=Yn.get(e);if(o!==void 0)return s.manager.itemStart(e),setTimeout(function(){t&&t(o),s.manager.itemEnd(e)},0),o;const a=document.createElementNS("http://www.w3.org/1999/xhtml","img");function c(){a.removeEventListener("load",c,!1),a.removeEventListener("error",l,!1),Yn.add(e,this),t&&t(this),s.manager.itemEnd(e)}function l(u){a.removeEventListener("load",c,!1),a.removeEventListener("error",l,!1),r&&r(u),s.manager.itemError(e),s.manager.itemEnd(e)}return a.addEventListener("load",c,!1),a.addEventListener("error",l,!1),e.substr(0,5)!=="data:"&&this.crossOrigin!==void 0&&(a.crossOrigin=this.crossOrigin),s.manager.itemStart(e),a.src=e,a}}class ed extends Xe{constructor(e){super(e)}load(e,t,i,r){const s=new Di,o=new yo(this.manager);o.setCrossOrigin(this.crossOrigin),o.setPath(this.path);let a=0;function c(l){o.load(e[l],function(u){s.images[l]=u,a++,a===6&&(s.needsUpdate=!0,t&&t(s))},void 0,r)}for(let l=0;l<e.length;++l)c(l);return s}}function eo(n){Xe.call(this,n)}eo.prototype=Object.assign(Object.create(Xe.prototype),{constructor:eo,load:function(n,e,t,i){const r=this,s=new Ti,o=new Lt(this.manager);return o.setResponseType("arraybuffer"),o.setRequestHeader(this.requestHeader),o.setPath(this.path),o.setWithCredentials(r.withCredentials),o.load(n,function(a){const c=r.parse(a);c&&(c.image!==void 0?s.image=c.image:c.data!==void 0&&(s.image.width=c.width,s.image.height=c.height,s.image.data=c.data),s.wrapS=c.wrapS!==void 0?c.wrapS:mt,s.wrapT=c.wrapT!==void 0?c.wrapT:mt,s.magFilter=c.magFilter!==void 0?c.magFilter:it,s.minFilter=c.minFilter!==void 0?c.minFilter:it,s.anisotropy=c.anisotropy!==void 0?c.anisotropy:1,c.encoding!==void 0&&(s.encoding=c.encoding),c.flipY!==void 0&&(s.flipY=c.flipY),c.format!==void 0&&(s.format=c.format),c.type!==void 0&&(s.type=c.type),c.mipmaps!==void 0&&(s.mipmaps=c.mipmaps,s.minFilter=Ci),c.mipmapCount===1&&(s.minFilter=it),c.generateMipmaps!==void 0&&(s.generateMipmaps=c.generateMipmaps),s.needsUpdate=!0,e&&e(s,c))},t,i),s}});function to(n){Xe.call(this,n)}to.prototype=Object.assign(Object.create(Xe.prototype),{constructor:to,load:function(n,e,t,i){const r=new st,s=new yo(this.manager);return s.setCrossOrigin(this.crossOrigin),s.setPath(this.path),s.load(n,function(o){r.image=o;const a=n.search(/\.jpe?g($|\?)/i)>0||n.search(/^data\:image\/jpeg/)===0;r.format=a?fn:Et,r.needsUpdate=!0,e!==void 0&&e(r)},t,i),r}});function vt(){this.type="Curve",this.arcLengthDivisions=200}Object.assign(vt.prototype,{getPoint:function(){return null},getPointAt:function(n,e){const t=this.getUtoTmapping(n);return this.getPoint(t,e)},getPoints:function(n=5){const e=[];for(let t=0;t<=n;t++)e.push(this.getPoint(t/n));return e},getSpacedPoints:function(n=5){const e=[];for(let t=0;t<=n;t++)e.push(this.getPointAt(t/n));return e},getLength:function(){const n=this.getLengths();return n[n.length-1]},getLengths:function(n){if(n===void 0&&(n=this.arcLengthDivisions),this.cacheArcLengths&&this.cacheArcLengths.length===n+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const e=[];let t,i=this.getPoint(0),r=0;e.push(0);for(let s=1;s<=n;s++)t=this.getPoint(s/n),r+=t.distanceTo(i),e.push(r),i=t;return this.cacheArcLengths=e,e},updateArcLengths:function(){this.needsUpdate=!0,this.getLengths()},getUtoTmapping:function(n,e){const t=this.getLengths();let i=0;const r=t.length;let s;e?s=e:s=n*t[r-1];let o=0,a=r-1,c;for(;o<=a;)if(i=Math.floor(o+(a-o)/2),c=t[i]-s,c<0)o=i+1;else if(c>0)a=i-1;else{a=i;break}if(i=a,t[i]===s)return i/(r-1);const l=t[i],h=t[i+1]-l,d=(s-l)/h;return(i+d)/(r-1)},getTangent:function(n,e){let i=n-1e-4,r=n+1e-4;i<0&&(i=0),r>1&&(r=1);const s=this.getPoint(i),o=this.getPoint(r),a=e||(s.isVector2?new W:new w);return a.copy(o).sub(s).normalize(),a},getTangentAt:function(n,e){const t=this.getUtoTmapping(n);return this.getTangent(t,e)},computeFrenetFrames:function(n,e){const t=new w,i=[],r=[],s=[],o=new w,a=new ce;for(let d=0;d<=n;d++){const f=d/n;i[d]=this.getTangentAt(f,new w),i[d].normalize()}r[0]=new w,s[0]=new w;let c=Number.MAX_VALUE;const l=Math.abs(i[0].x),u=Math.abs(i[0].y),h=Math.abs(i[0].z);l<=c&&(c=l,t.set(1,0,0)),u<=c&&(c=u,t.set(0,1,0)),h<=c&&t.set(0,0,1),o.crossVectors(i[0],t).normalize(),r[0].crossVectors(i[0],o),s[0].crossVectors(i[0],r[0]);for(let d=1;d<=n;d++){if(r[d]=r[d-1].clone(),s[d]=s[d-1].clone(),o.crossVectors(i[d-1],i[d]),o.length()>Number.EPSILON){o.normalize();const f=Math.acos(me.clamp(i[d-1].dot(i[d]),-1,1));r[d].applyMatrix4(a.makeRotationAxis(o,f))}s[d].crossVectors(i[d],r[d])}if(e===!0){let d=Math.acos(me.clamp(r[0].dot(r[n]),-1,1));d/=n,i[0].dot(o.crossVectors(r[0],r[n]))>0&&(d=-d);for(let f=1;f<=n;f++)r[f].applyMatrix4(a.makeRotationAxis(i[f],d*f)),s[f].crossVectors(i[f],r[f])}return{tangents:i,normals:r,binormals:s}},clone:function(){return new this.constructor().copy(this)},copy:function(n){return this.arcLengthDivisions=n.arcLengthDivisions,this},toJSON:function(){const n={metadata:{version:4.5,type:"Curve",generator:"Curve.toJSON"}};return n.arcLengthDivisions=this.arcLengthDivisions,n.type=this.type,n},fromJSON:function(n){return this.arcLengthDivisions=n.arcLengthDivisions,this}});class Gr extends vt{constructor(e=0,t=0,i=1,r=1,s=0,o=Math.PI*2,a=!1,c=0){super(),this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=i,this.yRadius=r,this.aStartAngle=s,this.aEndAngle=o,this.aClockwise=a,this.aRotation=c}getPoint(e,t){const i=t||new W,r=Math.PI*2;let s=this.aEndAngle-this.aStartAngle;const o=Math.abs(s)<Number.EPSILON;for(;s<0;)s+=r;for(;s>r;)s-=r;s<Number.EPSILON&&(o?s=0:s=r),this.aClockwise===!0&&!o&&(s===r?s=-r:s=s-r);const a=this.aStartAngle+e*s;let c=this.aX+this.xRadius*Math.cos(a),l=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){const u=Math.cos(this.aRotation),h=Math.sin(this.aRotation),d=c-this.aX,f=l-this.aY;c=d*u-f*h+this.aX,l=d*h+f*u+this.aY}return i.set(c,l)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){const e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}}Gr.prototype.isEllipseCurve=!0;class rc extends Gr{constructor(e,t,i,r,s,o){super(e,t,i,i,r,s,o),this.type="ArcCurve"}}rc.prototype.isArcCurve=!0;function sc(){let n=0,e=0,t=0,i=0;function r(s,o,a,c){n=s,e=a,t=-3*s+3*o-2*a-c,i=2*s-2*o+a+c}return{initCatmullRom:function(s,o,a,c,l){r(o,a,l*(a-s),l*(c-o))},initNonuniformCatmullRom:function(s,o,a,c,l,u,h){let d=(o-s)/l-(a-s)/(l+u)+(a-o)/u,f=(a-o)/u-(c-o)/(u+h)+(c-a)/h;d*=u,f*=u,r(o,a,d,f)},calc:function(s){const o=s*s,a=o*s;return n+e*s+t*o+i*a}}}const ws=new w,$o=new sc,Qo=new sc,Ko=new sc;class oc extends vt{constructor(e=[],t=!1,i="centripetal",r=.5){super(),this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=i,this.tension=r}getPoint(e,t=new w){const i=t,r=this.points,s=r.length,o=(s-(this.closed?0:1))*e;let a=Math.floor(o),c=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/s)+1)*s:c===0&&a===s-1&&(a=s-2,c=1);let l,u;this.closed||a>0?l=r[(a-1)%s]:(ws.subVectors(r[0],r[1]).add(r[0]),l=ws);const h=r[a%s],d=r[(a+1)%s];if(this.closed||a+2<s?u=r[(a+2)%s]:(ws.subVectors(r[s-1],r[s-2]).add(r[s-1]),u=ws),this.curveType==="centripetal"||this.curveType==="chordal"){const f=this.curveType==="chordal"?.5:.25;let p=Math.pow(l.distanceToSquared(h),f),y=Math.pow(h.distanceToSquared(d),f),x=Math.pow(d.distanceToSquared(u),f);y<1e-4&&(y=1),p<1e-4&&(p=y),x<1e-4&&(x=y),$o.initNonuniformCatmullRom(l.x,h.x,d.x,u.x,p,y,x),Qo.initNonuniformCatmullRom(l.y,h.y,d.y,u.y,p,y,x),Ko.initNonuniformCatmullRom(l.z,h.z,d.z,u.z,p,y,x)}else this.curveType==="catmullrom"&&($o.initCatmullRom(l.x,h.x,d.x,u.x,this.tension),Qo.initCatmullRom(l.y,h.y,d.y,u.y,this.tension),Ko.initCatmullRom(l.z,h.z,d.z,u.z,this.tension));return i.set($o.calc(c),Qo.calc(c),Ko.calc(c)),i}copy(e){super.copy(e),this.points=[];for(let t=0,i=e.points.length;t<i;t++){const r=e.points[t];this.points.push(r.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){const e=super.toJSON();e.points=[];for(let t=0,i=this.points.length;t<i;t++){const r=this.points[t];e.points.push(r.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,i=e.points.length;t<i;t++){const r=e.points[t];this.points.push(new w().fromArray(r))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}}oc.prototype.isCatmullRomCurve3=!0;function Tl(n,e,t,i,r){const s=(i-e)*.5,o=(r-t)*.5,a=n*n,c=n*a;return(2*t-2*i+s+o)*c+(-3*t+3*i-2*s-o)*a+s*n+t}function ix(n,e){const t=1-n;return t*t*e}function rx(n,e){return 2*(1-n)*n*e}function sx(n,e){return n*n*e}function er(n,e,t,i){return ix(n,e)+rx(n,t)+sx(n,i)}function ox(n,e){const t=1-n;return t*t*t*e}function ax(n,e){const t=1-n;return 3*t*t*n*e}function cx(n,e){return 3*(1-n)*n*n*e}function lx(n,e){return n*n*n*e}function tr(n,e,t,i,r){return ox(n,e)+ax(n,t)+cx(n,i)+lx(n,r)}class xo extends vt{constructor(e=new W,t=new W,i=new W,r=new W){super(),this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=i,this.v3=r}getPoint(e,t=new W){const i=t,r=this.v0,s=this.v1,o=this.v2,a=this.v3;return i.set(tr(e,r.x,s.x,o.x,a.x),tr(e,r.y,s.y,o.y,a.y)),i}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}xo.prototype.isCubicBezierCurve=!0;class ac extends vt{constructor(e=new w,t=new w,i=new w,r=new w){super(),this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=i,this.v3=r}getPoint(e,t=new w){const i=t,r=this.v0,s=this.v1,o=this.v2,a=this.v3;return i.set(tr(e,r.x,s.x,o.x,a.x),tr(e,r.y,s.y,o.y,a.y),tr(e,r.z,s.z,o.z,a.z)),i}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}ac.prototype.isCubicBezierCurve3=!0;class kr extends vt{constructor(e=new W,t=new W){super(),this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new W){const i=t;return e===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(e).add(this.v1)),i}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t){const i=t||new W;return i.copy(this.v2).sub(this.v1).normalize(),i}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}kr.prototype.isLineCurve=!0;class td extends vt{constructor(e=new w,t=new w){super(),this.type="LineCurve3",this.isLineCurve3=!0,this.v1=e,this.v2=t}getPoint(e,t=new w){const i=t;return e===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(e).add(this.v1)),i}getPointAt(e,t){return this.getPoint(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class vo extends vt{constructor(e=new W,t=new W,i=new W){super(),this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=i}getPoint(e,t=new W){const i=t,r=this.v0,s=this.v1,o=this.v2;return i.set(er(e,r.x,s.x,o.x),er(e,r.y,s.y,o.y)),i}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}vo.prototype.isQuadraticBezierCurve=!0;class cc extends vt{constructor(e=new w,t=new w,i=new w){super(),this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=i}getPoint(e,t=new w){const i=t,r=this.v0,s=this.v1,o=this.v2;return i.set(er(e,r.x,s.x,o.x),er(e,r.y,s.y,o.y),er(e,r.z,s.z,o.z)),i}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}cc.prototype.isQuadraticBezierCurve3=!0;class _o extends vt{constructor(e=[]){super(),this.type="SplineCurve",this.points=e}getPoint(e,t=new W){const i=t,r=this.points,s=(r.length-1)*e,o=Math.floor(s),a=s-o,c=r[o===0?o:o-1],l=r[o],u=r[o>r.length-2?r.length-1:o+1],h=r[o>r.length-3?r.length-1:o+2];return i.set(Tl(a,c.x,l.x,u.x,h.x),Tl(a,c.y,l.y,u.y,h.y)),i}copy(e){super.copy(e),this.points=[];for(let t=0,i=e.points.length;t<i;t++){const r=e.points[t];this.points.push(r.clone())}return this}toJSON(){const e=super.toJSON();e.points=[];for(let t=0,i=this.points.length;t<i;t++){const r=this.points[t];e.points.push(r.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,i=e.points.length;t<i;t++){const r=e.points[t];this.points.push(new W().fromArray(r))}return this}}_o.prototype.isSplineCurve=!0;var Aa=Object.freeze({__proto__:null,ArcCurve:rc,CatmullRomCurve3:oc,CubicBezierCurve:xo,CubicBezierCurve3:ac,EllipseCurve:Gr,LineCurve:kr,LineCurve3:td,QuadraticBezierCurve:vo,QuadraticBezierCurve3:cc,SplineCurve:_o});class nd extends vt{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){const e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);e.equals(t)||this.curves.push(new kr(t,e))}getPoint(e){const t=e*this.getLength(),i=this.getCurveLengths();let r=0;for(;r<i.length;){if(i[r]>=t){const s=i[r]-t,o=this.curves[r],a=o.getLength(),c=a===0?0:1-s/a;return o.getPointAt(c)}r++}return null}getLength(){const e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;const e=[];let t=0;for(let i=0,r=this.curves.length;i<r;i++)t+=this.curves[i].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){const t=[];for(let i=0;i<=e;i++)t.push(this.getPoint(i/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){const t=[];let i;for(let r=0,s=this.curves;r<s.length;r++){const o=s[r],a=o&&o.isEllipseCurve?e*2:o&&(o.isLineCurve||o.isLineCurve3)?1:o&&o.isSplineCurve?e*o.points.length:e,c=o.getPoints(a);for(let l=0;l<c.length;l++){const u=c[l];i&&i.equals(u)||(t.push(u),i=u)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,i=e.curves.length;t<i;t++){const r=e.curves[t];this.curves.push(r.clone())}return this.autoClose=e.autoClose,this}toJSON(){const e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,i=this.curves.length;t<i;t++){const r=this.curves[t];e.curves.push(r.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,i=e.curves.length;t<i;t++){const r=e.curves[t];this.curves.push(new Aa[r.type]().fromJSON(r))}return this}}class Rr extends nd{constructor(e){super(),this.type="Path",this.currentPoint=new W,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,i=e.length;t<i;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){const i=new kr(this.currentPoint.clone(),new W(e,t));return this.curves.push(i),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,i,r){const s=new vo(this.currentPoint.clone(),new W(e,t),new W(i,r));return this.curves.push(s),this.currentPoint.set(i,r),this}bezierCurveTo(e,t,i,r,s,o){const a=new xo(this.currentPoint.clone(),new W(e,t),new W(i,r),new W(s,o));return this.curves.push(a),this.currentPoint.set(s,o),this}splineThru(e){const t=[this.currentPoint.clone()].concat(e),i=new _o(t);return this.curves.push(i),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,i,r,s,o){const a=this.currentPoint.x,c=this.currentPoint.y;return this.absarc(e+a,t+c,i,r,s,o),this}absarc(e,t,i,r,s,o){return this.absellipse(e,t,i,i,r,s,o),this}ellipse(e,t,i,r,s,o,a,c){const l=this.currentPoint.x,u=this.currentPoint.y;return this.absellipse(e+l,t+u,i,r,s,o,a,c),this}absellipse(e,t,i,r,s,o,a,c){const l=new Gr(e,t,i,r,s,o,a,c);if(this.curves.length>0){const h=l.getPoint(0);h.equals(this.currentPoint)||this.lineTo(h.x,h.y)}this.curves.push(l);const u=l.getPoint(1);return this.currentPoint.copy(u),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){const e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}}class mn extends Rr{constructor(e){super(e),this.uuid=me.generateUUID(),this.type="Shape",this.holes=[]}getPointsHoles(e){const t=[];for(let i=0,r=this.holes.length;i<r;i++)t[i]=this.holes[i].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,i=e.holes.length;t<i;t++){const r=e.holes[t];this.holes.push(r.clone())}return this}toJSON(){const e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,i=this.holes.length;t<i;t++){const r=this.holes[t];e.holes.push(r.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,i=e.holes.length;t<i;t++){const r=e.holes[t];this.holes.push(new Rr().fromJSON(r))}return this}}class zt extends de{constructor(e,t=1){super(),this.type="Light",this.color=new re(e),this.intensity=t}copy(e){return super.copy(e),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),t}}zt.prototype.isLight=!0;class lc extends zt{constructor(e,t,i){super(e,i),this.type="HemisphereLight",this.position.copy(de.DefaultUp),this.updateMatrix(),this.groundColor=new re(t)}copy(e){return zt.prototype.copy.call(this,e),this.groundColor.copy(e.groundColor),this}}lc.prototype.isHemisphereLight=!0;const El=new ce,Al=new w,Ll=new w;class hc{constructor(e){this.camera=e,this.bias=0,this.normalBias=0,this.radius=1,this.mapSize=new W(512,512),this.map=null,this.mapPass=null,this.matrix=new ce,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Or,this._frameExtents=new W(1,1),this._viewportCount=1,this._viewports=[new Be(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,i=this.matrix;Al.setFromMatrixPosition(e.matrixWorld),t.position.copy(Al),Ll.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Ll),t.updateMatrixWorld(),El.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(El),i.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),i.multiply(t.projectionMatrix),i.multiply(t.matrixWorldInverse)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}copy(e){return this.camera=e.camera.clone(),this.bias=e.bias,this.radius=e.radius,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}class id extends hc{constructor(){super(new tt(50,1,.5,500)),this.focus=1}updateMatrices(e){const t=this.camera,i=me.RAD2DEG*2*e.angle*this.focus,r=this.mapSize.width/this.mapSize.height,s=e.distance||t.far;(i!==t.fov||r!==t.aspect||s!==t.far)&&(t.fov=i,t.aspect=r,t.far=s,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this}}id.prototype.isSpotLightShadow=!0;class uc extends zt{constructor(e,t,i=0,r=Math.PI/3,s=0,o=1){super(e,t),this.type="SpotLight",this.position.copy(de.DefaultUp),this.updateMatrix(),this.target=new de,this.distance=i,this.angle=r,this.penumbra=s,this.decay=o,this.shadow=new id}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}copy(e){return super.copy(e),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}uc.prototype.isSpotLight=!0;const Rl=new ce,Yi=new w,ea=new w;class rd extends hc{constructor(){super(new tt(90,1,.5,500)),this._frameExtents=new W(4,2),this._viewportCount=6,this._viewports=[new Be(2,1,1,1),new Be(0,1,1,1),new Be(3,1,1,1),new Be(1,1,1,1),new Be(3,0,1,1),new Be(1,0,1,1)],this._cubeDirections=[new w(1,0,0),new w(-1,0,0),new w(0,0,1),new w(0,0,-1),new w(0,1,0),new w(0,-1,0)],this._cubeUps=[new w(0,1,0),new w(0,1,0),new w(0,1,0),new w(0,1,0),new w(0,0,1),new w(0,0,-1)]}updateMatrices(e,t=0){const i=this.camera,r=this.matrix,s=e.distance||i.far;s!==i.far&&(i.far=s,i.updateProjectionMatrix()),Yi.setFromMatrixPosition(e.matrixWorld),i.position.copy(Yi),ea.copy(i.position),ea.add(this._cubeDirections[t]),i.up.copy(this._cubeUps[t]),i.lookAt(ea),i.updateMatrixWorld(),r.makeTranslation(-Yi.x,-Yi.y,-Yi.z),Rl.multiplyMatrices(i.projectionMatrix,i.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Rl)}}rd.prototype.isPointLightShadow=!0;class dc extends zt{constructor(e,t,i=0,r=1){super(e,t),this.type="PointLight",this.distance=i,this.decay=r,this.shadow=new rd}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}copy(e){return super.copy(e),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}}dc.prototype.isPointLight=!0;class Vr extends yn{constructor(e=-1,t=1,i=1,r=-1,s=.1,o=2e3){super(),this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=r,this.near=s,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,i,r,s,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,r=(this.top+this.bottom)/2;let s=i-e,o=i+e,a=r+t,c=r-t;if(this.view!==null&&this.view.enabled){const l=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=l*this.view.offsetX,o=s+l*this.view.width,a-=u*this.view.offsetY,c=a-u*this.view.height}this.projectionMatrix.makeOrthographic(s,o,a,c,this.near,this.far),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=de.prototype.toJSON.call(this,e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}Vr.prototype.isOrthographicCamera=!0;class sd extends hc{constructor(){super(new Vr(-5,5,5,-5,.5,500))}}sd.prototype.isDirectionalLightShadow=!0;class fc extends zt{constructor(e,t){super(e,t),this.type="DirectionalLight",this.position.copy(de.DefaultUp),this.updateMatrix(),this.target=new de,this.shadow=new sd}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}fc.prototype.isDirectionalLight=!0;class pc extends zt{constructor(e,t){super(e,t),this.type="AmbientLight"}}pc.prototype.isAmbientLight=!0;class mc extends zt{constructor(e,t,i=10,r=10){super(e,t),this.type="RectAreaLight",this.width=i,this.height=r}copy(e){return super.copy(e),this.width=e.width,this.height=e.height,this}toJSON(e){const t=super.toJSON(e);return t.object.width=this.width,t.object.height=this.height,t}}mc.prototype.isRectAreaLight=!0;class gc{constructor(){this.coefficients=[];for(let e=0;e<9;e++)this.coefficients.push(new w)}set(e){for(let t=0;t<9;t++)this.coefficients[t].copy(e[t]);return this}zero(){for(let e=0;e<9;e++)this.coefficients[e].set(0,0,0);return this}getAt(e,t){const i=e.x,r=e.y,s=e.z,o=this.coefficients;return t.copy(o[0]).multiplyScalar(.282095),t.addScaledVector(o[1],.488603*r),t.addScaledVector(o[2],.488603*s),t.addScaledVector(o[3],.488603*i),t.addScaledVector(o[4],1.092548*(i*r)),t.addScaledVector(o[5],1.092548*(r*s)),t.addScaledVector(o[6],.315392*(3*s*s-1)),t.addScaledVector(o[7],1.092548*(i*s)),t.addScaledVector(o[8],.546274*(i*i-r*r)),t}getIrradianceAt(e,t){const i=e.x,r=e.y,s=e.z,o=this.coefficients;return t.copy(o[0]).multiplyScalar(.886227),t.addScaledVector(o[1],2*.511664*r),t.addScaledVector(o[2],2*.511664*s),t.addScaledVector(o[3],2*.511664*i),t.addScaledVector(o[4],2*.429043*i*r),t.addScaledVector(o[5],2*.429043*r*s),t.addScaledVector(o[6],.743125*s*s-.247708),t.addScaledVector(o[7],2*.429043*i*s),t.addScaledVector(o[8],.429043*(i*i-r*r)),t}add(e){for(let t=0;t<9;t++)this.coefficients[t].add(e.coefficients[t]);return this}addScaledSH(e,t){for(let i=0;i<9;i++)this.coefficients[i].addScaledVector(e.coefficients[i],t);return this}scale(e){for(let t=0;t<9;t++)this.coefficients[t].multiplyScalar(e);return this}lerp(e,t){for(let i=0;i<9;i++)this.coefficients[i].lerp(e.coefficients[i],t);return this}equals(e){for(let t=0;t<9;t++)if(!this.coefficients[t].equals(e.coefficients[t]))return!1;return!0}copy(e){return this.set(e.coefficients)}clone(){return new this.constructor().copy(this)}fromArray(e,t=0){const i=this.coefficients;for(let r=0;r<9;r++)i[r].fromArray(e,t+r*3);return this}toArray(e=[],t=0){const i=this.coefficients;for(let r=0;r<9;r++)i[r].toArray(e,t+r*3);return e}static getBasisAt(e,t){const i=e.x,r=e.y,s=e.z;t[0]=.282095,t[1]=.488603*r,t[2]=.488603*s,t[3]=.488603*i,t[4]=1.092548*i*r,t[5]=1.092548*r*s,t[6]=.315392*(3*s*s-1),t[7]=1.092548*i*s,t[8]=.546274*(i*i-r*r)}}gc.prototype.isSphericalHarmonics3=!0;class Wr extends zt{constructor(e=new gc,t=1){super(void 0,t),this.sh=e}copy(e){return super.copy(e),this.sh.copy(e.sh),this}fromJSON(e){return this.intensity=e.intensity,this.sh.fromArray(e.sh),this}toJSON(e){const t=super.toJSON(e);return t.object.sh=this.sh.toArray(),t}}Wr.prototype.isLightProbe=!0;class od extends Xe{constructor(e){super(e),this.textures={}}load(e,t,i,r){const s=this,o=new Lt(s.manager);o.setPath(s.path),o.setRequestHeader(s.requestHeader),o.setWithCredentials(s.withCredentials),o.load(e,function(a){try{t(s.parse(JSON.parse(a)))}catch(c){r&&r(c),s.manager.itemError(e)}},i,r)}parse(e){const t=this.textures;function i(s){return t[s],t[s]}const r=new Ky[e.type];if(e.uuid!==void 0&&(r.uuid=e.uuid),e.name!==void 0&&(r.name=e.name),e.color!==void 0&&r.color!==void 0&&r.color.setHex(e.color),e.roughness!==void 0&&(r.roughness=e.roughness),e.metalness!==void 0&&(r.metalness=e.metalness),e.sheen!==void 0&&(r.sheen=new re().setHex(e.sheen)),e.emissive!==void 0&&r.emissive!==void 0&&r.emissive.setHex(e.emissive),e.specular!==void 0&&r.specular!==void 0&&r.specular.setHex(e.specular),e.shininess!==void 0&&(r.shininess=e.shininess),e.clearcoat!==void 0&&(r.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(r.clearcoatRoughness=e.clearcoatRoughness),e.fog!==void 0&&(r.fog=e.fog),e.flatShading!==void 0&&(r.flatShading=e.flatShading),e.blending!==void 0&&(r.blending=e.blending),e.combine!==void 0&&(r.combine=e.combine),e.side!==void 0&&(r.side=e.side),e.shadowSide!==void 0&&(r.shadowSide=e.shadowSide),e.opacity!==void 0&&(r.opacity=e.opacity),e.transparent!==void 0&&(r.transparent=e.transparent),e.alphaTest!==void 0&&(r.alphaTest=e.alphaTest),e.depthTest!==void 0&&(r.depthTest=e.depthTest),e.depthWrite!==void 0&&(r.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(r.colorWrite=e.colorWrite),e.stencilWrite!==void 0&&(r.stencilWrite=e.stencilWrite),e.stencilWriteMask!==void 0&&(r.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(r.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(r.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(r.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(r.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(r.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(r.stencilZPass=e.stencilZPass),e.wireframe!==void 0&&(r.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(r.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(r.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(r.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(r.rotation=e.rotation),e.linewidth!==1&&(r.linewidth=e.linewidth),e.dashSize!==void 0&&(r.dashSize=e.dashSize),e.gapSize!==void 0&&(r.gapSize=e.gapSize),e.scale!==void 0&&(r.scale=e.scale),e.polygonOffset!==void 0&&(r.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(r.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(r.polygonOffsetUnits=e.polygonOffsetUnits),e.skinning!==void 0&&(r.skinning=e.skinning),e.morphTargets!==void 0&&(r.morphTargets=e.morphTargets),e.morphNormals!==void 0&&(r.morphNormals=e.morphNormals),e.dithering!==void 0&&(r.dithering=e.dithering),e.alphaToCoverage!==void 0&&(r.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(r.premultipliedAlpha=e.premultipliedAlpha),e.vertexTangents!==void 0&&(r.vertexTangents=e.vertexTangents),e.visible!==void 0&&(r.visible=e.visible),e.toneMapped!==void 0&&(r.toneMapped=e.toneMapped),e.userData!==void 0&&(r.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?r.vertexColors=e.vertexColors>0:r.vertexColors=e.vertexColors),e.uniforms!==void 0)for(const s in e.uniforms){const o=e.uniforms[s];switch(r.uniforms[s]={},o.type){case"t":r.uniforms[s].value=i(o.value);break;case"c":r.uniforms[s].value=new re().setHex(o.value);break;case"v2":r.uniforms[s].value=new W().fromArray(o.value);break;case"v3":r.uniforms[s].value=new w().fromArray(o.value);break;case"v4":r.uniforms[s].value=new Be().fromArray(o.value);break;case"m3":r.uniforms[s].value=new rt().fromArray(o.value);break;case"m4":r.uniforms[s].value=new ce().fromArray(o.value);break;default:r.uniforms[s].value=o.value}}if(e.defines!==void 0&&(r.defines=e.defines),e.vertexShader!==void 0&&(r.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(r.fragmentShader=e.fragmentShader),e.extensions!==void 0)for(const s in e.extensions)r.extensions[s]=e.extensions[s];if(e.shading!==void 0&&(r.flatShading=e.shading===1),e.size!==void 0&&(r.size=e.size),e.sizeAttenuation!==void 0&&(r.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(r.map=i(e.map)),e.matcap!==void 0&&(r.matcap=i(e.matcap)),e.alphaMap!==void 0&&(r.alphaMap=i(e.alphaMap)),e.bumpMap!==void 0&&(r.bumpMap=i(e.bumpMap)),e.bumpScale!==void 0&&(r.bumpScale=e.bumpScale),e.normalMap!==void 0&&(r.normalMap=i(e.normalMap)),e.normalMapType!==void 0&&(r.normalMapType=e.normalMapType),e.normalScale!==void 0){let s=e.normalScale;Array.isArray(s)===!1&&(s=[s,s]),r.normalScale=new W().fromArray(s)}return e.displacementMap!==void 0&&(r.displacementMap=i(e.displacementMap)),e.displacementScale!==void 0&&(r.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(r.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(r.roughnessMap=i(e.roughnessMap)),e.metalnessMap!==void 0&&(r.metalnessMap=i(e.metalnessMap)),e.emissiveMap!==void 0&&(r.emissiveMap=i(e.emissiveMap)),e.emissiveIntensity!==void 0&&(r.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(r.specularMap=i(e.specularMap)),e.envMap!==void 0&&(r.envMap=i(e.envMap)),e.envMapIntensity!==void 0&&(r.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(r.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(r.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(r.lightMap=i(e.lightMap)),e.lightMapIntensity!==void 0&&(r.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(r.aoMap=i(e.aoMap)),e.aoMapIntensity!==void 0&&(r.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(r.gradientMap=i(e.gradientMap)),e.clearcoatMap!==void 0&&(r.clearcoatMap=i(e.clearcoatMap)),e.clearcoatRoughnessMap!==void 0&&(r.clearcoatRoughnessMap=i(e.clearcoatRoughnessMap)),e.clearcoatNormalMap!==void 0&&(r.clearcoatNormalMap=i(e.clearcoatNormalMap)),e.clearcoatNormalScale!==void 0&&(r.clearcoatNormalScale=new W().fromArray(e.clearcoatNormalScale)),e.transmission!==void 0&&(r.transmission=e.transmission),e.transmissionMap!==void 0&&(r.transmissionMap=i(e.transmissionMap)),r}setTextures(e){return this.textures=e,this}}const yc={decodeText:function(n){if(typeof TextDecoder<"u")return new TextDecoder().decode(n);let e="";for(let t=0,i=n.length;t<i;t++)e+=String.fromCharCode(n[t]);try{return decodeURIComponent(escape(e))}catch{return e}},extractUrlBase:function(n){const e=n.lastIndexOf("/");return e===-1?"./":n.substr(0,e+1)}};function Cr(){le.call(this),this.type="InstancedBufferGeometry",this.instanceCount=1/0}Cr.prototype=Object.assign(Object.create(le.prototype),{constructor:Cr,isInstancedBufferGeometry:!0,copy:function(n){return le.prototype.copy.call(this,n),this.instanceCount=n.instanceCount,this},clone:function(){return new this.constructor().copy(this)},toJSON:function(){const n=le.prototype.toJSON.call(this);return n.instanceCount=this.instanceCount,n.isInstancedBufferGeometry=!0,n}});function no(n,e,t,i){typeof t=="number"&&(i=t,t=!1),fe.call(this,n,e,t),this.meshPerAttribute=i||1}no.prototype=Object.assign(Object.create(fe.prototype),{constructor:no,isInstancedBufferAttribute:!0,copy:function(n){return fe.prototype.copy.call(this,n),this.meshPerAttribute=n.meshPerAttribute,this},toJSON:function(){const n=fe.prototype.toJSON.call(this);return n.meshPerAttribute=this.meshPerAttribute,n.isInstancedBufferAttribute=!0,n}});class ad extends Xe{constructor(e){super(e)}load(e,t,i,r){const s=this,o=new Lt(s.manager);o.setPath(s.path),o.setRequestHeader(s.requestHeader),o.setWithCredentials(s.withCredentials),o.load(e,function(a){try{t(s.parse(JSON.parse(a)))}catch(c){r&&r(c),s.manager.itemError(e)}},i,r)}parse(e){const t={},i={};function r(f,p){if(t[p]!==void 0)return t[p];const x=f.interleavedBuffers[p],g=s(f,x.buffer),m=Ji(x.type,g),b=new bt(m,x.stride);return b.uuid=x.uuid,t[p]=b,b}function s(f,p){if(i[p]!==void 0)return i[p];const x=f.arrayBuffers[p],g=new Uint32Array(x).buffer;return i[p]=g,g}const o=e.isInstancedBufferGeometry?new Cr:new le,a=e.data.index;if(a!==void 0){const f=Ji(a.type,a.array);o.setIndex(new fe(f,1))}const c=e.data.attributes;for(const f in c){const p=c[f];let y;if(p.isInterleavedBufferAttribute){const x=r(e.data,p.data);y=new xn(x,p.itemSize,p.offset,p.normalized)}else{const x=Ji(p.type,p.array),g=p.isInstancedBufferAttribute?no:fe;y=new g(x,p.itemSize,p.normalized)}p.name!==void 0&&(y.name=p.name),p.usage!==void 0&&y.setUsage(p.usage),p.updateRange!==void 0&&(y.updateRange.offset=p.updateRange.offset,y.updateRange.count=p.updateRange.count),o.setAttribute(f,y)}const l=e.data.morphAttributes;if(l)for(const f in l){const p=l[f],y=[];for(let x=0,g=p.length;x<g;x++){const m=p[x];let b;if(m.isInterleavedBufferAttribute){const _=r(e.data,m.data);b=new xn(_,m.itemSize,m.offset,m.normalized)}else{const _=Ji(m.type,m.array);b=new fe(_,m.itemSize,m.normalized)}m.name!==void 0&&(b.name=m.name),y.push(b)}o.morphAttributes[f]=y}e.data.morphTargetsRelative&&(o.morphTargetsRelative=!0);const h=e.data.groups||e.data.drawcalls||e.data.offsets;if(h!==void 0)for(let f=0,p=h.length;f!==p;++f){const y=h[f];o.addGroup(y.start,y.count,y.materialIndex)}const d=e.data.boundingSphere;if(d!==void 0){const f=new w;d.center!==void 0&&f.fromArray(d.center),o.boundingSphere=new wn(f,d.radius)}return e.name&&(o.name=e.name),e.userData&&(o.userData=e.userData),o}}class hx extends Xe{constructor(e){super(e)}load(e,t,i,r){const s=this,o=this.path===""?yc.extractUrlBase(e):this.path;this.resourcePath=this.resourcePath||o;const a=new Lt(this.manager);a.setPath(this.path),a.setRequestHeader(this.requestHeader),a.setWithCredentials(this.withCredentials),a.load(e,function(c){let l=null;try{l=JSON.parse(c)}catch(h){r!==void 0&&r(h);return}const u=l.metadata;u===void 0||u.type===void 0||u.type.toLowerCase()==="geometry"||s.parse(l,t)},i,r)}parse(e,t){const i=this.parseAnimations(e.animations),r=this.parseShapes(e.shapes),s=this.parseGeometries(e.geometries,r),o=this.parseImages(e.images,function(){t!==void 0&&t(l)}),a=this.parseTextures(e.textures,o),c=this.parseMaterials(e.materials,a),l=this.parseObject(e.object,s,c,i),u=this.parseSkeletons(e.skeletons,l);if(this.bindSkeletons(l,u),t!==void 0){let h=!1;for(const d in o)if(o[d]instanceof HTMLImageElement){h=!0;break}h===!1&&t(l)}return l}parseShapes(e){const t={};if(e!==void 0)for(let i=0,r=e.length;i<r;i++){const s=new mn().fromJSON(e[i]);t[s.uuid]=s}return t}parseSkeletons(e,t){const i={},r={};if(t.traverse(function(s){s.isBone&&(r[s.uuid]=s)}),e!==void 0)for(let s=0,o=e.length;s<o;s++){const a=new mo().fromJSON(e[s],r);i[a.uuid]=a}return i}parseGeometries(e,t){const i={};let r;if(e!==void 0){const s=new ad;for(let o=0,a=e.length;o<a;o++){let c;const l=e[o];switch(l.type){case"PlaneGeometry":case"PlaneBufferGeometry":c=new pt[l.type](l.width,l.height,l.widthSegments,l.heightSegments);break;case"BoxGeometry":case"BoxBufferGeometry":c=new pt[l.type](l.width,l.height,l.depth,l.widthSegments,l.heightSegments,l.depthSegments);break;case"CircleGeometry":case"CircleBufferGeometry":c=new pt[l.type](l.radius,l.segments,l.thetaStart,l.thetaLength);break;case"CylinderGeometry":case"CylinderBufferGeometry":c=new pt[l.type](l.radiusTop,l.radiusBottom,l.height,l.radialSegments,l.heightSegments,l.openEnded,l.thetaStart,l.thetaLength);break;case"ConeGeometry":case"ConeBufferGeometry":c=new pt[l.type](l.radius,l.height,l.radialSegments,l.heightSegments,l.openEnded,l.thetaStart,l.thetaLength);break;case"SphereGeometry":case"SphereBufferGeometry":c=new pt[l.type](l.radius,l.widthSegments,l.heightSegments,l.phiStart,l.phiLength,l.thetaStart,l.thetaLength);break;case"DodecahedronGeometry":case"DodecahedronBufferGeometry":case"IcosahedronGeometry":case"IcosahedronBufferGeometry":case"OctahedronGeometry":case"OctahedronBufferGeometry":case"TetrahedronGeometry":case"TetrahedronBufferGeometry":c=new pt[l.type](l.radius,l.detail);break;case"RingGeometry":case"RingBufferGeometry":c=new pt[l.type](l.innerRadius,l.outerRadius,l.thetaSegments,l.phiSegments,l.thetaStart,l.thetaLength);break;case"TorusGeometry":case"TorusBufferGeometry":c=new pt[l.type](l.radius,l.tube,l.radialSegments,l.tubularSegments,l.arc);break;case"TorusKnotGeometry":case"TorusKnotBufferGeometry":c=new pt[l.type](l.radius,l.tube,l.tubularSegments,l.radialSegments,l.p,l.q);break;case"TubeGeometry":case"TubeBufferGeometry":c=new pt[l.type](new Aa[l.path.type]().fromJSON(l.path),l.tubularSegments,l.radius,l.radialSegments,l.closed);break;case"LatheGeometry":case"LatheBufferGeometry":c=new pt[l.type](l.points,l.segments,l.phiStart,l.phiLength);break;case"PolyhedronGeometry":case"PolyhedronBufferGeometry":c=new pt[l.type](l.vertices,l.indices,l.radius,l.details);break;case"ShapeGeometry":case"ShapeBufferGeometry":r=[];for(let h=0,d=l.shapes.length;h<d;h++){const f=t[l.shapes[h]];r.push(f)}c=new pt[l.type](r,l.curveSegments);break;case"ExtrudeGeometry":case"ExtrudeBufferGeometry":r=[];for(let h=0,d=l.shapes.length;h<d;h++){const f=t[l.shapes[h]];r.push(f)}const u=l.options.extrudePath;u!==void 0&&(l.options.extrudePath=new Aa[u.type]().fromJSON(u)),c=new pt[l.type](r,l.options);break;case"BufferGeometry":case"InstancedBufferGeometry":c=s.parse(l);break;case"Geometry":break;default:continue}c.uuid=l.uuid,l.name!==void 0&&(c.name=l.name),c.isBufferGeometry===!0&&l.userData!==void 0&&(c.userData=l.userData),i[l.uuid]=c}}return i}parseMaterials(e,t){const i={},r={};if(e!==void 0){const s=new od;s.setTextures(t);for(let o=0,a=e.length;o<a;o++){const c=e[o];if(c.type==="MultiMaterial"){const l=[];for(let u=0;u<c.materials.length;u++){const h=c.materials[u];i[h.uuid]===void 0&&(i[h.uuid]=s.parse(h)),l.push(i[h.uuid])}r[c.uuid]=l}else i[c.uuid]===void 0&&(i[c.uuid]=s.parse(c)),r[c.uuid]=i[c.uuid]}}return r}parseAnimations(e){const t={};if(e!==void 0)for(let i=0;i<e.length;i++){const r=e[i],s=Lr.parse(r);t[s.uuid]=s}return t}parseImages(e,t){const i=this,r={};let s;function o(c){return i.manager.itemStart(c),s.load(c,function(){i.manager.itemEnd(c)},void 0,function(){i.manager.itemError(c),i.manager.itemEnd(c)})}function a(c){if(typeof c=="string"){const l=c,u=/^(\/\/)|([a-z]+:(\/\/)?)/i.test(l)?l:i.resourcePath+l;return o(u)}else return c.data?{data:Ji(c.type,c.data),width:c.width,height:c.height}:null}if(e!==void 0&&e.length>0){const c=new ic(t);s=new yo(c),s.setCrossOrigin(this.crossOrigin);for(let l=0,u=e.length;l<u;l++){const h=e[l],d=h.url;if(Array.isArray(d)){r[h.uuid]=[];for(let f=0,p=d.length;f<p;f++){const y=d[f],x=a(y);x!==null&&(x instanceof HTMLImageElement?r[h.uuid].push(x):r[h.uuid].push(new Ti(x.data,x.width,x.height)))}}else{const f=a(h.url);f!==null&&(r[h.uuid]=f)}}}return r}parseTextures(e,t){function i(s,o){return typeof s=="number"?s:o[s]}const r={};if(e!==void 0)for(let s=0,o=e.length;s<o;s++){const a=e[s];a.image,t[a.image];let c;const l=t[a.image];Array.isArray(l)?(c=new Di(l),l.length===6&&(c.needsUpdate=!0)):(l&&l.data?c=new Ti(l.data,l.width,l.height):c=new st(l),l&&(c.needsUpdate=!0)),c.uuid=a.uuid,a.name!==void 0&&(c.name=a.name),a.mapping!==void 0&&(c.mapping=i(a.mapping,ux)),a.offset!==void 0&&c.offset.fromArray(a.offset),a.repeat!==void 0&&c.repeat.fromArray(a.repeat),a.center!==void 0&&c.center.fromArray(a.center),a.rotation!==void 0&&(c.rotation=a.rotation),a.wrap!==void 0&&(c.wrapS=i(a.wrap[0],Cl),c.wrapT=i(a.wrap[1],Cl)),a.format!==void 0&&(c.format=a.format),a.type!==void 0&&(c.type=a.type),a.encoding!==void 0&&(c.encoding=a.encoding),a.minFilter!==void 0&&(c.minFilter=i(a.minFilter,Pl)),a.magFilter!==void 0&&(c.magFilter=i(a.magFilter,Pl)),a.anisotropy!==void 0&&(c.anisotropy=a.anisotropy),a.flipY!==void 0&&(c.flipY=a.flipY),a.premultiplyAlpha!==void 0&&(c.premultiplyAlpha=a.premultiplyAlpha),a.unpackAlignment!==void 0&&(c.unpackAlignment=a.unpackAlignment),r[a.uuid]=c}return r}parseObject(e,t,i,r){let s;function o(u){return t[u],t[u]}function a(u){if(u!==void 0){if(Array.isArray(u)){const h=[];for(let d=0,f=u.length;d<f;d++){const p=u[d];i[p],h.push(i[p])}return h}return i[u],i[u]}}let c,l;switch(e.type){case"Scene":s=new uo,e.background!==void 0&&Number.isInteger(e.background)&&(s.background=new re(e.background)),e.fog!==void 0&&(e.fog.type==="Fog"?s.fog=new Hr(e.fog.color,e.fog.near,e.fog.far):e.fog.type==="FogExp2"&&(s.fog=new Ur(e.fog.color,e.fog.density)));break;case"PerspectiveCamera":s=new tt(e.fov,e.aspect,e.near,e.far),e.focus!==void 0&&(s.focus=e.focus),e.zoom!==void 0&&(s.zoom=e.zoom),e.filmGauge!==void 0&&(s.filmGauge=e.filmGauge),e.filmOffset!==void 0&&(s.filmOffset=e.filmOffset),e.view!==void 0&&(s.view=Object.assign({},e.view));break;case"OrthographicCamera":s=new Vr(e.left,e.right,e.top,e.bottom,e.near,e.far),e.zoom!==void 0&&(s.zoom=e.zoom),e.view!==void 0&&(s.view=Object.assign({},e.view));break;case"AmbientLight":s=new pc(e.color,e.intensity);break;case"DirectionalLight":s=new fc(e.color,e.intensity);break;case"PointLight":s=new dc(e.color,e.intensity,e.distance,e.decay);break;case"RectAreaLight":s=new mc(e.color,e.intensity,e.width,e.height);break;case"SpotLight":s=new uc(e.color,e.intensity,e.distance,e.angle,e.penumbra,e.decay);break;case"HemisphereLight":s=new lc(e.color,e.groundColor,e.intensity);break;case"LightProbe":s=new Wr().fromJSON(e);break;case"SkinnedMesh":c=o(e.geometry),l=a(e.material),s=new yr(c,l),e.bindMode!==void 0&&(s.bindMode=e.bindMode),e.bindMatrix!==void 0&&s.bindMatrix.fromArray(e.bindMatrix),e.skeleton!==void 0&&(s.skeleton=e.skeleton);break;case"Mesh":c=o(e.geometry),l=a(e.material),s=new Ge(c,l);break;case"InstancedMesh":c=o(e.geometry),l=a(e.material);const u=e.count,h=e.instanceMatrix,d=e.instanceColor;s=new Us(c,l,u),s.instanceMatrix=new fe(new Float32Array(h.array),16),d!==void 0&&(s.instanceColor=new fe(new Float32Array(d.array),d.itemSize));break;case"LOD":s=new Xu;break;case"Line":s=new Nt(o(e.geometry),a(e.material));break;case"LineLoop":s=new qa(o(e.geometry),a(e.material));break;case"LineSegments":s=new xt(o(e.geometry),a(e.material));break;case"PointCloud":case"Points":s=new Ei(o(e.geometry),a(e.material));break;case"Sprite":s=new po(a(e.material));break;case"Group":s=new Un;break;case"Bone":s=new xr;break;default:s=new de}if(s.uuid=e.uuid,e.name!==void 0&&(s.name=e.name),e.matrix!==void 0?(s.matrix.fromArray(e.matrix),e.matrixAutoUpdate!==void 0&&(s.matrixAutoUpdate=e.matrixAutoUpdate),s.matrixAutoUpdate&&s.matrix.decompose(s.position,s.quaternion,s.scale)):(e.position!==void 0&&s.position.fromArray(e.position),e.rotation!==void 0&&s.rotation.fromArray(e.rotation),e.quaternion!==void 0&&s.quaternion.fromArray(e.quaternion),e.scale!==void 0&&s.scale.fromArray(e.scale)),e.castShadow!==void 0&&(s.castShadow=e.castShadow),e.receiveShadow!==void 0&&(s.receiveShadow=e.receiveShadow),e.shadow&&(e.shadow.bias!==void 0&&(s.shadow.bias=e.shadow.bias),e.shadow.normalBias!==void 0&&(s.shadow.normalBias=e.shadow.normalBias),e.shadow.radius!==void 0&&(s.shadow.radius=e.shadow.radius),e.shadow.mapSize!==void 0&&s.shadow.mapSize.fromArray(e.shadow.mapSize),e.shadow.camera!==void 0&&(s.shadow.camera=this.parseObject(e.shadow.camera))),e.visible!==void 0&&(s.visible=e.visible),e.frustumCulled!==void 0&&(s.frustumCulled=e.frustumCulled),e.renderOrder!==void 0&&(s.renderOrder=e.renderOrder),e.userData!==void 0&&(s.userData=e.userData),e.layers!==void 0&&(s.layers.mask=e.layers),e.children!==void 0){const u=e.children;for(let h=0;h<u.length;h++)s.add(this.parseObject(u[h],t,i,r))}if(e.animations!==void 0){const u=e.animations;for(let h=0;h<u.length;h++){const d=u[h];s.animations.push(r[d])}}if(e.type==="LOD"){e.autoUpdate!==void 0&&(s.autoUpdate=e.autoUpdate);const u=e.levels;for(let h=0;h<u.length;h++){const d=u[h],f=s.getObjectByProperty("uuid",d.object);f!==void 0&&s.addLevel(f,d.distance)}}return s}bindSkeletons(e,t){Object.keys(t).length!==0&&e.traverse(function(i){if(i.isSkinnedMesh===!0&&i.skeleton!==void 0){const r=t[i.skeleton];r===void 0||i.bind(r,i.bindMatrix)}})}setTexturePath(e){return this.setResourcePath(e)}}const ux={UVMapping:io,CubeReflectionMapping:Fr,CubeRefractionMapping:Br,EquirectangularReflectionMapping:Bs,EquirectangularRefractionMapping:Ns,CubeUVReflectionMapping:Ri,CubeUVRefractionMapping:Nr},Cl={RepeatWrapping:nr,ClampToEdgeWrapping:mt,MirroredRepeatWrapping:ir},Pl={NearestFilter:nt,NearestMipmapNearestFilter:zs,NearestMipmapLinearFilter:Os,LinearFilter:it,LinearMipmapNearestFilter:Na,LinearMipmapLinearFilter:Ci};function La(n){Xe.call(this,n),this.options={premultiplyAlpha:"none"}}La.prototype=Object.assign(Object.create(Xe.prototype),{constructor:La,isImageBitmapLoader:!0,setOptions:function(e){return this.options=e,this},load:function(n,e,t,i){n===void 0&&(n=""),this.path!==void 0&&(n=this.path+n),n=this.manager.resolveURL(n);const r=this,s=Yn.get(n);if(s!==void 0)return r.manager.itemStart(n),setTimeout(function(){e&&e(s),r.manager.itemEnd(n)},0),s;const o={};o.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",o.headers=this.requestHeader,fetch(n,o).then(function(a){return a.blob()}).then(function(a){return createImageBitmap(a,Object.assign(r.options,{colorSpaceConversion:"none"}))}).then(function(a){Yn.add(n,a),e&&e(a),r.manager.itemEnd(n)}).catch(function(a){i&&i(a),r.manager.itemError(n),r.manager.itemEnd(n)}),r.manager.itemStart(n)}});class cd{constructor(){this.type="ShapePath",this.color=new re,this.subPaths=[],this.currentPath=null}moveTo(e,t){return this.currentPath=new Rr,this.subPaths.push(this.currentPath),this.currentPath.moveTo(e,t),this}lineTo(e,t){return this.currentPath.lineTo(e,t),this}quadraticCurveTo(e,t,i,r){return this.currentPath.quadraticCurveTo(e,t,i,r),this}bezierCurveTo(e,t,i,r,s,o){return this.currentPath.bezierCurveTo(e,t,i,r,s,o),this}splineThru(e){return this.currentPath.splineThru(e),this}toShapes(e,t){function i(m){const b=[];for(let _=0,T=m.length;_<T;_++){const v=m[_],A=new mn;A.curves=v.curves,b.push(A)}return b}function r(m,b){const _=b.length;let T=!1;for(let v=_-1,A=0;A<_;v=A++){let L=b[v],R=b[A],z=R.x-L.x,P=R.y-L.y;if(Math.abs(P)>Number.EPSILON){if(P<0&&(L=b[A],z=-z,R=b[v],P=-P),m.y<L.y||m.y>R.y)continue;if(m.y===L.y){if(m.x===L.x)return!0}else{const U=P*(m.x-L.x)-z*(m.y-L.y);if(U===0)return!0;if(U<0)continue;T=!T}}else{if(m.y!==L.y)continue;if(R.x<=m.x&&m.x<=L.x||L.x<=m.x&&m.x<=R.x)return!0}}return T}const s=en.isClockWise,o=this.subPaths;if(o.length===0)return[];if(t===!0)return i(o);let a,c,l;const u=[];if(o.length===1)return c=o[0],l=new mn,l.curves=c.curves,u.push(l),u;let h=!s(o[0].getPoints());h=e?!h:h;const d=[],f=[];let p=[],y=0,x;f[y]=void 0,p[y]=[];for(let m=0,b=o.length;m<b;m++)c=o[m],x=c.getPoints(),a=s(x),a=e?!a:a,a?(!h&&f[y]&&y++,f[y]={s:new mn,p:x},f[y].s.curves=c.curves,h&&y++,p[y]=[]):p[y].push({h:c,p:x[0]});if(!f[0])return i(o);if(f.length>1){let m=!1;const b=[];for(let _=0,T=f.length;_<T;_++)d[_]=[];for(let _=0,T=f.length;_<T;_++){const v=p[_];for(let A=0;A<v.length;A++){const L=v[A];let R=!0;for(let z=0;z<f.length;z++)r(L.p,f[z].p)&&(_!==z&&b.push({froms:_,tos:z,hole:A}),R?(R=!1,d[z].push(L)):m=!0);R&&d[_].push(L)}}b.length>0&&(m||(p=d))}let g;for(let m=0,b=f.length;m<b;m++){l=f[m].s,u.push(l),g=p[m];for(let _=0,T=g.length;_<T;_++)l.holes.push(g[_].h)}return u}}class xc{constructor(e){this.type="Font",this.data=e}generateShapes(e,t=100){const i=[],r=dx(e,t,this.data);for(let s=0,o=r.length;s<o;s++)Array.prototype.push.apply(i,r[s].toShapes());return i}}function dx(n,e,t){const i=Array.from(n),r=e/t.resolution,s=(t.boundingBox.yMax-t.boundingBox.yMin+t.underlineThickness)*r,o=[];let a=0,c=0;for(let l=0;l<i.length;l++){const u=i[l];if(u===`
`)a=0,c-=s;else{const h=fx(u,r,a,c,t);a+=h.offsetX,o.push(h.path)}}return o}function fx(n,e,t,i,r){const s=r.glyphs[n]||r.glyphs["?"];if(!s)return;const o=new cd;let a,c,l,u,h,d,f,p;if(s.o){const y=s._cachedOutline||(s._cachedOutline=s.o.split(" "));for(let x=0,g=y.length;x<g;)switch(y[x++]){case"m":a=y[x++]*e+t,c=y[x++]*e+i,o.moveTo(a,c);break;case"l":a=y[x++]*e+t,c=y[x++]*e+i,o.lineTo(a,c);break;case"q":l=y[x++]*e+t,u=y[x++]*e+i,h=y[x++]*e+t,d=y[x++]*e+i,o.quadraticCurveTo(h,d,l,u);break;case"b":l=y[x++]*e+t,u=y[x++]*e+i,h=y[x++]*e+t,d=y[x++]*e+i,f=y[x++]*e+t,p=y[x++]*e+i,o.bezierCurveTo(h,d,f,p,l,u);break}}return{offsetX:s.ha*e,path:o}}xc.prototype.isFont=!0;class px extends Xe{constructor(e){super(e)}load(e,t,i,r){const s=this,o=new Lt(this.manager);o.setPath(this.path),o.setRequestHeader(this.requestHeader),o.setWithCredentials(s.withCredentials),o.load(e,function(a){let c;try{c=JSON.parse(a)}catch{c=JSON.parse(a.substring(65,a.length-2))}const l=s.parse(c);t&&t(l)},i,r)}parse(e){return new xc(e)}}let Ms;const vc={getContext:function(){return Ms===void 0&&(Ms=new(window.AudioContext||window.webkitAudioContext)),Ms},setContext:function(n){Ms=n}};class ld extends Xe{constructor(e){super(e)}load(e,t,i,r){const s=this,o=new Lt(this.manager);o.setResponseType("arraybuffer"),o.setPath(this.path),o.setRequestHeader(this.requestHeader),o.setWithCredentials(this.withCredentials),o.load(e,function(a){try{const c=a.slice(0);vc.getContext().decodeAudioData(c,function(u){t(u)})}catch(c){r&&r(c),s.manager.itemError(e)}},i,r)}}class hd extends Wr{constructor(e,t,i=1){super(void 0,i);const r=new re().set(e),s=new re().set(t),o=new w(r.r,r.g,r.b),a=new w(s.r,s.g,s.b),c=Math.sqrt(Math.PI),l=c*Math.sqrt(.75);this.sh.coefficients[0].copy(o).add(a).multiplyScalar(c),this.sh.coefficients[1].copy(o).sub(a).multiplyScalar(l)}}hd.prototype.isHemisphereLightProbe=!0;class ud extends Wr{constructor(e,t=1){super(void 0,t);const i=new re().set(e);this.sh.coefficients[0].set(i.r,i.g,i.b).multiplyScalar(2*Math.sqrt(Math.PI))}}ud.prototype.isAmbientLightProbe=!0;const Il=new ce,Dl=new ce;class mx{constructor(){this.type="StereoCamera",this.aspect=1,this.eyeSep=.064,this.cameraL=new tt,this.cameraL.layers.enable(1),this.cameraL.matrixAutoUpdate=!1,this.cameraR=new tt,this.cameraR.layers.enable(2),this.cameraR.matrixAutoUpdate=!1,this._cache={focus:null,fov:null,aspect:null,near:null,far:null,zoom:null,eyeSep:null}}update(e){const t=this._cache;if(t.focus!==e.focus||t.fov!==e.fov||t.aspect!==e.aspect*this.aspect||t.near!==e.near||t.far!==e.far||t.zoom!==e.zoom||t.eyeSep!==this.eyeSep){t.focus=e.focus,t.fov=e.fov,t.aspect=e.aspect*this.aspect,t.near=e.near,t.far=e.far,t.zoom=e.zoom,t.eyeSep=this.eyeSep;const r=e.projectionMatrix.clone(),s=t.eyeSep/2,o=s*t.near/t.focus,a=t.near*Math.tan(me.DEG2RAD*t.fov*.5)/t.zoom;let c,l;Dl.elements[12]=-s,Il.elements[12]=s,c=-a*t.aspect+o,l=a*t.aspect+o,r.elements[0]=2*t.near/(l-c),r.elements[8]=(l+c)/(l-c),this.cameraL.projectionMatrix.copy(r),c=-a*t.aspect-o,l=a*t.aspect-o,r.elements[0]=2*t.near/(l-c),r.elements[8]=(l+c)/(l-c),this.cameraR.projectionMatrix.copy(r)}this.cameraL.matrixWorld.copy(e.matrixWorld).multiply(Dl),this.cameraR.matrixWorld.copy(e.matrixWorld).multiply(Il)}}class dd{constructor(e){this.autoStart=e!==void 0?e:!0,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1}start(){this.startTime=Fl(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let e=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){const t=Fl();e=(t-this.oldTime)/1e3,this.oldTime=t,this.elapsedTime+=e}return e}}function Fl(){return(typeof performance>"u"?Date:performance).now()}const Cn=new w,Bl=new at,gx=new w,Pn=new w;class yx extends de{constructor(){super(),this.type="AudioListener",this.context=vc.getContext(),this.gain=this.context.createGain(),this.gain.connect(this.context.destination),this.filter=null,this.timeDelta=0,this._clock=new dd}getInput(){return this.gain}removeFilter(){return this.filter!==null&&(this.gain.disconnect(this.filter),this.filter.disconnect(this.context.destination),this.gain.connect(this.context.destination),this.filter=null),this}getFilter(){return this.filter}setFilter(e){return this.filter!==null?(this.gain.disconnect(this.filter),this.filter.disconnect(this.context.destination)):this.gain.disconnect(this.context.destination),this.filter=e,this.gain.connect(this.filter),this.filter.connect(this.context.destination),this}getMasterVolume(){return this.gain.gain.value}setMasterVolume(e){return this.gain.gain.setTargetAtTime(e,this.context.currentTime,.01),this}updateMatrixWorld(e){super.updateMatrixWorld(e);const t=this.context.listener,i=this.up;if(this.timeDelta=this._clock.getDelta(),this.matrixWorld.decompose(Cn,Bl,gx),Pn.set(0,0,-1).applyQuaternion(Bl),t.positionX){const r=this.context.currentTime+this.timeDelta;t.positionX.linearRampToValueAtTime(Cn.x,r),t.positionY.linearRampToValueAtTime(Cn.y,r),t.positionZ.linearRampToValueAtTime(Cn.z,r),t.forwardX.linearRampToValueAtTime(Pn.x,r),t.forwardY.linearRampToValueAtTime(Pn.y,r),t.forwardZ.linearRampToValueAtTime(Pn.z,r),t.upX.linearRampToValueAtTime(i.x,r),t.upY.linearRampToValueAtTime(i.y,r),t.upZ.linearRampToValueAtTime(i.z,r)}else t.setPosition(Cn.x,Cn.y,Cn.z),t.setOrientation(Pn.x,Pn.y,Pn.z,i.x,i.y,i.z)}}class _c extends de{constructor(e){super(),this.type="Audio",this.listener=e,this.context=e.context,this.gain=this.context.createGain(),this.gain.connect(e.getInput()),this.autoplay=!1,this.buffer=null,this.detune=0,this.loop=!1,this.loopStart=0,this.loopEnd=0,this.offset=0,this.duration=void 0,this.playbackRate=1,this.isPlaying=!1,this.hasPlaybackControl=!0,this.source=null,this.sourceType="empty",this._startedAt=0,this._progress=0,this._connected=!1,this.filters=[]}getOutput(){return this.gain}setNodeSource(e){return this.hasPlaybackControl=!1,this.sourceType="audioNode",this.source=e,this.connect(),this}setMediaElementSource(e){return this.hasPlaybackControl=!1,this.sourceType="mediaNode",this.source=this.context.createMediaElementSource(e),this.connect(),this}setMediaStreamSource(e){return this.hasPlaybackControl=!1,this.sourceType="mediaStreamNode",this.source=this.context.createMediaStreamSource(e),this.connect(),this}setBuffer(e){return this.buffer=e,this.sourceType="buffer",this.autoplay&&this.play(),this}play(e=0){if(this.isPlaying===!0||this.hasPlaybackControl===!1)return;this._startedAt=this.context.currentTime+e;const t=this.context.createBufferSource();return t.buffer=this.buffer,t.loop=this.loop,t.loopStart=this.loopStart,t.loopEnd=this.loopEnd,t.onended=this.onEnded.bind(this),t.start(this._startedAt,this._progress+this.offset,this.duration),this.isPlaying=!0,this.source=t,this.setDetune(this.detune),this.setPlaybackRate(this.playbackRate),this.connect()}pause(){if(this.hasPlaybackControl!==!1)return this.isPlaying===!0&&(this._progress+=Math.max(this.context.currentTime-this._startedAt,0)*this.playbackRate,this.loop===!0&&(this._progress=this._progress%(this.duration||this.buffer.duration)),this.source.stop(),this.source.onended=null,this.isPlaying=!1),this}stop(){if(this.hasPlaybackControl!==!1)return this._progress=0,this.source.stop(),this.source.onended=null,this.isPlaying=!1,this}connect(){if(this.filters.length>0){this.source.connect(this.filters[0]);for(let e=1,t=this.filters.length;e<t;e++)this.filters[e-1].connect(this.filters[e]);this.filters[this.filters.length-1].connect(this.getOutput())}else this.source.connect(this.getOutput());return this._connected=!0,this}disconnect(){if(this.filters.length>0){this.source.disconnect(this.filters[0]);for(let e=1,t=this.filters.length;e<t;e++)this.filters[e-1].disconnect(this.filters[e]);this.filters[this.filters.length-1].disconnect(this.getOutput())}else this.source.disconnect(this.getOutput());return this._connected=!1,this}getFilters(){return this.filters}setFilters(e){return e||(e=[]),this._connected===!0?(this.disconnect(),this.filters=e.slice(),this.connect()):this.filters=e.slice(),this}setDetune(e){if(this.detune=e,this.source.detune!==void 0)return this.isPlaying===!0&&this.source.detune.setTargetAtTime(this.detune,this.context.currentTime,.01),this}getDetune(){return this.detune}getFilter(){return this.getFilters()[0]}setFilter(e){return this.setFilters(e?[e]:[])}setPlaybackRate(e){if(this.hasPlaybackControl!==!1)return this.playbackRate=e,this.isPlaying===!0&&this.source.playbackRate.setTargetAtTime(this.playbackRate,this.context.currentTime,.01),this}getPlaybackRate(){return this.playbackRate}onEnded(){this.isPlaying=!1}getLoop(){return this.hasPlaybackControl===!1?!1:this.loop}setLoop(e){if(this.hasPlaybackControl!==!1)return this.loop=e,this.isPlaying===!0&&(this.source.loop=this.loop),this}setLoopStart(e){return this.loopStart=e,this}setLoopEnd(e){return this.loopEnd=e,this}getVolume(){return this.gain.gain.value}setVolume(e){return this.gain.gain.setTargetAtTime(e,this.context.currentTime,.01),this}}const In=new w,Nl=new at,xx=new w,Dn=new w;class vx extends _c{constructor(e){super(e),this.panner=this.context.createPanner(),this.panner.panningModel="HRTF",this.panner.connect(this.gain)}getOutput(){return this.panner}getRefDistance(){return this.panner.refDistance}setRefDistance(e){return this.panner.refDistance=e,this}getRolloffFactor(){return this.panner.rolloffFactor}setRolloffFactor(e){return this.panner.rolloffFactor=e,this}getDistanceModel(){return this.panner.distanceModel}setDistanceModel(e){return this.panner.distanceModel=e,this}getMaxDistance(){return this.panner.maxDistance}setMaxDistance(e){return this.panner.maxDistance=e,this}setDirectionalCone(e,t,i){return this.panner.coneInnerAngle=e,this.panner.coneOuterAngle=t,this.panner.coneOuterGain=i,this}updateMatrixWorld(e){if(super.updateMatrixWorld(e),this.hasPlaybackControl===!0&&this.isPlaying===!1)return;this.matrixWorld.decompose(In,Nl,xx),Dn.set(0,0,1).applyQuaternion(Nl);const t=this.panner;if(t.positionX){const i=this.context.currentTime+this.listener.timeDelta;t.positionX.linearRampToValueAtTime(In.x,i),t.positionY.linearRampToValueAtTime(In.y,i),t.positionZ.linearRampToValueAtTime(In.z,i),t.orientationX.linearRampToValueAtTime(Dn.x,i),t.orientationY.linearRampToValueAtTime(Dn.y,i),t.orientationZ.linearRampToValueAtTime(Dn.z,i)}else t.setPosition(In.x,In.y,In.z),t.setOrientation(Dn.x,Dn.y,Dn.z)}}class fd{constructor(e,t=2048){this.analyser=e.context.createAnalyser(),this.analyser.fftSize=t,this.data=new Uint8Array(this.analyser.frequencyBinCount),e.getOutput().connect(this.analyser)}getFrequencyData(){return this.analyser.getByteFrequencyData(this.data),this.data}getAverageFrequency(){let e=0;const t=this.getFrequencyData();for(let i=0;i<t.length;i++)e+=t[i];return e/t.length}}class pd{constructor(e,t,i){this.binding=e,this.valueSize=i;let r,s,o;switch(t){case"quaternion":r=this._slerp,s=this._slerpAdditive,o=this._setAdditiveIdentityQuaternion,this.buffer=new Float64Array(i*6),this._workIndex=5;break;case"string":case"bool":r=this._select,s=this._select,o=this._setAdditiveIdentityOther,this.buffer=new Array(i*5);break;default:r=this._lerp,s=this._lerpAdditive,o=this._setAdditiveIdentityNumeric,this.buffer=new Float64Array(i*5)}this._mixBufferRegion=r,this._mixBufferRegionAdditive=s,this._setIdentity=o,this._origIndex=3,this._addIndex=4,this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,this.useCount=0,this.referenceCount=0}accumulate(e,t){const i=this.buffer,r=this.valueSize,s=e*r+r;let o=this.cumulativeWeight;if(o===0){for(let a=0;a!==r;++a)i[s+a]=i[a];o=t}else{o+=t;const a=t/o;this._mixBufferRegion(i,s,0,a,r)}this.cumulativeWeight=o}accumulateAdditive(e){const t=this.buffer,i=this.valueSize,r=i*this._addIndex;this.cumulativeWeightAdditive===0&&this._setIdentity(),this._mixBufferRegionAdditive(t,r,0,e,i),this.cumulativeWeightAdditive+=e}apply(e){const t=this.valueSize,i=this.buffer,r=e*t+t,s=this.cumulativeWeight,o=this.cumulativeWeightAdditive,a=this.binding;if(this.cumulativeWeight=0,this.cumulativeWeightAdditive=0,s<1){const c=t*this._origIndex;this._mixBufferRegion(i,r,c,1-s,t)}o>0&&this._mixBufferRegionAdditive(i,r,this._addIndex*t,1,t);for(let c=t,l=t+t;c!==l;++c)if(i[c]!==i[c+t]){a.setValue(i,r);break}}saveOriginalState(){const e=this.binding,t=this.buffer,i=this.valueSize,r=i*this._origIndex;e.getValue(t,r);for(let s=i,o=r;s!==o;++s)t[s]=t[r+s%i];this._setIdentity(),this.cumulativeWeight=0,this.cumulativeWeightAdditive=0}restoreOriginalState(){const e=this.valueSize*3;this.binding.setValue(this.buffer,e)}_setAdditiveIdentityNumeric(){const e=this._addIndex*this.valueSize,t=e+this.valueSize;for(let i=e;i<t;i++)this.buffer[i]=0}_setAdditiveIdentityQuaternion(){this._setAdditiveIdentityNumeric(),this.buffer[this._addIndex*this.valueSize+3]=1}_setAdditiveIdentityOther(){const e=this._origIndex*this.valueSize,t=this._addIndex*this.valueSize;for(let i=0;i<this.valueSize;i++)this.buffer[t+i]=this.buffer[e+i]}_select(e,t,i,r,s){if(r>=.5)for(let o=0;o!==s;++o)e[t+o]=e[i+o]}_slerp(e,t,i,r){at.slerpFlat(e,t,e,t,e,i,r)}_slerpAdditive(e,t,i,r,s){const o=this._workIndex*s;at.multiplyQuaternionsFlat(e,o,e,t,e,i),at.slerpFlat(e,t,e,t,e,o,r)}_lerp(e,t,i,r,s){const o=1-r;for(let a=0;a!==s;++a){const c=t+a;e[c]=e[c]*o+e[i+a]*r}}_lerpAdditive(e,t,i,r,s){for(let o=0;o!==s;++o){const a=t+o;e[a]=e[a]+e[i+o]*r}}}const bc="\\[\\]\\.:\\/",_x=new RegExp("["+bc+"]","g"),wc="[^"+bc+"]",bx="[^"+bc.replace("\\.","")+"]",wx=/((?:WC+[\/:])*)/.source.replace("WC",wc),Mx=/(WCOD+)?/.source.replace("WCOD",bx),Sx=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",wc),Tx=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",wc),Ex=new RegExp("^"+wx+Mx+Sx+Tx+"$"),Ax=["material","materials","bones"];function md(n,e,t){const i=t||ut.parseTrackName(e);this._targetGroup=n,this._bindings=n.subscribe_(e,i)}Object.assign(md.prototype,{getValue:function(n,e){this.bind();const t=this._targetGroup.nCachedObjects_,i=this._bindings[t];i!==void 0&&i.getValue(n,e)},setValue:function(n,e){const t=this._bindings;for(let i=this._targetGroup.nCachedObjects_,r=t.length;i!==r;++i)t[i].setValue(n,e)},bind:function(){const n=this._bindings;for(let e=this._targetGroup.nCachedObjects_,t=n.length;e!==t;++e)n[e].bind()},unbind:function(){const n=this._bindings;for(let e=this._targetGroup.nCachedObjects_,t=n.length;e!==t;++e)n[e].unbind()}});function ut(n,e,t){this.path=e,this.parsedPath=t||ut.parseTrackName(e),this.node=ut.findNode(n,this.parsedPath.nodeName)||n,this.rootNode=n}Object.assign(ut,{Composite:md,create:function(n,e,t){return n&&n.isAnimationObjectGroup?new ut.Composite(n,e,t):new ut(n,e,t)},sanitizeNodeName:function(n){return n.replace(/\s/g,"_").replace(_x,"")},parseTrackName:function(n){const e=Ex.exec(n);if(!e)throw new Error("PropertyBinding: Cannot parse trackName: "+n);const t={nodeName:e[2],objectName:e[3],objectIndex:e[4],propertyName:e[5],propertyIndex:e[6]},i=t.nodeName&&t.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){const r=t.nodeName.substring(i+1);Ax.indexOf(r)!==-1&&(t.nodeName=t.nodeName.substring(0,i),t.objectName=r)}if(t.propertyName===null||t.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+n);return t},findNode:function(n,e){if(!e||e===""||e==="."||e===-1||e===n.name||e===n.uuid)return n;if(n.skeleton){const t=n.skeleton.getBoneByName(e);if(t!==void 0)return t}if(n.children){const t=function(r){for(let s=0;s<r.length;s++){const o=r[s];if(o.name===e||o.uuid===e)return o;const a=t(o.children);if(a)return a}return null},i=t(n.children);if(i)return i}return null}});Object.assign(ut.prototype,{_getValue_unavailable:function(){},_setValue_unavailable:function(){},BindingType:{Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3},Versioning:{None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2},GetterByBindingType:[function(e,t){e[t]=this.node[this.propertyName]},function(e,t){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)e[t++]=i[r]},function(e,t){e[t]=this.resolvedProperty[this.propertyIndex]},function(e,t){this.resolvedProperty.toArray(e,t)}],SetterByBindingTypeAndVersioning:[[function(e,t){this.targetObject[this.propertyName]=e[t]},function(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0},function(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}],[function(e,t){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++]},function(e,t){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.needsUpdate=!0},function(e,t){const i=this.resolvedProperty;for(let r=0,s=i.length;r!==s;++r)i[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}],[function(e,t){this.resolvedProperty[this.propertyIndex]=e[t]},function(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0},function(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}],[function(e,t){this.resolvedProperty.fromArray(e,t)},function(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0},function(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}]],getValue:function(e,t){this.bind(),this.getValue(e,t)},setValue:function(e,t){this.bind(),this.setValue(e,t)},bind:function(){let n=this.node;const e=this.parsedPath,t=e.objectName,i=e.propertyName;let r=e.propertyIndex;if(n||(n=ut.findNode(this.rootNode,e.nodeName)||this.rootNode,this.node=n),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!n)return;if(t){let c=e.objectIndex;switch(t){case"materials":if(!n.material||!n.material.materials)return;n=n.material.materials;break;case"bones":if(!n.skeleton)return;n=n.skeleton.bones;for(let l=0;l<n.length;l++)if(n[l].name===c){c=l;break}break;default:if(n[t]===void 0)return;n=n[t]}if(c!==void 0){if(n[c]===void 0)return;n=n[c]}}const s=n[i];if(s===void 0){const c=e.nodeName;return}let o=this.Versioning.None;this.targetObject=n,n.needsUpdate!==void 0?o=this.Versioning.NeedsUpdate:n.matrixWorldNeedsUpdate!==void 0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let a=this.BindingType.Direct;if(r!==void 0){if(i==="morphTargetInfluences"){if(!n.geometry)return;if(n.geometry.isBufferGeometry){if(!n.geometry.morphAttributes)return;n.morphTargetDictionary[r]!==void 0&&(r=n.morphTargetDictionary[r])}else return}a=this.BindingType.ArrayElement,this.resolvedProperty=s,this.propertyIndex=r}else s.fromArray!==void 0&&s.toArray!==void 0?(a=this.BindingType.HasFromToArray,this.resolvedProperty=s):Array.isArray(s)?(a=this.BindingType.EntireArray,this.resolvedProperty=s):this.propertyName=i;this.getValue=this.GetterByBindingType[a],this.setValue=this.SetterByBindingTypeAndVersioning[a][o]},unbind:function(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}});Object.assign(ut.prototype,{_getValue_unbound:ut.prototype.getValue,_setValue_unbound:ut.prototype.setValue});class gd{constructor(){this.uuid=me.generateUUID(),this._objects=Array.prototype.slice.call(arguments),this.nCachedObjects_=0;const e={};this._indicesByUUID=e;for(let i=0,r=arguments.length;i!==r;++i)e[arguments[i].uuid]=i;this._paths=[],this._parsedPaths=[],this._bindings=[],this._bindingsIndicesByPath={};const t=this;this.stats={objects:{get total(){return t._objects.length},get inUse(){return this.total-t.nCachedObjects_}},get bindingsPerObject(){return t._bindings.length}}}add(){const e=this._objects,t=this._indicesByUUID,i=this._paths,r=this._parsedPaths,s=this._bindings,o=s.length;let a,c=e.length,l=this.nCachedObjects_;for(let u=0,h=arguments.length;u!==h;++u){const d=arguments[u],f=d.uuid;let p=t[f];if(p===void 0){p=c++,t[f]=p,e.push(d);for(let y=0,x=o;y!==x;++y)s[y].push(new ut(d,i[y],r[y]))}else if(p<l){a=e[p];const y=--l,x=e[y];t[x.uuid]=p,e[p]=x,t[f]=y,e[y]=d;for(let g=0,m=o;g!==m;++g){const b=s[g],_=b[y];let T=b[p];b[p]=_,T===void 0&&(T=new ut(d,i[g],r[g])),b[y]=T}}else e[p]}this.nCachedObjects_=l}remove(){const e=this._objects,t=this._indicesByUUID,i=this._bindings,r=i.length;let s=this.nCachedObjects_;for(let o=0,a=arguments.length;o!==a;++o){const c=arguments[o],l=c.uuid,u=t[l];if(u!==void 0&&u>=s){const h=s++,d=e[h];t[d.uuid]=u,e[u]=d,t[l]=h,e[h]=c;for(let f=0,p=r;f!==p;++f){const y=i[f],x=y[h],g=y[u];y[u]=x,y[h]=g}}}this.nCachedObjects_=s}uncache(){const e=this._objects,t=this._indicesByUUID,i=this._bindings,r=i.length;let s=this.nCachedObjects_,o=e.length;for(let a=0,c=arguments.length;a!==c;++a){const l=arguments[a],u=l.uuid,h=t[u];if(h!==void 0)if(delete t[u],h<s){const d=--s,f=e[d],p=--o,y=e[p];t[f.uuid]=h,e[h]=f,t[y.uuid]=d,e[d]=y,e.pop();for(let x=0,g=r;x!==g;++x){const m=i[x],b=m[d],_=m[p];m[h]=b,m[d]=_,m.pop()}}else{const d=--o,f=e[d];d>0&&(t[f.uuid]=h),e[h]=f,e.pop();for(let p=0,y=r;p!==y;++p){const x=i[p];x[h]=x[d],x.pop()}}}this.nCachedObjects_=s}subscribe_(e,t){const i=this._bindingsIndicesByPath;let r=i[e];const s=this._bindings;if(r!==void 0)return s[r];const o=this._paths,a=this._parsedPaths,c=this._objects,l=c.length,u=this.nCachedObjects_,h=new Array(l);r=s.length,i[e]=r,o.push(e),a.push(t),s.push(h);for(let d=u,f=c.length;d!==f;++d){const p=c[d];h[d]=new ut(p,e,t)}return h}unsubscribe_(e){const t=this._bindingsIndicesByPath,i=t[e];if(i!==void 0){const r=this._paths,s=this._parsedPaths,o=this._bindings,a=o.length-1,c=o[a],l=e[a];t[l]=i,o[i]=c,o.pop(),s[i]=s[a],s.pop(),r[i]=r[a],r.pop()}}}gd.prototype.isAnimationObjectGroup=!0;class Lx{constructor(e,t,i=null,r=t.blendMode){this._mixer=e,this._clip=t,this._localRoot=i,this.blendMode=r;const s=t.tracks,o=s.length,a=new Array(o),c={endingStart:zn,endingEnd:zn};for(let l=0;l!==o;++l){const u=s[l].createInterpolant(null);a[l]=u,u.settings=c}this._interpolantSettings=c,this._interpolants=a,this._propertyBindings=new Array(o),this._cacheIndex=null,this._byClipCacheIndex=null,this._timeScaleInterpolant=null,this._weightInterpolant=null,this.loop=bu,this._loopCount=-1,this._startTime=null,this.time=0,this.timeScale=1,this._effectiveTimeScale=1,this.weight=1,this._effectiveWeight=1,this.repetitions=1/0,this.paused=!1,this.enabled=!0,this.clampWhenFinished=!1,this.zeroSlopeAtStart=!0,this.zeroSlopeAtEnd=!0}play(){return this._mixer._activateAction(this),this}stop(){return this._mixer._deactivateAction(this),this.reset()}reset(){return this.paused=!1,this.enabled=!0,this.time=0,this._loopCount=-1,this._startTime=null,this.stopFading().stopWarping()}isRunning(){return this.enabled&&!this.paused&&this.timeScale!==0&&this._startTime===null&&this._mixer._isActiveAction(this)}isScheduled(){return this._mixer._isActiveAction(this)}startAt(e){return this._startTime=e,this}setLoop(e,t){return this.loop=e,this.repetitions=t,this}setEffectiveWeight(e){return this.weight=e,this._effectiveWeight=this.enabled?e:0,this.stopFading()}getEffectiveWeight(){return this._effectiveWeight}fadeIn(e){return this._scheduleFading(e,0,1)}fadeOut(e){return this._scheduleFading(e,1,0)}crossFadeFrom(e,t,i){if(e.fadeOut(t),this.fadeIn(t),i){const r=this._clip.duration,s=e._clip.duration,o=s/r,a=r/s;e.warp(1,o,t),this.warp(a,1,t)}return this}crossFadeTo(e,t,i){return e.crossFadeFrom(this,t,i)}stopFading(){const e=this._weightInterpolant;return e!==null&&(this._weightInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}setEffectiveTimeScale(e){return this.timeScale=e,this._effectiveTimeScale=this.paused?0:e,this.stopWarping()}getEffectiveTimeScale(){return this._effectiveTimeScale}setDuration(e){return this.timeScale=this._clip.duration/e,this.stopWarping()}syncWith(e){return this.time=e.time,this.timeScale=e.timeScale,this.stopWarping()}halt(e){return this.warp(this._effectiveTimeScale,0,e)}warp(e,t,i){const r=this._mixer,s=r.time,o=this.timeScale;let a=this._timeScaleInterpolant;a===null&&(a=r._lendControlInterpolant(),this._timeScaleInterpolant=a);const c=a.parameterPositions,l=a.sampleValues;return c[0]=s,c[1]=s+i,l[0]=e/o,l[1]=t/o,this}stopWarping(){const e=this._timeScaleInterpolant;return e!==null&&(this._timeScaleInterpolant=null,this._mixer._takeBackControlInterpolant(e)),this}getMixer(){return this._mixer}getClip(){return this._clip}getRoot(){return this._localRoot||this._mixer._root}_update(e,t,i,r){if(!this.enabled){this._updateWeight(e);return}const s=this._startTime;if(s!==null){const c=(e-s)*i;if(c<0||i===0)return;this._startTime=null,t=i*c}t*=this._updateTimeScale(e);const o=this._updateTime(t),a=this._updateWeight(e);if(a>0){const c=this._interpolants,l=this._propertyBindings;switch(this.blendMode){case za:for(let u=0,h=c.length;u!==h;++u)c[u].evaluate(o),l[u].accumulateAdditive(a);break;case ro:default:for(let u=0,h=c.length;u!==h;++u)c[u].evaluate(o),l[u].accumulate(r,a)}}}_updateWeight(e){let t=0;if(this.enabled){t=this.weight;const i=this._weightInterpolant;if(i!==null){const r=i.evaluate(e)[0];t*=r,e>i.parameterPositions[1]&&(this.stopFading(),r===0&&(this.enabled=!1))}}return this._effectiveWeight=t,t}_updateTimeScale(e){let t=0;if(!this.paused){t=this.timeScale;const i=this._timeScaleInterpolant;if(i!==null){const r=i.evaluate(e)[0];t*=r,e>i.parameterPositions[1]&&(this.stopWarping(),t===0?this.paused=!0:this.timeScale=t)}}return this._effectiveTimeScale=t,t}_updateTime(e){const t=this._clip.duration,i=this.loop;let r=this.time+e,s=this._loopCount;const o=i===wu;if(e===0)return s===-1?r:o&&(s&1)===1?t-r:r;if(i===_u){s===-1&&(this._loopCount=0,this._setEndings(!0,!0,!1));e:{if(r>=t)r=t;else if(r<0)r=0;else{this.time=r;break e}this.clampWhenFinished?this.paused=!0:this.enabled=!1,this.time=r,this._mixer.dispatchEvent({type:"finished",action:this,direction:e<0?-1:1})}}else{if(s===-1&&(e>=0?(s=0,this._setEndings(!0,this.repetitions===0,o)):this._setEndings(this.repetitions===0,!0,o)),r>=t||r<0){const a=Math.floor(r/t);r-=t*a,s+=Math.abs(a);const c=this.repetitions-s;if(c<=0)this.clampWhenFinished?this.paused=!0:this.enabled=!1,r=e>0?t:0,this.time=r,this._mixer.dispatchEvent({type:"finished",action:this,direction:e>0?1:-1});else{if(c===1){const l=e<0;this._setEndings(l,!l,o)}else this._setEndings(!1,!1,o);this._loopCount=s,this.time=r,this._mixer.dispatchEvent({type:"loop",action:this,loopDelta:a})}}else this.time=r;if(o&&(s&1)===1)return t-r}return r}_setEndings(e,t,i){const r=this._interpolantSettings;i?(r.endingStart=On,r.endingEnd=On):(e?r.endingStart=this.zeroSlopeAtStart?On:zn:r.endingStart=cr,t?r.endingEnd=this.zeroSlopeAtEnd?On:zn:r.endingEnd=cr)}_scheduleFading(e,t,i){const r=this._mixer,s=r.time;let o=this._weightInterpolant;o===null&&(o=r._lendControlInterpolant(),this._weightInterpolant=o);const a=o.parameterPositions,c=o.sampleValues;return a[0]=s,c[0]=t,a[1]=s+e,c[1]=i,this}}class yd extends nn{constructor(e){super(),this._root=e,this._initMemoryManager(),this._accuIndex=0,this.time=0,this.timeScale=1}_bindAction(e,t){const i=e._localRoot||this._root,r=e._clip.tracks,s=r.length,o=e._propertyBindings,a=e._interpolants,c=i.uuid,l=this._bindingsByRootAndName;let u=l[c];u===void 0&&(u={},l[c]=u);for(let h=0;h!==s;++h){const d=r[h],f=d.name;let p=u[f];if(p!==void 0)o[h]=p;else{if(p=o[h],p!==void 0){p._cacheIndex===null&&(++p.referenceCount,this._addInactiveBinding(p,c,f));continue}const y=t&&t._propertyBindings[h].binding.parsedPath;p=new pd(ut.create(i,f,y),d.ValueTypeName,d.getValueSize()),++p.referenceCount,this._addInactiveBinding(p,c,f),o[h]=p}a[h].resultBuffer=p.buffer}}_activateAction(e){if(!this._isActiveAction(e)){if(e._cacheIndex===null){const i=(e._localRoot||this._root).uuid,r=e._clip.uuid,s=this._actionsByClip[r];this._bindAction(e,s&&s.knownActions[0]),this._addInactiveAction(e,r,i)}const t=e._propertyBindings;for(let i=0,r=t.length;i!==r;++i){const s=t[i];s.useCount++===0&&(this._lendBinding(s),s.saveOriginalState())}this._lendAction(e)}}_deactivateAction(e){if(this._isActiveAction(e)){const t=e._propertyBindings;for(let i=0,r=t.length;i!==r;++i){const s=t[i];--s.useCount===0&&(s.restoreOriginalState(),this._takeBackBinding(s))}this._takeBackAction(e)}}_initMemoryManager(){this._actions=[],this._nActiveActions=0,this._actionsByClip={},this._bindings=[],this._nActiveBindings=0,this._bindingsByRootAndName={},this._controlInterpolants=[],this._nActiveControlInterpolants=0;const e=this;this.stats={actions:{get total(){return e._actions.length},get inUse(){return e._nActiveActions}},bindings:{get total(){return e._bindings.length},get inUse(){return e._nActiveBindings}},controlInterpolants:{get total(){return e._controlInterpolants.length},get inUse(){return e._nActiveControlInterpolants}}}}_isActiveAction(e){const t=e._cacheIndex;return t!==null&&t<this._nActiveActions}_addInactiveAction(e,t,i){const r=this._actions,s=this._actionsByClip;let o=s[t];if(o===void 0)o={knownActions:[e],actionByRoot:{}},e._byClipCacheIndex=0,s[t]=o;else{const a=o.knownActions;e._byClipCacheIndex=a.length,a.push(e)}e._cacheIndex=r.length,r.push(e),o.actionByRoot[i]=e}_removeInactiveAction(e){const t=this._actions,i=t[t.length-1],r=e._cacheIndex;i._cacheIndex=r,t[r]=i,t.pop(),e._cacheIndex=null;const s=e._clip.uuid,o=this._actionsByClip,a=o[s],c=a.knownActions,l=c[c.length-1],u=e._byClipCacheIndex;l._byClipCacheIndex=u,c[u]=l,c.pop(),e._byClipCacheIndex=null;const h=a.actionByRoot,d=(e._localRoot||this._root).uuid;delete h[d],c.length===0&&delete o[s],this._removeInactiveBindingsForAction(e)}_removeInactiveBindingsForAction(e){const t=e._propertyBindings;for(let i=0,r=t.length;i!==r;++i){const s=t[i];--s.referenceCount===0&&this._removeInactiveBinding(s)}}_lendAction(e){const t=this._actions,i=e._cacheIndex,r=this._nActiveActions++,s=t[r];e._cacheIndex=r,t[r]=e,s._cacheIndex=i,t[i]=s}_takeBackAction(e){const t=this._actions,i=e._cacheIndex,r=--this._nActiveActions,s=t[r];e._cacheIndex=r,t[r]=e,s._cacheIndex=i,t[i]=s}_addInactiveBinding(e,t,i){const r=this._bindingsByRootAndName,s=this._bindings;let o=r[t];o===void 0&&(o={},r[t]=o),o[i]=e,e._cacheIndex=s.length,s.push(e)}_removeInactiveBinding(e){const t=this._bindings,i=e.binding,r=i.rootNode.uuid,s=i.path,o=this._bindingsByRootAndName,a=o[r],c=t[t.length-1],l=e._cacheIndex;c._cacheIndex=l,t[l]=c,t.pop(),delete a[s],Object.keys(a).length===0&&delete o[r]}_lendBinding(e){const t=this._bindings,i=e._cacheIndex,r=this._nActiveBindings++,s=t[r];e._cacheIndex=r,t[r]=e,s._cacheIndex=i,t[i]=s}_takeBackBinding(e){const t=this._bindings,i=e._cacheIndex,r=--this._nActiveBindings,s=t[r];e._cacheIndex=r,t[r]=e,s._cacheIndex=i,t[i]=s}_lendControlInterpolant(){const e=this._controlInterpolants,t=this._nActiveControlInterpolants++;let i=e[t];return i===void 0&&(i=new Tr(new Float32Array(2),new Float32Array(2),1,this._controlInterpolantsResultBuffer),i.__cacheIndex=t,e[t]=i),i}_takeBackControlInterpolant(e){const t=this._controlInterpolants,i=e.__cacheIndex,r=--this._nActiveControlInterpolants,s=t[r];e.__cacheIndex=r,t[r]=e,s.__cacheIndex=i,t[i]=s}clipAction(e,t,i){const r=t||this._root,s=r.uuid;let o=typeof e=="string"?Lr.findByName(r,e):e;const a=o!==null?o.uuid:e,c=this._actionsByClip[a];let l=null;if(i===void 0&&(o!==null?i=o.blendMode:i=ro),c!==void 0){const h=c.actionByRoot[s];if(h!==void 0&&h.blendMode===i)return h;l=c.knownActions[0],o===null&&(o=l._clip)}if(o===null)return null;const u=new Lx(this,o,t,i);return this._bindAction(u,l),this._addInactiveAction(u,a,s),u}existingAction(e,t){const i=t||this._root,r=i.uuid,s=typeof e=="string"?Lr.findByName(i,e):e,o=s?s.uuid:e,a=this._actionsByClip[o];return a!==void 0&&a.actionByRoot[r]||null}stopAllAction(){const e=this._actions,t=this._nActiveActions;for(let i=t-1;i>=0;--i)e[i].stop();return this}update(e){e*=this.timeScale;const t=this._actions,i=this._nActiveActions,r=this.time+=e,s=Math.sign(e),o=this._accuIndex^=1;for(let l=0;l!==i;++l)t[l]._update(r,e,s,o);const a=this._bindings,c=this._nActiveBindings;for(let l=0;l!==c;++l)a[l].apply(o);return this}setTime(e){this.time=0;for(let t=0;t<this._actions.length;t++)this._actions[t].time=0;return this.update(e)}getRoot(){return this._root}uncacheClip(e){const t=this._actions,i=e.uuid,r=this._actionsByClip,s=r[i];if(s!==void 0){const o=s.knownActions;for(let a=0,c=o.length;a!==c;++a){const l=o[a];this._deactivateAction(l);const u=l._cacheIndex,h=t[t.length-1];l._cacheIndex=null,l._byClipCacheIndex=null,h._cacheIndex=u,t[u]=h,t.pop(),this._removeInactiveBindingsForAction(l)}delete r[i]}}uncacheRoot(e){const t=e.uuid,i=this._actionsByClip;for(const o in i){const a=i[o].actionByRoot,c=a[t];c!==void 0&&(this._deactivateAction(c),this._removeInactiveAction(c))}const r=this._bindingsByRootAndName,s=r[t];if(s!==void 0)for(const o in s){const a=s[o];a.restoreOriginalState(),this._removeInactiveBinding(a)}}uncacheAction(e,t){const i=this.existingAction(e,t);i!==null&&(this._deactivateAction(i),this._removeInactiveAction(i))}}yd.prototype._controlInterpolantsResultBuffer=new Float32Array(1);class bo{constructor(e){typeof e=="string"&&(e=arguments[1]),this.value=e}clone(){return new bo(this.value.clone===void 0?this.value:this.value.clone())}}function Ra(n,e,t){bt.call(this,n,e),this.meshPerAttribute=t||1}Ra.prototype=Object.assign(Object.create(bt.prototype),{constructor:Ra,isInstancedInterleavedBuffer:!0,copy:function(n){return bt.prototype.copy.call(this,n),this.meshPerAttribute=n.meshPerAttribute,this},clone:function(n){const e=bt.prototype.clone.call(this,n);return e.meshPerAttribute=this.meshPerAttribute,e},toJSON:function(n){const e=bt.prototype.toJSON.call(this,n);return e.isInstancedInterleavedBuffer=!0,e.meshPerAttribute=this.meshPerAttribute,e}});function Mc(n,e,t,i,r){this.buffer=n,this.type=e,this.itemSize=t,this.elementSize=i,this.count=r,this.version=0}Object.defineProperty(Mc.prototype,"needsUpdate",{set:function(n){n===!0&&this.version++}});Object.assign(Mc.prototype,{isGLBufferAttribute:!0,setBuffer:function(n){return this.buffer=n,this},setType:function(n,e){return this.type=n,this.elementSize=e,this},setItemSize:function(n){return this.itemSize=n,this},setCount:function(n){return this.count=n,this}});function Sc(n,e,t=0,i=1/0){this.ray=new Mn(n,e),this.near=t,this.far=i,this.camera=null,this.layers=new Ga,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}},Object.defineProperties(this.params,{PointCloud:{get:function(){return this.Points}}})}function zl(n,e){return n.distance-e.distance}function Ca(n,e,t,i){if(n.layers.test(e.layers)&&n.raycast(e,t),i===!0){const r=n.children;for(let s=0,o=r.length;s<o;s++)Ca(r[s],e,t,!0)}}Object.assign(Sc.prototype,{set:function(n,e){this.ray.set(n,e)},setFromCamera:function(n,e){e&&e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(n.x,n.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e&&e.isOrthographicCamera&&(this.ray.origin.set(n.x,n.y,(e.near+e.far)/(e.near-e.far)).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e)},intersectObject:function(n,e=!1,t=[]){return Ca(n,this,t,e),t.sort(zl),t},intersectObjects:function(n,e=!1,t=[]){for(let i=0,r=n.length;i<r;i++)Ca(n[i],this,t,e);return t.sort(zl),t}});class Rx{constructor(e=1,t=0,i=0){return this.radius=e,this.phi=t,this.theta=i,this}set(e,t,i){return this.radius=e,this.phi=t,this.theta=i,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=Math.max(1e-6,Math.min(Math.PI-1e-6,this.phi)),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,i){return this.radius=Math.sqrt(e*e+t*t+i*i),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,i),this.phi=Math.acos(me.clamp(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}}class Cx{constructor(e=1,t=0,i=0){return this.radius=e,this.theta=t,this.y=i,this}set(e,t,i){return this.radius=e,this.theta=t,this.y=i,this}copy(e){return this.radius=e.radius,this.theta=e.theta,this.y=e.y,this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,i){return this.radius=Math.sqrt(e*e+i*i),this.theta=Math.atan2(e,i),this.y=t,this}clone(){return new this.constructor().copy(this)}}const Ol=new W;class zi{constructor(e=new W(1/0,1/0),t=new W(-1/0,-1/0)){this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const i=Ol.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=1/0,this.max.x=this.max.y=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y}getCenter(e){return e===void 0&&(e=new W),this.isEmpty()?e.set(0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return e===void 0&&(e=new W),this.isEmpty()?e.set(0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}containsPoint(e){return!(e.x<this.min.x||e.x>this.max.x||e.y<this.min.y||e.y>this.max.y)}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y}getParameter(e,t){return t===void 0&&(t=new W),t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y))}intersectsBox(e){return!(e.max.x<this.min.x||e.min.x>this.max.x||e.max.y<this.min.y||e.min.y>this.max.y)}clampPoint(e,t){return t===void 0&&(t=new W),t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return Ol.copy(e).clamp(this.min,this.max).sub(e).length()}intersect(e){return this.min.max(e.min),this.max.min(e.max),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}}zi.prototype.isBox2=!0;const Ul=new w,Ss=new w;class xd{constructor(e=new w,t=new w){this.start=e,this.end=t}set(e,t){return this.start.copy(e),this.end.copy(t),this}copy(e){return this.start.copy(e.start),this.end.copy(e.end),this}getCenter(e){return e===void 0&&(e=new w),e.addVectors(this.start,this.end).multiplyScalar(.5)}delta(e){return e===void 0&&(e=new w),e.subVectors(this.end,this.start)}distanceSq(){return this.start.distanceToSquared(this.end)}distance(){return this.start.distanceTo(this.end)}at(e,t){return t===void 0&&(t=new w),this.delta(t).multiplyScalar(e).add(this.start)}closestPointToPointParameter(e,t){Ul.subVectors(e,this.start),Ss.subVectors(this.end,this.start);const i=Ss.dot(Ss);let s=Ss.dot(Ul)/i;return t&&(s=me.clamp(s,0,1)),s}closestPointToPoint(e,t,i){const r=this.closestPointToPointParameter(e,t);return i===void 0&&(i=new w),this.delta(i).multiplyScalar(r).add(this.start)}applyMatrix4(e){return this.start.applyMatrix4(e),this.end.applyMatrix4(e),this}equals(e){return e.start.equals(this.start)&&e.end.equals(this.end)}clone(){return new this.constructor().copy(this)}}function Pr(n){de.call(this),this.material=n,this.render=function(){},this.hasPositions=!1,this.hasNormals=!1,this.hasColors=!1,this.hasUvs=!1,this.positionArray=null,this.normalArray=null,this.colorArray=null,this.uvArray=null,this.count=0}Pr.prototype=Object.create(de.prototype);Pr.prototype.constructor=Pr;Pr.prototype.isImmediateRenderObject=!0;const Hl=new w;class Px extends de{constructor(e,t){super(),this.light=e,this.light.updateMatrixWorld(),this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1,this.color=t;const i=new le,r=[0,0,0,0,0,1,0,0,0,1,0,1,0,0,0,-1,0,1,0,0,0,0,1,1,0,0,0,0,-1,1];for(let o=0,a=1,c=32;o<c;o++,a++){const l=o/c*Math.PI*2,u=a/c*Math.PI*2;r.push(Math.cos(l),Math.sin(l),1,Math.cos(u),Math.sin(u),1)}i.setAttribute("position",new se(r,3));const s=new ct({fog:!1,toneMapped:!1});this.cone=new xt(i,s),this.add(this.cone),this.update()}dispose(){this.cone.geometry.dispose(),this.cone.material.dispose()}update(){this.light.updateMatrixWorld();const e=this.light.distance?this.light.distance:1e3,t=e*Math.tan(this.light.angle);this.cone.scale.set(t,t,e),Hl.setFromMatrixPosition(this.light.target.matrixWorld),this.cone.lookAt(Hl),this.color!==void 0?this.cone.material.color.set(this.color):this.cone.material.color.copy(this.light.color)}}const dn=new w,Ts=new ce,ta=new ce;class vd extends xt{constructor(e){const t=_d(e),i=new le,r=[],s=[],o=new re(0,0,1),a=new re(0,1,0);for(let l=0;l<t.length;l++){const u=t[l];u.parent&&u.parent.isBone&&(r.push(0,0,0),r.push(0,0,0),s.push(o.r,o.g,o.b),s.push(a.r,a.g,a.b))}i.setAttribute("position",new se(r,3)),i.setAttribute("color",new se(s,3));const c=new ct({vertexColors:!0,depthTest:!1,depthWrite:!1,toneMapped:!1,transparent:!0});super(i,c),this.type="SkeletonHelper",this.isSkeletonHelper=!0,this.root=e,this.bones=t,this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1}updateMatrixWorld(e){const t=this.bones,i=this.geometry,r=i.getAttribute("position");ta.copy(this.root.matrixWorld).invert();for(let s=0,o=0;s<t.length;s++){const a=t[s];a.parent&&a.parent.isBone&&(Ts.multiplyMatrices(ta,a.matrixWorld),dn.setFromMatrixPosition(Ts),r.setXYZ(o,dn.x,dn.y,dn.z),Ts.multiplyMatrices(ta,a.parent.matrixWorld),dn.setFromMatrixPosition(Ts),r.setXYZ(o+1,dn.x,dn.y,dn.z),o+=2)}i.getAttribute("position").needsUpdate=!0,super.updateMatrixWorld(e)}}function _d(n){const e=[];n&&n.isBone&&e.push(n);for(let t=0;t<n.children.length;t++)e.push.apply(e,_d(n.children[t]));return e}class Ix extends Ge{constructor(e,t,i){const r=new Sr(t,4,2),s=new rn({wireframe:!0,fog:!1,toneMapped:!1});super(r,s),this.light=e,this.light.updateMatrixWorld(),this.color=i,this.type="PointLightHelper",this.matrix=this.light.matrixWorld,this.matrixAutoUpdate=!1,this.update()}dispose(){this.geometry.dispose(),this.material.dispose()}update(){this.color!==void 0?this.material.color.set(this.color):this.material.color.copy(this.light.color)}}const Dx=new w,Gl=new re,kl=new re;class Fx extends de{constructor(e,t,i){super(),this.light=e,this.light.updateMatrixWorld(),this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1,this.color=i;const r=new wr(t);r.rotateY(Math.PI*.5),this.material=new rn({wireframe:!0,fog:!1,toneMapped:!1}),this.color===void 0&&(this.material.vertexColors=!0);const s=r.getAttribute("position"),o=new Float32Array(s.count*3);r.setAttribute("color",new fe(o,3)),this.add(new Ge(r,this.material)),this.update()}dispose(){this.children[0].geometry.dispose(),this.children[0].material.dispose()}update(){const e=this.children[0];if(this.color!==void 0)this.material.color.set(this.color);else{const t=e.geometry.getAttribute("color");Gl.copy(this.light.color),kl.copy(this.light.groundColor);for(let i=0,r=t.count;i<r;i++){const s=i<r/2?Gl:kl;t.setXYZ(i,s.r,s.g,s.b)}t.needsUpdate=!0}e.lookAt(Dx.setFromMatrixPosition(this.light.matrixWorld).negate())}}class bd extends xt{constructor(e=10,t=10,i=4473924,r=8947848){i=new re(i),r=new re(r);const s=t/2,o=e/t,a=e/2,c=[],l=[];for(let d=0,f=0,p=-a;d<=t;d++,p+=o){c.push(-a,0,p,a,0,p),c.push(p,0,-a,p,0,a);const y=d===s?i:r;y.toArray(l,f),f+=3,y.toArray(l,f),f+=3,y.toArray(l,f),f+=3,y.toArray(l,f),f+=3}const u=new le;u.setAttribute("position",new se(c,3)),u.setAttribute("color",new se(l,3));const h=new ct({vertexColors:!0,toneMapped:!1});super(u,h),this.type="GridHelper"}}class Bx extends xt{constructor(e=10,t=16,i=8,r=64,s=4473924,o=8947848){s=new re(s),o=new re(o);const a=[],c=[];for(let h=0;h<=t;h++){const d=h/t*(Math.PI*2),f=Math.sin(d)*e,p=Math.cos(d)*e;a.push(0,0,0),a.push(f,0,p);const y=h&1?s:o;c.push(y.r,y.g,y.b),c.push(y.r,y.g,y.b)}for(let h=0;h<=i;h++){const d=h&1?s:o,f=e-e/i*h;for(let p=0;p<r;p++){let y=p/r*(Math.PI*2),x=Math.sin(y)*f,g=Math.cos(y)*f;a.push(x,0,g),c.push(d.r,d.g,d.b),y=(p+1)/r*(Math.PI*2),x=Math.sin(y)*f,g=Math.cos(y)*f,a.push(x,0,g),c.push(d.r,d.g,d.b)}}const l=new le;l.setAttribute("position",new se(a,3)),l.setAttribute("color",new se(c,3));const u=new ct({vertexColors:!0,toneMapped:!1});super(l,u),this.type="PolarGridHelper"}}const Vl=new w,Es=new w,Wl=new w;class Nx extends de{constructor(e,t,i){super(),this.light=e,this.light.updateMatrixWorld(),this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1,this.color=i,t===void 0&&(t=1);let r=new le;r.setAttribute("position",new se([-t,t,0,t,t,0,t,-t,0,-t,-t,0,-t,t,0],3));const s=new ct({fog:!1,toneMapped:!1});this.lightPlane=new Nt(r,s),this.add(this.lightPlane),r=new le,r.setAttribute("position",new se([0,0,0,0,0,1],3)),this.targetLine=new Nt(r,s),this.add(this.targetLine),this.update()}dispose(){this.lightPlane.geometry.dispose(),this.lightPlane.material.dispose(),this.targetLine.geometry.dispose(),this.targetLine.material.dispose()}update(){Vl.setFromMatrixPosition(this.light.matrixWorld),Es.setFromMatrixPosition(this.light.target.matrixWorld),Wl.subVectors(Es,Vl),this.lightPlane.lookAt(Es),this.color!==void 0?(this.lightPlane.material.color.set(this.color),this.targetLine.material.color.set(this.color)):(this.lightPlane.material.color.copy(this.light.color),this.targetLine.material.color.copy(this.light.color)),this.targetLine.lookAt(Es),this.targetLine.scale.z=Wl.length()}}const As=new w,qe=new yn;class zx extends xt{constructor(e){const t=new le,i=new ct({color:16777215,vertexColors:!0,toneMapped:!1}),r=[],s=[],o={},a=new re(16755200),c=new re(16711680),l=new re(43775),u=new re(16777215),h=new re(3355443);d("n1","n2",a),d("n2","n4",a),d("n4","n3",a),d("n3","n1",a),d("f1","f2",a),d("f2","f4",a),d("f4","f3",a),d("f3","f1",a),d("n1","f1",a),d("n2","f2",a),d("n3","f3",a),d("n4","f4",a),d("p","n1",c),d("p","n2",c),d("p","n3",c),d("p","n4",c),d("u1","u2",l),d("u2","u3",l),d("u3","u1",l),d("c","t",u),d("p","c",h),d("cn1","cn2",h),d("cn3","cn4",h),d("cf1","cf2",h),d("cf3","cf4",h);function d(p,y,x){f(p,x),f(y,x)}function f(p,y){r.push(0,0,0),s.push(y.r,y.g,y.b),o[p]===void 0&&(o[p]=[]),o[p].push(r.length/3-1)}t.setAttribute("position",new se(r,3)),t.setAttribute("color",new se(s,3)),super(t,i),this.type="CameraHelper",this.camera=e,this.camera.updateProjectionMatrix&&this.camera.updateProjectionMatrix(),this.matrix=e.matrixWorld,this.matrixAutoUpdate=!1,this.pointMap=o,this.update()}update(){const e=this.geometry,t=this.pointMap,i=1,r=1;qe.projectionMatrixInverse.copy(this.camera.projectionMatrixInverse),Ze("c",t,e,qe,0,0,-1),Ze("t",t,e,qe,0,0,1),Ze("n1",t,e,qe,-i,-r,-1),Ze("n2",t,e,qe,i,-r,-1),Ze("n3",t,e,qe,-i,r,-1),Ze("n4",t,e,qe,i,r,-1),Ze("f1",t,e,qe,-i,-r,1),Ze("f2",t,e,qe,i,-r,1),Ze("f3",t,e,qe,-i,r,1),Ze("f4",t,e,qe,i,r,1),Ze("u1",t,e,qe,i*.7,r*1.1,-1),Ze("u2",t,e,qe,-i*.7,r*1.1,-1),Ze("u3",t,e,qe,0,r*2,-1),Ze("cf1",t,e,qe,-i,0,1),Ze("cf2",t,e,qe,i,0,1),Ze("cf3",t,e,qe,0,-r,1),Ze("cf4",t,e,qe,0,r,1),Ze("cn1",t,e,qe,-i,0,-1),Ze("cn2",t,e,qe,i,0,-1),Ze("cn3",t,e,qe,0,-r,-1),Ze("cn4",t,e,qe,0,r,-1),e.getAttribute("position").needsUpdate=!0}}function Ze(n,e,t,i,r,s,o){As.set(r,s,o).unproject(i);const a=e[n];if(a!==void 0){const c=t.getAttribute("position");for(let l=0,u=a.length;l<u;l++)c.setXYZ(a[l],As.x,As.y,As.z)}}const Ls=new Mt;class wd extends xt{constructor(e,t=16776960){const i=new Uint16Array([0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7]),r=new Float32Array(8*3),s=new le;s.setIndex(new fe(i,1)),s.setAttribute("position",new fe(r,3)),super(s,new ct({color:t,toneMapped:!1})),this.object=e,this.type="BoxHelper",this.matrixAutoUpdate=!1,this.update()}update(e){if(this.object!==void 0&&Ls.setFromObject(this.object),Ls.isEmpty())return;const t=Ls.min,i=Ls.max,r=this.geometry.attributes.position,s=r.array;s[0]=i.x,s[1]=i.y,s[2]=i.z,s[3]=t.x,s[4]=i.y,s[5]=i.z,s[6]=t.x,s[7]=t.y,s[8]=i.z,s[9]=i.x,s[10]=t.y,s[11]=i.z,s[12]=i.x,s[13]=i.y,s[14]=t.z,s[15]=t.x,s[16]=i.y,s[17]=t.z,s[18]=t.x,s[19]=t.y,s[20]=t.z,s[21]=i.x,s[22]=t.y,s[23]=t.z,r.needsUpdate=!0,this.geometry.computeBoundingSphere()}setFromObject(e){return this.object=e,this.update(),this}copy(e){return xt.prototype.copy.call(this,e),this.object=e.object,this}}class Ox extends xt{constructor(e,t=16776960){const i=new Uint16Array([0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7]),r=[1,1,1,-1,1,1,-1,-1,1,1,-1,1,1,1,-1,-1,1,-1,-1,-1,-1,1,-1,-1],s=new le;s.setIndex(new fe(i,1)),s.setAttribute("position",new se(r,3)),super(s,new ct({color:t,toneMapped:!1})),this.box=e,this.type="Box3Helper",this.geometry.computeBoundingSphere()}updateMatrixWorld(e){const t=this.box;t.isEmpty()||(t.getCenter(this.position),t.getSize(this.scale),this.scale.multiplyScalar(.5),super.updateMatrixWorld(e))}}class Ux extends Nt{constructor(e,t=1,i=16776960){const r=i,s=[1,-1,1,-1,1,1,-1,-1,1,1,1,1,-1,1,1,-1,-1,1,1,-1,1,1,1,1,0,0,1,0,0,0],o=new le;o.setAttribute("position",new se(s,3)),o.computeBoundingSphere(),super(o,new ct({color:r,toneMapped:!1})),this.type="PlaneHelper",this.plane=e,this.size=t;const a=[1,1,1,-1,1,1,-1,-1,1,1,1,1,-1,-1,1,1,-1,1],c=new le;c.setAttribute("position",new se(a,3)),c.computeBoundingSphere(),this.add(new Ge(c,new rn({color:r,opacity:.2,transparent:!0,depthWrite:!1,toneMapped:!1})))}updateMatrixWorld(e){let t=-this.plane.constant;Math.abs(t)<1e-8&&(t=1e-8),this.scale.set(.5*this.size,.5*this.size,t),this.children[0].material.side=t<0?Ke:Li,this.lookAt(this.plane.normal),super.updateMatrixWorld(e)}}const ql=new w;let Rs,na;class Hx extends de{constructor(e=new w(0,0,1),t=new w(0,0,0),i=1,r=16776960,s=i*.2,o=s*.2){super(),this.type="ArrowHelper",Rs===void 0&&(Rs=new le,Rs.setAttribute("position",new se([0,0,0,0,1,0],3)),na=new Ai(0,.5,1,5,1),na.translate(0,-.5,0)),this.position.copy(t),this.line=new Nt(Rs,new ct({color:r,toneMapped:!1})),this.line.matrixAutoUpdate=!1,this.add(this.line),this.cone=new Ge(na,new rn({color:r,toneMapped:!1})),this.cone.matrixAutoUpdate=!1,this.add(this.cone),this.setDirection(e),this.setLength(i,s,o)}setDirection(e){if(e.y>.99999)this.quaternion.set(0,0,0,1);else if(e.y<-.99999)this.quaternion.set(1,0,0,0);else{ql.set(e.z,0,-e.x).normalize();const t=Math.acos(e.y);this.quaternion.setFromAxisAngle(ql,t)}}setLength(e,t=e*.2,i=t*.2){this.line.scale.set(1,Math.max(1e-4,e-t),1),this.line.updateMatrix(),this.cone.scale.set(i,t,i),this.cone.position.y=e,this.cone.updateMatrix()}setColor(e){this.line.material.color.set(e),this.cone.material.color.set(e)}copy(e){return super.copy(e,!1),this.line.copy(e.line),this.cone.copy(e.cone),this}}class Md extends xt{constructor(e=1){const t=[0,0,0,e,0,0,0,0,0,0,e,0,0,0,0,0,0,e],i=[1,0,0,1,.6,0,0,1,0,.6,1,0,0,0,1,0,.6,1],r=new le;r.setAttribute("position",new se(t,3)),r.setAttribute("color",new se(i,3));const s=new ct({vertexColors:!0,toneMapped:!1});super(r,s),this.type="AxesHelper"}}const Sd=new Float32Array(1),Gx=new Int32Array(Sd.buffer),kx={toHalfFloat:function(n){Sd[0]=n;const e=Gx[0];let t=e>>16&32768,i=e>>12&2047;const r=e>>23&255;return r<103?t:r>142?(t|=31744,t|=(r==255?0:1)&&e&8388607,t):r<113?(i|=2048,t|=(i>>114-r)+(i>>113-r&1),t):(t|=r-112<<10|i>>1,t+=i&1,t)}},wi=4,gn=8,Gt=Math.pow(2,gn),Td=[.125,.215,.35,.446,.526,.582],Ed=gn-wi+1+Td.length,ji=20,kt={[gt]:0,[zr]:1,[oo]:2,[Oa]:3,[Ua]:4,[Ha]:5,[so]:6},Fn=new rn({side:Ke,depthWrite:!1,depthTest:!1}),Vx=new Ge(new qn,Fn),ia=new Vr,{_lodPlanes:Zi,_sizeLods:Xl,_sigmas:Cs}=Xx(),Yl=new re;let ra=null;const Bn=(1+Math.sqrt(5))/2,yi=1/Bn,jl=[new w(1,1,1),new w(-1,1,1),new w(1,1,-1),new w(-1,1,-1),new w(0,Bn,yi),new w(0,Bn,-yi),new w(yi,0,Bn),new w(-yi,0,Bn),new w(Bn,yi,0),new w(-Bn,yi,0)];function Zl(n){const e=Math.max(n.r,n.g,n.b),t=Math.min(Math.max(Math.ceil(Math.log2(e)),-128),127);return n.multiplyScalar(Math.pow(2,-t)),(t+128)/255}class Wx{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._blurMaterial=Yx(ji),this._equirectShader=null,this._cubemapShader=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,i=.1,r=100){ra=this._renderer.getRenderTarget();const s=this._allocateTargets();return this._sceneToCubeUV(e,i,r,s),t>0&&this._blur(s,0,0,t),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(e){return this._fromTexture(e)}fromCubemap(e){return this._fromTexture(e)}compileCubemapShader(){this._cubemapShader===null&&(this._cubemapShader=Ql(),this._compileMaterial(this._cubemapShader))}compileEquirectangularShader(){this._equirectShader===null&&(this._equirectShader=$l(),this._compileMaterial(this._equirectShader))}dispose(){this._blurMaterial.dispose(),this._cubemapShader!==null&&this._cubemapShader.dispose(),this._equirectShader!==null&&this._equirectShader.dispose();for(let e=0;e<Zi.length;e++)Zi[e].dispose()}_cleanup(e){this._pingPongRenderTarget.dispose(),this._renderer.setRenderTarget(ra),e.scissorTest=!1,Ps(e,0,0,e.width,e.height)}_fromTexture(e){ra=this._renderer.getRenderTarget();const t=this._allocateTargets(e);return this._textureToCubeUV(e,t),this._applyPMREM(t),this._cleanup(t),t}_allocateTargets(e){const t={magFilter:nt,minFilter:nt,generateMipmaps:!1,type:Pi,format:zh,encoding:qx(e)?e.encoding:oo,depthBuffer:!1},i=Jl(t);return i.depthBuffer=!e,this._pingPongRenderTarget=Jl(t),i}_compileMaterial(e){const t=new Ge(Zi[0],e);this._renderer.compile(t,ia)}_sceneToCubeUV(e,t,i,r){const a=new tt(90,1,t,i),c=[1,-1,1,1,1,1],l=[1,1,1,-1,-1,-1],u=this._renderer,h=u.autoClear,d=u.outputEncoding,f=u.toneMapping;u.getClearColor(Yl),u.toneMapping=Hn,u.outputEncoding=gt,u.autoClear=!1;let p=!1;const y=e.background;if(y){if(y.isColor){Fn.color.copy(y).convertSRGBToLinear(),e.background=null;const x=Zl(Fn.color);Fn.opacity=x,p=!0}}else{Fn.color.copy(Yl).convertSRGBToLinear();const x=Zl(Fn.color);Fn.opacity=x,p=!0}for(let x=0;x<6;x++){const g=x%3;g==0?(a.up.set(0,c[x],0),a.lookAt(l[x],0,0)):g==1?(a.up.set(0,0,c[x]),a.lookAt(0,l[x],0)):(a.up.set(0,c[x],0),a.lookAt(0,0,l[x])),Ps(r,g*Gt,x>2?Gt:0,Gt,Gt),u.setRenderTarget(r),p&&u.render(Vx,a),u.render(e,a)}u.toneMapping=f,u.outputEncoding=d,u.autoClear=h}_textureToCubeUV(e,t){const i=this._renderer;e.isCubeTexture?this._cubemapShader==null&&(this._cubemapShader=Ql()):this._equirectShader==null&&(this._equirectShader=$l());const r=e.isCubeTexture?this._cubemapShader:this._equirectShader,s=new Ge(Zi[0],r),o=r.uniforms;o.envMap.value=e,e.isCubeTexture||o.texelSize.value.set(1/e.image.width,1/e.image.height),o.inputEncoding.value=kt[e.encoding],o.outputEncoding.value=kt[t.texture.encoding],Ps(t,0,0,3*Gt,2*Gt),i.setRenderTarget(t),i.render(s,ia)}_applyPMREM(e){const t=this._renderer,i=t.autoClear;t.autoClear=!1;for(let r=1;r<Ed;r++){const s=Math.sqrt(Cs[r]*Cs[r]-Cs[r-1]*Cs[r-1]),o=jl[(r-1)%jl.length];this._blur(e,r-1,r,s,o)}t.autoClear=i}_blur(e,t,i,r,s){const o=this._pingPongRenderTarget;this._halfBlur(e,o,t,i,r,"latitudinal",s),this._halfBlur(o,e,i,i,r,"longitudinal",s)}_halfBlur(e,t,i,r,s,o,a){const c=this._renderer,l=this._blurMaterial,u=3,h=new Ge(Zi[r],l),d=l.uniforms,f=Xl[i]-1,p=isFinite(s)?Math.PI/(2*f):2*Math.PI/(2*ji-1),y=s/p,x=isFinite(s)?1+Math.floor(u*y):ji;x>ji;const g=[];let m=0;for(let v=0;v<ji;++v){const A=v/y,L=Math.exp(-A*A/2);g.push(L),v==0?m+=L:v<x&&(m+=2*L)}for(let v=0;v<g.length;v++)g[v]=g[v]/m;d.envMap.value=e.texture,d.samples.value=x,d.weights.value=g,d.latitudinal.value=o==="latitudinal",a&&(d.poleAxis.value=a),d.dTheta.value=p,d.mipInt.value=gn-i,d.inputEncoding.value=kt[e.texture.encoding],d.outputEncoding.value=kt[e.texture.encoding];const b=Xl[r],_=3*Math.max(0,Gt-2*b),T=(r===0?0:2*Gt)+2*b*(r>gn-wi?r-gn+wi:0);Ps(t,_,T,3*b,2*b),c.setRenderTarget(t),c.render(h,ia)}}function qx(n){return n===void 0||n.type!==Pi?!1:n.encoding===gt||n.encoding===zr||n.encoding===so}function Xx(){const n=[],e=[],t=[];let i=gn;for(let r=0;r<Ed;r++){const s=Math.pow(2,i);e.push(s);let o=1/s;r>gn-wi?o=Td[r-gn+wi-1]:r==0&&(o=0),t.push(o);const a=1/(s-1),c=-a/2,l=1+a/2,u=[c,c,l,c,l,l,c,c,l,l,c,l],h=6,d=6,f=3,p=2,y=1,x=new Float32Array(f*d*h),g=new Float32Array(p*d*h),m=new Float32Array(y*d*h);for(let _=0;_<h;_++){const T=_%3*2/3-1,v=_>2?0:-1,A=[T,v,0,T+2/3,v,0,T+2/3,v+1,0,T,v,0,T+2/3,v+1,0,T,v+1,0];x.set(A,f*d*_),g.set(u,p*d*_);const L=[_,_,_,_,_,_];m.set(L,y*d*_)}const b=new le;b.setAttribute("position",new fe(x,f)),b.setAttribute("uv",new fe(g,p)),b.setAttribute("faceIndex",new fe(m,y)),n.push(b),i>wi&&i--}return{_lodPlanes:n,_sizeLods:e,_sigmas:t}}function Jl(n){const e=new Kt(3*Gt,3*Gt,n);return e.texture.mapping=Ri,e.texture.name="PMREM.cubeUv",e.scissorTest=!0,e}function Ps(n,e,t,i,r){n.viewport.set(e,t,i,r),n.scissor.set(e,t,i,r)}function Yx(n){const e=new Float32Array(n),t=new w(0,1,0);return new Bi({name:"SphericalGaussianBlur",defines:{n},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:e},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:t},inputEncoding:{value:kt[gt]},outputEncoding:{value:kt[gt]}},vertexShader:Tc(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			${Ec()}

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

				gl_FragColor = linearToOutputTexel( gl_FragColor );

			}
		`,blending:Qt,depthTest:!1,depthWrite:!1})}function $l(){const n=new W(1,1);return new Bi({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null},texelSize:{value:n},inputEncoding:{value:kt[gt]},outputEncoding:{value:kt[gt]}},vertexShader:Tc(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform vec2 texelSize;

			${Ec()}

			#include <common>

			void main() {

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				vec2 f = fract( uv / texelSize - 0.5 );
				uv -= f * texelSize;
				vec3 tl = envMapTexelToLinear( texture2D ( envMap, uv ) ).rgb;
				uv.x += texelSize.x;
				vec3 tr = envMapTexelToLinear( texture2D ( envMap, uv ) ).rgb;
				uv.y += texelSize.y;
				vec3 br = envMapTexelToLinear( texture2D ( envMap, uv ) ).rgb;
				uv.x -= texelSize.x;
				vec3 bl = envMapTexelToLinear( texture2D ( envMap, uv ) ).rgb;

				vec3 tm = mix( tl, tr, f.x );
				vec3 bm = mix( bl, br, f.x );
				gl_FragColor.rgb = mix( tm, bm, f.y );

				gl_FragColor = linearToOutputTexel( gl_FragColor );

			}
		`,blending:Qt,depthTest:!1,depthWrite:!1})}function Ql(){return new Bi({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},inputEncoding:{value:kt[gt]},outputEncoding:{value:kt[gt]}},vertexShader:Tc(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			${Ec()}

			void main() {

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb = envMapTexelToLinear( textureCube( envMap, vec3( - vOutputDirection.x, vOutputDirection.yz ) ) ).rgb;
				gl_FragColor = linearToOutputTexel( gl_FragColor );

			}
		`,blending:Qt,depthTest:!1,depthWrite:!1})}function Tc(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 position;
		attribute vec2 uv;
		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function Ec(){return`

		uniform int inputEncoding;
		uniform int outputEncoding;

		#include <encodings_pars_fragment>

		vec4 inputTexelToLinear( vec4 value ) {

			if ( inputEncoding == 0 ) {

				return value;

			} else if ( inputEncoding == 1 ) {

				return sRGBToLinear( value );

			} else if ( inputEncoding == 2 ) {

				return RGBEToLinear( value );

			} else if ( inputEncoding == 3 ) {

				return RGBMToLinear( value, 7.0 );

			} else if ( inputEncoding == 4 ) {

				return RGBMToLinear( value, 16.0 );

			} else if ( inputEncoding == 5 ) {

				return RGBDToLinear( value, 256.0 );

			} else {

				return GammaToLinear( value, 2.2 );

			}

		}

		vec4 linearToOutputTexel( vec4 value ) {

			if ( outputEncoding == 0 ) {

				return value;

			} else if ( outputEncoding == 1 ) {

				return LinearTosRGB( value );

			} else if ( outputEncoding == 2 ) {

				return LinearToRGBE( value );

			} else if ( outputEncoding == 3 ) {

				return LinearToRGBM( value, 7.0 );

			} else if ( outputEncoding == 4 ) {

				return LinearToRGBM( value, 16.0 );

			} else if ( outputEncoding == 5 ) {

				return LinearToRGBD( value, 256.0 );

			} else {

				return LinearToGamma( value, 2.2 );

			}

		}

		vec4 envMapTexelToLinear( vec4 color ) {

			return inputTexelToLinear( color );

		}
	`}const jx=0,Zx=1,Jx=0,$x=1,Qx=2;function Kx(n){return n}function ev(n=[]){return n.isMultiMaterial=!0,n.materials=n,n.clone=function(){return n.slice()},n}function tv(n,e){return new Ei(n,e)}function nv(n){return new po(n)}function iv(n,e){return new Ei(n,e)}function rv(n){return new $n(n)}function sv(n){return new $n(n)}function ov(n){return new $n(n)}function av(n,e,t){return new w(n,e,t)}function cv(n,e){return new fe(n,e).setUsage(kn)}function lv(n,e){return new lr(n,e)}function hv(n,e){return new hr(n,e)}function uv(n,e){return new ur(n,e)}function dv(n,e){return new dr(n,e)}function fv(n,e){return new Vn(n,e)}function pv(n,e){return new fr(n,e)}function mv(n,e){return new Wn(n,e)}function gv(n,e){return new se(n,e)}function yv(n,e){return new mr(n,e)}vt.create=function(n,e){return n.prototype=Object.create(vt.prototype),n.prototype.constructor=n,n.prototype.getPoint=e,n};Rr.prototype.fromPoints=function(n){return this.setFromPoints(n)};function xv(n){return new Md(n)}function vv(n,e){return new wd(n,e)}function _v(n,e){return new xt(new Ya(n.geometry),new ct({color:e!==void 0?e:16777215}))}bd.prototype.setColors=function(){};vd.prototype.update=function(){};function bv(n,e){return new xt(new ja(n.geometry),new ct({color:e!==void 0?e:16777215}))}Xe.prototype.extractUrlBase=function(n){return yc.extractUrlBase(n)};Xe.Handlers={add:function(){},get:function(){}};function wv(n){return new Lt(n)}function Mv(n){return new eo(n)}zi.prototype.center=function(n){return this.getCenter(n)};zi.prototype.empty=function(){return this.isEmpty()};zi.prototype.isIntersectionBox=function(n){return this.intersectsBox(n)};zi.prototype.size=function(n){return this.getSize(n)};Mt.prototype.center=function(n){return this.getCenter(n)};Mt.prototype.empty=function(){return this.isEmpty()};Mt.prototype.isIntersectionBox=function(n){return this.intersectsBox(n)};Mt.prototype.isIntersectionSphere=function(n){return this.intersectsSphere(n)};Mt.prototype.size=function(n){return this.getSize(n)};wn.prototype.empty=function(){return this.isEmpty()};Or.prototype.setFromMatrix=function(n){return this.setFromProjectionMatrix(n)};xd.prototype.center=function(n){return this.getCenter(n)};me.random16=function(){return Math.random()};me.nearestPowerOfTwo=function(n){return me.floorPowerOfTwo(n)};me.nextPowerOfTwo=function(n){return me.ceilPowerOfTwo(n)};rt.prototype.flattenToArrayOffset=function(n,e){return this.toArray(n,e)};rt.prototype.multiplyVector3=function(n){return n.applyMatrix3(this)};rt.prototype.multiplyVector3Array=function(){};rt.prototype.applyToBufferAttribute=function(n){return n.applyMatrix3(this)};rt.prototype.applyToVector3Array=function(){};rt.prototype.getInverse=function(n){return this.copy(n).invert()};ce.prototype.extractPosition=function(n){return this.copyPosition(n)};ce.prototype.flattenToArrayOffset=function(n,e){return this.toArray(n,e)};ce.prototype.getPosition=function(){return new w().setFromMatrixColumn(this,3)};ce.prototype.setRotationFromQuaternion=function(n){return this.makeRotationFromQuaternion(n)};ce.prototype.multiplyToArray=function(){};ce.prototype.multiplyVector3=function(n){return n.applyMatrix4(this)};ce.prototype.multiplyVector4=function(n){return n.applyMatrix4(this)};ce.prototype.multiplyVector3Array=function(){};ce.prototype.rotateAxis=function(n){n.transformDirection(this)};ce.prototype.crossVector=function(n){return n.applyMatrix4(this)};ce.prototype.translate=function(){};ce.prototype.rotateX=function(){};ce.prototype.rotateY=function(){};ce.prototype.rotateZ=function(){};ce.prototype.rotateByAxis=function(){};ce.prototype.applyToBufferAttribute=function(n){return n.applyMatrix4(this)};ce.prototype.applyToVector3Array=function(){};ce.prototype.makeFrustum=function(n,e,t,i,r,s){return this.makePerspective(n,e,i,t,r,s)};ce.prototype.getInverse=function(n){return this.copy(n).invert()};Ft.prototype.isIntersectionLine=function(n){return this.intersectsLine(n)};at.prototype.multiplyVector3=function(n){return n.applyQuaternion(this)};at.prototype.inverse=function(){return this.invert()};Mn.prototype.isIntersectionBox=function(n){return this.intersectsBox(n)};Mn.prototype.isIntersectionPlane=function(n){return this.intersectsPlane(n)};Mn.prototype.isIntersectionSphere=function(n){return this.intersectsSphere(n)};Je.prototype.area=function(){return this.getArea()};Je.prototype.barycoordFromPoint=function(n,e){return this.getBarycoord(n,e)};Je.prototype.midpoint=function(n){return this.getMidpoint(n)};Je.prototypenormal=function(n){return this.getNormal(n)};Je.prototype.plane=function(n){return this.getPlane(n)};Je.barycoordFromPoint=function(n,e,t,i,r){return Je.getBarycoord(n,e,t,i,r)};Je.normal=function(n,e,t,i){return Je.getNormal(n,e,t,i)};mn.prototype.extractAllPoints=function(n){return this.extractPoints(n)};mn.prototype.extrude=function(n){return new tn(this,n)};mn.prototype.makeGeometry=function(n){return new Mr(this,n)};W.prototype.fromAttribute=function(n,e,t){return this.fromBufferAttribute(n,e,t)};W.prototype.distanceToManhattan=function(n){return this.manhattanDistanceTo(n)};W.prototype.lengthManhattan=function(){return this.manhattanLength()};w.prototype.setEulerFromRotationMatrix=function(){};w.prototype.setEulerFromQuaternion=function(){};w.prototype.getPositionFromMatrix=function(n){return this.setFromMatrixPosition(n)};w.prototype.getScaleFromMatrix=function(n){return this.setFromMatrixScale(n)};w.prototype.getColumnFromMatrix=function(n,e){return this.setFromMatrixColumn(e,n)};w.prototype.applyProjection=function(n){return this.applyMatrix4(n)};w.prototype.fromAttribute=function(n,e,t){return this.fromBufferAttribute(n,e,t)};w.prototype.distanceToManhattan=function(n){return this.manhattanDistanceTo(n)};w.prototype.lengthManhattan=function(){return this.manhattanLength()};Be.prototype.fromAttribute=function(n,e,t){return this.fromBufferAttribute(n,e,t)};Be.prototype.lengthManhattan=function(){return this.manhattanLength()};de.prototype.getChildByName=function(n){return this.getObjectByName(n)};de.prototype.renderDepth=function(){};de.prototype.translate=function(n,e){return this.translateOnAxis(e,n)};de.prototype.getWorldRotation=function(){};de.prototype.applyMatrix=function(n){return this.applyMatrix4(n)};Object.defineProperties(de.prototype,{eulerOrder:{get:function(){return this.rotation.order},set:function(n){this.rotation.order=n}},useQuaternion:{get:function(){},set:function(){}}});Ge.prototype.setDrawMode=function(){};Object.defineProperties(Ge.prototype,{drawMode:{get:function(){return Mu},set:function(){}}});yr.prototype.initBones=function(){};Object.defineProperty(vt.prototype,"__arcLengthDivisions",{get:function(){return this.arcLengthDivisions},set:function(n){this.arcLengthDivisions=n}});tt.prototype.setLens=function(n,e){e!==void 0&&(this.filmGauge=e),this.setFocalLength(n)};Object.defineProperties(zt.prototype,{onlyShadow:{set:function(){}},shadowCameraFov:{set:function(n){this.shadow.camera.fov=n}},shadowCameraLeft:{set:function(n){this.shadow.camera.left=n}},shadowCameraRight:{set:function(n){this.shadow.camera.right=n}},shadowCameraTop:{set:function(n){this.shadow.camera.top=n}},shadowCameraBottom:{set:function(n){this.shadow.camera.bottom=n}},shadowCameraNear:{set:function(n){this.shadow.camera.near=n}},shadowCameraFar:{set:function(n){this.shadow.camera.far=n}},shadowCameraVisible:{set:function(){}},shadowBias:{set:function(n){this.shadow.bias=n}},shadowDarkness:{set:function(){}},shadowMapWidth:{set:function(n){this.shadow.mapSize.width=n}},shadowMapHeight:{set:function(n){this.shadow.mapSize.height=n}}});Object.defineProperties(fe.prototype,{length:{get:function(){return this.array.length}},dynamic:{get:function(){return this.usage===kn},set:function(){this.setUsage(kn)}}});fe.prototype.setDynamic=function(n){return this.setUsage(n===!0?kn:Ii),this};fe.prototype.copyIndicesArray=function(){},fe.prototype.setArray=function(){};le.prototype.addIndex=function(n){this.setIndex(n)};le.prototype.addAttribute=function(n,e){return!(e&&e.isBufferAttribute)&&!(e&&e.isInterleavedBufferAttribute)?this.setAttribute(n,new fe(arguments[1],arguments[2])):n==="index"?(this.setIndex(e),this):this.setAttribute(n,e)};le.prototype.addDrawCall=function(n,e,t){this.addGroup(n,e)};le.prototype.clearDrawCalls=function(){this.clearGroups()};le.prototype.computeOffsets=function(){};le.prototype.removeAttribute=function(n){return this.deleteAttribute(n)};le.prototype.applyMatrix=function(n){return this.applyMatrix4(n)};Object.defineProperties(le.prototype,{drawcalls:{get:function(){return this.groups}},offsets:{get:function(){return this.groups}}});Object.defineProperties(Cr.prototype,{maxInstancedCount:{get:function(){return this.instanceCount},set:function(n){this.instanceCount=n}}});Object.defineProperties(Sc.prototype,{linePrecision:{get:function(){return this.params.Line.threshold},set:function(n){this.params.Line.threshold=n}}});Object.defineProperties(bt.prototype,{dynamic:{get:function(){return this.usage===kn},set:function(n){this.setUsage(n)}}});bt.prototype.setDynamic=function(n){return this.setUsage(n===!0?kn:Ii),this};bt.prototype.setArray=function(){};tn.prototype.getArrays=function(){};tn.prototype.addShapeList=function(){};tn.prototype.addShape=function(){};uo.prototype.dispose=function(){};bo.prototype.onUpdate=function(){return this};Object.defineProperties(Ve.prototype,{wrapAround:{get:function(){},set:function(){}},overdraw:{get:function(){},set:function(){}},wrapRGB:{get:function(){return new re}},shading:{get:function(){},set:function(n){this.flatShading=n===Da}},stencilMask:{get:function(){return this.stencilFuncMask},set:function(n){this.stencilFuncMask=n}}});Object.defineProperties(bn.prototype,{transparency:{get:function(){return this.transmission},set:function(n){this.transmission=n}}});Object.defineProperties(wt.prototype,{derivatives:{get:function(){return this.extensions.derivatives},set:function(n){this.extensions.derivatives=n}}});Oe.prototype.clearTarget=function(n,e,t,i){this.setRenderTarget(n),this.clear(e,t,i)};Oe.prototype.animate=function(n){this.setAnimationLoop(n)};Oe.prototype.getCurrentRenderTarget=function(){return this.getRenderTarget()};Oe.prototype.getMaxAnisotropy=function(){return this.capabilities.getMaxAnisotropy()};Oe.prototype.getPrecision=function(){return this.capabilities.precision};Oe.prototype.resetGLState=function(){return this.state.reset()};Oe.prototype.supportsFloatTextures=function(){return this.extensions.get("OES_texture_float")};Oe.prototype.supportsHalfFloatTextures=function(){return this.extensions.get("OES_texture_half_float")};Oe.prototype.supportsStandardDerivatives=function(){return this.extensions.get("OES_standard_derivatives")};Oe.prototype.supportsCompressedTextureS3TC=function(){return this.extensions.get("WEBGL_compressed_texture_s3tc")};Oe.prototype.supportsCompressedTexturePVRTC=function(){return this.extensions.get("WEBGL_compressed_texture_pvrtc")};Oe.prototype.supportsBlendMinMax=function(){return this.extensions.get("EXT_blend_minmax")};Oe.prototype.supportsVertexTextures=function(){return this.capabilities.vertexTextures};Oe.prototype.supportsInstancedArrays=function(){return this.extensions.get("ANGLE_instanced_arrays")};Oe.prototype.enableScissorTest=function(n){this.setScissorTest(n)};Oe.prototype.initMaterial=function(){};Oe.prototype.addPrePlugin=function(){};Oe.prototype.addPostPlugin=function(){};Oe.prototype.updateShadowMap=function(){};Oe.prototype.setFaceCulling=function(){};Oe.prototype.allocTextureUnit=function(){};Oe.prototype.setTexture=function(){};Oe.prototype.setTexture2D=function(){};Oe.prototype.setTextureCube=function(){};Oe.prototype.getActiveMipMapLevel=function(){return this.getActiveMipmapLevel()};Object.defineProperties(Oe.prototype,{shadowMapEnabled:{get:function(){return this.shadowMap.enabled},set:function(n){this.shadowMap.enabled=n}},shadowMapType:{get:function(){return this.shadowMap.type},set:function(n){this.shadowMap.type=n}},shadowMapCullFace:{get:function(){},set:function(){}},context:{get:function(){return this.getContext()}},vr:{get:function(){return this.xr}},gammaInput:{get:function(){return!1},set:function(){}},gammaOutput:{get:function(){return!1},set:function(n){this.outputEncoding=n===!0?zr:gt}},toneMappingWhitePoint:{get:function(){return 1},set:function(){}}});Object.defineProperties(Gu.prototype,{cullFace:{get:function(){},set:function(){}},renderReverseSided:{get:function(){},set:function(){}},renderSingleSided:{get:function(){},set:function(){}}});function Sv(n,e,t){return new co(n,t)}Object.defineProperties(Kt.prototype,{wrapS:{get:function(){return this.texture.wrapS},set:function(n){this.texture.wrapS=n}},wrapT:{get:function(){return this.texture.wrapT},set:function(n){this.texture.wrapT=n}},magFilter:{get:function(){return this.texture.magFilter},set:function(n){this.texture.magFilter=n}},minFilter:{get:function(){return this.texture.minFilter},set:function(n){this.texture.minFilter=n}},anisotropy:{get:function(){return this.texture.anisotropy},set:function(n){this.texture.anisotropy=n}},offset:{get:function(){return this.texture.offset},set:function(n){this.texture.offset=n}},repeat:{get:function(){return this.texture.repeat},set:function(n){this.texture.repeat=n}},format:{get:function(){return this.texture.format},set:function(n){this.texture.format=n}},type:{get:function(){return this.texture.type},set:function(n){this.texture.type=n}},generateMipmaps:{get:function(){return this.texture.generateMipmaps},set:function(n){this.texture.generateMipmaps=n}}});_c.prototype.load=function(n){const e=this;return new ld().load(n,function(i){e.setBuffer(i)}),this};fd.prototype.getData=function(){return this.getFrequencyData()};ao.prototype.updateCubeMap=function(n,e){return this.update(n,e)};ao.prototype.clear=function(n,e,t,i){return this.renderTarget.clear(n,e,t,i)};Zn.crossOrigin=void 0;Zn.loadTexture=function(n,e,t,i){const r=new to;r.setCrossOrigin(this.crossOrigin);const s=r.load(n,t,void 0,i);return e&&(s.mapping=e),s};Zn.loadTextureCube=function(n,e,t,i){const r=new ed;r.setCrossOrigin(this.crossOrigin);const s=r.load(n,t,void 0,i);return e&&(s.mapping=e),s};Zn.loadCompressedTexture=function(){};Zn.loadCompressedTextureCube=function(){};function Tv(){}function Ev(){}const Av={createMultiMaterialObject:function(){},detach:function(){},attach:function(){}};function Lv(){}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Pa}}));typeof window<"u"&&(window.__THREE__||(window.__THREE__=Pa));const Rv=Object.freeze(Object.defineProperty({__proto__:null,ACESFilmicToneMapping:Eh,AddEquation:Nn,AddOperation:wh,AdditiveAnimationBlendMode:za,AdditiveBlending:oa,AlphaFormat:Fh,AlwaysDepth:mh,AlwaysStencilFunc:Lu,AmbientLight:pc,AmbientLightProbe:ud,AnimationClip:Lr,AnimationLoader:nx,AnimationMixer:yd,AnimationObjectGroup:gd,AnimationUtils:ke,ArcCurve:rc,ArrayCamera:Wa,ArrowHelper:Hx,Audio:_c,AudioAnalyser:fd,AudioContext:vc,AudioListener:yx,AudioLoader:ld,AxesHelper:Md,AxisHelper:xv,BackSide:Ke,BasicDepthPacking:Tu,BasicShadowMap:Fd,BinaryTextureLoader:Mv,Bone:xr,BooleanKeyframeTrack:Qn,BoundingBoxHelper:vv,Box2:zi,Box3:Mt,Box3Helper:Ox,BoxBufferGeometry:qn,BoxGeometry:qn,BoxHelper:wd,BufferAttribute:fe,BufferGeometry:le,BufferGeometryLoader:ad,ByteType:Lh,Cache:Yn,Camera:yn,CameraHelper:zx,CanvasRenderer:Tv,CanvasTexture:ju,CatmullRomCurve3:oc,CineonToneMapping:Th,CircleBufferGeometry:Hs,CircleGeometry:Hs,ClampToEdgeWrapping:mt,Clock:dd,Color:re,ColorKeyframeTrack:nc,CompressedTexture:Xa,CompressedTextureLoader:Ea,ConeBufferGeometry:Gs,ConeGeometry:Gs,CubeCamera:ao,CubeReflectionMapping:Fr,CubeRefractionMapping:Br,CubeTexture:Di,CubeTextureLoader:ed,CubeUVReflectionMapping:Ri,CubeUVRefractionMapping:Nr,CubicBezierCurve:xo,CubicBezierCurve3:ac,CubicInterpolant:$s,CullFaceBack:sa,CullFaceFront:eh,CullFaceFrontBack:Dd,CullFaceNone:Kl,Curve:vt,CurvePath:nd,CustomBlending:nh,CustomToneMapping:Ah,CylinderBufferGeometry:Ai,CylinderGeometry:Ai,Cylindrical:Cx,DataTexture:Ti,DataTexture2DArray:ka,DataTexture3D:Va,DataTextureLoader:eo,DataUtils:kx,DecrementStencilOp:qd,DecrementWrapStencilOp:Yd,DefaultLoadingManager:Ku,DepthFormat:Gn,DepthStencilFormat:Mi,DepthTexture:Zu,DirectionalLight:fc,DirectionalLightHelper:Nx,DiscreteInterpolant:Qs,DodecahedronBufferGeometry:ks,DodecahedronGeometry:ks,DoubleSide:Ir,DstAlphaFactor:lh,DstColorFactor:uh,DynamicBufferAttribute:cv,DynamicCopyUsage:cf,DynamicDrawUsage:kn,DynamicReadUsage:sf,EdgesGeometry:Ya,EdgesHelper:_v,EllipseCurve:Gr,EqualDepth:yh,EqualStencilFunc:$d,EquirectangularReflectionMapping:Bs,EquirectangularRefractionMapping:Ns,Euler:Jn,EventDispatcher:nn,ExtrudeBufferGeometry:tn,ExtrudeGeometry:tn,FaceColors:$x,FileLoader:Lt,FlatShading:Da,Float16BufferAttribute:pr,Float32Attribute:gv,Float32BufferAttribute:se,Float64Attribute:yv,Float64BufferAttribute:mr,FloatType:$t,Fog:Hr,FogExp2:Ur,Font:xc,FontLoader:px,FrontSide:Li,Frustum:Or,GLBufferAttribute:Mc,GLSL1:hf,GLSL3:ba,GammaEncoding:so,GreaterDepth:vh,GreaterEqualDepth:xh,GreaterEqualStencilFunc:tf,GreaterStencilFunc:Kd,GridHelper:bd,Group:Un,HalfFloatType:sr,HemisphereLight:lc,HemisphereLightHelper:Fx,HemisphereLightProbe:hd,IcosahedronBufferGeometry:Vs,IcosahedronGeometry:Vs,ImageBitmapLoader:La,ImageLoader:yo,ImageUtils:Zn,ImmediateRenderObject:Pr,IncrementStencilOp:Wd,IncrementWrapStencilOp:Xd,InstancedBufferAttribute:no,InstancedBufferGeometry:Cr,InstancedInterleavedBuffer:Ra,InstancedMesh:Us,Int16Attribute:dv,Int16BufferAttribute:dr,Int32Attribute:pv,Int32BufferAttribute:fr,Int8Attribute:lv,Int8BufferAttribute:lr,IntType:Ch,InterleavedBuffer:bt,InterleavedBufferAttribute:xn,Interpolant:At,InterpolateDiscrete:or,InterpolateLinear:ar,InterpolateSmooth:Is,InvertStencilOp:jd,JSONLoader:Ev,KeepStencilOp:Ds,KeyframeTrack:Ot,LOD:Xu,LatheBufferGeometry:Ws,LatheGeometry:Ws,Layers:Ga,LensFlare:Lv,LessDepth:gh,LessEqualDepth:Fs,LessEqualStencilFunc:Qd,LessStencilFunc:Jd,Light:zt,LightProbe:Wr,Line:Nt,Line3:xd,LineBasicMaterial:ct,LineCurve:kr,LineCurve3:td,LineDashedMaterial:tc,LineLoop:qa,LinePieces:Zx,LineSegments:xt,LineStrip:jx,LinearEncoding:gt,LinearFilter:it,LinearInterpolant:Tr,LinearMipMapLinearFilter:Ud,LinearMipMapNearestFilter:Od,LinearMipmapLinearFilter:Ci,LinearMipmapNearestFilter:Na,LinearToneMapping:Mh,Loader:Xe,LoaderUtils:yc,LoadingManager:ic,LogLuvEncoding:Su,LoopOnce:_u,LoopPingPong:wu,LoopRepeat:bu,LuminanceAlphaFormat:Nh,LuminanceFormat:Bh,MOUSE:Pd,Material:Ve,MaterialLoader:od,Math:me,MathUtils:me,Matrix3:rt,Matrix4:ce,MaxEquation:ha,Mesh:Ge,MeshBasicMaterial:rn,MeshDepthMaterial:lo,MeshDistanceMaterial:ho,MeshFaceMaterial:Kx,MeshLambertMaterial:Ka,MeshMatcapMaterial:ec,MeshNormalMaterial:Qa,MeshPhongMaterial:Ja,MeshPhysicalMaterial:bn,MeshStandardMaterial:Vt,MeshToonMaterial:$a,MinEquation:la,MirroredRepeatWrapping:ir,MixOperation:bh,MultiMaterial:ev,MultiplyBlending:ca,MultiplyOperation:Dr,NearestFilter:nt,NearestMipMapLinearFilter:zd,NearestMipMapNearestFilter:Nd,NearestMipmapLinearFilter:Os,NearestMipmapNearestFilter:zs,NeverDepth:ph,NeverStencilFunc:Zd,NoBlending:Qt,NoColors:Jx,NoToneMapping:Hn,NormalAnimationBlendMode:ro,NormalBlending:_i,NotEqualDepth:_h,NotEqualStencilFunc:ef,NumberKeyframeTrack:Er,Object3D:de,ObjectLoader:hx,ObjectSpaceNormalMap:Au,OctahedronBufferGeometry:wr,OctahedronGeometry:wr,OneFactor:oh,OneMinusDstAlphaFactor:hh,OneMinusDstColorFactor:dh,OneMinusSrcAlphaFactor:Ba,OneMinusSrcColorFactor:ch,OrthographicCamera:Vr,PCFShadowMap:Ia,PCFSoftShadowMap:th,PMREMGenerator:Wx,ParametricBufferGeometry:Xn,ParametricGeometry:Xn,Particle:nv,ParticleBasicMaterial:sv,ParticleSystem:iv,ParticleSystemMaterial:ov,Path:Rr,PerspectiveCamera:tt,Plane:Ft,PlaneBufferGeometry:gr,PlaneGeometry:gr,PlaneHelper:Ux,PointCloud:tv,PointCloudMaterial:rv,PointLight:dc,PointLightHelper:Ix,Points:Ei,PointsMaterial:$n,PolarGridHelper:Bx,PolyhedronBufferGeometry:vn,PolyhedronGeometry:vn,PositionalAudio:vx,PropertyBinding:ut,PropertyMixer:pd,QuadraticBezierCurve:vo,QuadraticBezierCurve3:cc,Quaternion:at,QuaternionKeyframeTrack:Ni,QuaternionLinearInterpolant:Ks,REVISION:Pa,RGBADepthPacking:Eu,RGBAFormat:Et,RGBAIntegerFormat:Vh,RGBA_ASTC_10x10_Format:nu,RGBA_ASTC_10x5_Format:Kh,RGBA_ASTC_10x6_Format:eu,RGBA_ASTC_10x8_Format:tu,RGBA_ASTC_12x10_Format:iu,RGBA_ASTC_12x12_Format:ru,RGBA_ASTC_4x4_Format:qh,RGBA_ASTC_5x4_Format:Xh,RGBA_ASTC_5x5_Format:Yh,RGBA_ASTC_6x5_Format:jh,RGBA_ASTC_6x6_Format:Zh,RGBA_ASTC_8x5_Format:Jh,RGBA_ASTC_8x6_Format:$h,RGBA_ASTC_8x8_Format:Qh,RGBA_BPTC_Format:su,RGBA_ETC2_EAC_Format:_a,RGBA_PVRTC_2BPPV1_Format:xa,RGBA_PVRTC_4BPPV1_Format:ya,RGBA_S3TC_DXT1_Format:da,RGBA_S3TC_DXT3_Format:fa,RGBA_S3TC_DXT5_Format:pa,RGBDEncoding:Ha,RGBEEncoding:oo,RGBEFormat:zh,RGBFormat:fn,RGBIntegerFormat:kh,RGBM16Encoding:Ua,RGBM7Encoding:Oa,RGB_ETC1_Format:Wh,RGB_ETC2_Format:va,RGB_PVRTC_2BPPV1_Format:ga,RGB_PVRTC_4BPPV1_Format:ma,RGB_S3TC_DXT1_Format:ua,RGFormat:Hh,RGIntegerFormat:Gh,RawShaderMaterial:Bi,Ray:Mn,Raycaster:Sc,RectAreaLight:mc,RedFormat:Oh,RedIntegerFormat:Uh,ReinhardToneMapping:Sh,RepeatWrapping:nr,ReplaceStencilOp:Vd,ReverseSubtractEquation:rh,RingBufferGeometry:qs,RingGeometry:qs,SRGB8_ALPHA8_ASTC_10x10_Format:yu,SRGB8_ALPHA8_ASTC_10x5_Format:pu,SRGB8_ALPHA8_ASTC_10x6_Format:mu,SRGB8_ALPHA8_ASTC_10x8_Format:gu,SRGB8_ALPHA8_ASTC_12x10_Format:xu,SRGB8_ALPHA8_ASTC_12x12_Format:vu,SRGB8_ALPHA8_ASTC_4x4_Format:ou,SRGB8_ALPHA8_ASTC_5x4_Format:au,SRGB8_ALPHA8_ASTC_5x5_Format:cu,SRGB8_ALPHA8_ASTC_6x5_Format:lu,SRGB8_ALPHA8_ASTC_6x6_Format:hu,SRGB8_ALPHA8_ASTC_8x5_Format:uu,SRGB8_ALPHA8_ASTC_8x6_Format:du,SRGB8_ALPHA8_ASTC_8x8_Format:fu,Scene:uo,SceneUtils:Av,ShaderChunk:Ae,ShaderLib:Bt,ShaderMaterial:wt,ShadowMaterial:Za,Shape:mn,ShapeBufferGeometry:Mr,ShapeGeometry:Mr,ShapePath:cd,ShapeUtils:en,ShortType:Rh,Skeleton:mo,SkeletonHelper:vd,SkinnedMesh:yr,SmoothShading:Bd,Sphere:wn,SphereBufferGeometry:Sr,SphereGeometry:Sr,Spherical:Rx,SphericalHarmonics3:gc,SplineCurve:_o,SpotLight:uc,SpotLightHelper:Px,Sprite:po,SpriteMaterial:fo,SrcAlphaFactor:Fa,SrcAlphaSaturateFactor:fh,SrcColorFactor:ah,StaticCopyUsage:af,StaticDrawUsage:Ii,StaticReadUsage:rf,StereoCamera:mx,StreamCopyUsage:lf,StreamDrawUsage:nf,StreamReadUsage:of,StringKeyframeTrack:Kn,SubtractEquation:ih,SubtractiveBlending:aa,TOUCH:Id,TangentSpaceNormalMap:jn,TetrahedronBufferGeometry:Xs,TetrahedronGeometry:Xs,TextBufferGeometry:Ys,TextGeometry:Ys,Texture:st,TextureLoader:to,TorusBufferGeometry:js,TorusGeometry:js,TorusKnotBufferGeometry:Zs,TorusKnotGeometry:Zs,Triangle:Je,TriangleFanDrawMode:Gd,TriangleStripDrawMode:Hd,TrianglesDrawMode:Mu,TubeBufferGeometry:Js,TubeGeometry:Js,UVMapping:io,Uint16Attribute:fv,Uint16BufferAttribute:Vn,Uint32Attribute:mv,Uint32BufferAttribute:Wn,Uint8Attribute:hv,Uint8BufferAttribute:hr,Uint8ClampedAttribute:uv,Uint8ClampedBufferAttribute:ur,Uniform:bo,UniformsLib:J,UniformsUtils:Iu,UnsignedByteType:Pi,UnsignedInt248Type:bi,UnsignedIntType:Qi,UnsignedShort4444Type:Ph,UnsignedShort5551Type:Ih,UnsignedShort565Type:Dh,UnsignedShortType:rr,VSMShadowMap:xi,Vector2:W,Vector3:w,Vector4:Be,VectorKeyframeTrack:Ar,Vertex:av,VertexColors:Qx,VideoTexture:Yu,WebGL1Renderer:Wu,WebGLCubeRenderTarget:co,WebGLMultisampleRenderTarget:Ru,WebGLRenderTarget:Kt,WebGLRenderTargetCube:Sv,WebGLRenderer:Oe,WebGLUtils:ku,WireframeGeometry:ja,WireframeHelper:bv,WrapAroundEnding:cr,XHRLoader:wv,ZeroCurvatureEnding:zn,ZeroFactor:sh,ZeroSlopeEnding:On,ZeroStencilOp:kd,sRGBEncoding:zr},Symbol.toStringTag,{value:"Module"}));export{dc as $,Lr as A,fe as B,re as C,Ir as D,xr as E,Lt as F,Un as G,de as H,La as I,ce as J,At as K,Xe as L,rn as M,Os as N,Vr as O,$n as P,Li as Q,fn as R,yr as S,jn as T,Gd as U,W as V,mo as W,Mt as X,w as Y,wn as Z,uc as _,yc as a,fc as a0,bn as a1,xn as a2,ju as a3,Hd as a4,Ar as a5,Ni as a6,Er as a7,Pd as a8,at as a9,nn as aa,Rv as ab,uo as ac,bd as ad,lc as ae,Oe as af,se as ag,Ja as ah,pc as ai,gr as aj,dd as ak,Sc as al,wt as am,Us as an,no as ao,Hn as ap,Ft as aq,Ix as ar,Be as as,vt as at,Bs as au,Ka as av,st as aw,Vn as ax,rt as ay,Jn as az,Vt as b,to as c,bt as d,Ci as e,Na as f,zs as g,it as h,nt as i,nr as j,ir as k,mt as l,Ve as m,ct as n,ut as o,le as p,Ge as q,xt as r,zr as s,Nt as t,qa as u,Ei as v,tt as w,me as x,or as y,ar as z};

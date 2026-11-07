const canvas = document.querySelector("#world");
const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
const loading = document.querySelector("#loading");

if (!gl) {
  loading.innerHTML = "<span>WEBGL 2 IS NOT AVAILABLE IN THIS BROWSER</span>";
  throw new Error("WebGL2 is required");
}

const vertexSource = `#version 300 es
precision highp float;
out vec2 vUv;
void main(){
  vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
  vUv=p;
  gl_Position=vec4(p*2.0-1.0,0.0,1.0);
}`;

const fragmentSource = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uTime;
uniform float uYaw;
uniform float uPitch;
uniform float uZoom;
uniform float uPower;
uniform int uIterations;
uniform float uGlow;
uniform int uPalette;

const float PI=3.14159265359;
float hash31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
vec3 palette(float t){
  if(uPalette==1)return .52+.48*cos(6.28318*(t+vec3(0.0,.12,.25)));
  if(uPalette==2)return .52+.48*cos(6.28318*(t+vec3(.72,.15,.48)));
  if(uPalette==3)return vec3(.55+.4*cos(t*6.28318));
  return .52+.48*cos(6.28318*(t+vec3(.56,.68,.82)));
}
float bulb(vec3 p){
  vec3 z=p;float dr=1.0;float r=0.0;
  for(int i=0;i<18;i++){
    if(i>=uIterations)break;
    r=length(z);if(r>4.0)break;
    float theta=acos(clamp(z.z/(r+1e-8),-1.0,1.0));
    float phi=atan(z.y,z.x);
    dr=pow(r,uPower-1.0)*uPower*dr+1.0;
    float zr=pow(r,uPower);
    theta*=uPower;phi*=uPower;
    z=zr*vec3(sin(theta)*cos(phi),sin(phi)*sin(theta),cos(theta))+p;
  }
  return .5*log(max(r,1e-8))*r/max(dr,1e-8);
}
vec2 scene(vec3 p){
  float d=bulb(p);
  return vec2(d,1.0);
}
vec3 normalAt(vec3 p){
  vec2 e=vec2(.0015,0.0);
  return normalize(vec3(
    scene(p+e.xyy).x-scene(p-e.xyy).x,
    scene(p+e.yxy).x-scene(p-e.yxy).x,
    scene(p+e.yyx).x-scene(p-e.yyx).x
  ));
}
float softShadow(vec3 ro,vec3 rd){
  float res=1.0;float t=.025;
  for(int i=0;i<32;i++){
    float h=scene(ro+rd*t).x;
    res=min(res,12.0*h/t);
    t+=clamp(h,.015,.18);
    if(res<.01||t>3.0)break;
  }
  return clamp(res,0.0,1.0);
}
float ambientOcclusion(vec3 p,vec3 n){
  float occ=0.0;float scale=1.0;
  for(int i=0;i<5;i++){
    float h=.025+.075*float(i)/4.0;
    occ+=(h-scene(p+n*h).x)*scale;
    scale*=.72;
  }
  return clamp(1.0-occ*1.5,0.0,1.0);
}
vec3 stars(vec3 rd){
  vec3 col=vec3(.006,.008,.018);
  for(int layer=0;layer<3;layer++){
    float s=180.0*pow(2.1,float(layer));
    vec3 cell=floor(rd*s);
    float rnd=hash31(cell);
    float star=step(.9975,rnd)*pow(hash31(cell+4.7),18.0);
    col+=star*vec3(.55,.62,.95)*(1.0+float(layer)*.4);
  }
  float haze=pow(max(0.0,1.0-abs(rd.y+.12)),5.0);
  col+=haze*vec3(.035,.025,.09);
  return col;
}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uResolution)/uResolution.y;
  float cy=cos(uYaw),sy=sin(uYaw),cp=cos(uPitch),sp=sin(uPitch);
  vec3 forward=normalize(vec3(sy*cp,sp,cy*cp));
  vec3 right=normalize(cross(forward,vec3(0.0,1.0,0.0)));
  vec3 up=cross(right,forward);
  vec3 rd=normalize(forward*1.65+right*uv.x*1.35+up*uv.y*1.35);
  vec3 ro=-forward*uZoom+vec3(0.0,.12,0.0);
  vec3 col=stars(rd);
  float t=0.0;float glow=0.0;float hit=0.0;
  for(int i=0;i<150;i++){
    vec3 p=ro+rd*t;
    float d=scene(p).x;
    glow+=.0025/(.015+abs(d))*exp(-t*.12);
    if(d<.0012){hit=1.0;break;}
    t+=clamp(d*.72,.0015,.22);
    if(t>18.0)break;
  }
  col+=palette(.58+uTime*.012)*glow*uGlow*.025;
  if(hit>.5){
    vec3 p=ro+rd*t;vec3 n=normalAt(p);
    vec3 light=normalize(vec3(-.65,.8,-.45));
    float diff=max(dot(n,light),0.0);
    float shadow=softShadow(p+n*.004,light);
    float ao=ambientOcclusion(p,n);
    float rim=pow(1.0-max(dot(n,-rd),0.0),3.0);
    float bands=.5+.5*sin(length(p)*8.0+atan(p.y,p.x)*5.0);
    vec3 base=palette(.46+bands*.17+length(p)*.045);
    vec3 lit=base*(.12+diff*shadow*1.7)*ao;
    lit+=palette(.72+bands*.1)*rim*.7;
    lit+=vec3(.55,.62,1.0)*pow(max(dot(reflect(-light,n),-rd),0.0),28.0)*.7;
    col=mix(col,lit,1.0);
  }
  float vignette=1.0-.38*dot(uv,uv);
  col*=vignette;
  col=col/(1.0+col);
  col=pow(max(col,0.0),vec3(.88));
  outColor=vec4(col,1.0);
}`;

function compile(type, source) {
  const shader=gl.createShader(type);
  gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}
const program=gl.createProgram();
gl.attachShader(program,compile(gl.VERTEX_SHADER,vertexSource));
gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragmentSource));
gl.linkProgram(program);
if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
gl.useProgram(program);
const loc={};
["uResolution","uTime","uYaw","uPitch","uZoom","uPower","uIterations","uGlow","uPalette"].forEach(n=>loc[n]=gl.getUniformLocation(program,n));
const state={yaw:0.35,pitch:.18,zoom:4.8,power:8,iterations:12,glow:1.2,palette:0,auto:true,paused:false,drag:false,lastX:0,lastY:0};
let start=performance.now(),lastFrame=start,frames=0,fps=60;

function resize(){
  const dpr=Math.min(devicePixelRatio||1,1.6);
  canvas.width=Math.floor(innerWidth*dpr);canvas.height=Math.floor(innerHeight*dpr);
  gl.viewport(0,0,canvas.width,canvas.height);
}
addEventListener("resize",resize);resize();

function render(now){
  const elapsed=(now-start)/1000;
  const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;
  if(state.auto&&!state.paused&&!state.drag)state.yaw+=dt*.075;
  gl.useProgram(program);
  gl.uniform2f(loc.uResolution,canvas.width,canvas.height);
  gl.uniform1f(loc.uTime,elapsed);
  gl.uniform1f(loc.uYaw,state.yaw);
  gl.uniform1f(loc.uPitch,state.pitch);
  gl.uniform1f(loc.uZoom,state.zoom);
  gl.uniform1f(loc.uPower,state.power);
  gl.uniform1i(loc.uIterations,state.iterations);
  gl.uniform1f(loc.uGlow,state.glow);
  gl.uniform1i(loc.uPalette,state.palette);
  gl.drawArrays(gl.TRIANGLES,0,3);
  frames++;
  if(now-lastFrame>1000){fps=frames;frames=0;document.querySelector("#fps").textContent=fps+" FPS";}
  document.querySelector("#coords").textContent="φ "+state.power.toFixed(3)+" · θ "+state.yaw.toFixed(3);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

function bindRange(id,key,out,format=v=>v.toFixed(1)){
  const el=document.getElementById(id),value=document.getElementById(out);
  el.addEventListener("input",()=>{state[key]=Number(el.value);value.textContent=format(state[key]);});
}
bindRange("power","power","power-value");
bindRange("detail","iterations","detail-value",v=>String(v));
bindRange("zoom","zoom","zoom-value");
bindRange("glow","glow","glow-value");
document.querySelectorAll(".swatch").forEach(btn=>btn.addEventListener("click",()=>{
  state.palette=Number(btn.dataset.palette);
  document.querySelectorAll(".swatch").forEach(b=>b.classList.toggle("active",b===btn));
}));
const panel=document.querySelector("#controls");
document.querySelector("#panel-toggle").addEventListener("click",()=>panel.classList.toggle("hidden"));
document.querySelector("#close-panel").addEventListener("click",()=>panel.classList.add("hidden"));
document.querySelector("#auto").addEventListener("click",e=>{
  state.auto=!state.auto;e.currentTarget.classList.toggle("active",state.auto);
  e.currentTarget.querySelector("span").textContent=state.auto?"ON":"OFF";
});
document.querySelector("#reset").addEventListener("click",()=>{
  Object.assign(state,{yaw:.35,pitch:.18,zoom:4.8,power:8,iterations:12,glow:1.2});
  for(const [id,value] of [["power",8],["detail",12],["zoom",4.8],["glow",1.2]])document.getElementById(id).value=value;
  for(const [id,value] of [["power-value","8.0"],["detail-value","12"],["zoom-value","4.8"],["glow-value","1.2"]])document.getElementById(id).textContent=value;
});
canvas.addEventListener("pointerdown",e=>{state.drag=true;state.lastX=e.clientX;state.lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener("pointermove",e=>{
  if(!state.drag)return;
  state.yaw-=(e.clientX-state.lastX)*.005;
  state.pitch= Math.max(-1.35,Math.min(1.35,state.pitch+(e.clientY-state.lastY)*.005));
  state.lastX=e.clientX;state.lastY=e.clientY;
});
canvas.addEventListener("pointerup",()=>state.drag=false);
canvas.addEventListener("pointercancel",()=>state.drag=false);
canvas.addEventListener("wheel",e=>{e.preventDefault();state.zoom=Math.max(2.4,Math.min(9,state.zoom+e.deltaY*.003));document.querySelector("#zoom").value=state.zoom;document.querySelector("#zoom-value").textContent=state.zoom.toFixed(1);},{passive:false});
addEventListener("keydown",e=>{
  if(e.code==="Space"){e.preventDefault();state.paused=!state.paused;}
  if(e.key.toLowerCase()==="h")panel.classList.toggle("hidden");
});
setTimeout(()=>loading.classList.add("done"),500);
setTimeout(()=>loading.remove(),1200);

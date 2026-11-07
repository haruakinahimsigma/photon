const canvas = document.querySelector("#universe");
const pauseButton = document.querySelector("#pause");
const gl = canvas.getContext("webgl2", { antialias: true, alpha: false, powerPreference: "high-performance" });
if (!gl) throw new Error("PHOTON requires WebGL 2.");

const vertexSource = `#version 300 es
in vec2 position;
out vec2 uv;
void main(){ uv=position*.5+.5; gl_Position=vec4(position,0.,1.); }`;

const fragmentSource = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 outColor;
uniform vec2 resolution;
uniform float time;
uniform float yaw;
uniform float zoom;
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=vec2(dot(p,p+vec2(45.32)));return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1.)),f.x),f.y);}
vec3 starfield(vec2 p){
 vec3 col=vec3(.0015,.002,.004);
 for(int layer=0;layer<3;layer++){
  float scale=90.+float(layer)*75.; vec2 cell=floor(p*scale),f=fract(p*scale)-.5;
  float h=hash21(cell+vec2(float(layer)*71.7)); float size=mix(.008,.027,hash21(cell+vec2(8.1)));
  float star=1.-smoothstep(size,size+.018,length(f)); float twinkle=.72+.28*sin(time*(.7+h*1.8)+h*30.);
  vec3 tint=mix(vec3(.48,.61,.9),vec3(1.,.78,.58),hash21(cell+vec2(4.2))); col+=tint*star*pow(h,13.)*twinkle*2.8;
 }
 float neb=noise(p*5.)*.5+noise(p*12.)*.2; col+=vec3(.025,.018,.035)*neb; return col;
}
float diskProfile(vec2 p,float tilt,float phase){
 float yy=p.y/tilt; float r=length(vec2(p.x,yy)); float inner=.185,outer=.57;
 float edge=smoothstep(inner,inner+.035,r)*(1.-smoothstep(outer-.12,outer,r));
 float band=exp(-pow(abs(yy)*.34,2.)/.0008);
 float turbulence=.72+.18*noise(vec2(atan(yy,p.x)*8.,r*42.+phase))+.10*noise(vec2(atan(yy,p.x)*19.,r*91.-phase));
 float hot=exp(-pow((r-.235)*15.,2.)); float doppler=.58+.72*pow(max(0.,.5+.5*cos(atan(yy,p.x)-.35)),2.);
 return edge*band*turbulence*doppler*(.65+hot*.8);
}
vec3 diskColor(float v,float r){
 vec3 deep=vec3(.42,.075,.018),gold=vec3(1.,.42,.12),white=vec3(1.,.84,.61);
 vec3 c=mix(deep,gold,smoothstep(.02,.55,v)); c=mix(c,white,smoothstep(.48,1.05,v)*.72);
 return c*(.45+1.4*exp(-pow((r-.24)*12.,2.)));
}
void main(){
 vec2 screen=(gl_FragCoord.xy-.5*resolution)/resolution.y;
 vec2 p=vec2(screen.x*cos(yaw)-screen.y*sin(yaw),screen.x*sin(yaw)+screen.y*cos(yaw))/zoom;
 vec2 center=vec2(.045,-.005),q=p-center; float r=max(length(q),.0001),rs=.135;
 float lensStrength=.018; vec2 source=q*(1.+lensStrength/(r*r+.002));
 vec3 col=starfield(source+vec2(time*.0007,0.));
 float halo=exp(-pow((r-rs*1.42)/(.045),2.)); col+=vec3(.16,.105,.065)*halo*.24;
 float tilt=.255; float disk=diskProfile(q,tilt,time*.24);
 float glow=exp(-pow(q.y/(tilt*.19),2.))*smoothstep(.16,.2,abs(q.x))*(1.-smoothstep(.55,.7,abs(q.x)));
 col+=diskColor(.22+glow*.22,length(q))*glow*.13;
 col+=diskColor(disk,length(q))*disk*1.12;
 float horizon=smoothstep(rs*.985,rs*1.015,r); col*=horizon;
 float photonEdge=exp(-pow((r-rs*1.12)/.008,2.)); col+=vec3(.78,.43,.2)*photonEdge*.24;
 float frontDisk=diskProfile(q,tilt,time*.24)*step(-.012,q.y);
 col=mix(col,diskColor(frontDisk,length(q))*1.05,clamp(frontDisk*.96,0.,.94));
 col+=col*col*.11; col=col/(1.+col); col=pow(max(col,vec3(0.)),vec3(.88));
 col*=1.-.34*smoothstep(.25,.9,length(screen)); col+=vec3(.0015,.0013,.0011);
 outColor=vec4(col,1.);
}`;

function compile(type, source) {
 const shader=gl.createShader(type); gl.shaderSource(shader,source); gl.compileShader(shader);
 if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(message);}
 return shader;
}
const program=gl.createProgram();
gl.attachShader(program,compile(gl.VERTEX_SHADER,vertexSource));
gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragmentSource));
gl.linkProgram(program);
if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
gl.useProgram(program);
const vertices=new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]);
const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
const position=gl.getAttribLocation(program,"position");gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
const uniforms=Object.fromEntries(["resolution","time","yaw","zoom"].map(name=>[name,gl.getUniformLocation(program,name)]));
let yaw=-.12,zoom=1,paused=false,elapsed=0,last=performance.now(),dragging=false,previousX=0;
function resize(){
 const dpr=Math.min(devicePixelRatio||1,2),width=Math.floor(canvas.clientWidth*dpr),height=Math.floor(canvas.clientHeight*dpr);
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}
}
function render(now){
 resize();const dt=Math.min((now-last)/1000,.05);last=now;if(!paused)elapsed+=dt;
 gl.useProgram(program);gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);gl.uniform1f(uniforms.time,elapsed);
 gl.uniform1f(uniforms.yaw,yaw);gl.uniform1f(uniforms.zoom,zoom);gl.drawArrays(gl.TRIANGLES,0,6);requestAnimationFrame(render);
}
pauseButton.addEventListener("click",()=>{paused=!paused;pauseButton.textContent=paused?"▶":"Ⅱ";pauseButton.setAttribute("aria-label",paused?"Resume simulation":"Pause simulation");});
canvas.addEventListener("pointerdown",event=>{dragging=true;previousX=event.clientX;canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener("pointermove",event=>{if(!dragging)return;yaw+=(event.clientX-previousX)*.004;previousX=event.clientX;});
canvas.addEventListener("pointerup",()=>dragging=false);canvas.addEventListener("pointercancel",()=>dragging=false);
canvas.addEventListener("wheel",event=>{event.preventDefault();zoom=Math.max(.72,Math.min(1.65,zoom*Math.exp(-event.deltaY*.001)));},{passive:false});
window.addEventListener("resize",resize);requestAnimationFrame(render);
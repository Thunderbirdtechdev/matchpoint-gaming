"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * InductionBadge — a subtle, self-contained WebGL echo of the "Induction Button"
 * scene: animated electric arcs tracing a rounded-pill perimeter with a soft
 * outer glow, tuned down and recoloured to the site's `primary` palette.
 *
 * Wrap any pill-shaped content with it. The canvas sits behind the content and
 * is purely decorative (aria-hidden, pointer-events-none). Falls back to a plain
 * render when WebGL is unavailable, and freezes for `prefers-reduced-motion`.
 */

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_box;      // pill half-size, in units of canvas height
uniform float u_radius;  // pill corner radius, in units of canvas height
uniform float u_intensity;

float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),
             mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);
}
float fbm(vec2 p){
  float v=0.0, a=0.5;
  for(int i=0;i<4;i++){ v+=a*noise(p); p=p*2.05+vec2(9.7,3.1); a*=0.5; }
  return v;
}
float sdRBox(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r;
}
void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float r = min(u_radius, min(u_box.x, u_box.y));
  float d = sdRBox(p, u_box, r);
  float t = u_time;
  float ang = atan(p.y, p.x);

  vec3 col = vec3(0.0);
  float alpha = 0.0;

  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float n1 = fbm(vec2(ang * 2.4 + fi * 11.3, t * (1.05 + fi * 0.22) + fi * 53.1));
    float off = (n1 - 0.5) * 0.05;
    float seg = smoothstep(0.32, 0.8, noise(vec2(ang * 1.8 + fi * 7.7, t * (0.55 + fi * 0.12) + fi * 19.0)));
    seg = 0.45 + 0.55 * seg;
    float g = 0.0042 / (abs(d + off) + 0.009);
    col += (vec3(0.46, 0.3, 1.0) * g + vec3(0.72, 0.62, 1.0) * g * g * 0.5) * seg;
    alpha += g * seg;
  }

  float mask = 1.0 - smoothstep(0.02, 0.16, d);
  col *= mask;
  alpha *= mask;

  // Glow banded on the perimeter so it never washes the interior/text.
  float glow = exp(-abs(d) * 13.0) * 0.28;
  col += vec3(0.55, 0.45, 1.0) * glow;
  alpha += glow;

  float breathe = 0.8 + 0.2 * sin(t * 1.25);
  float k = u_intensity * breathe;
  gl_FragColor = vec4(col * k, clamp(alpha, 0.0, 1.0) * k);
}
`;

type InductionBadgeProps = {
  children: ReactNode;
  /** classes for the inner pill element */
  className?: string;
  /** master strength, 0–1. Keep it low for "subtle". */
  intensity?: number;
};

export function InductionBadge({
  children,
  className,
  intensity = 0.9,
}: InductionBadgeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const inner = innerRef.current;
    if (!canvas || !inner) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
    });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      return shader;
    };

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const locP = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(locP);
    gl.vertexAttribPointer(locP, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uBox = gl.getUniformLocation(prog, "u_box");
    const uRadius = gl.getUniformLocation(prog, "u_radius");
    const uIntensity = gl.getUniformLocation(prog, "u_intensity");

    let raf = 0;
    const start = performance.now();

    const render = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight || 1;
      const w = Math.max(1, Math.round(cw * dpr));
      const h = Math.max(1, Math.round(ch * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }

      const pill = inner.getBoundingClientRect();
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uTime, reduced ? 2.0 : (now - start) / 1000);
      gl.uniform2f(uBox, pill.width * 0.5 / ch, pill.height * 0.5 / ch);
      gl.uniform1f(uRadius, pill.height * 0.5 / ch);
      gl.uniform1f(uIntensity, intensity);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (!reduced) raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => cancelAnimationFrame(raf);
  }, [intensity]);

  return (
    <span className="relative inline-flex">
      <span ref={innerRef} className={cn("relative", className)}>
        {children}
      </span>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[calc(100%+3rem)] w-[calc(100%+3.5rem)] -translate-x-1/2 -translate-y-1/2"
      />
    </span>
  );
}

export default InductionBadge;

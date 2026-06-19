/* suminagashi.js — WebGL ink-marbling hero background. Stable-fluids sim based on Pavel Dobryakov's WebGL-Fluid-Simulation (MIT). */

'use strict';

(function () {
  const canvas  = document.getElementById('suminagashi');
  const hero    = document.getElementById('hero');
  const washBtn = document.getElementById('ink-wash');
  if (!canvas || !hero) return;

  function disableInk() {
    document.body.classList.add('no-ink');
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    disableInk();
    return;
  }

  /* config */
  // スマホは解像度を落として軽く(見た目の差はほぼ出ない)
  const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 768;

  const config = {
    SIM_RESOLUTION: isSmallScreen ? 96 : 128,
    DYE_RESOLUTION: isSmallScreen ? 384 : 512,
    DENSITY_DISSIPATION: 0.9992,  // 墨はゆっくり薄れる
    VELOCITY_DISSIPATION: 0.988,  // 低いほど水が早く静まる(=流れが穏やか)
    PRESSURE: 0.8,
    PRESSURE_ITERATIONS: 20,
    CURL: 10,                     // 渦の強さ(マーブリングの要)
    STIR_RADIUS: 0.14,
    STIR_FORCE: 2400,
    DROP_RADIUS_MIN: 0.22,
    DROP_RADIUS_MAX: 0.5,
    DROP_AMOUNT: 0.55,
    POUR_RATE: 6.0,               // ホールド中に注がれる墨量(毎秒)
    POUR_RADIUS: 0.16,
    WASH_DURATION: 1.6,           // 秒
    WASH_DENSITY_DISSIPATION: 0.86,
    WASH_VELOCITY_DISSIPATION: 0.9,
    SWEEP_DURATION: 3.4,          // 開幕: 一滴が左から中央へ漂う所要秒数
    SWEEP_END_X: 0.52,            // 滴が止まり花開く位置(題字のある中央付近)
    SWEEP_HEAD_FORCE: 64,         // 滴を運ぶ水流(右壁には届かない弱さ)
    SWEEP_HEAD_AMOUNT: 0.11,      // 滴の濃さ(毎フレーム)
    SWEEP_INK_TIME: 0.35,         // 墨を出すのは道中の最初の35%だけ(以降は水流で運ぶ)
    SWEEP_HEAD_RADIUS: 0.04,      // 滴の幅
    BURST_FORCE: 120,             // 中央で「ぶわっ」と開く勢い(墨は足さず水流のみ)
  };

  /* webgl context */
  const params = {
    alpha: true, depth: false, stencil: false,
    antialias: false, preserveDrawingBuffer: false, premultipliedAlpha: true
  };

  let gl = canvas.getContext('webgl2', params);
  const isWebGL2 = !!gl;
  if (!gl) {
    gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
  }
  if (!gl) { disableInk(); return; }

  let halfFloat = null;
  let supportLinearFiltering = null;
  if (isWebGL2) {
    gl.getExtension('EXT_color_buffer_float');
    supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
  } else {
    halfFloat = gl.getExtension('OES_texture_half_float');
    supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
  }
  gl.clearColor(0, 0, 0, 0);

  const halfFloatTexType = isWebGL2
    ? gl.HALF_FLOAT
    : (halfFloat && halfFloat.HALF_FLOAT_OES);

  if (!halfFloatTexType) { disableInk(); return; }

  function supportRenderTextureFormat(internalFormat, format, type) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  }

  function getSupportedFormat(internalFormat, format, type) {
    if (!supportRenderTextureFormat(internalFormat, format, type)) {
      if (isWebGL2) {
        switch (internalFormat) {
          case gl.R16F:  return getSupportedFormat(gl.RG16F, gl.RG, type);
          case gl.RG16F: return getSupportedFormat(gl.RGBA16F, gl.RGBA, type);
          default:       return null;
        }
      }
      return null;
    }
    return { internalFormat, format };
  }

  let formatRGBA, formatRG, formatR;
  if (isWebGL2) {
    formatRGBA = getSupportedFormat(gl.RGBA16F, gl.RGBA, halfFloatTexType);
    formatRG   = getSupportedFormat(gl.RG16F, gl.RG, halfFloatTexType);
    formatR    = getSupportedFormat(gl.R16F, gl.RED, halfFloatTexType);
  } else {
    formatRGBA = getSupportedFormat(gl.RGBA, gl.RGBA, halfFloatTexType);
    formatRG   = formatRGBA;
    formatR    = formatRGBA;
  }
  if (!formatRGBA) { disableInk(); return; }

  /* shaders */
  function compileShader(type, source, keywords) {
    if (keywords) {
      let prefix = '';
      keywords.forEach(k => { prefix += '#define ' + k + '\n'; });
      source = prefix + source;
    }
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  function createProgram(vs, fs) {
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn(gl.getProgramInfoLog(program));
    }
    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const name = gl.getActiveUniform(program, i).name;
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return { program, uniforms, bind() { gl.useProgram(program); } };
  }

  const baseVertexShader = compileShader(gl.VERTEX_SHADER, `
    precision highp float;
    attribute vec2 aPosition;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform vec2 texelSize;
    void main () {
      vUv = aPosition * 0.5 + 0.5;
      vL = vUv - vec2(texelSize.x, 0.0);
      vR = vUv + vec2(texelSize.x, 0.0);
      vT = vUv + vec2(0.0, texelSize.y);
      vB = vUv - vec2(0.0, texelSize.y);
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `);

  const copyShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    uniform sampler2D uTexture;
    void main () { gl_FragColor = texture2D(uTexture, vUv); }
  `);

  const clearShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    uniform sampler2D uTexture;
    uniform float value;
    void main () { gl_FragColor = value * texture2D(uTexture, vUv); }
  `);

  const splatShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTarget;
    uniform float aspectRatio;
    uniform vec3 color;
    uniform vec2 point;
    uniform float radius;
    void main () {
      vec2 p = vUv - point.xy;
      p.x *= aspectRatio;
      vec3 splat = exp(-dot(p, p) / radius) * color;
      vec3 base = texture2D(uTarget, vUv).xyz;
      gl_FragColor = vec4(base + splat, 1.0);
    }
  `);

  const advectionShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 texelSize;
    uniform vec2 dyeTexelSize;
    uniform float dt;
    uniform float dissipation;
    vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
      vec2 st = uv / tsize - 0.5;
      vec2 iuv = floor(st);
      vec2 fuv = fract(st);
      vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
      vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
      vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
      vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
      return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
    }
    void main () {
    #ifdef MANUAL_FILTERING
      vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
      vec4 result = bilerp(uSource, coord, dyeTexelSize);
    #else
      vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
      vec4 result = texture2D(uSource, coord);
    #endif
      gl_FragColor = dissipation * result;
    }
  `, supportLinearFiltering ? null : ['MANUAL_FILTERING']);

  const divergenceShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;
    void main () {
      float L = texture2D(uVelocity, vL).x;
      float R = texture2D(uVelocity, vR).x;
      float T = texture2D(uVelocity, vT).y;
      float B = texture2D(uVelocity, vB).y;
      vec2 C = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) { L = -C.x; }
      if (vR.x > 1.0) { R = -C.x; }
      if (vT.y > 1.0) { T = -C.y; }
      if (vB.y < 0.0) { B = -C.y; }
      float div = 0.5 * (R - L + T - B);
      gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
    }
  `);

  const curlShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;
    void main () {
      float L = texture2D(uVelocity, vL).y;
      float R = texture2D(uVelocity, vR).y;
      float T = texture2D(uVelocity, vT).x;
      float B = texture2D(uVelocity, vB).x;
      float vorticity = R - L - T + B;
      gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
    }
  `);

  const vorticityShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform float curl;
    uniform float dt;
    void main () {
      float L = texture2D(uCurl, vL).x;
      float R = texture2D(uCurl, vR).x;
      float T = texture2D(uCurl, vT).x;
      float B = texture2D(uCurl, vB).x;
      float C = texture2D(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force /= length(force) + 0.0001;
      force *= curl * C;
      force.y *= -1.0;
      vec2 velocity = texture2D(uVelocity, vUv).xy;
      velocity += force * dt;
      velocity = min(max(velocity, -1000.0), 1000.0);
      gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
  `);

  const pressureShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;
    void main () {
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      float divergence = texture2D(uDivergence, vUv).x;
      float pressure = (L + R + B + T - divergence) * 0.25;
      gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
    }
  `);

  const gradientSubtractShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;
    void main () {
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      vec2 velocity = texture2D(uVelocity, vUv).xy;
      velocity.xy -= vec2(R - L, T - B);
      gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
  `);

  /* 墨の描画 — 濃度→不透明度(premultiplied alpha)。紙はCSS背景が担う */
  const displayShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTexture;
    void main () {
      float d = texture2D(uTexture, vUv).r;
      float a = clamp(pow(max(d, 0.0), 0.85), 0.0, 1.0);
      vec3 ink = vec3(0.082, 0.075, 0.066); // 墨 #15130F
      gl_FragColor = vec4(ink * a, a);
    }
  `);

  const copyProgram             = createProgram(baseVertexShader, copyShader);
  const clearProgram            = createProgram(baseVertexShader, clearShader);
  const splatProgram            = createProgram(baseVertexShader, splatShader);
  const advectionProgram        = createProgram(baseVertexShader, advectionShader);
  const divergenceProgram       = createProgram(baseVertexShader, divergenceShader);
  const curlProgram             = createProgram(baseVertexShader, curlShader);
  const vorticityProgram        = createProgram(baseVertexShader, vorticityShader);
  const pressureProgram         = createProgram(baseVertexShader, pressureShader);
  const gradientSubtractProgram = createProgram(baseVertexShader, gradientSubtractShader);
  const displayProgram          = createProgram(baseVertexShader, displayShader);

  /* geometry / blit */
  const blit = (() => {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    return (target) => {
      if (target == null) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    };
  })();

  /* framebuffers */
  let dye, velocity, divergence, curl, pressure;

  function createFBO(w, h, internalFormat, format, type, filtering) {
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtering);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtering);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    return {
      texture, fbo,
      width: w, height: h,
      texelSizeX: 1 / w, texelSizeY: 1 / h,
      attach(id) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      }
    };
  }

  function createDoubleFBO(w, h, internalFormat, format, type, filtering) {
    let fbo1 = createFBO(w, h, internalFormat, format, type, filtering);
    let fbo2 = createFBO(w, h, internalFormat, format, type, filtering);
    return {
      width: w, height: h,
      texelSizeX: fbo1.texelSizeX, texelSizeY: fbo1.texelSizeY,
      get read()  { return fbo1; },
      set read(v) { fbo1 = v; },
      get write()  { return fbo2; },
      set write(v) { fbo2 = v; },
      swap() { const t = fbo1; fbo1 = fbo2; fbo2 = t; }
    };
  }

  function resizeFBO(target, w, h, internalFormat, format, type, filtering) {
    const newFBO = createFBO(w, h, internalFormat, format, type, filtering);
    copyProgram.bind();
    gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
    blit(newFBO);
    return newFBO;
  }

  function resizeDoubleFBO(target, w, h, internalFormat, format, type, filtering) {
    if (target.width === w && target.height === h) return target;
    target.read = resizeFBO(target.read, w, h, internalFormat, format, type, filtering);
    target.write = createFBO(w, h, internalFormat, format, type, filtering);
    target.width = w; target.height = h;
    target.texelSizeX = 1 / w; target.texelSizeY = 1 / h;
    return target;
  }

  function getResolution(resolution) {
    let aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspect < 1) aspect = 1 / aspect;
    const min = Math.round(resolution);
    const max = Math.round(resolution * aspect);
    if (gl.drawingBufferWidth > gl.drawingBufferHeight) {
      return { width: max, height: min };
    }
    return { width: min, height: max };
  }

  function initFramebuffers() {
    const simRes = getResolution(config.SIM_RESOLUTION);
    const dyeRes = getResolution(config.DYE_RESOLUTION);
    const texType = halfFloatTexType;
    const filtering = supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
    gl.disable(gl.BLEND);

    if (!dye) {
      dye = createDoubleFBO(dyeRes.width, dyeRes.height, formatRGBA.internalFormat, formatRGBA.format, texType, filtering);
    } else {
      dye = resizeDoubleFBO(dye, dyeRes.width, dyeRes.height, formatRGBA.internalFormat, formatRGBA.format, texType, filtering);
    }

    if (!velocity) {
      velocity = createDoubleFBO(simRes.width, simRes.height, formatRG.internalFormat, formatRG.format, texType, filtering);
    } else {
      velocity = resizeDoubleFBO(velocity, simRes.width, simRes.height, formatRG.internalFormat, formatRG.format, texType, filtering);
    }

    divergence = createFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, texType, gl.NEAREST);
    curl       = createFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, texType, gl.NEAREST);
    pressure   = createDoubleFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, texType, gl.NEAREST);
  }

  /* simulation step */
  let washUntil = 0;

  function step(dt) {
    const now = performance.now();
    const washing = now < washUntil;
    const densityDissipation  = washing ? config.WASH_DENSITY_DISSIPATION  : config.DENSITY_DISSIPATION;
    const velocityDissipation = washing ? config.WASH_VELOCITY_DISSIPATION : config.VELOCITY_DISSIPATION;

    gl.disable(gl.BLEND);

    curlProgram.bind();
    gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(curl);

    vorticityProgram.bind();
    gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
    gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
    gl.uniform1f(vorticityProgram.uniforms.dt, dt);
    blit(velocity.write);
    velocity.swap();

    divergenceProgram.bind();
    gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(divergence);

    clearProgram.bind();
    gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
    gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE);
    blit(pressure.write);
    pressure.swap();

    pressureProgram.bind();
    gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
    for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    gradientSubtractProgram.bind();
    gl.uniform2f(gradientSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(gradientSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
    gl.uniform1i(gradientSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    advectionProgram.bind();
    gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    if (!supportLinearFiltering) {
      gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    }
    gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(advectionProgram.uniforms.uSource, velocity.read.attach(0));
    gl.uniform1f(advectionProgram.uniforms.dt, dt);
    gl.uniform1f(advectionProgram.uniforms.dissipation, velocityDissipation);
    blit(velocity.write);
    velocity.swap();

    if (!supportLinearFiltering) {
      gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
    }
    gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
    gl.uniform1f(advectionProgram.uniforms.dissipation, densityDissipation);
    blit(dye.write);
    dye.swap();
  }

  function render() {
    gl.disable(gl.BLEND);
    displayProgram.bind();
    gl.uniform1i(displayProgram.uniforms.uTexture, dye.read.attach(0));
    blit(null);
  }

  /* splats */
  function correctRadius(radius) {
    const aspect = canvas.width / canvas.height;
    if (aspect > 1) radius *= aspect;
    return radius;
  }

  function splat(x, y, dx, dy, amount, radius) {
    splatProgram.bind();
    gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
    gl.uniform2f(splatProgram.uniforms.point, x, y);
    gl.uniform1f(splatProgram.uniforms.radius, correctRadius(radius / 100));

    gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
    gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0);
    blit(velocity.write);
    velocity.swap();

    if (amount > 0) {
      gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
      gl.uniform3f(splatProgram.uniforms.color, amount, amount, amount);
      blit(dye.write);
      dye.swap();
    }
  }

  function dropInk(x, y, amount) {
    const r = config.DROP_RADIUS_MIN + Math.random() * (config.DROP_RADIUS_MAX - config.DROP_RADIUS_MIN);
    splat(x, y, (Math.random() - 0.5) * 26, (Math.random() - 0.5) * 26, amount, r);
  }

  /* pointer interaction(canvas は pointer-events:none — hero で拾う) */
  const pointer = { x: -1, y: -1, init: false, down: false };

  /* タッチ: スクロールと区別する
     - タップ(動かさず短時間で離す) = 一滴
     - 長押し(150ms 静止)          = 注ぎ続ける
     - スクロール(動かす)           = 墨を出さない */
  const TAP_MAX_MS = 300;
  const TAP_MOVE_PX = 12;
  const HOLD_DELAY_MS = 150;
  let touch = null;

  function toCanvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: (clientX - rect.left) / rect.width,
      y: 1 - (clientY - rect.top) / rect.height,
      inside: clientX >= rect.left && clientX <= rect.right &&
              clientY >= rect.top && clientY <= rect.bottom
    };
  }

  /* 移動 = 水面をかき混ぜるだけ(墨は出さない)。墨はクリック/ホールドで */
  hero.addEventListener('pointermove', (e) => {
    // タッチ: しきい値を超えて動いたらスクロール扱い → 墨を出さない
    if (touch && e.pointerType === 'touch') {
      if (Math.hypot(e.clientX - touch.sx, e.clientY - touch.sy) > TAP_MOVE_PX) {
        touch.moved = true;
        clearTimeout(touch.timer);
        pointer.down = false;
      }
    }
    const p = toCanvasCoords(e.clientX, e.clientY);
    if (!p || !p.inside) return;
    if (!pointer.init) {
      pointer.x = p.x; pointer.y = p.y; pointer.init = true;
      return;
    }
    const dx = p.x - pointer.x;
    const dy = p.y - pointer.y;
    pointer.x = p.x; pointer.y = p.y;
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return;
    splat(p.x, p.y, dx * config.STIR_FORCE, dy * config.STIR_FORCE, 0, config.STIR_RADIUS);
  }, { passive: true });

  hero.addEventListener('pointerleave', () => {
    pointer.init = false;
    pointer.down = false;
  }, { passive: true });

  hero.addEventListener('pointerdown', (e) => {
    if (washBtn && washBtn.contains(e.target)) return;
    const p = toCanvasCoords(e.clientX, e.clientY);
    if (!p || !p.inside) return;
    pointer.x = p.x; pointer.y = p.y; pointer.init = true;

    if (e.pointerType === 'touch') {
      // タッチはまだ墨を出さない。150ms 静止で「注ぎ」開始
      touch = {
        sx: e.clientX, sy: e.clientY,
        t0: performance.now(),
        moved: false,
        timer: setTimeout(() => {
          if (touch && !touch.moved) pointer.down = true;
        }, HOLD_DELAY_MS)
      };
    } else {
      // マウスは従来どおり: 即一滴 + ホールドで注ぐ
      pointer.down = true;
      dropInk(p.x, p.y, config.DROP_AMOUNT);
    }
  }, { passive: true });

  function endPointer(allowTap) {
    if (touch) {
      clearTimeout(touch.timer);
      const dt = performance.now() - touch.t0;
      // 動かさず短時間で離した = タップ → 一滴
      if (allowTap && !touch.moved && !pointer.down && dt < TAP_MAX_MS && pointer.init) {
        dropInk(pointer.x, pointer.y, config.DROP_AMOUNT);
      }
      touch = null;
    }
    pointer.down = false;
  }

  window.addEventListener('pointerup', () => endPointer(true), { passive: true });
  // スクロール開始などでキャンセルされた場合はタップ扱いにしない
  window.addEventListener('pointercancel', () => endPointer(false), { passive: true });

  /* 洗い流し */
  if (washBtn) {
    washBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      washUntil = performance.now() + config.WASH_DURATION * 1000;
      washBtn.classList.add('is-washing');
      setTimeout(() => washBtn.classList.remove('is-washing'), config.WASH_DURATION * 1000);
    });
  }

  /* loop */
  let lastTime = performance.now();
  let inView = true;
  let sweepStart = 0;

  /* 開幕 — 濃い一滴が左から中央へ漂い、題字のあたりで「ぶわっ」と花開く */
  function runSweep(now) {
    if (!sweepStart) return;
    const t = (now - sweepStart) / (config.SWEEP_DURATION * 1000);
    const y0 = 0.5;

    // 中央到達 — 放射状にぶわっと開いて終了
    if (t >= 1) {
      const bx = config.SWEEP_END_X;
      const aspectFix = canvas.height / Math.max(canvas.width, 1); // x方向の見た目補正
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
        // 中心から少し外したところに外向きの流れを置く → 放射状の開き
        splat(
          bx + Math.cos(a) * 0.05 * aspectFix,
          y0 + Math.sin(a) * 0.05,
          Math.cos(a) * config.BURST_FORCE,
          Math.sin(a) * config.BURST_FORCE,
          0,
          0.16
        );
      }
      // 墨はここでは足さない — 左から運んできた墨を水流だけで開かせる
      sweepStart = 0;
      return;
    }

    // 道中 — 一滴の濃い頭が減速しながら右へ漂う(壁には届かない)
    // 墨を出すのは序盤だけ。それ以降は水流のみで運ぶ
    const ease = 1 - Math.pow(1 - t, 2); // easeOutQuad
    const x = 0.06 + (config.SWEEP_END_X - 0.06) * ease;
    const y = y0 + 0.02 * Math.sin(t * Math.PI * 3);
    const force = config.SWEEP_HEAD_FORCE * (1 - 0.6 * t);
    const ink = t < config.SWEEP_INK_TIME ? config.SWEEP_HEAD_AMOUNT : 0;
    splat(x, y, force, (Math.random() - 0.5) * 6, ink, config.SWEEP_HEAD_RADIUS);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
    }).observe(canvas);
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      return true;
    }
    return false;
  }

  function update() {
    const now = performance.now();
    let dt = (now - lastTime) / 1000;
    dt = Math.min(dt, 0.016666);
    lastTime = now;

    if (resizeCanvas()) initFramebuffers();

    if (inView && !document.hidden) {
      runSweep(now);

      // ホールド中 — 墨を注ぎ続ける(わずかに揺らぎを与えて滲ませる)
      if (pointer.down && pointer.init) {
        splat(
          pointer.x, pointer.y,
          (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10,
          config.POUR_RATE * dt, config.POUR_RADIUS
        );
      }

      step(dt);
      render();
    }
    requestAnimationFrame(update);
  }

  /* init */
  resizeCanvas();
  initFramebuffers();

  // 開幕 — 左から右への刷毛入れ(毎回)
  sweepStart = performance.now();

  update();
})();
